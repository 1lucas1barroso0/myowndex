import test from "node:test";
import assert from "node:assert/strict";
import { getHpReading } from "../src/core/hpPresentation.js";

test("HP readings preserve zero, use full HP for an unset value and share battle colour boundaries", () => {
    assert.deepEqual(getHpReading(null, 20), { now:20, max:20, percent:100, tone:"healthy" });
    assert.deepEqual(getHpReading(0, 20), { now:0, max:20, percent:0, tone:"danger" });
    assert.equal(getHpReading(5, 20).tone, "danger");
    assert.equal(getHpReading(6, 20).tone, "warning");
    assert.equal(getHpReading(10, 20).tone, "warning");
    assert.equal(getHpReading(11, 20).tone, "healthy");
});

test("old or invalid HP cannot overflow the bar or expose NaN", () => {
    for (const [current, maximum] of [[-5, 20], [35, 20], [NaN, 20], [Infinity, Infinity], [2, 0], ["3.9", "20"]]) {
        const reading = getHpReading(current, maximum);
        assert.ok(Number.isFinite(reading.percent));
        assert.ok(reading.now >= 0 && reading.now <= reading.max);
        assert.ok(reading.percent >= 0 && reading.percent <= 100);
    }
    assert.equal(getHpReading(35,20).now,20);
    assert.equal(getHpReading("3.9",20).now,3);
});
