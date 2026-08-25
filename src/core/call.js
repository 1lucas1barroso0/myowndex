import { secureRandomId } from "./random.js";

export const CALL_ICE_SERVERS = [
    { urls: ["stun:stun.cloudflare.com:3478"] },
];

export const createCallConnectionId = () => {
    return secureRandomId("call");
};

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
    && typeof window.RTCPeerConnection === "function"
    && Boolean(navigator.mediaDevices?.getUserMedia);
