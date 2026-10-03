import champions from '../data/champions-move-overrides.json' with { type: 'json' };

const targetNames = {
    normal: 'selected-pokemon', adjacentFoe: 'selected-pokemon', any: 'selected-pokemon',
    self: 'user', all: 'entire-field', allySide: 'users-field', foeSide: 'opponents-field',
    allyTeam: 'user-and-allies', adjacentAlly: 'ally', adjacentAllyOrSelf: 'user-or-ally',
    allAdjacent: 'all-other-pokemon', allAdjacentFoes: 'all-opponents', randomNormal: 'random-opponent',
    scripted: 'specific-move',
};

/**
 * Latest verified battle deltas, shared by the UI, local dice and server.
 * The tiny pinned subset is bundled; it never depends on a fetched prose cache.
 * Raw API objects, English descriptions and historical values stay untouched.
 */
export const getCurrentMoveReference = move => {
    if (!move || typeof move !== 'object' || Array.isArray(move)) return move;
    const name = String(move.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const delta = champions.moves[name];
    const result = {
        ...move,
        reference_generation: 9,
        reference_ruleset: 'champions',
        reference_metadata_verified: Boolean(delta || move.reference_metadata_verified),
    };
    if (delta) {
        if (delta.basePower != null) result.power = delta.basePower || null;
        if (delta.accuracy != null) result.accuracy = delta.accuracy === true ? null : delta.accuracy;
        if (delta.pp != null) result.pp = delta.pp;
        if (delta.priority != null) result.priority = delta.priority;
        if (delta.type) result.type = { ...move.type, name: delta.type.toLowerCase() };
        if (delta.category) result.damage_class = { ...move.damage_class, name: delta.category.toLowerCase() };
        if (targetNames[delta.target]) result.target = { ...move.target, name: targetNames[delta.target] };
    }
    // Literal self.boosts.spa = -2 in the same pinned Champions source.
    // Existing automation already applies user changes once for spread moves.
    if (champions.statChanges[name]) {
        result.stat_changes = champions.statChanges[name].map(({ stat, change }) => ({
            stat: { name: stat }, change,
        }));
    }
    return result;
};
