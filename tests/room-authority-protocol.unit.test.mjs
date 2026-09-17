import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every shared room mutation carries protocol 3 and authoritative requests retry idempotently", async () => {
  const client = await read("src/core/roomClient.js");
  assert.match(client, /ROOM_PROTOCOL_VERSION = "3"/);
  assert.match(client, /headers\.set\("x-myowndex-room-protocol", ROOM_PROTOCOL_VERSION\)/);
  assert.match(client, /SAFE_REQUEST_METHODS\.has\(method\) \|\| idempotent \? 3 : 1/);
  assert.match(client, /requestRemoteRoomAction[\s\S]*?idempotent: true/);
  assert.match(client, /secureRandomId\("room-action"\)/);
  assert.match(client, /Boolean\(data\?\.retryable\)/);
});

test("old cached clients cannot post official rolls, moves or patch mechanical turn state", async () => {
  const [events, roomRoute, roomServer] = await Promise.all([
    read("app/api/rooms/[code]/events/route.ts"),
    read("app/api/rooms/[code]/route.ts"),
    read("server/rooms.ts"),
  ]);
  assert.doesNotMatch(events, /new Set\(\[[^\]]*"roll"/);
  assert.doesNotMatch(events, /new Set\(\[[^\]]*"move"/);
  assert.match(events, /requireCurrentRoomProtocol\(request\)/);
  assert.match(roomRoute, /roundChanged \|\| \(tokensUnchanged && \(initiativeChanged \|\| turnChanged\)\)/);
  assert.match(roomServer, /status: 426/);
  assert.match(roomServer, /upgradeRequired: true/);
});

test("remote Quick Roller and combat return before any local mechanical RNG", async () => {
  const [room, combat] = await Promise.all([
    read("src/components/Room/RpgRoom.jsx"),
    read("src/components/Room/CombatAssistant.jsx"),
  ]);
  const quick = room.slice(room.indexOf("function QuickRoller"), room.indexOf("function NoteField"));
  assert.match(quick, /if \(local\) return <LocalDicePanel context="aventura"/);
  assert.match(quick, /await onAuthoritativeAction\(/);
  assert.doesNotMatch(quick, /rollAttributeTest|rollPercentTest|performLocalRoll/);
  const resolve = combat.slice(combat.indexOf("const resolve = async"), combat.indexOf("const targetDescription"));
  const localCall = resolve.indexOf("resolveCombatAction({");
  assert.ok(localCall > resolve.indexOf("if (remote)"));
  assert.match(resolve.slice(resolve.indexOf("if (remote)"), localCall), /return;/);
  assert.doesNotMatch(resolve, /calculateMoveResolution|applyMoveConsequences/);
  assert.match(resolve, /resolveInFlight\.current/);
});

test("the durable audit has one idempotency key, a sequence and a transactional state claim", async () => {
  const [schema, migration, route, rooms] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0002_authoritative_rng.sql"),
    read("app/api/rooms/[code]/rolls/route.ts"),
    read("server/rooms.ts"),
  ]);
  for (const source of [schema, migration]) {
    assert.match(source, /room_rolls/);
    assert.match(source, /room_rolls_request_idx/);
    assert.match(source, /server_authoritative/);
  }
  assert.match(route, /INSERT OR IGNORE INTO room_rolls/);
  assert.match(route, /authority_claim = \?/);
  assert.match(route, /status = 'ready'/);
  assert.match(route, /request_fingerprint/);
  assert.match(route, /randomDraws: auditedRandom\.draws/);
  assert.match(route, /snapshotWithServerPriorities/);
  assert.match(rooms, /sequence: roll\.id/);
  assert.match(rooms, /serverAuthoritative: true/);
});

test("shared state actions bind to the canonical room revision across retries and tabs", async () => {
  const [clientRoom, route] = await Promise.all([
    read("src/components/Room/RpgRoom.jsx"),
    read("app/api/rooms/[code]/rolls/route.ts"),
  ]);
  assert.match(clientRoom, /expectedRevision: revisionRef\.current/);
  assert.match(clientRoom, /authoritativeRequestsRef = useRef\(new Map\(\)\)/);
  assert.match(route, /normalized\.expectedRevision !== room\.revision/);
  assert.match(route, /WHERE code = \? AND revision = \?/);
  assert.match(route, /raced\?\.status === "ready"/);
});
