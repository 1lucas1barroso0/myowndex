import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { accountLogoutComplete, accountRequest } from "../../core/accountClient.js";
import {
    ACCOUNT_DOCUMENT_LIMIT, ACCOUNT_RESOURCE_KEYS, ACCOUNT_SYNC_KEY,
    accountContentEqual, accountDocumentBytes, accountValuesEqual, importGuestDocument, mergeAccountDocuments,
    normalizeAccountDocument, recordAccountChanges,
} from "../../core/accountDocument.js";
import {
    clearStorageScope, getStorageScope, listStoredAccountScopes, readDurableStorage, readStorage, setStorageScope, storageScopeForClearedCopy,
    writeDurableStorage, writeStorage,
} from "../../core/storage.js";
import { loadTeamsDurable, TEAM_SCHEMA_VERSION } from "../../core/team.js";
import { flushLocalRollHistoryWrites, readLocalRollHistoryDurable, writeLocalRollHistoryDurable } from "../../core/localRolls.js";
import { flushLocalPokemonDiceWrites } from "../../core/localPokemonRolls.js";

const IDENTITY_KEY = "myowndex_account_identity_v1";
const NOTICE_KEY = "myowndex_account_notice_v1";
const PENDING_LOGOUT_KEY = "myowndex_account_signout_v1";
const RECOVERY_CLEAR_KEY = "myowndex_account_recovery_clear_v1";
const RESOURCE_KEYS = new Set(Object.values(ACCOUNT_RESOURCE_KEYS));
const emptyRecord = () => ({ document: normalizeAccountDocument(), base: null, revision: 0, updatedAt: null, recoveries: [] });
const hasGuestData = value => Boolean(value.boxes.length || value.dex.favorites.length || value.localAdventure
    || value.localTools.diceRoom || value.localTools.generatorDraft || value.localTools.rollHistory.length);
const validIdentity = value => value && typeof value.id === "string" && typeof value.username === "string" ? value : null;
const browserOnline = () => typeof navigator === "undefined" || navigator.onLine;
const sessionChanged = failure => failure?.status === 401 || ["ACCOUNT_SCOPE_CHANGED", "account_changed"].includes(failure?.code);
const withSessionLock = callback => navigator.locks?.request
    ? navigator.locks.request("myowndex-account-session", callback) : callback();

async function finishPendingLogout(scope) {
    try { await accountRequest("logout", { method: "POST", body: {}, accountId: scope }); }
    catch (failure) { if (!accountLogoutComplete(failure)) return false; }
    // A delayed response must not clear a newer account's pending sign-out.
    if (readStorage(PENDING_LOGOUT_KEY, null) === scope) writeStorage(PENDING_LOGOUT_KEY, null);
    return true;
}

export async function captureAccountDocument(scope, previous = null) {
    // Finish the field's scheduled save and any resolution already in progress
    // before reading the account. An open workbench stays mounted during merges.
    if (await flushLocalPokemonDiceWrites() === false) {
        throw new Error("Não foi possível salvar a última edição dos dados locais. O campo atual e a cópia anterior da conta foram preservados.");
    }
    // A roll can be waiting for the cross-tab lock when an account merge freezes
    // the editor. Finish that receipt before reading or replacing its history.
    await flushLocalRollHistoryWrites();
    const values = await Promise.all([
        loadTeamsDurable({ scope }),
        ...Object.entries(ACCOUNT_RESOURCE_KEYS).slice(1).map(([resource, key]) => resource === "rollHistory"
            ? readLocalRollHistoryDurable({ scope }) : readDurableStorage(key, null, { scope })),
    ]);
    const [boxes, favorites, preferences, appearance, localAdventure, dicePreferences, diceRoom, generatorDraft, rollHistory] = values;
    return recordAccountChanges(previous, {
        boxes,
        dex: { favorites: Array.isArray(favorites) ? favorites : [] },
        preferences: { ...preferences, appearance },
        localAdventure,
        localTools: { dicePreferences, diceRoom, generatorDraft, rollHistory },
    });
}

async function storeDocument(document, scope) {
    const values = [
        [ACCOUNT_RESOURCE_KEYS.boxes, { schema: TEAM_SCHEMA_VERSION, savedAt: Date.now(), teams: document.boxes }],
        [ACCOUNT_RESOURCE_KEYS.dex, document.dex.favorites],
        [ACCOUNT_RESOURCE_KEYS.preferences, { experienceMode: document.preferences.experienceMode, view: document.preferences.view }],
        [ACCOUNT_RESOURCE_KEYS.appearance, document.preferences.appearance],
        [ACCOUNT_RESOURCE_KEYS.localAdventure, document.localAdventure],
        [ACCOUNT_RESOURCE_KEYS.dicePreferences, document.localTools.dicePreferences],
        [ACCOUNT_RESOURCE_KEYS.diceRoom, document.localTools.diceRoom],
        [ACCOUNT_RESOURCE_KEYS.generatorDraft, document.localTools.generatorDraft],
    ];
    for (const [key, value] of values) {
        if (!await writeDurableStorage(key, value, { scope })) throw new Error("O dispositivo não permitiu salvar a cópia da conta. A cópia anterior foi preservada.");
    }
    if (!await writeLocalRollHistoryDurable(document.localTools.rollHistory, { scope })) {
        throw new Error("Não foi possível guardar o histórico da conta neste dispositivo. A cópia da nuvem foi preservada.");
    }
    // Local adventures have no shared-room secret and can resume on another device.
    if (document.localAdventure && !readStorage("myowndex_live_room_v1", null, { scope })) {
        writeStorage("myowndex_live_room_v1", {
            code: "LOCAL", key: "local", role: "narrator", playerId: null,
            displayName: document.localAdventure.events?.[0]?.author || "Narrador", inviteCode: "", local: true,
        }, { scope });
    }
}

/** Cookie authentication; durable, isolated account copies and bounded cloud work. */
export default function useAccountSync({ onBeforeSwitch = async () => {}, onDocument = () => {} } = {}) {
    const [account, setAccount] = useState(null);
    const [ready, setReady] = useState(false);
    const [status, setStatus] = useState("local");
    const [error, setError] = useState("");
    const [updatedAt, setUpdatedAt] = useState(null);
    const [guestAvailable, setGuestAvailable] = useState(false);
    const [recoveryCount, setRecoveryCount] = useState(0);
    const [deviceCopyCount, setDeviceCopyCount] = useState(0);
    const callbacks = useRef({ onBeforeSwitch, onDocument });
    const identity = useRef(null);
    const record = useRef(emptyRecord());
    const transition = useRef(0);
    const switching = useRef(false);
    const applying = useRef(false);
    const running = useRef(null);
    const persistence = useRef(Promise.resolve());
    const alive = useRef(true);
    const retryAfter = useRef(0);
    const failureCount = useRef(0);

    useEffect(() => { callbacks.current = { onBeforeSwitch, onDocument }; }, [onBeforeSwitch, onDocument]);

    const announce = useCallback(reason => {
        writeStorage(NOTICE_KEY, { reason, accountId: identity.current?.id || null, at: Date.now() });
    }, []);

    const saveRecord = useCallback(async (value, scope, generation) => {
        if (generation !== transition.current) return false;
        const clearedAt = await readDurableStorage(RECOVERY_CLEAR_KEY, 0, { scope });
        if (generation !== transition.current) return false;
        value = { ...value, recoveries: value.recoveries.filter(copy => !clearedAt || copy.recoveredAt > clearedAt) };
        const saved = await writeDurableStorage(ACCOUNT_SYNC_KEY, { schema: 1, ...value }, { scope });
        if (generation !== transition.current) return false;
        if (!saved) throw new Error("O dispositivo não permitiu salvar a cópia local. Seus dados anteriores foram preservados.");
        record.current = value;
        setRecoveryCount(value.recoveries.length);
        return true;
    }, []);

    const capture = useCallback(async () => {
        const scope = identity.current?.id;
        const generation = transition.current;
        if (!scope || switching.current) return record.current.document;
        const document = await captureAccountDocument(scope, record.current.document);
        if (generation !== transition.current) return record.current.document;
        if (!accountValuesEqual(document, record.current.document)) await saveRecord({ ...record.current, document }, scope, generation);
        return document;
    }, [saveRecord]);

    const queueCapture = useCallback(() => {
        const next = persistence.current.catch(() => {}).then(capture);
        persistence.current = next;
        return next;
    }, [capture]);

    const applyMerged = useCallback(async (merged, scope, generation, remote, revision, time) => {
        if (generation !== transition.current) return false;
        applying.current = true;
        window.dispatchEvent(new CustomEvent("myowndex:account-apply-start", { detail: { scope } }));
        try {
            await callbacks.current.onBeforeSwitch();
            if (generation !== transition.current) return false;
            // Re-capture after the editor's pending save finishes, preserving edits
            // made while the remote request was in flight.
            const fresh = await captureAccountDocument(scope, record.current.document);
            if (generation !== transition.current) return false;
            const final = remote ? mergeAccountDocuments(fresh, remote, record.current.base) : { document: merged.document, recoveries: merged.recoveries || [] };
            const contentChanged = !accountContentEqual(fresh, final.document);
            if (contentChanged) await storeDocument(final.document, scope);
            if (generation !== transition.current) return false;
            await saveRecord({
                ...record.current, document: final.document,
                ...(remote ? { base: normalizeAccountDocument(remote), revision, updatedAt: time } : {}),
                recoveries: [...record.current.recoveries, ...final.recoveries].slice(-5),
            }, scope, generation);
            if (contentChanged) callbacks.current.onDocument(final.document, {
                scope, reason: remote ? "remote" : "import", previousDocument: fresh,
            });
            return true;
        } finally {
            applying.current = false;
            window.dispatchEvent(new CustomEvent("myowndex:account-apply-end", { detail: { scope } }));
        }
    }, [saveRecord]);

    const leaveAccount = useCallback(async ({ preserve = true } = {}) => {
        if (preserve) {
            await callbacks.current.onBeforeSwitch();
            await queueCapture();
        }
        const generation = ++transition.current;
        switching.current = true;
        flushSync(() => setReady(false));
        setStorageScope(null);
        identity.current = null;
        record.current = emptyRecord();
        writeStorage(IDENTITY_KEY, null);
        setAccount(null);
        setStatus("local");
        setUpdatedAt(null);
        setRecoveryCount(0);
        callbacks.current.onDocument(null, { scope: null });
        switching.current = false;
        if (generation === transition.current) setReady(true);
    }, [queueCapture]);

    const syncNow = useCallback(() => {
        if (running.current) return running.current;
        const scope = identity.current?.id;
        const generation = transition.current;
        if (!scope || switching.current) return Promise.resolve(false);
        if (!browserOnline()) { setStatus("offline"); return Promise.resolve(false); }
        setStatus("syncing");
        const work = (async () => {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                await callbacks.current.onBeforeSwitch();
                await queueCapture();
                if (generation !== transition.current) return false;
                const remote = await accountRequest("data", { accountId: scope });
                if (generation !== transition.current || getStorageScope() !== scope) return false;
                await queueCapture();
                const cloud = normalizeAccountDocument(remote.document);
                const merged = mergeAccountDocuments(record.current.document, cloud, record.current.base);
                if (!accountValuesEqual(merged.document, record.current.document)) {
                    await applyMerged(merged, scope, generation, cloud, remote.revision, remote.updatedAt);
                } else await saveRecord({ ...record.current, base: cloud, revision: remote.revision, updatedAt: remote.updatedAt }, scope, generation);
                if (generation !== transition.current) return false;
                await queueCapture();
                const sent = record.current.document;
                if (accountValuesEqual(sent, cloud) && remote.document) {
                    setStatus("saved"); setError(""); setUpdatedAt(remote.updatedAt); failureCount.current = 0; retryAfter.current = 0;
                    return true;
                }
                if (accountDocumentBytes(sent) > (remote.limitBytes || ACCOUNT_DOCUMENT_LIMIT)) {
                    throw new Error("Esta conta excedeu o espaço de sincronização. As Boxes continuam neste dispositivo; exporte uma cópia pelo PC e reduza o conteúdo antes de sincronizar.");
                }
                try {
                    const saved = await accountRequest("data", { method: "PUT", accountId: scope, body: { document: sent, expectedRevision: remote.revision } });
                    if (generation !== transition.current || getStorageScope() !== scope) return false;
                    await queueCapture();
                    await saveRecord({ ...record.current, base: normalizeAccountDocument(saved.document), revision: saved.revision, updatedAt: saved.updatedAt }, scope, generation);
                    const complete = accountValuesEqual(record.current.document, normalizeAccountDocument(saved.document));
                    setStatus(complete ? "saved" : "pending"); setError(""); setUpdatedAt(saved.updatedAt);
                    failureCount.current = 0; retryAfter.current = 0;
                    if (complete) return true;
                } catch (failure) {
                    if (failure.status === 409 && failure.data?.conflict) continue;
                    throw failure;
                }
            }
            setStatus("pending");
            return false;
        })().catch(async failure => {
            if (generation !== transition.current || !alive.current) return false;
            failureCount.current = Math.min(failureCount.current + 1, 5);
            retryAfter.current = Date.now() + Math.min(300000, 15000 * 2 ** failureCount.current);
            setStatus(browserOnline() ? "error" : "offline");
            setError(failure.message || "A conta não respondeu. Sua cópia local foi preservada.");
            if (sessionChanged(failure)) {
                await leaveAccount();
                setError("A sessão terminou. Entre novamente para continuar a sincronização; a cópia desta conta foi preservada.");
            }
            return false;
        }).finally(() => { if (running.current === work) running.current = null; });
        running.current = work;
        return work;
    }, [applyMerged, leaveAccount, queueCapture, saveRecord]);

    const enterAccount = useCallback(async next => {
        await callbacks.current.onBeforeSwitch();
        const generation = ++transition.current;
        switching.current = true;
        flushSync(() => setReady(false));
        setStorageScope(next.id);
        identity.current = next;
        applying.current = true;
        try {
            const cached = await readDurableStorage(ACCOUNT_SYNC_KEY, null, { scope: next.id });
            if (generation !== transition.current) return;
            record.current = cached?.schema === 1 ? { ...emptyRecord(), ...cached, document: normalizeAccountDocument(cached.document), base: cached.base ? normalizeAccountDocument(cached.base) : null } : emptyRecord();
            const local = await captureAccountDocument(next.id, record.current.document);
            if (generation !== transition.current) return;
            record.current.document = local;
            let remote = null;
            let failed = null;
            if (browserOnline()) {
                try { remote = await accountRequest("data", { accountId: next.id }); }
                catch (failure) { failed = failure; }
            }
            if (generation !== transition.current) return;
            if (sessionChanged(failed)) throw failed;
            const merged = remote ? mergeAccountDocuments(local, remote.document, record.current.base) : { document: local, recoveries: [] };
            await storeDocument(merged.document, next.id);
            if (generation !== transition.current) return;
            await saveRecord({ ...record.current, document: merged.document,
                ...(remote ? { base: normalizeAccountDocument(remote.document), revision: remote.revision, updatedAt: remote.updatedAt } : {}),
                recoveries: [...record.current.recoveries, ...merged.recoveries].slice(-5),
            }, next.id, generation);
            writeStorage(IDENTITY_KEY, next);
            setAccount(next);
            setUpdatedAt(remote?.updatedAt || cached?.updatedAt || null);
            setStatus(failed ? "error" : !browserOnline() ? "offline" : accountValuesEqual(merged.document, normalizeAccountDocument(remote?.document)) && remote?.document ? "saved" : "pending");
            setError(failed?.message || "");
            callbacks.current.onDocument(merged.document, { scope: next.id, reason: "account" });
        } catch (failure) {
            if (generation === transition.current) {
                setStorageScope(null); identity.current = null; setAccount(null);
                throw failure;
            }
        } finally {
            if (generation === transition.current) { applying.current = false; switching.current = false; setReady(true); }
        }
    }, [saveRecord]);

    useEffect(() => {
        alive.current = true;
        let cancelled = false;
        const initialize = async () => {
            const guest = await captureAccountDocument(null);
            if (cancelled) return;
            setGuestAvailable(hasGuestData(guest));
            const pendingLogout = readStorage(PENDING_LOGOUT_KEY, null);
            if (pendingLogout) {
                await withSessionLock(() => finishPendingLogout(pendingLogout));
                setStorageScope(null); setReady(true); return;
            }
            try {
                if (!browserOnline()) {
                    const cached = validIdentity(readStorage(IDENTITY_KEY, null));
                    if (cached) { await enterAccount(cached); return; }
                }
                const session = await accountRequest("session");
                if (cancelled) return;
                if (session.account) { await enterAccount(session.account); return; }
                writeStorage(IDENTITY_KEY, null);
            } catch (failure) {
                if (cancelled) return;
                setError(failure.message || "A conta está indisponível. Continue com seus dados neste dispositivo.");
            }
            if (!cancelled) { setStorageScope(null); setReady(true); }
        };
        void initialize();
        return () => { cancelled = true; alive.current = false; transition.current += 1; };
    }, [enterAccount]);

    useEffect(() => {
        if (!account || !ready) return undefined;
        let timer = window.setTimeout(() => void syncNow(), 500);
        const dirty = event => {
            if (applying.current || switching.current || event.detail?.scope !== account.id || !RESOURCE_KEYS.has(event.detail?.key)) return;
            setStatus(browserOnline() ? "pending" : "offline");
            void queueCapture().catch(failure => { setStatus("error"); setError(failure.message); });
            window.clearTimeout(timer);
            timer = window.setTimeout(() => void syncNow(), 1000);
        };
        const refresh = () => { if (document.visibilityState !== "hidden" && Date.now() >= retryAfter.current) void syncNow(); };
        const reconnect = () => { retryAfter.current = 0; refresh(); };
        const offline = () => setStatus("offline");
        const interval = window.setInterval(refresh, 30000);
        const pagehide = () => { void queueCapture(); };
        const beforeUnload = event => {
            if (!accountValuesEqual(record.current.document, record.current.base)) event.preventDefault();
        };
        window.addEventListener("myowndex:storage", dirty);
        window.addEventListener("online", reconnect);
        window.addEventListener("offline", offline);
        window.addEventListener("pagehide", pagehide);
        window.addEventListener("beforeunload", beforeUnload);
        document.addEventListener("visibilitychange", reconnect);
        return () => {
            window.clearTimeout(timer); window.clearInterval(interval);
            window.removeEventListener("myowndex:storage", dirty); window.removeEventListener("online", reconnect);
            window.removeEventListener("offline", offline); window.removeEventListener("pagehide", pagehide);
            window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("visibilitychange", reconnect);
        };
    }, [account, queueCapture, ready, syncNow]);

    useEffect(() => {
        const notice = event => {
            const clearedScope = storageScopeForClearedCopy(event.key);
            if (clearedScope !== undefined && event.newValue && clearedScope === (identity.current?.id || null)) {
                // The explicit erase is already committed by another tab. Flushes
                // from this old workspace must never reconstruct its device copy.
                void leaveAccount({ preserve: false });
                return;
            }
            if (event.key !== NOTICE_KEY || !event.newValue) return;
            let value;
            try { value = JSON.parse(event.newValue); } catch { return; }
            if (value.accountId === identity.current?.id && value.reason !== "logout") return;
            void (async () => {
                await leaveAccount();
                if (value.reason === "logout" || readStorage(PENDING_LOGOUT_KEY, null)) return;
                try {
                    const session = await accountRequest("session");
                    if (session.account) await enterAccount(session.account);
                } catch { setError("A sessão mudou em outra aba. Entre novamente para acessar sua conta."); }
            })();
        };
        const recoveryCleared = event => {
            if (event.detail?.scope !== identity.current?.id || event.detail?.key !== RECOVERY_CLEAR_KEY) return;
            const clearedAt = Number(event.detail.value) || 0;
            record.current.recoveries = record.current.recoveries.filter(copy => copy.recoveredAt > clearedAt);
            setRecoveryCount(record.current.recoveries.length);
        };
        const otherRecoveryCleared = event => {
            const scope = identity.current?.id;
            if (scope && event.key === `myowndex_account:${encodeURIComponent(scope)}:${RECOVERY_CLEAR_KEY}`) {
                recoveryCleared({ detail: { scope, key: RECOVERY_CLEAR_KEY, value: Number(event.newValue) || 0 } });
            }
        };
        window.addEventListener("storage", notice);
        window.addEventListener("storage", otherRecoveryCleared);
        window.addEventListener("myowndex:storage", recoveryCleared);
        return () => {
            window.removeEventListener("storage", notice);
            window.removeEventListener("storage", otherRecoveryCleared);
            window.removeEventListener("myowndex:storage", recoveryCleared);
        };
    }, [enterAccount, leaveAccount]);

    useEffect(() => {
        const changed = event => {
            const scope = identity.current?.id;
            if (!scope || switching.current || applying.current || !event.newValue || !event.key?.startsWith(`myowndex_account:${encodeURIComponent(scope)}:`) || !event.key.endsWith(ACCOUNT_SYNC_KEY)) return;
            let incoming;
            try { incoming = JSON.parse(event.newValue); } catch { return; }
            if (!incoming?.document || accountValuesEqual(incoming.document, record.current.document)) return;
            const generation = transition.current;
            const merged = mergeAccountDocuments(record.current.document, incoming.document, record.current.base);
            void applyMerged(merged, scope, generation, incoming.document, incoming.revision || 0, incoming.updatedAt || null)
                .then(() => { if (generation === transition.current) setStatus("pending"); })
                .catch(failure => { if (generation === transition.current) { setStatus("error"); setError(failure.message); } });
        };
        window.addEventListener("storage", changed);
        return () => window.removeEventListener("storage", changed);
    }, [applyMerged]);

    useEffect(() => {
        if (account) return undefined;
        let stopped = false;
        const changed = event => {
            if (event.detail?.scope != null || !RESOURCE_KEYS.has(event.detail?.key)) return;
            void captureAccountDocument(null).then(guest => {
                if (!stopped) setGuestAvailable(hasGuestData(guest));
            });
        };
        window.addEventListener("myowndex:storage", changed);
        return () => { stopped = true; window.removeEventListener("myowndex:storage", changed); };
    }, [account]);

    const authenticate = useCallback(async (action, input) => withSessionLock(async () => {
        await callbacks.current.onBeforeSwitch();
        await queueCapture();
        switching.current = true;
        flushSync(() => setReady(false));
        try {
            const result = await accountRequest(action, { method: "POST", body: input });
            writeStorage(PENDING_LOGOUT_KEY, null);
            await enterAccount(result.account);
            announce("login");
            return result;
        } finally { switching.current = false; setReady(true); }
    }), [announce, enterAccount, queueCapture]);

    const refreshDeviceCopies = useCallback(async () => {
        const active = identity.current?.id || validIdentity(readStorage(IDENTITY_KEY, null))?.id;
        const copies = (await listStoredAccountScopes()).filter(scope => scope !== active);
        setDeviceCopyCount(copies.length);
        return copies;
    }, []);

    const logout = useCallback(async ({ removeCopy = false } = {}) => withSessionLock(async () => {
        const scope = identity.current?.id;
        if (!scope) return;
        await callbacks.current.onBeforeSwitch();
        await queueCapture();
        if (browserOnline()) await syncNow();
        if (identity.current?.id !== scope) return;
        writeStorage(PENDING_LOGOUT_KEY, scope);
        await leaveAccount();
        announce("logout");
        if (removeCopy) await clearStorageScope(scope);
        await refreshDeviceCopies();
        if (browserOnline()) {
            await finishPendingLogout(scope);
        }
    }), [announce, leaveAccount, queueCapture, refreshDeviceCopies, syncNow]);

    useEffect(() => {
        const finish = () => {
            const scope = readStorage(PENDING_LOGOUT_KEY, null);
            if (scope) void withSessionLock(async () => {
                await finishPendingLogout(scope);
            });
        };
        window.addEventListener("online", finish);
        return () => window.removeEventListener("online", finish);
    }, []);

    const importGuest = useCallback(async () => {
        const scope = identity.current?.id;
        const generation = transition.current;
        if (!scope) return false;
        await callbacks.current.onBeforeSwitch();
        await queueCapture();
        const guest = await captureAccountDocument(null);
        if (generation !== transition.current) return false;
        const document = importGuestDocument(record.current.document, guest);
        await applyMerged({ document, recoveries: [] }, scope, generation, null);
        setStatus("pending");
        void syncNow();
        return true;
    }, [applyMerged, queueCapture, syncNow]);

    const changePassword = useCallback(async input => withSessionLock(async () => {
        const scope = identity.current?.id;
        if (!scope) throw new Error("Entre na conta antes de alterar a senha.");
        const result = await accountRequest("password", { method: "POST", body: input, accountId: scope });
        announce("password");
        return result;
    }), [announce]);

    const exportAccount = useCallback(async () => {
        await callbacks.current.onBeforeSwitch();
        await queueCapture();
        return { schema: 1, exportedAt: new Date().toISOString(), account: identity.current?.username || "", document: record.current.document, recoveredAdventures: record.current.recoveries };
    }, [queueCapture]);

    const clearPreviousCopies = useCallback(async () => {
        const scope = identity.current?.id;
        const generation = transition.current;
        if (!scope) throw new Error("Entre na conta antes de apagar as cópias anteriores.");
        if (!await syncNow() || generation !== transition.current) throw new Error("Atualize a conta antes de apagar as cópias anteriores.");
        await accountRequest("data", { method: "DELETE", accountId: scope, body: { expectedRevision: record.current.revision } });
        if (generation !== transition.current) return false;
        if (!await writeDurableStorage(RECOVERY_CLEAR_KEY, Date.now() + 1, { scope })) {
            throw new Error("A cópia anterior da nuvem foi apagada, mas o dispositivo não permitiu apagar as cópias recuperadas. Tente novamente.");
        }
        await saveRecord({ ...record.current, recoveries: [] }, scope, generation);
        return true;
    }, [saveRecord, syncNow]);

    const clearGuestCopy = useCallback(async () => {
        if (!identity.current?.id) throw new Error("Entre em uma conta antes de apagar a cópia usada sem conta.");
        await clearStorageScope(null);
        setGuestAvailable(false);
        return true;
    }, []);

    const clearInactiveCopies = useCallback(async () => withSessionLock(async () => {
        const copies = await refreshDeviceCopies();
        for (const scope of copies) await clearStorageScope(scope);
        await refreshDeviceCopies();
        return true;
    }), [refreshDeviceCopies]);

    const deleteAccount = useCallback(async (password, { removeCopy = false } = {}) => withSessionLock(async () => {
        const scope = identity.current?.id;
        if (!scope) throw new Error("Entre na conta antes de removê-la.");
        await callbacks.current.onBeforeSwitch();
        await queueCapture();
        await accountRequest("delete", { method: "POST", body: { password }, accountId: scope });
        await leaveAccount({ preserve: false });
        announce("logout");
        if (removeCopy) await clearStorageScope(scope);
        await refreshDeviceCopies();
    }), [announce, leaveAccount, queueCapture, refreshDeviceCopies]);

    return {
        account, ready, scope: account?.id || null, status, error, updatedAt, guestAvailable, recoveryCount, deviceCopyCount,
        signup: input => authenticate("signup", input), login: input => authenticate("login", input),
        recover: input => authenticate("recover", input), changePassword, logout, importGuest, syncNow, exportAccount, deleteAccount,
        refreshDeviceCopies, clearPreviousCopies, clearGuestCopy, clearInactiveCopies,
    };
}
