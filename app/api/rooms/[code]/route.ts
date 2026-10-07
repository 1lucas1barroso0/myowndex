import {
  assertStateSize,
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  getRoom,
  getRoomBundle,
  noStoreJson,
  parseJson,
  readRoomKey,
  requireCurrentRoomProtocol,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../server/rooms";
import { finiteNumberOrNull } from "../../../../src/core/math.js";

import { getBattleLifecyclePatchBlockReason, getRoundDeclarationPatchBlockReason, normalizeRoomSnapshot } from "../../../../src/core/room.js";
import { getHeldItemPatchBlockReason } from "../../../../src/core/traitMechanics.js";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

async function roomCode(context: RouteContext) {
  const params = await context.params;
  return safeRoomCode(params.code);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const code = await roomCode(context);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth) return noStoreJson({ error: "Não foi possível entrar nesta aventura. Confira o convite e tente novamente." }, { status: 401 });
    const bundle = await getRoomBundle(code, auth.role);
    if (!bundle) return noStoreJson({ error: "Não encontramos essa aventura. Confira o código e tente novamente." }, { status: 404 });
    return noStoreJson({ ...bundle, role: auth.role, playerId: auth.playerId });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const protocolError = requireCurrentRoomProtocol(request);
  if (protocolError) return protocolError;
  try {
    await ensureRoomSchema();
    const code = await roomCode(context);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth) return noStoreJson({ error: "Não foi possível entrar nesta aventura. Confira o convite e tente novamente." }, { status: 401 });
    if (auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode alterar a aventura para todos." }, { status: 403 });
    }
    const payload = await request.json().catch(() => ({})) as {
      snapshot?: Record<string, unknown>;
      expectedRevision?: number;
      title?: string;
    };
    if (!payload.snapshot || typeof payload.snapshot !== "object" || Array.isArray(payload.snapshot)) {
      return noStoreJson({ error: "Não conseguimos reconhecer as informações desta aventura." }, { status: 400 });
    }
    const incomingSnapshot = payload.snapshot;
    assertStateSize(incomingSnapshot);
    const expectedRevision = finiteNumberOrNull(payload.expectedRevision);
    if (expectedRevision == null || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      return noStoreJson({ error: "Esta aventura recebeu outra mudança enquanto você editava. Tente a ação novamente." }, { status: 400 });
    }
    const title = safeText(payload.title ?? incomingSnapshot.title, 80) || "Aventura Pokémon";
    const currentRoom = await getRoom(code);
    if (!currentRoom) return noStoreJson({ error: "Não encontramos essa aventura. Confira o código e tente novamente." }, { status: 404 });
    const currentSnapshot = parseJson<Record<string, unknown>>(currentRoom.state_json, {});
    const currentTokenIds = Array.isArray(currentSnapshot.tokens)
      ? currentSnapshot.tokens.map(token => safeText((token as Record<string, unknown>)?.id, 100)).filter(Boolean)
      : [];
    const nextTokenIds = Array.isArray(incomingSnapshot.tokens)
      ? incomingSnapshot.tokens.map(token => safeText((token as Record<string, unknown>)?.id, 100)).filter(Boolean)
      : [];
    const tokensUnchanged = JSON.stringify(currentTokenIds) === JSON.stringify(nextTokenIds);
    const initiativeChanged = JSON.stringify(currentSnapshot.initiative || []) !== JSON.stringify(incomingSnapshot.initiative || []);
    const turnChanged = currentSnapshot.turnIndex !== incomingSnapshot.turnIndex;
    const roundChanged = currentSnapshot.round !== incomingSnapshot.round;
    if (roundChanged || (tokensUnchanged && (initiativeChanged || turnChanged))) {
      return noStoreJson({
        error: "Roladas, iniciativa e avanço de rodada são confirmados pelo servidor nesta aventura compartilhada.",
        serverAuthoritative: true,
        room: await getRoomBundle(code, "narrator"),
      }, { status: 403 });
    }
    const lifecycleBlock = getBattleLifecyclePatchBlockReason(currentSnapshot, incomingSnapshot);
    if (lifecycleBlock) return noStoreJson({ error: lifecycleBlock, serverAuthoritative: true, room: await getRoomBundle(code, "narrator") }, { status: 409 });
    const declarationBlock = getRoundDeclarationPatchBlockReason(currentSnapshot, incomingSnapshot);
    if (declarationBlock) return noStoreJson({ error: declarationBlock, serverAuthoritative: true, room: await getRoomBundle(code, "narrator") }, { status: 409 });
    const itemBlock = getHeldItemPatchBlockReason(currentSnapshot, incomingSnapshot);
    if (itemBlock) return noStoreJson({ error: itemBlock, serverAuthoritative: true, room: await getRoomBundle(code, "narrator") }, { status: 409 });
    // Previous cached clients omit the additive canonical category; their HP/notes
    // edits must preserve it rather than erase the action fixed for this round.
    const previousTokens = new Map([
      ...(Array.isArray(currentSnapshot.tokens) ? currentSnapshot.tokens : []),
      ...(Array.isArray(currentSnapshot.benchTokens) ? currentSnapshot.benchTokens : []),
    ].map(token => [(token as Record<string, unknown>).id, token as Record<string, unknown>]));
    const preserveTokenRecords = (item: unknown) => {
      const token = item as Record<string, unknown>;
      const previous = previousTokens.get(token.id);
      if (!previous) return token;
      return { ...Object.fromEntries(["declaredDamageClass", "lastActionRound", "activeMoveActions", "battleParticipated", "battleEntryLevel", "traitState"]
        .filter(key => !Object.hasOwn(token, key)).map(key => [key, previous[key]])), ...token };
    };
    const currentNormalized = normalizeRoomSnapshot(currentSnapshot);
    const persistedSnapshot = {
      ...incomingSnapshot,
      title,
      battleStarted: currentNormalized.battleStarted || normalizeRoomSnapshot(incomingSnapshot).battleStarted,
      ...Object.fromEntries(["hitKillProtectionUsed", "hitKillProtectionDisabled", "hitKillSurvivalGrace", "trainerInterventions"]
        .filter(key => !Object.hasOwn(incomingSnapshot, key)).map(key => [key, currentNormalized[key]])),
      tokens: Array.isArray(incomingSnapshot.tokens) ? incomingSnapshot.tokens.map(preserveTokenRecords) : incomingSnapshot.tokens,
      benchTokens: Array.isArray(incomingSnapshot.benchTokens) ? incomingSnapshot.benchTokens.map(preserveTokenRecords) : currentSnapshot.benchTokens,

    };
    assertStateSize(persistedSnapshot);
    const { db } = getBindings();
    const result = await db.prepare(
      `UPDATE rooms
       SET title = ?, state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
       WHERE code = ? AND revision = ?`,
    ).bind(title, JSON.stringify(persistedSnapshot), code, expectedRevision).run();
    if (!result.meta.changes) {
      const latest = await getRoomBundle(code, "narrator");
      return noStoreJson({
        error: "Outra mudança chegou primeiro. O MyOwnDex já atualizou a aventura; tente novamente.",
        conflict: true,
        room: latest,
      }, { status: 409 });
    }
    const bundle = await getRoomBundle(code, "narrator");
    return noStoreJson(bundle);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const code = await roomCode(context);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode encerrar esta aventura." }, { status: 403 });
    }
    const { db } = getBindings();
    await db.batch([
      db.prepare("DELETE FROM room_rolls WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM room_events WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM room_players WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM rooms WHERE code = ?").bind(code),
    ]);
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
