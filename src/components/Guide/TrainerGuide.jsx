import React, { useMemo, useState } from "react";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";
import { formatNumberPtBr } from "../../core/mechanics.js";
import LocalDicePanel from "../Shared/LocalDicePanel.jsx";
import {
    EXPERIENCE_MODES,
    getDamageCeiling,
    getNextLevelXp,
    getRpgScale,
    RPG_RULE_SECTIONS,
} from "../../core/rpgRules.js";

const ruleCount = RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0);
const normalizeSearch = text => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const formatRuleForReading = text => text.replace(/1 em 8/g, "12,5%").replace(/1 em 3/g, "≈ 33,3%");

function RuleBullet({ text }) {
    const readable = formatRuleForReading(text);
    const separator = readable.indexOf(":");
    return separator > 0 && separator < 50 ? (
        <><strong>{readable.slice(0, separator + 1)}</strong>{readable.slice(separator + 1)}</>
    ) : readable;
}

function HitKillOverview({ showFacts = false }) {
    return (
        <div className="guide-hit-kill-overview">
            <div className="guide-hit-kill-heading">
                <svg className="guide-hit-kill-emblem" aria-hidden="true" viewBox="0 0 32 32" fill="none">
                    <path d="M16 3 27 7v8c0 7-6 11-11 14C11 26 5 22 5 15V7L16 3Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                    <path d="M9 16h4l2-5 3 10 2-5h3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div><strong>Uma chance de continuar</strong><span>Uma vez por Pokémon, em cada batalha.</span></div>
            </div>
            <ol className="guide-hit-kill-flow" aria-label="Condições para a proteção agir">
                <li><span className="guide-hit-kill-step" aria-hidden="true">1</span><div><strong>HP cheio</strong><span>Antes de receber o dano.</span></div></li>
                <li><span className="guide-hit-kill-step" aria-hidden="true">2</span><div><strong>Dano fatal abaixo de 3× o HP máximo</strong><span>A proteção precisa estar disponível.</span></div></li>
                <li className="guide-hit-kill-outcome"><span className="guide-hit-kill-step" aria-hidden="true">3</span><div><strong>Permanece com <b>1 HP</b></strong><span>A proteção é consumida.</span></div></li>
            </ol>
            <p className="guide-hit-kill-example"><strong>Por exemplo:</strong> com 20 HP máximos e cheios, um dano final de 30 deixa 1 HP se a proteção estiver disponível. Um dano de 60 ou mais atravessa a proteção, crítico ou não.</p>
            {showFacts && (
                <>
                    <dl className="guide-hit-kill-facts">
                        <div><dt>Quando verificar</dt><dd>Cada hit e cada fonte de dano indireto, separadamente.</dd></div>
                        <div><dt>Sem dano, sem consumo</dt><dd>Erro, imunidade, bloqueio e dano absorvido pelo Substitute não afetam a proteção.</dd></div>
                        <div><dt>O que a remove</dt><dd>Usá-la, pagar HP, sofrer recuo ou causar dano a si próprio. Cura e troca não a restauram.</dd></div>
                        <div><dt>O que a atravessa</dt><dd>Dano igual ou superior a 3× o HP máximo e movimentos de nocaute direto.</dd></div>
                        <div><dt>Exceção de 1 HP</dt><dd>HP fixado em 1 por regra própria da espécie ou forma, como Shedinja, não recebe a proteção geral.</dd></div>
                    </dl>
                    <p className="guide-hit-kill-own-protection"><strong>Sturdy e Focus Sash mantêm suas próprias regras.</strong> Quando a proteção geral age primeiro, não os consome e preserva sua elegibilidade até o próximo dano que alcançar o Pokémon.</p>
                </>
            )}
        </div>
    );
}

export default function TrainerGuide({ experienceMode, teams = [], setTeams }) {
    const [query, setQuery] = useState("");
    const [scaleValue, setScaleValue] = useState(100);
    const [level, setLevel] = useState(10);
    const selectedMode = EXPERIENCE_MODES[experienceMode] || EXPERIENCE_MODES.rpg;
    const searching = Boolean(query.trim());

    const visibleSections = useMemo(() => {
        const normalized = normalizeSearch(query);
        if (!normalized) return RPG_RULE_SECTIONS;
        return RPG_RULE_SECTIONS.map(section => {
            const sectionMatches = normalizeSearch(`${section.number} ${section.title} ${section.summary}`).includes(normalized);
            return {
                ...section,
                rules: sectionMatches ? section.rules : section.rules.filter(rule => {
                    const text = [rule.id, rule.title, rule.body || "", ...(rule.bullets || [])].join(" ");
                    return normalizeSearch(`${text} ${formatRuleForReading(text)}`).includes(normalized);
                }),
            };
        }).filter(section => section.rules.length);
    }, [query]);

    const visibleRuleCount = visibleSections.reduce((sum, section) => sum + section.rules.length, 0);

    return (
        <div className="trainer-guide animate-fade-in">
            <header className="guide-hero">
                <h2>Guia do Treinador</h2>
                <PokemonCompanion place="guide" eager />
            </header>

            <div className="guide-layout">
                <article className="game-panel guide-reference" aria-labelledby="guide-reference-title">
                    <header className="guide-panel-heading">
                        <h3 id="guide-reference-title">Regras da aventura</h3>
                        <span className="guide-rule-count">{ruleCount} regras</span>
                    </header>
                    <label className="guide-search">
                        <span>Pesquisar regras</span>
                        <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
                    </label>
                    {searching && <p className="guide-search-result" role="status">{visibleRuleCount} {visibleRuleCount === 1 ? "regra encontrada" : "regras encontradas"}</p>}
                    <div className="guide-rule-list">
                        {visibleSections.map(section => (
                            <section key={section.id} className="guide-topic" aria-labelledby={`guide-topic-${section.id}`}>
                                <header className="guide-topic-heading">
                                    <span className="guide-rule-number" aria-hidden="true">{section.number}</span>
                                    <div>
                                        <h4 id={`guide-topic-${section.id}`}>{section.title}</h4>
                                        <p>{section.summary}</p>
                                    </div>
                                </header>
                                <div className="guide-rule-content">
                                    {section.rules.map(rule => (
                                        <details key={rule.id} className={`guide-rule-card${rule.id === "3.4" ? " guide-rule-protection" : ""}`} data-rule-id={rule.id} open={searching}>
                                            <summary>
                                                <span className="guide-rule-id">{rule.id}</span>
                                                <strong>{rule.title}</strong>
                                            </summary>
                                            <div className="guide-rule-body">
                                                {rule.body && rule.body.split(/\n\n+/).map(paragraph => <p key={paragraph}>{formatRuleForReading(paragraph)}</p>)}
                                                {rule.id === "3.4" ? (
                                                    <>
                                                        <HitKillOverview />
                                                        <details className="guide-hit-kill-full-rule" open={searching}>
                                                            <summary>Situações especiais e exceções</summary>
                                                            <ul>{rule.bullets.map(item => <li key={item}><RuleBullet text={item} /></li>)}</ul>
                                                        </details>
                                                    </>
                                                ) : rule.bullets && <ul>{rule.bullets.map(item => <li key={item}><RuleBullet text={item} /></li>)}</ul>}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        ))}
                        {!visibleSections.length && <p className="guide-empty">Nenhuma regra encontrada. Tente outro termo.</p>}
                    </div>
                </article>

                <aside className="guide-tools" aria-label="Ferramentas do guia">
                    <LocalDicePanel teams={teams} setTeams={setTeams} experienceMode={experienceMode} />
                    <details className="game-panel guide-calculator">
                        <summary>Conversão para o RPG</summary>
                        <div className="guide-calculator-content">
                            <div className="guide-conversion-grid">
                                <label className="guide-number-field">
                                    <span className="guide-field-label">Valor original</span>
                                    <input type="number" min="0" max="999999" step="1" value={scaleValue} onChange={event => setScaleValue(event.target.value)} />
                                    <span className="guide-scale-results" aria-live="polite">
                                        <span>Atributo ÷ 10 <strong>{formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                                        <span>HP ÷ 10 <strong>{formatNumberPtBr(getRpgScale(scaleValue, true))}</strong></span>
                                    </span>
                                </label>
                                <label className="guide-number-field">
                                    <span className="guide-field-label">Nível atual</span>
                                    <input type="number" min="1" max="200" step="1" value={level} onChange={event => setLevel(event.target.value)} />
                                    <span className="guide-field-value">{getDamageCeiling(level) >= 200 ? "Nível máximo" : <>XP até o próximo: <strong>{formatNumberPtBr(getNextLevelXp(level))}</strong></>}</span>
                                </label>
                            </div>
                            <article className="guide-damage-limit-card" data-rule-id="3.3" aria-label={`Limite comum de dano: ${formatNumberPtBr(getDamageCeiling(level))}`}>
                                <div className="guide-damage-limit-value">
                                    <span>Limite comum de dano</span>
                                    <strong>{formatNumberPtBr(getDamageCeiling(level))}</strong>
                                </div>
                                <p>No nível {formatNumberPtBr(getDamageCeiling(level))}, este é o teto-base por hit. Super efetividade e aumentos temporários elevam o limite proporcionalmente; críticos e danos de regra própria usam suas exceções.</p>
                            </article>
                            <details className="guide-hit-kill-card" data-rule-id="3.4">
                                <summary>Proteção contra hit kill</summary>
                                <div className="guide-hit-kill-content">
                                    <HitKillOverview showFacts />
                                    <p className="guide-hit-kill-limit-note">Esta proteção é separada do limite comum de dano. A regra 3.4 reúne as situações especiais e exceções.</p>
                                </div>
                            </details>
                        </div>
                    </details>
                    <details className="game-panel guide-mode-note">
                        <summary>Regras em uso: {selectedMode.shortLabel}</summary>
                        <p>{selectedMode.description}</p>
                    </details>
                </aside>
            </div>
        </div>
    );
}
