"use client";
import React, { useEffect, useState } from "react";

/** Native browser install when available; honest platform guidance elsewhere. */
export default function AppInstallControl() {
    const [installEvent, setInstallEvent] = useState(null);
    const [installed, setInstalled] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [working, setWorking] = useState(false);
    useEffect(() => {
        const check = () => setInstalled(window.matchMedia("(display-mode: standalone)").matches
            || window.matchMedia("(display-mode: fullscreen)").matches
            || navigator.standalone === true);
        const onPrompt = event => { event.preventDefault(); setInstallEvent(event); };
        const onInstalled = () => { setInstalled(true); setInstallEvent(null); setShowHelp(false); };
        check();
        const standalone = window.matchMedia("(display-mode: standalone)");
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        standalone.addEventListener?.("change", check);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
            standalone.removeEventListener?.("change", check);
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
                <p><strong>Android:</strong> abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”, se disponível.</p>
                <p><strong>iPhone ou iPad:</strong> no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>
                <p><strong>Firefox no computador:</strong> a instalação independente pode não ser oferecida. Nesse caso, mantenha o atalho; não é possível obrigar o navegador a abrir sem sua interface.</p>
                <button type="button" className="room-primary-button" onClick={() => setShowHelp(false)}>Entendi</button>
            </section>
        </div>}
    </>;
}
