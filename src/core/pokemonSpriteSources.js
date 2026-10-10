import animatedSprites from "../data/animated-sprites.json" with { type: "json" };
import nativeSprites from "../data/native-sprites.json" with { type: "json" };
import { finiteNumberOrNull } from "./math.js";

const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites";
const PINNED = `${SPRITES}/${animatedSprites.commit}/sprites/pokemon/`;
const ANIMATED = `${PINNED}versions/generation-v/black-white/animated/`;
const EXTERNAL = `https://raw.githubusercontent.com/smogon/sprites/${nativeSprites.smogonCommit}/`;
const bwViews = Object.fromEntries(Object.entries({ "": animatedSprites.regular, shiny: animatedSprites.shiny, ...animatedSprites.views }).map(([view, keys]) => [view, new Set(keys)]));
const knownSources = new Map();
const legacyExternalPaths = new Map();
const validKey = value => /^[0-9]+(?:-[a-z0-9-]+)?$/.test(String(value || "")) ? String(value) : "";
const unique = values => [...new Set(values.filter(value => typeof value === "string" && value))];
const isAnimated = value => /\.(?:gif|apng)(?:[?#].*)?$/i.test(value);
// A GIF containing frames of a 3D model is still a 3D render. Keep these old
// tokens readable for identity migration, but never display them as 2D art.
const allows2DAppearance = value => typeof value === "string" && !/(?:\/other\/(?:showdown|home|official-artwork)\/|\/src\/models\/|\/sprites\/(?:ani|ani-back|ani-shiny|ani-back-shiny|xyani|xyani-back|xyani-shiny|xyani-back-shiny)\/)/i.test(value);
const canonicalView = ({ back, shiny, female }) => [back && "back", shiny && "shiny", female && "female"].filter(Boolean).join("/");
const folder = view => view ? `${view}/` : "";
const rememberSource = (source, identity) => {
    const identities = knownSources.get(source) || [];
    if (!identities.some(item => item.key === identity.key && item.view === identity.view)) identities.push(identity);
    knownSources.set(source, identities);
};

for (const [key, views] of Object.entries(nativeSprites.local)) {
    for (const [view, asset] of Object.entries(views)) {
        for (const source of [asset.animated, asset.static]) if (source) rememberSource(source, { key, view });
    }
}
for (const [key, views] of Object.entries(nativeSprites.external)) {
    for (const [view, path] of Object.entries(views)) {
        rememberSource(`${EXTERNAL}${path}`, { key, view });
        legacyExternalPaths.set(path, { key, view });
    }
}
for (const [source, identity] of Object.entries(nativeSprites.legacyTokens || {})) rememberSource(source, identity);

const sourceIdentity = (value, { pokemonId, spriteKey, shiny } = {}) => {
    if (typeof value !== "string") return null;
    const clean = value.split(/[?#]/)[0];
    if (knownSources.has(clean)) {
        const identities = knownSources.get(clean);
        const requestedKey = validKey(spriteKey) || validKey(pokemonId);
        const matches = identities.filter(identity => identity.key === requestedKey);
        const pool = matches.length ? matches : identities;
        // Deduplication never makes a Totem/Gigantamax inherit the physical
        // identity of an identical drawing, or silently changes its palette.
        return pool.find(identity => typeof shiny === "boolean" && identity.view.includes("shiny") === shiny) || pool[0];
    }
    const externalPath = clean.match(/^https:\/\/raw\.githubusercontent\.com\/smogon\/sprites\/[^/]+\/(.+)$/)?.[1];
    if (externalPath && legacyExternalPaths.has(externalPath)) return legacyExternalPaths.get(externalPath);
    const companionKey = clean.match(/^\/sprites\/companions\/(\d+)\.(?:gif|png)$/)?.[1];
    if (companionKey && nativeSprites.companions?.[companionKey]) return { key: companionKey, view: "", kind: "companion" };
    if (/^\/sprites\/\d+\.png$/.test(clean)) return { key: clean.match(/(\d+)\.png$/)[1], view: "" };
    if (!value.startsWith(`${SPRITES}/`)) return null;
    const fileKey = value.match(/\/sprites\/pokemon\/(?:[^?#]*\/)?([0-9]+(?:-[a-z0-9-]+)?)\.(?:png|gif)(?:[?#].*)?$/)?.[1];
    // A pokemon-form ID is not a pokemon ID. Resolve it through the exact
    // bundled form catalogue, including purely cosmetic forms.
    const key = validKey(/\/forms\//.test(value) ? nativeSprites.formKeys[fileKey] : fileKey);
    if (!key) return null;
    return { key, view: canonicalView({ back: /\/back\//.test(value), shiny: /\/shiny\//.test(value), female: /\/female\//.test(value) }) };
};

/** Resolve a displayed sprite token without confusing form IDs with Pokémon IDs. */
export const getPokemonSpriteIdentity = sourceIdentity;

/** Positive provenance for catalogue art: a filename or a moving GIF alone
 * does not establish that the drawing is authored 2D pixel art. */
export const getPokemonSpriteProvenance = value => {
    if (!allows2DAppearance(value)) return null;
    const clean = value.split(/[?#]/)[0];
    const identity = sourceIdentity(clean);
    if (!identity) return null;
    const { key, view } = identity;
    if (identity.kind === "companion" && Object.values(nativeSprites.companions[key]).includes(clean)) {
        return { verified: true, dimension: "2d", kind: "battle-pixel", source: "PokeAPI/sprites", commit: animatedSprites.commit, key, view };
    }
    const native = nativeSprites.local[key]?.[view];
    if (native && [native.animated, native.static].includes(clean)) {
        const kind = nativeSprites.sourceKinds?.[clean] || (key === "10298" && view === "shiny" ? "menu-pixel" : /\.apng$/.test(native.animated) ? "pmd-pixel" : "battle-pixel");
        const credits = nativeSprites.sourceCredits?.[kind];
        return { verified: true, dimension: "2d", kind, source: credits?.source || "native", commit: credits?.commit, key, view };
    }
    if (/^\/sprites\/(?:[1-9][0-9]*|479)\.png$/.test(clean) && ((Number(key) >= 1 && Number(key) <= 151) || key === "479")) {
        return { verified: true, dimension: "2d", kind: "battle-pixel", source: "PokeAPI/sprites", key, view };
    }
    const bwAnimated = `${ANIMATED}${folder(view)}${key}.gif`;
    const bwStatic = `${PINNED}versions/generation-v/black-white/${folder(view)}${key}.png`;
    const legacyStatic = `${PINNED}${folder(view)}${key}.png`;
    if ((bwViews[view]?.has(key) && [bwAnimated, bwStatic].includes(clean)) || (Number(key) >= 1 && Number(key) <= 649 && legacyStatic === clean)) {
        return { verified: true, dimension: "2d", kind: "battle-pixel", source: "PokeAPI/sprites", commit: animatedSprites.commit, key, view };
    }
    const external = nativeSprites.external[key]?.[view];
    if (external?.startsWith("src/pixels/") && clean === `${EXTERNAL}${external}`) {
        return { verified: true, dimension: "2d", kind: "battle-pixel", source: "smogon/sprites", commit: nativeSprites.smogonCommit, key, view };
    }
    return null;
};

export const isPokemonSpriteSource2D = value => Boolean(getPokemonSpriteProvenance(value));

/** Select only the requested identity, palette, gender and angle. All source
 * availability is bundled; opening a Pokédex card never fetches a catalogue. */
export const getPokemonSpriteSources = ({ src = "", pokemonId, spriteKey = "", shiny = false, candidates = [], strictAppearance = false } = {}) => {
    const id = finiteNumberOrNull(pokemonId);
    const numericKey = Number.isInteger(id) && id > 0 ? String(id) : "";
    const explicitKey = validKey(spriteKey);
    const providedIdentity = sourceIdentity(src, { pokemonId: numericKey, spriteKey: explicitKey, shiny }) || (explicitKey && typeof src === "string" && src.startsWith(`${SPRITES}/`) && /\/forms\//.test(src)
        ? { key: explicitKey, view: canonicalView({ back: /\/back\//.test(src), shiny: /\/shiny\//.test(src), female: /\/female\//.test(src) }) }
        : null);
    const key = explicitKey || providedIdentity?.key || numericKey;
    const provided = unique([src, ...(Array.isArray(candidates) ? candidates : [])]).filter(allows2DAppearance);
    if (providedIdentity?.kind === "companion") {
        const exact = provided.filter(value => getPokemonSpriteProvenance(value)?.key === key);
        return { animated: exact.filter(isAnimated), static: exact.filter(value => !isAnimated(value)) };
    }
    const opaqueSource = Boolean(src && !providedIdentity);
    const exactOnly = opaqueSource || (strictAppearance && !explicitKey && !providedIdentity);

    if (exactOnly) {
        // Custom local artwork remains readable. An unknown catalogue URL is
        // not evidence of exact 2D art, and must not bypass provenance checks.
        const exact = provided.filter(value => !value.startsWith(`${SPRITES}/`) && !/^https:\/\/raw\.githubusercontent\.com\/smogon\/sprites\//.test(value));
        return { animated: exact.filter(isAnimated), static: exact.filter(value => !isAnimated(value)) };
    }

    const view = canonicalView({
        back: Boolean(providedIdentity?.view.includes("back")),
        shiny: shiny || Boolean(providedIdentity?.view.includes("shiny")),
        female: Boolean(providedIdentity?.view.includes("female")),
    });
    const sameIdentity = provided.filter(value => {
        const identity = sourceIdentity(value);
        return !identity || (identity.key === key && identity.view === view);
    });
    const animationKey = nativeSprites.aliases[key] || key;
    const localAsset = nativeSprites.local[key]?.[view] || nativeSprites.local[animationKey]?.[view];
    const externalPath = nativeSprites.external[key]?.[view] || nativeSprites.external[animationKey]?.[view];
    const external2D = externalPath && isPokemonSpriteSource2D(`${EXTERNAL}${externalPath}`) ? `${EXTERNAL}${externalPath}` : "";
    const requestedBw = bwViews[view]?.has(animationKey) ? `${ANIMATED}${folder(view)}${animationKey}.gif` : "";
    const front = Number(key) >= 1 && Number(key) <= 649 ? `${PINNED}${folder(view)}${key}.png` : "";
    const local = !view && key === numericKey && Number.isInteger(id) && ((id >= 1 && id <= 151) || id === 479) ? `/sprites/${id}.png` : "";
    return {
        animated: unique([requestedBw, localAsset?.animated, external2D, ...sameIdentity.filter(value => isAnimated(value) && isPokemonSpriteSource2D(value))]),
        static: unique([
            localAsset?.static,
            local,
            ...sameIdentity.filter(value => !isAnimated(value) && isPokemonSpriteSource2D(value)),
            front,
            animationKey !== key && Number(animationKey) >= 1 && Number(animationKey) <= 649 ? `${PINNED}${folder(view)}${animationKey}.png` : "",
            bwViews[view]?.has(animationKey) ? `${PINNED}versions/generation-v/black-white/${folder(view)}${animationKey}.png` : "",
        ]),
    };
};
