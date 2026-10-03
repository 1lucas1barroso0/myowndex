import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';
import { formatReferenceText } from '../src/core/pokedexRecord.js';
import { clearCatalogTextCache, getCatalogText, loadCatalogText } from '../src/core/catalogText.js';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));

test('English reference percentages use English punctuation without altering names or Portuguese numbers', () => {
    const text = 'At ≈ 33,33% HP, Water-type moves deal 1.5× damage. Pokémon #1,025 keeps its name.';
    assert.equal(formatReferenceText(text, 'en'), 'At ≈ 33.33% HP, Water-type moves deal 1.5× damage. Pokémon #1,025 keeps its name.');
    assert.equal(formatReferenceText('Recupera 12,5% do HP; Pikachu e Poké Ball.', 'pt-BR'), 'Recupera 12,5% do HP; Pikachu e Poké Ball.');
    assert.equal(formatReferenceText('1,000% and 50% remain intact.', 'en'), '1,000% and 50% remain intact.');
});

test('reviewed Portuguese attributes retain paired source text and reproducible editorial corrections', async () => {
    const proof = await read('docs/catalog-text-provenance.json');
    const overrideBytes = await fs.readFile(new URL('scripts/catalogo-ajustes-pt.json', root));
    const overrides = JSON.parse(overrideBytes);
    assert.equal(proof.reviewedEditorialOverrides.entries, Object.keys(overrides).length);
    assert.equal(proof.reviewedEditorialOverrides.sha256, createHash('sha256').update(overrideBytes).digest('hex'));
    const pairs = new Map();
    for (const kind of ['ability', 'item', 'move']) {
        const data = await read(`public/catalog/v1/${kind}.json`);
        for (const [original, portuguese] of Object.values(data.texts)) {
            assert.doesNotMatch(portuguese, /\b(?:Sp|SPCL|SpAtk|SpDef|SpA|SpD|Atk|Def|Spe|Ups|Crunches)\b/i, original);
            pairs.set(original, portuguese);
        }
    }
    const samples = [
        ["Raises the user's Sp. Atk by 3.", 'Aumenta o Ataque Especial de quem usa em 3 estágios.'],
        ["Lowers the target's Sp. Def by 2.", 'Reduz a Defesa Especial do alvo em 2 estágios.'],
        ["The user is roused, and its Attack and Sp. Atk stats increase.", 'Quem usa se anima, aumentando seu Ataque e seu Ataque Especial.'],
        ["If held by a Clamperl, its Sp. Def is doubled. Evolves Clamperl into Gorebyss when traded.", 'Quando Clamperl segura este item, sua Defesa Especial dobra. Ao ser trocado segurando o item, evolui para Gorebyss.'],
    ];
    for (const [original, portuguese] of samples) {
        assert.equal(pairs.get(original), portuguese);
        assert.equal(overrides[original], portuguese);
    }
});

test('Portuguese battle explanations preserve historical values and English named exceptions', async () => {
    const priorFetch = globalThis.fetch;
    clearCatalogTextCache();
    globalThis.fetch = async url => ({ ok: true, text: async () => fs.readFile(new URL(`public${url}`, root), 'utf8') });
    try {
        await loadCatalogText('move');
        const currentTailGlow = getCatalogText('move', 'tail-glow', {}, { short: true });
        assert.match(currentTailGlow.original, /Sp\. Atk by 3/);
        assert.match(currentTailGlow.portuguese, /Ataque Especial.*3 estágios/);
        const oldTailGlow = getCatalogText('move', 'tail-glow', {}, { versionGroup: 'heartgold-soulsilver', short: true });
        assert.match(oldTailGlow.original, /Sp\. Atk by 2/);
        assert.match(oldTailGlow.portuguese, /Ataque Especial.*2 estágios/);
        const metalSound = getCatalogText('move', 'metal-sound', {}, { short: true });
        assert.match(metalSound.portuguese, /Defesa Especial.*2 estágios/);
        await loadCatalogText('ability');
        const plus = getCatalogText('ability', 'plus', {}, { short: true });
        assert.match(plus.portuguese, /Minus.*Ataque Especial|Ataque Especial.*Minus/);
        assert.match(plus.portuguese, /1,5/);
        await loadCatalogText('item');
        const lightBall = getCatalogText('item', 'light-ball', {}, { short: true });
        assert.match(lightBall.portuguese, /Pikachu/);
        assert.match(lightBall.portuguese, /Ataque.*Ataque Especial/);
    } finally {
        globalThis.fetch = priorFetch;
        clearCatalogTextCache();
    }
});
