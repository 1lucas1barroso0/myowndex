import assert from "node:assert/strict";
import test from "node:test";
import {
    ACCOUNT_DOCUMENT_LIMIT, accountContentEqual, accountDocumentBytes, accountValuesEqual, importGuestDocument,
    mergeAccountDocuments, normalizeAccountDocument, rebaseLiveAccountDocument, recordAccountChanges,
} from "../src/core/accountDocument.js";
import { AccountRequestError, accountLogoutComplete, accountRequest } from "../src/core/accountClient.js";
import { normalizeAccountXpDocument } from "../src/core/accountXp.js";
import { normalizeRoomSnapshot, ROOM_SCHEMA_VERSION } from "../src/core/room.js";
import { RPG_SCALE_VERSION } from "../src/core/team.js";
import { performLocalRoll } from "../src/core/localRolls.js";
import { registerLocalPokemonDiceWrites } from "../src/core/localPokemonRolls.js";
import { captureAccountDocument } from "../src/components/Account/useAccountSync.js";

const box = (id, name, updatedAt = 10) => ({ id, shareId: id, name, updatedAt, pokemon: [] });
const document = value => normalizeAccountDocument(value);

test("account documents never include live room credentials and retain game mode", () => {
    const saved = document({ preferences: { experienceMode: "game", appearance: "night" }, roomSession: { key: "gm_private" } });
    assert.equal(saved.preferences.experienceMode, "game");
    assert.equal(saved.roomSession, null);
    assert.ok(accountDocumentBytes(saved) < ACCOUNT_DOCUMENT_LIMIT);
});

test("sync metadata updates leave open controls intact while every changed game resource remains visible", () => {
    const baseline = document({ boxes: [box("a", "Equipe")], dex: { favorites: ["25"] },
        localAdventure: { title: "Aventura" }, localTools: { dicePreferences: { kind: "free", sides: 12, quantity: 3, modifier: 4 } } });
    const metadata = document({ ...baseline, clocks: { ...baseline.clocks, "localTools.dicePreferences": 20 },
        tombstones: { ...baseline.tombstones, boxes: { old: 10 }, localRolls: { removed: 15 } }, rollClocks: { receipt: 11 } });
    assert.equal(accountValuesEqual(baseline, metadata), false, "clocks must still be persisted");
    assert.equal(accountContentEqual(baseline, metadata), true, "metadata never resets an open form");
    for (const changed of [
        { boxes: [box("a", "Equipe em outro dispositivo")] },
        { dex: { favorites: ["25", "133"] } },
        { preferences: { ...baseline.preferences, appearance: "night" } },
        { localAdventure: { title: "Cena recebida" } },
        { localTools: { ...baseline.localTools, dicePreferences: { kind: "free", sides: 20, quantity: 3, modifier: 4 } } },
    ]) assert.equal(accountContentEqual(baseline, document({ ...baseline, ...changed })), false);
});

test("live editor rebasing preserves late Box edits, additions and removals while receiving independent cloud changes", () => {
    const baseline = document({ boxes: [box("a", "A", 10), box("b", "B", 10)] });
    const incoming = recordAccountChanges(baseline, { boxes: [box("a", "A", 10), box("b", "B na nuvem", 20), box("c", "C na nuvem", 20)] }, 20);
    const edited = rebaseLiveAccountDocument({ boxes: [box("a", "A ainda sendo digitada", 30), box("b", "B", 10), box("d", "Nova Box local", 30)] }, incoming, baseline);
    assert.deepEqual(edited.boxes.map(entry => entry.name).sort(), ["A ainda sendo digitada", "B na nuvem", "C na nuvem", "Nova Box local"].sort());
    const removed = rebaseLiveAccountDocument({ boxes: [box("b", "B", 10)] }, incoming, baseline);
    assert.deepEqual(removed.boxes.map(entry => entry.id).sort(), ["b", "c"]);
    const cloudRemoved = recordAccountChanges(baseline, { boxes: [box("b", "B", 10)] }, 40);
    const recovered = rebaseLiveAccountDocument({ boxes: [box("a", "Última edição preservada", 30), box("b", "B", 10)] }, cloudRemoved, baseline);
    assert.equal(recovered.boxes.length, 2);
    assert.ok(recovered.boxes.some(entry => /Última edição preservada.*cópia recuperada/.test(entry.name)));
});

test("partial live preferences and favorites rebase without resetting unrelated fields or restoring deleted favorites", () => {
    const baseline = document({ preferences: { experienceMode: "rpg", appearance: "normal", view: "teambuilder" }, dex: { favorites: ["1", "25"] } });
    const incoming = recordAccountChanges(baseline, { preferences: { ...baseline.preferences, appearance: "night" }, dex: { favorites: ["1", "25", "133"] } }, 20);
    const mode = rebaseLiveAccountDocument({ preferences: { experienceMode: "game" } }, incoming, baseline);
    assert.deepEqual(mode.preferences, { experienceMode: "game", appearance: "night", view: "teambuilder" });
    const favorites = rebaseLiveAccountDocument({ dex: { favorites: ["25"] } }, incoming, baseline);
    assert.deepEqual(favorites.dex.favorites, ["25", "133"]);
    assert.equal(favorites.preferences.appearance, "night");
    assert.deepEqual(rebaseLiveAccountDocument({ boxes: [] }, incoming, null), incoming,
        "initial authentication receives its authoritative document without an invented baseline");
});

test("a newer hydration-only timestamp never replaces a real remote Box edit", () => {
    const partner = { id: "pika", nickname: "Parceiro", species: { name: "pikachu" },
        level: 5, rpg: { scaleVersion: RPG_SCALE_VERSION, currentHp: 1 } };
    const baseline = document({ boxes: [{ ...box("a", "Equipe", 10), pokemon: [partner] }] });
    const hydrated = document({ boxes: [{ ...baseline.boxes[0], updatedAt: 100,
        pokemon: [{ ...baseline.boxes[0].pokemon[0], species: { name: "pikachu", id: 25,
            stats: [{ base_stat: 35, stat: { name: "hp" } }], types: [{ type: { name: "electric" } }] } }] }] });
    const incoming = recordAccountChanges(baseline, { boxes: [{ ...baseline.boxes[0], name: "Nome editado remotamente", updatedAt: 20 }] }, 20);
    const merged = rebaseLiveAccountDocument({ boxes: hydrated.boxes }, incoming, baseline);
    assert.equal(merged.boxes.length, 1, "catalog enrichment never creates a competing recovery Box");
    assert.equal(merged.boxes[0].name, "Nome editado remotamente");
    assert.equal(merged.boxes[0].pokemon[0].nickname, "Parceiro");
});

test("an unconfirmed Pokémon field save prevents uploading an incomplete account capture", async () => {
    const unregister = registerLocalPokemonDiceWrites(async () => false);
    try {
        await assert.rejects(captureAccountDocument("trainer-field-failure"), /última edição dos dados locais.*cópia anterior.*preservados/);
    } finally { unregister(); }
});

test("different Boxes merge and deletion tombstones prevent stale resurrection", () => {
    const base = document({ boxes: [box("a", "A"), box("b", "B")] });
    const local = recordAccountChanges(base, { boxes: [box("a", "A2", 30)] }, 40);
    const remote = recordAccountChanges(base, { boxes: [box("a", "A"), box("b", "B"), box("c", "C", 20)] }, 21);
    const merged = mergeAccountDocuments(local, remote, base).document;
    assert.deepEqual(merged.boxes.map(entry => entry.id).sort(), ["a", "c"]);
    assert.equal(merged.boxes.find(entry => entry.id === "a").name, "A2");
    assert.ok(merged.tombstones.boxes.b >= 40);
    assert.deepEqual(mergeAccountDocuments(merged, remote, base).document.boxes.map(entry => entry.id).sort(), ["a", "c"]);
});

test("competing edits to one Box preserve both as an explicit recovery copy", () => {
    const base = document({ boxes: [box("a", "Equipe", 10)] });
    const local = document({ boxes: [box("a", "Alteração local", 20)] });
    const remote = document({ boxes: [box("a", "Alteração remota", 30)] });
    const merged = mergeAccountDocuments(local, remote, base).document;
    assert.equal(merged.boxes.length, 2);
    assert.equal(merged.boxes.find(entry => entry.id === "a").name, "Alteração remota");
    const recovery = merged.boxes.find(entry => entry.id !== "a");
    assert.match(recovery.name, /Alteração local.*cópia recuperada/);
    assert.equal(recovery.id, recovery.shareId);
    assert.equal(mergeAccountDocuments(merged, remote, remote).document.boxes.length, 2);
});

test("a deletion racing an edit preserves the edited Box as a recovery", () => {
    const base = document({ boxes: [box("a", "Equipe", 10)] });
    const removed = recordAccountChanges(base, { boxes: [] }, 40);
    const edited = document({ boxes: [box("a", "Equipe editada", 30)] });
    const merged = mergeAccountDocuments(removed, edited, base).document;
    assert.equal(merged.boxes.length, 1);
    assert.notEqual(merged.boxes[0].id, "a");
    assert.match(merged.boxes[0].name, /Equipe editada/);
});

test("favorite removal and later re-addition merge without restoring stale favorites", () => {
    const base = recordAccountChanges(null, { dex: { favorites: ["1", "25"] } }, 10);
    const removed = recordAccountChanges(base, { dex: { favorites: ["25"] } }, 20);
    const remote = recordAccountChanges(base, { dex: { favorites: ["1", "25", "133"] } }, 15);
    const merged = mergeAccountDocuments(removed, remote, base).document;
    assert.deepEqual(merged.dex.favorites, ["25", "133"]);
    const addedAgain = recordAccountChanges(merged, { dex: { favorites: ["1", "25", "133"] } }, 40);
    assert.deepEqual(mergeAccountDocuments(addedAgain, removed, merged).document.dex.favorites, ["1", "25", "133"]);
});

test("separate appearance and mode edits merge per field", () => {
    const base = document();
    const local = recordAccountChanges(base, { preferences: { ...base.preferences, appearance: "night" } }, 30);
    const remote = recordAccountChanges(base, { preferences: { ...base.preferences, experienceMode: "game" } }, 40);
    const merged = mergeAccountDocuments(local, remote, base).document;
    assert.equal(merged.preferences.appearance, "night");
    assert.equal(merged.preferences.experienceMode, "game");
});

test("guest import adds records without replacing the account or editing the guest", () => {
    const guest = document({ boxes: [box("a", "Convidado"), box("b", "Outra")], dex: { favorites: ["25"] }, localAdventure: { title: "Local" } });
    const account = document({ boxes: [box("a", "Conta")], dex: { favorites: ["133"] }, preferences: { experienceMode: "game" }, localAdventure: { title: "Conta" } });
    const before = JSON.stringify(guest);
    const imported = importGuestDocument(account, guest, 100);
    assert.equal(imported.boxes.length, 3);
    assert.equal(imported.boxes.find(entry => entry.id === "a").name, "Conta");
    assert.deepEqual(imported.dex.favorites, ["25", "133"]);
    assert.equal(imported.preferences.experienceMode, "game");
    assert.equal(imported.localAdventure.title, "Conta");
    assert.equal(JSON.stringify(guest), before);
    assert.equal(importGuestDocument(imported, guest, 101).boxes.length, 3);
});

test("competing adventures retain the inactive version for a visible recovery export", () => {
    const base = document({ localAdventure: { title: "Original" }, clocks: { localAdventure: 1 } });
    const local = recordAccountChanges(base, { localAdventure: { title: "Local" } }, 20);
    const remote = recordAccountChanges(base, { localAdventure: { title: "Remota" } }, 30);
    const result = mergeAccountDocuments(local, remote, base);
    assert.equal(result.document.localAdventure.title, "Remota");
    assert.equal(result.recoveries.length, 1);
    assert.equal(result.recoveries[0].value.title, "Local");
});

test("account HTTP calls use cookies and bind an expected account, without bearer tokens", async () => {
    let call;
    const reply = await accountRequest("data", { method: "PUT", accountId: "trainer_1", body: { expectedRevision: 2, document: document() }, fetcher: async (url, options) => {
        call = { url, options };
        return Response.json({ revision: 3 });
    } });
    assert.equal(reply.revision, 3);
    assert.equal(call.url, "/api/account/data");
    assert.equal(call.options.credentials, "same-origin");
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.headers["x-myowndex-account"], "trainer_1");
    assert.equal(call.options.headers.authorization, undefined);
    assert.equal(JSON.parse(call.options.body).expectedRevision, 2);
});

test("CAS conflicts keep the authoritative revision available for safe retry", async () => {
    await assert.rejects(accountRequest("data", { fetcher: async () => Response.json({ error: "Conflito", conflict: true, revision: 4, document: document() }, { status: 409 }) }), failure => {
        assert.ok(failure instanceof AccountRequestError);
        assert.equal(failure.status, 409);
        assert.equal(failure.data.revision, 4);
        return true;
    });
});

test("expired sign-outs finish without retrying or clearing a different account cookie", () => {
    assert.equal(accountLogoutComplete(new AccountRequestError("Expired", { status: 401 })), true);
    assert.equal(accountLogoutComplete(new AccountRequestError("Changed", { status: 409, code: "ACCOUNT_SCOPE_CHANGED" })), true);
    assert.equal(accountLogoutComplete(new AccountRequestError("Conflict", { status: 409, code: "ACCOUNT_REVISION_CONFLICT" })), false);
    assert.equal(accountLogoutComplete(new AccountRequestError("Unavailable", { status: 503 })), false);
    assert.equal(accountLogoutComplete(new TypeError("Offline")), false);
});

test("cloud and restored local account XP floor only known XP paths without mutating data", () => {
    const input = { boxes: [{ pokemon: [{ rpg: { xp: 5.9, friendship: 70 }, species: { height: 0.7, weight: 6.9 } }, { rpg: {} }] }],
        localAdventure: { xp: 6.9, snapshot: { tokens: [{ xp: 9.5, combat: { multiplier: 1.5 } }], benchTokens: [{ xp: "4.8" }, { xp: -1 }, {}] } }, other: { xp: 2.5 } };
    const before = JSON.stringify(input);
    const normalized = normalizeAccountXpDocument(input);
    assert.equal(normalized.boxes[0].pokemon[0].rpg.xp, 5);
    assert.equal(normalized.boxes[0].pokemon[0].species.height, 0.7);
    assert.equal(Object.hasOwn(normalized.boxes[0].pokemon[1].rpg, "xp"), false);
    assert.equal(normalized.localAdventure.snapshot.tokens[0].xp, 9);
    assert.equal(normalized.localAdventure.snapshot.tokens[0].combat.multiplier, 1.5);
    assert.deepEqual(normalized.localAdventure.snapshot.benchTokens, [{ xp: 4 }, { xp: 0 }, {}]);
    assert.equal(normalized.localAdventure.xp, 6.9);
    assert.equal(normalized.other.xp, 2.5);
    assert.equal(document(input).localAdventure.snapshot.tokens[0].xp, 9);
    assert.equal(JSON.stringify(input), before);
});

test("account import, merge and export migrate legacy HP once while preserving condition counters", () => {
    const legacyPartner = {
        id: "partner-legacy", level: 50, nickname: "Parceiro antes da atualização",
        species: { name: "wartortle", stats: [{ base_stat: 60, stat: { name: "hp" } }] },
        ivs: { hp: 0 }, evs: { hp: 0 },
        rpg: { currentHp: 4, xp: 7.9, status: "sleep", sleepTurns: 2, pp: [4, 7] },
    };
    const guest = { boxes: [{ ...box("legacy", "Box antiga"), pokemon: [legacyPartner] }] };
    const original = JSON.stringify(guest);
    const cloudValue = normalizeAccountXpDocument(guest);
    assert.equal(cloudValue.boxes[0].pokemon[0].rpg.currentHp, 4,
        "the server must leave HP migration to the client with known species stats");
    const imported = importGuestDocument(document(), cloudValue, 100);
    const partner = imported.boxes[0].pokemon[0];
    assert.equal(partner.rpg.currentHp, 8);
    assert.equal(partner.rpg.scaleVersion, RPG_SCALE_VERSION);
    assert.equal(partner.rpg.xp, 7);
    assert.equal(partner.rpg.sleepTurns, 2);
    assert.deepEqual(partner.rpg.pp, [4, 7, null, null]);
    const remote = recordAccountChanges(imported, { boxes: [{ ...imported.boxes[0], updatedAt: 110,
        pokemon: [{ ...partner, nickname: "Parceiro no segundo dispositivo",
            rpg: { ...partner.rpg, status: "freeze", sleepTurns: null, freezeTurns: 1 } }] }] }, 110);
    const merged = mergeAccountDocuments(imported, remote, imported).document;
    const restored = normalizeAccountDocument(JSON.parse(JSON.stringify(merged)));
    assert.equal(restored.boxes[0].pokemon[0].rpg.currentHp, 8, "restoring a cloud copy must not double HP again");
    assert.equal(restored.boxes[0].pokemon[0].rpg.freezeTurns, 1);
    assert.equal(restored.boxes[0].pokemon[0].nickname, "Parceiro no segundo dispositivo");
    assert.equal(JSON.stringify(guest), original, "the original guest backup remains untouched");
});

test("account cloud copies preserve local adventure migration markers, bank counters and protection state", () => {
    const snapshot = { schema: 7, title: "Aventura antiga", round: 3,
        tokens: [{ id: "sleeping", pokemonId: "partner-legacy", name: "Wartortle", maxHp: 6, currentHp: 4,
            stats: { hp: 6, attack: 3 }, originalStats: { hp: 120, attack: 60 },
            status: "sleep", sleepTurns: 2, xp: 7.9 }],
        benchTokens: [{ id: "frozen", name: "Pikachu", maxHp: 6, currentHp: 2,
            originalStats: { hp: 120 }, status: "freeze", freezeTurns: 1, xp: 4.9 }],
        hitKillProtectionUsed: ["partner-legacy"], hitKillProtectionDisabled: ["frozen"],
    };
    const saved = document({ localAdventure: { snapshot, events: [{ author: "Narrador" }] } });
    assert.equal(saved.localAdventure.snapshot.schema, 7, "cloud normalization must preserve the room migration marker");
    assert.equal(saved.localAdventure.snapshot.tokens[0].currentHp, 4);
    const migrated = normalizeRoomSnapshot(saved.localAdventure.snapshot);
    assert.equal(migrated.schema, ROOM_SCHEMA_VERSION);
    assert.equal(migrated.tokens[0].maxHp, 12);
    assert.equal(migrated.tokens[0].currentHp, 8);
    assert.equal(migrated.tokens[0].sleepTurns, 2);
    assert.equal(migrated.tokens[0].xp, 7);
    assert.equal(migrated.benchTokens[0].freezeTurns, 1);
    assert.equal(migrated.benchTokens[0].currentHp, 4);
    assert.deepEqual(migrated.hitKillProtectionUsed, ["partner-legacy"]);
    assert.deepEqual(migrated.hitKillProtectionDisabled, ["frozen"]);
    const restored = document({ localAdventure: { ...saved.localAdventure, snapshot: migrated } });
    assert.deepEqual(normalizeRoomSnapshot(restored.localAdventure.snapshot), migrated,
        "opening the synchronized adventure again must not repeat its HP migration");
});

test("cleared local roll history stays cleared while independent new receipts merge across devices", () => {
    const receipt = (id, createdAt) => performLocalRoll({ kind: "free", quantity: 1, sides: 20, modifier: 2 },
        { id, createdAt, random: () => 0.5, context: "central" });
    const old = receipt("old-receipt", 10);
    const firstNew = receipt("new-offline-receipt", 30);
    const secondNew = receipt("new-online-receipt", 40);
    const base = recordAccountChanges(document(), { localTools: { rollHistory: [old] } }, 10);
    const local = recordAccountChanges(base, { localTools: { ...base.localTools, rollHistory: [firstNew] } }, 30);
    const remote = recordAccountChanges(base, { localTools: { ...base.localTools, rollHistory: [secondNew, old] } }, 40);
    const merged = mergeAccountDocuments(local, remote, base).document;
    assert.deepEqual(merged.localTools.rollHistory.map(entry => entry.id).sort(), ["new-offline-receipt", "new-online-receipt"]);
    assert.ok(merged.tombstones.localRolls[old.id]);
    const replayed = mergeAccountDocuments(merged, remote, remote).document;
    assert.equal(replayed.localTools.rollHistory.some(entry => entry.id === old.id), false);
    assert.equal(replayed.localTools.rollHistory.length, 2);
    const bounded = document({ ...merged, rollClocks: Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`receipt_${index}`, index])),
        tombstones: { ...merged.tombstones, localRolls: Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`removed_${index}`, index])) } });
    assert.equal(Object.keys(bounded.rollClocks).length, 300);
    assert.equal(Object.keys(bounded.tombstones.localRolls).length, 300);
});

test("account tools retain drafts and recover competing unsaved previews without replacing Boxes", () => {
    const draft = nickname => ({ schema: 1, results: [{ versionGroup: "sword-shield", saved: false, exported: false,
        pokemon: { id: "generated-one", nickname, species: { name: "pikachu" }, rpg: { xp: 1.9, scaleVersion: RPG_SCALE_VERSION } } }] });
    const base = document({ boxes: [box("safe-box", "Box preservada")], localTools: { generatorDraft: draft("Original") } });
    const local = recordAccountChanges(base, { localTools: { ...base.localTools, generatorDraft: draft("Prévia local") } }, 20);
    const remote = recordAccountChanges(base, { localTools: { ...base.localTools, generatorDraft: draft("Prévia remota") } }, 30);
    const merged = mergeAccountDocuments(local, remote, base);
    assert.equal(merged.document.localTools.generatorDraft.results[0].pokemon.nickname, "Prévia remota");
    assert.equal(merged.recoveries.length, 1);
    assert.equal(merged.recoveries[0].resource, "localTools.generatorDraft");
    assert.equal(merged.recoveries[0].value.results[0].pokemon.nickname, "Prévia local");
    assert.equal(merged.document.localTools.generatorDraft.results[0].pokemon.rpg.xp, 1);
    assert.equal(merged.document.boxes[0].name, "Box preservada");
    const imported = importGuestDocument(document(), local, 40);
    assert.equal(imported.localTools.generatorDraft.results[0].pokemon.nickname, "Prévia local");
    assert.equal(imported.roomSession, null);
});
