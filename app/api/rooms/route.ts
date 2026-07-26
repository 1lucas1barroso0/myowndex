import {
  appendRoomEvent,
  assertStateSize,
  createInitialRoomState,
  createRoomCode,
  createSecret,
  ensureRoomSchema,
  getBindings,
  hashSecret,
  noStoreJson,
  routeError,
  safeText,
} from "../../../server/rooms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureRoomSchema();
    const payload = await request.json().catch(() => ({})) as {
      title?: string;
      narratorName?: string;
      snapshot?: Record<string, unknown>;
    };
    const title = safeText(payload.title, 80) || "Nova aventura";
    const narratorName = safeText(payload.narratorName, 32) || "Narrador";
    const narratorKey = createSecret("gm");
    const inviteCode = createSecret("join");
    const narratorHash = await hashSecret(narratorKey);
    const inviteHash = await hashSecret(inviteCode);
    const snapshot = payload.snapshot && typeof payload.snapshot === "object"
      ? { ...createInitialRoomState(title), ...payload.snapshot, title }
      : createInitialRoomState(title);
    assertStateSize(snapshot);

    const { db } = getBindings();
    let code = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = createRoomCode();
      const existing = await db.prepare("SELECT code FROM rooms WHERE code = ? LIMIT 1")
        .bind(candidate)
        .first();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Não conseguimos abrir uma nova aventura agora. Tente novamente.");

    await db.prepare(
      `INSERT INTO rooms
        (code, title, narrator_secret_hash, invite_secret_hash, state_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(code, title, narratorHash, inviteHash, JSON.stringify(snapshot)).run();
    await appendRoomEvent({
      code,
      auth: { role: "narrator", playerId: null, displayName: narratorName },
      type: "system",
      payload: { text: `A aventura “${title}” começou.` },
    });

    return noStoreJson({
      code,
      narratorKey,
      inviteCode,
      role: "narrator",
      revision: 0,
      snapshot,
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
