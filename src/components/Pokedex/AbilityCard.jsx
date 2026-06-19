import React, { useState, useEffect } from 'react';
import { fetchCached, formatName } from '../../core/mechanics';

export default function AbilityCard({ url, isHidden }) {
    const [data, setData] = useState(null);
    useEffect(() => { if(url) fetchCached(url).then(setData); }, [url]);
    if (!data) return <div className="h-14 w-full skeleton rounded-xl"></div>;
    const effect = data.effect_entries?.find(e => e.language.name === 'en')?.short_effect || 'Efeito desconhecido.';
    return (
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/50 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: isHidden ? '#a855f7' : '#3b82f6' }}></div>
            <div className="flex items-center gap-2 mb-1.5 pl-2">
                <span className={`text-xs font-black uppercase tracking-widest ${isHidden ? 'text-purple-400' : 'text-blue-400'}`}>{formatName(data.name)}</span>
                {isHidden && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-purple-500/30">Oculta</span>}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium pl-2">{effect}</p>
        </div>
    );
}
