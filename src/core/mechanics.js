export const apiCache = new Map();

const apiRequests = new Map();
const API_CACHE_NAME = "myowndex-api-v4";
const DEFAULT_CACHE_AGE = 6 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT = 12000;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const canUseCacheStorage = () => typeof window !== "undefined" && typeof window.caches !== "undefined";

const readPersistentApiCache = async (url) => {
    if (!canUseCacheStorage()) return null;
    try {
        const response = await (await window.caches.open(API_CACHE_NAME)).match(url);
        if (!response) return null;
        return {
            data: await response.json(),
            cachedAt: Number(response.headers.get("x-myowndex-cached-at")) || 0
        };
    } catch {
        return null;
    }
};

const writePersistentApiCache = async (url, data) => {
    if (!canUseCacheStorage() || data == null) return;
    try {
        const cache = await window.caches.open(API_CACHE_NAME);
        await cache.put(url, new Response(JSON.stringify(data), {
            headers: {
                "content-type": "application/json; charset=utf-8",
                "x-myowndex-cached-at": String(Date.now())
            }
        }));
    } catch {
        // Cache Storage is optional and must never interrupt the app.
    }
};

const fetchJson = async (url, timeoutMs) => {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: "application/json" }
            });
            if (!response.ok) {
                const error = new Error(`API ${response.status}`);
                error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
                throw error;
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            const retryable = error?.name === "AbortError" || error?.retryable || error instanceof TypeError;
            if (!retryable || attempt === 1) break;
            await wait(250);
        } finally {
            clearTimeout(timeout);
        }
    }
    throw lastError || new Error("API unavailable");
};

export const fetchCached = async (url, options = {}) => {
    if (!url) return null;
    const {
        maxAgeMs = DEFAULT_CACHE_AGE,
        timeoutMs = DEFAULT_TIMEOUT,
        forceRefresh = false
    } = options;
    const key = String(url);
    const now = Date.now();
    const memory = apiCache.get(key);
    if (!forceRefresh && memory && now - memory.cachedAt <= maxAgeMs) return memory.data;
    if (apiRequests.has(key)) return apiRequests.get(key);

    const request = (async () => {
        const persisted = await readPersistentApiCache(key);
        const stale = memory || persisted;
        if (!forceRefresh && persisted && now - persisted.cachedAt <= maxAgeMs) {
            apiCache.set(key, persisted);
            return persisted.data;
        }
        try {
            const data = await fetchJson(key, timeoutMs);
            const entry = { data, cachedAt: Date.now() };
            apiCache.set(key, entry);
            void writePersistentApiCache(key, data);
            return data;
        } catch {
            if (stale?.data != null) {
                apiCache.set(key, stale);
                return stale.data;
            }
            return null;
        }
    })();

    apiRequests.set(key, request);
    try {
        return await request;
    } finally {
        apiRequests.delete(key);
    }
};

export const clearApiCache = async () => {
    apiCache.clear();
    apiRequests.clear();
    if (!canUseCacheStorage()) return;
    try {
        await window.caches.delete(API_CACHE_NAME);
    } catch {
        // Cache deletion is best effort.
    }
};

export const convertToTTRPG = (value, isHp = false) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return isHp ? 1 : 0;
    const result = numericValue / 20;
    const whole = Math.floor(result);
    const fractionHundredths = Math.round((result - whole) * 100);
    const finalValue = fractionHundredths >= 56 ? Math.ceil(result) : whole;
    return isHp && finalValue === 0 ? 1 : finalValue;
};

export const calculateStat = (base, ev, iv, level, natureMulti, isHp, speciesName) => {
    if (isHp && speciesName?.toLowerCase() === "shedinja") return 1;
    const b = Math.max(1, Number.parseInt(base, 10) || 1);
    const e = Math.max(0, Number.parseInt(ev, 10) || 0);
    const i = Math.max(0, Number.parseInt(iv, 10) || 0);
    const l = Math.max(1, Number.parseInt(level, 10) || 1);
    if (isHp) return Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + l + 10;
    return Math.floor((Math.floor(((2 * b + i + Math.floor(e / 4)) * l) / 100) + 5) * natureMulti);
};

export const formatName = str => str ? String(str).replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Sem registro";
const PT_BR_NUMBER_FORMAT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export const formatNumberPtBr = value => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? PT_BR_NUMBER_FORMAT.format(numericValue) : "—";
};
export const preferredLocalizedEntry = entries => {
    const source = Array.isArray(entries) ? entries : [];
    for (const language of ["pt-br", "pt", "en"]) {
        const entry = source.find(candidate => String(candidate?.language?.name || "").toLowerCase() === language);
        if (entry) return entry;
    }
    return source[0] || null;
};
export const extractId = url => url ? String(url).split("/").filter(Boolean).pop() : "0";

export const VERSION_GROUPS = [
    { value: "auto", label: "Mais recente disponível" },
    { value: "champions", label: "Pokémon Champions" },
    { value: "mega-dimension", label: "Legends: Z-A — Mega Dimension" },
    { value: "legends-za", label: "Pokémon Legends: Z-A" },
    { value: "the-indigo-disk", label: "Scarlet/Violet — The Indigo Disk" },
    { value: "the-teal-mask", label: "Scarlet/Violet — The Teal Mask" },
    { value: "scarlet-violet", label: "Pokémon Scarlet/Violet" },
    { value: "legends-arceus", label: "Pokémon Legends: Arceus" },
    { value: "brilliant-diamond-shining-pearl", label: "Brilliant Diamond/Shining Pearl" },
    { value: "the-crown-tundra", label: "Sword/Shield — The Crown Tundra" },
    { value: "the-isle-of-armor", label: "Sword/Shield — The Isle of Armor" },
    { value: "sword-shield", label: "Pokémon Sword/Shield" },
    { value: "lets-go-pikachu-lets-go-eevee", label: "Let's Go, Pikachu!/Eevee!" },
    { value: "ultra-sun-ultra-moon", label: "Pokémon Ultra Sun/Ultra Moon" },
    { value: "sun-moon", label: "Pokémon Sun/Moon" },
    { value: "omega-ruby-alpha-sapphire", label: "Omega Ruby/Alpha Sapphire" },
    { value: "x-y", label: "Pokémon X/Y" },
    { value: "black-2-white-2", label: "Pokémon Black 2/White 2" },
    { value: "black-white", label: "Pokémon Black/White" },
    { value: "heartgold-soulsilver", label: "Pokémon HeartGold/SoulSilver" },
    { value: "platinum", label: "Pokémon Platinum" },
    { value: "diamond-pearl", label: "Pokémon Diamond/Pearl" },
    { value: "xd", label: "Pokémon XD: Gale of Darkness" },
    { value: "emerald", label: "Pokémon Emerald" },
    { value: "firered-leafgreen", label: "Pokémon FireRed/LeafGreen" },
    { value: "colosseum", label: "Pokémon Colosseum" },
    { value: "ruby-sapphire", label: "Pokémon Ruby/Sapphire" },
    { value: "crystal", label: "Pokémon Crystal" },
    { value: "gold-silver", label: "Pokémon Gold/Silver" },
    { value: "yellow", label: "Pokémon Yellow" },
    { value: "blue-japan", label: "Pokémon Blue (Japan)" },
    { value: "red-green-japan", label: "Pokémon Red/Green (Japan)" },
    { value: "red-blue", label: "Pokémon Red/Blue" }
];

export const VERSION_PRIORITY = VERSION_GROUPS.map(group => group.value).filter(value => value !== "auto");
export const VERSION_LABELS = Object.fromEntries(VERSION_GROUPS.map(group => [group.value, group.label]));

const detailOrder = detail => {
    const method = detail?.move_learn_method?.name;
    const level = Number(detail?.level_learned_at) || 0;
    if (method === "level-up") return { method: 1, level };
    if (method === "machine") return { method: 2, level: 0 };
    if (method === "tutor") return { method: 3, level: 0 };
    if (method === "egg") return { method: 4, level: 0 };
    return { method: 5, level: 0 };
};

export const getLatestVersionGroup = (moves, preferredVersion = "auto") => {
    if (!Array.isArray(moves) || moves.length === 0) return null;
    const observed = new Map();
    moves.forEach(entry => entry?.version_group_details?.forEach(detail => {
        const name = detail?.version_group?.name;
        if (!name) return;
        const id = Number(extractId(detail.version_group?.url)) || 0;
        observed.set(name, Math.max(id, observed.get(name) || 0));
    }));
    if (preferredVersion && preferredVersion !== "auto") return observed.has(preferredVersion) ? preferredVersion : null;
    for (const version of VERSION_PRIORITY) if (observed.has(version)) return version;
    return [...observed.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

export const filterMovesByLatestVersion = (moves, preferredVersion = "auto") => {
    if (!Array.isArray(moves) || moves.length === 0) return [];
    const versionGroup = getLatestVersionGroup(moves, preferredVersion);
    if (!versionGroup) return [];
    const unique = new Map();
    moves.forEach(entry => {
        const details = (entry?.version_group_details || [])
            .filter(detail => detail?.version_group?.name === versionGroup)
            .sort((a, b) => {
                const first = detailOrder(a);
                const second = detailOrder(b);
                return first.method - second.method || first.level - second.level;
            });
        const name = entry?.move?.name;
        if (!name || details.length === 0) return;
        unique.set(name, {
            move: entry.move,
            latest_detail: details[0],
            latest_details: details,
            version_group: versionGroup
        });
    });
    return [...unique.values()].sort((a, b) => {
        const first = detailOrder(a.latest_detail);
        const second = detailOrder(b.latest_detail);
        return first.method - second.method || first.level - second.level || (a.move?.name || "").localeCompare(b.move?.name || "");
    });
};

export const dedupeByNameLatest = entries => {
    const unique = new Map();
    (Array.isArray(entries) ? entries : []).forEach(entry => {
        if (entry?.name) unique.set(entry.name, entry);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export const STAT_MAP = { hp: "HP", attack: "Ataque", defense: "Defesa", "special-attack": "Atq. Esp.", "special-defense": "Def. Esp.", speed: "Velocidade" };
export const NATURES = {
    hardy: {up: null, down: null}, lonely: {up: "attack", down: "defense"}, brave: {up: "attack", down: "speed"}, adamant: {up: "attack", down: "special-attack"}, naughty: {up: "attack", down: "special-defense"},
    bold: {up: "defense", down: "attack"}, docile: {up: null, down: null}, relaxed: {up: "defense", down: "speed"}, impish: {up: "defense", down: "special-attack"}, lax: {up: "defense", down: "special-defense"},
    timid: {up: "speed", down: "attack"}, hasty: {up: "speed", down: "defense"}, serious: {up: null, down: null}, jolly: {up: "speed", down: "special-attack"}, naive: {up: "speed", down: "special-defense"},
    modest: {up: "special-attack", down: "attack"}, mild: {up: "special-attack", down: "defense"}, quiet: {up: "special-attack", down: "speed"}, bashful: {up: null, down: null}, rash: {up: "special-attack", down: "special-defense"},
    calm: {up: "special-defense", down: "attack"}, gentle: {up: "special-defense", down: "defense"}, sassy: {up: "special-defense", down: "speed"}, careful: {up: "special-defense", down: "special-attack"}, quirky: {up: null, down: null}
};
export const TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy", "stellar"];
export const TYPE_LABELS = {
    normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico", grass: "Planta", ice: "Gelo",
    fighting: "Lutador", poison: "Venenoso", ground: "Terrestre", flying: "Voador", psychic: "Psíquico",
    bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio", steel: "Aço",
    fairy: "Fada", stellar: "Estelar"
};
export const DAMAGE_CLASS_LABELS = { physical: "Físico", special: "Especial", status: "Status" };
export const formatType = type => TYPE_LABELS[type] || formatName(type);
export const formatDamageClass = damageClass => DAMAGE_CLASS_LABELS[damageClass] || formatName(damageClass);
export const TYPE_COLORS = { normal: "#9ca3af", fire: "#f97316", water: "#3b82f6", electric: "#eab308", grass: "#22c55e", ice: "#67e8f9", fighting: "#ef4444", poison: "#a855f7", ground: "#d97706", flying: "#818cf8", psychic: "#ec4899", bug: "#84cc16", rock: "#b45309", ghost: "#6366f1", dragon: "#6366f1", dark: "#334155", steel: "#94a3b8", fairy: "#f472b6", stellar: "#14b8a6" };
export const MATCHUPS = {
    normal: { fighting: 2, ghost: 0 }, fire: { water: 2, ground: 2, rock: 2, fire: .5, grass: .5, ice: .5, bug: .5, steel: .5, fairy: .5 },
    water: { electric: 2, grass: 2, fire: .5, water: .5, ice: .5, steel: .5 }, electric: { ground: 2, electric: .5, flying: .5, steel: .5 },
    grass: { fire: 2, ice: 2, poison: 2, flying: 2, bug: 2, water: .5, electric: .5, grass: .5, ground: .5 }, ice: { fire: 2, fighting: 2, rock: 2, steel: 2, ice: .5 },
    fighting: { flying: 2, psychic: 2, fairy: 2, bug: .5, rock: .5, dark: .5 }, poison: { ground: 2, psychic: 2, grass: .5, fighting: .5, poison: .5, bug: .5, fairy: .5 },
    ground: { water: 2, grass: 2, ice: 2, poison: .5, rock: .5, electric: 0 }, flying: { electric: 2, ice: 2, rock: 2, grass: .5, fighting: .5, bug: .5, ground: 0 },
    psychic: { bug: 2, ghost: 2, dark: 2, fighting: .5, psychic: .5 }, bug: { fire: 2, flying: 2, rock: 2, grass: .5, fighting: .5, ground: .5 },
    rock: { water: 2, grass: 2, fighting: 2, ground: 2, steel: 2, normal: .5, fire: .5, poison: .5, flying: .5 }, ghost: { ghost: 2, dark: 2, poison: .5, bug: .5, normal: 0, fighting: 0 },
    dragon: { ice: 2, dragon: 2, fairy: 2, fire: .5, water: .5, electric: .5, grass: .5 }, dark: { fighting: 2, bug: 2, fairy: 2, ghost: .5, dark: .5, psychic: 0 },
    steel: { fire: 2, fighting: 2, ground: 2, normal: .5, grass: .5, ice: .5, flying: .5, psychic: .5, bug: .5, rock: .5, dragon: .5, steel: .5, fairy: .5, poison: 0 },
    fairy: { poison: 2, steel: 2, fighting: .5, bug: .5, dark: .5, dragon: 0 }
};
export const calculateDefenses = typesArr => {
    const defenses = Object.fromEntries(TYPES.map(type => [type, 1]));
    (Array.isArray(typesArr) ? typesArr : []).forEach(typeEntry => {
        const defenderType = typeEntry?.type?.name;
        if (!defenderType || !MATCHUPS[defenderType]) return;
        Object.entries(MATCHUPS[defenderType]).forEach(([attackerType, multiplier]) => {
            defenses[attackerType] *= multiplier;
        });
    });
    return defenses;
};
