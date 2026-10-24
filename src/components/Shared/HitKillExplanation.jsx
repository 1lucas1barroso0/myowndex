import React from "react";
import { RPG_RULE_SECTIONS } from "../../core/rpgRules.js";
import GuideAuditCase from '../Guide/GuideAuditCase.jsx';
import RuleText from './RuleText.jsx';

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
                <li><span className="guide-hit-kill-step" aria-hidden="true">1</span><div><strong>HP cheio</strong><span>No começo da ação.</span></div></li>
                <li><span className="guide-hit-kill-step" aria-hidden="true">2</span><div><strong>O golpe o derrubaria</strong><span>O aplicativo confere se o movimento está dentro dos limites desta proteção.</span></div></li>
                <li className="guide-hit-kill-outcome"><span className="guide-hit-kill-step" aria-hidden="true">3</span><div><strong>Continua com <b>1 HP</b></strong><span>A ação termina com 1 HP; a proteção é usada.</span></div></li>
            </ol>
            <p className="guide-hit-kill-example"><strong>Por exemplo:</strong> {protectionRule?.example}</p>
            <details className="guide-hit-kill-full-rule" open={expanded}>
                <summary>Regra completa</summary>
                <div className="guide-hit-kill-canonical">
                    <RuleText rule={protectionRule} />
                    <GuideAuditCase caseId={protectionRule?.auditCase} expanded={expanded} />
                </div>
            </details>
        </div>
    );
}
