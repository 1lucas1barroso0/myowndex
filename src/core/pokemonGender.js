import { finiteNumberOrNull, integerInRange } from "./math.js";

// These sexes are separate Pokémon resources with their own stats, abilities
// or learnsets. Their species-wide ratio describes which form is encountered;
// it must never be used to change the sex of an already selected form.
const FIXED_GENDER_NAMES = /^(?:meowstic|indeedee|basculegion|oinkologne)-(male|female)(?:-mega(?:-[xy])?)?$/;

export const getFixedFormGender = pokemon => {
    const names = typeof pokemon === "string" ? [pokemon] : [
        pokemon?.species?.name,
        pokemon?.formName,
        pokemon?.pokemonName,
        pokemon?.name,
        pokemon?.formKey,
    ];
    const resourceName = names.find(name => typeof name === "string" && name)?.toLowerCase();
    for (const name of names) {
        const match = typeof name === "string" && name.toLowerCase().match(FIXED_GENDER_NAMES);
        if (match && resourceName.replace(/-(?:male|female)(?:-mega(?:-[xy])?)?$/, "") === name.toLowerCase().replace(/-(?:male|female)(?:-mega(?:-[xy])?)?$/, "")) {
            return match[1] === "female" ? "F" : "M";
        }
    }
    return null;
};

export const getPokemonGenderRate = (pokemon, fallbackRate) => {
    const fixedGender = getFixedFormGender(pokemon);
    if (fixedGender) return fixedGender === "F" ? 8 : 0;
    const rate = finiteNumberOrNull(fallbackRate ?? pokemon?.genderRate ?? pokemon?.species?.gender_rate ?? pokemon?.gender_rate);
    return rate == null ? -1 : integerInRange(rate, -1, 8, -1);
};
