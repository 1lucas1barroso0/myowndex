export const MAX_SAFE_GAME_INTEGER = Number.MAX_SAFE_INTEGER;

const finiteFallback = fallback => {
    if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
    if (typeof fallback === "string" && fallback.trim()) {
        const parsed = Number(fallback);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

/**
 * Converts only an actual number or a non-empty numeric string. This keeps
 * null, booleans, arrays and empty fields from silently becoming zero.
 */
export const finiteNumber = (value, fallback = 0) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : finiteFallback(fallback);
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return finiteFallback(fallback);
};

export const finiteNumberOrNull = value => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

export const clampFinite = (value, minimum, maximum, fallback = minimum) => {
    const firstBound = finiteNumber(minimum, 0);
    const secondBound = finiteNumber(maximum, firstBound);
    const lower = Math.min(firstBound, secondBound);
    const upper = Math.max(firstBound, secondBound);
    const normalizedFallback = Math.min(upper, Math.max(lower, finiteNumber(fallback, lower)));
    return Math.min(upper, Math.max(lower, finiteNumber(value, normalizedFallback)));
};

export const floorInteger = (value, fallback = 0) => {
    const normalized = finiteNumber(value, fallback);
    const floored = Math.floor(normalized);
    if (!Number.isSafeInteger(floored)) {
        return floored < 0 ? -MAX_SAFE_GAME_INTEGER : MAX_SAFE_GAME_INTEGER;
    }
    return Object.is(floored, -0) ? 0 : floored;
};

export const integerInRange = (value, minimum, maximum, fallback = minimum) => {
    const lower = floorInteger(minimum, 0);
    const upper = floorInteger(maximum, lower);
    const safeMinimum = Math.min(lower, upper);
    const safeMaximum = Math.max(lower, upper);
    return Math.min(
        safeMaximum,
        Math.max(safeMinimum, floorInteger(value, clampFinite(fallback, safeMinimum, safeMaximum, safeMinimum))),
    );
};

export const quantizeStepDown = (value, step = 1, {
    minimum = 0,
    maximum = MAX_SAFE_GAME_INTEGER,
    fallback = minimum,
} = {}) => {
    const normalizedStep = clampFinite(step, Number.EPSILON, MAX_SAFE_GAME_INTEGER, 1);
    const bounded = clampFinite(value, minimum, maximum, fallback);
    const steps = Math.floor((bounded - minimum + Number.EPSILON * 16) / normalizedStep);
    return clampFinite(minimum + steps * normalizedStep, minimum, maximum, fallback);
};

export const safeDivide = (dividend, divisor, fallback = 0) => {
    const numerator = finiteNumber(dividend, fallback);
    const denominator = finiteNumber(divisor, 0);
    if (denominator === 0) return finiteNumber(fallback, 0);
    const result = numerator / denominator;
    return Number.isFinite(result) ? result : finiteNumber(fallback, 0);
};

export const finiteProduct = (values, {
    minimum = -MAX_SAFE_GAME_INTEGER,
    maximum = MAX_SAFE_GAME_INTEGER,
    fallback = 0,
} = {}) => {
    const factors = Array.isArray(values) ? values : [];
    let result = 1;
    for (const factor of factors) {
        result *= finiteNumber(factor, fallback);
        if (!Number.isFinite(result)) {
            result = result < 0 ? minimum : maximum;
            break;
        }
    }
    return clampFinite(result, minimum, maximum, fallback);
};

/**
 * MyOwnDex's explicit tabletop rounding rule: fractional parts up to 0.55 go
 * down; from 0.56 onward they go up. Values in the unspecified gap keep the
 * global fallback and go down.
 */
export const roundRpgScaledValue = (value, { minimumWhenPositive = 0, maximum = MAX_SAFE_GAME_INTEGER } = {}) => {
    const normalized = clampFinite(value, 0, maximum, 0);
    if (normalized <= 0) return 0;
    const whole = Math.floor(normalized);
    const fraction = normalized - whole;
    const rounded = fraction + Number.EPSILON * 16 >= 0.56 ? Math.ceil(normalized) : whole;
    return Math.min(maximum, Math.max(minimumWhenPositive, rounded));
};

/** A real HP change uses floor by default and never disappears below 1 HP. */
export const quantizePositiveHpChange = (value, maximum = MAX_SAFE_GAME_INTEGER) => {
    const normalized = clampFinite(value, 0, maximum, 0);
    if (normalized <= 0) return 0;
    return Math.min(maximum, Math.max(1, Math.floor(normalized)));
};

/**
 * Directional integer modifiers preserve a legitimate buff or nerf at small
 * scales without inventing a universal minimum for unrelated calculations.
 */
export const applyDirectionalIntegerModifier = (baseValue, multiplier, {
    minimum = 0,
    maximum = MAX_SAFE_GAME_INTEGER,
} = {}) => {
    const base = clampFinite(baseValue, minimum, maximum, minimum);
    const factor = clampFinite(multiplier, 0, maximum, 1);
    const raw = finiteProduct([base, factor], { minimum, maximum, fallback: base });
    const rounded = factor > 1 ? Math.ceil(raw) : Math.floor(raw);
    let result = clampFinite(rounded, minimum, maximum, base);
    if (factor > 1 && base > minimum && base < maximum && result <= base) result = Math.min(maximum, Math.floor(base) + 1);
    if (factor < 1 && base > minimum && result >= base) result = Math.max(minimum, Math.ceil(base) - 1);
    return floorInteger(result, base);
};
