import assert from "node:assert/strict";
import test from "node:test";
import { File } from "node:buffer";
import { fetchRoomAudioUrl, uploadRoomAudio } from "../src/core/roomClient.js";

const session = { code: "A2BC3D", key: "private-audio-test" };
const withBrowser = t => {
    const previous = { fetch: globalThis.fetch, window: globalThis.window };
    globalThis.window = { setTimeout, clearTimeout };
    t.after(() => { globalThis.fetch = previous.fetch; globalThis.window = previous.window; });
};

test("audio loading preserves authenticated headers and creates one revocable file URL", async t => {
    withBrowser(t);
    let calls = 0;
    globalThis.fetch = async (path, options) => {
        calls++;
        assert.equal(path, "/api/rooms/A2BC3D/audio/track-1");
        assert.equal(options.headers["x-myowndex-room-key"], session.key);
        assert.ok(options.headers["x-myowndex-room-protocol"]);
        assert.equal(options.cache, "no-store");
        return new Response("audio", { headers: { "content-type": "audio/ogg", "content-length": "5" } });
    };
    const url = await fetchRoomAudioUrl(session, "track-1");
    assert.match(url, /^blob:/);
    assert.equal(calls, 1);
    URL.revokeObjectURL(url);
});

test("database-backed audio is rebuilt from authenticated chunks in the original order", async t => {
    withBrowser(t);
    const pieces = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), new Uint8Array([6, 7, 8, 9])];
    const requested = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    let capturedBlob = null;
    URL.createObjectURL = blob => { capturedBlob = blob; return "blob:audio-test"; };
    URL.revokeObjectURL = () => {};
    t.after(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });
    globalThis.fetch = async (path, options) => {
        requested.push(path);
        assert.equal(options.headers["x-myowndex-room-key"], session.key);
        if (!String(path).includes("?chunk=")) {
            return Response.json({
                chunked: true,
                mimeType: "audio/ogg",
                size: 9,
                chunkCount: 3,
            });
        }
        const index = Number(new URL(String(path), "https://myowndex.test").searchParams.get("chunk"));
        const bytes = pieces[index];
        return new Response(bytes, {
            headers: { "content-type": "application/octet-stream", "content-length": String(bytes.byteLength) },
        });
    };

    const url = await fetchRoomAudioUrl(session, "track-db");
    assert.equal(url, "blob:audio-test");
    const rebuilt = new Uint8Array(await capturedBlob.arrayBuffer());
    assert.deepEqual([...rebuilt], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(requested.filter(path => String(path).includes("?chunk=")).length, 3);
});

test("database-backed uploads split a track, retry safely through room requests and then complete it", async t => {
    withBrowser(t);
    const chunkSize = 64 * 1024;
    const bytes = new Uint8Array(chunkSize * 2 + 123);
    bytes.forEach((_, index) => { bytes[index] = index % 251; });
    const file = new File([bytes], "route-theme.ogg", { type: "audio/ogg" });
    const uploaded = new Map();
    let prepared = false;
    let completed = false;

    globalThis.fetch = async (path, options) => {
        const url = new URL(String(path), "https://myowndex.test");
        if (options.method === "POST") {
            const payload = JSON.parse(options.body);
            if (payload.action === "prepare") {
                prepared = true;
                assert.equal(payload.size, file.size);
                return Response.json({
                    mode: "database",
                    uploadId: "audio-test",
                    chunkSize,
                    chunkCount: 3,
                });
            }
            assert.equal(payload.action, "complete-database");
            assert.equal(payload.uploadId, "audio-test");
            completed = true;
            return Response.json({ media: { id: "audio-test", title: "Rota", mimeType: "audio/ogg", size: file.size } }, { status: 201 });
        }
        assert.equal(options.method, "PUT");
        assert.equal(options.headers.get("content-type"), "application/octet-stream");
        const index = Number(url.searchParams.get("index"));
        uploaded.set(index, new Uint8Array(await options.body.arrayBuffer()));
        return Response.json({ ok: true, index });
    };

    const progress = [];
    const result = await uploadRoomAudio(session, file, "Rota", value => progress.push(value));
    assert.equal(prepared, true);
    assert.equal(completed, true);
    assert.equal(result.media.id, "audio-test");
    assert.equal(uploaded.size, 3);
    const rebuilt = new Uint8Array(file.size);
    let offset = 0;
    for (let index = 0; index < 3; index++) {
        const part = uploaded.get(index);
        rebuilt.set(part, offset);
        offset += part.byteLength;
    }
    assert.deepEqual(rebuilt, bytes);
    assert.equal(progress.at(-1), 1);
});

test("an already cancelled audio choice never starts a request", async t => {
    withBrowser(t);
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("audio"); };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(fetchRoomAudioUrl(session, "track-1", { signal: controller.signal }), { name: "AbortError" });
    assert.equal(calls, 0);
});

test("changing tracks cancels an in-flight request without retrying the obsolete choice", async t => {
    withBrowser(t);
    let calls = 0, started;
    const ready = new Promise(resolve => { started = resolve; });
    globalThis.fetch = (_path, options) => new Promise((_resolve, reject) => {
        calls++; started();
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    });
    const controller = new AbortController();
    const request = fetchRoomAudioUrl(session, "track-1", { signal: controller.signal });
    await ready; controller.abort();
    await assert.rejects(request, { name: "AbortError" });
    assert.equal(calls, 1);
});

test("an oversized declared track is cancelled before its body is read", async t => {
    withBrowser(t);
    let cancelled = false, calls = 0;
    globalThis.fetch = async () => {
        calls++;
        const body = new ReadableStream({ cancel() { cancelled = true; } });
        return new Response(body, { headers: { "content-type": "audio/ogg", "content-length": String(25 * 1024 * 1024) } });
    };
    await assert.rejects(fetchRoomAudioUrl(session, "too-large"), /24 MB/);
    assert.equal(cancelled, true);
    assert.equal(calls, 1);
});
