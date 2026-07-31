import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  narratorSecretHash: text("narrator_secret_hash").notNull(),
  inviteSecretHash: text("invite_secret_hash").notNull(),
  stateJson: text("state_json").notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index("rooms_updated_at_idx").on(table.updatedAt),
]);

export const roomPlayers = sqliteTable("room_players", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  tokenHash: text("token_hash").notNull(),
  accent: text("accent").notNull().default("#38bdf8"),
  ready: integer("ready", { mode: "boolean" }).notNull().default(false),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  uniqueIndex("room_players_token_hash_idx").on(table.tokenHash),
  index("room_players_room_code_idx").on(table.roomCode),
]);

export const roomEvents = sqliteTable("room_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  playerId: text("player_id"),
  author: text("author").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index("room_events_room_id_idx").on(table.roomCode, table.id),
]);

export const roomMedia = sqliteTable("room_media", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  title: text("title").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index("room_media_room_code_idx").on(table.roomCode),
]);

export const roomCallMembers = sqliteTable("room_call_members", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  connectionId: text("connection_id").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  muted: integer("muted", { mode: "boolean" }).notNull().default(false),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  uniqueIndex("room_call_members_participant_idx").on(table.roomCode, table.participantId),
  index("room_call_members_presence_idx").on(table.roomCode, table.lastSeenAt),
]);

export const roomCallSignals = sqliteTable("room_call_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index("room_call_signals_recipient_idx").on(table.roomCode, table.recipientId, table.id),
  index("room_call_signals_created_at_idx").on(table.createdAt),
]);
