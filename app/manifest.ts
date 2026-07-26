import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyOwnDex — Central da Aventura",
    short_name: "MyOwnDex",
    description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos para acompanhar toda a sua jornada Pokémon.",
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
