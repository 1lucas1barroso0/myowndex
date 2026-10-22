import test from "node:test";
import assert from "node:assert/strict";
import { createFrameQueue } from "../src/core/frameQueue.js";

function fixture() {
    let id = 0;
    const callbacks = new Map(), values = [];
    const queue = createFrameQueue({ publish: value => values.push(value),
        request: fn => { callbacks.set(++id, fn); return id; },
        cancel: key => callbacks.delete(key),
    });
    const paint = () => { const tasks = [...callbacks.values()]; callbacks.clear(); tasks.forEach(fn => fn()); };
    return { queue, callbacks, values, paint };
}

test("a burst of pointer previews paints only its final position each frame", () => {
    const { queue, callbacks, values, paint } = fixture();
    for (let x = 0; x < 1000; x++) queue.schedule({ x });
    assert.equal(callbacks.size, 1);
    assert.deepEqual(values, []);
    paint();
    assert.deepEqual(values, [{ x: 999 }]);
    queue.schedule({ x: 1000 }); paint();
    assert.deepEqual(values.at(-1), { x: 1000 });
});

test("finish, cancellation and teardown cannot replay a stale pointer preview", () => {
    const { queue, callbacks, values, paint } = fixture();
    queue.schedule({ x: 1 }); queue.set(null); paint();
    assert.deepEqual(values, [null]);
    assert.equal(callbacks.size, 0);
    queue.schedule({ x: 2 }); queue.cancel(); paint();
    assert.deepEqual(values, [null]);
    queue.schedule({ x: 3 }); paint();
    assert.deepEqual(values.at(-1), { x: 3 }, "the next gesture still works");
});
