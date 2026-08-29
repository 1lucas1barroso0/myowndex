import { finiteNumberOrNull, integerInRange, MAX_SAFE_GAME_INTEGER } from "./math.js";
import { secureRandomId } from "./random.js";

export const MAX_ROLL_HISTORY = 30;

const rollMode = value => ["normal", "advantage", "disadvantage"].includes(value) ? value : "normal";
const rollKind = value => value === "percent" ? "percent" : "attribute";

const normalizeValues = (value, maximum) => Array.isArray(value)
    ? value
        .slice(0, 3)
        .map(finiteNumberOrNull)
        .filter(entry => entry != null)
        .map(entry => integerInRange(entry, 1, maximum, 1))
    : [];

export const normalizeRollRecord = (value, fallbackId = "") => {
    if (!value || typeof value !== "object") return null;
    const kind = rollKind(value.kind);
    const values = normalizeValues(value.values, kind === "percent" ? 100 : 6);
    if (!values.length) return null;
    const id = String(value.id || fallbackId).trim().slice(0, 120);
    if (!id) return null;
    const sequence = integerInRange(value.sequence, 1, MAX_SAFE_GAME_INTEGER, 1);
    const result = finiteNumberOrNull(value.result);
    const chance = kind === "percent" ? integerInRange(value.chance, 0, 100, 0) : null;
    return {
        id,
        sequence,
        createdAt: integerInRange(value.createdAt, 0, MAX_SAFE_GAME_INTEGER, 0),
        kind,
        mode: rollMode(value.mode),
        label: String(value.label || "Rolagem").slice(0, 80),
        values,
        kept: normalizeValues(value.kept, kind === "percent" ? 100 : 6),
        result: result == null ? null : integerInRange(result, -99999, 99999, 0),
        chance,
        success: typeof value.success === "boolean" ? value.success : null,
        detail: String(value.detail || "").slice(0, 160),
        context: String(value.context || "guia").slice(0, 40),
    };
};

export const normalizeRollHistory = value => {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.flatMap((entry, index) => {
        const legacySequence = integerInRange(entry?.sequence, 1, MAX_SAFE_GAME_INTEGER, index + 1);
        const fallbackId = `legacy-roll-${legacySequence}-${index}`;
        const normalized = normalizeRollRecord(entry, fallbackId);
        if (!normalized || seen.has(normalized.id)) return [];
        seen.add(normalized.id);
        return [normalized];
    }).slice(0, MAX_ROLL_HISTORY);
};

export const createRollRecord = (entry, {
    id = secureRandomId("roll"),
    sequence = 1,
    createdAt = Date.now(),
} = {}) => normalizeRollRecord({ ...entry, id, sequence, createdAt }, id);

export const prependRollHistory = (history, entry, options = {}) => {
    const current = normalizeRollHistory(history);
    const highestSequence = current.reduce((highest, record) => Math.max(highest, record.sequence), 0);
    const record = createRollRecord(entry, {
        ...options,
        sequence: options.sequence ?? highestSequence + 1,
    });
    if (!record) return current;
    if (current.some(candidate => candidate.id === record.id)) return current;
    return [record, ...current].slice(0, MAX_ROLL_HISTORY);
};
