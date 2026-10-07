import assert from "node:assert/strict";
import test from "node:test";
import {
  CALL_ICE_SERVERS,
  getCallIceServers,
  callHasTurnRelay,
  callParticipantId,
  callPeerConfiguration,
  createCallConnectionId,
  normalizeCallMembers,
  shouldCreateCallOffer,
  shouldRestartCallIce,
} from "../src/core/call.js";

test("each participant and browser connection receives a stable call identity", () => {
  assert.equal(callParticipantId({ role: "narrator", playerId: "ignored" }), "narrator");
  assert.equal(callParticipantId({ role: "player", playerId: " player-25 " }), "player-25");
  assert.equal(callParticipantId({ role: "player" }), "");
  assert.notEqual(createCallConnectionId(), createCallConnectionId());
});

test("exactly one peer starts each voice connection", () => {
  assert.equal(shouldCreateCallOffer("narrator", "player-1"), true);
  assert.equal(shouldCreateCallOffer("player-1", "narrator"), false);
  assert.equal(shouldCreateCallOffer("same", "same"), false);
});

test("call members are humanized, deduplicated and ordered with the narrator first", () => {
  const members = normalizeCallMembers([
    { participantId: "player-b", displayName: " Bianca ", role: "player", muted: 1 },
    { participantId: "narrator", displayName: "", role: "narrator" },
    { participantId: "player-a", displayName: "Alex", role: "player" },
    { participantId: "player-a", displayName: "Alex atualizado", role: "player" },
    { displayName: "Sem identificação" },
  ]);
  assert.deepEqual(members.map(member => [member.participantId, member.displayName, member.muted]), [
    ["narrator", "Narrador", false],
    ["player-a", "Alex atualizado", false],
    ["player-b", "Bianca", true],
  ]);
  assert.equal(CALL_ICE_SERVERS[0].urls[0], "stun:stun.cloudflare.com:3478");
});

test("custom TURN servers preserve credentials and malformed configuration keeps usable defaults", () => {
  const servers = [{ urls: ["turn:relay.example.com:3478"], username: "trainer", credential: "turn-only-password" }];
  assert.deepEqual(getCallIceServers(JSON.stringify(servers)), servers);
  assert.deepEqual(getCallIceServers("broken-json"), getCallIceServers(""));
  assert.deepEqual(getCallIceServers('[{"urls":"https://wrong.example.com"}]'), getCallIceServers(""));
});


test("voice peers use a pooled ICE configuration and restart broken routes", () => {
  const config = callPeerConfiguration();
  assert.equal(config.iceCandidatePoolSize, 4);
  assert.equal(config.bundlePolicy, "max-bundle");
  assert.equal(config.rtcpMuxPolicy, "require");
  assert.ok(config.iceServers[0].urls.includes("stun:stun.cloudflare.com:3478"));
  assert.ok(config.iceServers[0].urls.includes("stun:stun.l.google.com:19302"));
  assert.equal(callHasTurnRelay(config.iceServers), false);
  assert.equal(callHasTurnRelay([{ urls: ["stun:relay.example", "turn:relay.example:3478"] }]), true);
  assert.equal(shouldRestartCallIce("failed"), true);
  assert.equal(shouldRestartCallIce("disconnected"), true);
  assert.equal(shouldRestartCallIce("connected"), false);
});
