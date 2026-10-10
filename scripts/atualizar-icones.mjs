// Human-authored Pokédex illustration: Carol Liao / toicon.com, CC BY 4.0 (2017).
// Only palette, background and framing are adapted; every device path is preserved.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const iconDirectory = new URL("../public/icons/", import.meta.url);
const identity = "myowndex-dex-v105";
const original = await readFile(new URL(`${identity}-original.svg`, iconDirectory));
const sourceSha256 = "337e0187c6fbadf7700a643354a1cd9f03a3670564e590d869de49c95025d1b0";
if (createHash("sha256").update(original).digest("hex") !== sourceSha256) {
  throw new Error("The preserved human-authored SVG differs from the verified upstream source.");
}
const palette = {
  "#FF786E": "#ee2947", "#BE5652": "#b80f31", "#6BC4D2": "#22bdf0",
  "#CCCCCC": "#0b3152", "#EFEAE0": "#0b3152", "#FFC865": "#18b5f0", "#BE9148": "#0475b7",
};
let artworkSource = original.toString("utf8")
  // The first inner group is the original decorative teal circle, not the device.
  .replace(/<g>\s*<g>[\s\S]*?<\/g>/, "<g>")
  .replace('viewBox="0 0 64 64"', 'viewBox="1 4 59 59"');
for (const [previous, next] of Object.entries(palette)) artworkSource = artworkSource.replaceAll(previous, next);
artworkSource = artworkSource.replace("<title property=", "<!-- MyOwnDex adaptation: colors and framing; Carol Liao / toicon.com, CC BY 4.0. -->\n<title property=");
const drawing = Buffer.from(artworkSource);
await writeFile(new URL(`${identity}-source.svg`, iconDirectory), drawing);
const backgroundColor = { r: 11, g: 49, b: 82, alpha: 1 };

await writeFile(new URL(`${identity}-master.png`, iconDirectory),
  await sharp(drawing).resize(1024, 1024).png({ compressionLevel: 9 }).toBuffer());

async function renderIcon(size, { suffix = String(size), opaque = true, maskable = false } = {}) {
  // The flat open device fits Android's central 80% safe circle at this framing.
  const artworkSize = maskable ? Math.floor(size * 0.78) : size;
  const artwork = await sharp(drawing).resize(artworkSize, artworkSize).png({ compressionLevel: 9 }).toBuffer();
  const content = opaque
    ? await sharp({ create: { width: size, height: size, channels: 4, background: backgroundColor } })
      .composite([{ input: artwork, gravity: "centre" }]).png({ compressionLevel: 9 }).toBuffer()
    : artwork;
  const target = new URL(`${identity}-${suffix}.png`, iconDirectory);
  await writeFile(target, content);
  process.stdout.write(`${fileURLToPath(target)} (${content.byteLength} bytes)\n`);
}

for (const size of [32, 96]) await renderIcon(size, { opaque: false });
for (const size of [180, 192]) await renderIcon(size);
await renderIcon(512, { opaque: false });
await renderIcon(512, { suffix: "app-512" });
await renderIcon(512, { suffix: "maskable-512", maskable: true });
