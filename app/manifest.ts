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
      { src: "/icons/myowndex-icon-v100.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/myowndex-maskable-v100.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    categories: ["games", "utilities"],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Central da Aventura", short_name: "Aventura", url: "/?abrir=aventura", icons: [{ src: "/icons/myowndex-icon-v100.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Pokédex", short_name: "Pokédex", url: "/?abrir=pokedex", icons: [{ src: "/icons/myowndex-icon-v100.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "PC do Bill", short_name: "PC", url: "/?abrir=pc", icons: [{ src: "/icons/myowndex-icon-v100.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Guia do Treinador", short_name: "Guia", url: "/?abrir=guia", icons: [{ src: "/icons/myowndex-icon-v100.svg", sizes: "any", type: "image/svg+xml" }] },
    ],
  };
}
