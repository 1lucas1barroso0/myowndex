import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nativeSprites from "../src/data/native-sprites.json" with { type: "json" };

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const asset = url => {
    assert.match(url, /^\/sprites\/native\/[a-z0-9-]+\.(?:gif|apng|png)$/);
    return readFile(`public${url}`);
};

const pngChunks = bytes => {
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const chunks = [];
    for (let offset = 8; offset < bytes.length;) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString("ascii", offset + 4, offset + 8);
        chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
        offset += 12 + length;
    }
    return chunks;
};

const gifAnimation = bytes => {
    assert.match(bytes.subarray(0, 6).toString("ascii"), /^GIF8[79]a$/);
    let offset = 13 + (bytes[10] & 128 ? 3 * (2 ** ((bytes[10] & 7) + 1)) : 0);
    let frames = 0, durationMs = 0, delay = 0, transparent = false;
    const blocks = () => {
        while (bytes[offset]) offset += bytes[offset] + 1;
        offset += 1;
    };
    while (offset < bytes.length) {
        const marker = bytes[offset++];
        if (marker === 0x3b) break;
        if (marker === 0x21) {
            const label = bytes[offset++];
            if (label === 0xf9) {
                assert.equal(bytes[offset], 4);
                transparent = Boolean(bytes[offset + 1] & 1);
                delay = bytes.readUInt16LE(offset + 2) * 10;
            }
            blocks();
        } else if (marker === 0x2c) {
            const packed = bytes[offset + 8];
            offset += 9 + (packed & 128 ? 3 * (2 ** ((packed & 7) + 1)) : 0);
            offset += 1; // LZW minimum code size.
            blocks();
            assert.equal(transparent, true, "native animation keeps transparency");
            frames += 1;
            durationMs += delay;
        } else assert.fail(`Unexpected GIF block ${marker}`);
    }
    return { frames, durationMs };
};

test("imported EBDX animation keeps verified authored frames, timing, alpha and the exact first-frame recovery", async () => {
    const provenance = JSON.parse(await readFile("public/sprites/native/provenance-ebdx.json", "utf8"));
    assert.match(provenance.commit, /^[a-f0-9]{40}$/);
    assert.ok(provenance.assets.length >= 44);
    for (const entry of provenance.assets) {
        const bytes = await asset(entry.animated);
        assert.equal(digest(bytes), entry.gifSha256, entry.animated);
        assert.equal(digest(await asset(entry.static)), entry.staticSha256, entry.static);
        const animation = gifAnimation(bytes);
        assert.equal(animation.frames, entry.encodedFrames, entry.animated);
        assert.equal(animation.durationMs, entry.durationMs, entry.animated);
        assert.ok(entry.uniqueFrames > 1, entry.animated);
        assert.equal(entry.pixelAlphaTimelineVerified, true);
        const view = [entry.view === "back" && "back", entry.shiny && "shiny"].filter(Boolean).join("/");
        assert.deepEqual(nativeSprites.local[String(entry.pokemonId)][view], { animated: entry.animated, static: entry.static });
    }
});

test("PMD APNG keeps partial alpha, native frame order and internal body movement without artificial translation", async () => {
    const provenance = JSON.parse(await readFile("public/sprites/native/provenance-pmd.json", "utf8"));
    assert.match(provenance.pin, /^[a-f0-9]{40}$/);
    assert.equal(provenance.license, "CC BY-NC 4.0");
    assert.ok(provenance.records.length >= 130);
    for (const entry of provenance.records) for (const direction of ["front", "back"]) {
        const frame = entry[direction];
        const bytes = await asset(frame.animated);
        assert.equal(digest(bytes), frame.sha256, frame.animated);
        const chunks = pngChunks(bytes);
        const animation = chunks.find(chunk => chunk.type === "acTL");
        assert.ok(animation, frame.animated);
        assert.equal(animation.data.readUInt32BE(4), 0, "authored animation loops naturally");
        const frames = chunks.filter(chunk => chunk.type === "fcTL");
        assert.equal(frames.length, frame.animatedFrames, frame.animated);
        assert.ok(frames.length > 1 && frame.distinctBodyFrames > 1, frame.animated);
        const durationMs = frames.reduce((sum, chunk) => sum + 1000 * chunk.data.readUInt16BE(20) / (chunk.data.readUInt16BE(22) || 100), 0);
        assert.ok(Math.abs(durationMs - frame.animationDurationMs) < 0.01, frame.animated);
        assert.ok(Math.abs(durationMs - frame.nativeTicks.reduce((sum, value) => sum + value, 0) * 1000 / frame.nativeFps) <= 0.5, frame.animated);
        const still = await asset(frame.static);
        assert.equal(digest(still), frame.staticSha256, frame.static);
        assert.ok(pngChunks(still).every(chunk => chunk.type !== "acTL"), "reduced motion really uses one still frame");
        assert.ok(entry.authors.length > 0, `${entry.key} has artist attribution`);
        const view = [direction === "back" && "back", entry.shiny && "shiny"].filter(Boolean).join("/");
        assert.deepEqual(nativeSprites.local[entry.key][view], { animated: frame.animated, static: frame.static });
    }
});

test("Mega Barbaracle shiny uses its exact authored menu icon and native 250ms cycle", async () => {
    const icon = JSON.parse(await readFile("public/sprites/native/provenance-menu-icon.json", "utf8"));
    assert.equal(icon.type, "native-menu-icon");
    assert.equal(icon.pokemonId, 10298);
    assert.equal(icon.shiny, true);
    assert.equal(icon.view, "front");
    assert.equal(icon.pixelAlphaVerified, true);
    assert.equal(icon.nativeFrames, 2);
    const bytes = await asset(icon.animated);
    assert.equal(digest(bytes), icon.assets[icon.animated.split("/").at(-1)].sha256);
    const frames = pngChunks(bytes).filter(chunk => chunk.type === "fcTL");
    assert.equal(frames.length, 2);
    const durationMs = frames.reduce((sum, chunk) => sum + 1000 * chunk.data.readUInt16BE(20) / chunk.data.readUInt16BE(22), 0);
    assert.equal(durationMs, 250);
    assert.equal(icon.nativeCycleMs, durationMs);
    assert.equal(digest(await asset(icon.static)), icon.assets[icon.static.split("/").at(-1)].sha256);
    assert.deepEqual(nativeSprites.local["10298"].shiny, { animated: icon.animated, static: icon.static });
    assert.equal(nativeSprites.local["10298"]["back/shiny"], undefined, "a front menu icon must never stand in for a back angle");
});
