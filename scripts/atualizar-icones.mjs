// Every surface uses the same original RotomDex artwork, including small favicons.
import { ImageResponse } from "next/og.js";
import { createElement } from "react";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const iconDirectory = new URL("../public/icons/", import.meta.url);
const master = await readFile(new URL("myowndex-rotomdex-v103-master.png", iconDirectory));
const source = `data:image/png;base64,${master.toString("base64")}`;
const backgroundColor = "#fff7e8";

async function renderIcon(size, { suffix = String(size), opaque = true, maskable = false } = {}) {
  // The essential silhouette stays inside Android's central 80% safe circle.
  const artworkSize = maskable ? Math.floor(size * 0.7) : size;
  const response = new ImageResponse(
    createElement("div", {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: opaque ? backgroundColor : "transparent",
      },
    }, createElement("img", { src: source, width: artworkSize, height: artworkSize, alt: "" })),
    { width: size, height: size },
  );
  const target = new URL(`myowndex-rotomdex-v103-${suffix}.png`, iconDirectory);
  const content = Buffer.from(await response.arrayBuffer());
  await writeFile(target, content);
  process.stdout.write(`${fileURLToPath(target)} (${content.byteLength} bytes)\n`);
}

for (const size of [32, 96]) await renderIcon(size, { opaque: false });
for (const size of [180, 192]) await renderIcon(size);
await renderIcon(512, { opaque: false });
await renderIcon(512, { suffix: "app-512" });
await renderIcon(512, { suffix: "maskable-512", maskable: true });
