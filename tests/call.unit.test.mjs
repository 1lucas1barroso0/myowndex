import assert from "node:assert/strict";
import test from "node:test";
import {
  CALL_ICE_SERVERS,
  callParticipantId,
  createCallConnectionId,
  normalizeCallMembers,
  shouldCreateCallOffer,
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
