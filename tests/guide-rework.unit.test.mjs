import test from 'node:test';
import assert from 'node:assert/strict';
import { RPG_RULE_SECTIONS } from '../src/core/rpgRules.js';
import { createGuideSearchIndex, getGuideRuleSearchState, searchGuideSections } from '../src/core/guideSearch.js';
import { GUIDE_PAPER_STEPS } from '../src/core/guidePaperSteps.js';
import { GUIDE_WORKED_SCENES } from '../src/core/guideWorkedScenes.js';

const rules = RPG_RULE_SECTIONS.flatMap(section => section.rules);
const index = createGuideSearchIndex(RPG_RULE_SECTIONS);
const rule = id => rules.find(entry => entry.id === id);

test('all 50 reading numbers address exactly one stable rule, including the two new procedures', () => {
    assert.deepEqual(rules.map(entry => entry.number), Array.from({ length: 50 }, (_, i) => i + 1));
    for (const entry of rules) for (const query of [`regra ${entry.number}`, `#${String(entry.number).padStart(2, '0')}`]) {
        assert.deepEqual(searchGuideSections(index, query).flatMap(section => section.rules.map(r => r.id)), [entry.id]);
    }
    assert.deepEqual(searchGuideSections(index, 'regra 51'), []);
    assert.deepEqual(searchGuideSections(index, 'regra 0'), []);
    for (const id of ['3.8', '4.5']) {
        assert.ok(rule(id).body);
        assert.ok(GUIDE_PAPER_STEPS[id].length >= 2);
        assert.ok(GUIDE_WORKED_SCENES[id].como.length >= 3);
        assert.ok(searchGuideSections(index, rule(id).title).flatMap(s => s.rules).includes(rule(id)));
    }
});

test('search reveals numerical evidence without forcing full detail on ordinary reading or unrelated section matches', () => {
    const poison = rule('6.2');
    assert.deepEqual(getGuideRuleSearchState(poison, ''), { details: false, app: false });
    assert.deepEqual(getGuideRuleSearchState(poison, '  VENENO  '), { details: false, app: false });
    assert.equal(getGuideRuleSearchState(poison, '2 de 3 HP').details, true);
    assert.equal(getGuideRuleSearchState(poison, 'Poder 15').details, true);
    assert.deepEqual(getGuideRuleSearchState(rule('3.3'), 'Hora da batalha'), { details: false, app: false });
    assert.equal(getGuideRuleSearchState(rule('4.2'), 'guarde seu novo parceiro no PC').details, true);
});

test('effect duration complements stages and the guide keeps Max duration explicit', () => {
    assert.match(rule('2.3').body, /estágios/);
    assert.match(rule('6.4').body, /regra 2.3/);
    assert.match(rule('6.4').body, /não são curados apenas pela troca/);
    assert.match(rule('6.4').body, /clima do lugar pode continuar/);
    assert.match(rule('7.7').bullets.join(' '), /duram três rodadas/);
    assert.match(rule('5.4').bullets.join(' '), /pode adiar uma evolução/);
});
