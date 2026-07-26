import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyOwnDex",
  description: "Sua Pokédex, seu PC e sua Sala RPG Pokémon reunidos para a próxima aventura.",
  manifest: "/manifest.webmanifest",
  applicationName: "MyOwnDex",
  appleWebApp: {
    capable: true,
    title: "MyOwnDex",
    statusBarStyle: "black-translucent",
  },
  other: {
    "codex-preview": "development",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#7f1d1d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
