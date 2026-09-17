import { integerInRange } from "./math.js";
import { rollPercentTest } from "./rpgRules.js";

export const CAPTURE_BALLS = Object.freeze({
    "poke-ball": { label: "Poké Ball", multiplier: 1 },
    "great-ball": { label: "Great Ball", multiplier: 1.5 },
    "ultra-ball": { label: "Ultra Ball", multiplier: 2 },
    "premier-ball": { label: "Premier Ball", multiplier: 1 },
    "luxury-ball": { label: "Luxury Ball", multiplier: 1 },
    "heal-ball": { label: "Heal Ball", multiplier: 1 },
    "master-ball": { label: "Master Ball", multiplier: 1, automatic: true },
});

// An explicit d100 house adaptation, not the full shake formula of any generation.
export const calculateCaptureChance = ({ target, captureRate, ball = "poke-ball" }) => {
    if (!Object.hasOwn(CAPTURE_BALLS, ball)) throw new Error("Esta Ball exige a resolução guiada do Narrador.");
    if (!Number.isInteger(captureRate) || captureRate < 0 || captureRate > 255) throw new Error("A Pokédex não confirmou uma taxa de captura válida.");
    const maxHp = integerInRange(target?.maxHp, 1, 99999, 1);
    const currentHp = integerInRange(target?.currentHp, 0, maxHp, 0);
    if (currentHp === 0 || target?.captured) throw new Error("Escolha um Pokémon consciente que ainda não foi capturado.");
    const statusBonus = ["sleep", "freeze"].includes(target?.status) ? 2.5
        : ["burn", "poison", "bad-poison", "paralysis"].includes(target?.status) ? 1.5 : 1;
    const hpFactor = (3 * maxHp - 2 * currentHp) / (3 * maxHp);
    const ballBonus = CAPTURE_BALLS[ball].multiplier;
    const automatic = Boolean(CAPTURE_BALLS[ball].automatic);
    const rawChance = 100 * captureRate / 255 * hpFactor * ballBonus * statusBonus;
    const chance = automatic ? 100 : captureRate === 0 ? 0 : Math.max(1, Math.min(100, Math.floor(rawChance)));
    return { model: "rpg-d100-v1", captureRate, currentHp, maxHp, hpFactor, ball, ballBonus, status: target?.status || "", statusBonus, rawChance, chance, automatic };
};

export const rollCapture = (options, random) => {
    const calculation = calculateCaptureChance(options);
    const test = calculation.automatic ? { rolls: [], result: null, success: true } : rollPercentTest({ chance: calculation.chance, random });
    return { ...calculation, rolls: test.rolls, result: test.result, success: test.success };
};

export const captureTrainerKey = token => String(token?.ownerPlayerId || token?.teamShareId || token?.teamId || token?.id || "");
