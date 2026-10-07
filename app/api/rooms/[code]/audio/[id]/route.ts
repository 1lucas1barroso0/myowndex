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
import { RuntimeConfigurationError } from "../../../../../../server/runtime";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ code: string; id: string }>;
};

type MediaRow = {
  object_key: string;
  title: string;
  mime_type: string;
  size: number;
};

const isDatabaseAudio = (objectKey: string) => objectKey.startsWith("database-audio:");

export async function GET(request: Request, context: RouteContext) {
  try {
    await ensureRoomSchema();
    const params = await context.params;
    const code = safeRoomCode(params.code);
    const id = safeText(params.id, 80);
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth) {
      return noStoreJson({ error: "Não foi possível acessar o áudio desta aventura. Entre novamente e tente outra vez." }, { status: 401 });
    }

    const { db, bucket } = getBindings();
    const media = await db.prepare(
      "SELECT object_key, title, mime_type, size FROM room_media WHERE id = ? AND room_code = ? LIMIT 1",
    ).bind(id, code).first<MediaRow>();
    if (!media) return noStoreJson({ error: "Esta trilha não está mais na aventura." }, { status: 404 });

    if (isDatabaseAudio(media.object_key)) {
      const url = new URL(request.url);
      if (url.searchParams.has("chunk")) {
        const chunkIndex = Number(url.searchParams.get("chunk"));
        if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
          return noStoreJson({ error: "Este trecho da trilha não é válido." }, { status: 400 });
        }
        const chunk = await db.prepare(
          "SELECT data, size FROM room_media_chunks WHERE media_id = ? AND room_code = ? AND chunk_index = ? LIMIT 1",
        ).bind(id, code, chunkIndex).first<{ data: Uint8Array; size: number }>();
        if (!chunk || !(chunk.data instanceof Uint8Array)) {
          return noStoreJson({ error: "Um trecho desta trilha não está mais disponível." }, { status: 404 });
        }
        const body = new ArrayBuffer(chunk.data.byteLength);
        new Uint8Array(body).set(chunk.data);
        return new Response(body, {
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(chunk.size),
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
          },
        });
      }

      const chunks = await db.prepare(
        "SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS size FROM room_media_chunks WHERE media_id = ? AND room_code = ?",
      ).bind(id, code).first<{ count: number; size: number }>();
      if (Number(chunks?.size || 0) !== media.size || Number(chunks?.count || 0) <= 0) {
        return noStoreJson({ error: "Esta trilha está incompleta. Envie o arquivo novamente." }, { status: 409 });
      }
      return noStoreJson({
        chunked: true,
        title: media.title,
        mimeType: media.mime_type,
        size: media.size,
        chunkCount: Number(chunks?.count || 0),
      });
    }

    if (!bucket) {
      throw new RuntimeConfigurationError("O armazenamento usado por esta trilha antiga não está conectado nesta instalação.");
    }
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
    const auth = await authenticateRoom(code, readRoomKey(request), request);
    if (!auth || auth.role !== "narrator") {
      return noStoreJson({ error: "Só o Narrador pode remover trilhas da aventura." }, { status: 403 });
    }

    const { db, bucket } = getBindings();
    const media = await db.prepare(
      "SELECT object_key FROM room_media WHERE id = ? AND room_code = ? LIMIT 1",
    ).bind(id, code).first<{ object_key: string }>();
    if (!media) return noStoreJson({ error: "Esta trilha não está mais na aventura." }, { status: 404 });

    if (isDatabaseAudio(media.object_key)) {
      await db.batch([
        db.prepare("DELETE FROM room_media_chunks WHERE media_id = ? AND room_code = ?").bind(id, code),
        db.prepare("DELETE FROM room_media_uploads WHERE id = ? AND room_code = ?").bind(id, code),
        db.prepare("DELETE FROM room_media WHERE id = ? AND room_code = ?").bind(id, code),
      ]);
    } else {
      await bucket?.delete(media.object_key);
      await db.prepare("DELETE FROM room_media WHERE id = ? AND room_code = ?").bind(id, code).run();
    }
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
