import {
  appendRoomEvent,
  assertStateSize,
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  getRoom,
  noStoreJson,
  parseJson,
  readRoomKey,
  requireCurrentRoomProtocol,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../../server/rooms";
import { clampFinite } from "../../../../../src/core/math.js";

import { declareRoomMove } from "../../../../../src/core/room.js";
import { AuthoritativeActionError } from "../../../../../server/authoritativeActions.js";
import { fetchServerMove } from "../../../../../server/moveReference";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

const COMMON_EVENTS = new Set(["message", "ready", "team-offer", "token-request", "token-move", "move-declared", "leave"]);
const NARRATOR_EVENTS = new Set(["system", "team-accepted", "message"]);

export async function POST(request: Request, context: RouteContext) {
  const protocolError = requireCurrentRoomProtocol(request);
  if (protocolError) return protocolError;
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth) return noStoreJson({ error: "Não foi possível entrar nesta aventura. Confira o convite e tente novamente." }, { status: 401 });
    const payload = await request.json().catch(() => ({})) as {
      type?: string;
      payload?: Record<string, unknown>;
    };
    const type = safeText(payload.type, 30);
    const allowed = auth.role === "narrator"
      ? NARRATOR_EVENTS.has(type)
      : COMMON_EVENTS.has(type);
    if (!allowed) return noStoreJson({ error: "Esta ação não está disponível para você nesta aventura." }, { status: 403 });
    const eventPayload = payload.payload && typeof payload.payload === "object"
      ? payload.payload
      : {};

    if (type === "ready" && auth.playerId) {
      const { db } = getBindings();
      await db.prepare(
        "UPDATE room_players SET ready = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ? AND room_code = ?",
      ).bind(eventPayload.ready ? 1 : 0, auth.playerId, code).run();
    }
    if (type === "leave" && auth.playerId) {
      const id = await appendRoomEvent({
        code,
        auth,
        type: "system",
        payload: { text: `${auth.displayName} saiu da aventura.` },
      });
      const { db } = getBindings();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const room = await getRoom(code);
        if (!room) break;
        const snapshot = parseJson<Record<string, unknown>>(room.state_json, {});
        const tokens = Array.isArray(snapshot.tokens) ? snapshot.tokens : [];
        const nextSnapshot = {
          ...snapshot,
          tokens: tokens.map(item => {
            if (!item || typeof item !== "object") return item;
            const token = item as Record<string, unknown>;
            return token.ownerPlayerId === auth.playerId ? { ...token, ownerPlayerId: "" } : token;
          }),
        };
        const result = await db.prepare(
          `UPDATE rooms
           SET state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE code = ? AND revision = ?`,
        ).bind(JSON.stringify(nextSnapshot), code, room.revision).run();
        if (result.meta.changes) break;
      }
      await db.prepare("DELETE FROM room_players WHERE id = ? AND room_code = ?")
        .bind(auth.playerId, code)
        .run();
      return noStoreJson({ ok: true, id }, { status: 201 });
    }
    if (type === "token-move" && auth.playerId) {
      const tokenId = safeText(eventPayload.tokenId, 100);
      const x = clampFinite(eventPayload.x, 4, 96, 50);
      const y = clampFinite(eventPayload.y, 8, 92, 50);
      const { db } = getBindings();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const room = await getRoom(code);
        const snapshot = parseJson<Record<string, unknown>>(room?.state_json, {});
        const settings = snapshot.settings && typeof snapshot.settings === "object"
          ? snapshot.settings as Record<string, unknown>
          : {};
        const tokens = Array.isArray(snapshot.tokens) ? snapshot.tokens : [];
        const token = tokens.find(item =>
          item && typeof item === "object"
          && safeText((item as Record<string, unknown>).id, 100) === tokenId
        ) as Record<string, unknown> | undefined;
        if (!room || !settings.allowPlayerMovement || !token || token.ownerPlayerId !== auth.playerId) {
          return noStoreJson({ error: "Você só pode mover os Pokémon que estão sob seu controle." }, { status: 403 });
        }
        const nextSnapshot = {
          ...snapshot,
          tokens: tokens.map(item => item === token ? { ...token, x, y } : item),
        };
        assertStateSize(nextSnapshot);
        const result = await db.prepare(
          `UPDATE rooms
           SET state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE code = ? AND revision = ?`,
        ).bind(JSON.stringify(nextSnapshot), code, room.revision).run();
        if (result.meta.changes) {
          return noStoreJson({
            ok: true,
            moved: tokenId,
            revision: room.revision + 1,
          }, { status: 201 });
        }
      }
      return noStoreJson({
        error: "Outra mudança chegou enquanto você movia este Pokémon. Arraste-o novamente.",
        conflict: true,
      }, { status: 409 });
    }
    if (type === "move-declared" && auth.playerId) {
      const tokenId = safeText(eventPayload.tokenId, 100);
      const moveName = safeText(eventPayload.moveName, 80)
        .toLowerCase()
        .replace(/\s+/g, "-");
      let move: Awaited<ReturnType<typeof fetchServerMove>> = null;
      const { db } = getBindings();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const room = await getRoom(code);
        if (!room) return noStoreJson({ error: "Não encontramos essa aventura. Confira o código e tente novamente." }, { status: 404 });
        const snapshot = parseJson<Record<string, unknown>>(room.state_json, {});
        const tokens = Array.isArray(snapshot.tokens) ? snapshot.tokens : [];
        const token = tokens.find(item =>
          item && typeof item === "object"
          && safeText((item as Record<string, unknown>).id, 100) === tokenId
        ) as Record<string, unknown> | undefined;
        const moves = Array.isArray(token?.moves)
          ? token.moves.map(move => safeText(move, 80).toLowerCase().replace(/\s+/g, "-"))
          : [];
        if (!token || token.ownerPlayerId !== auth.playerId || (moveName && !moves.includes(moveName))) {
          return noStoreJson({ error: "Escolha um movimento de um Pokémon que esteja sob seu controle." }, { status: 403 });
        }
        if (Array.isArray(snapshot.initiative) && snapshot.initiative.length) return noStoreJson({ error: "A rodada já começou. Escolha o movimento antes da próxima iniciativa." }, { status: 409 });
        if (eventPayload.expectedRevision != null && eventPayload.expectedRevision !== room.revision) return noStoreJson({ error: "A aventura recebeu outra mudança. Atualize sua escolha.", conflict: true }, { status: 409 });
        if (moveName && !move) move = await fetchServerMove(moveName);
        let nextSnapshot;
        try {
          nextSnapshot = declareRoomMove(snapshot, tokenId, move);
        } catch (error) {
          return noStoreJson({ error: error instanceof Error ? error.message : "Não foi possível escolher esta ação." }, { status: 409 });
        }
        const priority = nextSnapshot.tokens.find((candidate: { id: string }) => candidate.id === tokenId)?.priority || 0;
        assertStateSize(nextSnapshot);
        const result = await db.prepare(
          `UPDATE rooms
           SET state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE code = ? AND revision = ?`,
        ).bind(JSON.stringify(nextSnapshot), code, room.revision).run();
        if (result.meta.changes) {
          const id = await appendRoomEvent({
            code,
            auth,
            type: "move-declared",
            payload: {
              tokenId,
              tokenName: safeText(token.name, 80),
              moveName,
              priority,
            },
          });
          return noStoreJson({
            ok: true,
            id,
            declared: tokenId,
            revision: room.revision + 1,
          }, { status: 201 });
        }
      }
      return noStoreJson({
        error: "Outra mudança chegou enquanto você escolhia o movimento. Faça sua escolha novamente.",
        conflict: true,
      }, { status: 409 });
    }
    const id = await appendRoomEvent({ code, auth, type, payload: eventPayload });
    return noStoreJson({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthoritativeActionError) return noStoreJson({ error: error.message }, { status: error.status });
    return routeError(error);
  }
}

// Deleting a journal entry never replays or reverses a mechanical action.
// Ready receipts retain their idempotency key/result for delayed network retries.
export async function DELETE(request: Request, context: RouteContext) {
  const protocolError = requireCurrentRoomProtocol(request);
  if (protocolError) return protocolError;
  try {
    await ensureRoomSchema();
    const { code: rawCode } = await context.params;
    const code = safeRoomCode(rawCode);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth) return noStoreJson({ error: "Não foi possível entrar nesta aventura." }, { status: 401 });
    const payload = await request.json().catch(() => null);
    const id = typeof payload?.id === "number" ? String(payload.id) : payload?.id;
    const all = payload?.all === true;
    if (!all && (typeof id !== "string" || !/^(?:authority-)?[1-9]\d*$/.test(id))) {
      return noStoreJson({ error: "Escolha um registro do Diário." }, { status: 400 });
    }
    const { db } = getBindings();
    const ownership = auth.role === "narrator" ? "" : " AND player_id = ?";
    const ownerArgs = auth.role === "narrator" ? [] : [auth.playerId];
    if (all) {
      const eventLimit = payload?.through?.events;
      const rollLimit = payload?.through?.rolls;
      if (![eventLimit, rollLimit].every(value => Number.isSafeInteger(value) && value >= 0)) {
        return noStoreJson({ error: "Atualize o Diário antes de limpar os registros." }, { status: 400 });
      }
      // Cutoffs make a retried clear safe for messages/actions arriving later.
      await db.batch([
        db.prepare(`DELETE FROM room_events WHERE room_code = ? AND id <= ?${ownership}`).bind(code, eventLimit, ...ownerArgs),
        db.prepare(`UPDATE room_rolls SET journal_hidden = 1 WHERE room_code = ? AND id <= ? AND status = 'ready'${ownership}`).bind(code, rollLimit, ...ownerArgs),
      ]);
    } else {
      const authoritative = id.startsWith("authority-");
      const rowId = Number(authoritative ? id.slice("authority-".length) : id);
      if (!Number.isSafeInteger(rowId)) return noStoreJson({ error: "Este registro não é válido." }, { status: 400 });
      const table = authoritative ? "room_rolls" : "room_events";
      const entry = await db.prepare(`SELECT player_id FROM ${table} WHERE room_code = ? AND id = ? LIMIT 1`)
        .bind(code, rowId).first<{ player_id: string | null }>();
      if (entry && auth.role !== "narrator" && entry.player_id !== auth.playerId) {
        return noStoreJson({ error: "Você só pode apagar seus próprios registros." }, { status: 403 });
      }
      if (entry) {
        await db.prepare(authoritative
          ? `UPDATE room_rolls SET journal_hidden = 1 WHERE room_code = ? AND id = ? AND status = 'ready'${ownership}`
          : `DELETE FROM room_events WHERE room_code = ? AND id = ?${ownership}`)
          .bind(code, rowId, ...ownerArgs).run();
      }
    }
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
