import React, { useEffect, useState } from "react";
import { describeTrait } from "../../core/descriptions.js";
import { fetchCached, formatName } from "../../core/mechanics.js";

export default function AbilityCard({ url, isHidden }) {
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let mounted = true;
        setData(null);
        setLoadError(false);
        if (!url) {
            setLoadError(true);
            return () => { mounted = false; };
        }
        fetchCached(url).then(result => {
            if (!mounted) return;
            if (result) setData(result);
            else setLoadError(true);
        });
        return () => { mounted = false; };
    }, [url]);

    if (loadError) return (
        <div className="w-full rounded-xl border-2 border-slate-300 bg-white p-4 text-[11px] font-semibold text-slate-500">
            A Pokédex não conseguiu mostrar os detalhes desta habilidade agora.
        </div>
    );
    if (!data) return <div className="h-16 w-full skeleton rounded-xl border-2 border-slate-300" />;

    const explanation = describeTrait("ability", data.name, data);

    return (
        <div className="bg-white p-4 rounded-xl border-2 border-slate-300 shadow-[0_4px_0_#cbd5e1] relative overflow-hidden group hover:border-blue-400 transition-colors">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: isHidden ? "#a855f7" : "#ef4444" }} />
            <div className="flex items-center gap-2 mb-2 pl-2">
                <span className={`text-xs font-black uppercase tracking-widest ${isHidden ? "text-purple-600" : "text-slate-800"}`}>{formatName(data.name)}</span>
                {isHidden && <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-purple-200">Habilidade oculta</span>}
            </div>
            <div className="ability-description pl-2">
                <p>{explanation.summary}</p>
                <p><strong>Quando entra em jogo:</strong> {explanation.profile.trigger}.</p>
                <p><strong>Como a mesa resolve:</strong> {explanation.handling}</p>
                {explanation.catalog.text ? (
                    <details className="catalog-description">
                        <summary>{explanation.catalog.label}</summary>
                        <p lang={explanation.catalog.code}>{explanation.catalog.text}</p>
                    </details>
                ) : (
                    <p className="catalog-description-missing">O catálogo não trouxe outro texto para esta habilidade. O MyOwnDex mantém o gatilho à vista e deixa qualquer exceção para a decisão do grupo.</p>
                )}
            </div>
        </div>
    );
}
