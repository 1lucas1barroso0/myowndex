import animatedSprites from "../data/animated-sprites.json" with { type: "json" };
import { finiteNumberOrNull } from "./math.js";

const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites";
const CURRENT = `${SPRITES}/master/sprites/pokemon/`;
const ANIMATED = `${SPRITES}/${animatedSprites.commit}/sprites/pokemon/versions/generation-v/black-white/animated/`;
const regularAnimations = new Set(animatedSprites.regular);
const shinyAnimations = new Set(animatedSprites.shiny);
const validKey = value => /^[0-9]+(?:-[a-z0-9-]+)?$/.test(String(value || "")) ? String(value) : "";
const unique = values => [...new Set(values.filter(value => typeof value === "string" && value))];
const isAnimated = value => /\.gif(?:[?#].*)?$/i.test(value);

const sourceKey = value => {
    if (typeof value !== "string") return "";
    if (/^\/sprites\/\d+\.png$/.test(value)) return value.match(/(\d+)\.png$/)[1];
    if (!value.startsWith(`${SPRITES}/`)) return "";
    return validKey(value.match(/\/sprites\/pokemon\/(?:[^?#]*\/)?([0-9]+(?:-[a-z0-9-]+)?)\.(?:png|gif)(?:[?#].*)?$/)?.[1]);
};

const staticAnimationSource = value => isAnimated(value) && value.startsWith(`${SPRITES}/`)
    ? value.replace("/animated/", "/").replace(/\.gif(?=[?#]|$)/, ".png")
    : "";

/** Select only the requested identity. Asset availability is bundled, so a
 * Pokémon never waits for a catalog request merely to come to life. */
export const getPokemonSpriteSources = ({ src = "", pokemonId, spriteKey = "", shiny = false, candidates = [], strictAppearance = false } = {}) => {
    const id = finiteNumberOrNull(pokemonId);
    const numericKey = Number.isInteger(id) && id > 0 ? String(id) : "";
    const explicitKey = validKey(spriteKey);
    const providedKey = sourceKey(src);
    const key = explicitKey || providedKey || numericKey;
    const provided = unique([src, ...(Array.isArray(candidates) ? candidates : [])]);
    const specialView = typeof src === "string" && /\/(?:forms|female|back)\//.test(src);
    const opaqueSource = Boolean(src && !providedKey);
    const exactOnly = specialView || opaqueSource || (strictAppearance && !explicitKey && !providedKey);

    if (exactOnly) {
        return {
            animated: provided.filter(isAnimated),
            static: unique([...provided.filter(value => !isAnimated(value)), ...provided.map(staticAnimationSource)]),
        };
    }

    const sameIdentity = provided.filter(value => !sourceKey(value) || sourceKey(value) === key);
    const requestedShiny = shiny || (typeof src === "string" && src.includes("/shiny/"));
    const requestedAnimation = key && (requestedShiny ? shinyAnimations : regularAnimations).has(key)
        ? `${ANIMATED}${requestedShiny ? "shiny/" : ""}${key}.gif`
        : "";
    const front = key ? `${CURRENT}${requestedShiny ? "shiny/" : ""}${key}.png` : "";
    const regularVariant = key && key !== numericKey ? `${CURRENT}${key}.png` : "";
    const local = key === numericKey && Number.isInteger(id) && ((id >= 1 && id <= 151) || id === 479) && !requestedShiny
        ? `/sprites/${id}.png`
        : "";
    return {
        animated: unique([requestedAnimation, ...sameIdentity.filter(isAnimated)]),
        static: unique([
            requestedShiny ? front : "",
            local,
            ...sameIdentity.filter(value => !isAnimated(value)),
            ...sameIdentity.map(staticAnimationSource),
            front,
            regularVariant,
            key && regularAnimations.has(key)
                ? `${CURRENT}versions/generation-v/black-white/${requestedShiny ? "shiny/" : ""}${key}.png`
                : "",
        ]),
    };
};
