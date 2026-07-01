import React, { useState } from 'react';
import { fetchCached, formatName, convertToTTRPG, TYPE_COLORS } from '../../core/mechanics';

export default function MoveAccordion({ moveData, isTTRPG }) {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState(null);
    if (!moveData?.move) return null;

    const handleOpen = async () => {
        setIsOpen(!isOpen);
        if (!data && !isOpen && moveData.move.url) setData(await fetchCached(moveData.move.url));
    };

    const details = moveData.version_group_details?.[moveData.version_group_details.length - 1];
    const methodText = details?.move_learn_method?.name === 'level-up' ? `Nv. ${details.level_learned_at}` : (details?.move_learn_method?.name?.toUpperCase() || 'TM/HM');

    return (
        <div className="border-2 border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden mb-2 transition-all hover:border-red-400">
            <button onClick={handleOpen} className="w-full flex items-center justify-between p-3.5 focus:outline-none group bg-slate-50 hover:bg-white transition-colors">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 w-12 text-left group-hover:text-red-500 transition-colors">{methodText}</span>
                    <span className="text-xs font-black text-slate-800 capitalize">{formatName(moveData.move.name)}</span>
                </div>
                <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-red-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            {isOpen && (
                <div className="p-4 bg-white border-t-2 border-slate-100">
                    {!data ? <div className="h-10 skeleton rounded-lg"></div> : (
                        <div className="flex flex-col gap-3 animate-fade-in">
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[9px] px-2.5 py-1 rounded text-white font-black uppercase tracking-wider shadow-sm" style={{ backgroundColor: TYPE_COLORS[data.type?.name] || TYPE_COLORS.normal }}>{data.type?.name || '---'}</span>
                                <span className="text-[9px] px-2.5 py-1 rounded bg-slate-200 text-slate-600 font-black uppercase tracking-wider border border-slate-300">{data.damage_class?.name || '---'}</span>
                                <span className="text-[10px] font-black text-slate-500 border-l-2 border-slate-200 pl-3">Power: <span className={isTTRPG ? 'text-red-600' : 'text-slate-800'}>{data.power ? (isTTRPG ? convertToTTRPG(data.power) : data.power) : '--'}</span></span>
                                <span className="text-[10px] font-black text-slate-500 border-l-2 border-slate-200 pl-3">Accuracy: <span className="text-slate-800">{data.accuracy ? `${data.accuracy}%` : '--'}</span></span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                {data.effect_entries?.find(e => e.language.name === 'en')?.effect?.replace(/\$effect_chance/g, data.effect_chance || '') || 'A straightforward attack with no secondary effects.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
