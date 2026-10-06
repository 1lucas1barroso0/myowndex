const REGION_LABELS = Object.freeze({
    alola: "Alola",
    galar: "Galar",
    hisui: "Hisui",
    paldea: "Paldea",
});

// These are identities a captured/evolved individual does not freely swap into
// and out of. Interchangeable modes such as Rotom appliances, Deoxys formes,
// Therian formes, Furfrou trims, Oricorio styles, Arceus/Silvally types,
// fusions and held-item modes stay inside the ordinary species record.
const FIXED_VARIANT_SPECIES = new Set([
    25, 172, 201, 413, 422, 423, 550, 592, 593, 666, 668, 669, 670, 671,
    678, 710, 711, 745, 774, 849, 854, 855, 869, 876, 892, 901, 902, 916,
    925, 931, 978, 982, 999, 1012, 1013,
]);

const FIXED_SPECIAL_NAMES = new Set([
    "eevee-starter",
    "pichu-spiky-eared",
    "rockruff-own-tempo",
    "magearna-original",
    "zarude-dada",
]);

export const getDexVariantRegion = entry => {
    const name = String(entry?.name || "");
    for (const [key, label] of Object.entries(REGION_LABELS)) {
        if (new RegExp(`-${key}(?:-|$)`).test(name)) return { key, label };
    }
    return null;
};

export const getDexVariantMeta = entry => {
    const region = getDexVariantRegion(entry);
    if (region) return { separable: true, kind: "regional", region: region.key, regionLabel: region.label };
    const name = String(entry?.name || "");
    const speciesId = Number(entry?.speciesId);
    const fixed = FIXED_VARIANT_SPECIES.has(speciesId)
        || FIXED_SPECIAL_NAMES.has(name)
        || /-totem(?:-|$)/.test(name);
    return { separable: fixed, kind: fixed ? "fixed" : "interchangeable", region: "", regionLabel: "" };
};

export const shouldSeparateDexVariant = entry => getDexVariantMeta(entry).separable;
