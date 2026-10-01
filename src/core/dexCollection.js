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
export const viewFromUrl = url => Object.keys(VIEW_LINKS).find(view => VIEW_LINKS[view] === new URL(url).searchParams.get("abrir"));
export const urlForView = (url, view) => {
    const next = new URL(url);
    if (VIEW_LINKS[view]) next.searchParams.set("abrir", VIEW_LINKS[view]);
    return `${next.pathname}${next.search}${next.hash}`;
};

// Match accents, punctuation, gender symbols and zero-padded National Dex numbers.
export const normalizeDexSearch = value => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/♀/g, "f").replace(/♂/g, "m").replace(/[^a-z0-9]/g, "");

export function selectDexSpecies(species, { query = "", favorites = [], onlyFavorites = false, order = "number", generation = "all" } = {}) {
    const normalized = normalizeDexSearch(query);
    const numericQuery = /^\d+$/.test(normalized) ? Number(normalized) : null;
    const selected = new Set(favorites);
    const range = DEX_GENERATIONS.find(gen => gen.id === generation) || DEX_GENERATIONS[0];
    return species.filter(entry => {
        const id = extractId(entry?.url);
        return Number(id) >= range.start && Number(id) <= range.end && (!onlyFavorites || selected.has(id)) && (!normalized ||
            (numericQuery !== null ? Number(id) === numericQuery : normalizeDexSearch(entry?.name).includes(normalized)));
    }).sort((a, b) => order === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : (Number(extractId(a.url)) - Number(extractId(b.url))) * (order === "reverse" ? -1 : 1));
}
