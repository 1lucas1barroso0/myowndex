import assert from "node:assert/strict";
import { addTeamToSnapshot, createRoomSnapshot } from "../src/core/room.js";
import { normalizeTeam, STAT_KEYS } from "../src/core/team.js";
import { consumeHeldItem, restoreHeldItem } from "../src/core/traitMechanics.js";

const baseUrl = process.env.MYOWNDEX_SMOKE_URL;
if (!baseUrl) throw new Error("MYOWNDEX_SMOKE_URL is required.");
const host = new URL(baseUrl).hostname;
if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(host)) throw new Error("Run this isolated room test only on a local QA server.");
const request = async (path, { key = "", body, ...options } = {}) => {
    const response = await fetch(new URL(path, baseUrl), { ...options, headers: {
        "content-type": "application/json", "x-myowndex-room-protocol": "3", "x-myowndex-room-key": key,
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
};
const team = normalizeTeam({ id: "item-api-box", shareId: "item-api-share", name: "Itens QA", pokemon: [{
    id: "item-api-partner", item: "focus-sash", level: 10, moves: ["tackle"],
    species: { id: 16, name: "pidgey", species: { name: "pidgey" },
        stats: STAT_KEYS.map(name => ({ stat: { name }, base_stat: 50 })), types: [{ type: { name: "normal" } }] },
    rpg: { scaleVersion: 2 },
}] });
const initial = addTeamToSnapshot(createRoomSnapshot("Itens QA"), team, "ally").room;
const consumed = consumeHeldItem(initial.tokens[0], { round: 1 }).token;
let session;
try {
    const created = await request("/api/rooms", { method: "POST", body: { title: "Itens QA", narratorName: "Narrador QA",
        snapshot: { ...initial, tokens: [consumed] } } });
    assert.equal(created.status, 201);
    session = { code: created.data.code, key: created.data.narratorKey };
    const path = `/api/rooms/${session.code}`;
    let current = (await request(path, { key: session.key })).data;
    assert.equal(current.snapshot.tokens[0].traitState.item.origin.teamId, team.id);
    assert.equal(current.snapshot.tokens[0].traitState.item.consumed, true);

    const harmless = { ...current.snapshot.tokens[0], currentHp: 1 }; delete harmless.traitState;
    const edited = await request(path, { method: "PATCH", key: session.key,
        body: { expectedRevision: current.revision, snapshot: { ...current.snapshot, tokens: [harmless] } } });
    assert.equal(edited.status, 200);
    current = edited.data;
    assert.equal(current.snapshot.tokens[0].traitState.item.origin.teamId, team.id, "cached HP edits preserve the additive item origin");
    assert.equal(current.snapshot.tokens[0].traitState.item.consumed, true);

    for (const token of [
        { ...current.snapshot.tokens[0], item: "focus-sash" },
        { ...current.snapshot.tokens[0], item: "focus-sash", traitState: {} },
        { ...current.snapshot.tokens[0], traitState: {} },
    ]) {
        const forged = await request(path, { method: "PATCH", key: session.key,
            body: { expectedRevision: current.revision, snapshot: { ...current.snapshot, tokens: [token] } } });
        assert.equal(forged.status, 409);
        assert.match(forged.data.error, /Restaurar item/);
    }
    const restored = restoreHeldItem(current.snapshot.tokens[0], { round: 1 }).token;
    const accepted = await request(path, { method: "PATCH", key: session.key,
        body: { expectedRevision: current.revision, snapshot: { ...current.snapshot, tokens: [restored] } } });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.snapshot.tokens[0].item, "focus-sash");
    assert.equal(accepted.data.snapshot.tokens[0].traitState.item.origin.sequence, 2);
    assert.equal(accepted.data.snapshot.tokens[0].traitState.item.consumed, false);
    console.log("Item API: origin preservation, three forged resets rejected and explicit restoration passed.");
} finally {
    if (session) {
        const deleted = await request(`/api/rooms/${session.code}`, { method: "DELETE", key: session.key });
        assert.equal(deleted.status, 200);
    }
}
