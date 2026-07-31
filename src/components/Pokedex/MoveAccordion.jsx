import React, { useState } from "react";
import { convertToTTRPG, fetchCached, formatDamageClass, formatName, formatType, preferredLocalizedEntry, TYPE_COLORS } from "../../core/mechanics.js";

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
    const effectEntry = preferredLocalizedEntry(data?.effect_entries);

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
                        <div className="flex flex-col gap-3 animate-fade-in">
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[9px] px-2.5 py-1 rounded text-white font-black uppercase tracking-wider shadow-sm" style={{ backgroundColor: TYPE_COLORS[data.type?.name] || TYPE_COLORS.normal }}>{formatType(data.type?.name)}</span>
                                <span className="text-[9px] px-2.5 py-1 rounded bg-slate-200 text-slate-600 font-black uppercase tracking-wider border border-slate-300">{formatDamageClass(data.damage_class?.name)}</span>
                                <span className="text-[10px] font-black text-slate-500 border-l-2 border-slate-200 pl-3">Poder: <span className={isTTRPG ? "text-red-600" : "text-slate-800"}>{data.power ? (isTTRPG ? convertToTTRPG(data.power) : data.power) : "--"}</span></span>
                                <span className="text-[10px] font-black text-slate-500 border-l-2 border-slate-200 pl-3">Precisão: <span className="text-slate-800">{data.accuracy ? `${data.accuracy}%` : "--"}</span></span>
                            </div>
                            <p lang={effectEntry?.language?.name?.startsWith("pt") ? "pt-BR" : "en"} className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                {effectEntry?.effect?.replace(/\$effect_chance/g, data.effect_chance || "") || "A Pokédex ainda não tem um efeito adicional registrado para este movimento."}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
