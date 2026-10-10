import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Pokédex do MyOwnDex";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const icon = await readFile(join(process.cwd(), "public/icons/myowndex-dex-v105-app-512.png"));
const iconSource = `data:image/png;base64,${icon.toString("base64")}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#0b3152",
        }}
      >
        <img src={iconSource} width={512} height={512} alt="" />
      </div>
    ),
    size,
  );
}
