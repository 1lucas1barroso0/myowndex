import { extractId } from "./mechanics.js";

export const VIEW_LINKS = Object.freeze({ room: "aventura", pokedex: "pokedex", teambuilder: "pc", guide: "guia" });
export const viewFromUrl = url => Object.keys(VIEW_LINKS).find(view => VIEW_LINKS[view] === new URL(url).searchParams.get("abrir"));
export const urlForView = (url, view) => {
    const next = new URL(url);
    if (VIEW_LINKS[view]) next.searchParams.set("abrir", VIEW_LINKS[view]);
    return `${next.pathname}${next.search}${next.hash}`;
};

// Match accents, punctuation, gender symbols and zero-padded National Dex numbers.
export const normalizeDexSearch = value => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/♀/g, "f").replace(/♂/g, "m").replace(/[^a-z0-9]/g, "");

export function selectDexSpecies(species, { query = "", favorites = [], onlyFavorites = false, order = "number" } = {}) {
    const normalized = normalizeDexSearch(query);
    const numericQuery = /^\d+$/.test(normalized) ? Number(normalized) : null;
    const selected = new Set(favorites);
    return species.filter(entry => {
        const id = extractId(entry?.url);
        return (!onlyFavorites || selected.has(id)) && (!normalized ||
            (numericQuery !== null ? Number(id) === numericQuery : normalizeDexSearch(entry?.name).includes(normalized)));
    }).sort((a, b) => order === "name"
        ? a.name.localeCompare(b.name, "pt-BR")
        : (Number(extractId(a.url)) - Number(extractId(b.url))) * (order === "reverse" ? -1 : 1));
}
