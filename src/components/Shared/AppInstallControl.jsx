"use client";
import React, { useEffect, useState } from "react";

/** Native browser install when available; honest platform guidance elsewhere. */
export default function AppInstallControl() {
    const [installEvent, setInstallEvent] = useState(null);
    const [installed, setInstalled] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [working, setWorking] = useState(false);
    useEffect(() => {
        const check = () => {
            const isApp = window.matchMedia("(display-mode: standalone)").matches
                || window.matchMedia("(display-mode: fullscreen)").matches
                || navigator.standalone === true;
            document.documentElement.dataset.myowndexInstalled = isApp ? "true" : "false";
            setInstalled(isApp);
        };
        const onPrompt = event => { event.preventDefault(); setInstallEvent(event); };
        const onInstalled = () => { setInstalled(true); setInstallEvent(null); setShowHelp(false); };
        check();
        const standalone = window.matchMedia("(display-mode: standalone)");
        const fullscreen = window.matchMedia("(display-mode: fullscreen)");
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        standalone.addEventListener?.("change", check);
        fullscreen.addEventListener?.("change", check);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
            standalone.removeEventListener?.("change", check);
            fullscreen.removeEventListener?.("change", check);
        };
    }, []);
    if (installed) return null;

    const launch = async () => {
        if (!installEvent) { setShowHelp(true); return; }
        setWorking(true);
        try {
            const event = installEvent;
            setInstallEvent(null);
            await event.prompt();
            await event.userChoice;
        } catch {
            setShowHelp(true);
        } finally { setWorking(false); }
    };
    return <>
        <button type="button" className="app-install-button" disabled={working}
            onClick={() => void launch()} aria-haspopup={installEvent ? undefined : "dialog"}>
            Instalar aplicativo
        </button>
        {showHelp && <div className="app-install-dialog-backdrop" role="presentation"
            onMouseDown={event => { if (event.target === event.currentTarget) setShowHelp(false); }}>
            <section className="app-install-dialog" role="dialog" aria-modal="true"
                aria-labelledby="app-install-dialog-title">
                <header><h2 id="app-install-dialog-title">Instalar o MyOwnDex</h2>
                    <button type="button" aria-label="Fechar" onClick={() => setShowHelp(false)}>×</button></header>
                <p>Abra o MyOwnDex pela tela inicial ou pelo menu de aplicativos, quando o seu navegador oferecer essa opção.</p>
                <p><strong>Chrome ou Edge:</strong> procure “Instalar aplicativo” no menu do navegador ou junto à barra de endereços.</p>
                <p><strong>Android:</strong> use “Instalar app”, quando disponível. “Adicionar à tela inicial” pode criar apenas um atalho que continua abrindo o navegador.</p>
                <p><strong>iPhone ou iPad:</strong> use Compartilhar → “Adicionar à Tela de Início” em um navegador que ofereça essa opção. Abra pelo ícone instalado, não por uma aba antiga.</p>
                <p><strong>Firefox no computador:</strong> a instalação independente pode não ser oferecida. Nesse caso, mantenha o atalho; não é possível obrigar o navegador a abrir sem sua interface.</p>
                <button type="button" className="room-primary-button" onClick={() => setShowHelp(false)}>Entendi</button>
            </section>
        </div>}
    </>;
}
