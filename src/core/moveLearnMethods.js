import { formatName, getLatestVersionGroup } from "./mechanics.js";

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

export const getNaturalLevelUpLearnset = (pokemon, versionGroup, level) => {
    // A natural encounter uses level-up learning. A newer training-only game
    // must not erase an older, valid natural repertoire in automatic mode.
    const automatic = !versionGroup || versionGroup === 'auto';
    const candidates = automatic ? (pokemon?.moves || []).map(entry => ({ ...entry,
        version_group_details: (entry.version_group_details || []).filter(detail => isOrdinaryLevelUpMove(detail, 200)),
    })) : pokemon?.moves;
    const resolved = getLatestVersionGroup(candidates, versionGroup);
    if (!resolved) return { versionGroup: null, moves: [] };
    const legal = new Map();
    for (const entry of pokemon.moves || []) {
        const levels = (entry.version_group_details || []).filter(detail => detail.version_group?.name === resolved
            && isOrdinaryLevelUpMove(detail, level));
        if (entry.move?.name && levels.length) legal.set(entry.move.name, {
            ...entry.move,
            level: Math.max(...levels.map(detail => Number(detail.level_learned_at) || 0)),
        });
    }
    // A natural encounter knows its four most recently learned ordinary
    // level-up moves. Evolution moves (level 0), machines, tutors, egg and
    // transfer-only moves require their own events; never invent those events.
    return { versionGroup: resolved, moves: [...legal.values()].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)).slice(0, 4) };
};
