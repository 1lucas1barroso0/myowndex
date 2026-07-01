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

// Hierarquia Oficial de Lançamentos: Do mais recente ao mais antigo!
export const VERSION_PRIORITY = [
    'champions', 'scarlet-violet', 'legends-arceus', 'brilliant-diamond-shining-pearl', 
    'sword-shield', 'lets-go-pikachu-lets-go-eevee', 'ultra-sun-ultra-moon', 'sun-moon', 
    'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2', 'black-white', 'heartgold-soulsilver', 
    'platinum', 'diamond-pearl', 'firered-leafgreen', 'emerald', 'ruby-sapphire', 
    'crystal', 'gold-silver', 'yellow', 'red-blue'
];

export const filterMovesByLatestVersion = (moves) => {
    if (!moves || !moves.length) return [];
    return moves.map(m => {
        let bestDetail = null;
        let bestRank = 999;
        m.version_group_details.forEach(d => {
            const rank = VERSION_PRIORITY.indexOf(d.version_group?.name);
            if (rank !== -1 && rank < bestRank) { bestRank = rank; bestDetail = d; }
        });
        if (!bestDetail && m.version_group_details.length > 0) {
            bestDetail = m.version_group_details[m.version_group_details.length - 1];
        }
        return { move: m.move, latest_detail: bestDetail };
    }).filter(m => m.latest_detail);
};

// Compressão de Dados Atômica: Torna o código do Cabo Link minúsculo!
export const packTeam = (team) => {
    const pkmns = team.pokemon.map(pk => {
        const m = pk.moves || ['','','',''];
        const iv = pk.ivs || {hp:31,attack:31,defense:31,'special-attack':31,'special-defense':31,speed:31};
        const ev = pk.evs || {hp:0,attack:0,defense:0,'special-attack':0,'special-defense':0,speed:0};
        return [
            pk.species?.name || '', pk.level || 50, pk.item || '', pk.ability || '', pk.nature || 'hardy',
            [m[0],m[1],m[2],m[3]], [iv.hp, iv.attack, iv.defense, iv['special-attack'], iv['special-defense'], iv.speed],
            [ev.hp, ev.attack, ev.defense, ev['special-attack'], ev['special-defense'], ev.speed],
            pk.canGMax ? 1 : 0, pk.teraType || '', pk.friendship ?? 150, pk.gender || 'N', pk.genderRate ?? -1,
            pk.customStats ? [pk.customStats.hp||0, pk.customStats.attack||0, pk.customStats.defense||0, pk.customStats['special-attack']||0, pk.customStats['special-defense']||0, pk.customStats.speed||0] : 0,
            pk.customTypes ? [pk.customTypes[0]||'', pk.customTypes[1]||''] : 0
        ];
    });
    return [team.name, pkmns];
};

export const unpackTeam = async (packedData) => {
    const [name, pkmnsArr] = packedData;
    const newTeamId = Date.now().toString();
    const reconstructed = await Promise.all(pkmnsArr.map(async (arr) => {
        const [sName, lvl, itm, abil, nat, mvs, ivsArr, evsArr, gx, tera, friend, gen, genRate, csArr, ctArr] = arr;
        if (!sName) return null;
        const spData = await fetchCached(`https://pokeapi.co/api/v2/pokemon/${sName}`);
        if (!spData) return null;
        return {
            species: spData, level: lvl, item: itm, ability: abil, nature: nat, moves: mvs,
            ivs: {hp:ivsArr[0], attack:ivsArr[1], defense:ivsArr[2], 'special-attack':ivsArr[3], 'special-defense':ivsArr[4], speed:ivsArr[5]},
            evs: {hp:evsArr[0], attack:evsArr[1], defense:evsArr[2], 'special-attack':evsArr[3], 'special-defense':evsArr[4], speed:evsArr[5]},
            canGMax: gx === 1, teraType: tera, friendship: friend, gender: gen, genderRate: genRate,
            customStats: csArr !== 0 ? {hp:csArr[0], attack:csArr[1], defense:csArr[2], 'special-attack':csArr[3], 'special-defense':csArr[4], speed:csArr[5]} : null,
            customTypes: ctArr !== 0 ? ctArr : null
        };
    }));
    return { id: newTeamId, name: name || 'Caixa Recebida', pokemon: reconstructed.filter(Boolean) };
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
export const NATURES = { hardy: {up: null, down: null}, lonely: {up: 'attack', down: 'defense'}, brave: {up: 'attack', down: 'speed'}, adamant: {up: 'attack', down: 'special-attack'}, naughty: {up: 'attack', down: 'special-defense'}, bold: {up: 'defense', down: 'attack'}, docile: {up: null, down: null}, relaxed: {up: 'defense', down: 'speed
