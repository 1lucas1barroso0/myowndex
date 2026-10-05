import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { createRoomSnapshot } from "../src/core/room.js";
import { createHranaFixture } from "./helpers/hrana-server.mjs";

test("a completed concurrent retry returns its original receipt before rejecting a stale revision", async t => {
  const fixture = await createHranaFixture({ port: 0 });
  const previous = { fetch: globalThis.fetch, url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN };
  process.env.TURSO_DATABASE_URL = fixture.url;
  process.env.TURSO_AUTH_TOKEN = "qa-only";
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) { if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error; return nextResolve(`${specifier}.ts`, context); }
  } });
  let raceArmed = false, winner = null, completeConcurrentCopy;
  const requestId = "revision-race-retry-0001";
  globalThis.fetch = async (url, options) => {
    const response = await previous.fetch(url, options);
    if (!raceArmed || !String(url).startsWith(fixture.url)) return response;
    const pipeline = JSON.parse(options.body);
    const receiptLookup = pipeline.requests.flatMap(entry => entry.batch?.steps || []).find(step =>
      /SELECT id, request_id[\s\S]*FROM room_rolls/.test(step.stmt.sql)
      && step.stmt.args?.[2]?.value === requestId);
    if (!receiptLookup) return response;
    raceArmed = false;
    const emptyLookup = await response.clone().json();
    assert.equal(emptyLookup.results[0].response.result.step_results[0].rows.length, 0);
    // The first SQL read is genuinely empty. Finish the other production POST
    // before this POST can read the room revision; no timing/sleep is involved.
    winner = await completeConcurrentCopy();
    return response;
  };
  t.after(async () => {
    globalThis.fetch = previous.fetch;
    hooks.deregister();
    await fixture.close();
    for (const [key, value] of [["TURSO_DATABASE_URL", previous.url], ["TURSO_AUTH_TOKEN", previous.token]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const server = await import("../server/rooms.ts");
  const rolls = await import("../app/api/rooms/[code]/rolls/route.ts");
  await server.ensureRoomSchema();
  const code = "RACE77", key = "narrator-race-qa";
  fixture.sqlite.prepare("INSERT INTO rooms (code, title, narrator_secret_hash, invite_secret_hash, state_json) VALUES (?, ?, ?, ?, ?)")
    .run(code, "Batalha QA", await server.hashSecret(key), "invite", JSON.stringify({ ...createRoomSnapshot("Batalha QA"), gmNotes: "Privado" }));
  const context = { params: Promise.resolve({ code }) };
  const call = async body => {
    const response = await rolls.POST(new Request(`http://localhost/api/rooms/${code}/rolls`, {
      method: "POST", headers: { "content-type": "application/json", "x-myowndex-room-key": key, "x-myowndex-room-protocol": "3" },
      body: JSON.stringify(body),
    }), context);
    return { status: response.status, data: await response.json() };
  };
  const action = { requestId, action: "start-battle", expectedRevision: 0 };
  completeConcurrentCopy = () => call(action);
  raceArmed = true;
  const replay = await call(action);
  assert.equal(winner?.status, 200);
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.data.result, winner.data.result);
  assert.equal(replay.data.room.revision, 1);
  assert.deepEqual(replay.data.result.audit.randomDraws, []);
  assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM room_rolls WHERE room_code = ?").get(code).count, 1);
  const staleDifferentRequest = await call({ ...action, requestId: "revision-race-different-0002" });
  assert.equal(staleDifferentRequest.status, 409);
  assert.equal(staleDifferentRequest.data.conflict, true);
  const reusedForAnotherPayload = await call({ ...action, action: "advance-turn" });
  assert.equal(reusedForAnotherPayload.status, 409);
  assert.match(reusedForAnotherPayload.data.error, /identificador/);
  assert.equal(fixture.sqlite.prepare("SELECT revision FROM rooms WHERE code = ?").get(code).revision, 1);
  assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM room_rolls WHERE room_code = ?").get(code).count, 1);
});
