import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyOwnDex",
  description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos em um só lugar.",
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
