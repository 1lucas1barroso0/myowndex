import React from "react";

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
                    <div aria-hidden="true" className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-white bg-sky-400 shadow-[0_0_18px_#0EA5E9]" />
                    <h1 className="mt-2 text-2xl font-black text-[var(--ui-ink)]">Vamos voltar à aventura</h1>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ui-muted)]">Esta tela encontrou um problema. Reabra o MyOwnDex para tentar de novo. Os dados já salvos continuam guardados.</p>
                    <button type="button" onClick={() => window.location.reload()} className="game-button mt-6 bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white">Reabrir o MyOwnDex</button>
                </section>
            </main>
        );
    }
}
