import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { getRuntimeBindings, RuntimeConfigurationError, RuntimeServiceError, S3Bucket, TursoDatabase } from "../server/runtime.ts";

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
      const args = step.stmt.args.map(arg => arg.type === "null" ? null : arg.type === "integer" || arg.type === "float" ? Number(arg.value) : arg.type === "blob" ? Buffer.from(arg.base64 || "", "base64") : arg.value);
      const cols = statement.columns();
      const rows = cols.length ? statement.all(...args) : [];
      const meta = cols.length ? { changes: 0, lastInsertRowid: 0 } : statement.run(...args);
      results.push({
        cols: cols.map(col => ({ name: col.name })),
        rows: rows.map(row => cols.map(col => row[col.name] === null ? { type: "null" } : typeof row[col.name] === "number" ? { type: Number.isInteger(row[col.name]) ? "integer" : "float", value: String(row[col.name]) } : row[col.name] instanceof Uint8Array ? { type: "blob", base64: Buffer.from(row[col.name]).toString("base64") } : { type: "text", value: row[col.name] })),
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
      db.prepare("CREATE TABLE binary_data (id INTEGER PRIMARY KEY, data BLOB NOT NULL)"),
    ]);
    const binary = new Uint8Array([0, 1, 2, 127, 255]);
    await db.prepare("INSERT INTO binary_data (data) VALUES (?)").bind(binary).run();
    const binaryRow = await db.prepare("SELECT data FROM binary_data WHERE id = 1").first();
    assert.deepEqual([...binaryRow.data], [...binary]);
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

test("native room handlers bootstrap a fresh database, protect narrator data and support calls", async t => {
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
  const [create, room, join, event, call] = await Promise.all([
    import("../app/api/rooms/route.ts"), import("../app/api/rooms/[code]/route.ts"), import("../app/api/rooms/[code]/join/route.ts"), import("../app/api/rooms/[code]/events/route.ts"), import("../app/api/rooms/[code]/call/route.ts"),
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
  for (const [key, connectionId] of [[created.narratorKey, "call-narrator"], [player.playerKey, "call-player"]]) {
    const joinedCall = await call.POST(request(`${path}/call`, key, { action: "join", connectionId }), context);
    assert.equal(joinedCall.status, 201, await joinedCall.clone().text());
  }
  const signal = await call.POST(request(`${path}/call`, created.narratorKey, { action: "signal", connectionId: "call-narrator", recipientId: player.playerId, type: "offer", payload: { type: "offer", sdp: "example-sdp" } }), context);
  assert.equal(signal.status, 201, await signal.clone().text());
  const received = await call.GET(request(`${path}/call?connection=call-player`, player.playerKey, undefined, "GET"), context);
  const callState = await received.json();
  assert.equal(callState.members.length, 2);
  assert.equal(callState.signals[0].payload.sdp, "example-sdp");
  assert.equal((await room.DELETE(request(path, player.playerKey, undefined, "DELETE"), context)).status, 403);
  assert.equal((await room.DELETE(request(path, created.narratorKey, undefined, "DELETE"), context)).status, 200);
  for (const table of ["rooms", "room_players", "room_events", "room_rolls", "room_media", "room_media_uploads", "room_media_chunks", "room_call_members", "room_call_signals"]) {
    assert.equal(sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get().count, 0);
  }
});

const storage = new S3Bucket({ endpoint: "https://objects.example.com", bucket: "adventure-audio", accessKeyId: "access-id", secretAccessKey: "private-secret" });

test("direct audio uploads are signed, expire, and cannot cross rooms or accept altered metadata", () => {
  const upload = { code: "ABC234", id: "audio-example", objectKey: "rooms/ABC234/audio/audio-example", title: "Rota 1", mimeType: "audio/ogg", size: 10_000_000, expires: Date.now() + 900_000 };
  const prepared = storage.prepareUpload(upload);
  const url = new URL(prepared.uploadUrl);
  assert.equal(url.searchParams.get("X-Amz-Expires"), "900");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-type;host");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.equal(prepared.uploadUrl.includes("private-secret"), false);
  assert.deepEqual(storage.verifyUpload(prepared.uploadToken, "ABC234"), upload);
  assert.equal(storage.verifyUpload(prepared.uploadToken, "OTHER1"), null);
  const [payload, proof] = prepared.uploadToken.split(".");
  const altered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), size: 1 })).toString("base64url");
  assert.equal(storage.verifyUpload(`${altered}.${proof}`, "ABC234"), null);
  const expired = storage.prepareUpload({ ...upload, expires: Date.now() - 1 });
  assert.equal(storage.verifyUpload(expired.uploadToken, "ABC234"), null);
});

test("private audio GET/HEAD use signed server requests and return streaming data", async () => {
  const bucket = new S3Bucket(storage.config, async (url, options) => {
    assert.equal(String(url), "https://objects.example.com/adventure-audio/rooms/ABC234/audio/audio-example");
    assert.match(options.headers.authorization, /^AWS4-HMAC-SHA256 Credential=access-id\//);
    assert.match(options.headers["x-amz-content-sha256"], /^[a-f0-9]{64}$/);
    return new Response(options.method === "HEAD" ? null : "audio-bytes", { headers: { "content-length": "11", "content-type": "audio/ogg" } });
  });
  assert.deepEqual(await bucket.head("rooms/ABC234/audio/audio-example"), { size: 11, contentType: "audio/ogg" });
  const object = await bucket.get("rooms/ABC234/audio/audio-example");
  assert.equal(await new Response(object.body).text(), "audio-bytes");
  assert.throws(() => bucket.objectUrl("rooms/../private"), TypeError);
});
