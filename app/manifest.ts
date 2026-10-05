import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyOwnDex — Central da Aventura",
    short_name: "MyOwnDex",
    description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos para acompanhar toda a sua jornada Pokémon.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e8eced",
    theme_color: "#cf2844",
    orientation: "any",
    lang: "pt-BR",
    icons: [
      { src: "/icons/myowndex-icon-v204.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/myowndex-icon-v204.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icons/myowndex-app-192-v91.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/myowndex-app-512-v91.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/myowndex-maskable-512-v91.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      {
        src: "/icons/myowndex-icon-v91.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    categories: ["games", "utilities"],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Central da Aventura", short_name: "Aventura", url: "/?abrir=aventura", icons: [{ src: "/icons/myowndex-icon-v204.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Pokédex", short_name: "Pokédex", url: "/?abrir=pokedex", icons: [{ src: "/icons/myowndex-icon-v204.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "PC do Bill", short_name: "PC", url: "/?abrir=pc", icons: [{ src: "/icons/myowndex-icon-v204.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Guia do Treinador", short_name: "Guia", url: "/?abrir=guia", icons: [{ src: "/icons/myowndex-icon-v204.svg", sizes: "any", type: "image/svg+xml" }] },
    ],
  };
}
