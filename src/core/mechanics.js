export const apiCache = new Map();

export const fetchCached = async (url) => {
    if (!url) return null;
    if (apiCache.has(url)) return apiCache.get(url);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        apiCache.set(url, data);
        return data;
    } catch { return null; }
};

export const convertToTTRPG = (value, isHp = false) => {
    if (!value) return isHp ? 1 : 0;
    const result = value / 20;
    const fraction = Math.round((result % 1) * 100) / 100; 
    const finalValue = fraction >= 0.56 ? Math.ceil(result) : Math.floor(result);
    return (isHp && finalValue === 0) ? 1 : finalValue;
};

export const calculateStat = (base, ev, iv, level, natureMulti, isHp, speciesName) => {
    if (isHp && speciesName?.toLowerCase() === 'shedinja') return 1; 
    const b = parseInt(base) || 1, e = parseInt(ev) || 0, i = parseInt(iv) || 0, l = parseInt(level) || 1;
    if (isHp) return Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + l + 10;
    return Math.floor((Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + 5) * natureMulti);
};

export const formatName = (str) => str ? str.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
export const extractId = (url) => url ? url.split('/').filter(Boolean).pop() : '0';

export const STAT_MAP = { 'hp': 'HP', 'attack': 'Atk', 'defense': 'Def', 'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', 'speed': 'Spe' };
export const NATURES = { hardy: {up: null, down: null}, lonely: {up: 'attack', down: 'defense'}, brave: {up: 'attack', down: 'speed'}, adamant: {up: 'attack', down: 'special-attack'}, naughty: {up: 'attack', down: 'special-defense'}, bold: {up: 'defense', down: 'attack'}, docile: {up: null, down: null}, relaxed: {up: 'defense', down: 'speed'}, impish: {up: 'defense', down: 'special-attack'}, lax: {up: 'defense', down: 'special-defense'}, timid: {up: 'speed', down: 'attack'}, hasty: {up: 'speed', down: 'defense'}, serious: {up: null, down: null}, jolly: {up: 'speed', down: 'special-attack'}, naive: {up: 'speed', down: 'special-defense'}, modest: {up: 'special-attack', down: 'attack'}, mild: {up: 'special-attack', down: 'defense'}, quiet: {up: 'special-attack', down: 'speed'}, bashful: {up: null, down: null}, rash: {up: 'special-attack', down: 'special-defense'}, calm: {up: 'special-defense', down: 'attack'}, gentle: {up: 'special-defense', down: 'defense'}, sassy: {up: 'special-defense', down: 'speed'}, careful: {up: 'special-defense', down: 'special-attack'}, quirky: {up: null, down: null} };
export const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy', 'stellar'];
export const TYPE_COLORS = { normal: '#9ca3af', fire: '#f97316', water: '#3b82f6', electric: '#eab308', grass: '#22c55e', ice: '#67e8f9', fighting: '#ef4444', poison: '#a855f7', ground: '#d97706', flying: '#818cf8', psychic: '#ec4899', bug: '#84cc16', rock: '#b45309', ghost: '#6366f1', dragon: '#6366f1', dark: '#334155', steel: '#94a3b8', fairy: '#f472b6', stellar: '#14b8a6' };
export const MATCHUPS = { normal: {fighting: 2, ghost: 0}, fire: {fire: 0.5, water: 2, grass: 0.5, ice: 0.5, ground: 2, bug: 0.5, rock: 2, steel: 0.5, fairy: 0.5}, water: {fire: 0.5, water: 0.5, electric: 2, grass: 2, ice: 0.5, steel: 0.5}, electric: {electric: 0.5, ground: 2, flying: 0.5, steel: 0.5}, grass: {fire: 2, water: 0.5, grass: 0.5, electric: 0.5, ice: 2, poison: 2, ground: 0.5, flying: 2, bug: 2}, ice: {fire: 2, ice: 0.5, fighting: 2, rock: 2, steel: 2}, fighting: {flying: 2, psychic: 2, bug: 0.5, rock: 0.5, dark: 0.5, fairy: 2}, poison: {grass: 0.5, fighting: 0.5, poison: 0.5, ground: 2, psychic: 2, bug: 0.5, fairy: 0.5}, ground: {water: 2, electric: 0, grass: 2, ice: 2, poison: 0.5, rock: 0.5}, flying: {electric: 2, grass: 0.5, ice: 2, fighting: 0.5, ground: 0, bug: 0.5, rock: 2}, psychic: {fighting: 0.5, psychic: 0.5, bug: 2, ghost: 2, dark: 2}, bug: {fire: 2, grass: 0.5, fighting: 0.5, ground: 0.5, flying: 2, rock: 2}, rock: {normal: 0.5, fire: 0.5, water: 2, grass: 2, poison: 0.5, ground: 2, flying: 0.5, fighting: 2, steel: 2}, ghost: {normal: 0, fighting: 0, poison: 0.5, bug: 0.5, ghost: 2, dark: 2}, dragon: {fire: 0.5, water: 0.5, electric: 0.5, grass: 0.5, ice: 2, dragon: 2, fairy: 2}, dark: {fighting: 2, psychic: 0, bug: 2, ghost: 0.5, dark: 0.5, fairy: 2}, steel: {normal: 0.5, fire: 2, water: 1, electric: 1, grass: 0.5, ice: 0.5, fighting: 2, poison: 0, ground: 2, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, ghost: 1, dragon: 0.5, dark: 1, steel: 0.5, fairy: 0.5}, fairy: {fighting: 0.5, poison: 2, bug: 0.5, dragon: 0, dark: 0.5, steel: 2} };

export const calculateDefenses = (typesArr) => {
    if (!typesArr) return {};
    const defs = {}; TYPES.forEach(t => defs[t] = 1);
    typesArr.forEach(tObj => {
        const tName = tObj?.type?.name;
        if (!tName) return;
        Object.keys(MATCHUPS).forEach(atkType => {
            if (MATCHUPS[atkType] && MATCHUPS[atkType][tName] !== undefined) defs[atkType] *= MATCHUPS[atkType][tName];
        });
    });
    return defs;
};
