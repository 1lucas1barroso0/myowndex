import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RPG_RULE_SECTIONS } from "../src/core/rpgRules.js";
import { GUIDE_WORKED_SCENES } from "../src/core/guideWorkedScenes.js";
import { GUIDE_PAPER_STEPS } from "../src/core/guidePaperSteps.js";
import { GUIDE_AUDIT_CASES } from "../src/data/guide-audit-cases.js";
import { createGuideSearchIndex, searchGuideSections } from "../src/core/guideSearch.js";

const rules = RPG_RULE_SECTIONS.flatMap(section => section.rules);
const ids = rules.map(rule => rule.id).sort();

test("every one of the 50 rules explains trigger, actors, resolution, consequence and why", () => {
    assert.equal(rules.length, 50);
    assert.deepEqual(Object.keys(GUIDE_WORKED_SCENES).sort(), ids);
    assert.deepEqual(Object.keys(GUIDE_PAPER_STEPS).sort(), ids);
    for (const id of ids) {
        const worked = GUIDE_WORKED_SCENES[id];
        for (const key of ["quando","cena","resultado","porQue"]) {
            assert.ok(typeof worked[key] === "string" && worked[key].length >= 95, `${id}: ${key} omits practical information`);
        }
        assert.ok(Array.isArray(worked.como) && worked.como.length >= 3,`${id}: missing full sequence`);
        for (const step of worked.como) {
            assert.ok(typeof step === "string" && step.length >= 100, `${id}: underspecified action`);
            assert.doesNotMatch(step,/\b(?:clique|aperte|toque na tela|veja no painel)\b/i,id);
        }
    }
});

test("rule 6.2 identifies official Poison Sting, the audited Pikachu and mutually exclusive endings",()=>{
    const w=GUIDE_WORKED_SCENES["6.2"];
    assert.match(w.cena,/Ekans.*Scarlet\/Violet|Scarlet\/Violet.*Ekans/);
    assert.match(w.cena,/nível 4/);
    assert.match(w.cena,/Poder 15/);
    assert.match(w.cena,/35 PP/);
    assert.match(w.cena,/30%/);
    assert.match(w.como.join(" "),/3 de 3 HP/);
    assert.match(w.como.join(" "),/2 de 3 HP/);
    assert.match(w.como.join(" "),/3\/8/);
    assert.match(w.como.join(" "),/dado de oito faces/);
    assert.match(w.como.join(" "),/nunca aplique as duas/i);
    assert.deepEqual(GUIDE_AUDIT_CASES.poison.rows.map(row=>row[1]),["3 de 3 HP","2 de 3 HP","Envenenado","2 de 3 HP","Envenenado","1 de 3 HP","Envenenado"]);
});

test("worked examples are indexed and rendered in app and printable book, without redundant book button",()=>{
    const index=createGuideSearchIndex(RPG_RULE_SECTIONS);
    const matches=query=>searchGuideSections(index,query).flatMap(section=>section.rules.map(rule=>rule.id));
    assert.ok(matches("3/8 de um HP").includes("6.2"));
    assert.ok(matches("nível Dynamax 10").includes("7.7"));
    assert.ok(matches("tábua").includes("8.7"));
    const app=readFileSync(new URL("../src/components/Guide/TrainerGuide.jsx",import.meta.url),"utf8");
    const book=readFileSync(new URL("../app/guia/livro/page.jsx",import.meta.url),"utf8");
    assert.match(app,/<WorkedScene id=\{rule.id\}/);
    assert.match(app,/Quando esta regra entra em ação\?/);
    assert.match(book,/GUIDE_WORKED_SCENES\[rule.id\]/);
    assert.match(book,/worked\.como\.map/);
    assert.doesNotMatch(app,/Ler o livro completo ou imprimir|guide-book-link/);
});
