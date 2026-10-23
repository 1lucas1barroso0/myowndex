import assert from "node:assert/strict";
import test from "node:test";
import { isOrdinaryLevelUpMove, moveLearnMethodLabel } from "../src/core/moveLearnMethods.js";

const detail = (method, level) => ({ move_learn_method: { name: method }, level_learned_at: level });

test("level zero is an evolution move, not an invisible level or an invented level one", () => {
    assert.equal(moveLearnMethodLabel(detail("level-up", 0)), "Ao evoluir");
    assert.equal(moveLearnMethodLabel(detail("level-up", 1)), "Nv. 1");
    assert.equal(moveLearnMethodLabel(detail("level-up", 50)), "Nv. 50");
    assert.equal(moveLearnMethodLabel(detail("level-up", 200)), "Nv. 200");
    assert.notEqual(moveLearnMethodLabel(detail("level-up", 0)), moveLearnMethodLabel(detail("level-up", 1)));
});
test("every learn method has an explicit, unambiguous label", () => {
    for (const [method,label] of [["machine","Máquina"],["tutor","Tutor"],["egg","Ovo"]])
        assert.equal(moveLearnMethodLabel(detail(method,0)),label);
    for (const value of [undefined,null,-1,"1",Number.NaN]) {
        assert.equal(moveLearnMethodLabel(detail("level-up",value)),"Nível não informado");
    }
    assert.equal(moveLearnMethodLabel({}),"Outro");
});


test("automatic moves are granted only from documented ordinary level-up entries", () => {
    for (const level of [1, 5, 30, 100]) {
        assert.equal(isOrdinaryLevelUpMove(detail("level-up", 0), level), false, "evolution move is not a free level move");
        assert.equal(isOrdinaryLevelUpMove(detail("level-up", 1), level), true);
        assert.equal(isOrdinaryLevelUpMove(detail("level-up", level + 1), level), false);
        assert.equal(isOrdinaryLevelUpMove(detail("machine", 0), level), false);
        assert.equal(isOrdinaryLevelUpMove(detail("egg", 1), level), false);
        assert.equal(isOrdinaryLevelUpMove(detail("tutor", 1), level), false);
        assert.equal(isOrdinaryLevelUpMove(detail("level-up", null), level), false);
        assert.equal(isOrdinaryLevelUpMove(detail("level-up", "1"), level), false);
    }
});
