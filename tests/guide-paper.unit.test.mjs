import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RPG_RULE_SECTIONS } from "../src/core/rpgRules.js";
import { GUIDE_PAPER_STEPS } from "../src/core/guidePaperSteps.js";
import { createGuideSearchIndex, searchGuideSections } from "../src/core/guideSearch.js";

const rules=RPG_RULE_SECTIONS.flatMap(section=>section.rules);

test("each of the 50 canonical rules can be followed on paper",()=>{
    assert.equal(rules.length,50);
    assert.deepEqual(Object.keys(GUIDE_PAPER_STEPS).sort(),rules.map(rule=>rule.id).sort());
    for(const rule of rules){
        assert.ok(rule.plain?.length>=15,rule.id);
        assert.ok((rule.body||"").length>=40 || (rule.bullets||[]).length>=2,rule.id);
        assert.ok(rule.example?.length>=40,rule.id);
        const steps=GUIDE_PAPER_STEPS[rule.id];
        assert.ok(Array.isArray(steps)&&steps.length>=2,rule.id);
        for(const step of steps){
            assert.ok(step.length>=65,rule.id);
            assert.doesNotMatch(step,/\b(?:MyOwnDex|aplicativo|site|painel|tela|botão|clique|toque)\b/i,rule.id);
        }
    }
});

test("the printed book includes the canonical text, procedures, reproducible examples and printing",()=>{
    const source=readFileSync(new URL("../app/guia/livro/page.jsx",import.meta.url),"utf8");
    assert.match(source,/RPG_RULE_SECTIONS\.map\(/);
    assert.match(source,/GUIDE_PAPER_STEPS\[rule\.id\]/);
    assert.match(source,/rule\.body\?\.split/);
    assert.match(source,/rule\.bullets\?\.length/);
    assert.match(source,/GUIDE_AUDIT_CASES\[rule\.auditCase\]/);
    assert.match(source,/rule\.example/);
    assert.match(source,/PrintBookButton/);
});

test("search includes paper procedure and canonical rule text",()=>{
    const index=createGuideSearchIndex(RPG_RULE_SECTIONS);
    const ids=query=>searchGuideSections(index,query).flatMap(section=>section.rules.map(rule=>rule.id));
    assert.ok(ids("dados de oito faces").includes("6.2") || ids("fração de HP").includes("6.2"));
    assert.ok(ids("role três d6").includes("1.2"));
    assert.ok(ids("um Pokémon consciente").includes("4.3"));
});
