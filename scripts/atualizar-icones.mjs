// Human-authored Pokédex illustration: Carol Liao / toicon.com, CC BY 4.0 (2017).
// Palette, outlines, framing and device lights are adapted; every device path is preserved.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const iconDirectory = new URL("../public/icons/", import.meta.url);
const identity = "myowndex-dex-v105-r3";
const original = await readFile(new URL("myowndex-dex-v105-original.svg", iconDirectory));
const sourceSha256 = "337e0187c6fbadf7700a643354a1cd9f03a3670564e590d869de49c95025d1b0";
if (createHash("sha256").update(original).digest("hex") !== sourceSha256) {
  throw new Error("The preserved human-authored SVG differs from the verified upstream source.");
}
const palette = {
  "#FF786E": "#ff6478", "#BE5652": "#c42b50", "#6BC4D2": "#ffe16b",
  "#CCCCCC": "#1d9ec6", "#EFEAE0": "#8eeef4", "#FFC865": "#63e4ff", "#BE9148": "#0686c4",
};
let artworkSource = original.toString("utf8")
  // The first inner group is the original decorative teal circle, not the device.
  .replace(/<g>\s*<g>[\s\S]*?<\/g>/, "<g>")
  .replace('viewBox="0 0 64 64"', 'viewBox="1 4 59 59"');
for (const [previous, next] of Object.entries(palette)) artworkSource = artworkSource.replaceAll(previous, next);
artworkSource = artworkSource.replace("<title property=", "<!-- MyOwnDex adaptation: colors, outlines, framing and device lights; Carol Liao / toicon.com, CC BY 4.0. -->\n<title property=");
artworkSource = artworkSource
  .replaceAll('class="fandom_een"', 'class="fandom_een" stroke="#fff4dc" stroke-width="0.7" stroke-linejoin="round"')
  .replaceAll('class="fandom_twee"', 'class="fandom_twee" stroke="#fff4dc" stroke-width="0.5" stroke-linejoin="round"');
const drawing = Buffer.from(artworkSource);
const animated = artworkSource.replace('</svg>', `<style>
  @keyframes dex-screen { 0%,100% { fill:#8eeef4; } 45%,65% { fill:#d9ffe7; } }
  @keyframes dex-lens { 0%,100% { fill:#63e4ff; } 45%,65% { fill:#d9fbff; } }
  .fandom_veertien { animation:dex-screen 6s ease-in-out infinite; }
  .fandom_vier { animation:dex-lens 6s ease-in-out infinite; }
  @media (prefers-reduced-motion:reduce) { .fandom_veertien,.fandom_vier { animation:none; } }
</style></svg>`);
await writeFile(new URL(`${identity}-live.svg`, iconDirectory), animated);
await writeFile(new URL(`${identity}-source.svg`, iconDirectory), drawing);
const backgroundColor = { r: 11, g: 49, b: 82, alpha: 1 };

await writeFile(new URL(`${identity}-master.png`, iconDirectory),
  await sharp(drawing).resize(1024, 1024).png({ compressionLevel: 9 }).toBuffer());

async function renderIcon(size, { suffix = String(size), opaque = true, maskable = false } = {}) {
  // Leave room for the outline inside Android's central 80% safe circle.
  const artworkSize = maskable ? Math.floor(size * 0.76) : size;
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
