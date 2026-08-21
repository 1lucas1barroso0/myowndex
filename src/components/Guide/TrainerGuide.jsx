import React, { useMemo, useState } from "react";
import { formatNumberPtBr } from "../../core/mechanics.js";
import {
    EXPERIENCE_MODES,
    getFumbleSuggestion,
    getDamageCeiling,
    getNextLevelXp,
    getRpgScale,
    RPG_RULE_SECTIONS,
    rollAttributeTest,
    rollPercentTest,
} from "../../core/rpgRules.js";

const DiceFaces = ({ values, kept = values }) => {
    const remaining = [...kept];
    return (
        <div className="flex flex-wrap gap-2" aria-label={`Rolagem: ${values.join(", ")}`}>
            {values.map((value, index) => {
                const keptIndex = remaining.indexOf(value);
                const isKept = keptIndex >= 0;
                if (isKept) remaining.splice(keptIndex, 1);
                return (
                    <span
                        key={`${value}-${index}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-black shadow-[0_3px_0_#0E7490] ${isKept ? "border-slate-700 bg-white text-slate-800" : "border-slate-200 bg-slate-100 text-slate-400 opacity-60"}`}
                    >
                        {value}
                    </span>
                );
            })}
        </div>
    );
};

const ToolLabel = ({ children }) => (
    <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{children}</span>
);

export default function TrainerGuide({ experienceMode }) {
    const [query, setQuery] = useState("");
    const [testMode, setTestMode] = useState("normal");
    const [attribute, setAttribute] = useState(0);
    const [opposition, setOpposition] = useState("");
    const [attributeResult, setAttributeResult] = useState(null);
    const [chance, setChance] = useState(30);
    const [percentAdvantage, setPercentAdvantage] = useState(false);
    const [percentResult, setPercentResult] = useState(null);
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

    const runAttributeTest = () => {
        const result = rollAttributeTest({ mode: testMode, attribute, opposition });
        setAttributeResult(result.fumble ? { ...result, fumbleSuggestion: getFumbleSuggestion() } : result);
    };

    const runPercentTest = () => setPercentResult(rollPercentTest({
        chance,
        advantage: percentAdvantage
    }));

    return (
        <div className="trainer-guide animate-fade-in text-slate-800">
            <section className="rotom-hero relative overflow-hidden rounded-[1.75rem] border-4 border-slate-800 p-5 shadow-[0_8px_0_#075985] sm:p-7">
                <div className="relative z-10 max-w-3xl">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border-2 border-white/40 bg-slate-900/80 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300">Guia Rotom</span>
                        <span className="guide-hero-context rounded-full border-2 border-white/25 bg-white/15 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white">Regras para a aventura</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Guia do Treinador</h2>
                    <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-orange-50 sm:text-base">
                        Encontre uma regra, faça uma rolagem ou confira um cálculo sem interromper a aventura. Cada explicação mostra o que acontece e quando a regra se aplica.
                    </p>
                </div>
                <div aria-hidden="true" className="guide-hero-lens absolute -bottom-16 -right-10 h-56 w-56 rounded-full border-[28px] border-cyan-300/20 bg-white/10 shadow-[0_0_70px_rgba(103,232,249,0.35)]" />
            </section>

            <section className="guide-layout mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-5">
                    <article className="game-panel p-4 sm:p-6">
                        <div className="mb-5 flex flex-col justify-between gap-3 border-b-2 border-slate-200 pb-4 sm:flex-row sm:items-end">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-red-500">Laboratório Rotom</span>
                                <h3 className="mt-1 text-xl font-black text-slate-800">Rolagens rápidas</h3>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">Estas rolagens ficam somente neste aparelho.</span>
                        </div>

                        <div className="guide-tool-grid grid gap-5 lg:grid-cols-2">
                            <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
                                <ToolLabel>Teste de atributo</ToolLabel>
                                <div className="guide-choice-grid grid grid-cols-3 gap-2">
                                    {[
                                        ["normal", "Normal"],
                                        ["advantage", "Vantagem"],
                                        ["disadvantage", "Desvantagem"]
                                    ].map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            aria-pressed={testMode === value}
                                            onClick={() => setTestMode(value)}
                                            className={`rounded-xl border-2 px-2 py-2 text-[9px] font-black uppercase transition-colors ${testMode === value ? "border-red-600 bg-red-500 text-white" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-red-300"}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <div className="guide-input-grid mt-3 grid grid-cols-2 gap-3">
                                    <label>
                                        <ToolLabel>Atributo</ToolLabel>
                                        <input type="number" value={attribute} onChange={event => setAttribute(event.target.value)} className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black outline-none focus:border-red-400" />
                                    </label>
                                    <label>
                                        <ToolLabel>Dificuldade</ToolLabel>
                                        <input type="number" value={opposition} placeholder="Opcional" onChange={event => setOpposition(event.target.value)} className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black outline-none focus:border-red-400" />
                                    </label>
                                </div>
                                <button type="button" onClick={runAttributeTest} className="game-button mt-4 w-full bg-red-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">Rolar teste</button>
                                {attributeResult && (
                                    <div className="mt-5 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4" aria-live="polite">
                                        <DiceFaces values={attributeResult.dice} kept={attributeResult.kept} />
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-slate-500">Total <strong className="text-xl text-slate-800">{attributeResult.total}</strong></span>
                                            {attributeResult.critical && <span className="rounded-full bg-emerald-100 px-3 py-1 text-[9px] font-black uppercase text-emerald-700">Crítico</span>}
                                            {attributeResult.fumble && <span className="rounded-full bg-red-100 px-3 py-1 text-[9px] font-black uppercase text-red-700">Erro crítico</span>}
                                            {attributeResult.success === true && <span className="rounded-full bg-blue-100 px-3 py-1 text-[9px] font-black uppercase text-blue-700">Superou por {attributeResult.margin}</span>}
                                            {attributeResult.success === false && <span className="rounded-full bg-amber-100 px-3 py-1 text-[9px] font-black uppercase text-amber-700">Defesa venceu</span>}
                                        </div>
                                        {attributeResult.fumbleSuggestion && <p className="mt-3 rounded-xl bg-red-100 p-3 text-[10px] font-bold leading-5 text-red-800">Sugestão para o erro crítico: {attributeResult.fumbleSuggestion}</p>}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
                                <ToolLabel>Teste percentual</ToolLabel>
                                <label>
                                    <span className="sr-only">Chance percentual</span>
                                    <div className="guide-percent-control flex items-center gap-3">
                                        <input type="range" min="0" max="100" value={chance} onChange={event => setChance(event.target.value)} />
                                        <input type="number" min="0" max="100" value={chance} onChange={event => setChance(event.target.value)} className="w-16 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm font-black outline-none focus:border-blue-400" />
                                    </div>
                                </label>
                                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
                                    <input type="checkbox" checked={percentAdvantage} onChange={event => setPercentAdvantage(event.target.checked)} className="h-4 w-4 accent-blue-500" />
                                    <span className="text-[10px] font-black text-slate-600">Vantagem no d100 <small className="block font-bold text-slate-400">Role duas vezes e use o menor.</small></span>
                                </label>
                                <button type="button" onClick={runPercentTest} className="game-button mt-4 w-full bg-blue-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">Rolar d100</button>
                                {percentResult && (
                                    <div className={`mt-5 rounded-2xl border-2 p-4 ${percentResult.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`} aria-live="polite">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{percentResult.rolls.join(" • ")}</p>
                                        <p className={`mt-1 text-2xl font-black ${percentResult.success ? "text-emerald-700" : "text-red-700"}`}>{percentResult.success ? "Sucesso" : "Falha"} — {percentResult.result}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </article>

                    <article className="game-panel p-4 sm:p-6">
                        <div className="mb-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-500">Calculadora Rotom</span>
                            <h3 className="mt-1 text-xl font-black text-slate-800">Conversão para o RPG</h3>
                        </div>
                        <div className="guide-conversion-grid grid gap-3 sm:grid-cols-3">
                            <label className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                                <ToolLabel>Valor original</ToolLabel>
                                <input type="number" min="0" value={scaleValue} onChange={event => setScaleValue(event.target.value)} className="w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
                                <span className="mt-1 block text-[10px] font-bold text-slate-400">÷ 20 = <strong className="text-red-500">{formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                            </label>
                            <label className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                                <ToolLabel>Nível atual</ToolLabel>
                                <input type="number" min="1" max="200" value={level} onChange={event => setLevel(event.target.value)} className="w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
                                <span className="mt-1 block text-[10px] font-bold text-slate-400">XP até o próximo: <strong className="text-blue-600">{formatNumberPtBr(getNextLevelXp(level))}</strong></span>
                            </label>
                            <div className="guide-damage-ceiling rounded-2xl border-2 border-slate-200 bg-slate-900 p-4 text-white" data-rule-id="3.3">
                                <ToolLabel>Limite de dano</ToolLabel>
                                <strong className="block text-3xl font-black text-amber-300">{formatNumberPtBr(getDamageCeiling(level))}</strong>
                                <span className="mt-1 block text-[10px] font-bold text-slate-400">Máximo comum por golpe, antes de aumentos temporários.</span>
                            </div>
                        </div>
                        <div className="guide-critical-rules mt-4" aria-label="Regras críticas de dano">
                            <article className="guide-critical-rule is-ceiling" data-rule-id="3.3">
                                <span aria-hidden="true">!</span>
                                <div>
                                    <strong>Limite comum de dano</strong>
                                    <p>No nível {formatNumberPtBr(level)}, um golpe causa normalmente até <b>{formatNumberPtBr(getDamageCeiling(level))}</b> de dano. Aumentos temporários podem elevar esse teto de forma proporcional.</p>
                                </div>
                            </article>
                            <article className="guide-critical-rule is-hit-kill" data-rule-id="3.4">
                                <span aria-hidden="true">◆</span>
                                <div>
                                    <strong>Proteção contra Hit Kill</strong>
                                    <p>É uma verificação separada: se o movimento não alcançar três vezes o HP atual, o alvo que seria nocauteado permanece com 1 HP. Críticos e nocautes diretos seguem as exceções da regra.</p>
                                </div>
                            </article>
                        </div>
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
