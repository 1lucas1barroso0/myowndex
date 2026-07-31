import {
  appendRoomEvent,
  createSecret,
  ensureRoomSchema,
  getBindings,
  getRoom,
  getRoomBundle,
  hashSecret,
  noStoreJson,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../../server/rooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> | { code: string } };
const ACCENTS = ["#38bdf8", "#f97316", "#a855f7", "#22c55e", "#ec4899", "#eab308"];

export async function POST(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const payload = await request.json().catch(() => ({})) as {
      displayName?: string;
      inviteCode?: string;
    };
    const displayName = safeText(payload.displayName, 32);
    const inviteCode = safeText(payload.inviteCode, 64);
    if (!displayName) return noStoreJson({ error: "Escreva o nome que você quer usar na aventura." }, { status: 400 });
    const room = await getRoom(code);
    if (!room) return noStoreJson({ error: "Não encontramos essa aventura. Confira o código e tente novamente." }, { status: 404 });
    if (room.invite_secret_hash !== await hashSecret(inviteCode)) {
      return noStoreJson({ error: "Este convite não pertence a esta aventura. Peça outro link ao Narrador." }, { status: 401 });
    }

    const playerId = `player_${crypto.randomUUID()}`;
    const playerKey = createSecret("player");
    const playerHash = await hashSecret(playerKey);
    const accent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
    const { db } = getBindings();
    await db.prepare(
      `INSERT INTO room_players
        (id, room_code, display_name, token_hash, accent)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(playerId, code, displayName, playerHash, accent).run();
    await appendRoomEvent({
      code,
      auth: { role: "player", playerId, displayName },
      type: "system",
      payload: { text: `${displayName} entrou na aventura.` },
    });
    const bundle = await getRoomBundle(code, "player");
    return noStoreJson({
      code,
      role: "player",
      playerId,
      playerKey,
      room: bundle,
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
