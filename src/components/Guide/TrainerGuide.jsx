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
    <span className="guide-field-label">{children}</span>
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
        <div className="trainer-guide animate-fade-in">
            <section className="guide-hero game-panel">
                <div className="guide-hero-copy">
                    <h2>Guia do Treinador</h2>
                    <p>Consulte as regras do RPG e prepare suas rolagens.</p>
                </div>
                <PokemonSprite pokemonId={479} alt="" className="guide-companion pixelated" />
            </section>

            <section className="guide-layout">
                <div className="guide-column">
                    <LocalDicePanel />

                    <article className="game-panel guide-calculator">
                        <header className="guide-panel-heading">
                            <h3>Conversão para o RPG</h3>
                        </header>
                        <div className="guide-conversion-grid">
                            <label className="guide-number-field">
                                <ToolLabel>Valor original</ToolLabel>
                                <input type="number" min="0" max="999999" step="1" value={scaleValue} onChange={event => setScaleValue(event.target.value)} />
                                <span className="guide-field-value">÷ 20 = <strong>{formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                            </label>
                            <label className="guide-number-field">
                                <ToolLabel>Nível atual</ToolLabel>
                                <input type="number" min="1" max="200" step="1" value={level} onChange={event => setLevel(event.target.value)} />
                                <span className="guide-field-value">XP até o próximo: <strong>{formatNumberPtBr(getNextLevelXp(level))}</strong></span>
                            </label>
                            <article className="guide-damage-limit-card" data-rule-id="3.3" aria-label={`Limite comum de dano: ${formatNumberPtBr(getDamageCeiling(level))}`}>
                                <div className="guide-damage-limit-value">
                                    <span>Limite comum</span>
                                    <strong>{formatNumberPtBr(getDamageCeiling(level))}</strong>
                                </div>
                                <p>No nível {formatNumberPtBr(level)}, este é o máximo comum por hit. Aumentos temporários elevam o limite proporcionalmente; críticos e danos de regra própria usam suas exceções.</p>
                            </article>
                        </div>
                        <article className="guide-hit-kill-card" data-rule-id="3.4" aria-labelledby="guide-hit-kill-title">
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

                <aside className="guide-column">
                    <details className="game-panel guide-mode-note">
                        <summary>Regras em uso: {selectedMode.shortLabel}</summary>
                        <p>{selectedMode.description}</p>
                    </details>

                    <article className="game-panel guide-reference">
                        <header className="guide-panel-heading">
                            <h3>Regras da aventura</h3>
                            <span className="guide-rule-count" aria-label={`${RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0)} regras`}>{RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0)}</span>
                        </header>
                        <label className="guide-search">
                            <span className="sr-only">Pesquisar regras</span>
                            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar regra, tema ou número…" />
                        </label>
                        <div className="guide-rule-list">
                            {visibleSections.map(section => (
                                <details key={section.id} className="rule-section" open={Boolean(query)}>
                                    <summary>
                                        <span className="guide-rule-heading">
                                            <span className="guide-rule-number">{section.number}</span>
                                            <span className="guide-rule-title">
                                                <strong>{section.title}</strong>
                                                <small className="guide-rule-summary">{section.summary}</small>
                                            </span>
                                        </span>
                                    </summary>
                                    <div className="guide-rule-content">
                                        {section.rules.map(rule => (
                                            <div key={rule.id} className="guide-rule-card" data-rule-id={rule.id}>
                                                <span className="guide-rule-id">{rule.id}</span>
                                                <h4>{rule.title}</h4>
                                                {rule.body && <p>{rule.body}</p>}
                                                {rule.bullets && (
                                                    <ul>
                                                        {rule.bullets.map(item => <li key={item}>{item}</li>)}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))}
                            {!visibleSections.length && <p className="guide-empty" role="status">Nenhuma regra encontrada. Tente outro termo.</p>}
                        </div>
                    </article>
                </aside>
            </section>
        </div>
    );
}
