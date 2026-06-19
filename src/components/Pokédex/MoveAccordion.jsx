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
    const methodText = details?.move_learn_method?.name === 'level-up' ? `Nv. ${details.level_learned_at}` : (details?.move_learn_method?.name?.toUpperCase() || '--');

    return (
        <div className="border border-slate-700/50 rounded-xl bg-slate-800/30 overflow-hidden mb-2 transition-all hover:border-slate-600">
            <button onClick={handleOpen} className="w-full flex items-center justify-between p-3.5 focus:outline-none group">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 w-12 text-left group-hover:text-blue-400 transition-colors">{methodText}</span>
                    <span className="text-xs font-bold text-slate-200 capitalize">{formatName(moveData.move.name)}</span>
                </div>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180 text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="p-4 bg-slate-900/80 border-t border-slate-700/50">
                    {!data ? <div className="h-10 skeleton rounded-lg"></div> : (
                        <div className="flex flex-col gap-3 animate-fade-in">
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[9px] px-2.5 py-1 rounded text-white font-black uppercase tracking-wider shadow-sm" style={{ backgroundColor: TYPE_COLORS[data.type?.name] || TYPE_COLORS.normal }}>{data.type?.name || '---'}</span>
                                <span className="text-[9px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-black uppercase tracking-wider border border-slate-700">{data.damage_class?.name || '---'}</span>
                                <span className="text-[10px] font-bold text-slate-400 border-l border-slate-700 pl-3">PWR: <span className={isTTRPG ? 'text-rose-400' : 'text-white'}>{data.power ? (isTTRPG ? convertToTTRPG(data.power) : data.power) : '--'}</span></span>
                                <span className="text-[10px] font-bold text-slate-400 border-l border-slate-700 pl-3">ACC: <span className="text-white">{data.accuracy ? `${data.accuracy}%` : '--'}</span></span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                {data.effect_entries?.find(e => e.language.name === 'en')?.effect?.replace(/\$effect_chance/g, data.effect_chance || '') || 'Nenhum efeito adicional.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
      }
