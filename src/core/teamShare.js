import { normalizeTeam, STAT_KEYS } from "./team.js";
import { decompressSync, zlibSync } from "fflate";

export const SHARE_PREFIX = "MYOWNDEX4.";
export const RAW_SHARE_PREFIX = "MYOWNDEX4R.";
export const POKEMON_SHARE_PREFIX = "MYOWNDEXP1.";
export const RAW_POKEMON_SHARE_PREFIX = "MYOWNDEXP1R.";
export const LEGACY_SHARE_PREFIX = "MYOWNDEX-V3-";
const MAX_CODE_LENGTH = 50000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const bytesToBase64Url = bytes => {
    let base64 = "";
    if (typeof btoa === "function") {
        let binary = "";
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        base64 = btoa(binary);
    } else {
        for (let index = 0; index < bytes.length; index += 3) {
            const first = bytes[index];
            const second = bytes[index + 1];
            const third = bytes[index + 2];
            const value = (first << 16) | ((second || 0) << 8) | (third || 0);
            base64 += BASE64_ALPHABET[(value >> 18) & 63];
            base64 += BASE64_ALPHABET[(value >> 12) & 63];
            base64 += index + 1 < bytes.length ? BASE64_ALPHABET[(value >> 6) & 63] : "=";
            base64 += index + 2 < bytes.length ? BASE64_ALPHABET[value & 63] : "=";
        }
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = value => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    if (typeof atob === "function") {
        const binary = atob(base64);
        return Uint8Array.from(binary, character => character.charCodeAt(0));
    }
    const clean = base64.replace(/=+$/g, "");
    const bytes = [];
    for (let index = 0; index < clean.length; index += 4) {
        const first = BASE64_ALPHABET.indexOf(clean[index]);
        const second = BASE64_ALPHABET.indexOf(clean[index + 1]);
        const third = clean[index + 2] ? BASE64_ALPHABET.indexOf(clean[index + 2]) : 0;
        const fourth = clean[index + 3] ? BASE64_ALPHABET.indexOf(clean[index + 3]) : 0;
        if (first < 0 || second < 0 || third < 0 || fourth < 0) throw new Error("Código Base64 inválido.");
        const packed = (first << 18) | (second << 12) | (third << 6) | fourth;
        bytes.push((packed >> 16) & 255);
        if (index + 2 < clean.length) bytes.push((packed >> 8) & 255);
        if (index + 3 < clean.length) bytes.push(packed & 255);
    }
    return Uint8Array.from(bytes);
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

const packPokemonBundle = (pokemon, source = {}) => {
    const partners = Array.isArray(pokemon) ? pokemon.slice(0, 6) : [];
    if (!partners.length) throw new Error("Escolha pelo menos um Pokémon para compartilhar.");
    return {
        z: 1,
        k: "pokemon",
        n: String(source.name || "Pokémon recebidos").trim().slice(0, 80),
        r: String(source.versionGroup || "auto"),
        p: partners.map(packPokemon),
    };
};

const unpackPokemonBundle = payload => {
    if (!payload || payload.z !== 1 || payload.k !== "pokemon" || !Array.isArray(payload.p)) {
        throw new Error("Este código não parece pertencer ao MyOwnDex. Confira se ele foi copiado por inteiro.");
    }
    if (!payload.p.length || payload.p.length > 6) {
        throw new Error("Um envio deve ter de um a seis Pokémon.");
    }
    return {
        kind: "pokemon",
        sourceName: String(payload.n || "Pokémon recebidos").trim().slice(0, 80),
        versionGroup: String(payload.r || "auto"),
        pokemon: payload.p.map(unpackPokemon),
    };
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
    const directIndex = [
        text.indexOf(SHARE_PREFIX),
        text.indexOf(RAW_SHARE_PREFIX),
        text.indexOf(POKEMON_SHARE_PREFIX),
        text.indexOf(RAW_POKEMON_SHARE_PREFIX),
        text.indexOf(LEGACY_SHARE_PREFIX),
    ]
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
            // The portable fallback below supports browsers without Streams.
        }
    }
    try {
        return SHARE_PREFIX + bytesToBase64Url(zlibSync(bytes, { level: 6 }));
    } catch {
        return RAW_SHARE_PREFIX + bytesToBase64Url(bytes);
    }
};

export const encodePokemonBundle = async (pokemon, source = {}) => {
    const bytes = textEncoder.encode(JSON.stringify(packPokemonBundle(pokemon, source)));
    if (typeof CompressionStream === "function") {
        try {
            const compressed = await streamTransform(bytes, CompressionStream, "deflate");
            return POKEMON_SHARE_PREFIX + bytesToBase64Url(compressed);
        } catch {
            // The portable fallback below supports browsers without Streams.
        }
    }
    try {
        return POKEMON_SHARE_PREFIX + bytesToBase64Url(zlibSync(bytes, { level: 6 }));
    } catch {
        return RAW_POKEMON_SHARE_PREFIX + bytesToBase64Url(bytes);
    }
};

const decodeCurrentPayload = async code => {
    const prefix = [
        SHARE_PREFIX,
        RAW_SHARE_PREFIX,
        POKEMON_SHARE_PREFIX,
        RAW_POKEMON_SHARE_PREFIX,
    ].find(candidate => code.startsWith(candidate));
    if (!prefix) return null;
    const compressed = prefix === SHARE_PREFIX || prefix === POKEMON_SHARE_PREFIX;
    let bytes = base64UrlToBytes(code.slice(prefix.length));
    if (compressed) {
        if (typeof DecompressionStream === "function") {
            try {
                bytes = await streamTransform(bytes, DecompressionStream, "deflate");
            } catch {
                bytes = decompressSync(bytes);
            }
        } else {
            bytes = decompressSync(bytes);
        }
    }
    return {
        prefix,
        payload: JSON.parse(textDecoder.decode(bytes)),
    };
};

export const decodeShare = async input => {
    try {
        const code = extractShareCode(input);
        if (code.startsWith(POKEMON_SHARE_PREFIX) || code.startsWith(RAW_POKEMON_SHARE_PREFIX)) {
            const current = await decodeCurrentPayload(code);
            return unpackPokemonBundle(current.payload);
        }
        if (code.startsWith(LEGACY_SHARE_PREFIX) || (!code.startsWith(SHARE_PREFIX) && !code.startsWith(RAW_SHARE_PREFIX))) {
            return { kind: "team", team: decodeLegacy(code) };
        }
        const current = await decodeCurrentPayload(code);
        return { kind: "team", team: unpackTeam(current.payload) };
    } catch (error) {
        if (error instanceof Error && (
            error.message.includes("Box")
            || error.message.includes("Pokémon")
            || error.message.includes("MyOwnDex")
            || error.message.includes("navegador")
            || error.message.includes("compartilhamento")
        )) {
            throw error;
        }
        throw new Error("Este compartilhamento não pôde ser lido. Confira se o código foi copiado por inteiro.");
    }
};

export const decodeTeam = async input => {
    const decoded = await decodeShare(input);
    if (decoded.kind !== "team") {
        throw new Error("Este código contém Pokémon avulsos, não uma Box inteira.");
    }
    return decoded.team;
};
