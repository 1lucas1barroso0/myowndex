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
    if (!auth) return noStoreJson({ error: "Não foi possível acessar o áudio desta aventura. Entre novamente e tente outra vez." }, { status: 401 });
    const { db, bucket } = getBindings();
    if (!bucket) throw new Error("As trilhas da aventura não estão disponíveis agora. Tente novamente em instantes.");
    const media = await db.prepare(
      "SELECT object_key, title, mime_type FROM room_media WHERE id = ? AND room_code = ? LIMIT 1",
    ).bind(id, code).first<{ object_key: string; title: string; mime_type: string }>();
    if (!media) return noStoreJson({ error: "Esta trilha não está mais na aventura." }, { status: 404 });
    const object = await bucket.get(media.object_key);
    if (!object?.body) return noStoreJson({ error: "Esta trilha não pôde ser aberta agora." }, { status: 404 });
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
      return noStoreJson({ error: "Só o Narrador pode remover trilhas da aventura." }, { status: 403 });
    }
    const { db, bucket } = getBindings();
    const media = await db.prepare(
      "SELECT object_key FROM room_media WHERE id = ? AND room_code = ? LIMIT 1",
    ).bind(id, code).first<{ object_key: string }>();
    if (!media) return noStoreJson({ error: "Esta trilha não está mais na aventura." }, { status: 404 });
    await bucket?.delete(media.object_key);
    await db.prepare("DELETE FROM room_media WHERE id = ? AND room_code = ?").bind(id, code).run();
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
