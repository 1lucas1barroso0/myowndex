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
export const debutGeneration = id => DEX_GENERATIONS.slice(1).find(gen => Number(id) >= gen.start && Number(id) <= gen.end);
export const dexEntryNumber = entry => Number(entry?.speciesId || extractId(entry?.url));
export const dexEntryGeneration = entry => {
    const explicit = Number(entry?.generation);
    if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 9) return DEX_GENERATIONS.find(gen => gen.id === String(explicit));
    return debutGeneration(dexEntryNumber(entry));
};
export const viewFromUrl = url => Object.keys(VIEW_LINKS).find(view => VIEW_LINKS[view] === new URL(url).searchParams.get("abrir"));
export const urlForView = (url, view) => {
    const next = new URL(url);
    if (VIEW_LINKS[view]) next.searchParams.set("abrir", VIEW_LINKS[view]);
    return `${next.pathname}${next.search}${next.hash}`;
};

// Match accents, punctuation, gender symbols and zero-padded National Dex numbers.
export const normalizeDexSearch = value => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/♀/g, "f").replace(/♂/g, "m").replace(/[^a-z0-9]/g, "");

const parseDexRange = value => {
    const raw = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const match = raw.match(/^#?0*(\d{1,4})\s*(?:-|–|—|\.\.|\ba\b|\bate\b|\bto\b)\s*#?0*(\d{1,4})$/i);
    if (!match) return null;
    const left = Number(match[1]);
    const right = Number(match[2]);
    if (!Number.isInteger(left) || !Number.isInteger(right) || left < 1 || right < 1 || left > 1025 || right > 1025) return null;
    return [Math.min(left, right), Math.max(left, right)];
};

export function selectDexSpecies(species, { query = "", favorites = [], onlyFavorites = false, order = "number", generation = "all" } = {}) {
    const normalized = normalizeDexSearch(query);
    const numericRange = parseDexRange(query);
    const numericQuery = !numericRange && /^\d+$/.test(normalized) ? Number(normalized) : null;
    const selected = new Set(favorites);
    const range = DEX_GENERATIONS.find(gen => gen.id === generation) || DEX_GENERATIONS[0];
    return species.filter(entry => {
        const id = dexEntryNumber(entry);
        const entryGeneration = dexEntryGeneration(entry);
        const inGeneration = generation === "all"
            || entryGeneration?.id === generation
            || (!entry?.generation && id >= range.start && id <= range.end);
        const matchesQuery = !String(query ?? "").trim()
            || (numericRange ? id >= numericRange[0] && id <= numericRange[1]
                : numericQuery !== null ? id === numericQuery
                    : normalizeDexSearch(entry?.name).includes(normalized));
        return inGeneration && (!onlyFavorites || selected.has(String(id))) && matchesQuery;
    }).sort((a, b) => {
        if (order === "name") return a.name.localeCompare(b.name, "pt-BR");
        const numberDifference = dexEntryNumber(a) - dexEntryNumber(b);
        if (numberDifference) return numberDifference * (order === "reverse" ? -1 : 1);
        const formDifference = Number(Boolean(a.formKey)) - Number(Boolean(b.formKey));
        if (formDifference) return formDifference;
        return a.name.localeCompare(b.name, "pt-BR");
    });
}
