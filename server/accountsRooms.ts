import {
  AccountError, accountDatabase, accountJson, consumeAccountRate, ensureAccountSchema,
  readAccountPayload, requireAccountOrigin, requireAccountSession,
} from "./accounts";
import { authenticateRoom, createSecret, ensureRoomSchema, hashSecret, safeRoomCode, safeText, type RoomAuth } from "./rooms";
import type { TursoDatabase } from "./runtime";

type Membership = { code: string; title: string; role: "narrator" | "player"; player_id: string | null; display_name: string; account_id: string };
let schemaDatabase: TursoDatabase | null = null;
let schemaPromise: Promise<void> | null = null;
const VALID_MEMBERSHIP = `(m.role = 'narrator' AND m.credential_hash = r.narrator_secret_hash)
  OR (m.role = 'player' AND p.room_code = r.code AND m.credential_hash = p.token_hash)`;

export async function ensureAccountRoomSchema() {
  await ensureAccountSchema();
  await ensureRoomSchema();
  const db = accountDatabase();
  if (schemaDatabase === db && schemaPromise) return schemaPromise;
  schemaDatabase = db;
  schemaPromise = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS myowndex_account_rooms (
      account_id TEXT NOT NULL REFERENCES myowndex_accounts(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('narrator', 'player')),
      player_id TEXT REFERENCES room_players(id) ON DELETE CASCADE,
      actor_key TEXT NOT NULL,
      credential_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(account_id, room_code),
      UNIQUE(room_code, actor_key),
      CHECK((role = 'narrator' AND player_id IS NULL) OR (role = 'player' AND player_id IS NOT NULL))
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS myowndex_account_rooms_code_idx ON myowndex_account_rooms(room_code)"),
  ]).then(() => undefined).catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

function reference(row: Membership) {
  return {
    code: row.code, title: row.title, role: row.role, playerId: row.player_id,
    displayName: row.display_name, key: `account_${row.account_id}`, local: false,
  };
}

export async function listAccountRooms(request: Request) {
  await ensureAccountRoomSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "read", account.id);
  const rows = await accountDatabase().prepare(`SELECT r.code, r.title, m.role, m.player_id, m.display_name, m.account_id
    FROM myowndex_account_rooms m JOIN rooms r ON r.code = m.room_code
    LEFT JOIN room_players p ON p.id = m.player_id
    WHERE m.account_id = ? AND (${VALID_MEMBERSHIP})
    ORDER BY m.created_at DESC, r.code`).bind(account.id).all<Membership>();
  return accountJson({ rooms: rows.results.map(reference) });
}

export async function bindAccountRoom(request: Request) {
  requireAccountOrigin(request);
  await ensureAccountRoomSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "write", account.id);
  const payload = await readAccountPayload(request);
  const code = safeRoomCode(payload.code);
  const key = typeof payload.key === "string" && payload.key.length <= 96 ? payload.key : "";
  // Only the original room proof can establish membership; an account marker is not a bearer token.
  const auth = !key.startsWith("account_") ? await authenticateRoom(code, key) : null;
  if (!auth) throw new AccountError("Confira o acesso à aventura antes de vinculá-la à conta.", 401, "ACCOUNT_ROOM_ACCESS");
  const actor = auth.role === "narrator" ? "narrator" : auth.playerId!;
  const db = accountDatabase();
  const count = await db.prepare("SELECT count(*) AS count FROM myowndex_account_rooms WHERE account_id = ?").bind(account.id).first<{ count: number }>();
  const existing = await db.prepare("SELECT account_id FROM myowndex_account_rooms WHERE account_id = ? AND room_code = ?").bind(account.id, code).first();
  if (!existing && (!count || count.count >= 200)) throw new AccountError("Esta conta já tem 200 aventuras vinculadas. Retire da lista as que quiser arquivar antes de adicionar outra.", 413, "ACCOUNT_ROOMS_LIMIT");
  const credentialHash = await hashSecret(key);
  const name = auth.role === "narrator" ? safeText(payload.displayName, 32) || account.display_name : auth.displayName;
  const result = await db.prepare(`INSERT INTO myowndex_account_rooms(account_id, room_code, role, player_id, actor_key, credential_hash, display_name)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM myowndex_account_rooms WHERE room_code = ? AND actor_key = ? AND account_id <> ?)
      AND EXISTS (SELECT 1 FROM rooms r LEFT JOIN room_players p ON p.id = ?
        WHERE r.code = ? AND ((? = 'narrator' AND r.narrator_secret_hash = ?) OR (? = 'player' AND p.room_code = r.code AND p.token_hash = ?)))
    ON CONFLICT(account_id, room_code) DO UPDATE SET role = excluded.role, player_id = excluded.player_id,
      actor_key = excluded.actor_key, credential_hash = excluded.credential_hash, display_name = excluded.display_name`)
    .bind(account.id, code, auth.role, auth.playerId, actor, credentialHash, name,
      code, actor, account.id, auth.playerId, code, auth.role, credentialHash, auth.role, credentialHash).run();
  if (!result.meta.changes) throw new AccountError("Esse acesso já está vinculado a outra conta ou mudou. Use o acesso da sua própria participação.", 409, "ACCOUNT_ROOM_LINKED");
  const room = await db.prepare("SELECT title FROM rooms WHERE code = ?").bind(code).first<{ title: string }>();
  return accountJson({ room: reference({ code, title: room?.title || "Aventura", role: auth.role, player_id: auth.playerId, display_name: name, account_id: account.id }) }, { status: 201 });
}

export async function unlinkAccountRoom(request: Request) {
  requireAccountOrigin(request);
  await ensureAccountRoomSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "write", account.id);
  const payload = await readAccountPayload(request);
  const code = safeRoomCode(payload.code);
  if (!code) throw new AccountError("Confira o código da aventura.");
  await accountDatabase().prepare("DELETE FROM myowndex_account_rooms WHERE account_id = ? AND room_code = ?").bind(account.id, code).run();
  return accountJson({ unlinked: true, code });
}

export async function regenerateAccountRoomInvite(request: Request) {
  requireAccountOrigin(request);
  await ensureAccountRoomSchema();
  const account = await requireAccountSession(request);
  await consumeAccountRate(request, "invite", account.id);
  const payload = await readAccountPayload(request);
  const code = safeRoomCode(payload.code);
  const auth = await authenticateAccountRoom(code, `account_${account.id}`, request);
  if (!auth || auth.role !== "narrator") throw new AccountError("Só o Narrador pode gerar outro convite para esta aventura.", 403, "ACCOUNT_ROOM_NARRATOR");
  const inviteCode = createSecret("join");
  const hash = await hashSecret(inviteCode);
  const updated = await accountDatabase().prepare(`UPDATE rooms SET invite_secret_hash = ?
    WHERE code = ? AND narrator_secret_hash = (SELECT credential_hash FROM myowndex_account_rooms
      WHERE account_id = ? AND room_code = ? AND role = 'narrator')`).bind(hash, code, account.id, code).run();
  if (!updated.meta.changes) throw new AccountError("O acesso desta aventura mudou. Atualize a sala antes de gerar outro convite.", 409, "ACCOUNT_ROOM_ACCESS");
  return accountJson({ inviteCode });
}

/** Server-side membership authorizes a nonsecret account marker on all existing room APIs. */
export async function authenticateAccountRoom(code: string, key: string, request: Request): Promise<RoomAuth | null> {
  if (!new Set(["GET", "HEAD"]).has(request.method.toUpperCase())) requireAccountOrigin(request, false);
  await ensureAccountRoomSchema();
  const account = await requireAccountSession(request);
  if (key !== `account_${account.id}`) throw new AccountError("Este acesso pertence a outra conta. Atualize a aventura.", 409, "ACCOUNT_SCOPE_CHANGED");
  const row = await accountDatabase().prepare(`SELECT r.code, r.title, m.role, m.player_id, m.display_name, m.account_id
    FROM myowndex_account_rooms m JOIN rooms r ON r.code = m.room_code LEFT JOIN room_players p ON p.id = m.player_id
    WHERE m.account_id = ? AND m.room_code = ? AND (${VALID_MEMBERSHIP})`).bind(account.id, code).first<Membership>();
  if (!row) return null;
  if (row.player_id) await accountDatabase().prepare("UPDATE room_players SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.player_id).run();
  return { role: row.role, playerId: row.player_id, displayName: row.display_name, accountId: account.id };
}
