import React from "react";
import packageInfo from "../../package.json";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error("O MyOwnDex se recuperou de um erro de interface.", error, info);
    }
    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <main className="min-h-[100dvh] flex items-center justify-center p-5">
                <section role="alert" className="game-shell error-boundary-shell max-w-xl w-full p-6 sm:p-8 text-center">
                    <img draggable={false} className="myowndex-brand-art mx-auto mb-4" src={`/icons/myowndex-dex-v105-r4-live.svg?v=${packageInfo.version}`} width="72" height="72" alt="" />
                    <h1 className="mt-2 text-2xl font-black text-[var(--ui-ink)]">Vamos voltar à aventura</h1>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ui-muted)]">Esta tela encontrou um problema. Reabra o MyOwnDex para tentar de novo. Os dados já salvos continuam guardados.</p>
                    <button type="button" onClick={() => window.location.reload()} className="room-primary-button mt-6">Reabrir o MyOwnDex</button>
                </section>
            </main>
        );
    }
}
