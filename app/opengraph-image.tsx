import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "RotomDex do MyOwnDex: uma Pokédex laranja com olhos azuis e braços em forma de raio.";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const icon = await readFile(join(process.cwd(), "public/icons/myowndex-rotomdex-v103-app-512.png"));
const iconSource = `data:image/png;base64,${icon.toString("base64")}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#fff7e8",
        }}
      >
        <img src={iconSource} width={512} height={512} alt="" />
      </div>
    ),
    size,
  );
}
