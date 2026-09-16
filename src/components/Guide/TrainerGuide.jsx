import React, { useMemo, useState } from "react";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import { formatNumberPtBr } from "../../core/mechanics.js";
import LocalDicePanel from "../Shared/LocalDicePanel.jsx";
import {
    EXPERIENCE_MODES,
    getDamageCeiling,
    getNextLevelXp,
    getRpgScale,
    RPG_RULE_SECTIONS,
} from "../../core/rpgRules.js";

const ToolLabel = ({ children }) => (
    <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{children}</span>
);

export default function TrainerGuide({ experienceMode }) {
    const [query, setQuery] = useState("");
    const [scaleValue, setScaleValue] = useState(100);
    const [level, setLevel] = useState(10);
    const selectedMode = EXPERIENCE_MODES[experienceMode] || EXPERIENCE_MODES.rpg;

    const visibleSections = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return RPG_RULE_SECTIONS;
        return RPG_RULE_SECTIONS.map(section => ({
            ...section,
            rules: section.rules.filter(rule =>
                `${rule.id} ${rule.title} ${rule.body || ""} ${(rule.bullets || []).join(" ")}`
                    .toLowerCase()
                    .includes(normalized)
            )
        })).filter(section =>
            section.rules.length
            || `${section.number} ${section.title} ${section.summary}`.toLowerCase().includes(normalized)
        );
    }, [query]);

    return (
        <div className="trainer-guide animate-fade-in text-slate-800">
            <section className="rotom-hero relative overflow-hidden rounded-[1.75rem] border-4 border-slate-800 p-5 shadow-[0_8px_0_#075985] sm:p-7">
                <div className="relative z-10 max-w-3xl">
                    <span className="screen-eyebrow">Conhecimento para cada jornada</span>
                    <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Guia do Treinador</h2>
                    <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-orange-50 sm:text-base">
                        Regras à mão. Decisões com confiança. Consulte, role e volte à aventura.
                    </p>
                </div>
                <PokemonSprite pokemonId={479} alt="" className="guide-companion pixelated" />
            </section>

            <section className="guide-layout mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-5">
                    <LocalDicePanel />

                    <article className="game-panel p-4 sm:p-6">
                        <div className="mb-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-500">Calculadora Rotom</span>
                            <h3 className="mt-1 text-xl font-black text-slate-800">Conversão para o RPG</h3>
                        </div>
                        <div className="guide-conversion-grid grid gap-3">
                            <label className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                                <ToolLabel>Valor original</ToolLabel>
                                <input type="number" min="0" max="999999" step="1" value={scaleValue} onChange={event => setScaleValue(event.target.value)} className="w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
                                <span className="mt-1 block text-[10px] font-bold text-slate-400">÷ 20 = <strong className="text-red-500">{formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                            </label>
                            <label className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                                <ToolLabel>Nível atual</ToolLabel>
                                <input type="number" min="1" max="200" step="1" value={level} onChange={event => setLevel(event.target.value)} className="w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
                                <span className="mt-1 block text-[10px] font-bold text-slate-400">XP até o próximo: <strong className="text-blue-600">{formatNumberPtBr(getNextLevelXp(level))}</strong></span>
                            </label>
                            <article className="guide-damage-limit-card" data-rule-id="3.3" aria-label={`Limite comum de dano: ${formatNumberPtBr(getDamageCeiling(level))}`}>
                                <div className="guide-damage-limit-value">
                                    <span>Limite comum</span>
                                    <strong>{formatNumberPtBr(getDamageCeiling(level))}</strong>
                                </div>
                                <p>No nível {formatNumberPtBr(level)}, este é o máximo comum por hit. Aumentos temporários elevam o limite proporcionalmente; críticos e danos de regra própria usam suas exceções.</p>
                            </article>
                        </div>
                        <article className="guide-hit-kill-card mt-4" data-rule-id="3.4" aria-labelledby="guide-hit-kill-title">
                            <header>
                                <span className="guide-hit-kill-mark" aria-hidden="true">◆</span>
                                <div>
                                    <small>Regra separada do limite comum</small>
                                    <strong id="guide-hit-kill-title">Proteção contra Hit Kill</strong>
                                </div>
                                <b>1 vez por batalha</b>
                            </header>
                            <div className="guide-hit-kill-flow" aria-label="Condições para a proteção agir">
                                <span>HP máximo</span>
                                <i aria-hidden="true">→</i>
                                <span>Dano fatal menor que 3× o HP máximo</span>
                                <i aria-hidden="true">→</i>
                                <span>Permanece com 1 HP</span>
                            </div>
                            <dl className="guide-hit-kill-facts">
                                <div><dt>Conta</dt><dd>Cada hit e cada dano indireto que realmente cause HP.</dd></div>
                                <div><dt>Não conta</dt><dd>Erro, imunidade, bloqueio ou dano absorvido pelo Substitute.</dd></div>
                                <div><dt>Encerra</dt><dd>Uso da proteção ou perda de HP do próprio Pokémon; cura e troca não devolvem.</dd></div>
                                <div><dt>Atravessa</dt><dd>Crítico do atacante, erro crítico do defensor e nocaute direto.</dd></div>
                            </dl>
                            <p className="guide-hit-kill-traits"><b>Sturdy, Focus Sash e afins continuam separados:</b> a proteção geral não os consome e pode preservar uma chance adicional para o próximo dano real.</p>
                        </article>
                    </article>
                </div>

                <aside className="space-y-5">
                    <article className="game-panel guide-current-style p-4 sm:p-5">
                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-500">Estilo em uso</span>
                        <h3 className="mt-1 text-lg font-black text-slate-800">{selectedMode.shortLabel}</h3>
                        <p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">{selectedMode.description}</p>
                        <p className="mt-3 text-[9px] font-black text-blue-600">Você pode mudar o estilo nas abas compactas do cabeçalho.</p>
                    </article>

                    <article className="game-panel p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-orange-500">Arquivo do Treinador</span>
                                <h3 className="mt-1 text-lg font-black text-slate-800">Guia completo</h3>
                            </div>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-[9px] font-black text-white">{RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0)}</span>
                        </div>
                        <label className="mt-4 block">
                            <span className="sr-only">Pesquisar regras</span>
                            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar regra, tema ou número…" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-bold outline-none focus:border-orange-400" />
                        </label>
                        <div className="guide-rule-list mt-4 space-y-3">
                            {visibleSections.map(section => (
                                <details key={section.id} className="rule-section rounded-2xl border-2 border-slate-200 bg-white" open={Boolean(query)}>
                                    <summary className="cursor-pointer list-none p-4">
                                        <span className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500 text-xs font-black text-white">{section.number}</span>
                                            <span className="min-w-0">
                                                <strong className="block text-xs font-black text-slate-800">{section.title}</strong>
                                                <small className="guide-rule-summary block text-[9px] font-bold text-slate-400">{section.summary}</small>
                                            </span>
                                        </span>
                                    </summary>
                                    <div className="space-y-3 border-t-2 border-slate-100 p-3">
                                        {section.rules.map(rule => (
                                            <div key={rule.id} className="guide-rule-card rounded-xl bg-slate-50 p-3" data-rule-id={rule.id}>
                                                <span className="text-[9px] font-black text-red-500">{rule.id}</span>
                                                <h4 className="mt-0.5 text-xs font-black text-slate-800">{rule.title}</h4>
                                                {rule.body && <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-600">{rule.body}</p>}
                                                {rule.bullets && (
                                                    <ul className="mt-2 space-y-1 pl-4 text-[10px] font-semibold leading-5 text-slate-600">
                                                        {rule.bullets.map(item => <li key={item} className="list-disc">{item}</li>)}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))}
                            {!visibleSections.length && <p className="rounded-xl bg-slate-100 p-4 text-center text-xs font-bold text-slate-500">Nenhuma regra apareceu para essa busca. Tente outro termo.</p>}
                        </div>
                        <p className="mt-4 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-cyan-800">Todas as regras necessárias para jogar estão reunidas aqui.</p>
                    </article>
                </aside>
            </section>
        </div>
    );
}
