import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";

// A real SQLite transport executes the same atomic Hrana batches as production.
const sqliteTransport = sqlite => async (_url, options) => {
  const { requests } = JSON.parse(options.body);
  const results = [], errors = [];
  const condition = value => !value || (value.type === "ok" ? !!results[value.step] : value.type === "not" ? !condition(value.cond) : false);
  for (const step of requests[0].batch.steps) {
    if (!condition(step.condition)) { results.push(null); errors.push(null); continue; }
    try {
      const statement = sqlite.prepare(step.stmt.sql);
      const args = step.stmt.args.map(arg => arg.type === "null" ? null : arg.type === "integer" || arg.type === "float" ? Number(arg.value) : arg.value);
      const columns = statement.columns();
      const rows = columns.length ? statement.all(...args) : [];
      const meta = columns.length ? { changes: 0, lastInsertRowid: 0 } : statement.run(...args);
      results.push({
        cols: columns.map(col => ({ name: col.name })),
        rows: rows.map(row => columns.map(col => row[col.name] === null ? { type: "null" } : typeof row[col.name] === "number" ? { type: Number.isInteger(row[col.name]) ? "integer" : "float", value: String(row[col.name]) } : { type: "text", value: row[col.name] })),
        affected_row_count: Number(meta.changes), last_insert_rowid: String(meta.lastInsertRowid),
      });
      errors.push(null);
    } catch (error) { results.push(null); errors.push({ message: error.message }); }
  }
  return Response.json({ results: [{ type: "ok", response: { type: "batch", result: { step_results: results, step_errors: errors } } }, { type: "ok", response: { type: "close" } }] });
};

test("account routes authenticate, isolate, synchronize and recover real SQLite data", async t => {
  const sqlite = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const previousEnvironment = { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN, budget: process.env.MYOWNDEX_DATABASE_LIMIT_BYTES };
  process.env.TURSO_DATABASE_URL = "https://account-test.turso.io";
  process.env.TURSO_AUTH_TOKEN = "test-only-database-token";
  globalThis.fetch = sqliteTransport(sqlite);
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) { if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error; return nextResolve(`${specifier}.ts`, context); }
  } });
  t.after(() => {
    hook.deregister(); globalThis.fetch = originalFetch; sqlite.close();
    for (const [key, value] of [["TURSO_DATABASE_URL", previousEnvironment.url], ["TURSO_AUTH_TOKEN", previousEnvironment.token], ["MYOWNDEX_DATABASE_LIMIT_BYTES", previousEnvironment.budget]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const names = ["signup", "login", "logout", "session", "recover", "password", "delete", "data", "rooms", "rooms/invite"];
  const route = Object.fromEntries(await Promise.all(names.map(async name => [name, await import(`../app/api/account/${name}/route.ts`)])));
  const backend = await import("../server/accounts.ts");
  const makeRequest = (path, payload, account, options = {}) => new Request(`https://myowndex.example/api/account/${path}`, {
    method: options.method || (payload === undefined ? "GET" : path === "data" ? "PUT" : "POST"),
    headers: {
      "content-type": "application/json", origin: "https://myowndex.example", "sec-fetch-site": "same-origin", "x-vercel-forwarded-for": "198.51.100.4",
      ...(account ? { cookie: account.cookie, "x-myowndex-account": account.id } : {}), ...options.headers,
    }, body: payload === undefined ? undefined : typeof payload === "string" ? payload : JSON.stringify(payload),
  });
  const call = async (path, payload, account, options) => {
    const response = await route[path === "data?previous=1" ? "data" : path][options?.method || (payload === undefined ? "GET" : path === "data" ? "PUT" : "POST")](makeRequest(path, payload, account, options));
    return { response, data: await response.clone().json() };
  };
  const accountFrom = result => ({ id: result.data.account.id, cookie: result.response.headers.get("set-cookie").split(";")[0], recoveryCodes: result.data.recoveryCodes, username: result.data.account.username });
  const document = (name = "Pallet Town") => ({ schema: 1, boxes: [{ id: "box-1", name, pokemon: [] }], dex: { favorites: [1] }, preferences: { experienceMode: "rpg", appearance: "dark", view: "pc" }, localAdventure: null, roomSession: null, clocks: {}, tombstones: {}, favoriteClocks: {} });
  let alice, bob, aliceSecond, originalCodes, sharedRoom;

  await t.test("strict CSRF and input validation happen before account creation", async () => {
    for (const headers of [{ origin: "https://other.example" }, { origin: "" }, { "sec-fetch-site": "cross-site" }, { "content-type": "text/plain" }]) {
      const result = await call("signup", { username: "Alice", password: "long-safe-password" }, null, { headers });
      assert.ok([403, 415].includes(result.response.status));
      assert.equal(result.response.headers.get("set-cookie"), null);
    }
    assert.equal((await call("signup", { username: "a", password: "long-safe-password" })).response.status, 400);
    assert.equal((await call("signup", { username: "Alice", password: "short" })).response.status, 400);
    assert.equal((await call("signup", "{broken")).response.status, 400);
    assert.equal((await call("signup", { username: "Alice", password: "long-safe-password" }, null, { headers: { "content-length": "5000" } })).response.status, 413);
    const local = headers => new Request("http://0.0.0.0:3000/api/account/signup", { method: "POST", headers: {
      "content-type": "application/json", host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin", ...headers,
    } });
    assert.doesNotThrow(() => backend.requireAccountOrigin(local({})));
    for (const headers of [{ origin: "http://attacker.example" }, { origin: "http://0.0.0.0:3000" }, { origin: "" }, { "sec-fetch-site": "cross-site" }]) {
      assert.throws(() => backend.requireAccountOrigin(local(headers)), error => error.status === 403);
    }
    const xpSource = { ...document(), boxes: [{ id: "box-xp", name: "XP", pokemon: [{ rpg: { xp: 5.9 }, species: { height: 0.7 } }] }],
      localAdventure: { snapshot: { tokens: [{ xp: 9.5 }], benchTokens: [{ xp: "4.8" }] } } };
    const normalized = backend.validateAccountDocument(xpSource);
    assert.equal(normalized.boxes[0].pokemon[0].rpg.xp, 5);
    assert.equal(normalized.boxes[0].pokemon[0].species.height, 0.7);
    assert.equal(normalized.localAdventure.snapshot.tokens[0].xp, 9);
    assert.equal(normalized.localAdventure.snapshot.benchTokens[0].xp, 4);
    assert.equal(xpSource.boxes[0].pokemon[0].rpg.xp, 5.9, "normalization must not mutate the supplied document");
  });

  await t.test("signup stores only salted password/session/recovery hashes and sends a secure cookie", async () => {
    const created = await call("signup", { username: "Alice", password: "long-safe-password", displayName: "Alice da Rota 1" });
    assert.equal(created.response.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.account.username, "alice");
    alice = accountFrom(created); originalCodes = alice.recoveryCodes;
    assert.equal(new Set(alice.recoveryCodes).size, 8);
    assert.ok(alice.recoveryCodes.every(code => /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(?:-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){3}$/.test(code)));
    assert.match(created.response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict; Max-Age=2592000; Secure/);
    assert.match(created.response.headers.get("cache-control"), /no-store/);
    assert.deepEqual(Object.keys(created.data.account).sort(), ["displayName", "id", "username"]);
    const saved = sqlite.prepare("SELECT * FROM myowndex_accounts WHERE id=?").get(alice.id);
    assert.match(saved.password_hash, /^scrypt\$32768\$8\$3\$/);
    assert.ok(!saved.password_hash.includes("long-safe-password"));
    assert.ok(await backend.verifyAccountPassword("long-safe-password", saved.password_hash));
    assert.ok(!await backend.verifyAccountPassword("different-password", saved.password_hash));
    const recovery = sqlite.prepare("SELECT code_hash FROM myowndex_account_recovery WHERE account_id=?").all(alice.id);
    assert.equal(recovery.length, 8); assert.ok(recovery.every(row => /^[a-f0-9]{64}$/.test(row.code_hash)));
    const session = sqlite.prepare("SELECT token_hash FROM myowndex_account_sessions WHERE account_id=?").get(alice.id);
    assert.equal(session.token_hash, createHash("sha256").update(alice.cookie.split("=")[1]).digest("hex"));
    assert.equal((await call("signup", { username: "ALICE", password: "different-password" })).response.status, 409);
    assert.equal((await call("session", undefined, alice)).data.account.id, alice.id);
    assert.equal((await call("session")).data.account, null);
    const other = await call("signup", { username: "Bob", password: "bobs-safe-password" });
    assert.equal(other.response.status, 201); bob = accountFrom(other);
    assert.notEqual(saved.password_hash, sqlite.prepare("SELECT password_hash FROM myowndex_accounts WHERE id=?").get(bob.id).password_hash);
  });

  await t.test("login failure is generic and the current session survives same-second session trimming", async () => {
    const wrong = await call("login", { username: "alice", password: "wrong-long-password" });
    const missing = await call("login", { username: "missing", password: "wrong-long-password" });
    assert.equal(wrong.response.status, 401); assert.deepEqual(wrong.data, missing.data);
    assert.equal((await call("login", { username: "ALICE", password: "long-safe-password" })).response.status, 200);
    const now = Math.floor(Date.now() / 1000);
    for (let index = 0; index < 25; index++) sqlite.prepare("INSERT INTO myowndex_account_sessions VALUES(?,?,?,?)").run(`f${String(index).padStart(63, "0")}`, alice.id, now, now + 3600);
    const login = await call("login", { username: "alice", password: "long-safe-password" });
    assert.equal(login.response.status, 200); aliceSecond = accountFrom(login);
    assert.equal((await call("session", undefined, aliceSecond)).data.account.id, alice.id);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM myowndex_account_sessions WHERE account_id=?").get(alice.id).count, 20);
  });

  await t.test("account scope prevents stale tabs from reading, mutating or logging out another account", async () => {
    const wrongScope = { ...bob, id: alice.id };
    for (const [path, payload] of [["data", undefined], ["data", { document: document(), expectedRevision: 0 }], ["logout", {}], ["password", { password: "bobs-safe-password", newPassword: "a-new-safe-password" }], ["delete", { password: "bobs-safe-password" }]]) {
      const result = await call(path, payload, wrongScope);
      assert.equal(result.response.status, 409, path); assert.equal(result.data.code, "ACCOUNT_SCOPE_CHANGED");
      assert.equal(result.response.headers.get("set-cookie"), null);
    }
    assert.equal((await call("data", undefined, bob, { headers: { "x-myowndex-account": "" } })).response.status, 409);
    assert.equal((await call("session", undefined, bob)).data.account.id, bob.id);
  });

  await t.test("cloud CAS retains the winning revision, isolation and one recoverable previous document", async () => {
    const first = await call("data", { document: document("Viridian Forest"), expectedRevision: 0 }, aliceSecond);
    assert.equal(first.response.status, 200, JSON.stringify(first.data)); assert.equal(first.data.revision, 1);
    assert.match(first.data.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "server UTC times must carry their zone on every device");
    const stale = await call("data", { document: document("Stale overwrite"), expectedRevision: 0 }, aliceSecond);
    assert.equal(stale.response.status, 409); assert.equal(stale.data.conflict, true);
    assert.equal(stale.data.document.boxes[0].name, "Viridian Forest");
    assert.equal((await call("data", undefined, bob)).data.document, null);
    const [a, b] = await Promise.all([
      call("data", { document: document("Choice A"), expectedRevision: 1 }, aliceSecond),
      call("data", { document: document("Choice B"), expectedRevision: 1 }, aliceSecond),
    ]);
    assert.deepEqual([a.response.status, b.response.status].sort(), [200, 409]);
    assert.equal((await call("data", undefined, aliceSecond)).data.revision, 2);
    const previous = await call("data?previous=1", undefined, aliceSecond);
    assert.equal(previous.data.revision, 1); assert.equal(previous.data.document.boxes[0].name, "Viridian Forest");
    assert.equal((await call("data", { document: document(), expectedRevision: 2.5 }, aliceSecond)).response.status, 400);
    assert.equal((await call("data", { document: { ...document(), roomSession: { roomKey: "private" } }, expectedRevision: 2 }, aliceSecond)).response.status, 400);
    assert.equal((await call("data", { document: { ...document(), inventedField: "fake" }, expectedRevision: 2 }, aliceSecond)).response.status, 400);
    const dangerous = JSON.parse(JSON.stringify(document())); dangerous.preferences = JSON.parse('{"__proto__":{"polluted":true}}');
    assert.equal((await call("data", { document: dangerous, expectedRevision: 2 }, aliceSecond)).response.status, 400);
    const huge = { ...document(), localAdventure: { notes: "x".repeat(4 * 1024 * 1024) } };
    assert.equal((await call("data", { document: huge, expectedRevision: 2 }, aliceSecond)).response.status, 413);
    assert.equal((await call("data", undefined, aliceSecond)).data.revision, 2);
    assert.equal({}.polluted, undefined);
  });

  await t.test("previous-copy deletion requires scope, origin and the current revision while preserving current data", async () => {
    const before = (await call("data", undefined, aliceSecond)).data;
    assert.equal((await call("data", { expectedRevision: 2 }, { ...bob, id: alice.id }, { method: "DELETE" })).response.status, 409);
    assert.equal((await call("data", { expectedRevision: 2 }, aliceSecond, { method: "DELETE", headers: { origin: "https://other.example" } })).response.status, 403);
    assert.equal((await call("data", { expectedRevision: 1 }, aliceSecond, { method: "DELETE" })).response.status, 409);
    assert.equal((await call("data", { expectedRevision: 2.5 }, aliceSecond, { method: "DELETE" })).response.status, 400);
    assert.equal((await call("data", { expectedRevision: 2, document: {} }, aliceSecond, { method: "DELETE" })).response.status, 400);
    assert.equal((await call("data?previous=1", undefined, aliceSecond)).data.document.boxes[0].name, "Viridian Forest");
    const erased = await call("data", { expectedRevision: 2 }, aliceSecond, { method: "DELETE" });
    assert.equal(erased.response.status, 200);
    assert.equal(erased.data.previousDeleted, true);
    assert.equal(erased.data.previousRevision, null);
    assert.equal(erased.data.revision, before.revision);
    assert.deepEqual(erased.data.document, before.document);
    assert.equal((await call("data?previous=1", undefined, aliceSecond)).data.document, null);
    assert.equal((await call("data", { expectedRevision: 2 }, aliceSecond, { method: "DELETE" })).response.status, 200, "repeating the same erase is safe");
    assert.equal((await call("data", undefined, bob)).data.document, null);
  });

  await t.test("finite database reserve rejects writes without replacing existing documents", async () => {
    process.env.MYOWNDEX_DATABASE_LIMIT_BYTES = String(32 * 1024 * 1024);
    sqlite.exec("CREATE TABLE test_capacity(payload BLOB)");
    sqlite.prepare("INSERT INTO test_capacity VALUES(zeroblob(?))").run(25 * 1024 * 1024);
    const failed = await call("data", { document: document("Must remain unsaved"), expectedRevision: 2 }, aliceSecond);
    assert.equal(failed.response.status, 507); assert.equal(failed.data.code, "ACCOUNT_STORAGE_FULL");
    assert.equal((await call("data", undefined, aliceSecond)).data.revision, 2);
    sqlite.exec("DROP TABLE test_capacity"); delete process.env.MYOWNDEX_DATABASE_LIMIT_BYTES;
  });

  await t.test("cloud storage preserves bounded local dice and generator data without migrating HP twice", async () => {
    const tools = { dicePreferences: { kind: "free", mode: "normal", quantity: 2, sides: 20, modifier: 3, label: "Cena" },
      diceRoom: { schema: 7, tokens: [{ id: "sleeping", maxHp: 6, currentHp: 4, xp: 9.9, status: "sleep", sleepTurns: 2 }],
        benchTokens: [{ id: "frozen", maxHp: 6, currentHp: 2, xp: 4.9, status: "freeze", freezeTurns: 1 }] },
      generatorDraft: { schema: 1, results: [{ versionGroup: "sword-shield", pokemon: { id: "generated",
        species: { name: "pikachu", height: 0.4, weight: 6.9 }, rpg: { xp: 5.9, scaleVersion: 1, currentHp: 4 } } }] },
      rollHistory: [{ version: 2, id: "local-receipt", createdAt: 100, context: "central",
        spec: { kind: "free", mode: "normal", quantity: 1, sides: 20, modifier: 0, label: "Cena" },
        values: [5], kept: [5], total: 5, success: null }],
    };
    const saved = await call("data", { document: { ...document("Tools"), localTools: tools,
      rollClocks: { "local-receipt": 100 }, tombstones: { localRolls: { "removed-receipt": 90 } } }, expectedRevision: 0 }, bob);
    assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
    const loaded = (await call("data", undefined, bob)).data.document;
    assert.equal(loaded.localTools.diceRoom.schema, 7);
    assert.equal(loaded.localTools.diceRoom.tokens[0].currentHp, 4);
    assert.equal(loaded.localTools.diceRoom.tokens[0].sleepTurns, 2);
    assert.equal(loaded.localTools.diceRoom.tokens[0].xp, 9);
    assert.equal(loaded.localTools.diceRoom.benchTokens[0].freezeTurns, 1);
    assert.equal(loaded.localTools.generatorDraft.results[0].pokemon.rpg.scaleVersion, 1);
    assert.equal(loaded.localTools.generatorDraft.results[0].pokemon.rpg.currentHp, 4);
    assert.equal(loaded.localTools.generatorDraft.results[0].pokemon.rpg.xp, 5);
    assert.equal(loaded.localTools.generatorDraft.results[0].pokemon.species.weight, 6.9);
    assert.equal(loaded.localTools.rollHistory[0].total, 5);
    assert.equal(loaded.rollClocks["local-receipt"], 100);
    assert.equal(loaded.tombstones.localRolls["removed-receipt"], 90);
    const invalidTools = [
      { ...tools, credential: "not-an-account-resource" },
      { ...tools, rollHistory: Array.from({ length: 101 }, () => tools.rollHistory[0]) },
      { ...tools, generatorDraft: { results: Array.from({ length: 7 }, () => tools.generatorDraft.results[0]) } },
      { ...tools, diceRoom: { tokens: Array.from({ length: 25 }, () => tools.diceRoom.tokens[0]), benchTokens: [] } },
    ];
    for (const localTools of invalidTools) {
      assert.equal((await call("data", { document: { ...document(), localTools }, expectedRevision: 1 }, bob)).response.status, 400);
    }
    assert.equal((await call("data", undefined, bob)).data.revision, 1, "invalid tool data must leave the saved revision intact");
  });

  await t.test("shared adventures bind verified roles and resume on another device without bearer secrets", async () => {
    const create = await import("../app/api/rooms/route.ts");
    const roomRoute = await import("../app/api/rooms/[code]/route.ts");
    const join = await import("../app/api/rooms/[code]/join/route.ts");
    const roomRequest = (code, key, account, payload, options = {}) => new Request(`https://myowndex.example/api/rooms/${code}`, {
      method: options.method || (payload === undefined ? "GET" : "POST"),
      headers: { origin: "https://myowndex.example", "content-type": "application/json", "x-myowndex-room-protocol": "3", "x-myowndex-room-key": key,
        ...(account ? { cookie: account.cookie, "x-myowndex-account": account.id } : {}), ...options.headers },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const created = await create.POST(roomRequest("", "", null, { title: "Rota Compartilhada", snapshot: { gmNotes: "Nota privada do Narrador" } }));
    assert.equal(created.status, 201); sharedRoom = await created.json();
    const context = { params: Promise.resolve({ code: sharedRoom.code }) };
    const linked = await call("rooms", { code: sharedRoom.code, key: sharedRoom.narratorKey, displayName: "Alice" }, aliceSecond);
    assert.equal(linked.response.status, 201, JSON.stringify(linked.data));
    assert.equal(linked.data.room.key, `account_${aliceSecond.id}`);
    assert.ok(!JSON.stringify(linked.data).includes(sharedRoom.narratorKey));
    assert.equal((await call("rooms", { code: sharedRoom.code, key: sharedRoom.narratorKey }, bob)).response.status, 409);
    assert.equal((await call("rooms", { code: sharedRoom.code, key: linked.data.room.key }, aliceSecond)).response.status, 401);
    const listed = await call("rooms", undefined, aliceSecond);
    assert.equal(listed.data.rooms.length, 1); assert.equal(listed.data.rooms[0].role, "narrator");
    const otherDevice = accountFrom(await call("login", { username: "alice", password: "long-safe-password" }));
    const resumed = await roomRoute.GET(roomRequest(sharedRoom.code, linked.data.room.key, otherDevice), context);
    assert.equal(resumed.status, 200); assert.equal((await resumed.json()).snapshot.gmNotes, "Nota privada do Narrador");
    const forged = await roomRoute.GET(roomRequest(sharedRoom.code, linked.data.room.key, bob), context);
    assert.equal(forged.status, 409);
    const crossSite = await roomRoute.DELETE(roomRequest(sharedRoom.code, linked.data.room.key, otherDevice, undefined, { method: "DELETE", headers: { origin: "https://attacker.example" } }), context);
    assert.equal(crossSite.status, 403); assert.ok(sqlite.prepare("SELECT code FROM rooms WHERE code=?").get(sharedRoom.code));
    const joined = await join.POST(roomRequest(sharedRoom.code, "", null, { inviteCode: sharedRoom.inviteCode, displayName: "Bob" }), context);
    assert.equal(joined.status, 201); const player = await joined.json();
    const playerLinked = await call("rooms", { code: sharedRoom.code, key: player.playerKey }, bob);
    assert.equal(playerLinked.response.status, 201); assert.equal(playerLinked.data.room.role, "player");
    const playerView = await roomRoute.GET(roomRequest(sharedRoom.code, playerLinked.data.room.key, bob), context);
    assert.equal(playerView.status, 200); assert.equal((await playerView.json()).snapshot.gmNotes, undefined);
    const deniedDelete = await roomRoute.DELETE(roomRequest(sharedRoom.code, playerLinked.data.room.key, bob, undefined, { method: "DELETE" }), context);
    assert.equal(deniedDelete.status, 403);
    assert.equal((await call("rooms", { code: sharedRoom.code }, bob, { method: "DELETE" })).response.status, 200);
    assert.equal((await call("rooms", undefined, bob)).data.rooms.length, 0);
    assert.equal((await call("rooms", { code: sharedRoom.code, key: player.playerKey }, bob)).response.status, 201);
    assert.equal((await call("rooms/invite", { code: sharedRoom.code }, bob)).response.status, 403);
    const freshInvite = await call("rooms/invite", { code: sharedRoom.code }, otherDevice);
    assert.equal(freshInvite.response.status, 200); assert.match(freshInvite.data.inviteCode, /^join_/);
    assert.notEqual(freshInvite.data.inviteCode, sharedRoom.inviteCode);
    const oldInvite = await join.POST(roomRequest(sharedRoom.code, "", null, { inviteCode: sharedRoom.inviteCode, displayName: "Old" }), context);
    assert.equal(oldInvite.status, 401);
    const newInvite = await join.POST(roomRequest(sharedRoom.code, "", null, { inviteCode: freshInvite.data.inviteCode, displayName: "New" }), context);
    assert.equal(newInvite.status, 201);
    assert.equal((await roomRoute.GET(roomRequest(sharedRoom.code, playerLinked.data.room.key, bob), context)).status, 200);
    assert.ok(sqlite.prepare("SELECT credential_hash FROM myowndex_account_rooms").all().every(row => /^[a-f0-9]{64}$/.test(row.credential_hash)));
  });

  await t.test("room deletion cascades memberships while invalidated room proofs stop account authorization", async () => {
    const create = await import("../app/api/rooms/route.ts");
    const roomRoute = await import("../app/api/rooms/[code]/route.ts");
    const createRequest = new Request("https://myowndex.example/api/rooms", { method: "POST", headers: { "content-type": "application/json", "x-myowndex-room-protocol": "3" }, body: JSON.stringify({ title: "Sala de teste" }) });
    const room = await (await create.POST(createRequest)).json();
    await call("rooms", { code: room.code, key: room.narratorKey }, aliceSecond);
    sqlite.prepare("UPDATE rooms SET narrator_secret_hash=? WHERE code=?").run("invalidated", room.code);
    assert.ok(!(await call("rooms", undefined, aliceSecond)).data.rooms.some(ref => ref.code === room.code));
    const read = new Request(`https://myowndex.example/api/rooms/${room.code}`, { headers: { cookie: aliceSecond.cookie, "x-myowndex-account": aliceSecond.id, "x-myowndex-room-key": `account_${aliceSecond.id}` } });
    assert.equal((await roomRoute.GET(read, { params: Promise.resolve({ code: room.code }) })).status, 401);
    sqlite.prepare("DELETE FROM rooms WHERE code=?").run(room.code);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM myowndex_account_rooms WHERE room_code=?").get(room.code).count, 0);
  });

  await t.test("password changes atomically revoke sessions and rotate recovery codes", async () => {
    const changed = await call("password", { password: "long-safe-password", newPassword: "the-new-safe-password" }, aliceSecond);
    assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
    const old = aliceSecond; alice = accountFrom(changed);
    assert.equal((await call("session", undefined, old)).data.account, null);
    assert.equal((await call("login", { username: "alice", password: "long-safe-password" })).response.status, 401);
    assert.equal((await call("recover", { username: "alice", recoveryCode: originalCodes[0], newPassword: "another-safe-password" })).response.status, 401);
    assert.equal((await call("session", undefined, alice)).data.account.id, alice.id);
    assert.equal((await call("data", undefined, alice)).data.revision, 2);
  });

  await t.test("one-time recovery races have one winner, revoke sessions and retain account data", async () => {
    const proof = alice.recoveryCodes[0], old = alice;
    const results = await Promise.all([
      call("recover", { username: "alice", recoveryCode: proof, newPassword: "recovered-safe-password" }),
      call("recover", { username: "alice", recoveryCode: proof, newPassword: "recovered-safe-password" }),
    ]);
    assert.deepEqual(results.map(result => result.response.status).sort(), [200, 401]);
    alice = accountFrom(results.find(result => result.response.status === 200));
    assert.equal((await call("session", undefined, old)).data.account, null);
    assert.equal((await call("recover", { username: "alice", recoveryCode: proof, newPassword: "yet-another-password" })).response.status, 401);
    assert.equal((await call("data", undefined, alice)).data.revision, 2);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM myowndex_account_recovery WHERE account_id=?").get(alice.id).count, 8);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM myowndex_account_sessions WHERE account_id=?").get(alice.id).count, 1);
  });

  await t.test("persistent throttles span requests and cleanup removes expired rows", async () => {
    sqlite.prepare("INSERT INTO myowndex_account_limits VALUES(?,1,?)").run("expired", Math.floor(Date.now() / 1000) - 1);
    for (let i = 0; i < 12; i++) await backend.consumeAccountRate(makeRequest("login", {}), "login", "throttled-account");
    await assert.rejects(backend.consumeAccountRate(makeRequest("login", {}), "login", "throttled-account"), error => error.status === 429 && error.retryAfter > 0);
    assert.equal(sqlite.prepare("SELECT bucket FROM myowndex_account_limits WHERE bucket='expired'").get(), undefined);
    assert.ok(sqlite.prepare("SELECT bucket FROM myowndex_account_limits").all().every(row => /^[a-f0-9]{64}$/.test(row.bucket)));
  });

  await t.test("logout removes one session; account deletion cascades only that account", async () => {
    const loggedOut = await call("logout", {}, bob);
    assert.equal(loggedOut.response.status, 200); assert.match(loggedOut.response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal((await call("session", undefined, bob)).data.account, null);
    const login = await call("login", { username: "bob", password: "bobs-safe-password" });
    bob = accountFrom(login);
    assert.equal((await call("delete", { password: "wrong-safe-password" }, bob)).response.status, 401);
    const deleted = await call("delete", { password: "bobs-safe-password" }, bob);
    assert.equal(deleted.response.status, 200); assert.equal(deleted.data.deleted, true);
    for (const table of ["myowndex_accounts", "myowndex_account_documents", "myowndex_account_sessions", "myowndex_account_recovery", "myowndex_account_rooms"]) {
      const column = table === "myowndex_accounts" ? "id" : "account_id";
      assert.equal(sqlite.prepare(`SELECT count(*) AS count FROM ${table} WHERE ${column}=?`).get(bob.id).count, 0);
    }
    assert.equal((await call("data", undefined, alice)).data.revision, 2);
    assert.ok(sqlite.prepare("SELECT code FROM rooms WHERE code=?").get(sharedRoom.code));
    assert.equal((await call("rooms", undefined, alice)).data.rooms.length, 1);
    assert.equal((await call("session", undefined, bob)).data.account, null);
  });
});
