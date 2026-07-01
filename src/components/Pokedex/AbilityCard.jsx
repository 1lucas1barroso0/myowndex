import React, { useState, useEffect } from 'react';
import { fetchCached, formatName } from '../../core/mechanics';

export default function AbilityCard({ url, isHidden }) {
    const [data, setData] = useState(null);
    useEffect(() => { if(url) fetchCached(url).then(setData); }, [url]);
    
    if (!data) return <div className="h-16 w-full skeleton rounded-xl border-2 border-slate-300"></div>;
    
    const effect = data.effect_entries?.find(e => e.language.name === 'en')?.short_effect || 'Efeito misterioso. A pesquisa ainda está em andamento!';
    
    return (
        <div className="bg-white p-4 rounded-xl border-2 border-slate-300 shadow-[0_4px_0_#cbd5e1] relative overflow-hidden group hover:border-blue-400 transition-colors">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: isHidden ? '#a855f7' : '#ef4444' }}></div>
            <div className="flex items-center gap-2 mb-2 pl-2">
                <span className={`text-xs font-black uppercase tracking-widest ${isHidden ? 'text-purple-600' : 'text-slate-800'}`}>{formatName(data.name)}</span>
                {isHidden && <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-purple-200">Habilidade Oculta</span>}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-semibold pl-2">{effect}</p>
        </div>
    );
}
