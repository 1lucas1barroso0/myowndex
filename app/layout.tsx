import type { Metadata, Viewport } from "next";
import "./globals.css";

const description = "Explore a Pokédex, crie equipes e viva sua aventura Pokémon com o MyOwnDex.";

export const metadata: Metadata = {
  metadataBase: new URL("https://myowndex.vercel.app"),
  title: "MyOwnDex",
  description,
  manifest: "/manifest.webmanifest?v=2.0.19",
  applicationName: "MyOwnDex",
  icons: {
    icon: [
      { url: "/icons/myowndex-dex-v104-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/myowndex-dex-v104-96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/icons/myowndex-dex-v104-96.png",
    apple: [{ url: "/icons/myowndex-dex-v104-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "MyOwnDex",
    description,
    siteName: "MyOwnDex",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MyOwnDex",
    description,
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
