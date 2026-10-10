import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyOwnDex",
    short_name: "MyOwnDex",
    description: "Explore a Pokédex, crie equipes e viva sua aventura Pokémon com o MyOwnDex.",
    id: "/",
    start_url: "/?abrir=aventura",
    scope: "/",
    display: "standalone",
    background_color: "#0b3152",
    theme_color: "#d91936",
    orientation: "any",
    lang: "pt-BR",
    icons: [
      { src: "/icons/myowndex-dex-v105-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/myowndex-dex-v105-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/myowndex-dex-v105-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["games"],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Central da Aventura", short_name: "Aventura", url: "/?abrir=aventura", icons: [{ src: "/icons/myowndex-dex-v105-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Pokédex", short_name: "Pokédex", url: "/?abrir=pokedex", icons: [{ src: "/icons/myowndex-dex-v105-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "PC do Bill", short_name: "PC", url: "/?abrir=pc", icons: [{ src: "/icons/myowndex-dex-v105-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Guia do Treinador", short_name: "Guia", url: "/?abrir=guia", icons: [{ src: "/icons/myowndex-dex-v105-96.png", sizes: "96x96", type: "image/png" }] },
    ],
  };
}
