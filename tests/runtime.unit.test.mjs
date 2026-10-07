import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { getRuntimeBindings, RuntimeConfigurationError, RuntimeServiceError, TursoDatabase } from "../server/runtime.ts";

// Exercise the HTTP driver against real SQLite, interpreting Hrana batch conditions.
const sqliteTransport = sqlite => async (url, options) => {
  assert.equal(url, "https://dex-example.turso.io/v2/pipeline");
  assert.equal(options.headers.authorization, "Bearer database-token");
  assert.equal(options.cache, "no-store");
  const { requests } = JSON.parse(options.body);
  assert.equal(requests[1].type, "close");
  const results = [], errors = [];
  const condition = value => !value || (value.type === "ok" ? Boolean(results[value.step]) : value.type === "not" ? !condition(value.cond) : false);
  for (const step of requests[0].batch.steps) {
    if (!condition(step.condition)) { results.push(null); errors.push(null); continue; }
    try {
      const statement = sqlite.prepare(step.stmt.sql);
      const args = step.stmt.args.map(arg => arg.type === "null" ? null : arg.type === "integer" || arg.type === "float" ? Number(arg.value) : arg.value);
      const cols = statement.columns();
      const rows = cols.length ? statement.all(...args) : [];
      const meta = cols.length ? { changes: 0, lastInsertRowid: 0 } : statement.run(...args);
      results.push({
        cols: cols.map(col => ({ name: col.name })),
        rows: rows.map(row => cols.map(col => row[col.name] === null ? { type: "null" } : typeof row[col.name] === "number" ? { type: Number.isInteger(row[col.name]) ? "integer" : "float", value: String(row[col.name]) } : { type: "text", value: row[col.name] })),
        affected_row_count: Number(meta.changes), last_insert_rowid: String(meta.lastInsertRowid),
      });
      errors.push(null);
    } catch (error) { results.push(null); errors.push({ message: error.message }); }
  }
  return Response.json({ results: [{ type: "ok", response: { type: "batch", result: { step_results: results, step_errors: errors } } }, { type: "ok", response: { type: "close" } }] });
};

test("shared rooms require a persistent user database and report missing setup clearly", () => {
  assert.throws(() => getRuntimeBindings({}), error => error instanceof RuntimeConfigurationError && error.status === 503 && /TURSO/.test(error.message));
  assert.throws(() => new TursoDatabase("file:memory", "token"), RuntimeConfigurationError);
  assert.throws(() => new TursoDatabase("https://user:password@example.com", "token"), RuntimeConfigurationError);
});

test("Turso preserves SQLite parameters, row types, insert IDs and transactional rollback", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const db = new TursoDatabase("libsql://dex-example.turso.io", "database-token", sqliteTransport(sqlite));
  try {
    await db.batch([
      db.prepare("CREATE TABLE trainers (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, hp INTEGER, note TEXT)"),
      db.prepare("CREATE TABLE teams (trainer INTEGER REFERENCES trainers(id) ON DELETE CASCADE)"),
    ]);
    const inserted = await db.prepare("INSERT INTO trainers (name, hp, note) VALUES (?, ?, ?)").bind("O'Brien ?;", 25, null).run();
    assert.equal(inserted.meta.changes, 1);
    assert.equal(inserted.meta.last_row_id, 1);
    assert.deepEqual(await db.prepare("SELECT * FROM trainers WHERE name = ?").bind("O'Brien ?;").first(), { id: 1, name: "O'Brien ?;", hp: 25, note: null });
    assert.equal(await db.prepare("SELECT * FROM trainers WHERE id = ?").bind(999).first(), null);
    await assert.rejects(db.batch([
      db.prepare("UPDATE trainers SET hp = ? WHERE id = ?").bind(99, 1),
      db.prepare("INSERT INTO trainers (name) VALUES (?)").bind("O'Brien ?;"),
    ]), RuntimeServiceError);
    assert.equal((await db.prepare("SELECT hp FROM trainers WHERE id = ?").bind(1).first()).hp, 25);
    await db.prepare("INSERT INTO teams VALUES (?)").bind(1).run();
    await db.prepare("DELETE FROM trainers WHERE id = ?").bind(1).run();
    assert.deepEqual((await db.prepare("SELECT * FROM teams").all()).results, []);
  } finally { sqlite.close(); }
});

test("revision updates inside a batch confirm only the winning action", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const db = new TursoDatabase("https://dex-example.turso.io", "database-token", sqliteTransport(sqlite));
  try {
    await db.prepare("CREATE TABLE rooms (revision INTEGER NOT NULL)").run();
    await db.prepare("INSERT INTO rooms VALUES (0)").run();
    const first = await db.batch([db.prepare("UPDATE rooms SET revision = revision + 1 WHERE revision = ?").bind(0)]);
    const raced = await db.batch([db.prepare("UPDATE rooms SET revision = revision + 1 WHERE revision = ?").bind(0)]);
    assert.equal(first[0].meta.changes, 1);
    assert.equal(raced[0].meta.changes, 0);
    assert.equal((await db.prepare("SELECT revision FROM rooms").first()).revision, 1);
  } finally { sqlite.close(); }
});

test("database HTTP failures never expose response bodies or credentials", async () => {
  const db = new TursoDatabase("https://dex-example.turso.io", "database-token", async () => new Response("secret-token diagnostic", { status: 401 }));
  await assert.rejects(db.prepare("SELECT 1").run(), error => error.status === 503 && !error.message.includes("secret-token") && /401/.test(error.message));
});

test("native room handlers bootstrap a fresh database and protect narrator data", async t => {
  const sqlite = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.TURSO_DATABASE_URL;
  const originalToken = process.env.TURSO_AUTH_TOKEN;
  process.env.TURSO_DATABASE_URL = "https://dex-example.turso.io";
  process.env.TURSO_AUTH_TOKEN = "database-token";
  globalThis.fetch = sqliteTransport(sqlite);
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      try { return nextResolve(specifier, context); }
      catch (error) {
        if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
        return nextResolve(`${specifier}.ts`, context);
      }
    },
  });
  t.after(() => {
    hook.deregister();
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = originalUrl;
    if (originalToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = originalToken;
    sqlite.close();
  });
  const [create, room, join, event] = await Promise.all([
    import("../app/api/rooms/route.ts"),
    import("../app/api/rooms/[code]/route.ts"),
    import("../app/api/rooms/[code]/join/route.ts"),
    import("../app/api/rooms/[code]/events/route.ts"),
  ]);
  const request = (path, key = "", body, method = "POST") => new Request(`https://app.example.com${path}`, {
    method, headers: { "content-type": "application/json", "x-myowndex-room-protocol": "3", "x-myowndex-room-key": key }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await create.POST(request("/api/rooms", "", { title: "Rota 1", snapshot: { gmNotes: "Segredo do narrador" } }));
  assert.equal(response.status, 201, await response.clone().text());
  const created = await response.json();
  const path = `/api/rooms/${created.code}`;
  const context = { params: Promise.resolve({ code: created.code }) };
  assert.ok(sqlite.prepare("PRAGMA table_info(rooms)").all().some(column => column.name === "authority_claim"));
  assert.ok(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'room_rolls'").get());
  assert.equal((await room.GET(request(path, "wrong-key", undefined, "GET"), context)).status, 401);
  const narratorView = await (await room.GET(request(path, created.narratorKey, undefined, "GET"), context)).json();
  assert.equal(narratorView.snapshot.gmNotes, "Segredo do narrador");
  const joinedResponse = await join.POST(request(`${path}/join`, "", { displayName: "Red", inviteCode: created.inviteCode }), context);
  assert.equal(joinedResponse.status, 201, await joinedResponse.clone().text());
  const player = await joinedResponse.json();
  assert.equal(player.room.snapshot.gmNotes, undefined);
  assert.equal((await room.PATCH(request(path, player.playerKey, { snapshot: created.snapshot, expectedRevision: 0 }, "PATCH"), context)).status, 403);
  const changed = await room.PATCH(request(path, created.narratorKey, { snapshot: { ...created.snapshot, sceneNotes: "A grama balança." }, expectedRevision: 0 }, "PATCH"), context);
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.equal((await changed.json()).revision, 1);
  assert.equal((await room.PATCH(request(path, created.narratorKey, { snapshot: created.snapshot, expectedRevision: 0 }, "PATCH"), context)).status, 409);
  assert.equal((await event.POST(request(`${path}/events`, player.playerKey, { type: "ready", payload: { ready: true } }), context)).status, 201);
  assert.equal(sqlite.prepare("SELECT ready FROM room_players WHERE id = ?").get(player.playerId).ready, 1);
  assert.equal((await room.DELETE(request(path, player.playerKey, undefined, "DELETE"), context)).status, 403);
  assert.equal((await room.DELETE(request(path, created.narratorKey, undefined, "DELETE"), context)).status, 200);
  for (const table of ["rooms", "room_players", "room_events", "room_rolls"]) {
    assert.equal(sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get().count, 0);
  }
});
