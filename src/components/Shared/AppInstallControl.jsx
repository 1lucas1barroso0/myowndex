"use client";
import React, { useEffect, useRef, useState } from "react";

/** Installation is owned by the browser/OS, not by a persistent local flag. */
export default function AppInstallControl() {
    const [installEvent, setInstallEvent] = useState(null);
    const [inAppWindow, setInAppWindow] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [working, setWorking] = useState(false);
    const closeRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        // appinstalled is an installation notification, not proof that this
        // *browser tab* is running as an app (nor that an app remains installed).
        const checkWindowMode = () => {
            const isAppWindow = window.matchMedia("(display-mode: standalone)").matches
                || window.matchMedia("(display-mode: fullscreen)").matches
                || navigator.standalone === true;
            document.documentElement.dataset.myowndexInstalled = isAppWindow ? "true" : "false";
            setInAppWindow(isAppWindow);
        };
        const onPrompt = event => {
            if (typeof event.prompt !== "function") return;
            event.preventDefault();
            setInstallEvent(event);
            checkWindowMode();
        };
        const onInstalled = () => {
            setInstallEvent(null);
            setShowHelp(false);
            checkWindowMode();
        };
        const onVisibility = () => {
            if (!document.hidden) checkWindowMode();
        };
        const standalone = window.matchMedia("(display-mode: standalone)");
        const fullscreen = window.matchMedia("(display-mode: fullscreen)");
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        window.addEventListener("focus", checkWindowMode);
        window.addEventListener("pageshow", checkWindowMode);
        document.addEventListener("visibilitychange", onVisibility);
        standalone.addEventListener?.("change", checkWindowMode);
        fullscreen.addEventListener?.("change", checkWindowMode);
        checkWindowMode();
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
            window.removeEventListener("focus", checkWindowMode);
            window.removeEventListener("pageshow", checkWindowMode);
            document.removeEventListener("visibilitychange", onVisibility);
            standalone.removeEventListener?.("change", checkWindowMode);
            fullscreen.removeEventListener?.("change", checkWindowMode);
        };
    }, []);
    useEffect(() => {
        if (showHelp) closeRef.current?.focus();
    }, [showHelp]);

    // Installed apps should not ask to install themselves. Ordinary browser
    // tabs must ALWAYS retain access to installation/recovery instructions.
    if (inAppWindow) return null;

    const closeHelp = () => {
        setShowHelp(false);
        triggerRef.current?.focus();
    };
    const launch = async () => {
        if (!installEvent) { setShowHelp(true); return; }
        setWorking(true);
        try {
            const event = installEvent;
            setInstallEvent(null); // beforeinstallprompt objects are one-use.
            const result = await event.prompt();
            const choice = result?.outcome ? result : await event.userChoice;
            if (choice?.outcome === "accepted") setShowHelp(false);
            // Do not persist an installed flag or hide this tab's button.
            // Browser/Android owns the final registration state.
        } catch {
            setShowHelp(true);
        } finally {
            setWorking(false);
        }
    };
    return <>
        <button ref={triggerRef} type="button" className="app-install-button"
            disabled={working} onClick={() => void launch()}
            aria-haspopup={installEvent ? undefined : "dialog"}>
            Instalar aplicativo
        </button>
        {showHelp && <div className="app-install-dialog-backdrop" role="presentation"
            onMouseDown={event => { if (event.target === event.currentTarget) closeHelp(); }}>
            <section className="app-install-dialog" role="dialog" aria-modal="true"
                aria-labelledby="app-install-dialog-title"
                onKeyDown={event => { if (event.key === "Escape") closeHelp(); }}>
                <header><h2 id="app-install-dialog-title">Instalar o MyOwnDex</h2>
                    <button ref={closeRef} type="button" aria-label="Fechar" onClick={closeHelp}>×</button></header>
                <p><strong>Chrome ou Edge:</strong> use “Instalar aplicativo” no menu do navegador, se disponível.</p>
                <p><strong>Android:</strong> no menu do navegador, escolha “Instalar app”. Alguns navegadores oferecem apenas “Adicionar à tela inicial”, que pode abrir uma aba comum.</p>
                <p><strong>iPhone ou iPad:</strong> use Compartilhar → “Adicionar à Tela de Início” em um navegador compatível.</p>
                <p><strong>Se o aplicativo foi desinstalado, mas aparece como instalado:</strong> verifique em Configurações do celular → Apps se ainda existe MyOwnDex e remova essa instalação ou um atalho antigo. Feche e reabra o navegador usado para instalar, atualize esta página e tente novamente. O registro do aplicativo pertence ao navegador e ao sistema, não ao site.</p>
                <p><strong>Se continuar bloqueado:</strong> verifique também outros perfis ou navegadores onde o app possa ter sido instalado. Não apague os dados deste site sem antes exportar suas Boxes e os demais registros locais; isso pode eliminar conteúdo que não esteja sincronizado.</p>
                <p><strong>Firefox no computador:</strong> alguns navegadores não permitem instalar um PWA independente. Uma versão web continua disponível.</p>
                <button type="button" className="room-primary-button" onClick={closeHelp}>Entendi</button>
            </section>
        </div>}
    </>;
}
