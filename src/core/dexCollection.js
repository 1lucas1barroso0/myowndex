import { extractId } from "./mechanics.js";
import { getDexVariantRegion } from "./dexVariants.js";

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
export const DEX_REGIONS = Object.freeze([
    { id: "alola", label: "Alola" },
    { id: "galar", label: "Galar" },
    { id: "hisui", label: "Hisui" },
    { id: "paldea", label: "Paldea" },
]);
export const debutGeneration = id => DEX_GENERATIONS.slice(1).find(gen => Number(id) >= gen.start && Number(id) <= gen.end);
export const dexEntryNumber = entry => Number(entry?.speciesId || extractId(entry?.url));
export const dexEntryFavoriteKey = entry => entry?.formKey && !entry?.isPrimarySpecies ? `form:${entry.formKey}` : String(dexEntryNumber(entry));
export const dexEntryFavoriteKeys = entry => [dexEntryFavoriteKey(entry),
    ...(entry?.isPrimarySpecies && entry?.formKey ? [`form:${entry.formKey}`] : [])];
export const dexEntryRegion = entry => getDexVariantRegion({
    name: entry?.formKey || entry?.pokemonName || entry?.name,
})?.key || "";
const isVariantEntry = entry => entry?.isPrimarySpecies === false || (Boolean(entry?.formKey) && entry?.isPrimarySpecies !== true);
export const dexEntryTypes = entry => (Array.isArray(entry?.types) ? entry.types : [])
    .map(type => typeof type === "string" ? type : type?.type?.name)
    .filter(Boolean);
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

export const parseDexRange = value => {
    const raw = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const bounded = number => Number.isInteger(number) && number >= 1 && number <= 1025 ? number : null;
    const closed = raw.match(/^#?0*(\d{1,4})\s*(?:-|–|—|\.\.|\ba\b|\bate\b|\bto\b)\s*#?0*(\d{1,4})$/i);
    if (closed) {
        const left = bounded(Number(closed[1]));
        const right = bounded(Number(closed[2]));
        return left && right ? [Math.min(left, right), Math.max(left, right)] : null;
    }
    const from = raw.match(/^(?:a\s+partir\s+de|desde|>=?)\s*#?0*(\d{1,4})$/i);
    if (from) {
        const start = bounded(Number(from[1]));
        return start ? [start, 1025] : null;
    }
    const through = raw.match(/^(?:ate|<=?)\s*#?0*(\d{1,4})$/i);
    if (through) {
        const end = bounded(Number(through[1]));
        return end ? [1, end] : null;
    }
    return null;
};

export function selectDexSpecies(species, {
    query = "",
    favorites = [],
    onlyFavorites = false,
    order = "number",
    generation = "all",
    types = [],
    regions = [],
    variantMode = "grouped",
    minNumber = null,
    maxNumber = null,
} = {}) {
    const rawQuery = String(query ?? "").trim();
    const normalized = normalizeDexSearch(rawQuery);
    const numericRange = parseDexRange(rawQuery);
    const numericQuery = !numericRange && /^\d+$/.test(normalized) ? Number(normalized) : null;
    const selected = new Set(favorites);
    const selectedTypes = [...new Set((Array.isArray(types) ? types : [])
        .map(type => String(type ?? "").trim().toLowerCase())
        .filter(Boolean))].slice(0, 2);
    const validRegions = new Set(DEX_REGIONS.map(region => region.id));
    const selectedRegions = new Set((Array.isArray(regions) ? regions : []).filter(region => validRegions.has(region)));
    const range = DEX_GENERATIONS.find(gen => gen.id === String(generation)) || DEX_GENERATIONS[0];
    const selectedGeneration = range.id;
    const selectedOrder = ["number", "reverse", "name"].includes(order) ? order : "number";
    const selectedVariantMode = variantMode === "separate" ? "separate" : "grouped";
    const minimum = Number.isInteger(Number(minNumber)) && Number(minNumber) >= 1 ? Math.min(1025, Number(minNumber)) : 1;
    const maximum = Number.isInteger(Number(maxNumber)) && Number(maxNumber) >= 1 ? Math.min(1025, Number(maxNumber)) : 1025;
    const lower = Math.min(minimum, maximum);
    const upper = Math.max(minimum, maximum);
    const matching = (Array.isArray(species) ? species : []).filter(entry => {
        const id = dexEntryNumber(entry);
        if (!Number.isInteger(id) || id < lower || id > upper) return false;
        const entryGeneration = dexEntryGeneration(entry);
        if (selectedGeneration !== "all" && entryGeneration?.id !== selectedGeneration) return false;

        const searchable = [entry?.name, entry?.speciesName, entry?.pokemonName, entry?.formKey, entry?.formIdentifier]
            .filter(Boolean).map(value => normalizeDexSearch(value));
        const matchesQuery = !rawQuery
            || (numericRange ? id >= numericRange[0] && id <= numericRange[1]
                : numericQuery !== null ? id === numericQuery
                    : searchable.some(value => value.includes(normalized)));
        if (!matchesQuery) return false;

        if (onlyFavorites && !dexEntryFavoriteKeys(entry).some(key => selected.has(key))) return false;

        const entryRegion = dexEntryRegion(entry);
        if (selectedRegions.size && !selectedRegions.has(entryRegion)) return false;

        const entryTypes = dexEntryTypes(entry);
        if (selectedTypes.length && !selectedTypes.every(type => entryTypes.includes(type))) return false;

        return true;
    });
    // Compact display happens after all filters. A later regional or distinct
    // identity can represent the National entry when the original does not
    // match. If both match, prefer the original without clearing any filter.
    const displayed = selectedVariantMode === "separate" ? matching
        : [...matching.reduce((byNumber, entry) => {
            const id = dexEntryNumber(entry);
            const current = byNumber.get(id);
            if (!current || (isVariantEntry(current) && !isVariantEntry(entry))) byNumber.set(id, entry);
            return byNumber;
        }, new Map()).values()];
    return displayed.sort((a, b) => {
        if (selectedOrder === "name") {
            const left = String(a.speciesName || a.name);
            const right = String(b.speciesName || b.name);
            const difference = left.localeCompare(right, "pt-BR");
            if (difference) return difference;
        }
        const numberDifference = dexEntryNumber(a) - dexEntryNumber(b);
        if (numberDifference) return numberDifference * (selectedOrder === "reverse" ? -1 : 1);
        const primaryDifference = Number(isVariantEntry(a)) - Number(isVariantEntry(b));
        if (primaryDifference) return primaryDifference;
        return String(a.formKey || a.name).localeCompare(String(b.formKey || b.name), "pt-BR");
    });
}
