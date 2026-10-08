import animatedSprites from "../data/animated-sprites.json" with { type: "json" };
import nativeSprites from "../data/native-sprites.json" with { type: "json" };
import { finiteNumberOrNull } from "./math.js";

const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites";
const CURRENT = `${SPRITES}/master/sprites/pokemon/`;
const PINNED = `${SPRITES}/${animatedSprites.commit}/sprites/pokemon/`;
const ANIMATED = `${PINNED}versions/generation-v/black-white/animated/`;
const SHOWDOWN = `${PINNED}other/showdown/`;
const EXTERNAL = `https://raw.githubusercontent.com/smogon/sprites/${nativeSprites.smogonCommit}/`;
const bwViews = Object.fromEntries(Object.entries({ "": animatedSprites.regular, shiny: animatedSprites.shiny, ...animatedSprites.views }).map(([view, keys]) => [view, new Set(keys)]));
const showdownViews = Object.fromEntries(Object.entries(animatedSprites.showdown).map(([view, keys]) => [view, new Set(keys)]));
const knownSources = new Map();
const validKey = value => /^[0-9]+(?:-[a-z0-9-]+)?$/.test(String(value || "")) ? String(value) : "";
const unique = values => [...new Set(values.filter(value => typeof value === "string" && value))];
const isAnimated = value => /\.(?:gif|apng)(?:[?#].*)?$/i.test(value);
const canonicalView = ({ back, shiny, female }) => [back && "back", shiny && "shiny", female && "female"].filter(Boolean).join("/");
const folder = view => view ? `${view}/` : "";

for (const [key, views] of Object.entries(nativeSprites.local)) {
    for (const [view, asset] of Object.entries(views)) {
        for (const source of [asset.animated, asset.static]) if (source) knownSources.set(source, { key, view });
    }
}
for (const [key, views] of Object.entries(nativeSprites.external)) {
    for (const [view, path] of Object.entries(views)) knownSources.set(`${EXTERNAL}${path}`, { key, view });
}

const sourceIdentity = value => {
    if (typeof value !== "string") return null;
    const clean = value.split(/[?#]/)[0];
    if (knownSources.has(clean)) return knownSources.get(clean);
    if (/^\/sprites\/\d+\.png$/.test(clean)) return { key: clean.match(/(\d+)\.png$/)[1], view: "" };
    if (!value.startsWith(`${SPRITES}/`)) return null;
    const fileKey = value.match(/\/sprites\/pokemon\/(?:[^?#]*\/)?([0-9]+(?:-[a-z0-9-]+)?)\.(?:png|gif)(?:[?#].*)?$/)?.[1];
    // A pokemon-form ID is not a pokemon ID. Resolve it through the exact
    // bundled form catalogue, including purely cosmetic forms.
    const key = validKey(/\/forms\//.test(value) ? nativeSprites.formKeys[fileKey] : fileKey);
    if (!key) return null;
    return { key, view: canonicalView({ back: /\/back\//.test(value), shiny: /\/shiny\//.test(value), female: /\/female\//.test(value) }) };
};

/** Select only the requested identity, palette, gender and angle. All source
 * availability is bundled; opening a Pokédex card never fetches a catalogue. */
export const getPokemonSpriteSources = ({ src = "", pokemonId, spriteKey = "", shiny = false, candidates = [], strictAppearance = false } = {}) => {
    const id = finiteNumberOrNull(pokemonId);
    const numericKey = Number.isInteger(id) && id > 0 ? String(id) : "";
    const explicitKey = validKey(spriteKey);
    const providedIdentity = sourceIdentity(src) || (explicitKey && typeof src === "string" && src.startsWith(`${SPRITES}/`) && /\/forms\//.test(src)
        ? { key: explicitKey, view: canonicalView({ back: /\/back\//.test(src), shiny: /\/shiny\//.test(src), female: /\/female\//.test(src) }) }
        : null);
    const key = explicitKey || providedIdentity?.key || numericKey;
    const provided = unique([src, ...(Array.isArray(candidates) ? candidates : [])]);
    const opaqueSource = Boolean(src && !providedIdentity);
    const exactOnly = opaqueSource || (strictAppearance && !explicitKey && !providedIdentity);

    if (exactOnly) return { animated: provided.filter(isAnimated), static: provided.filter(value => !isAnimated(value)) };

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
    const requestedBw = bwViews[view]?.has(animationKey) ? `${ANIMATED}${folder(view)}${animationKey}.gif` : "";
    const requestedShowdown = showdownViews[view]?.has(animationKey) ? `${SHOWDOWN}${folder(view)}${animationKey}.gif` : "";
    const front = key ? `${CURRENT}${folder(view)}${key}.png` : "";
    const local = !view && key === numericKey && Number.isInteger(id) && ((id >= 1 && id <= 151) || id === 479) ? `/sprites/${id}.png` : "";
    return {
        animated: unique([requestedBw, requestedShowdown, externalPath ? `${EXTERNAL}${externalPath}` : "", localAsset?.animated, ...sameIdentity.filter(isAnimated)]),
        static: unique([
            localAsset?.static,
            local,
            ...sameIdentity.filter(value => !isAnimated(value)),
            front,
            animationKey !== key ? `${CURRENT}${folder(view)}${animationKey}.png` : "",
            bwViews[view]?.has(animationKey) ? `${CURRENT}versions/generation-v/black-white/${folder(view)}${animationKey}.png` : "",
        ]),
    };
};
