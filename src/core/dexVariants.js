const REGION_LABELS = Object.freeze({
    alola: "Alola",
    galar: "Galar",
    hisui: "Hisui",
    paldea: "Paldea",
});

// Segregation is deliberately conservative. It exists only when a form is,
// for practical gameplay and narrative purposes, a distinct Pokémon identity.
// Cosmetic differences stay inside the ordinary species record even when they
// are permanent or cannot be freely swapped.
//
// Species below have non-regional forms with durable mechanical differences
// such as stats, abilities, typing, movepools, evolution identity or a unique
// battle interaction that belongs to that form itself.
const DISTINCT_VARIANT_SPECIES = new Set([
    413, // Wormadam cloaks
    550, // Basculin stripes
    678, // Meowstic sexes
    710, 711, // Pumpkaboo / Gourgeist sizes
    745, // Lycanroc forms
    849, // Toxtricity forms
    876, // Indeedee sexes
    892, // Urshifu styles
    901, // Ursaluna / Bloodmoon
    902, // Basculegion sexes
    916, // Oinkologne sexes
    978, // Tatsugiri forms
    999, // Gimmighoul forms
]);

// Individual exceptional forms whose species also has ordinary/cosmetic forms.
const DISTINCT_SPECIAL_NAMES = new Set([
    "pikachu-starter",
    "eevee-starter",
    "pichu-spiky-eared",
    "rockruff-own-tempo",
    "floette-eternal",
]);

const REGIONAL_PATTERNS = Object.freeze([
    ["alola", /-alola$/],
    ["galar", /-galar(?:-standard)?$/],
    ["hisui", /-hisui$/],
    ["paldea", /-paldea$/],
    ["paldea", /^tauros-paldea-(?:combat|blaze|aqua)-breed$/],
]);

export const getDexVariantRegion = entry => {
    const name = String(entry?.name || "");
    // Totem/costume/battle-state names may contain a region word without being
    // a regional variant. Match canonical regional identities, not substrings.
    if (/-totem(?:-|$)/.test(name)) return null;
    for (const [key, pattern] of REGIONAL_PATTERNS) {
        if (pattern.test(name)) return { key, label: REGION_LABELS[key] };
    }
    return null;
};

export const getDexVariantMeta = entry => {
    const region = getDexVariantRegion(entry);
    if (region) return { separable: true, kind: "regional", region: region.key, regionLabel: region.label };

    const name = String(entry?.name || "");
    const speciesId = Number(entry?.speciesId);
    const distinct = DISTINCT_VARIANT_SPECIES.has(speciesId)
        || DISTINCT_SPECIAL_NAMES.has(name);

    return {
        separable: distinct,
        kind: distinct ? "distinct" : "grouped",
        region: "",
        regionLabel: "",
    };
};

export const shouldSeparateDexVariant = entry => getDexVariantMeta(entry).separable;
