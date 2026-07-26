import assert from "node:assert/strict";

const baseUrl = process.env.MYOWNDEX_SMOKE_URL;
if (!baseUrl) throw new Error("MYOWNDEX_SMOKE_URL is required.");

const request = async (path, { key = "", body, ...options } = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (key) headers.set("x-myowndex-room-key", key);
  if (body && !(body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${data.error || "request failed"}`);
  return data;
};

let session = null;
try {
  const created = await request("/api/rooms", {
    method: "POST",
    body: {
      title: "Teste automatizado",
      narratorName: "Narrador QA",
      snapshot: {
        schema: 1,
        title: "Teste automatizado",
        phase: "exploracao",
        round: 1,
        turnIndex: 0,
        scenario: "rota",
        weather: "limpo",
        sceneNotes: "Visível",
        gmNotes: "Privado",
        tokens: [],
        initiative: [],
        audio: { trackId: null, title: "", playing: false, volume: 0.55, startedAt: 0 },
        settings: { showHp: true, allowPlayerMovement: false, mirrorSprites: true },
      },
    },
  });
  session = { code: created.code, key: created.narratorKey };
  assert.equal(created.role, "narrator");
  assert.match(created.code, /^[A-Z0-9]{6}$/);

  const narratorView = await request(`/api/rooms/${created.code}`, { key: created.narratorKey });
  assert.equal(narratorView.role, "narrator");
  assert.equal(narratorView.snapshot.gmNotes, "Privado");

  const joined = await request(`/api/rooms/${created.code}/join`, {
    method: "POST",
    body: { displayName: "Jogador QA", inviteCode: created.inviteCode },
  });
  assert.equal(joined.role, "player");

  const playerView = await request(`/api/rooms/${created.code}`, { key: joined.playerKey });
  assert.equal(playerView.role, "player");
  assert.equal(Object.prototype.hasOwnProperty.call(playerView.snapshot, "gmNotes"), false);

  const beforeToken = await request(`/api/rooms/${created.code}`, { key: created.narratorKey });
  await request(`/api/rooms/${created.code}`, {
    method: "PATCH",
    key: created.narratorKey,
    body: {
      expectedRevision: beforeToken.revision,
      snapshot: {
        ...beforeToken.snapshot,
        tokens: [{
          id: "token-qa",
          ownerPlayerId: joined.playerId,
          name: "Pikachu QA",
          moves: ["quick-attack", "", "", ""],
          maxHp: 5,
          currentHp: 5,
        }],
      },
    },
  });
  await request(`/api/rooms/${created.code}/events`, {
    method: "POST",
    key: joined.playerKey,
    body: {
      type: "move-declared",
      payload: { tokenId: "token-qa", moveName: "quick-attack", priority: 1 },
    },
  });
  const afterDeclaration = await request(`/api/rooms/${created.code}`, { key: created.narratorKey });
  assert.equal(afterDeclaration.snapshot.tokens[0].declaredMove, "quick-attack");
  assert.equal(afterDeclaration.snapshot.tokens[0].priority, 1);
  assert.ok(afterDeclaration.events.some(event => event.type === "move-declared"));

  await request(`/api/rooms/${created.code}/events`, {
    method: "POST",
    key: joined.playerKey,
    body: { type: "ready", payload: { ready: true } },
  });
  const afterReady = await request(`/api/rooms/${created.code}`, { key: created.narratorKey });
  assert.equal(afterReady.players[0].ready, true);

  const updatedSnapshot = {
    ...afterReady.snapshot,
    round: 2,
    sceneNotes: "Estado atualizado",
  };
  const updated = await request(`/api/rooms/${created.code}`, {
    method: "PATCH",
    key: created.narratorKey,
    body: { expectedRevision: afterReady.revision, snapshot: updatedSnapshot },
  });
  assert.equal(updated.revision, afterReady.revision + 1);
  assert.equal(updated.snapshot.round, 2);
  assert.ok(updated.events.some(event => event.type === "ready"));

  console.log("Central da Aventura API: create, authorize, join, redact, declaration, event, sync and update passed.");
} finally {
  if (session) {
    await request(`/api/rooms/${session.code}`, {
      method: "DELETE",
      key: session.key,
    }).catch(() => {});
  }
}
