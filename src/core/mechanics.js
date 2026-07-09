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
    if (isHp && speciesName?.toLowerCase() === "shedinja") return 1; 
    const b = parseInt(base) || 1, e = parseInt(ev) || 0, i = parseInt(iv) || 0, l = parseInt(level) || 1;
    if (isHp) return Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + l + 10;
    return Math.floor((Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + 5) * natureMulti);
};

export const formatName = (str) => str ? str.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "Unknown";
export const extractId = (url) => url ? url.split("/").filter(Boolean).pop() : "0";

// Cronologia oficial de lançamentos para filtragem de integridade de dados
export const VERSION_PRIORITY = [
    "champion-stadium",
    "legends-arceus",
    "scarlet-violet",
    "brilliant-diamond-shining-pearl",
    "sword-shield",
    "ultra-sun-ultra-moon",
    "sun-moon",
    "x-y",
    "omega-ruby-alpha-sapphire",
    "black-2-white-2",
    "black-white",
    "heartgold-soulsilver",
    "diamond-pearl",
    "platinum",
    "ruby-sapphire",
    "emerald",
    "firered-leafgreen",
    "gold-silver",
    "crystal",
    "red-blue",
    "yellow"
];

// O Novo Algoritmo Híbrido: Filtra a versão mais recente e organiza por hierarquia de aprendizado
export const filterMovesByLatestVersion = (moves) => {
    if (!moves || !moves.length) return [];
    
    let bestVersion = null;
    for (const v of VERSION_PRIORITY) {
        const hasVersion = moves.some(m => m.version_group_details?.some(d => d.version_group?.name === v));
        if (hasVersion) {
            bestVersion = v;
            break;
        }
    }
    
    if (!bestVersion && moves[0]?.version_group_details?.length) {
        const lastIdx = moves[0].version_group_details.length - 1;
        bestVersion = moves[0].version_group_details[lastIdx].version_group?.name;
    }
    
    const processed = moves.map(m => {
        const detail = m.version_group_details?.find(d => d.version_group?.name === bestVersion) || m.version_group_details?.[m.version_group_details.length - 1];
        return {
            move: m.move,
            latest_detail: detail
        };
    }).filter(m => m.latest_detail);

    return processed.sort((a, b) => {
        const getSortData = (detail) => {
            let bestMethod = 4;
            let bestLevel = 999;
            if (!detail) return { method: 4, level: 999 };
            const mName = detail.move_learn_method?.name;
            const lvl = detail.level_learned_at || 0;
            if (mName === "level-up") { bestMethod = 1; if (lvl > 0) bestLevel = lvl; }
            else if (mName === "machine") bestMethod = 2;
            else if (mName === "egg") bestMethod = 3;
            return { method: bestMethod, level: bestLevel === 999 ? 0 : bestLevel };
        };

        const aData = getSortData(a.latest_detail);
        const bData = getSortData(b.latest_detail);

        if (aData.method !== bData.method) return aData.method - bData.method;
        if (aData.method === 1) return aData.level - bData.level;
        return (a.move?.name || "").localeCompare(b.move?.name || "");
    });
};

// ==========================================
// NOVO SISTEMA DE COMPARTILHAMENTO DE EQUIPES (Ultra-leve)
// ==========================================
export const TEAM_EXPORT_PREFIX = "MYOWNDEX-V3-";

export const encodeTeamShare = (teamPayload) => {
    try {
        const jsonStr = JSON.stringify(teamPayload);
        const b64 = btoa(encodeURIComponent(jsonStr));
        return TEAM_EXPORT_PREFIX + b64;
    } catch {
        return "";
    }
};

export const decodeTeamShare = (value) => {
    const raw = value?.trim();
    if (!raw) throw new Error("Payload vazio");
    
    let cleanCode = raw;
    if (cleanCode.startsWith(TEAM_EXPORT_PREFIX)) {
        cleanCode = cleanCode.substring(TEAM_EXPORT_PREFIX.length);
    }
    
    try {
        const jsonStr = decodeURIComponent(atob(cleanCode));
        return JSON.parse(jsonStr);
    } catch {
        throw new Error("Formato de link inválido ou corrompido");
    }
};

// ==========================================
// DADOS CONSTANTES E MATEMÁTICA DE COMBATE
// ==========================================
export const STAT_MAP = { "hp": "HP", "attack": "Atk", "defense": "Def", "special-attack": "Sp. Atk", "special-defense": "Sp. Def", "speed": "Spe" };
export const NATURES = { hardy: {up: null, down: null}, lonely: {up: "attack", down: "defense"}, brave: {up: "attack", down: "speed"}, adamant: {up: "attack", down: "special-attack"}, naughty: {up: "attack", down: "special-defense"}, bold: {up: "defense", down: "attack"}, docile: {up: null, down: null}, relaxed: {up: "defense", down: "speed"}, impish: {up: "defense", down: "special-attack"}, lax: {up: "defense", down: "special-defense"}, timid: {up: "speed", down: "attack"}, hasty: {up: "speed", down: "defense"}, serious: {up: null, down: null}, jolly: {up: "speed", down: "special-attack"}, naive: {up: "speed", down: "special-defense"}, modest: {up: "special-attack", down: "attack"}, mild: {up: "special-attack", down: "defense"}, quiet: {up: "special-attack", down: "speed"}, bashful: {up: null, down: null}, rash: {up: "special-attack", down: "special-defense"}, calm: {up: "special-defense", down: "attack"}, gentle: {up: "special-defense", down: "defense"}, sassy: {up: "special-defense", down: "speed"}, careful: {up: "special-defense", down: "special-attack"}, quirky: {up: null, down: null} };
export const TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy", "stellar"];
export const TYPE_COLORS = { normal: "#9ca3af", fire: "#f97316", water: "#3b82f6", electric: "#eab308", grass: "#22c55e", ice: "#67e8f9", fighting: "#ef4444", poison: "#a855f7", ground: "#d97706", flying: "#818cf8", psychic: "#ec4899", bug: "#84cc16", rock: "#b45309", ghost: "#6366f1", dragon: "#6366f1", dark: "#334155", steel: "#94a3b8", fairy: "#f472b6", stellar: "#14b8a6" };

// Tabela Oficial Gen 6+ (Mapeamento: Tipo do Defensor -> { Tipo do Atacante: Multiplicador })
export const MATCHUPS = { 
    normal: { fighting: 2, ghost: 0 }, 
    fire: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5, fairy: 0.5 }, 
    water: { electric: 2, grass: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 }, 
    electric: { ground: 2, electric: 0.5, flying: 0.5, steel: 0.5 }, 
    grass: { fire: 2, ice: 2, poison: 2, flying: 2, bug: 2, water: 0.5, electric: 0.5, grass: 0.5, ground: 0.5 }, 
    ice: { fire: 2, fighting: 2, rock: 2, steel: 2, ice: 0.5 }, 
    fighting: { flying: 2, psychic: 2, fairy: 2, bug: 0.5, rock: 0.5, dark: 0.5 }, 
    poison: { ground: 2, psychic: 2, grass: 0.5, fighting: 0.5, poison: 0.5, bug: 0.5, fairy: 0.5 }, 
    ground: { water: 2, grass: 2, ice: 2, poison: 0.5, rock: 0.5, electric: 0 }, 
    flying: { electric: 2, ice: 2, rock: 2, grass: 0.5, fighting: 0.5, bug: 0.5, ground: 0 }, 
    psychic: { bug: 2, ghost: 2, dark: 2, fighting: 0.5, psychic: 0.5 }, 
    bug: { fire: 2, flying: 2, rock: 2, grass: 0.5, fighting: 0.5, ground: 0.5 }, 
    rock: { water: 2, grass: 2, fighting: 2, ground: 2, steel: 2, normal: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 }, 
    ghost: { ghost: 2, dark: 2, poison: 0.5, bug: 0.5, normal: 0, fighting: 0 }, 
    dragon: { ice: 2, dragon: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, grass: 0.5 }, 
    dark: { fighting: 2, bug: 2, fairy: 2, ghost: 0.5, dark: 0.5, psychic: 0 }, 
    steel: { fire: 2, fighting: 2, ground: 2, normal: 0.5, grass: 0.5, ice: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, dragon: 0.5, steel: 0.5, fairy: 0.5, poison: 0 }, 
    fairy: { poison: 2, steel: 2, fighting: 0.5, bug: 0.5, dark: 0.5, dragon: 0 } 
};

// Loop Matemático Corrigido
export const calculateDefenses = (typesArr) => {
    if (!typesArr) return {};
    const defs = {}; 
    TYPES.forEach(t => defs[t] = 1);
    
    typesArr.forEach(tObj => {
        const tName = tObj?.type?.name; // tName é o tipo do Defensor
        if (tName && MATCHUPS[tName]) {
            // Varre todos os atacantes que afetam este defensor e multiplica as fraquezas/resistências
            Object.keys(MATCHUPS[tName]).forEach(atkType => {
                defs[atkType] *= MATCHUPS[tName][atkType];
            });
        }
    });
    return defs;
};
