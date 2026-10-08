import { extractId } from './mechanics.js';
import { getDexVariantMeta } from './dexVariants.js';

/** One identity per actual encounter, shared by the Dex and Generator. */
export function buildDexCatalogue(species, formCatalogue = {}, metadata = {}) {
    const source = Array.isArray(species) ? species : [];
    const defaults = new Map((formCatalogue.defaults || [])
        .filter(entry => getDexVariantMeta(entry).separable)
        .map(entry => [entry.speciesId, entry]));
    const names = new Map(source.map(entry => [Number(extractId(entry.url)), entry.name]));
    const originals = source.map(entry => {
        const speciesId = Number(extractId(entry.url));
        const meta = metadata[speciesId] || {};
        const namedDefault = defaults.get(speciesId);
        return {
            ...entry,
            ...(namedDefault || {}),
            name: entry.name,
            speciesId,
            speciesName: entry.name,
            pokemonId: namedDefault?.pokemonId || speciesId,
            pokemonName: namedDefault?.pokemonName || entry.name,
            isPrimarySpecies: true,
            generation: meta.generation || namedDefault?.generation,
            types: meta.types || namedDefault?.types || [],
            pastTypes: meta.pastTypes || namedDefault?.pastTypes || [],
            formKey: namedDefault?.name || '',
            formId: namedDefault?.formId || null,
            formIdentifier: namedDefault?.formIdentifier || '',
            spriteKey: namedDefault?.spriteKey || String(speciesId),
            url: entry.url,
            choiceKey: `species:${speciesId}`,
        };
    });
    const alternatives = (formCatalogue.entries || [])
        .map(entry => ({ entry, variant: getDexVariantMeta(entry) }))
        .filter(({ entry, variant }) => names.has(entry.speciesId) && variant.separable)
        .map(({ entry, variant }) => ({
            ...entry,
            ...variant,
            speciesName: names.get(entry.speciesId),
            isPrimarySpecies: false,
            formKey: entry.name,
            choiceKey: `form:${entry.name}`,
            url: `https://pokeapi.co/api/v2/pokemon-species/${entry.speciesId}/`,
        }));
    return [...originals, ...alternatives];
}

/** Accept old named-default choices while exposing only their canonical row. */
export const findDexCatalogueChoice = (catalogue, key) => (Array.isArray(catalogue) ? catalogue : []).find(entry =>
    entry.choiceKey === key || (entry.isPrimarySpecies && entry.formKey && `form:${entry.formKey}` === key));
