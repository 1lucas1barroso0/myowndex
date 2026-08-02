import React, { useCallback, useEffect, useState } from "react";

const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;

const installPlatform = () => {
    const agent = navigator.userAgent;
    const appleMobile = /iPad|iPhone|iPod/i.test(agent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/i.test(agent) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(agent);
    const firefox = /Firefox|FxiOS/i.test(agent);
    return appleMobile ? "ios" : safari ? "safari" : firefox ? "firefox" : "browser";
};

export default function InstallMyOwnDex() {
    const [installEvent, setInstallEvent] = useState(null);
    const [installed, setInstalled] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [platform, setPlatform] = useState("browser");

    useEffect(() => {
        setInstalled(isStandalone());
        setPlatform(installPlatform());
        const displayMode = window.matchMedia?.("(display-mode: standalone)");
        const onDisplayMode = () => setInstalled(isStandalone());
        const onInstallReady = event => {
            event.preventDefault();
            setInstallEvent(event);
        };
        const onInstalled = () => {
            setInstalled(true);
            setInstallEvent(null);
            setGuideOpen(false);
        };
        window.addEventListener("beforeinstallprompt", onInstallReady);
        window.addEventListener("appinstalled", onInstalled);
        displayMode?.addEventListener?.("change", onDisplayMode);
        return () => {
            window.removeEventListener("beforeinstallprompt", onInstallReady);
            window.removeEventListener("appinstalled", onInstalled);
            displayMode?.removeEventListener?.("change", onDisplayMode);
        };
    }, []);

    useEffect(() => {
        if (!guideOpen) return undefined;
        const onKeyDown = event => { if (event.key === "Escape") setGuideOpen(false); };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [guideOpen]);

    const install = useCallback(async () => {
        if (!installEvent) {
            setGuideOpen(true);
            return;
        }
        await installEvent.prompt();
        const choice = await installEvent.userChoice.catch(() => null);
        if (choice?.outcome === "accepted") setInstallEvent(null);
    }, [installEvent]);

    if (installed) return null;

    return (
        <>
            <button type="button" className="install-entry" aria-haspopup="dialog" onClick={() => void install()}>
                <img src="/icons/myowndex-icon-v91.svg" alt="" />
                <span>Instalar</span>
            </button>
            {guideOpen && (
                <div className="install-overlay" role="presentation" onMouseDown={() => setGuideOpen(false)}>
                    <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" onMouseDown={event => event.stopPropagation()}>
                        <button type="button" className="install-close" aria-label="Fechar" onClick={() => setGuideOpen(false)}>×</button>
                        <img src="/icons/myowndex-icon-v91.svg" alt="" />
                        <small>MyOwnDex no seu aparelho</small>
                        <h2 id="install-title">Sua aventura, sempre ao alcance.</h2>
                        {platform === "ios" ? (
                            <ol>
                                <li>Toque em <strong>Compartilhar</strong> no navegador.</li>
                                <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
                                <li>Confirme em <strong>Adicionar</strong>.</li>
                            </ol>
                        ) : platform === "safari" ? (
                            <ol>
                                <li>Abra o menu <strong>Arquivo</strong> do Safari.</li>
                                <li>Escolha <strong>Adicionar ao Dock</strong>.</li>
                                <li>Confirme para abrir o MyOwnDex como aplicativo.</li>
                            </ol>
                        ) : platform === "firefox" ? (
                            <ol>
                                <li>No celular, abra o menu do Firefox.</li>
                                <li>Escolha <strong>Instalar</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                                <li>No computador, use Chrome, Edge ou Safari caso essa opção não apareça.</li>
                            </ol>
                        ) : (
                            <ol>
                                <li>Abra o menu principal do navegador.</li>
                                <li>Escolha <strong>Instalar MyOwnDex</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                                <li>Confirme a instalação.</li>
                            </ol>
                        )}
                        <p>Depois disso, o MyOwnDex ganha um ícone próprio e abre em uma janela limpa, como os outros aplicativos.</p>
                        <button type="button" className="install-done" onClick={() => setGuideOpen(false)}>Entendi</button>
                    </section>
                </div>
            )}
        </>
    );
}
