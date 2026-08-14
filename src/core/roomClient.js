import { ROOM_SESSION_STORAGE_KEY } from "./room.js";
import { readStorage, removeStorage, writeStorage } from "./storage.js";

const REQUEST_TIMEOUT = 15000;

const roomRequest = async (path, key, options = {}) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        const headers = new Headers(options.headers || {});
        if (key) headers.set("x-myowndex-room-key", key);
        if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) {
            headers.set("content-type", "application/json");
        }
        headers.set("accept", "application/json");
        const response = await fetch(path, {
            ...options,
            headers,
            signal: controller.signal,
            cache: "no-store",
        });
        const type = response.headers.get("content-type") || "";
        const data = type.includes("application/json")
            ? await response.json()
            : await response.text();
        if (!response.ok) {
            const error = new Error(data?.error || "A Central da Aventura perdeu a conexão. Tente novamente.");
            error.status = response.status;
            error.data = data;
            throw error;
        }
        return data;
    } catch (error) {
        if (error?.name === "AbortError") throw new Error("A aventura está levando mais tempo que o esperado. Tente novamente.");
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
};

export const createRemoteRoom = ({ title, narratorName, snapshot }) =>
    roomRequest("/api/rooms", "", {
        method: "POST",
        body: JSON.stringify({ title, narratorName, snapshot }),
    });

export const joinRemoteRoom = ({ code, inviteCode, displayName }) =>
    roomRequest(`/api/rooms/${encodeURIComponent(code)}/join`, "", {
        method: "POST",
        body: JSON.stringify({ inviteCode, displayName }),
    });

export const fetchRemoteRoom = session =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}`, session.key);

export const saveRemoteRoom = (session, snapshot, expectedRevision) =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}`, session.key, {
        method: "PATCH",
        body: JSON.stringify({
            title: snapshot.title,
            snapshot,
            expectedRevision,
        }),
    });

export const deleteRemoteRoom = session =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}`, session.key, {
        method: "DELETE",
    });

export const postRoomEvent = (session, type, payload = {}) =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}/events`, session.key, {
        method: "POST",
        body: JSON.stringify({ type, payload }),
    });

export const joinRoomCall = (session, connectionId, { displayName, muted = false } = {}) =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}/call`, session.key, {
        method: "POST",
        body: JSON.stringify({ action: "join", connectionId, displayName, muted }),
    });

export const fetchRoomCall = (session, connectionId, after = 0) =>
    roomRequest(
        `/api/rooms/${encodeURIComponent(session.code)}/call?connection=${encodeURIComponent(connectionId)}&after=${Math.max(0, Number(after) || 0)}`,
        session.key,
    );

export const sendRoomCallSignal = (session, connectionId, recipientId, type, payload) =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}/call`, session.key, {
        method: "POST",
        body: JSON.stringify({ action: "signal", connectionId, recipientId, type, payload }),
    });

export const setRoomCallMuted = (session, connectionId, muted) =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}/call`, session.key, {
        method: "PATCH",
        body: JSON.stringify({ connectionId, muted: Boolean(muted) }),
    });

export const leaveRoomCall = (session, connectionId, { keepalive = false } = {}) =>
    roomRequest(`/api/rooms/${encodeURIComponent(session.code)}/call`, session.key, {
        method: "DELETE",
        body: JSON.stringify({ connectionId }),
        keepalive,
    });

export const uploadRoomAudio = (session, file, title, onProgress) => {
    const form = new FormData();
    form.set("file", file);
    form.set("title", title || file.name);
    onProgress?.(0.2);
    return roomRequest(`/api/rooms/${encodeURIComponent(session.code)}/audio`, session.key, {
        method: "POST",
        body: form,
    }).then(result => {
        onProgress?.(1);
        return result;
    });
};

export const fetchRoomAudioUrl = async (session, mediaId) => {
    const response = await fetch(
        `/api/rooms/${encodeURIComponent(session.code)}/audio/${encodeURIComponent(mediaId)}`,
        {
            headers: { "x-myowndex-room-key": session.key },
            cache: "no-store",
        },
    );
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Esta trilha não pôde ser aberta agora.");
    }
    return URL.createObjectURL(await response.blob());
};

export const deleteRoomAudio = (session, mediaId) =>
    roomRequest(
        `/api/rooms/${encodeURIComponent(session.code)}/audio/${encodeURIComponent(mediaId)}`,
        session.key,
        { method: "DELETE" },
    );

export const normalizeSavedSession = value => {
    if (!value || typeof value !== "object") return null;
    const code = typeof value.code === "string" ? value.code.toUpperCase() : "";
    const key = typeof value.key === "string" ? value.key : "";
    const role = value.role === "narrator" ? "narrator" : value.role === "player" ? "player" : "";
    if (!code || !key || !role) return null;
    return {
        code,
        key,
        role,
        playerId: typeof value.playerId === "string" ? value.playerId : null,
        displayName: typeof value.displayName === "string" ? value.displayName : "",
        inviteCode: role === "narrator" && typeof value.inviteCode === "string" ? value.inviteCode : "",
        local: Boolean(value.local),
    };
};

export const loadRoomSession = () => normalizeSavedSession(readStorage(ROOM_SESSION_STORAGE_KEY, null));

export const saveRoomSession = session => {
    const normalized = normalizeSavedSession(session);
    return normalized ? writeStorage(ROOM_SESSION_STORAGE_KEY, normalized) : false;
};

export const clearRoomSession = () => removeStorage(ROOM_SESSION_STORAGE_KEY);

const normalizeInviteParts = (code, inviteCode) => {
    const normalizedCode = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const normalizedInvite = String(inviteCode || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 64);
    return normalizedCode.length >= 5 && normalizedInvite
        ? { code: normalizedCode, inviteCode: normalizedInvite }
        : null;
};

export const buildRoomInviteToken = session => session?.code && session?.inviteCode
    ? `MYOWNDEX-AVENTURA:${session.code}:${session.inviteCode}`
    : "";

export const parseRoomInviteValue = (input, baseUrl = "https://myowndex.vercel.app/") => {
    const text = String(input || "").trim();
    if (!text) return null;

    const compact = text.match(/MYOWNDEX-AVENTURA:([A-Z0-9]{5,8}):([^\s&#?]+)/i);
    if (compact) return normalizeInviteParts(compact[1], compact[2]);

    const pair = text.match(/^([A-Z0-9]{5,8})[\s|:;,]+(join_[A-Za-z0-9]+)$/i);
    if (pair) return normalizeInviteParts(pair[1], pair[2]);

    try {
        const url = new URL(text, baseUrl);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const code = hashParams.get("aventura")
            || hashParams.get("sala")
            || url.searchParams.get("aventura")
            || url.searchParams.get("sala");
        const inviteCode = hashParams.get("convite") || url.searchParams.get("convite");
        return normalizeInviteParts(code, inviteCode);
    } catch {
        return null;
    }
};

export const parseRoomInvite = () => {
    if (typeof window === "undefined") return null;
    return parseRoomInviteValue(window.location.href, window.location.origin);
};

export const buildPlayerInvite = (session, currentUrl) => {
    if (!session?.inviteCode) return "";
    const href = currentUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!href) return "";
    const url = new URL(href);
    url.searchParams.set("abrir", "aventura");
    url.hash = new URLSearchParams({
        aventura: session.code,
        convite: session.inviteCode,
    }).toString();
    return url.toString();
};
