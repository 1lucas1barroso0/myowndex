import {
  applyAuthoritativeMovePriorities,
  AuthoritativeActionError,
  createAuditedSecureRandom,
  normalizeAuthoritativeRequest,
  requestFingerprintPayload,
  resolveAuthoritativeAction,
} from "../../../../../server/authoritativeActions.js";
import {
  assertStateSize,
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  getRoom,
  getRoomBundle,
  hashSecret,
  noStoreJson,
  parseJson,
  readRoomKey,
  requireCurrentRoomProtocol,
  routeError,
  safeRoomCode,
} from "../../../../../server/rooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> | { code: string } };

type StoredRollRow = {
  id: number;
  request_id: string;
  request_fingerprint: string;
  player_id: string | null;
  author: string;
  action_type: string;
  mode: string;
  request_json: string;
  result_json: string;
  status: string;
  created_at: string;
};

const readStoredRoll = (code: string, actorKey: string, requestId: string) => {
  const { db } = getBindings();
  return db.prepare(
    `SELECT id, request_id, request_fingerprint, player_id, author, action_type,
      mode, request_json, result_json, status, created_at
     FROM room_rolls
     WHERE room_code = ? AND actor_key = ? AND request_id = ? LIMIT 1`,
  ).bind(code, actorKey, requestId).first<StoredRollRow>();
};

const decorateStoredRoll = (row: StoredRollRow) => ({
  ...parseJson<Record<string, unknown>>(row.result_json, {}),
  id: `authority-${row.id}`,
  sequence: row.id,
  requestId: row.request_id,
  playerId: row.player_id,
  author: row.author,
  actionType: row.action_type,
  mode: row.mode,
  request: parseJson(row.request_json, {}),
  createdAt: row.created_at,
  serverAuthoritative: true,
});

const responseForStored = async (code: string, role: "narrator" | "player", row: StoredRollRow) => {
  const room = await getRoomBundle(code, role);
  return noStoreJson({ ok: true, result: decorateStoredRoll(row), room });
};

type PokeApiMove = { name?: string; priority?: number } & Record<string, unknown>;

const fetchMove = async (name: string): Promise<PokeApiMove | null> => {
  if (!name) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new AuthoritativeActionError("A Pokédex não conseguiu confirmar este movimento agora.", 502);
    return await response.json() as PokeApiMove;
  } catch (error) {
    if (error instanceof AuthoritativeActionError) throw error;
    throw new AuthoritativeActionError("A Pokédex não conseguiu confirmar este movimento agora.", 502);
  } finally {
    clearTimeout(timeout);
  }
};

const snapshotWithServerPriorities = async (snapshot: Record<string, unknown>) => {
  const tokens = Array.isArray(snapshot.tokens) ? snapshot.tokens : [];
  const declaredMoves = [...new Set(tokens.flatMap(token => {
    if (!token || typeof token !== "object") return [];
    const candidate = token as Record<string, unknown>;
    const declaredMove = String(candidate.declaredMove || "").trim().toLowerCase();
    const knownMoves = Array.isArray(candidate.moves)
      ? candidate.moves.map(move => String(move || "").trim().toLowerCase())
      : [];
    return declaredMove && knownMoves.includes(declaredMove) ? [declaredMove] : [];
  }))];
  const moves = await Promise.all(declaredMoves.map(fetchMove));
  const priorities = new Map(moves.flatMap(move =>
    move?.name ? [[move.name, Number(move.priority)]] : []
  ));
  return applyAuthoritativeMovePriorities(snapshot, priorities);
};

export async function POST(request: Request, context: RouteContext) {
  const protocolError = requireCurrentRoomProtocol(request);
  if (protocolError) return protocolError;
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const auth = await authenticateRoom(code, readRoomKey(request));
    if (!auth) return noStoreJson({ error: "Não foi possível entrar nesta aventura. Confira o convite e tente novamente." }, { status: 401 });

    const input = await request.json().catch(() => null);
    const normalized = normalizeAuthoritativeRequest(input);
    const actorKey = auth.role === "narrator" ? "narrator" : auth.playerId || "player";
    const fingerprintPayload = requestFingerprintPayload(normalized);
    const requestJson = JSON.stringify(fingerprintPayload);
    const fingerprint = await hashSecret(requestJson);
    const existing = await readStoredRoll(code, actorKey, normalized.requestId);
    if (existing) {
      if (existing.request_fingerprint !== fingerprint) {
        return noStoreJson({ error: "Este identificador já pertence a outra ação. Faça a solicitação novamente." }, { status: 409 });
      }
      if (existing.status !== "ready") {
        return noStoreJson({ error: "Esta ação ainda está sendo confirmada pelo servidor. Tente novamente em instantes.", retryable: true }, { status: 409 });
      }
      return responseForStored(code, auth.role, existing);
    }

    const room = await getRoom(code);
    if (!room) return noStoreJson({ error: "Não encontramos essa aventura. Confira o código e tente novamente." }, { status: 404 });
    if ("expectedRevision" in normalized && normalized.expectedRevision !== room.revision) {
      return noStoreJson({
        error: "Outra mudança chegou primeiro. O MyOwnDex já atualizou a aventura; tente novamente.",
        conflict: true,
        room: await getRoomBundle(code, auth.role),
      }, { status: 409 });
    }

    const storedSnapshot = parseJson<Record<string, unknown>>(room.state_json, {});
    const snapshot = normalized.action === "initiative"
      ? await snapshotWithServerPriorities(storedSnapshot)
      : storedSnapshot;
    const move = normalized.action === "combat" ? await fetchMove(normalized.moveName || "") : null;
    const calledMove = normalized.action === "combat" && normalized.calledMoveName
      ? await fetchMove(normalized.calledMoveName || "")
      : null;
    const auditedRandom = createAuditedSecureRandom();
    const resolution = resolveAuthoritativeAction({
      request: normalized,
      snapshot,
      role: auth.role,
      move,
      calledMove,
      random: auditedRandom.source,
    });
    const storedResult = {
      serverAuthoritative: true,
      actionType: normalized.action,
      mode: "mode" in normalized ? normalized.mode : "normal",
      result: resolution.result,
      audit: {
        ...resolution.audit,
        randomDraws: auditedRandom.draws,
      },
    };
    assertStateSize(storedResult);
    const resultJson = JSON.stringify(storedResult);
    const eventPayloadJson = JSON.stringify(resolution.eventPayload || {});
    const sfxPayloadJson = resolution.sfxPayload ? JSON.stringify(resolution.sfxPayload) : null;
    const mode = "mode" in normalized ? normalized.mode : "normal";
    const claimToken = crypto.randomUUID();
    const { db } = getBindings();
    const mutatesRoom = normalized.action !== "combat" || auth.role === "narrator";

    if (!("expectedRevision" in normalized)) {
      await db.prepare(
        `INSERT OR IGNORE INTO room_rolls
          (room_code, actor_key, request_id, request_fingerprint, player_id, author,
           action_type, mode, request_json, result_json, event_type, event_payload_json,
           sfx_payload_json, status, claim_token, server_authoritative)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, 1)`,
      ).bind(
        code,
        actorKey,
        normalized.requestId,
        fingerprint,
        auth.playerId,
        auth.displayName,
        normalized.action,
        mode,
        requestJson,
        resultJson,
        resolution.eventType,
        eventPayloadJson,
        sfxPayloadJson,
        claimToken,
      ).run();
    } else if (!mutatesRoom) {
      await db.prepare(
        `INSERT OR IGNORE INTO room_rolls
          (room_code, actor_key, request_id, request_fingerprint, player_id, author,
           action_type, mode, request_json, result_json, event_type, event_payload_json,
           sfx_payload_json, status, claim_token, server_authoritative)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, 1
         WHERE EXISTS (SELECT 1 FROM rooms WHERE code = ? AND revision = ?)`,
      ).bind(
        code,
        actorKey,
        normalized.requestId,
        fingerprint,
        auth.playerId,
        auth.displayName,
        normalized.action,
        mode,
        requestJson,
        resultJson,
        resolution.eventType,
        eventPayloadJson,
        sfxPayloadJson,
        claimToken,
        code,
        normalized.expectedRevision,
      ).run();
    } else {
      if (!resolution.nextSnapshot) throw new AuthoritativeActionError("O servidor não confirmou a mudança da aventura.", 500);
      assertStateSize(resolution.nextSnapshot);
      const batch = await db.batch([
        db.prepare(
          `INSERT OR IGNORE INTO room_rolls
            (room_code, actor_key, request_id, request_fingerprint, player_id, author,
             action_type, mode, request_json, result_json, event_type, event_payload_json,
             sfx_payload_json, status, claim_token, server_authoritative)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 1)`,
        ).bind(
          code,
          actorKey,
          normalized.requestId,
          fingerprint,
          auth.playerId,
          auth.displayName,
          normalized.action,
          mode,
          requestJson,
          resultJson,
          resolution.eventType,
          eventPayloadJson,
          sfxPayloadJson,
          claimToken,
        ),
        db.prepare(
          `UPDATE rooms
           SET state_json = ?, revision = revision + 1, authority_claim = ?, updated_at = CURRENT_TIMESTAMP
           WHERE code = ? AND revision = ?
             AND EXISTS (
               SELECT 1 FROM room_rolls
               WHERE room_code = ? AND actor_key = ? AND request_id = ? AND claim_token = ? AND status = 'pending'
             )`,
        ).bind(
          JSON.stringify(resolution.nextSnapshot),
          claimToken,
          code,
          normalized.expectedRevision,
          code,
          actorKey,
          normalized.requestId,
          claimToken,
        ),
        db.prepare(
          `UPDATE room_rolls SET status = 'ready'
           WHERE room_code = ? AND actor_key = ? AND request_id = ? AND claim_token = ?
             AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND authority_claim = ?)`,
        ).bind(code, actorKey, normalized.requestId, claimToken, code, claimToken),
      ]);
      if (!batch[2]?.meta?.changes) {
        const raced = await readStoredRoll(code, actorKey, normalized.requestId);
        if (raced?.status === "ready" && raced.request_fingerprint === fingerprint) {
          return responseForStored(code, auth.role, raced);
        }
        await db.prepare(
          "DELETE FROM room_rolls WHERE room_code = ? AND actor_key = ? AND request_id = ? AND claim_token = ? AND status = 'pending'",
        ).bind(code, actorKey, normalized.requestId, claimToken).run();
        return noStoreJson({
          error: "Outra mudança chegou primeiro. O MyOwnDex já atualizou a aventura; tente novamente.",
          conflict: true,
          room: await getRoomBundle(code, auth.role),
        }, { status: 409 });
      }
    }

    const stored = await readStoredRoll(code, actorKey, normalized.requestId);
    if (!stored || stored.request_fingerprint !== fingerprint || stored.status !== "ready") {
      return noStoreJson({
        error: "Outra mudança chegou primeiro. Nenhum resultado foi registrado; tente novamente.",
        conflict: true,
        room: await getRoomBundle(code, auth.role),
      }, { status: 409 });
    }
    return responseForStored(code, auth.role, stored);
  } catch (error) {
    if (error instanceof AuthoritativeActionError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    return routeError(error);
  }
}
