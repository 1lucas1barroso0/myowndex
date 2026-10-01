import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlayerInvite,
  buildRoomInviteToken,
  parseRoomInviteValue,
  uploadRoomAudio,
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

test("audio uploads go directly to storage and confirm through authenticated small JSON requests", async t => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout, clearTimeout };
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; });
  const file = new File(["audio-bytes"], "rota.ogg", { type: "audio/ogg" });
  const progress = [], calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    if (calls.length === 1) return Response.json({ uploadUrl: "https://storage.example.com/signed", uploadToken: "proof", headers: { "content-type": "audio/ogg" } });
    if (calls.length === 2) return new Response(null, { status: 200 });
    return Response.json({ media: { id: "audio-1" } });
  };
  const result = await uploadRoomAudio({ code: "ABC234", key: "private-room-key" }, file, "Rota 1", value => progress.push(value));
  assert.equal(result.media.id, "audio-1");
  assert.equal(JSON.parse(calls[0].options.body).action, "prepare");
  assert.equal(calls[0].options.headers.get("x-myowndex-room-key"), "private-room-key");
  assert.equal(calls[1].path, "https://storage.example.com/signed");
  assert.equal(calls[1].options.body, file);
  assert.equal(new Headers(calls[1].options.headers).has("x-myowndex-room-key"), false);
  assert.equal(new Headers(calls[1].options.headers).has("authorization"), false);
  assert.equal(JSON.parse(calls[2].options.body).action, "complete");
  assert.equal(JSON.parse(calls[2].options.body).uploadToken, "proof");
  assert.equal(progress.at(-1), 1);
});

test("a failed direct upload does not create media metadata", async t => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout, clearTimeout };
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; });
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ uploadUrl: "https://storage.example.com/signed", uploadToken: "proof", headers: {} })
    : new Response(null, { status: 403 });
  await assert.rejects(uploadRoomAudio({ code: "ABC234", key: "private-room-key" }, new File(["bytes"], "rota.ogg", { type: "audio/ogg" }), "Rota"), /Não foi possível enviar/);
  assert.equal(calls, 2);
});
