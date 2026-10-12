import type { Metadata } from "next";
import RecoveryInstaller from "../../src/components/Shared/RecoveryInstaller.jsx";

export const metadata: Metadata = {
  title: "Recuperar a instalação · MyOwnDex",
  description: "Instalação alternativa para celulares que ainda reconhecem uma cópia removida do MyOwnDex.",
  manifest: "/manifest-resgate.webmanifest",
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  return <RecoveryInstaller />;
}
