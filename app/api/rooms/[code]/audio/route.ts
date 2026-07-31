import {
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  noStoreJson,
  readRoomKey,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../../server/rooms";

export const dynamic = "force-dynamic";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

type RouteContext = { params: Promise<{ code: string }> | { code: string } };

export async function POST(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const auth = await authenticateRoom(code, readRoomKey(request));
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode adicionar trilhas à aventura." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const title = safeText(form.get("title"), 100);
    if (!(file instanceof File)) {
      return noStoreJson({ error: "Escolha uma faixa de áudio para continuar." }, { status: 400 });
    }
    if (!file.type.startsWith("audio/")) {
      return noStoreJson({ error: "Este arquivo não parece ser uma faixa de áudio. Escolha outro arquivo." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
      return noStoreJson({ error: "Escolha uma faixa com até 24 MB." }, { status: 413 });
    }
    const id = `audio_${crypto.randomUUID()}`;
    const objectKey = `rooms/${code}/audio/${id}`;
    const { db, bucket } = getBindings();
    if (!bucket) throw new Error("As trilhas da aventura não estão disponíveis agora. Tente novamente em instantes.");
    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { roomCode: code, title: title || file.name },
    });
    await db.prepare(
      `INSERT INTO room_media
        (id, room_code, object_key, title, mime_type, size)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, code, objectKey, title || safeText(file.name, 100) || "Trilha", file.type, file.size).run();
    return noStoreJson({
      media: {
        id,
        title: title || file.name,
        mimeType: file.type,
        size: file.size,
      },
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
