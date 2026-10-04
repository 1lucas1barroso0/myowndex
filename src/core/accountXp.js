import { integerInRange } from "./math.js";
import { normalizeGrowthData } from "./experience.js";

const object = value => value && typeof value === "object" && !Array.isArray(value);
const floorXp = record => object(record) && Object.hasOwn(record, "xp")
    ? { ...record, xp: integerInRange(record.xp, 0, 999999, 0),
        ...(Object.hasOwn(record, "pendingEvs") || Object.hasOwn(record, "experienceAwards") || Object.hasOwn(record, "closedAward")
            ? { ...normalizeGrowthData(record), ...(record.growthVersion === 0 ? { growthVersion: 0 } : {}) } : {}) } : record;

/** Apply the XP rule only to known player data; measurements and rules stay exact. */
export function normalizeAccountXpDocument(document) {
    const source = object(document) ? document : {};
    const snapshot = source.localAdventure?.snapshot;
    const diceRoom = source.localTools?.diceRoom;
    const generator = source.localTools?.generatorDraft;
    const floorPartner = partner => object(partner) && object(partner.rpg)
        ? { ...partner, rpg: floorXp(partner.rpg) } : partner;
    return {
        ...source,
        ...(Array.isArray(source.boxes) ? { boxes: source.boxes.map(box => object(box) && Array.isArray(box.pokemon)
            ? { ...box, pokemon: box.pokemon.map(floorPartner) } : box) } : {}),
        ...(object(snapshot) ? { localAdventure: { ...source.localAdventure, snapshot: {
            ...snapshot,
            ...(Array.isArray(snapshot.tokens) ? { tokens: snapshot.tokens.map(floorXp) } : {}),
            ...(Array.isArray(snapshot.benchTokens) ? { benchTokens: snapshot.benchTokens.map(floorXp) } : {}),
        } } } : {}),
        ...(object(source.localTools) ? { localTools: {
            ...source.localTools,
            ...(object(diceRoom) ? { diceRoom: { ...diceRoom,
                ...(Array.isArray(diceRoom.tokens) ? { tokens: diceRoom.tokens.map(floorXp) } : {}),
                ...(Array.isArray(diceRoom.benchTokens) ? { benchTokens: diceRoom.benchTokens.map(floorXp) } : {}),
            } } : {}),
            ...(object(generator) && Array.isArray(generator.results) ? { generatorDraft: { ...generator,
                results: generator.results.map(entry => object(entry) ? { ...entry, pokemon: floorPartner(entry.pokemon) } : entry),
            } } : {}),
        } } : {}),
    };
}
