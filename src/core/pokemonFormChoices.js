import { shouldSeparateDexVariant } from "./dexVariants.js";
import { getStableFormIdentity } from "./formEvolution.js";

/** Form changes belong to this individual; distinct Pokémon are chosen elsewhere. */
export const getSamePokemonForms = (varieties, identity) => {
    const entries = Array.isArray(varieties) ? varieties : [];
    const activeName = typeof identity === "string" ? identity
        : identity?.pokemonName || identity?.species?.name || identity?.name || identity?.formKey;
    if (!activeName) return [];
    const active = getStableFormIdentity({ name: activeName, speciesId: identity?.speciesId });
    const activeIsDistinct = shouldSeparateDexVariant(active);
    return entries.filter(entry => {
        const name = entry?.pokemon?.name;
        if (!name) return false;
        // The selected form stays visible even in an older catalogue snapshot.
        if (name === activeName) return true;
        const candidate = getStableFormIdentity({ name, speciesId: active.speciesId });
        if (activeIsDistinct || shouldSeparateDexVariant(candidate)) return candidate.name === active.name;
        return true;
    });
};
