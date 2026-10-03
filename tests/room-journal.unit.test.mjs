import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { createRoomSnapshot } from "../src/core/room.js";
import { createHranaFixture } from "./helpers/hrana-server.mjs";

// Real SQL and production handlers: removing the diary must never undo a turn
// or permit a delayed request to roll/apply an already completed action again.
test("journal removal preserves permissions, state and authoritative idempotency", async t => {
  const fixture = await createHranaFixture({ port: 0 });
  const previous = { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN };
  process.env.TURSO_DATABASE_URL = fixture.url;
  process.env.TURSO_AUTH_TOKEN = "qa-only";
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) { if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error; return nextResolve(`${specifier}.ts`, context); }
  } });
  t.after(async () => {
    hooks.deregister(); await fixture.close();
    for (const [key, value] of [["TURSO_DATABASE_URL", previous.url], ["TURSO_AUTH_TOKEN", previous.token]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  fixture.sqlite.exec(`CREATE TABLE room_rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, room_code TEXT NOT NULL,
    actor_key TEXT NOT NULL, request_id TEXT NOT NULL, request_fingerprint TEXT NOT NULL,
    player_id TEXT, author TEXT NOT NULL, action_type TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'normal', request_json TEXT NOT NULL,
    result_json TEXT NOT NULL, event_type TEXT NOT NULL, event_payload_json TEXT NOT NULL,
    sfx_payload_json TEXT, status TEXT NOT NULL DEFAULT 'ready', claim_token TEXT NOT NULL DEFAULT '',
    server_authoritative INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  fixture.sqlite.prepare(`INSERT INTO room_rolls (room_code, actor_key, request_id, request_fingerprint,
    author, action_type, request_json, result_json, event_type, event_payload_json)
    VALUES ('LEGACY', 'narrator', 'legacy-receipt-01', 'legacy-hash', 'Narrador', 'quick-attribute', '{}', '{"preserved":true}', 'roll', '{}')`).run();
  const server = await import("../server/rooms.ts");
  const events = await import("../app/api/rooms/[code]/events/route.ts");
  const rolls = await import("../app/api/rooms/[code]/rolls/route.ts");
  await server.ensureRoomSchema();
  await t.test("additive migration keeps legacy receipts", () => {
    assert.ok(fixture.sqlite.prepare("PRAGMA table_info(room_rolls)").all().some(column => column.name === "journal_hidden"));
    assert.deepEqual(fixture.sqlite.prepare("SELECT result_json, journal_hidden FROM room_rolls WHERE room_code = 'LEGACY'").get(), Object.assign(Object.create(null), { result_json: '{"preserved":true}', journal_hidden: 0 }));
  });
  const code = "QA7777";
  const snapshot = { ...createRoomSnapshot("Diário QA"), gmNotes: "Privado", sceneNotes: "Preservar", round: 7 };
  fixture.sqlite.prepare("INSERT INTO rooms (code, title, narrator_secret_hash, invite_secret_hash, state_json) VALUES (?, ?, ?, ?, ?)")
    .run(code, "Diário QA", await server.hashSecret("narrator-qa-key"), "invite", JSON.stringify(snapshot));
  for (const [id, key] of [["player-a", "player-a-qa-key"], ["player-b", "player-b-qa-key"]]) {
    fixture.sqlite.prepare("INSERT INTO room_players (id, room_code, display_name, token_hash) VALUES (?, ?, ?, ?)").run(id, code, id, await server.hashSecret(key));
  }
  const context = { params: Promise.resolve({ code }) };
  const call = async (handler, method, key, payload, protocol = "3") => {
    const response = await handler(new Request(`http://localhost/api/rooms/${code}/events`, {
      method, headers: { "content-type": "application/json", "x-myowndex-room-key": key, "x-myowndex-room-protocol": protocol }, body: JSON.stringify(payload),
    }), context);
    return { status: response.status, body: await response.json() };
  };
  const postMessage = async (key, text) => (await call(events.POST, "POST", key, { type: "message", payload: { text } })).body.id;
  const a = await postMessage("player-a-qa-key", "Mensagem A");
  const b = await postMessage("player-b-qa-key", "Mensagem B");
  const n = await postMessage("narrator-qa-key", "Mensagem Narrador");
  const roomBefore = fixture.sqlite.prepare("SELECT state_json, revision FROM rooms WHERE code = ?").get(code);
  await t.test("unauthenticated and stale clients cannot remove entries", async () => {
    assert.equal((await call(events.DELETE, "DELETE", "wrong-key", { id: a })).status, 401);
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", { id: a }, "2")).status, 426);
    assert.equal((await call(events.DELETE, "DELETE", "narrator-qa-key", { id: "1 OR 1=1" })).status, 400);
  });
  await t.test("a player removes only their own messages", async () => {
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", { id: b })).status, 403);
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", { id: a })).status, 200);
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", { id: a })).status, 200);
    const bundle = await server.getRoomBundle(code, "player");
    assert.ok(!bundle.events.some(event => event.id === a));
    assert.ok(bundle.events.some(event => event.id === b));
    assert.ok(bundle.events.some(event => event.id === n));
    assert.equal(bundle.snapshot.gmNotes, undefined);
  });
  const rollRequest = { requestId: "journal-replay-qa-0001", action: "quick-attribute", mode: "normal", attribute: 3 };
  const originalRoll = await call(rolls.POST, "POST", "player-a-qa-key", rollRequest);
  assert.equal(originalRoll.status, 200);
  await t.test("removing a receipt keeps delayed retries idempotent", async () => {
    assert.equal((await call(events.DELETE, "DELETE", "player-b-qa-key", { id: originalRoll.body.result.id })).status, 403);
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", { id: originalRoll.body.result.id })).status, 200);
    const hidden = await server.getRoomBundle(code, "narrator");
    assert.ok(!hidden.events.some(event => event.id === originalRoll.body.result.id));
    assert.ok(!hidden.rolls.some(roll => roll.id === originalRoll.body.result.id));
    const retry = await call(rolls.POST, "POST", "player-a-qa-key", rollRequest);
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body.result, originalRoll.body.result);
    assert.ok(!retry.body.room.events.some(event => event.id === originalRoll.body.result.id));
    assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM room_rolls WHERE room_code = ? AND request_id = ?").get(code, rollRequest.requestId).count, 1);
  });
  await t.test("clear is scoped and a retry preserves newer messages", async () => {
    const a2 = await postMessage("player-a-qa-key", "Mensagem A2");
    const selection = { all: true, through: { events: a2, rolls: originalRoll.body.result.sequence } };
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", selection)).status, 200);
    const a3 = await postMessage("player-a-qa-key", "Mensagem nova A3");
    assert.equal((await call(events.DELETE, "DELETE", "player-a-qa-key", selection)).status, 200);
    const bundle = await server.getRoomBundle(code, "narrator");
    assert.ok(!bundle.events.some(event => event.id === a2));
    assert.ok(bundle.events.some(event => event.id === a3));
    assert.ok(bundle.events.some(event => event.id === b));
    assert.equal((await call(events.DELETE, "DELETE", "narrator-qa-key", { all: true })).status, 400);
    assert.equal((await call(events.DELETE, "DELETE", "narrator-qa-key", { all: true, through: { events: a3, rolls: originalRoll.body.result.sequence } })).status, 200);
    assert.equal((await server.getRoomBundle(code, "narrator")).events.length, 0);
  });
  await t.test("journal removal never changes HP, PP, notes, turn or revision", () => {
    assert.deepEqual(fixture.sqlite.prepare("SELECT state_json, revision FROM rooms WHERE code = ?").get(code), roomBefore);
  });
});
