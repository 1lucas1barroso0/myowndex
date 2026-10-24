import assert from "node:assert/strict";
import test from "node:test";
import { createGuideSearchIndex, getGuideAuditText, searchGuideSections } from "../src/core/guideSearch.js";
import { RPG_RULE_SECTIONS } from "../src/core/rpgRules.js";
import { GUIDE_PLAYER_SCENES } from "../src/core/guidePlayerScenes.js";
import { GUIDE_PAPER_STEPS } from "../src/core/guidePaperSteps.js";
import { GUIDE_WORKED_SCENES } from "../src/core/guideWorkedScenes.js";
import { GUIDE_RULE_CONTEXTS } from "../src/core/guideRuleContexts.js";

test("indexed guide search preserves every rule, accents, section matches and displayed proportions", () => {
    const sections = RPG_RULE_SECTIONS;
    assert.equal(Object.keys(GUIDE_PLAYER_SCENES).length, sections.flatMap(section => section.rules).length, "every rule needs a practical scene");
    assert.equal(Object.keys(GUIDE_RULE_CONTEXTS).length, sections.flatMap(section => section.rules).length, "every rule needs a contextual explanation");
    assert.ok(sections.every(section => section.rules.every(rule => GUIDE_PLAYER_SCENES[rule.id])), "no rule lacks player guidance");
    const before = JSON.stringify(sections);
    const index = createGuideSearchIndex(sections);
    const normalize = text => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const legacy = query => {
        const needle = normalize(query);
        if (!needle) return sections;
        return sections.map(section => ({ ...section,
            rules: normalize(`${section.number} ${section.title} ${section.summary}`).includes(needle) ? section.rules
                : section.rules.filter(rule => {
                    const text = [rule.id, rule.title, rule.plain || "", GUIDE_PLAYER_SCENES[rule.id] || "", GUIDE_RULE_CONTEXTS[rule.id] || "", ...GUIDE_PAPER_STEPS[rule.id], ...Object.values(GUIDE_WORKED_SCENES[rule.id]).flat(), rule.body || "", ...(rule.bullets || []), ...rule.steps, getGuideAuditText(rule.auditCase)].join(" ");
                    const displayed = text.replace(/1 em 8/g, "12,5%").replace(/1 em 3/g, "≈ 33,3%");
                    return normalize(`${text} ${displayed}`).includes(needle);
                }),
        })).filter(section => section.rules.length);
    };
    const queries = ["", "  ", "AÇÃO", "acao", "dano", "12,5%", "1 em 8", "33,3%", "1 em 3", "3.4", "galho errado", "__sem_resultados__",
        ...sections.flatMap(section => [section.title, section.summary, ...section.rules.map(rule => rule.title)])];
    for (const query of queries) {
        const found = searchGuideSections(index, query).flatMap(section => section.rules.map(rule => rule.id));
        const previous = legacy(query).flatMap(section => section.rules.map(rule => rule.id));
        for (const id of previous) assert.ok(found.includes(id), `${query}: preserve ${id}`);
    }
    assert.deepEqual(searchGuideSections(index, '__sem_resultados__'), []);
    assert.deepEqual(searchGuideSections(index, "galho errado").flatMap(section => section.rules.map(rule => rule.id)), ["1.3"]);
    assert.strictEqual(searchGuideSections(index, ""), sections);
    assert.equal(JSON.stringify(sections), before);
});
