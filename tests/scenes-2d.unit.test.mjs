import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { ROOM_SCENARIOS } from "../src/core/room.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

// Decode the generated RGB PNG so a valid-looking manifest cannot conceal
// a stale map, changed pixels, an oversized export, or an empty background.
const decodeMap = png => {
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    assert.equal(png[24], 8);
    assert.equal(png[25], 2);
    assert.equal(png[28], 0);
    const compressed = [];
    for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset);
        if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") compressed.push(png.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
    }
    const encoded = inflateSync(Buffer.concat(compressed));
    const stride = width * 3, decoded = Buffer.alloc(stride * height);
    const paeth = (left, top, corner) => {
        const estimate = left + top - corner;
        const a = Math.abs(estimate - left), b = Math.abs(estimate - top), c = Math.abs(estimate - corner);
        return a <= b && a <= c ? left : b <= c ? top : corner;
    };
    for (let y = 0; y < height; y++) {
        const filter = encoded[y * (stride + 1)];
        assert.ok(filter >= 0 && filter <= 4);
        for (let x = 0; x < stride; x++) {
            const index = y * stride + x;
            const left = x >= 3 ? decoded[index - 3] : 0;
            const top = y ? decoded[index - stride] : 0;
            const corner = y && x >= 3 ? decoded[index - stride - 3] : 0;
            const prediction = filter === 1 ? left : filter === 2 ? top : filter === 3 ? Math.floor((left + top) / 2) : filter === 4 ? paeth(left, top, corner) : 0;
            decoded[index] = (encoded[y * (stride + 1) + x + 1] + prediction) & 255;
        }
    }
    return { width, height, decoded };
};

test("nine local 2D maps preserve licensed source pixels, useful landmarks, and a small resource budget", async () => {
    const manifest = JSON.parse(await read("public/scenes/source/provenance.json"));
    assert.equal(manifest.license, "CC0-1.0");
    assert.equal(manifest.sourceSha256, sha(await read("public/scenes/source/kenney-roguelike.png")));
    assert.match((await read("public/scenes/source/LICENSE-kenney.txt")).toString(), /Creative Commons Zero, CC0/);
    for (const source of manifest.additionalSources) {
        assert.equal(source.license, "CC0-1.0");
        assert.equal(source.sourceSha256, sha(await read(`public/scenes/source/kenney-${source.name}.png`)));
        assert.match((await read(`public/scenes/source/LICENSE-${source.name}.txt`)).toString(), /Creative Commons Zero, CC0/);
    }
    assert.deepEqual(manifest.scenes.map(scene => scene.id), ROOM_SCENARIOS.map(scene => scene.id));
    const hashes = new Set();
    let total = 0;
    for (const scene of manifest.scenes) {
        const asset = await read(`public/scenes/${scene.id}.svg`);
        const svg = asset.toString();
        total += asset.length;
        assert.equal(asset.length, scene.bytes);
        assert.ok(asset.length < 12000, `${scene.id}: keep a single map light`);
        assert.ok(scene.features.length >= 3, `${scene.id}: distinct useful landmarks`);
        assert.doesNotMatch(svg, /<(?:filter|foreignObject|script|animate|linearGradient|radialGradient)\b/);
        assert.equal((svg.match(/<image\b/g) || []).length, 1);
        assert.match(svg, new RegExp(`<title>${scene.title}</title>`));
        const encoded = svg.match(/href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
        assert.ok(encoded, `${scene.id}: no external scene requests`);
        const { width, height, decoded } = decodeMap(Buffer.from(encoded[1], "base64"));
        assert.equal(width, 480);
        assert.equal(height, 320);
        assert.equal(sha(decoded), scene.pixelSha256);
        const colors = new Set();
        for (let index = 0; index < decoded.length; index += 3) colors.add(decoded.readUIntBE(index, 3));
        assert.ok(colors.size >= 8, `${scene.id}: recognizable tiles rather than an empty flat surface`);
        hashes.add(scene.pixelSha256);
    }
    assert.equal(hashes.size, 9);
    assert.ok(total < 60000, `all nine maps stay below 60 KB (${total})`);
});

test("the scene camera shows every map, and the PC companion has no fake loading bars", async () => {
    const camera = (await read("src/battlefield-polish.css")).toString();
    const art = (await read("src/game-art-direction.css")).toString();
    assert.match(camera, /\.battlefield-board\.is-empty-field\s*\{[\s\S]*?aspect-ratio:\s*3\s*\/\s*2/);
    assert.match(camera, /\.battlefield-scenery\s*\{[^}]*object-fit:\s*contain/);
    assert.doesNotMatch(camera, /\.battlefield-scenery\s*\{[^}]*object-fit:\s*cover/);
    assert.match(art, /\.pc-sidebar-heading::after\s*\{\s*content:\s*none;\s*display:\s*none;/);
});

test("the authored terrain details remain reproducible from the source manifest", async () => {
  const layers = JSON.parse(await read("public/scenes/source/decorations.json"));
  for (const [id, layer] of Object.entries(layers)) {
    const svg = (await read("public/scenes/" + id + ".svg")).toString();
    assert.ok(svg.includes(layer), id + ": the exported map matches its source");
    assert.equal((svg.match(/<image\b/g) || []).length, 1);
  }
});
