import { cleanDescription } from './descriptions.js';

// Descriptions are paired during development, never translated by a runtime service.
const preserveCatalogNames = text => cleanDescription(text)
    .replace(/\bPoké\s?bolas\b/gi, 'Poké Balls')
    .replace(/\bPoké\s?bola\b/gi, 'Poké Ball')
    .replace(/\bRei Alado\b/g, 'Winged King')
    .replace(/\bSerpente Férrea\b/g, 'Iron Serpent');

export const getPokedexRecord = (speciesId, entries, fallback = {}, formName) => {
    const entry = entries?.[String(speciesId)];
    const pair = entry?.forms?.[formName] || entry;
    const paired = typeof pair?.en === 'string' && pair.en.trim()
        && typeof pair?.pt === 'string' && pair.pt.trim();
    return {
        original: cleanDescription(paired ? pair.en : fallback.text),
        originalLanguage: paired ? 'en' : fallback.code || 'en',
        portuguese: paired ? preserveCatalogNames(pair.pt) : '',
        source: paired ? pair.source : null,
        version: paired ? pair.version : null,
        sourceKind: paired ? pair.sourceKind : null,
    };
};
