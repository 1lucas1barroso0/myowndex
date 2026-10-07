import assert from "node:assert/strict";

const baseUrl = process.env.MYOWNDEX_SMOKE_URL;
if (!baseUrl) throw new Error("MYOWNDEX_SMOKE_URL is required.");

const request = async (path, { key = "", body, protocol = "3", ...options } = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set("accept", "application/json");
  if (protocol) headers.set("x-myowndex-room-protocol", protocol);
  if (key) headers.set("x-myowndex-room-key", key);
  if (body && !(body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${response.status}: ${data.error || "request failed"}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

let session = null;
try {
  await assert.rejects(
    request("/api/rooms", {
      method: "POST",
      protocol: "",
      body: { title: "Cliente antigo", narratorName: "PWA antigo", snapshot: {} },
    }),
    error => error.status === 426 && error.data.upgradeRequired === true && error.data.protocol === "3",
  );

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
        tokens: [
          {
            id: "token-qa",
            ownerPlayerId: joined.playerId,
            name: "Pikachu QA",
            side: "ally",
            moves: ["quick-attack", "", "", ""],
            types: ["electric"],
            maxHp: 5,
            currentHp: 5,
            level: 10,
            stats: { attack: 3, defense: 2, "special-attack": 3, "special-defense": 2, speed: 5 },
          },
          {
            id: "target-qa",
            name: "Alvo QA",
            side: "opponent",
            moves: ["tackle", "", "", ""],
            types: ["normal"],
            maxHp: 8,
            currentHp: 8,
            level: 10,
            stats: { attack: 2, defense: 2, "special-attack": 2, "special-defense": 2, speed: 2 },
          },
        ],
      },
    },
  });
  await request(`/api/rooms/${created.code}/events`, {
    method: "POST",
    key: joined.playerKey,
    body: {
      type: "move-declared",
      payload: { tokenId: "token-qa", moveName: "quick-attack", priority: -7 },
    },
  });
  const afterDeclaration = await request(`/api/rooms/${created.code}`, { key: created.narratorKey });
  assert.equal(afterDeclaration.snapshot.tokens[0].declaredMove, "quick-attack");
  assert.equal(afterDeclaration.snapshot.tokens[0].priority, 1, "declarations ignore a forged priority and confirm the official move");
  assert.ok(afterDeclaration.events.some(event => event.type === "move-declared"));

  await request(`/api/rooms/${created.code}/events`, {
    method: "POST",
    key: joined.playerKey,
    body: { type: "ready", payload: { ready: true } },
  });
  const afterReady = await request(`/api/rooms/${created.code}`, { key: created.narratorKey });
  assert.equal(afterReady.players[0].ready, true);

  const rollRequestId = `smoke-roll-${Date.now()}`;
  const firstRoll = await request(`/api/rooms/${created.code}/rolls`, {
    method: "POST",
    key: joined.playerKey,
    body: { requestId: rollRequestId, action: "quick-attribute", mode: "advantage", attribute: 3 },
  });
  const repeatedRoll = await request(`/api/rooms/${created.code}/rolls`, {
    method: "POST",
    key: joined.playerKey,
    body: { requestId: rollRequestId, action: "quick-attribute", mode: "advantage", attribute: 3 },
  });
  assert.equal(firstRoll.result.id, repeatedRoll.result.id);
  assert.deepEqual(firstRoll.result.result, repeatedRoll.result.result);
  assert.equal(firstRoll.result.serverAuthoritative, true);
  assert.equal(firstRoll.result.audit.rawDice.length, 3);
  assert.equal(firstRoll.room.rolls.filter(roll => roll.requestId === rollRequestId).length, 1);

  await assert.rejects(
    request(`/api/rooms/${created.code}/rolls`, {
      method: "POST",
      key: joined.playerKey,
      body: { requestId: rollRequestId, action: "quick-attribute", mode: "normal", attribute: 3 },
    }),
    error => error.status === 409,
  );

  await assert.rejects(
    request(`/api/rooms/${created.code}/rolls`, {
      method: "POST",
      key: joined.playerKey,
      body: { requestId: `smoke-forged-${Date.now()}`, action: "quick-percent", mode: "normal", chance: 50, result: 1 },
    }),
    error => error.status === 400,
  );
  await assert.rejects(
    request(`/api/rooms/${created.code}/events`, {
      method: "POST",
      key: joined.playerKey,
      body: { type: "roll", payload: { dice: [6, 6], result: 12 } },
    }),
    error => error.status === 403,
  );

  const initiativeRequest = {
    requestId: `smoke-initiative-${Date.now()}`,
    action: "initiative",
    expectedRevision: afterReady.revision,
  };
  const [initiative, repeatedInitiative] = await Promise.all([
    request(`/api/rooms/${created.code}/rolls`, {
      method: "POST",
      key: created.narratorKey,
      body: initiativeRequest,
    }),
    request(`/api/rooms/${created.code}/rolls`, {
      method: "POST",
      key: created.narratorKey,
      body: initiativeRequest,
    }),
  ]);
  assert.equal(initiative.result.serverAuthoritative, true);
  assert.equal(initiative.result.id, repeatedInitiative.result.id);
  assert.deepEqual(initiative.result.result, repeatedInitiative.result.result);
  assert.equal(initiative.room.revision, repeatedInitiative.room.revision);
  assert.equal(initiative.room.snapshot.tokens[0].priority, 1);
  assert.equal(initiative.room.snapshot.initiative.length, 2);

  await assert.rejects(request(`/api/rooms/${created.code}/events`, {
    method: "POST", key: joined.playerKey,
    body: { type: "move-declared", payload: { tokenId: "token-qa", moveName: "quick-attack", priority: 7 } },
  }), error => error.status === 409);
  await assert.rejects(request(`/api/rooms/${created.code}/rolls`, {
    method: "POST", key: created.narratorKey,
    body: { requestId: `smoke-reroll-${Date.now()}`, action: "initiative", expectedRevision: initiative.room.revision },
  }), error => error.status === 409);

  const combat = await request(`/api/rooms/${created.code}/rolls`, {
    method: "POST",
    key: created.narratorKey,
    body: {
      requestId: `smoke-combat-${Date.now()}`,
      action: "combat",
      expectedRevision: initiative.room.revision,
      attackerId: "token-qa",
      defenderId: "target-qa",
      moveName: "quick-attack",
      calledMoveName: "",
      mode: "normal",
    },
  });
  assert.equal(combat.result.serverAuthoritative, true);
  assert.equal(combat.result.audit.type, "combat");
  assert.ok(combat.room.events.some(event => event.id === combat.result.id && event.type === "move"));

  assert.equal(combat.room.snapshot.tokens[0].declaredMove, "quick-attack", "the selected action remains visible until round end");
  await assert.rejects(request(`/api/rooms/${created.code}/rolls`, {
    method: "POST", key: created.narratorKey,
    body: { requestId: `smoke-repeat-action-${Date.now()}`, action: "combat", expectedRevision: combat.room.revision, attackerId: "token-qa", defenderId: "target-qa", moveName: "quick-attack", mode: "normal" },
  }), error => error.status === 409);

  await assert.rejects(
    request(`/api/rooms/${created.code}`, {
      method: "PATCH",
      key: created.narratorKey,
      body: {
        expectedRevision: combat.room.revision,
        snapshot: { ...combat.room.snapshot, round: combat.room.snapshot.round + 1 },
      },
    }),
    error => error.status === 403 && error.data.serverAuthoritative === true,
  );

  const updatedSnapshot = {
    ...combat.room.snapshot,
    sceneNotes: "Estado atualizado",
  };
  const updated = await request(`/api/rooms/${created.code}`, {
    method: "PATCH",
    key: created.narratorKey,
    body: { expectedRevision: combat.room.revision, snapshot: updatedSnapshot },
  });
  assert.equal(updated.revision, combat.room.revision + 1);
  assert.equal(updated.snapshot.sceneNotes, "Estado atualizado");
  assert.ok(updated.events.some(event => event.type === "ready"));

  await assert.rejects(request(`/api/rooms/${created.code}/rolls`, {
    method: "POST", key: joined.playerKey,
    body: { requestId: `smoke-player-newbattle-${Date.now()}`, action: "start-battle", expectedRevision: updated.revision },
  }), error => error.status === 403);
  await assert.rejects(request(`/api/rooms/${created.code}/rolls`, {
    method: "POST", key: created.narratorKey,
    body: { requestId: `smoke-active-newbattle-${Date.now()}`, action: "start-battle", expectedRevision: updated.revision },
  }), error => error.status === 409);
  await assert.rejects(request(`/api/rooms/${created.code}`, {
    method: "PATCH", key: created.narratorKey,
    body: { expectedRevision: updated.revision, snapshot: { ...updated.snapshot, battleStarted: false, phase: "exploracao" } },
  }), error => error.status === 409 && error.data.serverAuthoritative === true);

  let closed = updated;
  while (closed.snapshot.initiative.length) {
    const advanced = await request(`/api/rooms/${created.code}/rolls`, {
      method: "POST", key: created.narratorKey,
      body: { requestId: `smoke-next-${Date.now()}-${closed.revision}`, action: "advance-turn", expectedRevision: closed.revision },
    });
    closed = advanced.room;
  }
  assert.equal(closed.snapshot.battleStarted, true);
  assert.equal(closed.snapshot.round, 2);
  await assert.rejects(request(`/api/rooms/${created.code}/rolls`, {
    method: "POST", key: created.narratorKey,
    body: { requestId: `smoke-between-rounds-${Date.now()}`, action: "combat", expectedRevision: closed.revision,
      attackerId: "token-qa", defenderId: "target-qa", moveName: "quick-attack", mode: "normal" },
  }), error => error.status === 409);

  const protectionKey = "token:token-qa";
  const marked = await request(`/api/rooms/${created.code}`, {
    method: "PATCH", key: created.narratorKey,
    body: { expectedRevision: closed.revision, snapshot: { ...closed.snapshot, hitKillProtectionUsed: [protectionKey] } },
  });
  await assert.rejects(request(`/api/rooms/${created.code}`, {
    method: "PATCH", key: created.narratorKey,
    body: { expectedRevision: marked.revision, snapshot: { ...marked.snapshot, phase: "exploracao", hitKillProtectionUsed: [] } },
  }), error => error.status === 409);
  const newBattleRequest = { requestId: `smoke-newbattle-${Date.now()}`, action: "start-battle", expectedRevision: marked.revision };
  const [newBattle, repeatedBattle] = await Promise.all([1, 2].map(() => request(`/api/rooms/${created.code}/rolls`, {
    method: "POST", key: created.narratorKey, body: newBattleRequest,
  })));
  assert.equal(newBattle.result.id, repeatedBattle.result.id);
  assert.equal(newBattle.room.revision, repeatedBattle.room.revision);
  assert.deepEqual(newBattle.result.audit.randomDraws, []);
  assert.equal(newBattle.room.snapshot.round, 1);
  assert.equal(newBattle.room.snapshot.battleStarted, true);
  assert.deepEqual(newBattle.room.snapshot.hitKillProtectionUsed, []);
  for (const previous of marked.snapshot.tokens) {
    const actor = newBattle.room.snapshot.tokens.find(token => token.id === previous.id);
    for (const key of ["currentHp", "pp", "status", "xp", "friendship", "item"]) assert.deepEqual(actor[key], previous[key]);
    assert.equal(actor.lastActionRound, 0);
    assert.equal(actor.declaredMove, "");
  }

  console.log("Central da Aventura API: auth, authoritative RNG, idempotency, combat, battle lifecycle, audit and sync passed.");
} finally {
  if (session) {
    await request(`/api/rooms/${session.code}`, {
      method: "DELETE",
      key: session.key,
    }).catch(() => {});
  }
}
