import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import test from "node:test";

const name = "myowndex-dex-v105";
const directory = new URL("../public/icons/", import.meta.url);
const outputs = [
  ["32", 32, false], ["96", 96, false], ["180", 180, true],
  ["192", 192, true], ["512", 512, false], ["app-512", 512, true],
  ["maskable-512", 512, true], ["master", 1024, false],
];

test("the shared human-drawn identity remains visible and inexpensive at every icon size", async () => {
  let bytes = 0;
  for (const [suffix, size, opaque] of outputs) {
    const content = await readFile(new URL(`${name}-${suffix}.png`, directory));
    bytes += content.length;
    const { data, info } = await sharp(content).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    let visible = 0, transparent = 0, minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const alpha = data[(y * size + x) * 4 + 3];
      visible += alpha / 255;
      transparent += Number(alpha === 0);
      if (alpha > 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (opaque) assert.equal(transparent, 0, `${suffix}: launch and share backgrounds fully cover their canvas`);
    else {
      assert.ok(visible > size * size * 0.38, `${suffix}: the device remains prominent`);
      assert.ok((maxX - minX + 1) / size >= 0.88, `${suffix}: the silhouette fills the available width`);
      assert.ok((maxY - minY + 1) / size >= 0.65, `${suffix}: the silhouette remains legible in its frame`);
      assert.ok(transparent > 0, `${suffix}: the device has no rectangular white surround`);
    }
  }
  assert.ok(bytes < 192 * 1024, `the complete identity uses ${bytes} bytes, below 192 KiB`);
});

test("the adapted brand preserves every device path from its verified 2017 human-authored source", async () => {
  const original = await readFile(new URL(`${name}-original.svg`, directory));
  assert.equal(createHash("sha256").update(original).digest("hex"),
    "337e0187c6fbadf7700a643354a1cd9f03a3670564e590d869de49c95025d1b0");
  const source = await readFile(new URL(`${name}-source.svg`, directory), "utf8");
  const paths = svg => [...svg.matchAll(/<path[^>]+\sd="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(paths(source), paths(original.toString("utf8")).slice(2),
    "only the two decorative background paths may be removed; no new drawing replaces the original device");
  assert.match(source, /Carol Liao/);
  assert.match(source, /creativecommons\.org\/licenses\/by\/4\.0/);
});

test("every foreground pixel of the maskable identity survives the standard safe-circle crop", async () => {
  const content = await readFile(new URL(`${name}-maskable-512.png`, directory));
  const { data, info } = await sharp(content).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const center = info.width / 2;
  const radius = info.width * 0.4;
  let foreground = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const index = (y * info.width + x) * 4;
    if (data[index] === 11 && data[index + 1] === 49 && data[index + 2] === 82) continue;
    foreground++;
    assert.ok(Math.hypot(x + 0.5 - center, y + 0.5 - center) <= radius,
      `foreground pixel ${x},${y} must remain inside the maskable safe circle`);
  }
  assert.ok(foreground > 50000, "the safely framed device remains large enough to identify");
});
