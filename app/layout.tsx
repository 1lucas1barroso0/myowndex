import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyOwnDex",
  description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos em um só lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "MyOwnDex",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/myowndex-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "MyOwnDex",
    description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos em um só lugar.",
    images: [{ url: "/icons/myowndex-512.png", width: 512, height: 512, alt: "Ícone do MyOwnDex" }],
  },
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
  viewportFit: "cover",
  themeColor: "#7f1d1d",
};

const themeBootScript = `try{const saved=JSON.parse(localStorage.getItem("myowndex_appearance_v1")||'"system"');const preference=["normal","night","system"].includes(saved)?saved:"system";const resolved=preference==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"night":"normal"):preference;document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themePreference=preference;document.documentElement.style.colorScheme=resolved==="night"?"dark":"light"}catch{}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
