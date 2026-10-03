import { accountRequest } from "./accountClient.js";

export const listAccountRooms = accountId => accountRequest("rooms", { accountId });
export const bindAccountRoom = (accountId, session) => accountRequest("rooms", {
    method: "POST", accountId, body: { code: session.code, key: session.key, displayName: session.displayName },
});
export const unlinkAccountRoom = (accountId, code) => accountRequest("rooms", {
    method: "DELETE", accountId, body: { code },
});
