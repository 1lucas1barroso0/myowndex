import { secureRandomString } from "../src/core/random.js";

export type RoomRole = "narrator" | "player";

export type RoomAuth = {
  role: RoomRole;
  playerId: string | null;
  displayName: string;
};

type RoomRow = {
  code: string;
  title: string;
  narrator_secret_hash: string;
  invite_secret_hash: string;
  state_json: string;
  revision: number;
  authority_claim: string;
  created_at: string;
  updated_at: string;
};

type RoomRollRow = {
  id: number;
  request_id: string;
  player_id: string | null;
  author: string;
  action_type: string;
  mode: string;
  request_json: string;
  result_json: string;
  event_type: string;
  event_payload_json: string;
  sfx_payload_json: string | null;
  created_at: string;
};

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const TOKEN_ALPHABET = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const MAX_STATE_BYTES = 180_000;
const MAX_EVENT_BYTES = 30_000;
const MAX_EVENTS = 180;
const encoder = new TextEncoder();
let schemaPromise: Promise<void> | null = null;
export const ROOM_PROTOCOL_VERSION = "2";

export function getBindings() {
  const runtime = (globalThis as typeof globalThis & {
    __MYOWNDEX_ENV__?: { DB?: D1Database; BUCKET?: R2Bucket };
  }).__MYOWNDEX_ENV__;
  if (!runtime?.DB) throw new Error("A Central da Aventura não conseguiu acessar esta aventura agora. Tente novamente em instantes.");
  return {
    db: runtime.DB,
    bucket: runtime.BUCKET,
  };
}

export async function ensureRoomSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const { db } = getBindings();
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        narrator_secret_hash TEXT NOT NULL,
        invite_secret_hash TEXT NOT NULL,
        state_json TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS rooms_updated_at_idx ON rooms (updated_at)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS room_players (
        id TEXT PRIMARY KEY NOT NULL,
        room_code TEXT NOT NULL,
        display_name TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        accent TEXT NOT NULL DEFAULT '#38bdf8',
        ready INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
      )`),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS room_players_token_hash_idx ON room_players (token_hash)"),
      db.prepare("CREATE INDEX IF NOT EXISTS room_players_room_code_idx ON room_players (room_code)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS room_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        room_code TEXT NOT NULL,
        player_id TEXT,
        author TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS room_events_room_id_idx ON room_events (room_code, id)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS room_media (
        id TEXT PRIMARY KEY NOT NULL,
        room_code TEXT NOT NULL,
        object_key TEXT NOT NULL,
        title TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS room_media_room_code_idx ON room_media (room_code)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS room_call_members (
        id TEXT PRIMARY KEY NOT NULL,
        room_code TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        muted INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
      )`),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS room_call_members_participant_idx ON room_call_members (room_code, participant_id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS room_call_members_presence_idx ON room_call_members (room_code, last_seen_at)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS room_call_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        room_code TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS room_call_signals_recipient_idx ON room_call_signals (room_code, recipient_id, id)"),
      db.prepare("CREATE INDEX IF NOT EXISTS room_call_signals_created_at_idx ON room_call_signals (created_at)"),
    ]);
  })().catch(error => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

export function safeText(value: unknown, maximum = 120) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum)
    : "";
}

export function safeRoomCode(value: unknown) {
  const code = safeText(value, 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 5 && code.length <= 8 ? code : "";
}

export function randomString(length: number, alphabet = TOKEN_ALPHABET) {
  return secureRandomString(length, alphabet);
}

export function createRoomCode() {
  return randomString(6, ROOM_CODE_ALPHABET);
}

export function createSecret(prefix: "gm" | "join" | "player") {
  const length = prefix === "join" ? 9 : 32;
  return `${prefix}_${randomString(length)}`;
}

export function createInitialRoomState(title: string) {
  return {
    schema: 1,
    title,
    phase: "exploracao",
    round: 1,
    turnIndex: 0,
    scenario: "rota",
    weather: "limpo",
    sceneNotes: "",
    gmNotes: "",
    tokens: [],
    initiative: [],
    audio: {
      trackId: null,
      title: "",
      playing: false,
      volume: 0.55,
      startedAt: 0,
      offset: 0,
    },
    settings: {
      showHp: true,
      allowPlayerMovement: false,
      mirrorSprites: true,
    },
  };
}

export async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function jsonSize(value: unknown) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

export function assertStateSize(value: unknown) {
  if (jsonSize(value) > MAX_STATE_BYTES) {
    throw new Error("Esta aventura ficou grande demais para ser salva de uma vez. Encurte as anotações ou retire elementos antigos e tente novamente.");
  }
}

export function assertEventSize(value: unknown) {
  if (jsonSize(value) > MAX_EVENT_BYTES) {
    throw new Error("Esta mensagem ou ação ficou longa demais. Encurte-a e tente novamente.");
  }
}

export function readRoomKey(request: Request) {
  return safeText(request.headers.get("x-myowndex-room-key"), 96);
}

export function requireCurrentRoomProtocol(request: Request) {
  if (request.headers.get("x-myowndex-room-protocol") === ROOM_PROTOCOL_VERSION) return null;
  return noStoreJson({
    error: "Esta versão do MyOwnDex precisa ser atualizada antes de alterar uma aventura compartilhada. Recarregue o aplicativo e tente novamente.",
    upgradeRequired: true,
    protocol: ROOM_PROTOCOL_VERSION,
  }, {
    status: 426,
    headers: { "x-myowndex-room-protocol": ROOM_PROTOCOL_VERSION },
  });
}

export async function authenticateRoom(code: string, key: string): Promise<RoomAuth | null> {
  if (!code || !key) return null;
  await ensureRoomSchema();
  const { db } = getBindings();
  const tokenHash = await hashSecret(key);
  const room = await db.prepare(
    "SELECT narrator_secret_hash FROM rooms WHERE code = ? LIMIT 1",
  ).bind(code).first<{ narrator_secret_hash: string }>();
  if (!room) return null;
  if (room.narrator_secret_hash === tokenHash) {
    return { role: "narrator", playerId: null, displayName: "Narrador" };
  }
  const player = await db.prepare(
    "SELECT id, display_name FROM room_players WHERE room_code = ? AND token_hash = ? LIMIT 1",
  ).bind(code, tokenHash).first<{ id: string; display_name: string }>();
  if (!player) return null;
  await db.prepare(
    "UPDATE room_players SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(player.id).run();
  return { role: "player", playerId: player.id, displayName: player.display_name };
}

export async function getRoom(code: string) {
  await ensureRoomSchema();
  const { db } = getBindings();
  return db.prepare(
    `SELECT code, title, narrator_secret_hash, invite_secret_hash, state_json,
      revision, authority_claim, created_at, updated_at
     FROM rooms WHERE code = ? LIMIT 1`,
  ).bind(code).first<RoomRow>();
}

export async function getRoomBundle(code: string, role: RoomRole) {
  const { db } = getBindings();
  const room = await getRoom(code);
  if (!room) return null;
  const players = await db.prepare(
    `SELECT id, display_name, accent, ready, last_seen_at, joined_at
     FROM room_players WHERE room_code = ? ORDER BY joined_at ASC`,
  ).bind(code).all();
  const events = await db.prepare(
    `SELECT id, player_id, author, type, payload_json, created_at
     FROM room_events WHERE room_code = ? ORDER BY id DESC LIMIT 80`,
  ).bind(code).all();
  const rolls = await db.prepare(
    `SELECT id, request_id, player_id, author, action_type, mode, request_json,
      result_json, event_type, event_payload_json, sfx_payload_json, created_at
     FROM room_rolls
     WHERE room_code = ? AND status = 'ready' AND server_authoritative = 1
     ORDER BY id DESC LIMIT 80`,
  ).bind(code).all<RoomRollRow>();
  const media = await db.prepare(
    `SELECT id, title, mime_type, size, created_at
     FROM room_media WHERE room_code = ? ORDER BY created_at DESC LIMIT 30`,
  ).bind(code).all();
  const snapshot = parseJson<Record<string, unknown>>(room.state_json, {});
  if (role !== "narrator") delete snapshot.gmNotes;
  const standardEvents = (events.results || []).reverse().map(event => ({
    id: event.id,
    playerId: event.player_id,
    author: event.author,
    type: event.type,
    payload: parseJson(event.payload_json as string, {}),
    createdAt: event.created_at,
    authorityOrder: 0,
  }));
  const authorityRecords = (rolls.results || []).reverse().map(roll => {
    const stored = parseJson<Record<string, unknown>>(roll.result_json, {});
    return {
      ...stored,
      id: `authority-${roll.id}`,
      sequence: roll.id,
      requestId: roll.request_id,
      playerId: roll.player_id,
      author: roll.author,
      actionType: roll.action_type,
      mode: roll.mode,
      request: parseJson(roll.request_json, {}),
      createdAt: roll.created_at,
      serverAuthoritative: true,
    };
  });
  const authorityEvents = (rolls.results || []).flatMap(roll => {
    const main = {
      id: `authority-${roll.id}`,
      playerId: roll.player_id,
      author: roll.author,
      type: roll.event_type,
      payload: {
        ...parseJson<Record<string, unknown>>(roll.event_payload_json, {}),
        rollId: `authority-${roll.id}`,
        sequence: roll.id,
        serverAuthoritative: true,
      },
      createdAt: roll.created_at,
      authorityOrder: 1,
    };
    const sfx = parseJson<Record<string, unknown> | null>(roll.sfx_payload_json, null);
    return sfx
      ? [main, {
        id: `authority-${roll.id}-sfx`,
        playerId: roll.player_id,
        author: roll.author,
        type: "sfx",
        payload: { ...sfx, rollId: `authority-${roll.id}`, serverAuthoritative: true },
        createdAt: roll.created_at,
        authorityOrder: 2,
      }]
      : [main];
  });
  const combinedEvents = [...standardEvents, ...authorityEvents]
    .sort((first, second) => {
      const firstTime = Date.parse(String(first.createdAt || "").replace(" ", "T") + (String(first.createdAt || "").includes("T") ? "" : "Z")) || 0;
      const secondTime = Date.parse(String(second.createdAt || "").replace(" ", "T") + (String(second.createdAt || "").includes("T") ? "" : "Z")) || 0;
      return firstTime - secondTime || first.authorityOrder - second.authorityOrder || String(first.id).localeCompare(String(second.id));
    })
    .slice(-80)
    .map(({ authorityOrder, ...event }) => {
      void authorityOrder;
      return event;
    });
  return {
    code: room.code,
    title: room.title,
    revision: room.revision,
    updatedAt: room.updated_at,
    snapshot,
    players: (players.results || []).map(player => ({
      id: player.id,
      displayName: player.display_name,
      accent: player.accent,
      ready: Boolean(player.ready),
      lastSeenAt: player.last_seen_at,
      joinedAt: player.joined_at,
    })),
    events: combinedEvents,
    rolls: authorityRecords,
    media: (media.results || []).map(item => ({
      id: item.id,
      title: item.title,
      mimeType: item.mime_type,
      size: item.size,
      createdAt: item.created_at,
    })),
  };
}

export async function appendRoomEvent(input: {
  code: string;
  auth: RoomAuth;
  type: string;
  payload: unknown;
}) {
  assertEventSize(input.payload);
  const { db } = getBindings();
  const result = await db.prepare(
    `INSERT INTO room_events (room_code, player_id, author, type, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    input.code,
    input.auth.playerId,
    input.auth.displayName,
    input.type,
    JSON.stringify(input.payload ?? {}),
  ).run();
  await db.prepare(
    `DELETE FROM room_events
     WHERE room_code = ? AND id NOT IN (
       SELECT id FROM room_events WHERE room_code = ? ORDER BY id DESC LIMIT ?
     )`,
  ).bind(input.code, input.code, MAX_EVENTS).run();
  return Number(result.meta.last_row_id || 0);
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Algo impediu esta ação. Tente novamente.";
  return Response.json({ error: message }, { status: 500 });
}

export function noStoreJson(value: unknown, init?: ResponseInit) {
  const response = Response.json(value, init);
  response.headers.set("cache-control", "no-store, max-age=0");
  return response;
}
