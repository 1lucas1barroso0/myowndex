import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyOwnDex — Sala RPG Pokémon",
    short_name: "MyOwnDex",
    description: "Pokédex, PC, regras, progressão e Sala RPG Pokémon em um único aplicativo.",
    start_url: "/",
    display: "standalone",
    background_color: "#7f1d1d",
    theme_color: "#7f1d1d",
    orientation: "any",
    lang: "pt-BR",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
