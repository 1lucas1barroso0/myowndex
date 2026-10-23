import { formatName } from "./mechanics.js";

/** A PokéAPI uses level 0 for a move learnt upon evolution.
 * Never turn it into level 1, which is a distinct learnset entry. */
/** Only a strictly positive, integer level establishes ordinary automatic learning.
 * Level 0 is a separate evolution-triggered event, not a free move for an
 * arbitrary newly generated Pokémon. Machines, tutors and eggs are separate.
 * This helper must never change the Pokédex's original acquisition records. */
export const isOrdinaryLevelUpMove = (detail, currentLevel) => (
    detail?.move_learn_method?.name === "level-up"
    && Number.isInteger(detail.level_learned_at)
    && detail.level_learned_at >= 1
    && Number.isInteger(currentLevel)
    && detail.level_learned_at <= currentLevel
);

export const moveLearnMethodLabel = detail => {
    const method = detail?.move_learn_method?.name;
    if (method === "level-up") {
        const level = detail?.level_learned_at;
        if (!Number.isInteger(level) || level < 0) return "Nível não informado";
        if (level === 0) return "Ao evoluir";
        return `Nv. ${level}`;
    }
    if (method === "machine") return "Máquina";
    if (method === "tutor") return "Tutor";
    if (method === "egg") return "Ovo";
    return formatName(method || "Outro");
};
