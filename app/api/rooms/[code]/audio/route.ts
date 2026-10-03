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
import { RuntimeConfigurationError } from "../../../../../server/runtime";

export const dynamic = "force-dynamic";
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode adicionar trilhas à aventura." }, { status: 403 });
    }
    const { db, bucket } = getBindings();
    if (!bucket) throw new RuntimeConfigurationError("Para enviar trilhas, configure as variáveis MYOWNDEX_S3 na Vercel. As aventuras e as chamadas continuam disponíveis.");
    if (request.headers.get("content-type")?.includes("application/json")) {
      const payload = await request.json().catch(() => ({})) as { action?: string; title?: string; fileName?: string; mimeType?: string; size?: number; uploadToken?: string };
      if (payload.action === "prepare") {
        const mimeType = safeText(payload.mimeType, 120);
        const size = Number(payload.size);
        if (!mimeType.startsWith("audio/")) return noStoreJson({ error: "Escolha um arquivo de áudio." }, { status: 415 });
        if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_AUDIO_BYTES) return noStoreJson({ error: "Escolha uma faixa com até 24 MB." }, { status: 413 });
        const id = `audio_${crypto.randomUUID()}`;
        return noStoreJson(bucket.prepareUpload({
          code, id, objectKey: `rooms/${code}/audio/${id}`,
          title: safeText(payload.title, 100) || safeText(payload.fileName, 100) || "Trilha",
          mimeType, size, expires: Date.now() + 15 * 60_000,
        }));
      }
      if (payload.action === "complete") {
        const upload = bucket.verifyUpload(typeof payload.uploadToken === "string" ? payload.uploadToken : "", code);
        if (!upload) return noStoreJson({ error: "Este envio expirou ou não pertence a esta aventura. Envie a trilha novamente." }, { status: 400 });
        const object = await bucket.head(upload.objectKey);
        if (!object) return noStoreJson({ error: "Esta trilha ainda não chegou ao armazenamento. Envie o arquivo novamente." }, { status: 400 });
        if (object.size !== upload.size || object.size > MAX_AUDIO_BYTES || object.contentType !== upload.mimeType) {
          await bucket.delete(upload.objectKey);
          return noStoreJson({ error: "O arquivo enviado não corresponde à trilha escolhida. Tente novamente." }, { status: 400 });
        }
        await db.prepare(`INSERT OR IGNORE INTO room_media (id, room_code, object_key, title, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(upload.id, code, upload.objectKey, upload.title, upload.mimeType, upload.size).run();
        return noStoreJson({ media: { id: upload.id, title: upload.title, mimeType: upload.mimeType, size: upload.size } }, { status: 201 });
      }
      return noStoreJson({ error: "Escolha uma trilha para enviar." }, { status: 400 });
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
