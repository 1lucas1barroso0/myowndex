import { normalizeTeam, STAT_KEYS } from "./team.js";

export const SHARE_PREFIX = "MYOWNDEX4.";
export const RAW_SHARE_PREFIX = "MYOWNDEX4R.";
export const LEGACY_SHARE_PREFIX = "MYOWNDEX-V3-";
const MAX_CODE_LENGTH = 50000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64Url = bytes => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = value => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const streamTransform = async (bytes, StreamConstructor, format) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new StreamConstructor(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

const packStats = (stats, fallback) => STAT_KEYS.map(stat => stats?.[stat] ?? fallback);
const unpackStats = (stats, fallback) => Object.fromEntries(
    STAT_KEYS.map((stat, index) => [stat, stats?.[index] ?? fallback])
);

const packPokemon = pokemon => ({
    s: pokemon.species?.species?.name || pokemon.species?.name || "",
    f: pokemon.species?.name || "",
    n: pokemon.nickname || "",
    l: pokemon.level,
    i: pokemon.item || "",
    a: pokemon.ability || "",
    t: pokemon.nature || "hardy",
    m: pokemon.moves,
    v: packStats(pokemon.ivs, 31),
    e: packStats(pokemon.evs, 0),
    g: pokemon.gender || "N",
    r: pokemon.genderRate ?? -1,
    q: [
        pokemon.canGMax ? 1 : 0,
        pokemon.shiny ? 1 : 0,
        pokemon.genderLocked ? 1 : 0
    ],
    d: pokemon.dynamaxLevel ?? 0,
    y: pokemon.teraType || "",
    h: pokemon.friendship ?? 70,
    c: pokemon.customStats || null,
    x: pokemon.customTypes || null,
    j: pokemon.rpg ? {
        x: pokemon.rpg.xp ?? 0,
        h: pokemon.rpg.currentHp,
        s: pokemon.rpg.status || "",
        b: pokemon.rpg.caughtWith || "",
        o: pokemon.rpg.originalTrainer || "",
        n: pokemon.rpg.notes || "",
        a: pokemon.rpg.animeNotes || "",
        p: pokemon.rpg.pp || [null, null, null, null]
    } : null
});

const unpackPokemon = pokemon => ({
    speciesName: pokemon.s || pokemon.f || "",
    formName: pokemon.f || pokemon.s || "",
    nickname: pokemon.n || "",
    level: pokemon.l,
    item: pokemon.i || "",
    ability: pokemon.a || "",
    nature: pokemon.t || "hardy",
    moves: pokemon.m,
    ivs: unpackStats(pokemon.v, 31),
    evs: unpackStats(pokemon.e, 0),
    gender: pokemon.g || "N",
    genderRate: pokemon.r ?? -1,
    canGMax: Boolean(pokemon.q?.[0]),
    shiny: Boolean(pokemon.q?.[1]),
    genderLocked: Boolean(pokemon.q?.[2]),
    dynamaxLevel: pokemon.d ?? 0,
    teraType: pokemon.y || "",
    friendship: pokemon.h ?? 70,
    customStats: pokemon.c || null,
    customTypes: pokemon.x || null,
    rpg: pokemon.j ? {
        xp: pokemon.j.x ?? 0,
        currentHp: pokemon.j.h,
        status: pokemon.j.s || "",
        caughtWith: pokemon.j.b || "",
        originalTrainer: pokemon.j.o || "",
        notes: pokemon.j.n || "",
        animeNotes: pokemon.j.a || "",
        pp: pokemon.j.p
    } : undefined
});

const packTeam = team => {
    const normalized = normalizeTeam(team);
    return {
        z: 4,
        id: normalized.shareId,
        u: normalized.updatedAt,
        n: normalized.name,
        r: normalized.versionGroup,
        p: normalized.pokemon.map(packPokemon)
    };
};

const unpackTeam = payload => {
    if (!payload || payload.z !== 4 || !Array.isArray(payload.p)) {
        throw new Error("Este código não parece pertencer ao MyOwnDex. Confira se ele foi copiado por inteiro.");
    }
    if (payload.p.length > 6) throw new Error("Uma Box guarda até seis parceiros.");
    return normalizeTeam({
        shareId: payload.id,
        updatedAt: payload.u,
        name: payload.n,
        versionGroup: payload.r,
        pokemon: payload.p.map(unpackPokemon)
    });
};

const deterministicId = value => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `legacy-${(hash >>> 0).toString(36)}`;
};

const decodeLegacy = code => {
    const encoded = code.startsWith(LEGACY_SHARE_PREFIX) ? code.slice(LEGACY_SHARE_PREFIX.length) : code;
    let json;
    try {
        json = decodeURIComponent(atob(encoded));
    } catch {
        json = textDecoder.decode(base64UrlToBytes(encoded));
    }
    const payload = JSON.parse(json);
    if (!payload || !Array.isArray(payload.partners) || payload.partners.length > 6) {
        throw new Error("Este código antigo de Box não pôde ser lido. Confira se ele foi copiado por inteiro.");
    }
    return normalizeTeam({
        shareId: deterministicId(code),
        updatedAt: 0,
        name: payload.boxName || "Box recebida",
        versionGroup: "auto",
        pokemon: payload.partners.map(partner => ({
            speciesName: partner.sp,
            formName: partner.sp,
            nickname: partner.nk,
            level: partner.lv,
            item: partner.it,
            ability: partner.ab,
            nature: partner.nt,
            moves: partner.mv,
            ivs: unpackStats(partner.iv, 31),
            evs: unpackStats(partner.ev, 0),
            canGMax: partner.gm,
            teraType: partner.tr,
            friendship: partner.fr,
            customStats: partner.cs,
            customTypes: partner.ct,
            gender: partner.gd,
            genderRate: partner.gr ?? -1
        }))
    });
};

export const extractShareCode = input => {
    const text = String(input || "").trim();
    if (!text) throw new Error("Cole o código ou o link compartilhado da Box.");
    if (text.length > MAX_CODE_LENGTH) throw new Error("Este código é longo demais para uma Box do MyOwnDex.");
    const directIndex = [text.indexOf(SHARE_PREFIX), text.indexOf(RAW_SHARE_PREFIX), text.indexOf(LEGACY_SHARE_PREFIX)]
        .filter(index => index >= 0)
        .sort((a, b) => a - b)[0];
    if (directIndex != null) return decodeURIComponent(text.slice(directIndex).split(/[&#?\s]/)[0]);
    try {
        const url = new URL(text);
        const candidate = url.searchParams.get("team") || new URLSearchParams(url.hash.replace(/^#/, "")).get("team");
        if (candidate) return decodeURIComponent(candidate);
    } catch {
        // A bare legacy payload is handled by the decoder.
    }
    return text;
};

export const encodeTeam = async team => {
    const bytes = textEncoder.encode(JSON.stringify(packTeam(team)));
    if (typeof CompressionStream === "function") {
        try {
            const compressed = await streamTransform(bytes, CompressionStream, "deflate");
            return SHARE_PREFIX + bytesToBase64Url(compressed);
        } catch {
            // Older browsers use the raw, Unicode-safe representation.
        }
    }
    return RAW_SHARE_PREFIX + bytesToBase64Url(bytes);
};

export const decodeTeam = async input => {
    try {
        const code = extractShareCode(input);
        if (code.startsWith(LEGACY_SHARE_PREFIX) || (!code.startsWith(SHARE_PREFIX) && !code.startsWith(RAW_SHARE_PREFIX))) {
            return decodeLegacy(code);
        }
        const isCompressed = code.startsWith(SHARE_PREFIX);
        const payload = code.slice(isCompressed ? SHARE_PREFIX.length : RAW_SHARE_PREFIX.length);
        let bytes = base64UrlToBytes(payload);
        if (isCompressed) {
            if (typeof DecompressionStream !== "function") {
                throw new Error("Atualize o navegador para abrir este formato de Box.");
            }
            bytes = await streamTransform(bytes, DecompressionStream, "deflate");
        }
        return unpackTeam(JSON.parse(textDecoder.decode(bytes)));
    } catch (error) {
        if (error instanceof Error && (
            error.message.includes("Box")
            || error.message.includes("MyOwnDex")
            || error.message.includes("navegador")
        )) {
            throw error;
        }
        throw new Error("Esta Box não pôde ser lida. Confira se o código foi copiado por inteiro.");
    }
};
