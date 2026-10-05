import { extractId } from "./mechanics.js";

export const VIEW_LINKS = Object.freeze({ room: "aventura", pokedex: "pokedex", teambuilder: "pc", guide: "guia" });
// National numbers describe debut generations, not a regional Pokédex membership.
export const DEX_GENERATIONS = Object.freeze([
    { id: "all", label: "Todas", start: 1, end: Infinity },
    { id: "1", label: "I", start: 1, end: 151 },
    { id: "2", label: "II", start: 152, end: 251 },
    { id: "3", label: "III", start: 252, end: 386 },
    { id: "4", label: "IV", start: 387, end: 493 },
    { id: "5", label: "V", start: 494, end: 649 },
    { id: "6", label: "VI", start: 650, end: 721 },
    { id: "7", label: "VII", start: 722, end: 809 },
    { id: "8", label: "VIII", start: 810, end: 905 },
    { id: "9", label: "IX", start: 906, end: 1025 },
]);

export const getDexSpeciesId = entry => Number(entry?.speciesId || extractId(entry?.url)) || 0;
export const getDexPokemonId = entry => Number(entry?.pokemonId || extractId(entry?.pokemonUrl) || getDexSpeciesId(entry)) || 0;
export const getDexEntryName = entry => entry?.isDefault === false
    ? (entry?.pokemonName || entry?.name || entry?.speciesName || "")
    : (entry?.speciesName || entry?.name || entry?.pokemonName || "");
export const getDexEntryIdentity = entry => String(entry?.pokemonName || entry?.name || getDexPokemonId(entry));

export const debutGeneration = id => DEX_GENERATIONS.slice(1).find(gen => Number(id) >= gen.start && Number(id) <= gen.end);
export const viewFromUrl = url => Object.keys(VIEW_LINKS).find(view => VIEW_LINKS[view] === new URL(url).searchParams.get("abrir"));
export const urlForView = (url, view) => {
    const next = new URL(url);
    if (VIEW_LINKS[view]) next.searchParams.set("abrir", VIEW_LINKS[view]);
    return `${next.pathname}${next.search}${next.hash}`;
};

// Match accents, punctuation, gender symbols and zero-padded National Dex numbers.
export const normalizeDexSearch = value => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/♀/g, "f").replace(/♂/g, "m").replace(/[^a-z0-9]/g, "");

export const parseDexNumberRange = value => {
    const text = String(value ?? "").trim().toLowerCase();
    const match = text.match(/^#?\s*(\d{1,4})\s*(?:-|–|—|\.\.|\ba\b|\bate\b|\baté\b|\bto\b)\s*#?\s*(\d{1,4})$/iu);
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (!Number.isInteger(first) || !Number.isInteger(second) || first < 1 || second < 1) return null;
    return { start: Math.min(first, second), end: Math.max(first, second) };
};

export function selectDexSpecies(species, { query = "", favorites = [], onlyFavorites = false, order = "number", generation = "all" } = {}) {
    const normalized = normalizeDexSearch(query);
    const numericQuery = /^\d+$/.test(normalized) ? Number(normalized) : null;
    const numericRange = parseDexNumberRange(query);
    const selected = new Set((Array.isArray(favorites) ? favorites : []).map(String));
    const generationRange = DEX_GENERATIONS.find(gen => gen.id === generation) || DEX_GENERATIONS[0];

    return (Array.isArray(species) ? species : []).filter(entry => {
        const id = getDexSpeciesId(entry);
        if (id < generationRange.start || id > generationRange.end) return false;
        if (onlyFavorites && !selected.has(String(id))) return false;
        if (!String(query ?? "").trim()) return true;
        if (numericRange) return id >= numericRange.start && id <= numericRange.end;
        if (numericQuery !== null) return id === numericQuery;
        const searchable = [
            entry?.speciesName,
            entry?.pokemonName,
            entry?.form,
            entry?.name,
        ].filter(Boolean).map(normalizeDexSearch);
        return searchable.some(value => value.includes(normalized));
    }).sort((left, right) => {
        const leftId = getDexSpeciesId(left);
        const rightId = getDexSpeciesId(right);
        if (order === "name") {
            const byName = getDexEntryName(left).localeCompare(getDexEntryName(right), "pt-BR");
            return byName || leftId - rightId || getDexPokemonId(left) - getDexPokemonId(right);
        }
        const byNumber = (leftId - rightId) * (order === "reverse" ? -1 : 1);
        if (byNumber) return byNumber;
        if (Boolean(left?.isDefault) !== Boolean(right?.isDefault)) return left?.isDefault ? -1 : 1;
        return getDexPokemonId(left) - getDexPokemonId(right);
    });
}
