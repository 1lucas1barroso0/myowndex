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
        console.error("MyOwnDex recovered from an interface error.", error, info);
    }
    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <main className="min-h-[100dvh] flex items-center justify-center p-5">
                <section className="game-shell max-w-xl w-full p-6 sm:p-8 text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-white bg-sky-400 shadow-[0_0_18px_#00d2ff]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Recovery Mode</p>
                    <h1 className="mt-2 text-2xl font-black text-slate-800">MyOwnDex protected your session</h1>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">An unexpected interface error was contained. Reload to return to your saved boxes.</p>
                    <button type="button" onClick={() => window.location.reload()} className="game-button mt-6 bg-red-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white">Reload MyOwnDex</button>
                </section>
            </main>
        );
    }
}
