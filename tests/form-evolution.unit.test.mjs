import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import index from '../src/data/form-evolutions.json' with { type: 'json' };
import forms from '../src/data/forms.json' with { type: 'json' };
import { getFormLearnsetFallback, resolveFormEvolutionPaths } from '../src/core/formEvolution.js';
import { shouldSeparateDexVariant } from '../src/core/dexVariants.js';

const chain = (...nodes) => nodes.map(([name, id]) => ({ name, id }));
const names = paths => paths.map(path => path.map(node => node.name));

test('Meowth and Slowpoke show the exact regional family rather than the entire species fork', () => {
    const meowth = [chain(['meowth', 52], ['persian', 53]), chain(['meowth', 52], ['perrserker', 863])];
    for (const [active, expected] of [
        ['meowth', [['meowth', 'persian']]],
        ['meowth-alola', [['meowth-alola', 'persian-alola']]],
        ['meowth-galar', [['meowth-galar', 'perrserker']]],
        ['perrserker', [['meowth-galar', 'perrserker']]],
    ]) assert.deepEqual(names(resolveFormEvolutionPaths(meowth, active)), expected, active);
    const slowpoke = [chain(['slowpoke', 79], ['slowbro', 80]), chain(['slowpoke', 79], ['slowking', 199])];
    assert.deepEqual(names(resolveFormEvolutionPaths(slowpoke, 'slowpoke-galar')), [
        ['slowpoke-galar', 'slowbro-galar'], ['slowpoke-galar', 'slowking-galar'],
    ]);
    assert.deepEqual(names(resolveFormEvolutionPaths(slowpoke, 'slowking-galar')), [['slowpoke-galar', 'slowking-galar']]);
});

test('species-level regional-only evolution edges do not grant an evolution to the original form', () => {
    for (const [original, variant, evolved, originalId, evolvedId] of [
        ['farfetchd', 'farfetchd-galar', 'sirfetchd', 83, 865],
        ['corsola', 'corsola-galar', 'cursola', 222, 864],
        ['qwilfish', 'qwilfish-hisui', 'overqwil', 211, 904],
    ]) {
        const paths = [chain([original, originalId], [evolved, evolvedId])];
        assert.deepEqual(names(resolveFormEvolutionPaths(paths, original)), [[original]], original);
        assert.deepEqual(names(resolveFormEvolutionPaths(paths, variant)), [[variant, evolved]], variant);
    }
    const yamask = [chain(['yamask', 562], ['cofagrigus', 563]), chain(['yamask', 562], ['runerigus', 867])];
    assert.deepEqual(names(resolveFormEvolutionPaths(yamask, 'yamask')), [['yamask', 'cofagrigus']]);
    assert.deepEqual(names(resolveFormEvolutionPaths(yamask, 'yamask-galar')), [['yamask-galar', 'runerigus']]);
    const linoone = [chain(['zigzagoon', 263], ['linoone', 264], ['obstagoon', 862])];
    assert.deepEqual(names(resolveFormEvolutionPaths(linoone, 'linoone')), [['zigzagoon', 'linoone']]);
    assert.deepEqual(names(resolveFormEvolutionPaths(linoone, 'linoone-galar')), [['zigzagoon-galar', 'linoone-galar', 'obstagoon']]);
});

test('shared ancestors retain legitimate regional choices with exact sprites and separate National numbers', () => {
    const pikachu = [chain(['pichu', 172], ['pikachu', 25], ['raichu', 26])];
    assert.deepEqual(names(resolveFormEvolutionPaths(pikachu, 'pikachu')), [
        ['pichu', 'pikachu', 'raichu'], ['pichu', 'pikachu', 'raichu-alola'],
    ]);
    const alolan = resolveFormEvolutionPaths(pikachu, 'raichu-alola')[0];
    assert.deepEqual(alolan.map(node => node.id), [172, 25, 10100]);
    assert.deepEqual(alolan.map(node => node.speciesId), [172, 25, 26]);
    assert.equal(alolan.at(-1).spriteKey, '10100');
    const goomy = [chain(['goomy', 704], ['sliggoo', 705], ['goodra', 706])];
    assert.deepEqual(names(resolveFormEvolutionPaths(goomy, 'goomy')), [
        ['goomy', 'sliggoo', 'goodra'], ['goomy', 'sliggoo-hisui', 'goodra-hisui'],
    ]);
    assert.deepEqual(names(resolveFormEvolutionPaths(goomy, 'sliggoo-hisui')), [['goomy', 'sliggoo-hisui', 'goodra-hisui']]);
});

test('Pumpkaboo sizes and Own Tempo retain their specific evolution without changing grouped cosmetic policy', () => {
    const gourgeist = [chain(['pumpkaboo', 710], ['gourgeist', 711])];
    for (const size of ['average', 'small', 'large', 'super']) {
        for (const species of ['pumpkaboo', 'gourgeist']) {
            assert.deepEqual(names(resolveFormEvolutionPaths(gourgeist, `${species}-${size}`)), [[`pumpkaboo-${size}`, `gourgeist-${size}`]]);
        }
    }
    const rockruff = [chain(['rockruff', 744], ['lycanroc', 745])];
    assert.deepEqual(names(resolveFormEvolutionPaths(rockruff, 'rockruff-own-tempo')), [['rockruff-own-tempo', 'lycanroc-dusk']]);
    assert.deepEqual(names(resolveFormEvolutionPaths(rockruff, 'rockruff')), [
        ['rockruff', 'lycanroc-midday'], ['rockruff', 'lycanroc-midnight'],
    ]);
    for (const name of ['shellos-east', 'vivillon-polar', 'pikachu-alola-cap']) {
        assert.equal(shouldSeparateDexVariant(forms.entries.find(form => form.name === name)), false, name);
    }
});

test('only White-Striped Basculin has Basculegion paths, and its genders do not use the other sprite', () => {
    const basculin = [chain(['basculin', 550], ['basculegion', 902])];
    assert.deepEqual(names(resolveFormEvolutionPaths(basculin, 'basculin-red-striped')), [['basculin-red-striped']]);
    assert.deepEqual(names(resolveFormEvolutionPaths(basculin, 'basculin-blue-striped')), [['basculin-blue-striped']]);
    assert.deepEqual(names(resolveFormEvolutionPaths(basculin, 'basculin-white-striped')), [
        ['basculin-white-striped', 'basculegion-female'], ['basculin-white-striped', 'basculegion-male'],
    ]);
    const female = resolveFormEvolutionPaths(basculin, 'basculegion-female')[0];
    assert.deepEqual(female.map(node => node.id), [10247, 10248]);
    assert.deepEqual(female.map(node => node.speciesId), [550, 902]);
});

test('special individuals that cannot evolve do not borrow the ordinary evolution; reversible Zen retains Galar ancestry', () => {
    const pikachu = [chain(['pichu', 172], ['pikachu', 25], ['raichu', 26])];
    for (const name of ['pikachu-cosplay', 'pikachu-libre', 'pikachu-alola-cap', 'pikachu-starter', 'pichu-spiky-eared']) {
        assert.deepEqual(names(resolveFormEvolutionPaths(pikachu, name)), [[name]], name);
    }
    const ursaring = [chain(['teddiursa', 216], ['ursaring', 217], ['ursaluna', 901])];
    assert.deepEqual(names(resolveFormEvolutionPaths(ursaring, 'ursaluna-bloodmoon')), [['ursaluna-bloodmoon']]);
    const darmanitan = [chain(['darumaka', 554], ['darmanitan', 555])];
    assert.deepEqual(names(resolveFormEvolutionPaths(darmanitan, 'darmanitan-galar-zen')), [['darumaka-galar', 'darmanitan-galar-standard']]);
    const toxtricity = [chain(['toxel', 848], ['toxtricity', 849])];
    assert.deepEqual(names(resolveFormEvolutionPaths(toxtricity, 'toxtricity-low-key-gmax')), [['toxel', 'toxtricity-low-key']]);
    const raticate = [chain(['rattata', 19], ['raticate', 20])];
    assert.deepEqual(names(resolveFormEvolutionPaths(raticate, 'raticate-totem-alola')), [['rattata-alola', 'raticate-alola']]);
});

test('an absent distinct learnset stays absent while reversible forms keep their existing safe fallback', () => {
    for (const name of ['meowth-galar', 'raichu-alola', 'growlithe-hisui', 'wooper-paldea', 'toxtricity-low-key', 'pumpkaboo-super', 'indeedee-female', 'basculin-white-striped']) {
        assert.equal(getFormLearnsetFallback(name, 'ordinary'), null, name);
    }
    assert.equal(getFormLearnsetFallback('darmanitan-galar-zen', 'darmanitan-standard'), 'darmanitan-galar-standard');
    assert.equal(getFormLearnsetFallback('toxtricity-low-key-gmax', 'toxtricity-amped'), 'toxtricity-low-key');
    assert.equal(getFormLearnsetFallback('raticate-totem-alola', 'raticate'), 'raticate-alola');
    assert.equal(getFormLearnsetFallback('venusaur-mega', 'venusaur'), 'venusaur');
    assert.equal(getFormLearnsetFallback('rotom-wash', 'rotom'), 'rotom');
    assert.equal(getFormLearnsetFallback('pikachu', 'pikachu'), null);
    assert.equal(getFormLearnsetFallback('floette-mega', 'floette'), 'floette-eternal');
});

test('Mega Floette remains Eternal Flower Floette instead of inheriting ordinary Florges evolution', () => {
    const flowerLine = [chain(['flabebe', 669], ['floette', 670], ['florges', 671])];
    assert.deepEqual(names(resolveFormEvolutionPaths(flowerLine, 'floette-mega')), [['floette-eternal']]);
});

test('the bounded offline index is pinned to the existing form catalogue and leaves ordinary inputs unchanged', () => {
    assert.equal(index.schemaVersion, 1);
    assert.equal(index.sourceCommit, forms.sourceCommit);
    assert.equal(Object.keys(index.sourceHashes).length, 4);
    for (const hash of Object.values(index.sourceHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(readFileSync(new URL('../src/data/form-evolutions.json', import.meta.url)).byteLength < 40 * 1024);
    const known = new Set(index.nodes.map(node => node.name));
    assert.equal(known.size, index.nodes.length);
    for (const path of index.paths) {
        assert.ok(path.length > 0 && path.length <= 3);
        assert.equal(new Set(path).size, path.length);
        assert.ok(path.every(name => known.has(name)));
    }
    const bulbasaur = [chain(['bulbasaur', 1], ['ivysaur', 2], ['venusaur', 3])];
    const before = JSON.stringify(bulbasaur);
    assert.deepEqual(names(resolveFormEvolutionPaths(bulbasaur, 'bulbasaur')), [['bulbasaur', 'ivysaur', 'venusaur']]);
    assert.equal(JSON.stringify(bulbasaur), before);
    assert.deepEqual(resolveFormEvolutionPaths([], 'bulbasaur'), []);
});
