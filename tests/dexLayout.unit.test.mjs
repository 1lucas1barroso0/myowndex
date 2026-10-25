import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dexWindowSize } from '../src/core/dexLayout.js';
test('wide and zoomed-out displays fill the viewport and complete legitimate rows', () => {
    assert.equal(dexWindowSize({ columns: 17, rowHeight: 180, viewportHeight: 1100, current: 60, total: 1025 }), 136);
    assert.equal(dexWindowSize({ columns: 7, rowHeight: 200, viewportHeight: 600, current: 60, total: 1025 }), 63);
});
test('resize preserves loaded results; a finished filter may have an incomplete row', () => {
    assert.equal(dexWindowSize({ columns: 2, rowHeight: 200, viewportHeight: 600, current: 136, total: 1025 }), 136);
    assert.equal(dexWindowSize({ columns: 7, rowHeight: 200, viewportHeight: 600, current: 60, total: 19 }), 19);
    assert.equal(dexWindowSize({ columns: 7, rowHeight: 200, viewportHeight: 600, total: 0 }), 0);
});
