import { revealInScrollArea } from "../../core/scroll.js";
import React, { useId, useMemo, useRef, useState } from "react";
import PokemonCompanion from "../Shared/PokemonCompanion.jsx";
import RuleText from "../Shared/RuleText.jsx";
import PaperCalculations from "./PaperCalculations.jsx";
import { getGuideLevelProgress } from "../../core/guideMath.js";
import GuideAuditCase from './GuideAuditCase.jsx';
import { GUIDE_PAPER_STEPS } from "../../core/guidePaperSteps.js";
import { GUIDE_PLAY_STEPS } from "../../core/guidePlaySteps.js";
import ConditionReference from './ConditionReference.jsx';
import { GUIDE_WORKED_SCENES } from "../../core/guideWorkedScenes.js";
import { createGuideSearchIndex, formatRuleForReading, getGuideRuleSearchState, searchGuideSections } from "../../core/guideSearch.js";
import { integerInRange } from "../../core/math.js";
import { formatNumberPtBr, RPG_HP_DIVISOR, RPG_SCALE_DIVISOR } from "../../core/mechanics.js";
import {
    EXPERIENCE_MODES,
    getRpgScale,
    RPG_RULE_SECTIONS,
} from "../../core/rpgRules.js";

const ruleCount = RPG_RULE_SECTIONS.reduce((sum, section) => sum + section.rules.length, 0);
const searchIndex = createGuideSearchIndex(RPG_RULE_SECTIONS);

function RuleBullet({ text }) {
    const readable = formatRuleForReading(text);
    const separator = readable.indexOf(":");
    return separator > 0 && separator < 50 ? (
        <><strong>{readable.slice(0, separator + 1)}</strong>{readable.slice(separator + 1)}</>
    ) : readable;
}

function RuleCanonicalText({ rule }) {
    return <section className="guide-rule-canonical-text" aria-label="Regra completa e exceções">
        <h5>Regra completa e exceções</h5>
        <RuleText rule={rule} />
    </section>;
}

function WorkedScene({ id }) {
    const example = GUIDE_WORKED_SCENES[id];
    if (!example) return null;
    return <section className={id === "3.4" ? "guide-worked-scene" : "guide-worked-scene guide-rule-story"} aria-label="Exemplo completo explicado">
        <h5>Um exemplo explicado, do começo ao fim</h5>
        <div className="guide-worked-part"><h6>Quando esta regra entra em ação?</h6><p>{example.quando}</p></div>
        <div className="guide-worked-part"><h6>Quem faz o quê?</h6><p>{example.cena}</p></div>
        <div className="guide-worked-part"><h6>O que fazer, em ordem?</h6><ol>{example.como.map(step => <li key={step}>{step}</li>)}</ol></div>
        <div className="guide-worked-part"><h6>O que acontece depois?</h6><p>{example.resultado}</p></div>
        <div className="guide-worked-part"><h6>Por que essa regra funciona assim?</h6><p>{example.porQue}</p></div>
    </section>;
}

const GuideRule = React.memo(function GuideRule({ rule, query, protectionRef }) {
    const [detailChoice, setDetailChoice] = useState({ query: null, open: false });
    const searching = Boolean(query.trim());
    const { details: detailMatch, app: appMatch } = getGuideRuleSearchState(rule, query);
    const expanded = detailChoice.query === query ? detailChoice.open : detailMatch;
    return (
        <details ref={rule.id === "3.4" ? protectionRef : undefined} className="guide-rule-card" data-rule-id={rule.id} open={searching}>
            <summary>
                <span className="guide-rule-id" title={`Referência ${rule.id}`}>{String(rule.number).padStart(2, "0")}</span>
                <strong>{rule.title}</strong>
            </summary>
            <div className="guide-rule-body">
                <p className="guide-rule-lead">{rule.plain}</p>
                <section className="guide-rule-paper-play" aria-label="Como jogar">
                    <ol>{GUIDE_PLAY_STEPS[rule.id].map(step => <li key={step}>{step}</li>)}</ol>
                </section>
                <ConditionReference ruleId={rule.id} query={query} />
                <p className="guide-short-example"><strong>Por exemplo.</strong> {rule.example}</p>
                <details className="guide-rule-full-rule" open={expanded}>
                    <summary onClick={event => { event.preventDefault(); setDetailChoice({ query, open: !expanded }); }}>Detalhes e exceções · {rule.id}</summary>
                    {expanded && <>
                        <section className="guide-paper-procedure" aria-label="Procedimento com papel e dados">
                            <h5>Como resolver com papel e dados</h5>
                            <ol>{GUIDE_PAPER_STEPS[rule.id].map(step => <li key={step}>{step}</li>)}</ol>
                        </section>
                        <RuleCanonicalText rule={rule} />
                        <WorkedScene id={rule.id} />
                        <GuideAuditCase caseId={rule.auditCase} expanded={detailMatch} />
                        {rule.additionalAuditCases?.map(caseId => <GuideAuditCase key={caseId} caseId={caseId} expanded={detailMatch} />)}
                    </>}
                </details>
                <details className="guide-rule-app" open={appMatch}>
                    <summary>No MyOwnDex</summary>
                    <ul>{rule.steps.map(item => <li key={item}><RuleBullet text={item} /></li>)}</ul>
                </details>
            </div>
        </details>
    );
});

export default function TrainerGuide({ experienceMode }) {
    const [query, setQuery] = useState("");
    const [chapter, setChapter] = useState("");
    const [scaleValue, setScaleValue] = useState("");
    const [level, setLevel] = useState("");
    const protectionRef = useRef(null);
    const searchRef = useRef(null);
    const scaleLabelId = useId(), scaleResultId = useId(), levelLabelId = useId(), levelResultId = useId();
    const selectedMode = EXPERIENCE_MODES[experienceMode] || EXPERIENCE_MODES.rpg;
    const searching = Boolean(query.trim());
    const progress = getGuideLevelProgress(level, experienceMode);
    const normalizedLevel = progress.level;
    const showProtection = () => {
        setQuery("");
        setChapter("");
        window.requestAnimationFrame(() => {
            const rule = protectionRef.current;
            if (!rule) return;
            rule.open = true;
            const completeRule = rule.querySelector(".guide-rule-full-rule");
            if (completeRule && !completeRule.open) completeRule.querySelector(":scope > summary")?.click();
            rule.querySelector(":scope > summary")?.focus({ preventScroll: true });
            revealInScrollArea(rule, { block: "start", behavior: "instant" });
        });
    };

    const visibleSections = useMemo(() => searchGuideSections(searchIndex, query)
        .filter(section => !chapter || section.id === chapter), [query, chapter]);

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
                    <p className="guide-introduction">Explore, cuide dos seus parceiros e viva aventuras em grupo. Escolha um assunto ou busque sua dúvida; cada regra traz como jogar e um exemplo.</p>
                    <div className="guide-terms-inline" aria-label="Termos básicos">
                        <span><strong>HP</strong> pontos de vida</span>
                        <span><strong>PP</strong> usos do movimento</span>
                        <span><strong>XP</strong> experiência</span>
                    </div>
                    <details className="guide-start">
                        <summary>Primeira aventura? Comece aqui</summary>
                        <p>Uma pessoa narra o mundo; as outras escolhem o que seus Treinadores e Pokémon tentam. Tenham fichas, dados e algo para anotar. Contem o objetivo, combinem o risco e rolem apenas se houver uma dúvida importante.</p>
                        <p><strong>Turno</strong> é a vez de um Pokémon. <strong>Rodada</strong> é a volta completa: Pikachu age, Bulbasaur age e, depois das vezes de todos, vêm os efeitos finais.</p>
                        <p>Estas são adaptações para a mesa. Para começar, consultem Explorar e descobrir caminhos, Usar um movimento e Narrador e jogadores. As contas e exceções continuam disponíveis em cada regra.</p>
                        <p>Os nomes de Pokémon, movimentos, habilidades, itens, tipos e condições seguem a referência oficial. As explicações em português ajudam a entender o que cada um faz.</p>
                        <dl className="guide-word-help">
                            <div><dt>Movimento</dt><dd>O golpe ou efeito que você escolhe usar, como Tackle ou Growl.</dd></div>
                            <div><dt>Habilidade</dt><dd>Uma característica do Pokémon que funciona quando sua regra permite, como Static de Pikachu.</dd></div>
                            <div><dt>Tipo</dt><dd>Uma característica do Pokémon ou do movimento. Pikachu é Electric; Tackle é Normal.</dd></div>
                            <div><dt>Prioridade</dt><dd>Ajuda a decidir quem age primeiro. Quick Attack pode vir antes de um movimento mais lento na ordem, mesmo contra um Pokémon veloz.</dd></div>
                            <div><dt>Estágio</dt><dd>Uma mudança temporária de atributo. Growl pode diminuir o Ataque do alvo.</dd></div>
                            <div><dt>Status</dt><dd>Categoria de movimentos que mudam algo sem causar dano direto. Growl é dessa categoria. Ela é diferente da condição anotada na ficha.</dd></div>
                        </dl>
                    </details>
                    <label className="guide-search">
                        <span>Pesquisar regras</span>
                        <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} />
                    </label>
                    <nav className="guide-chapters" aria-label="Assuntos do guia">
                        <button type="button" className="room-secondary-button" aria-pressed={!chapter} onClick={() => setChapter("")}>Todos</button>
                        {RPG_RULE_SECTIONS.map(section => <button key={section.id} type="button" className="room-secondary-button" aria-pressed={chapter === section.id} onClick={() => setChapter(section.id)}>{section.shortTitle || section.title}</button>)}
                    </nav>
                    {(searching || chapter) && <p className="guide-search-result" role="status">{visibleRuleCount} {visibleRuleCount === 1 ? "regra encontrada" : "regras encontradas"} <button type="button" className="room-secondary-button" onClick={() => { setQuery(""); setChapter(""); searchRef.current?.focus({ preventScroll: true }); }}>Ver todas as regras</button></p>}
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
                                        <GuideRule key={rule.id} rule={rule} query={query} protectionRef={protectionRef} />
                                    ))}
                                </div>
                            </section>
                        ))}
                        {!visibleSections.length && <p className="guide-empty">Nenhuma regra encontrada neste assunto. Tente outro termo ou selecione Todos.</p>}
                    </div>
                </article>

                <aside className="guide-tools" aria-label="Ferramentas do guia">
                    <details className="game-panel guide-calculator">
                        <summary>Conversão para o RPG</summary>
                        <div className="guide-calculator-content">
                            <p>Use o HP ou atributo da ficha original do seu Pokémon. Os resultados aparecem depois que você informa um valor.</p>
                            <div className="guide-conversion-grid">
                                <label className="guide-number-field">
                                    <span className="guide-field-label" id={scaleLabelId}>Valor original</span>
                                    <input aria-labelledby={scaleLabelId} aria-describedby={scaleResultId} type="number" min="0" max="999999" step="1" value={scaleValue} onChange={event => setScaleValue(event.target.value)} onBlur={() => { if (scaleValue !== "") setScaleValue(integerInRange(scaleValue, 0, 999999, 0)); }} />
                                    <span className="guide-scale-results" id={scaleResultId} aria-live="polite">
                                        <span>Atributo ÷ {RPG_SCALE_DIVISOR} <strong>{scaleValue === "" ? "—" : formatNumberPtBr(getRpgScale(scaleValue))}</strong></span>
                                        <span>HP ÷ {RPG_HP_DIVISOR} <strong>{scaleValue === "" ? "—" : formatNumberPtBr(getRpgScale(scaleValue, true))}</strong></span>
                                    </span>
                                </label>
                                <label className="guide-number-field">
                                    <span className="guide-field-label" id={levelLabelId}>Nível atual</span>
                                    <input aria-labelledby={levelLabelId} aria-describedby={levelResultId} type="number" min="1" max={progress.cap} step="1" value={level} onChange={event => setLevel(event.target.value)} onBlur={() => { if (level !== "") setLevel(normalizedLevel); }} />
                                    <span className="guide-field-value" id={levelResultId}>{level === "" ? "Informe o nível da ficha." : progress.requiredXp === null ? `Nível máximo · ${progress.cap}` : <>Meta do próximo nível: <strong>{formatNumberPtBr(progress.requiredXp)}</strong></>}</span>
                                </label>
                            </div>
                            <details className="guide-rounding-help">
                                <summary>Como arredonda</summary>
                                <p>Escolha o número inteiro mais próximo. Se ficar exatamente no meio, o HP sobe e os outros atributos descem. A meta de XP sempre arredonda para baixo.</p>
                            </details>
                            {level !== "" && <article className="guide-damage-limit-card" aria-label={`Limite comum de dano: ${formatNumberPtBr(normalizedLevel)}`}>
                                <div className="guide-damage-limit-value">
                                    <span>Limite comum de dano</span>
                                    <strong>{level === "" ? "—" : formatNumberPtBr(normalizedLevel)}</strong>
                                </div>
                                <details className="guide-effectiveness-help">
                                    <summary>Tipos e limite de dano</summary>
                                    <dl className="guide-effectiveness-cases">
                                        <div className="is-immune"><dt>Imune <b>0</b></dt><dd>O movimento não causa dano.</dd></div>
                                        <div className="is-resistant"><dt>Resistente <b>50% ou 25%</b></dt><dd>O dano cai para metade ou um quarto. O limite inicial continua {formatNumberPtBr(normalizedLevel)}.</dd></div>
                                        <div className="is-neutral"><dt>Normal <b>×1</b></dt><dd>O limite por impacto é {formatNumberPtBr(normalizedLevel)}.</dd></div>
                                        <div className="is-effective"><dt>Superefetivo <b>×2 ou ×4</b></dt><dd>O dano e o limite aumentam. Neste nível, o limite vai a {formatNumberPtBr(normalizedLevel * 2)} ou {formatNumberPtBr(normalizedLevel * 4)}.</dd></div>
                                    </dl>
                                    <p>Combine os tipos do alvo: duas fraquezas multiplicam por 4; uma fraqueza e uma resistência se equilibram; duas resistências deixam um quarto do dano. Uma imunidade mantém 0, salvo um efeito que a remova.</p>
                                    <p>Aumentar os estágios do atributo usado no ataque também pode aumentar o limite na mesma proporção. Críticos e movimentos com regras próprias seguem suas exceções.</p>
                                </details>
                            </article>}
                            <button type="button" className="guide-hit-kill-link room-secondary-button" onClick={showProtection}>Como aguentar um golpe decisivo</button>
                        </div>
                    </details>
                    <details className="game-panel guide-mode-note"><summary>Contas para jogar na mesa</summary><PaperCalculations /></details>
                    <details className="game-panel guide-mode-note">
                        <summary>Regras em uso: {selectedMode.shortLabel}</summary>
                        <p>{selectedMode.description}</p>
                    </details>
                </aside>
            </div>
        </div>
    );
}
