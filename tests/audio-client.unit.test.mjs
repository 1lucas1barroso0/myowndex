import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchRoomAudioUrl } from '../src/core/roomClient.js';
const session = { code: 'A2BC3D', key: 'private-audio-test' };
const withBrowser = t => {
    const previous = { fetch: globalThis.fetch, window: globalThis.window };
    globalThis.window = { setTimeout, clearTimeout };
    t.after(() => { globalThis.fetch = previous.fetch; globalThis.window = previous.window; });
};
test('audio loading preserves authenticated headers and creates one revocable file URL', async t => {
    withBrowser(t);
    let calls = 0;
    globalThis.fetch = async (path, options) => {
        calls++;
        assert.equal(path, '/api/rooms/A2BC3D/audio/track-1');
        assert.equal(options.headers['x-myowndex-room-key'], session.key);
        assert.ok(options.headers['x-myowndex-room-protocol']);
        assert.equal(options.cache, 'no-store');
        return new Response('audio', { headers: { 'content-type': 'audio/ogg', 'content-length': '5' } });
    };
    const url = await fetchRoomAudioUrl(session, 'track-1');
    assert.match(url, /^blob:/);
    assert.equal(calls, 1);
    URL.revokeObjectURL(url);
});
test('an already cancelled audio choice never starts a request', async t => {
    withBrowser(t);
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('audio'); };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(fetchRoomAudioUrl(session, 'track-1', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(calls, 0);
});
test('changing tracks cancels an in-flight request without retrying the obsolete choice', async t => {
    withBrowser(t);
    let calls = 0, started;
    const ready = new Promise(resolve => { started = resolve; });
    globalThis.fetch = (_path, options) => new Promise((_resolve, reject) => {
        calls++; started();
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
    const controller = new AbortController();
    const request = fetchRoomAudioUrl(session, 'track-1', { signal: controller.signal });
    await ready; controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
    assert.equal(calls, 1);
});
test('an oversized declared track is cancelled before its body is read', async t => {
    withBrowser(t);
    let cancelled = false, calls = 0;
    globalThis.fetch = async () => {
        calls++;
        const body = new ReadableStream({ cancel() { cancelled = true; } });
        return new Response(body, { headers: { 'content-type': 'audio/ogg', 'content-length': String(25 * 1024 * 1024) } });
    };
    await assert.rejects(fetchRoomAudioUrl(session, 'too-large'), /24 MB/);
    assert.equal(cancelled, true);
    assert.equal(calls, 1);
});
