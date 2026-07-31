import React, { useEffect, useState } from "react";
import { fetchCached, formatName, preferredLocalizedEntry } from "../../core/mechanics.js";

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

    const effectEntry = preferredLocalizedEntry(data.effect_entries);
    const effect = effectEntry?.short_effect || "A Pokédex ainda não tem um efeito adicional registrado para esta habilidade.";
    const effectLanguage = effectEntry?.language?.name?.startsWith("pt") ? "pt-BR" : "en";

    return (
        <div className="bg-white p-4 rounded-xl border-2 border-slate-300 shadow-[0_4px_0_#cbd5e1] relative overflow-hidden group hover:border-blue-400 transition-colors">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: isHidden ? "#a855f7" : "#ef4444" }} />
            <div className="flex items-center gap-2 mb-2 pl-2">
                <span className={`text-xs font-black uppercase tracking-widest ${isHidden ? "text-purple-600" : "text-slate-800"}`}>{formatName(data.name)}</span>
                {isHidden && <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-purple-200">Habilidade oculta</span>}
            </div>
            <p lang={effectLanguage} className="text-[11px] text-slate-600 leading-relaxed font-semibold pl-2">{effect}</p>
        </div>
    );
}
