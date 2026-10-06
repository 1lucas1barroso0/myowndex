import React, { useId, useMemo, useRef, useState } from "react";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";
import HitKillExplanation from "../Shared/HitKillExplanation.jsx";
import { integerInRange } from "../../core/math.js";
import { formatNumberPtBr } from "../../core/mechanics.js";
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

export default function TrainerGuide({ experienceMode }) {
    const [query, setQuery] = useState("");
    const [scaleValue, setScaleValue] = useState(100);
    const [level, setLevel] = useState(10);
    const protectionRef = useRef(null);
    const scaleLabelId = useId(), scaleResultId = useId(), levelLabelId = useId(), levelResultId = useId();
    const selectedMode = EXPERIENCE_MODES[experienceMode] || EXPERIENCE_MODES.rpg;
    const searching = Boolean(query.trim());
    const normalizedLevel = getDamageCeiling(level);
    const showProtection = () => {
        setQuery("");
        window.requestAnimationFrame(() => {
            const rule = protectionRef.current;
            if (!rule) return;
            rule.open = true;
            const completeRule = rule.querySelector(".guide-hit-kill-full-rule");
            if (completeRule) completeRule.open = true;
            rule.querySelector(":scope > summary")?.focus({ preventScroll: true });
            rule.scrollIntoView({ block: "start", behavior: "instant" });
        });
    };

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
                                        <details key={rule.id} ref={rule.id === "3.4" ? protectionRef : undefined} className={`guide-rule-card${rule.id === "3.4" ? " guide-rule-protection" : ""}`} data-rule-id={rule.id} open={searching}>
                                            <summary>
                                                <span className="guide-rule-id">{rule.id}</span>
                                                <strong>{rule.title}</strong>
                                            </summary>
                                            <div className="guide-rule-body">
                                                {rule.plain && <p className="guide-rule-lead">{formatRuleForReading(rule.plain)}</p>}
                                                {rule.id !== "3.4" && rule.body && rule.body.split(/\n\n+/).map(paragraph => <p key={paragraph}>{formatRuleForReading(paragraph)}</p>)}
                                                {rule.id === "3.4" ? (
                                                    <HitKillExplanation expanded={searching} />
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
                    <details className="game-panel guide-calculator">
                        <summary>Conversão para o RPG</summary>
                        <div className="guide-calculator-content">
                            <div className="guide-conversion-grid">
                                <label className="guide-number-field">
                                    <span className="guide-field-label" id={scaleLabelId}>Valor original</span>
                                    <input aria-labelledby={scaleLabelId} aria-describedby={scaleResultId} type="number" min="0" max="999999" step="1" value={scaleValue} onChange={event => setScaleValue(event.target.value)} onBlur={() => setScaleValue(integerInRange(scaleValue, 0, 999999, 0))} />
                                    <span className="guide-scale-results" id={scaleResultId} aria-live="polite">
                                        <span>Atributo ÷ 10 <strong>{formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                                        <span>HP ÷ 10 <strong>{formatNumberPtBr(getRpgScale(scaleValue, true))}</strong></span>
                                    </span>
                                </label>
                                <label className="guide-number-field">
                                    <span className="guide-field-label" id={levelLabelId}>Nível atual</span>
                                    <input aria-labelledby={levelLabelId} aria-describedby={levelResultId} type="number" min="1" max="200" step="1" value={level} onChange={event => setLevel(event.target.value)} onBlur={() => setLevel(normalizedLevel)} />
                                    <span className="guide-field-value" id={levelResultId}>{normalizedLevel >= 200 ? "Nível máximo" : <>XP até o próximo: <strong>{formatNumberPtBr(getNextLevelXp(level))}</strong></>}</span>
                                </label>
                            </div>
                            <details className="guide-rounding-help">
                                <summary>Como arredonda</summary>
                                <p>A conversão escolhe o inteiro mais próximo. No empate, o atributo desce e o HP sobe. A meta de XP sempre arredonda para baixo.</p>
                            </details>
                            <article className="guide-damage-limit-card" aria-label={`Limite comum de dano: ${formatNumberPtBr(normalizedLevel)}`}>
                                <div className="guide-damage-limit-value">
                                    <span>Limite comum de dano</span>
                                    <strong>{formatNumberPtBr(normalizedLevel)}</strong>
                                </div>
                                <details className="guide-effectiveness-help">
                                    <summary>Tipos e limite de dano</summary>
                                    <dl className="guide-effectiveness-cases">
                                        <div className="is-immune"><dt>Imune <b>0</b></dt><dd>O movimento não causa dano.</dd></div>
                                        <div className="is-resistant"><dt>Resistente <b>50% ou 25%</b></dt><dd>O dano diminui. O teto-base continua {formatNumberPtBr(normalizedLevel)}.</dd></div>
                                        <div className="is-neutral"><dt>Normal <b>×1</b></dt><dd>O limite por hit é {formatNumberPtBr(normalizedLevel)}.</dd></div>
                                        <div className="is-effective"><dt>Superefetivo <b>×2 ou ×4</b></dt><dd>O dano e o limite aumentam. Neste nível, o teto vai a {formatNumberPtBr(normalizedLevel * 2)} ou {formatNumberPtBr(normalizedLevel * 4)}.</dd></div>
                                    </dl>
                                    <p>Com vários tipos, fraquezas e resistências se combinam: duas fraquezas dão ×4; uma fraqueza e uma resistência dão ×1; duas resistências dão 25%. Uma imunidade mantém 0, salvo quando um efeito próprio a remove. Estágios positivos do atributo ofensivo também podem elevar o teto; críticos e movimentos de regra própria usam suas exceções.</p>
                                </details>
                            </article>
                            <button type="button" className="guide-hit-kill-link room-secondary-button" onClick={showProtection}>Ver proteção contra hit kill</button>
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
