import { secureRandomId } from "./random.js";

const DEFAULT_ICE_SERVERS = [
    {
        urls: [
            "stun:stun.cloudflare.com:3478",
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
        ],
    },
];

export const getCallIceServers = value => {
    if (!value) return DEFAULT_ICE_SERVERS;
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed) || !parsed.length || parsed.length > 8) return DEFAULT_ICE_SERVERS;
        const servers = parsed.map(server => {
            const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
            if (!urls.length || urls.length > 8 || urls.some(url => typeof url !== "string" || !/^(stun|stuns|turn|turns):\S+$/.test(url))) return null;
            return {
                urls,
                ...(typeof server.username === "string" ? { username: server.username } : {}),
                ...(typeof server.credential === "string" ? { credential: server.credential } : {}),
            };
        });
        return servers.every(Boolean) ? servers : DEFAULT_ICE_SERVERS;
    } catch {
        return DEFAULT_ICE_SERVERS;
    }
};

export const CALL_ICE_SERVERS = getCallIceServers(process.env.NEXT_PUBLIC_MYOWNDEX_ICE_SERVERS);

export const callPeerConfiguration = (iceServers = CALL_ICE_SERVERS) => ({
    iceServers,
    iceCandidatePoolSize: 4,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
});

export const callHasTurnRelay = (iceServers = CALL_ICE_SERVERS) =>
    iceServers.some(server => {
        const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
        return urls.some(url => typeof url === "string" && /^turns?:/i.test(url));
    });

export const shouldRestartCallIce = state => state === "failed" || state === "disconnected";

export const createCallConnectionId = () => secureRandomId("call");

export const callParticipantId = session => {
    if (session?.role === "narrator") return "narrator";
    return typeof session?.playerId === "string" ? session.playerId.trim() : "";
};

export const shouldCreateCallOffer = (selfId, peerId) =>
    Boolean(selfId && peerId && selfId !== peerId && selfId < peerId);

export const normalizeCallMembers = members => {
    if (!Array.isArray(members)) return [];
    const unique = new Map();
    members.forEach(member => {
        const participantId = typeof member?.participantId === "string"
            ? member.participantId.trim()
            : "";
        if (!participantId) return;
        unique.set(participantId, {
            participantId,
            displayName: typeof member.displayName === "string" && member.displayName.trim()
                ? member.displayName.trim()
                : member.role === "narrator" ? "Narrador" : "Jogador",
            role: member.role === "narrator" ? "narrator" : "player",
            muted: Boolean(member.muted),
            joinedAt: member.joinedAt || "",
            lastSeenAt: member.lastSeenAt || "",
        });
    });
    return [...unique.values()].sort((left, right) => {
        if (left.role !== right.role) return left.role === "narrator" ? -1 : 1;
        return left.displayName.localeCompare(right.displayName, "pt-BR");
    });
};

export const supportsRoomCall = () =>
    typeof window !== "undefined"
    && window.isSecureContext !== false
    && typeof window.RTCPeerConnection === "function"
    && Boolean(navigator.mediaDevices?.getUserMedia);
