import {
  authenticateRoom,
  ensureRoomSchema,
  getBindings,
  jsonSize,
  noStoreJson,
  parseJson,
  readRoomKey,
  routeError,
  safeRoomCode,
  safeText,
} from "../../../../../server/rooms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> | { code: string } };

const CALL_SIGNAL_TYPES = new Set(["offer", "answer", "ice"]);
const CALL_MEMBER_LIMIT = 12;
const CALL_SIGNAL_LIMIT_BYTES = 24_000;
const ACTIVE_MEMBER_WINDOW = "-35 seconds";
const SIGNAL_LIFETIME = "-3 minutes";

const participantIdFor = (role: "narrator" | "player", playerId: string | null) =>
  role === "narrator" ? "narrator" : safeText(playerId, 100);

const memberKey = (code: string, participantId: string) => `${code}:${participantId}`;

async function authenticateCall(request: Request, context: RouteContext) {
  await ensureRoomSchema();
  const params = await context.params;
  const code = safeRoomCode(params.code);
  const auth = await authenticateRoom(code, readRoomKey(request));
  return { code, auth };
}

async function tidyCall(code: string) {
  const { db } = getBindings();
  await db.batch([
    db.prepare(
      "DELETE FROM room_call_members WHERE room_code = ? AND last_seen_at < datetime('now', ?)",
    ).bind(code, ACTIVE_MEMBER_WINDOW),
    db.prepare(
      "DELETE FROM room_call_signals WHERE room_code = ? AND created_at < datetime('now', ?)",
    ).bind(code, SIGNAL_LIFETIME),
  ]);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { code, auth } = await authenticateCall(request, context);
    if (!auth) {
      return noStoreJson(
        { error: "Entre novamente na aventura para acessar a chamada." },
        { status: 401 },
      );
    }
    await tidyCall(code);
    const url = new URL(request.url);
    const connectionId = safeText(url.searchParams.get("connection"), 80);
    if (!connectionId) {
      return noStoreJson({ error: "A chamada perdeu a identificação desta aba. Entre novamente." }, { status: 400 });
    }
    const selfId = participantIdFor(auth.role, auth.playerId);
    const { db } = getBindings();
    const heartbeat = await db.prepare(
      `UPDATE room_call_members SET last_seen_at = CURRENT_TIMESTAMP
       WHERE room_code = ? AND participant_id = ? AND connection_id = ?`,
    ).bind(code, selfId, connectionId).run();
    if (!heartbeat.meta.changes) {
      return noStoreJson({ joined: false, selfId, members: [], signals: [], lastSignalId: 0 });
    }

    const after = Math.max(0, Math.floor(Number(url.searchParams.get("after")) || 0));
    const [members, signals] = await Promise.all([
      db.prepare(
        `SELECT participant_id, display_name, role, muted, joined_at, last_seen_at
         FROM room_call_members
         WHERE room_code = ? AND last_seen_at >= datetime('now', ?)
         ORDER BY joined_at ASC`,
      ).bind(code, ACTIVE_MEMBER_WINDOW).all(),
      db.prepare(
        `SELECT id, sender_id, recipient_id, type, payload_json, created_at
         FROM room_call_signals
         WHERE room_code = ? AND recipient_id = ? AND sender_id <> ? AND id > ?
         ORDER BY id ASC LIMIT 120`,
      ).bind(code, selfId, selfId, after).all(),
    ]);

    const normalizedSignals = (signals.results || []).map(signal => ({
      id: Number(signal.id) || 0,
      senderId: signal.sender_id,
      recipientId: signal.recipient_id,
      type: signal.type,
      payload: parseJson(signal.payload_json as string, {}),
      createdAt: signal.created_at,
    }));

    return noStoreJson({
      joined: true,
      selfId,
      members: (members.results || []).map(member => ({
        participantId: member.participant_id,
        displayName: member.display_name,
        role: member.role,
        muted: Boolean(member.muted),
        joinedAt: member.joined_at,
        lastSeenAt: member.last_seen_at,
      })),
      signals: normalizedSignals,
      lastSignalId: normalizedSignals.reduce(
        (highest, signal) => Math.max(highest, signal.id),
        after,
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code, auth } = await authenticateCall(request, context);
    if (!auth) {
      return noStoreJson(
        { error: "Entre novamente na aventura para acessar a chamada." },
        { status: 401 },
      );
    }
    await tidyCall(code);
    const body = await request.json().catch(() => ({})) as {
      action?: string;
      connectionId?: string;
      displayName?: string;
      muted?: boolean;
      recipientId?: string;
      type?: string;
      payload?: Record<string, unknown>;
    };
    const action = safeText(body.action, 20);
    const connectionId = safeText(body.connectionId, 80);
    if (!connectionId) {
      return noStoreJson({ error: "A chamada perdeu a identificação desta aba. Entre novamente." }, { status: 400 });
    }
    const selfId = participantIdFor(auth.role, auth.playerId);
    const { db } = getBindings();

    if (action === "join") {
      const current = await db.prepare(
        "SELECT connection_id FROM room_call_members WHERE room_code = ? AND participant_id = ? LIMIT 1",
      ).bind(code, selfId).first<{ connection_id: string }>();
      if (current && current.connection_id !== connectionId) {
        return noStoreJson(
          { error: "Sua chamada já está aberta em outra aba ou aparelho. Saia dela antes de entrar aqui." },
          { status: 409 },
        );
      }
      const active = await db.prepare(
        "SELECT COUNT(*) AS total FROM room_call_members WHERE room_code = ? AND last_seen_at >= datetime('now', ?)",
      ).bind(code, ACTIVE_MEMBER_WINDOW).first<{ total: number }>();
      if (!current && Number(active?.total || 0) >= CALL_MEMBER_LIMIT) {
        return noStoreJson(
          { error: "A chamada já está completa. Aguarde alguém sair para entrar." },
          { status: 409 },
        );
      }
      const displayName = auth.role === "narrator"
        ? safeText(body.displayName, 32) || "Narrador"
        : auth.displayName;
      await db.batch([
        db.prepare(
          `INSERT INTO room_call_members
            (id, room_code, participant_id, connection_id, display_name, role, muted, joined_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             connection_id = excluded.connection_id,
             display_name = excluded.display_name,
             role = excluded.role,
             muted = excluded.muted,
             joined_at = CURRENT_TIMESTAMP,
             last_seen_at = CURRENT_TIMESTAMP`,
        ).bind(memberKey(code, selfId), code, selfId, connectionId, displayName, auth.role, body.muted ? 1 : 0),
        db.prepare(
          "DELETE FROM room_call_signals WHERE room_code = ? AND (sender_id = ? OR recipient_id = ?)",
        ).bind(code, selfId, selfId),
      ]);
      return noStoreJson({
        ok: true,
        joined: true,
        participant: { participantId: selfId, displayName, role: auth.role, muted: Boolean(body.muted) },
      }, { status: 201 });
    }

    if (action === "signal") {
      const type = safeText(body.type, 20);
      const recipientId = safeText(body.recipientId, 100);
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      if (!CALL_SIGNAL_TYPES.has(type) || !recipientId || recipientId === selfId) {
        return noStoreJson({ error: "Não conseguimos reconhecer esta etapa da chamada." }, { status: 400 });
      }
      if (jsonSize(payload) > CALL_SIGNAL_LIMIT_BYTES) {
        return noStoreJson(
          { error: "A conexão de áudio enviou informações demais de uma só vez. Tente entrar novamente." },
          { status: 413 },
        );
      }
      const [sender, recipient] = await Promise.all([
        db.prepare(
          `SELECT id FROM room_call_members
           WHERE room_code = ? AND participant_id = ? AND connection_id = ?
           AND last_seen_at >= datetime('now', ?) LIMIT 1`,
        ).bind(code, selfId, connectionId, ACTIVE_MEMBER_WINDOW).first<{ id: string }>(),
        db.prepare(
          `SELECT id FROM room_call_members
           WHERE room_code = ? AND participant_id = ?
           AND last_seen_at >= datetime('now', ?) LIMIT 1`,
        ).bind(code, recipientId, ACTIVE_MEMBER_WINDOW).first<{ id: string }>(),
      ]);
      if (!sender) {
        return noStoreJson({ error: "Entre na chamada antes de se conectar aos outros participantes." }, { status: 409 });
      }
      if (!recipient) {
        return noStoreJson({ error: "Este participante já saiu da chamada." }, { status: 404 });
      }
      const result = await db.prepare(
        `INSERT INTO room_call_signals
          (room_code, sender_id, recipient_id, type, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(code, selfId, recipientId, type, JSON.stringify(payload)).run();
      await db.prepare(
        `UPDATE room_call_members SET last_seen_at = CURRENT_TIMESTAMP
         WHERE room_code = ? AND participant_id = ? AND connection_id = ?`,
      ).bind(code, selfId, connectionId).run();
      return noStoreJson({ ok: true, id: Number(result.meta.last_row_id || 0) }, { status: 201 });
    }

    return noStoreJson({ error: "Escolha uma ação válida para a chamada." }, { status: 400 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { code, auth } = await authenticateCall(request, context);
    if (!auth) {
      return noStoreJson({ error: "Entre novamente na aventura para acessar a chamada." }, { status: 401 });
    }
    const body = await request.json().catch(() => ({})) as { muted?: boolean; connectionId?: string };
    const connectionId = safeText(body.connectionId, 80);
    const selfId = participantIdFor(auth.role, auth.playerId);
    const { db } = getBindings();
    const result = await db.prepare(
      `UPDATE room_call_members SET muted = ?, last_seen_at = CURRENT_TIMESTAMP
       WHERE room_code = ? AND participant_id = ? AND connection_id = ?`,
    ).bind(body.muted ? 1 : 0, code, selfId, connectionId).run();
    if (!result.meta.changes) {
      return noStoreJson({ error: "Entre na chamada antes de ajustar o microfone." }, { status: 409 });
    }
    return noStoreJson({ ok: true, muted: Boolean(body.muted) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { code, auth } = await authenticateCall(request, context);
    if (!auth) return noStoreJson({ ok: true });
    const body = await request.json().catch(() => ({})) as { connectionId?: string };
    const connectionId = safeText(body.connectionId, 80);
    const selfId = participantIdFor(auth.role, auth.playerId);
    const { db } = getBindings();
    const owned = await db.prepare(
      `SELECT id FROM room_call_members
       WHERE room_code = ? AND participant_id = ? AND connection_id = ? LIMIT 1`,
    ).bind(code, selfId, connectionId).first<{ id: string }>();
    if (owned) {
      await db.batch([
        db.prepare(
          "DELETE FROM room_call_members WHERE room_code = ? AND participant_id = ? AND connection_id = ?",
        ).bind(code, selfId, connectionId),
        db.prepare(
          "DELETE FROM room_call_signals WHERE room_code = ? AND (sender_id = ? OR recipient_id = ?)",
        ).bind(code, selfId, selfId),
      ]);
    }
    return noStoreJson({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
