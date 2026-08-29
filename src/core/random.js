const UINT32_RANGE = 0x100000000;
const UINT32_MAXIMUM = UINT32_RANGE - 1;
const UNIT53_RANGE = 0x20000000000000;
const DEFAULT_POOL_SIZE = 64;
const MAX_REJECTION_ATTEMPTS = 128;

export class SecureRandomError extends Error {
    constructor(message = "Este aparelho não ofereceu uma fonte segura de aleatoriedade. Nenhum resultado foi gerado.", options) {
        super(message, options);
        this.name = "SecureRandomError";
    }
}

const normalizeMaximum = maximum => {
    const value = Math.floor(Number(maximum));
    if (!Number.isSafeInteger(value) || value < 1 || value > UINT32_RANGE) {
        throw new RangeError("O intervalo aleatório precisa estar entre 1 e 2³².");
    }
    return value;
};

const normalizeUint32 = value => {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 0 || normalized > UINT32_MAXIMUM) {
        throw new RangeError("A fonte aleatória precisa entregar inteiros de 32 bits sem sinal.");
    }
    return normalized;
};

const normalizeUnit = value => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized < 0 || normalized >= 1) {
        throw new RangeError("A fonte aleatória de teste precisa entregar valores entre 0 (inclusive) e 1 (exclusivo).");
    }
    return normalized;
};

/*
 * A small pool amortizes Web Crypto calls without caching meaningful amounts
 * of entropy. The browser/runtime CSPRNG remains the sole production source.
 */
export const createSecureUint32Source = (cryptoSource, poolSize = DEFAULT_POOL_SIZE) => {
    const normalizedPoolSize = Math.floor(Number(poolSize));
    if (!Number.isSafeInteger(normalizedPoolSize) || normalizedPoolSize < 1 || normalizedPoolSize > 16384) {
        throw new RangeError("O lote de aleatoriedade precisa ter entre 1 e 16.384 valores.");
    }
    let pool = new Uint32Array(0);
    let index = 0;

    return () => {
        const source = cryptoSource === undefined ? globalThis.crypto : cryptoSource;
        if (!source || typeof source.getRandomValues !== "function") {
            throw new SecureRandomError();
        }
        if (index >= pool.length) {
            pool = new Uint32Array(normalizedPoolSize);
            try {
                source.getRandomValues(pool);
            } catch (cause) {
                throw new SecureRandomError("A fonte segura de aleatoriedade ficou indisponível. Nenhum resultado foi gerado.", { cause });
            }
            index = 0;
        }
        return pool[index++];
    };
};

const nextSecureUint32 = createSecureUint32Source();

/*
 * Rejection sampling removes modulo bias whenever 2³² is not divisible by
 * the number of outcomes. A bounded retry guard rejects broken injected
 * sources instead of hanging or silently changing the distribution.
 */
export const randomIntFromUint32 = (maximum, nextUint32) => {
    const normalizedMaximum = normalizeMaximum(maximum);
    if (typeof nextUint32 !== "function") throw new TypeError("Informe uma fonte de inteiros aleatórios.");
    const acceptanceLimit = Math.floor(UINT32_RANGE / normalizedMaximum) * normalizedMaximum;
    for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt += 1) {
        const value = normalizeUint32(nextUint32());
        if (value < acceptanceLimit) return value % normalizedMaximum;
    }
    throw new SecureRandomError("A fonte de aleatoriedade não produziu um valor válido. Nenhum resultado foi gerado.");
};

export const randomUnitFromUint32 = nextUint32 => {
    if (typeof nextUint32 !== "function") throw new TypeError("Informe uma fonte de inteiros aleatórios.");
    const high = normalizeUint32(nextUint32()) >>> 5;
    const low = normalizeUint32(nextUint32()) >>> 6;
    return (high * 0x4000000 + low) / UNIT53_RANGE;
};

export const randomUnit = random => {
    if (typeof random === "function") return normalizeUnit(random());
    return randomUnitFromUint32(nextSecureUint32);
};

export const randomInt = (maximum, random) => {
    const normalizedMaximum = normalizeMaximum(maximum);
    if (typeof random === "function") {
        return Math.floor(normalizeUnit(random()) * normalizedMaximum);
    }
    return randomIntFromUint32(normalizedMaximum, nextSecureUint32);
};

export const secureRandomInt = (minimum, maximum, random) => {
    const normalizedMinimum = Math.floor(Number(minimum));
    const normalizedMaximum = Math.floor(Number(maximum));
    if (!Number.isSafeInteger(normalizedMinimum) || !Number.isSafeInteger(normalizedMaximum) || normalizedMaximum < normalizedMinimum) {
        throw new RangeError("O intervalo aleatório inclusivo não é válido.");
    }
    const outcomes = normalizedMaximum - normalizedMinimum + 1;
    if (!Number.isSafeInteger(outcomes) || outcomes < 1 || outcomes > UINT32_RANGE) {
        throw new RangeError("O intervalo aleatório inclusivo precisa ter entre 1 e 2³² resultados.");
    }
    return normalizedMinimum + randomInt(outcomes, random);
};

export const randomChance = (successfulOutcomes, possibleOutcomes, random) => {
    const possible = normalizeMaximum(possibleOutcomes);
    const successful = Math.floor(Number(successfulOutcomes));
    if (!Number.isSafeInteger(successful) || successful < 0 || successful > possible) {
        throw new RangeError("A chance precisa estar entre zero e o total de resultados possíveis.");
    }
    if (successful === 0) return false;
    if (successful === possible) return true;
    return randomInt(possible, random) < successful;
};

export const rollDie = (sides, random) => secureRandomInt(1, normalizeMaximum(sides), random);

export const rollD6 = random => rollDie(6, random);

export const rollD100 = random => rollDie(100, random);

export const roll2D6 = random => {
    const dieA = rollD6(random);
    const dieB = rollD6(random);
    return { dice: [dieA, dieB], dieA, dieB, total: dieA + dieB };
};

export const randomChoice = (values, random) => {
    if (!Array.isArray(values) || !values.length) return undefined;
    return values[randomInt(values.length, random)];
};

export const secureRandomString = (length, alphabet, random) => {
    const normalizedLength = Math.floor(Number(length));
    const symbols = [...String(alphabet || "")];
    if (!Number.isSafeInteger(normalizedLength) || normalizedLength < 0 || normalizedLength > 4096) {
        throw new RangeError("O identificador aleatório precisa ter entre 0 e 4.096 caracteres.");
    }
    if (!symbols.length || symbols.length > UINT32_RANGE) {
        throw new RangeError("O alfabeto do identificador aleatório não é válido.");
    }
    return Array.from({ length: normalizedLength }, () => randomChoice(symbols, random)).join("");
};

export const secureRandomId = (prefix = "id") => {
    const words = Array.from({ length: 4 }, () => nextSecureUint32());
    const bytes = new Uint8Array(16);
    words.forEach((word, wordIndex) => {
        const offset = wordIndex * 4;
        bytes[offset] = word >>> 24;
        bytes[offset + 1] = word >>> 16;
        bytes[offset + 2] = word >>> 8;
        bytes[offset + 3] = word;
    });
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, "0"));
    const uuid = `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    const normalizedPrefix = String(prefix || "").trim();
    return normalizedPrefix ? `${normalizedPrefix}-${uuid}` : uuid;
};
