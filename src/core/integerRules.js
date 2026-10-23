import { integerInRange, MAX_SAFE_GAME_INTEGER, MAX_BATTLE_HP } from "./math.js";
import { randomInt } from "./random.js";

/** All persisted HP and all returned changes are integers. A remainder is a
 * chance of one point, never fractional HP or a hidden second HP balance. */
export const rollIntegerRatio = (numerator, denominator, random) => {
    if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator < 1 || denominator > 0x100000000) {
        throw new RangeError("Use uma razão de inteiros positivos para o efeito de HP.");
    }
    const whole = Math.floor(numerator / denominator);
    const remainder = numerator % denominator;
    return whole + (remainder && randomInt(denominator, random) < remainder ? 1 : 0);
};

// Adapter for existing canonical modifiers. No fractional HP enters state.
export const rollIntegerHpEffect = (amount, random) => {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const bounded = Math.min(MAX_SAFE_GAME_INTEGER, amount);
    const whole = Math.floor(bounded);
    const fraction = bounded - whole;
    if (!fraction) return whole;
    // Recover canonical integer ratios (halves, sixteenths, Big Root, etc.)
    // instead of turning 1/6 into a rounded decimal probability.
    const denominators = [2,3,4,5,6,8,10,12,16,20,24,25,30,32,40,48,50,60,64,80,100,120,128,160,200,240,256,320,400,480,640,800,1000,10000,1000000];
    const denominator = denominators.find(divisor => Math.abs(fraction * divisor - Math.round(fraction * divisor)) <= Number.EPSILON * 32 * Math.max(1, bounded) * divisor) || 1000000;
    const remainder = Math.round(fraction * denominator);
    return Math.min(MAX_SAFE_GAME_INTEGER, whole + rollIntegerRatio(remainder, denominator, random));
};

/** 1 on d6: lower; 2–5: base; 6: higher. One HP is the indivisible floor.
 * The ordinary damage ceiling is applied by the caller after this roll. */
export const rollDamageVariation = (damage, random) => {
    const base = integerInRange(damage, 0, MAX_SAFE_GAME_INTEGER, 0);
    if (base <= 1) return { base, die: null, step: 0, damage: base };
    const die = randomInt(6, random) + 1;
    const step = Math.max(1, Math.floor(base / 10));
    return { base, die, step, damage: Math.min(MAX_SAFE_GAME_INTEGER, base + (die === 1 ? -step : die === 6 ? step : 0)) };
};

export const getBaseMaxHp = token => ["dyna", "gmax"].includes(token?.gimmickState?.active)
    ? integerInRange(token.gimmickState.base?.maxHp, 1, 99999, token.maxHp)
    : integerInRange(token?.maxHp, 1, MAX_BATTLE_HP, 1);

export const resolveExperienceProgress = ({ level, xp, levelCap = 100 }) => {
    let nextLevel = integerInRange(level, 1, 200, 1);
    let remainingXp = integerInRange(xp, 0, MAX_SAFE_GAME_INTEGER, 0);
    const cap = integerInRange(levelCap, 1, 200, 100);
    while (nextLevel < cap) {
        const required = Math.floor((nextLevel + 1) / 2);
        if (remainingXp < required) break;
        remainingXp -= required;
        nextLevel += 1;
    }
    return { level: nextLevel, xp: remainingXp };
};

export const getBaseCurrentHp = token => Math.ceil(integerInRange(token?.currentHp, 0, MAX_BATTLE_HP, 0) * getBaseMaxHp(token) / integerInRange(token?.maxHp, 1, MAX_BATTLE_HP, 1));

/** Show canonical factors as operations with integers, such as 3/2. */
export const formatGameFactor = factor => {
    if (!Number.isFinite(factor)) return "—";
    if (Number.isInteger(factor)) return String(factor);
    const denominator = [2,3,4,5,6,8,10,12,16,20,24,25,32,40,50,64,100,160,1000,1000000]
        .find(value=>Math.abs(factor*value-Math.round(factor*value))<=Number.EPSILON*32*Math.max(1,Math.abs(factor))*value) || 1000000;
    const numerator = Math.round(factor*denominator);
    const gcd=(a,b)=>b?gcd(b,a%b):a;
    const divisor=gcd(Math.abs(numerator),denominator);
    return `${numerator/divisor}/${denominator/divisor}`;
};

// Keep stored/source catalogues intact; render decimal percentages and factors
// as exact operations with integers in either reference language.
export const formatIntegerGameText = (value, { decimalComma = true } = {}) => {
    const ratio = (whole, digits, percent = false) => {
        const numerator = Number(whole + digits);
        const denominator = 10 ** digits.length * (percent ? 100 : 1);
        const gcd = (a, b) => b ? gcd(b, a % b) : a;
        const common = gcd(numerator, denominator);
        return `${numerator / common}/${denominator / common}`;
    };
    const percentages = decimalComma ? /\b(\d{1,7})[.,](\d{1,6})\s*%/g : /\b(\d{1,7})\.(\d{1,6})\s*%/g;
    const factors = decimalComma ? /\b(\d{1,7})[.,](\d{1,6})\s*([×x])/g : /\b(\d{1,7})\.(\d{1,6})\s*([×x])/g;
    const decimals = decimalComma
        ? /(?<![\w#.,/])(\d{1,7}),(\d{1,6})(?!\d|[.,/]\d)/g
        : /(?<![\w#.,/])(\d{1,7})\.(\d{1,6})(?!\d|[.,/]\d)/g;
    return String(value || '')
        .replace(percentages, (_, whole, digits) => ratio(whole, digits, true))
        .replace(factors, (_, whole, digits, symbol) => `${ratio(whole, digits)}${symbol}`)
        .replace(decimals, (_, whole, digits) => ratio(whole, digits));
};
