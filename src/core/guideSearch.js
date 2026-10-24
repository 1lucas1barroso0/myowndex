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
            const text = [rule.id, rule.title, rule.plain || "", GUIDE_PLAYER_SCENES[rule.id] || "", GUIDE_RULE_CONTEXTS[rule.id] || "", ...GUIDE_PAPER_STEPS[rule.id], rule.body || "", ...(rule.bullets || []), ...rule.steps, getGuideAuditText(rule.auditCase)].join(" ");
            return { rule, text: normalizeSearch(`${text} ${legacySearchAliases(text)}`) };
        }),
    })),
});

export const searchGuideSections = (index, query) => {
    const normalized = normalizeSearch(query);
    if (!normalized) return index.sections;
    return index.rows.map(({ section, text, rules }) => text.includes(normalized) ? section : {
        ...section,
        rules: rules.filter(row => row.text.includes(normalized)).map(row => row.rule),
    }).filter(section => section.rules.length);
};
