import baseManifest from "../manifest";

/**
 * Opt-in Android install recovery. A distinct stable manifest id lets Chromium
 * offer a NEW installation when its original app record is stuck as installed.
 * The canonical id ("/") remains unchanged and is never replaced globally.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export function GET(): Response {
  const canonical = baseManifest();
  return Response.json({
    ...canonical,
    name: "MyOwnDex",
    short_name: "MyOwnDex",
    id: "/myowndex-resgate",
    start_url: "/reinstalar?abrir=aventura",
    scope: "/",
    shortcuts: [
      { name: "Central da Aventura", short_name: "Aventura", url: "/reinstalar?abrir=aventura", icons: [{ src: "/icons/myowndex-dex-v105-r4-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Pokédex", short_name: "Pokédex", url: "/reinstalar?abrir=pokedex", icons: [{ src: "/icons/myowndex-dex-v105-r4-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "PC do Bill", short_name: "PC", url: "/reinstalar?abrir=pc", icons: [{ src: "/icons/myowndex-dex-v105-r4-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Guia do Treinador", short_name: "Guia", url: "/reinstalar?abrir=guia", icons: [{ src: "/icons/myowndex-dex-v105-r4-96.png", sizes: "96x96", type: "image/png" }] },
    ],
  }, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0" },
  });
}
