// Raster variants retain one RotomDex master; no platform gets a different mascot.
import { ImageResponse } from "next/og.js";
import { createElement } from "react";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const iconDirectory = new URL("../public/icons/", import.meta.url);
const master = await readFile(new URL("myowndex-rotomdex-v101.svg", iconDirectory));
const source = `data:image/svg+xml;base64,${master.toString("base64")}`;

async function renderIcon(size, maskable = false) {
  // The essential silhouette stays inside Android's central 80% safe circle.
  const artworkSize = maskable ? Math.floor(size * 0.74) : size;
  const response = new ImageResponse(
    createElement("div", {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff7e8",
      },
    }, createElement("img", { src: source, width: artworkSize, height: artworkSize, alt: "" })),
    { width: size, height: size },
  );
  const suffix = maskable ? `maskable-${size}` : String(size);
  const target = new URL(`myowndex-rotomdex-v101-${suffix}.png`, iconDirectory);
  const content = Buffer.from(await response.arrayBuffer());
  await writeFile(target, content);
  process.stdout.write(`${fileURLToPath(target)} (${content.byteLength} bytes)\n`);
}

for (const size of [96, 180, 192, 512]) await renderIcon(size);
await renderIcon(512, true);
