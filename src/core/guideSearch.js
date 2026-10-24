import { GUIDE_PLAYER_SCENES } from "./guidePlayerScenes.js";

const normalizeSearch = text => String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const formatRuleForReading = text => String(text);
const legacySearchAliases = text => text.replace(/1 em 8/g, "12,5%").replace(/1 em 3/g, "≈ 33,3%");

/** The rules are static. Normalize their prose once, rather than per keystroke. */
export const createGuideSearchIndex = sections => ({
    sections,
    rows: sections.map(section => ({
        section,
        text: normalizeSearch(`${section.number} ${section.title} ${section.summary}`),
        rules: section.rules.map(rule => {
            const text = [rule.id, rule.title, rule.plain || "", GUIDE_PLAYER_SCENES[rule.id] || "", rule.body || "", ...(rule.bullets || [])].join(" ");
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
