import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlayerInvite,
  buildRoomInviteToken,
  parseRoomInviteValue,
} from "../src/core/roomClient.js";

const session = {
  code: "A2BC3D",
  inviteCode: "join_aBc234XyZ",
};

test("player links always open the Adventure and preserve the private invite in the hash", () => {
  const link = buildPlayerInvite(session, "https://myowndex.vercel.app/?abrir=pc#old=value");
  const url = new URL(link);
  assert.equal(url.searchParams.get("abrir"), "aventura");
  assert.equal(url.hash.includes("aventura=A2BC3D"), true);
  assert.equal(url.hash.includes("convite=join_aBc234XyZ"), true);
  assert.deepEqual(parseRoomInviteValue(link), session);
});

test("the single invite field accepts links, short invitations and old code-key pairs", () => {
  const token = buildRoomInviteToken(session);
  assert.deepEqual(parseRoomInviteValue(token), session);
  assert.deepEqual(parseRoomInviteValue("A2BC3D join_aBc234XyZ"), session);
  assert.deepEqual(parseRoomInviteValue("not an invitation"), null);
});
