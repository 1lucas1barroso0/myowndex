import React, { useState } from "react";
import { describeMove } from "../../core/descriptions.js";
import { convertToTTRPG, fetchCached, formatDamageClass, formatName, formatType, TYPE_COLORS, TYPE_TEXT_COLORS } from "../../core/mechanics.js";

const methodLabel = detail => {
    const method = detail?.move_learn_method?.name;
    if (method === "level-up") return detail.level_learned_at ? `Nv. ${detail.level_learned_at}` : "Nível";
    if (method === "machine") return "Máquina";
    if (method === "tutor") return "Tutor";
    if (method === "egg") return "Ovo";
    return formatName(method || "Outro");
};

export default function MoveAccordion({ moveData, isTTRPG }) {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(false);
    if (!moveData?.move) return null;

    const handleOpen = async () => {
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (!data && nextOpen && moveData.move.url) {
            setLoadError(false);
            const result = await fetchCached(moveData.move.url);
            if (result) setData(result);
            else setLoadError(true);
        }
    };

    const details = moveData.latest_detail || moveData.latest_details?.[0];
    const panelId = `move-${moveData.move.name}`;
    const explanation = data ? describeMove(data, { isTTRPG }) : null;

    return (
        <div className="border-2 border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden mb-2 transition-all hover:border-red-400">
            <button type="button" onClick={handleOpen} aria-expanded={isOpen} aria-controls={panelId} className="w-full flex items-center justify-between p-3.5 focus:outline-none group bg-slate-50 hover:bg-white transition-colors">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 w-14 text-left group-hover:text-red-500 transition-colors">{methodLabel(details)}</span>
                    <span className="text-xs font-black text-slate-800 capitalize">{formatName(moveData.move.name)}</span>
                </div>
                <svg aria-hidden="true" className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-red-500" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <div id={panelId} className="p-4 bg-white border-t-2 border-slate-100">
                    {!data && !loadError ? <div className="h-10 skeleton rounded-lg" /> : loadError ? (
                        <p className="text-[11px] font-bold text-slate-500">A Pokédex não conseguiu mostrar os detalhes deste movimento agora.</p>
                    ) : (
                        <div className="move-description flex flex-col gap-3 animate-fade-in">
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[9px] px-2.5 py-1 rounded font-black uppercase tracking-wider shadow-sm" style={{ backgroundColor: TYPE_COLORS[data.type?.name] || TYPE_COLORS.normal, color: TYPE_TEXT_COLORS[data.type?.name] || TYPE_TEXT_COLORS.normal }}>{formatType(data.type?.name)}</span>
                                <span className="text-[9px] px-2.5 py-1 rounded bg-slate-200 text-slate-600 font-black uppercase tracking-wider border border-slate-300">{formatDamageClass(data.damage_class?.name)}</span>
                                <span className="move-fact-chip">Poder: <strong>{data.power ? (isTTRPG ? convertToTTRPG(data.power) : data.power) : data.damage_class?.name === "status" ? "não causa dano" : "depende do efeito"}</strong></span>
                                <span className="move-fact-chip">Precisão: <strong>{data.accuracy == null ? "sem teste próprio" : `${data.accuracy}%`}</strong></span>
                                <span className="move-fact-chip">PP: <strong>{data.pp || "regra própria"}</strong></span>
                            </div>
                            <p className="move-human-summary">{explanation.summary}</p>
                            <ul className="move-human-facts" aria-label={`Como ${formatName(data.name)} funciona`}>
                                {explanation.facts.map((fact, index) => <li key={`${data.name}-fact-${index}`}>{fact}</li>)}
                            </ul>
                            {explanation.catalog.text ? (
                                <details className="catalog-description">
                                    <summary>{explanation.catalog.label}</summary>
                                    <p lang={explanation.catalog.code}>{explanation.catalog.text}</p>
                                </details>
                            ) : (
                                <p className="catalog-description-missing">O catálogo não trouxe outro texto para este movimento. A explicação funcional acima continua válida e não preenche nenhuma lacuna por suposição.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
