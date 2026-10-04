import React from "react";
import { RPG_RULE_SECTIONS } from "../../core/rpgRules.js";

const protectionRule = RPG_RULE_SECTIONS.flatMap(section => section.rules).find(rule => rule.id === "3.4");

/** One complete explanation, shared by the Guide and in-battle status. */
export default function HitKillExplanation({ expanded = false }) {
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
                <li><span className="guide-hit-kill-step" aria-hidden="true">2</span><div><strong>Dano fatal abaixo de 3× o HP máximo</strong><span>A proteção ainda está disponível.</span></div></li>
                <li className="guide-hit-kill-outcome"><span className="guide-hit-kill-step" aria-hidden="true">3</span><div><strong>Continua com <b>1 HP</b></strong><span>A proteção é usada.</span></div></li>
            </ol>
            <p className="guide-hit-kill-example"><strong>Exemplo:</strong> com 20 HP cheios e a proteção disponível, um dano de 30 deixa 1 HP. Um dano de 60 ou mais atravessa a proteção, mesmo sem crítico.</p>
            <details className="guide-hit-kill-full-rule" open={expanded}>
                <summary>Regra completa</summary>
                <div className="guide-hit-kill-canonical">
                    {protectionRule?.body && <p>{protectionRule.body}</p>}
                    <ul>{protectionRule?.bullets?.map(text => <li key={text}>{text}</li>)}</ul>
                </div>
            </details>
        </div>
    );
}
