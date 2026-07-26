import {
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  noStoreJson,
  readRoomKey,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../../../server/rooms";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ code: string; id: string }> | { code: string; id: string };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const id = safeText(params.id, 80);
    const auth = await authenticateRoom(code, readRoomKey(request));
    if (!auth) return noStoreJson({ error: "Acesso inválido." }, { status: 401 });
    const { db, bucket } = getBindings();
    if (!bucket) throw new Error("A biblioteca de áudio não está disponível.");
    const media = await db.prepare(
      "SELECT object_key, title, mime_type FROM room_media WHERE id = ? AND room_code = ? LIMIT 1",
    ).bind(id, code).first<{ object_key: string; title: string; mime_type: string }>();
    if (!media) return noStoreJson({ error: "Faixa não encontrada." }, { status: 404 });
    const object = await bucket.get(media.object_key);
    if (!object?.body) return noStoreJson({ error: "Arquivo de áudio indisponível." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": media.mime_type,
        "content-disposition": `inline; filename="${encodeURIComponent(media.title)}"`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const id = safeText(params.id, 80);
    const auth = await authenticateRoom(code, readRoomKey(request));
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Somente o Narrador pode apagar trilhas." }, { status: 403 });
    }
    const { db, bucket } = getBindings();
    const media = await db.prepare(
      "SELECT object_key FROM room_media WHERE id = ? AND room_code = ? LIMIT 1",
    ).bind(id, code).first<{ object_key: string }>();
    if (!media) return noStoreJson({ error: "Faixa não encontrada." }, { status: 404 });
    await bucket?.delete(media.object_key);
    await db.prepare("DELETE FROM room_media WHERE id = ? AND room_code = ?").bind(id, code).run();
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
