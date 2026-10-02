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

const ruleCount = RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0);
const normalizeSearch = text => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function TrainerGuide({ experienceMode }) {
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
                rules: sectionMatches ? section.rules : section.rules.filter(rule =>
                    normalizeSearch(`${rule.id} ${rule.title} ${rule.body || ""} ${(rule.bullets || []).join(" ")}`).includes(normalized)
                ),
            };
        }).filter(section => section.rules.length);
    }, [query]);

    const visibleRuleCount = visibleSections.reduce((sum, section) => sum + section.rules.length, 0);

    return (
        <div className="trainer-guide animate-fade-in">
            <header className="guide-hero">
                <h2>Guia do Treinador</h2>
                <PokemonSprite pokemonId={479} alt="" className="guide-companion pixelated" />
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
                                        <details key={rule.id} className="guide-rule-card" data-rule-id={rule.id} open={searching}>
                                            <summary>
                                                <span className="guide-rule-id">{rule.id}</span>
                                                <strong>{rule.title}</strong>
                                            </summary>
                                            <div className="guide-rule-body">
                                                {rule.body && <p>{rule.body}</p>}
                                                {rule.bullets && <ul>{rule.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
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
                    <LocalDicePanel />
                    <details className="game-panel guide-calculator">
                        <summary>Conversão para o RPG</summary>
                        <div className="guide-calculator-content">
                            <div className="guide-conversion-grid">
                                <label className="guide-number-field">
                                    <span className="guide-field-label">Valor original</span>
                                    <input type="number" min="0" max="999999" step="1" value={scaleValue} onChange={event => setScaleValue(event.target.value)} />
                                    <span className="guide-field-value">÷ 20 = <strong>{formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                                </label>
                                <label className="guide-number-field">
                                    <span className="guide-field-label">Nível atual</span>
                                    <input type="number" min="1" max="200" step="1" value={level} onChange={event => setLevel(event.target.value)} />
                                    <span className="guide-field-value">XP até o próximo: <strong>{formatNumberPtBr(getNextLevelXp(level))}</strong></span>
                                </label>
                            </div>
                            <article className="guide-damage-limit-card" data-rule-id="3.3" aria-label={`Limite comum de dano: ${formatNumberPtBr(getDamageCeiling(level))}`}>
                                <div className="guide-damage-limit-value">
                                    <span>Limite comum de dano</span>
                                    <strong>{formatNumberPtBr(getDamageCeiling(level))}</strong>
                                </div>
                                <p>No nível {formatNumberPtBr(level)}, este é o máximo comum por hit. Aumentos temporários elevam o limite proporcionalmente; críticos e danos de regra própria usam suas exceções.</p>
                            </article>
                            <details className="guide-hit-kill-card" data-rule-id="3.4">
                                <summary>Proteção contra hit kill</summary>
                                <div className="guide-hit-kill-content">
                                    <p><strong>Uma vez por batalha.</strong> Esta proteção é separada do limite comum de dano.</p>
                                    <ol className="guide-hit-kill-flow" aria-label="Condições para a proteção agir">
                                        <li>HP máximo</li>
                                        <li>Dano fatal menor que 3× o HP máximo</li>
                                        <li>Permanece com 1 HP</li>
                                    </ol>
                                    <dl className="guide-hit-kill-facts">
                                        <div><dt>Conta</dt><dd>Cada hit e cada dano indireto que realmente cause HP.</dd></div>
                                        <div><dt>Não conta</dt><dd>Erro, imunidade, bloqueio ou dano absorvido pelo Substitute.</dd></div>
                                        <div><dt>Encerra</dt><dd>Uso da proteção, pagamento de HP, recuo ou autolesão; cura e troca não devolvem.</dd></div>
                                        <div><dt>Atravessa</dt><dd>Crítico do atacante, erro crítico do defensor e nocaute direto.</dd></div>
                                    </dl>
                                    <p><strong>Sturdy, Focus Sash e afins continuam separados:</strong> a proteção geral não os consome e pode preservar uma chance adicional para o próximo dano real.</p>
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
