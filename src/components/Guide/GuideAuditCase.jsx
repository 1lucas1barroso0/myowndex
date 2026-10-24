import React from 'react';
import { GUIDE_AUDIT_CASES } from '../../data/guide-audit-cases.js';

export default function GuideAuditCase({ caseId, expanded = false }) {
    const sample = GUIDE_AUDIT_CASES[caseId];
    if (!sample) return null;
    return <details className="guide-rule-technical" open={expanded} data-audit-case={caseId}>
        <summary>Ver um caso conferido no MyOwnDex</summary>
        <div className="guide-rule-details-content">
            <p><strong>{sample.title}</strong></p>
            <p>{sample.reference}</p>
            <dl className="guide-audit-results">{sample.rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value === 'poison' ? 'Envenenado' : value}</dd></div>)}</dl>
            <details open={expanded}><summary>Conferir as fichas e a situação usadas</summary><p>{sample.setup}</p></details>
            <p className="guide-detail-intro">Caso de teste reproduzido pelo núcleo do aplicativo. Não é o registro de uma aventura de usuário.</p>
        </div>
    </details>;
}
