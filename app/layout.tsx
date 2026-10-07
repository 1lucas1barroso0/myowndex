import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://myowndex.vercel.app"),
  title: "MyOwnDex",
  description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos em um só lugar.",
  manifest: "/manifest.webmanifest",
  applicationName: "MyOwnDex",
  icons: {
    icon: [
      { url: "/icons/myowndex-rotomdex-v102.svg", type: "image/svg+xml" },
      { url: "/icons/myowndex-rotomdex-v102.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: "/icons/myowndex-rotomdex-v102.svg",
    apple: [{ url: "/icons/myowndex-rotomdex-v102.svg", sizes: "any", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "MyOwnDex",
    description: "Pokédex, PC do Bill, Guia do Treinador e Central da Aventura reunidos em um só lugar.",
    images: [{ url: "/icons/myowndex-rotomdex-v102.svg", width: 512, height: 512, alt: "Ícone do MyOwnDex" }],
  },
  twitter: {
    card: "summary",
    title: "MyOwnDex",
    description: "Sua Pokédex, suas Boxes e sua aventura Pokémon em um só lugar.",
    images: ["/icons/myowndex-rotomdex-v102.svg"],
  },
  appleWebApp: {
    capable: true,
    title: "MyOwnDex",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#cf2844",
};

const themeBootScript = `try{const identity=JSON.parse(localStorage.getItem("myowndex_account_identity_v1")||'null');const key=identity&&typeof identity.id==="string"&&identity.id.length<=128?"myowndex_account:"+encodeURIComponent(identity.id)+":myowndex_appearance_v1":"myowndex_appearance_v1";const saved=JSON.parse(localStorage.getItem(key)||'"normal"');const resolved=saved==="night"?"night":saved==="system"&&matchMedia("(prefers-color-scheme: dark)").matches?"night":"normal";document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themePreference=resolved;document.documentElement.style.colorScheme=resolved==="night"?"dark":"light"}catch{}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
