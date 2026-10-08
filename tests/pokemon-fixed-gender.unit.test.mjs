import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearApiCache } from "../src/core/mechanics.js";
import { getFixedFormGender, getPokemonGenderRate } from "../src/core/pokemonGender.js";
import { buildGeneratedPokemon } from "../src/core/pokemonGenerator.js";
import { compactPokemon, hydratePokemon, mergeHydratedTeams, normalizePokemon, STAT_KEYS } from "../src/core/team.js";
import { decodeShare, encodePokemonBundle } from "../src/core/teamShare.js";

const API = "https://pokeapi.co/api/v2/";
const index = JSON.parse(readFileSync(new URL("../src/data/forms.json", import.meta.url), "utf8"));
const ordinaryForms = [...index.defaults, ...index.entries].filter(form =>
    [678, 876, 902, 916].includes(form.speciesId) && /-(male|female)$/.test(form.pokemonName));
// PokeAPI pokemon.csv / pokemon_forms.csv: the current Mega resources are
// battle states, so they stay outside the encounter catalogue above.
const forms = [...ordinaryForms, ...[
    ["meowstic-male", 10314, 10539],
    ["meowstic-female", 10326, 10554],
].map(([base, pokemonId, formId]) => ({
    ...ordinaryForms.find(form => form.name === base),
    name: `${base}-mega`, pokemonName: `${base}-mega`, pokemonId, formId,
}))];
const gender = form => /-female(?:-mega)?$/.test(form.pokemonName) ? "F" : "M";
const rate = form => gender(form) === "F" ? 8 : 0;
const fixture = form => ({
    id: form.pokemonId,
    name: form.pokemonName,
    species: { name: form.pokemonName.replace(/-(?:male|female)(?:-mega)?$/, ""), url: `${API}pokemon-species/${form.speciesId}/` },
    stats: STAT_KEYS.map(name => ({ stat: { name }, base_stat: 60 })),
    types: form.types.map(name => ({ type: { name } })),
    abilities: [{ ability: { name: "inner-focus" }, is_hidden: false }],
    sprites: { front_default: `/sprites/${form.pokemonId}.png` },
});
const savedPartner = form => ({
    id: `fixed-${form.pokemonId}`,
    species: { ...fixture(form), gender_rate: 4 },
    formKey: form.name,
    formId: form.formId,
    gender: gender(form) === "F" ? "M" : "F",
    genderRate: 4,
    genderLocked: true,
    nickname: "Minha escolha",
    ability: "inner-focus",
    item: "leftovers",
    level: 42,
    friendship: 120,
    moves: ["psychic", "protect"],
    ivs: { attack: 7 },
    evs: { speed: 12 },
    rpg: { scaleVersion: 2, currentHp: 3, xp: 9, pp: [4, 2], notes: "Minha história" },
});

test("the eight sex-specific identities and both Mega Meowstic repair gender without changing the saved Pokémon", () => {
    assert.equal(forms.length, 10);
    for (const form of forms) {
        const source = savedPartner(form);
        const unchanged = structuredClone(source);
        const normalized = normalizePokemon(source);
        assert.equal(normalized.gender, gender(form), form.name);
        assert.equal(normalized.genderRate, rate(form));
        assert.equal(normalized.species.gender_rate, rate(form));
        for (const key of ["id", "nickname", "ability", "item", "level", "friendship", "genderLocked", "formKey", "formId"]) {
            assert.equal(normalized[key], source[key], `${form.name}: ${key}`);
        }
        assert.deepEqual(normalized.moves.slice(0, 2), source.moves);
        assert.equal(normalized.ivs.attack, 7);
        assert.equal(normalized.evs.speed, 12);
        assert.equal(normalized.rpg.currentHp, 3);
        assert.equal(normalized.rpg.xp, 9);
        assert.deepEqual(normalized.rpg.pp.slice(0, 2), [4, 2]);
        assert.equal(normalized.rpg.notes, "Minha história");
        assert.deepEqual(source, unchanged, "normalization never edits the input snapshot");
    }
});

test("the Generator keeps the chosen form's sex for either end of the random draw", () => {
    for (const form of forms) for (const random of [() => 0, () => 0.999999]) {
        const pokemon = fixture(form);
        const result = buildGeneratedPokemon({
            pokemon,
            species: { name: pokemon.species.name, gender_rate: 4 },
            learnset: { versionGroup: "scarlet-violet", moves: [] },
            options: { nature: "hardy" },
            formIdentity: { formKey: form.name, formId: form.formId },
            random,
        });
        assert.equal(result.gender, gender(form), form.name);
        assert.equal(result.genderRate, rate(form));
        assert.equal(result.species.gender_rate, rate(form));
        assert.equal(result.species.name, form.pokemonName);
        assert.equal(result.formKey, form.name);
        assert.equal(result.formId, form.formId);
    }
});

test("individual sharing, compact storage and catalogue refresh retain the exact fixed gender and live progress", async t => {
    const previousFetch = globalThis.fetch;
    await clearApiCache();
    globalThis.fetch = async url => {
        const form = forms.find(value => url === `${API}pokemon/${value.pokemonName}`);
        if (form) return Response.json(fixture(form));
        if (String(url).includes("/pokemon-species/")) return Response.json({ gender_rate: 4 });
        if (String(url).includes("/pokemon-form/")) return Response.json({ sprites: {} });
        return new Response("Not found", { status: 404 });
    };
    t.after(async () => { globalThis.fetch = previousFetch; await clearApiCache(); });
    for (const form of forms) {
        const compact = compactPokemon(savedPartner(form));
        const imported = (await decodeShare(await encodePokemonBundle([compact]))).pokemon[0];
        const hydrated = await hydratePokemon(imported);
        assert.equal(hydrated.species.name, form.pokemonName);
        assert.equal(hydrated.gender, gender(form));
        assert.equal(hydrated.genderRate, rate(form));
        assert.equal(hydrated.species.gender_rate, rate(form));
        assert.equal(hydrated.genderLocked, true);
        assert.equal(hydrated.nickname, "Minha escolha");
        assert.equal(hydrated.rpg.xp, 9);
        assert.equal(hydrated.rpg.currentHp, 3);
        assert.equal(hydrated.rpg.notes, "Minha história");
        assert.deepEqual(hydrated.rpg.pp.slice(0, 2), [4, 2]);
        assert.equal(hydrated.formKey, form.name);
        assert.equal(hydrated.formId, form.formId);
    }
});

test("late hydration corrects a fixed form while retaining live edits and never overwrites a newly chosen form", () => {
    const female = forms.find(form => form.name === "indeedee-female");
    const male = forms.find(form => form.name === "indeedee-male");
    const live = savedPartner(female);
    const current = [{ id: "box", pokemon: [{ ...live, nickname: "Editado agora", item: "sitrus-berry", rpg: { ...live.rpg, xp: 11 } }] }];
    const loaded = [{ id: "box", pokemon: [{ ...live, species: fixture(female), gender: "M", genderRate: 4 }] }];
    const merged = mergeHydratedTeams(current, loaded)[0].pokemon[0];
    assert.equal(merged.gender, "F");
    assert.equal(merged.genderRate, 8);
    assert.equal(merged.species.gender_rate, 8);
    assert.equal(merged.nickname, "Editado agora");
    assert.equal(merged.item, "sitrus-berry");
    assert.equal(merged.rpg.xp, 11);
    const changed = [{ id: "box", pokemon: [{ ...current[0].pokemon[0], species: fixture(male), gender: "M", genderRate: 0 }] }];
    assert.deepEqual(mergeHydratedTeams(changed, loaded), changed);
});

test("ordinary gender choices and cosmetic differences never become fixed sexual forms", () => {
    for (const name of ["pikachu", "hippowdon", "unfezant", "meowstic", "indeedee", "pikachu-female-costume"]) {
        assert.equal(getFixedFormGender(name), null);
        const pokemon = normalizePokemon({ species: { name }, gender: "F", genderRate: 4, genderLocked: true });
        assert.equal(pokemon.gender, "F");
        assert.equal(pokemon.genderRate, 4);
        assert.equal(pokemon.genderLocked, true);
    }
    assert.equal(getPokemonGenderRate({ species: { name: "rotom", gender_rate: -1 } }), -1);
    assert.equal(getPokemonGenderRate({ species: { name: "nidoran-f", gender_rate: 8 } }), 8);
    assert.equal(getFixedFormGender({ species: { name: "indeedee-male" }, formKey: "indeedee-female" }), "M", "the real resource takes precedence over a stale presentation key");
    assert.equal(getFixedFormGender({ species: { name: "pikachu" }, formKey: "indeedee-female" }), null, "a stale key from another species never changes a Pokémon");
});
