import {
  assertStateSize,
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  getRoomBundle,
  noStoreJson,
  readRoomKey,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../server/rooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> | { code: string } };

async function roomCode(context: RouteContext) {
  const params = await context.params;
  return safeRoomCode(params.code);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const code = await roomCode(context);
    const auth = await authenticateRoom(code, readRoomKey(request));
    if (!auth) return noStoreJson({ error: "Não foi possível entrar nesta aventura. Confira o convite e tente novamente." }, { status: 401 });
    const bundle = await getRoomBundle(code, auth.role);
    if (!bundle) return noStoreJson({ error: "Não encontramos essa aventura. Confira o código e tente novamente." }, { status: 404 });
    return noStoreJson({ ...bundle, role: auth.role, playerId: auth.playerId });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const code = await roomCode(context);
    const auth = await authenticateRoom(code, readRoomKey(request));
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
    assertStateSize(payload.snapshot);
    const expectedRevision = Number(payload.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return noStoreJson({ error: "Esta aventura recebeu outra mudança enquanto você editava. Tente a ação novamente." }, { status: 400 });
    }
    const title = safeText(payload.title ?? payload.snapshot.title, 80) || "Aventura Pokémon";
    const { db } = getBindings();
    const result = await db.prepare(
      `UPDATE rooms
       SET title = ?, state_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
       WHERE code = ? AND revision = ?`,
    ).bind(title, JSON.stringify({ ...payload.snapshot, title }), code, expectedRevision).run();
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
    const auth = await authenticateRoom(code, readRoomKey(request));
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode encerrar esta aventura." }, { status: 403 });
    }
    const { db, bucket } = getBindings();
    const media = await db.prepare("SELECT object_key FROM room_media WHERE room_code = ?")
      .bind(code)
      .all<{ object_key: string }>();
    await Promise.all((media.results || []).map(item => bucket?.delete(item.object_key)));
    await db.batch([
      db.prepare("DELETE FROM room_call_signals WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM room_call_members WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM room_events WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM room_players WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM room_media WHERE room_code = ?").bind(code),
      db.prepare("DELETE FROM rooms WHERE code = ?").bind(code),
    ]);
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
