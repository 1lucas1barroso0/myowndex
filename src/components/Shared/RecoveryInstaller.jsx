"use client";

import HelpDialog from "./HelpDialog.jsx";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import App from "../../App.jsx";
import ErrorBoundary from "../ErrorBoundary.jsx";

const windowIsApp = () => window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || navigator.standalone === true;

/**
 * Only /reinstalar has a second, fixed PWA id. Never rewrite the normal
 * manifest or silently force a second installation onto a working device.
 */
export default function RecoveryInstaller() {
    const [appWindow, setAppWindow] = useState(null);
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const trigger = useRef(null);

    useEffect(() => {
        const check = () => setAppWindow(windowIsApp());
        const onPrompt = event => {
            if (typeof event.prompt !== "function") return;
            event.preventDefault();
            setInstallPrompt(event);
        };
        const onInstalled = () => {
            setInstallPrompt(null);
            check();
        };
        const onVisibility = () => { if (!document.hidden) check(); };
        const standalone = matchMedia("(display-mode: standalone)");
        const fullscreen = matchMedia("(display-mode: fullscreen)");
        check();
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        window.addEventListener("pageshow", check);
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", onVisibility);
        standalone.addEventListener?.("change", check);
        fullscreen.addEventListener?.("change", check);
        // The rescue page must also qualify for offline-capable installation
        // when opened directly, without first visiting the normal home page.
        if ("serviceWorker" in navigator)
            navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
            window.removeEventListener("pageshow", check);
            window.removeEventListener("focus", check);
            document.removeEventListener("visibilitychange", onVisibility);
            standalone.removeEventListener?.("change", check);
            fullscreen.removeEventListener?.("change", check);
        };
    }, []);


    const requestInstall = async () => {
        if (!confirmed || busy) return;
        if (!installPrompt) { setShowHelp(true); return; }
        setBusy(true);
        const event = installPrompt;
        setInstallPrompt(null);
        try {
            await event.prompt();
            const selection = await event.userChoice;
            if (selection?.outcome !== "accepted") setShowHelp(true);
        } catch {
            setShowHelp(true);
        } finally {
            setBusy(false);
        }
    };
    const dismissHelp = () => {
        setShowHelp(false);
    };

    // A rescue launcher goes straight into the real game, sharing the same
    // origin, Boxes, accounts, saved adventures and PWA service worker.
    if (appWindow === true) return <ErrorBoundary><App /></ErrorBoundary>;
    if (appWindow === null) return <div className="pwa-rescue-loading" role="status">Abrindo MyOwnDex…</div>;

    return (
        <main className="pwa-rescue-page">
            <section className="pwa-rescue-card" aria-labelledby="pwa-rescue-title">
                <img draggable={false} src="/icons/myowndex-dex-v105-r3-192.png" alt="" width="96" height="96" />
                <p className="pwa-rescue-eyebrow">MyOwnDex · recuperação de instalação</p>
                <h1 id="pwa-rescue-title">Recuperar a instalação no celular</h1>
                <p>Use esta alternativa somente se o navegador diz que o MyOwnDex está instalado, mesmo depois de você desinstalá-lo.</p>
                <p>Esta instalação tem <strong>identidade própria</strong>, mas abre o <strong>mesmo MyOwnDex</strong>. A arte, as regras e o endereço do site permanecem os mesmos. Suas Boxes e aventuras locais não serão apagadas por esta página.</p>
                <p>Se o aplicativo antigo reaparecer, é possível haver dois ícones. Esta alternativa não remove o registro antigo nem garante que o Android permita outra instalação.</p>
                <label className="pwa-rescue-confirm">
                    <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
                    <span>Entendi que este é um caminho alternativo e que o aplicativo anterior pode continuar registrado no sistema.</span>
                </label>
                <div className="pwa-rescue-actions">
                    <button ref={trigger} type="button" className="pwa-rescue-primary"
                        disabled={!confirmed || busy} onClick={() => void requestInstall()}>
                        {busy ? "Abrindo instalação…" : "Instalar MyOwnDex"}
                    </button>
                    <Link className="pwa-rescue-secondary" href="/">Abrir MyOwnDex no navegador</Link>
                </div>
                <p className="pwa-rescue-note">Se o navegador não abrir o instalador, toque no botão acima e siga a orientação exibida. Não limpe os dados do site para tentar resolver o problema.</p>
            </section>
            <HelpDialog open={showHelp} title="Instalação pelo navegador" onClose={dismissHelp} returnFocusRef={trigger}>
                    <p>Abra esta mesma página no Chrome ou Edge do Android e procure <strong>Instalar app</strong> no menu ⋮. A opção depende do navegador; algumas versões só oferecem um atalho.</p>
                    <p>Se nem esta identidade alternativa aparecer para instalação, o bloqueio é controlado pelo navegador ou Android. Não podemos apagá-lo pelo site.</p>
                    <p>Evite limpar armazenamento, cookies ou dados locais do MyOwnDex: isso pode apagar Boxes e aventuras não sincronizadas.</p>
            </HelpDialog>
        </main>
    );
}
