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
const DATABASE_CHUNK_BYTES = 512 * 1024;
const UPLOAD_TTL_MS = 15 * 60_000;

type RouteContext = { params: Promise<{ code: string }> };
type PendingAudioUpload = {
  id: string;
  room_code: string;
  title: string;
  mime_type: string;
  size: number;
  chunk_size: number;
  chunk_count: number;
  expires_at: number;
};

const audioMimeType = (value: unknown, fileName: unknown) => {
  const explicit = safeText(value, 120).toLowerCase();
  if (explicit.startsWith("audio/")) return explicit;
  const extension = safeText(fileName, 160).toLowerCase().split(".").pop() || "";
  const known: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    webm: "audio/webm",
  };
  return known[extension] || "";
};

const cleanupExpiredUploads = async (db: ReturnType<typeof getBindings>["db"], now: number) => {
  await db.batch([
    db.prepare(`DELETE FROM room_media_chunks
      WHERE media_id IN (SELECT id FROM room_media_uploads WHERE expires_at < ?)`).bind(now),
    db.prepare("DELETE FROM room_media_uploads WHERE expires_at < ?").bind(now),
  ]);
};

const requireNarrator = async (request: Request, context: RouteContext) => {
  await ensureRoomSchema();
  const params = await context.params;
  const code = safeRoomCode(params.code);
  const auth = await authenticateRoom(code, readRoomKey(request), request);
  return { code, auth };
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code, auth } = await requireNarrator(request, context);
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode adicionar trilhas à aventura." }, { status: 403 });
    }

    const { db, bucket } = getBindings();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const payload = await request.json().catch(() => ({})) as {
        action?: string;
        title?: string;
        fileName?: string;
        mimeType?: string;
        size?: number;
        uploadToken?: string;
        uploadId?: string;
      };

      if (payload.action === "prepare") {
        const mimeType = audioMimeType(payload.mimeType, payload.fileName);
        const size = Number(payload.size);
        if (!mimeType) return noStoreJson({ error: "Escolha um arquivo de áudio compatível." }, { status: 415 });
        if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_AUDIO_BYTES) {
          return noStoreJson({ error: "Escolha uma faixa com até 24 MB." }, { status: 413 });
        }

        const id = `audio_${crypto.randomUUID()}`;
        const title = safeText(payload.title, 100) || safeText(payload.fileName, 100) || "Trilha";
        if (bucket) {
          return noStoreJson({
            mode: "object-storage",
            ...bucket.prepareUpload({
              code,
              id,
              objectKey: `rooms/${code}/audio/${id}`,
              title,
              mimeType,
              size,
              expires: Date.now() + UPLOAD_TTL_MS,
            }),
          });
        }

        const now = Date.now();
        const chunkCount = Math.ceil(size / DATABASE_CHUNK_BYTES);
        await cleanupExpiredUploads(db, now);
        await db.prepare(`INSERT INTO room_media_uploads
          (id, room_code, title, mime_type, size, chunk_size, chunk_count, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, code, title, mimeType, size, DATABASE_CHUNK_BYTES, chunkCount, now + UPLOAD_TTL_MS)
          .run();

        return noStoreJson({
          mode: "database",
          uploadId: id,
          chunkSize: DATABASE_CHUNK_BYTES,
          chunkCount,
          expiresAt: now + UPLOAD_TTL_MS,
        });
      }

      if (payload.action === "complete") {
        if (!bucket) {
          return noStoreJson({ error: "Este envio pertence a uma versão anterior. Escolha a trilha novamente." }, { status: 409 });
        }
        const upload = bucket.verifyUpload(typeof payload.uploadToken === "string" ? payload.uploadToken : "", code);
        if (!upload) {
          return noStoreJson({ error: "Este envio expirou ou não pertence a esta aventura. Envie a trilha novamente." }, { status: 400 });
        }
        const object = await bucket.head(upload.objectKey);
        if (!object) return noStoreJson({ error: "Esta trilha ainda não chegou ao armazenamento. Envie o arquivo novamente." }, { status: 400 });
        if (object.size !== upload.size || object.size > MAX_AUDIO_BYTES || object.contentType !== upload.mimeType) {
          await bucket.delete(upload.objectKey);
          return noStoreJson({ error: "O arquivo enviado não corresponde à trilha escolhida. Tente novamente." }, { status: 400 });
        }
        await db.prepare(`INSERT OR IGNORE INTO room_media (id, room_code, object_key, title, mime_type, size)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(upload.id, code, upload.objectKey, upload.title, upload.mimeType, upload.size)
          .run();
        return noStoreJson({ media: { id: upload.id, title: upload.title, mimeType: upload.mimeType, size: upload.size } }, { status: 201 });
      }

      if (payload.action === "complete-database") {
        const uploadId = safeText(payload.uploadId, 80);
        const pending = await db.prepare(`SELECT id, room_code, title, mime_type, size, chunk_size, chunk_count, expires_at
          FROM room_media_uploads WHERE id = ? AND room_code = ? LIMIT 1`)
          .bind(uploadId, code)
          .first<PendingAudioUpload>();
        if (!pending) {
          return noStoreJson({ error: "Este envio não existe mais. Escolha a trilha novamente." }, { status: 404 });
        }
        if (pending.expires_at < Date.now()) {
          await db.batch([
            db.prepare("DELETE FROM room_media_chunks WHERE media_id = ? AND room_code = ?").bind(uploadId, code),
            db.prepare("DELETE FROM room_media_uploads WHERE id = ? AND room_code = ?").bind(uploadId, code),
          ]);
          return noStoreJson({ error: "O envio expirou. Escolha a trilha novamente." }, { status: 410 });
        }
        const received = await db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS size
          FROM room_media_chunks WHERE media_id = ? AND room_code = ?`)
          .bind(uploadId, code)
          .first<{ count: number; size: number }>();
        if (Number(received?.count || 0) !== pending.chunk_count || Number(received?.size || 0) !== pending.size) {
          return noStoreJson({ error: "A trilha ainda está chegando. Tente enviar novamente." }, { status: 409 });
        }
        await db.batch([
          db.prepare(`INSERT OR IGNORE INTO room_media (id, room_code, object_key, title, mime_type, size)
            VALUES (?, ?, ?, ?, ?, ?)`)
            .bind(pending.id, code, `database-audio:${pending.id}`, pending.title, pending.mime_type, pending.size),
          db.prepare("DELETE FROM room_media_uploads WHERE id = ? AND room_code = ?").bind(pending.id, code),
        ]);
        return noStoreJson({
          media: { id: pending.id, title: pending.title, mimeType: pending.mime_type, size: pending.size },
        }, { status: 201 });
      }

      return noStoreJson({ error: "Escolha uma trilha para enviar." }, { status: 400 });
    }

    if (!bucket) {
      return noStoreJson({
        error: "Recarregue o MyOwnDex e escolha a trilha novamente para usar o envio atual.",
        upgradeRequired: true,
      }, { status: 409 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const title = safeText(form.get("title"), 100);
    if (!(file instanceof File)) {
      return noStoreJson({ error: "Escolha uma faixa de áudio para continuar." }, { status: 400 });
    }
    const mimeType = audioMimeType(file.type, file.name);
    if (!mimeType) return noStoreJson({ error: "Escolha um arquivo de áudio compatível." }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
      return noStoreJson({ error: "Escolha uma faixa com até 24 MB." }, { status: 413 });
    }
    const id = `audio_${crypto.randomUUID()}`;
    const objectKey = `rooms/${code}/audio/${id}`;
    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: mimeType },
      customMetadata: { roomCode: code, title: title || file.name },
    });
    await db.prepare(`INSERT INTO room_media
      (id, room_code, object_key, title, mime_type, size)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, code, objectKey, title || safeText(file.name, 100) || "Trilha", mimeType, file.size)
      .run();
    return noStoreJson({
      media: { id, title: title || file.name, mimeType, size: file.size },
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { code, auth } = await requireNarrator(request, context);
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode enviar trilhas à aventura." }, { status: 403 });
    }

    const { db } = getBindings();
    const url = new URL(request.url);
    const uploadId = safeText(url.searchParams.get("upload"), 80);
    const chunkIndex = Number(url.searchParams.get("index"));
    if (!uploadId || !Number.isSafeInteger(chunkIndex)) {
      return noStoreJson({ error: "Este trecho da trilha não é válido." }, { status: 400 });
    }

    const pending = await db.prepare(`SELECT id, room_code, title, mime_type, size, chunk_size, chunk_count, expires_at
      FROM room_media_uploads WHERE id = ? AND room_code = ? LIMIT 1`)
      .bind(uploadId, code)
      .first<PendingAudioUpload>();
    if (!pending) return noStoreJson({ error: "Este envio não existe mais. Escolha a trilha novamente." }, { status: 404 });
    if (pending.expires_at < Date.now()) {
      await db.batch([
        db.prepare("DELETE FROM room_media_chunks WHERE media_id = ? AND room_code = ?").bind(uploadId, code),
        db.prepare("DELETE FROM room_media_uploads WHERE id = ? AND room_code = ?").bind(uploadId, code),
      ]);
      return noStoreJson({ error: "O envio expirou. Escolha a trilha novamente." }, { status: 410 });
    }
    if (chunkIndex < 0 || chunkIndex >= pending.chunk_count) {
      return noStoreJson({ error: "Este trecho da trilha está fora do envio atual." }, { status: 400 });
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    const lastChunk = chunkIndex === pending.chunk_count - 1;
    const expectedSize = lastChunk
      ? pending.size - pending.chunk_size * (pending.chunk_count - 1)
      : pending.chunk_size;
    if (bytes.byteLength !== expectedSize || bytes.byteLength <= 0 || bytes.byteLength > DATABASE_CHUNK_BYTES) {
      return noStoreJson({ error: "Um trecho da trilha chegou incompleto. Tente enviar novamente." }, { status: 400 });
    }

    await db.prepare(`INSERT OR REPLACE INTO room_media_chunks
      (media_id, room_code, chunk_index, data, size) VALUES (?, ?, ?, ?, ?)`)
      .bind(uploadId, code, chunkIndex, bytes, bytes.byteLength)
      .run();
    return noStoreJson({ ok: true, index: chunkIndex });
  } catch (error) {
    return routeError(error);
  }
}
