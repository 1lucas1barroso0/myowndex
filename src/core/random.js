const UINT32_RANGE = 0x100000000;

const normalizeMaximum = maximum => {
    const value = Math.floor(Number(maximum));
    if (!Number.isSafeInteger(value) || value < 1 || value > UINT32_RANGE) {
        throw new RangeError("O intervalo aleatório precisa estar entre 1 e 2³².");
    }
    return value;
};

const nextSecureUint32 = () => {
    if (!globalThis.crypto?.getRandomValues) return null;
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
};

export const randomUnit = random => {
    if (typeof random === "function") {
        const value = Number(random());
        if (!Number.isFinite(value)) return 0;
        return Math.min(1 - Number.EPSILON, Math.max(0, value));
    }
    const secureValue = nextSecureUint32();
    return secureValue == null ? Math.random() : secureValue / UINT32_RANGE;
};

/*
 * Rejection sampling prevents the tiny modulo bias that appears when 2³² is
 * not divisible by the number of possible results (notably d6 and d100).
 */
export const randomIntFromUint32 = (maximum, nextUint32) => {
    const normalizedMaximum = normalizeMaximum(maximum);
    const acceptanceLimit = Math.floor(UINT32_RANGE / normalizedMaximum) * normalizedMaximum;
    let value;
    do {
        value = Number(nextUint32()) >>> 0;
    } while (value >= acceptanceLimit);
    return value % normalizedMaximum;
};

export const randomInt = (maximum, random) => {
    const normalizedMaximum = normalizeMaximum(maximum);
    if (typeof random === "function") {
        return Math.floor(randomUnit(random) * normalizedMaximum);
    }
    if (globalThis.crypto?.getRandomValues) {
        return randomIntFromUint32(normalizedMaximum, nextSecureUint32);
    }
    return Math.floor(Math.random() * normalizedMaximum);
};

export const rollDie = (sides, random) => randomInt(sides, random) + 1;

export const randomChoice = (values, random) => {
    if (!Array.isArray(values) || !values.length) return undefined;
    return values[randomInt(values.length, random)];
};
