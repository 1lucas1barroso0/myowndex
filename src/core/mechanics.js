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

// Cronologia oficial de lançamentos para filtragem de integridade de dados
export const VERSION_PRIORITY = [
    'champion-stadium',
    'legends-arceus',
    'scarlet-violet',
    'brilliant-diamond-shining-pearl',
    'sword-shield',
    'ultra-sun-ultra-moon',
    'sun-moon',
    'x-y',
    'omega-ruby-alpha-sapphire',
    'black-2-white-2',
    'black-white',
    'heartgold-soulsilver',
    'diamond-pearl',
    'platinum',
    'ruby-sapphire',
    'emerald',
    'firered-leafgreen',
    'gold-silver',
    'crystal',
    'red-blue',
    'yellow'
];

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
    
    return moves.map(m => {
        const detail = m.version_group_details?.find(d => d.version_group?.name === bestVersion) || m.version_group_details?.[m.version_group_details.length - 1];
        return {
            move: m.move,
            latest_detail: detail
        };
    }).filter(m => m.latest_detail);
};

const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const _compress = (uncompressed, bitsPerChar, getCharFromInt) => {
    if (uncompressed == null) return '';
    let i, value;
    const context_dictionary = {};
    const context_dictionaryToCreate = {};
    let context_c = '';
    let context_wc = '';
    let context_w = '';
    let context_enlargeIn = 2;
    let context_dictSize = 3;
    let context_numBits = 2;
    const context_data = [];
    let context_data_val = 0;
    let context_data_position = 0;

    for (i = 0; i < uncompressed.length; i += 1) {
        context_c = uncompressed.charAt(i);
        if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
            context_dictionary[context_c] = context_dictSize++;
            context_dictionaryToCreate[context_c] = true;
        }

        context_wc = context_w + context_c;
        if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
            context_w = context_wc;
        } else {
            if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                value = context_w.charCodeAt(0);
                if (value < 256) {
                    for (let j = 0; j < context_numBits; j += 1) {
                        context_data_val = (context_data_val << 1);
                        if (context_data_position === bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        } else {
                            context_data_position += 1;
                        }
                    }
                    for (let j = 0; j < 8; j += 1) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position === bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        } else {
                            context_data_position += 1;
                        }
                        value = value >> 1;
                    }
                } else {
                    value = 1;
                    for (let j = 0; j < context_numBits; j += 1) {
                        context_data_val = (context_data_val << 1) | value;
                        if (context_data_position === bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        } else {
                            context_data_position += 1;
                        }
                    }
                    value = context_w.charCodeAt(0);
                    for (let j = 0; j < 16; j += 1) {
                        context_data_val = (context_data_val << 1) | (value & 1);
                        if (context_data_position === bitsPerChar - 1) {
                            context_data_position = 0;
                            context_data.push(getCharFromInt(context_data_val));
                            context_data_val = 0;
                        } else {
                            context_data_position += 1;
                        }
                        value = value >> 1;
                    }
                }
                context_enlargeIn -= 1;
                if (context_enlargeIn === 0) {
                    context_enlargeIn = 2 ** context_numBits;
                    context_numBits += 1;
                }
                delete context_dictionaryToCreate[context_w];
            } else {
                value = context_dictionary[context_w];
                for (let j = 0; j < context_numBits; j += 1) {
                    context_data_val = (context_data_val << 1) | (value & 1);
                    if (context_data_position === bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    } else {
                        context_data_position += 1;
                    }
                    value = value >> 1;
                }
            }
            context_enlargeIn -= 1;
            if (context_enlargeIn === 0) {
                context_enlargeIn = 2 ** context_numBits;
                context_numBits += 1;
            }
            context_dictionary[context_wc] = context_dictSize++;
            context_w = context_c;
        }
    }

    if (context_w !== '') {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
            value = context_w.charCodeAt(0);
            if (value < 256) {
                for (let j = 0; j < context_numBits; j += 1) {
                    context_data_val = (context_data_val << 1);
                    if (context_data_position === bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    } else {
                        context_data_position += 1;
                    }
                }
                for (let j = 0; j < 8; j += 1) {
                    context_data_val = (context_data_val << 1) | (value & 1);
                    if (context_data_position === bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    } else {
                        context_data_position += 1;
                    }
                    value = value >> 1;
                }
            } else {
                value = 1;
                for (let j = 0; j < context_numBits; j += 1) {
                    context_data_val = (context_data_val << 1) | value;
                    if (context_data_position === bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    } else {
                        context_data_position += 1;
                    }
                }
                value = context_w.charCodeAt(0);
                for (let j = 0; j < 16; j += 1) {
                    context_data_val = (context_data_val << 1) | (value & 1);
                    if (context_data_position === bitsPerChar - 1) {
                        context_data_position = 0;
                        context_data.push(getCharFromInt(context_data_val));
                        context_data_val = 0;
                    } else {
                        context_data_position += 1;
                    }
                    value = value >> 1;
                }
            }
            context_enlargeIn -= 1;
            if (context_enlargeIn === 0) {
                context_enlargeIn = 2 ** context_numBits;
                context_numBits += 1;
            }
            delete context_dictionaryToCreate[context_w];
        } else {
            value = context_dictionary[context_w];
            for (let j = 0; j < context_numBits; j += 1) {
                context_data_val = (context_data_val << 1) | (value & 1);
                if (context_data_position === bitsPerChar - 1) {
                    context_data_position = 0;
                    context_data.push(getCharFromInt(context_data_val));
                    context_data_val = 0;
                } else {
                    context_data_position += 1;
                }
                value = value >> 1;
            }
        }
    }

    value = 2;
    for (let j = 0; j < context_numBits; j += 1) {
        context_data_val = (context_data_val << 1) | (value & 1);
        if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
        } else {
            context_data_position += 1;
        }
        value = value >> 1;
    }

    while (true) {
        context_data_val = (context_data_val << 1);
        if (context_data_position === bitsPerChar - 1) {
            context_data.push(getCharFromInt(context_data_val));
            break;
        } else {
            context_data_position += 1;
        }
    }
    return context_data.join('');
};

const _decompress = (length, resetValue, getNextValue) => {
    const dictionary = [
        '',
        '\n',
    ];
    let next, enlargeIn = 4;
    let dictSize = 4;
    let numBits = 3;
    let entry = '';
    let result = '';
    let i, w;
    let bits, resb, maxpower, power;
    let c;
    let data = { val: getNextValue(0), position: resetValue, index: 1 };

    const readBits = (bitsCount) => {
        let bitsRead = 0;
        let res = 0;
        while (bitsRead < bitsCount) {
            res |= (data.val & data.position) ? 1 << bitsRead : 0;
            data.position >>= 1;
            if (data.position === 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
            }
            bitsRead += 1;
        }
        return res;
    };

    next = readBits(2);
    switch (next) {
        case 0:
            bits = 0;
            maxpower = 2;
            power = 1;
            while (power !== maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position === 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            c = String.fromCharCode(bits);
            break;
        case 1:
            bits = 0;
            maxpower = 2;
            power = 1;
            while (power !== maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position === 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            c = String.fromCharCode(bits);
            break;
        case 2:
            return '';
    }
    result = c;
    w = c;
    while (true) {
        if (data.index > length) return ''; // malformed
        next = readBits(numBits);
        switch (next) {
            case 0:
                bits = 0;
                maxpower = 2;
                power = 1;
                while (power !== maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position === 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                dictionary[dictSize++] = String.fromCharCode(bits);
                next = dictSize - 1;
                enlargeIn -= 1;
                break;
            case 1:
                bits = 0;
                maxpower = 2;
                power = 1;
                while (power !== maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position === 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                dictionary[dictSize++] = String.fromCharCode(bits);
                next = dictSize - 1;
                enlargeIn -= 1;
                break;
            case 2:
                return result;
        }

        if (enlargeIn === 0) {
            enlargeIn = 2 ** numBits;
            numBits += 1;
        }

        if (dictionary[next]) {
            entry = dictionary[next];
        } else {
            if (next === dictSize) {
                entry = w + w.charAt(0);
            } else {
                return null;
            }
        }
        result += entry;

        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn -= 1;

        w = entry;

        if (enlargeIn === 0) {
            enlargeIn = 2 ** numBits;
            numBits += 1;
        }
    }
};

export const compressToBase64 = (input) => {
    if (input == null) return '';
    const output = _compress(input, 6, (a) => keyStr.charAt(a));
    switch (output.length % 4) {
        case 0:
            return output;
        case 1:
            return `${output}===`;
        case 2:
            return `${output}==`;
        case 3:
            return `${output}=`;
        default:
            return output;
    }
};

export const decompressFromBase64 = (input) => {
    if (input == null || input === '') return '';
    return _decompress(input.length, 32, (index) => keyStr.indexOf(input.charAt(index)));
};

export const TEAM_EXPORT_PREFIX = 'MYOWNDEX:v2:';
export const TEAM_LEGACY_PREFIX = 'MYOWNDEX-';

export const encodeTeamShare = (team) => {
    const payload = JSON.stringify({ version: 2, team });
    return `${TEAM_EXPORT_PREFIX}${compressToBase64(payload)}`;
};

export const decodeTeamShare = (value) => {
    const raw = value?.trim();
    if (!raw) throw new Error('Payload vazio');

    if (raw.startsWith(TEAM_EXPORT_PREFIX)) {
        const compressed = raw.slice(TEAM_EXPORT_PREFIX.length);
        return JSON.parse(decompressFromBase64(compressed));
    }

    if (raw.startsWith(TEAM_LEGACY_PREFIX)) {
        const payload = raw.slice(TEAM_LEGACY_PREFIX.length);
        return JSON.parse(decodeURIComponent(atob(payload)));
    }

    throw new Error('Formato de link inválido');
};

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
