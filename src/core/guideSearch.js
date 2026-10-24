import { GUIDE_PAPER_STEPS } from "./guidePaperSteps.js";
import { GUIDE_WORKED_SCENES } from "./guideWorkedScenes.js";
import { GUIDE_PLAYER_SCENES } from "./guidePlayerScenes.js";
import { GUIDE_RULE_CONTEXTS } from "./guideRuleContexts.js";
import { GUIDE_AUDIT_CASES } from '../data/guide-audit-cases.js';

const normalizeSearch = text => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const formatRuleForReading = text => String(text);
const legacySearchAliases = text => text.replace(/1 em 8/g, "12,5%").replace(/1 em 3/g, "≈ 33,3%");
export const getGuideAuditText = caseId => {
    const sample = GUIDE_AUDIT_CASES[caseId];
    return sample ? [sample.title,sample.reference,sample.intro || '',sample.setup,...sample.rows.flat()].join(' ') : '';
};

/** The rules are static. Normalize their prose once, rather than per keystroke. */
export const createGuideSearchIndex = sections => ({
    sections,
    rows: sections.map(section => ({
        section,
        text: normalizeSearch(`${section.number} ${section.title} ${section.summary}`),
        rules: section.rules.map(rule => {
            const text = [rule.id, `regra ${rule.number}`, rule.title, rule.plain || "", GUIDE_PLAYER_SCENES[rule.id] || "", GUIDE_RULE_CONTEXTS[rule.id] || "", ...GUIDE_PAPER_STEPS[rule.id], ...Object.values(GUIDE_WORKED_SCENES[rule.id]).flat(), rule.body || "", ...(rule.bullets || []), ...rule.steps, getGuideAuditText(rule.auditCase)].join(" ");
            return { rule, text: normalizeSearch(`${text} ${legacySearchAliases(text)}`) };
        }),
    })),
});

export const searchGuideSections = (index, query) => {
    const normalized = normalizeSearch(query);
    if (!normalized) return index.sections;
    const numbered = normalized.match(/^(?:regra\s+|#)(\d{1,2})$/);
    if (numbered) return index.sections.map(section => ({ ...section,
        rules: section.rules.filter(rule => rule.number === Number(numbered[1])),
    })).filter(section => section.rules.length);
    return index.rows.map(({ section, text, rules }) => text.includes(normalized) ? section : {
        ...section,
        rules: rules.filter(row => row.text.includes(normalized)).map(row => row.rule),
    }).filter(section => section.rules.length);
};

/** Reveal the part that actually contains the match, not every hidden layer. */
export const getGuideRuleSearchState = (rule, query) => {
    const searched = normalizeSearch(query);
    if (!searched) return { details: false, app: false };
    const primary = normalizeSearch([rule.id, rule.title, rule.plain, rule.example, ...GUIDE_PAPER_STEPS[rule.id]].join(' '));
    const primaryMatch = primary.includes(searched);
    const audit = normalizeSearch(getGuideAuditText(rule.auditCase));
    const advanced = normalizeSearch([rule.body || '', ...(rule.bullets || []), ...Object.values(GUIDE_WORKED_SCENES[rule.id]).flat(), audit].join(' '));
    return {
        details: (!primaryMatch && advanced.includes(searched)) || (/\d/.test(searched) && audit.includes(searched)),
        app: !primaryMatch && normalizeSearch(rule.steps.join(' ')).includes(searched),
    };
};
