import { secureRandomId } from "./random.js";

const DATABASE_NAME = "myowndex-player-data-v1";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const ACCOUNT_PREFIX = "myowndex_account:";
const COPY_EPOCH_PREFIX = "myowndex_copy_epoch:";
const PROTECTED_KEYS = new Set([
    "myowndex_rotom_v4", "myowndex_rotom_v3", "myowndex_preferences_v1",
    "myowndex_dex_favorites_v1", "myowndex_appearance_v1", "myowndex_local_room_v1",
    "myowndex_live_room_v1", "myowndex_account_sync_v1", "myowndex_account_recovery_clear_v1", "myowndex_local_dice_preferences_v1",
    "myowndex_audio_preferences_v1", "myowndex_call_preferences_v1", "myowndex_guide_roll_history_v1", "myowndex_generator_v1", "myowndex_local_dice_room_v1", "myowndex_local_roll_history_v3",
]);
let activeScope = null;
let databasePromise = null;
let databaseOwner = null;
let durableQueue = Promise.resolve();
const confirmedMirrors = new Map();
let latestWriteTime = 0;
let epochOwner = null;
const scopeEpochs = new Map();
const copyEpochKey = scope => `${COPY_EPOCH_PREFIX}${encodeURIComponent(scope || "guest")}`;
export const storageScopeForClearedCopy = key => {
    if (!key?.startsWith(COPY_EPOCH_PREFIX)) return undefined;
    try {
        const scope = decodeURIComponent(key.slice(COPY_EPOCH_PREFIX.length));
        return scope === "guest" ? null : scope;
    } catch { return undefined; }
};
const currentCopyEpoch = scope => {
    try { return browserStorage()?.getItem(copyEpochKey(scope)) || "0"; } catch { return "0"; }
};
const knownCopyEpoch = scope => {
    const owner = browserStorage();
    if (owner !== epochOwner) { epochOwner = owner; scopeEpochs.clear(); }
    if (!scopeEpochs.has(scope)) scopeEpochs.set(scope, currentCopyEpoch(scope));
    return scopeEpochs.get(scope);
};
const scopeWritable = (scope, epoch = knownCopyEpoch(scope)) => epoch === currentCopyEpoch(scope);
const nextWriteTime = () => latestWriteTime = Math.max(Date.now(), latestWriteTime + 1);
const fingerprint = text => {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    return `${text.length}:${hash >>> 0}`;
};
const metadataKey = key => `myowndex_snapshot_meta:${key}`;
const localFingerprint = key => {
    try {
        const storage = browserStorage();
        if (!storage) return undefined;
        const raw = storage.getItem(key);
        return raw == null ? null : fingerprint(raw);
    } catch { return undefined; }
};

export const isProtectedStorageKey = key => PROTECTED_KEYS.has(key) || String(key).startsWith("myowndex_local_roll_v2:");
export const getStorageScope = () => activeScope;
export const setStorageScope = scope => {
    activeScope = typeof scope === "string" && scope ? scope : null;
    knownCopyEpoch(activeScope);
    scopeEpochs.set(activeScope, currentCopyEpoch(activeScope));
    confirmedMirrors.clear();
    return activeScope;
};
const effectiveScope = options => Object.prototype.hasOwnProperty.call(options || {}, "scope") ? options.scope : activeScope;
export const resolveStorageKey = (key, options = {}) => {
    const scope = effectiveScope(options);
    return scope && isProtectedStorageKey(key) ? `${ACCOUNT_PREFIX}${encodeURIComponent(String(scope))}:${key}` : key;
};
const browserStorage = () => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };
const notify = (key, scope, value, removed = false) => {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new window.CustomEvent("myowndex:storage", { detail: { key, scope, value, removed } }));
};
const readLocal = (storageKey, fallback) => {
    if (confirmedMirrors.has(storageKey)) return confirmedMirrors.get(storageKey).value;
    try {
        const raw = browserStorage()?.getItem(storageKey);
        return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
};
const writeLocal = (storageKey, value, writtenAt) => {
    try {
        const storage = browserStorage();
        if (!storage) return false;
        const serialized = JSON.stringify(value);
        if (serialized === undefined) return false;
        storage.setItem(storageKey, serialized);
        if (writtenAt) {
            try { storage.setItem(metadataKey(storageKey), JSON.stringify({ writtenAt, fingerprint: fingerprint(serialized) })); } catch { /* The already committed local value remains valid. */ }
        }
        return true;
    } catch { return false; }
};
const removeLocal = storageKey => {
    try {
        const storage = browserStorage();
        if (!storage) return false;
        storage.removeItem(storageKey);
        try { storage.removeItem(metadataKey(storageKey)); } catch {}
        confirmedMirrors.delete(storageKey);
        return true;
    } catch { return false; }
};

const openDatabase = () => {
    let owner;
    try { owner = typeof window === "undefined" ? null : window.indexedDB; } catch { return Promise.resolve(null); }
    if (!owner) return Promise.resolve(null);
    if (databaseOwner !== owner) { databaseOwner = owner; databasePromise = null; }
    if (!databasePromise) {
        databasePromise = new Promise(resolve => {
            let request;
            try { request = owner.open(DATABASE_NAME, DATABASE_VERSION); } catch { resolve(null); return; }
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) request.result.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
            };
            request.onerror = () => { databasePromise = null; resolve(null); };
            request.onblocked = () => { databasePromise = null; resolve(null); };
            request.onsuccess = () => {
                const database = request.result;
                database.onversionchange = () => { database.close(); databasePromise = null; };
                resolve(database);
            };
        });
    }
    return databasePromise;
};

const snapshotOperation = async (key, operation, value, writtenAt, mirrorFingerprint) => {
    const database = await openDatabase();
    if (!database) return { ok: false, value: undefined };
    return new Promise(resolve => {
        let transaction;
        let request;
        try {
            transaction = database.transaction(SNAPSHOT_STORE, operation === "read" ? "readonly" : "readwrite");
            const store = transaction.objectStore(SNAPSHOT_STORE);
            request = operation === "read" ? store.get(key) : store.put({
                key, value, deleted: operation === "remove", writtenAt,
                ...(mirrorFingerprint === undefined ? {} : { localFingerprint: mirrorFingerprint }),
            });
        } catch { resolve({ ok: false, value: undefined }); return; }
        transaction.oncomplete = () => resolve({ ok: true, value: operation === "read" ? request.result : undefined });
        transaction.onabort = transaction.onerror = () => resolve({ ok: false, value: undefined });
    });
};
const queueSnapshot = (key, operation, value, writtenAt = nextWriteTime(), scope, epoch) => {
    // Capture the actual local mirror before waiting for the transaction. Its
    // metadata can fail independently when localStorage is nearly full.
    const mirrorFingerprint = operation === "read" ? undefined : localFingerprint(key);
    // A single ordered queue makes an older tab's pending save unable to finish
    // after a newer save from this document. IndexedDB commits atomically.
    const task = durableQueue.then(() => epoch !== undefined && !scopeWritable(scope, epoch)
        ? { ok: false, value: undefined } : snapshotOperation(key, operation, value, writtenAt, mirrorFingerprint)).catch(() => ({ ok: false, value: undefined }));
    durableQueue = task.then(() => undefined);
    return task;
};

export const readStorage = (key, fallback = null, options = {}) => readLocal(resolveStorageKey(key, options), fallback);
export const writeStorage = (key, value, options = {}) => {
    const scope = effectiveScope(options);
    const epoch = isProtectedStorageKey(key) ? knownCopyEpoch(scope) : undefined;
    if (epoch !== undefined && !scopeWritable(scope, epoch)) return false;
    const storageKey = resolveStorageKey(key, { scope });
    const writtenAt = nextWriteTime();
    const saved = writeLocal(storageKey, value, writtenAt);
    if (saved && scope === activeScope && PROTECTED_KEYS.has(key)) confirmedMirrors.set(storageKey, { value, writtenAt });
    if (saved) notify(key, scope, value);
    if (isProtectedStorageKey(key)) {
        void queueSnapshot(storageKey, "write", value, writtenAt, scope, epoch).then(result => {
            if (result.ok && !saved && scopeWritable(scope, epoch)) {
                if (scope === activeScope && PROTECTED_KEYS.has(key)) confirmedMirrors.set(storageKey, { value, writtenAt });
                notify(key, scope, value);
            }
        });
    }
    return saved;
};
export const removeStorage = (key, options = {}) => {
    const scope = effectiveScope(options);
    const epoch = isProtectedStorageKey(key) ? knownCopyEpoch(scope) : undefined;
    if (epoch !== undefined && !scopeWritable(scope, epoch)) return false;
    const storageKey = resolveStorageKey(key, { scope });
    const writtenAt = nextWriteTime();
    const removed = removeLocal(storageKey);
    if (removed) notify(key, scope, undefined, true);
    if (isProtectedStorageKey(key)) {
        void queueSnapshot(storageKey, "remove", undefined, writtenAt, scope, epoch).then(result => {
            if (result.ok && scopeWritable(scope, epoch)) {
                if ((confirmedMirrors.get(storageKey)?.writtenAt || 0) <= writtenAt) confirmedMirrors.delete(storageKey);
                if (!removed) notify(key, scope, undefined, true);
            }
        });
    }
    return removed;
};

const scopedCopyKey = (key, scope) => scope
    ? key.startsWith(`${ACCOUNT_PREFIX}${encodeURIComponent(scope)}:`)
    : isProtectedStorageKey(key);
const localStorageKeys = () => {
    const storage = browserStorage();
    if (!storage) return [];
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
};
const databaseKeys = async () => {
    await durableQueue;
    const database = await openDatabase();
    if (!database) return [];
    return new Promise((resolve, reject) => {
        try {
            const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
            const request = transaction.objectStore(SNAPSHOT_STORE).getAllKeys();
            transaction.oncomplete = () => resolve(request.result || []);
            transaction.onabort = transaction.onerror = () => reject(new Error("Não foi possível conferir as cópias deste dispositivo."));
        } catch { reject(new Error("Não foi possível conferir as cópias deste dispositivo.")); }
    });
};

/** Account namespaces can be forgotten independently of guest data and caches. */
export async function listStoredAccountScopes() {
    const keys = [...localStorageKeys(), ...await databaseKeys()];
    return [...new Set(keys.filter(key => key.startsWith(ACCOUNT_PREFIX)).map(key => {
        const encoded = key.slice(ACCOUNT_PREFIX.length).split(":")[0];
        try { return decodeURIComponent(encoded); } catch { return ""; }
    }).filter(Boolean))];
}

/** Explicitly remove a device copy; stale tabs cannot save it back afterward. */
export async function clearStorageScope(scope = null) {
    const storage = browserStorage();
    if (!storage) throw new Error("O dispositivo não permitiu apagar esta cópia. Seus dados continuam preservados.");
    const epoch = `${nextWriteTime()}:${secureRandomId("copy")}`;
    // Write the invalidation before waiting for pending transactions. Every tab
    // checks it before saving; only a deliberate re-entry accepts the new epoch.
    try { storage.setItem(copyEpochKey(scope), epoch); }
    catch { throw new Error("O dispositivo não permitiu apagar esta cópia. Libere espaço e tente novamente."); }
    if (typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
        window.dispatchEvent(new window.CustomEvent("myowndex:copy-cleared", { detail: { scope } }));
    }
    const task = durableQueue.then(async () => {
        const database = await openDatabase();
        if (database) await new Promise((resolve, reject) => {
            try {
                const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
                const store = transaction.objectStore(SNAPSHOT_STORE);
                const request = store.getAllKeys();
                request.onsuccess = () => request.result.filter(key => scopedCopyKey(key, scope)).forEach(key => store.delete(key));
                transaction.oncomplete = resolve;
                transaction.onabort = transaction.onerror = () => reject(new Error("Não foi possível apagar a cópia completa. Tente novamente."));
            } catch { reject(new Error("Não foi possível apagar a cópia completa. Tente novamente.")); }
        });
        localStorageKeys().filter(key => scopedCopyKey(key, scope)).forEach(key => removeLocal(key));
        localStorageKeys().filter(key => key.startsWith("myowndex_snapshot_meta:") && scopedCopyKey(key.slice("myowndex_snapshot_meta:".length), scope)).forEach(key => storage.removeItem(key));
        for (const key of confirmedMirrors.keys()) if (scopedCopyKey(key, scope)) confirmedMirrors.delete(key);
        return true;
    });
    durableQueue = task.catch(() => undefined);
    return task;
}

export const readDurableStorage = async (key, fallback = null, options = {}) => {
    const scope = effectiveScope(options);
    const storageKey = resolveStorageKey(key, { scope });
    const snapshot = await queueSnapshot(storageKey, "read");
    const missing = Symbol("missing");
    const record = snapshot.ok ? snapshot.value : undefined;
    if (!record) return readLocal(storageKey, fallback);
    const stored = record.deleted ? fallback : record.value;
    const restore = value => {
        if (record.deleted) confirmedMirrors.delete(storageKey);
        else if (scope === activeScope && PROTECTED_KEYS.has(key)) confirmedMirrors.set(storageKey, { value, writtenAt: record.writtenAt });
        return value;
    };
    const mirror = confirmedMirrors.get(storageKey);
    if (mirror && mirror.writtenAt >= record.writtenAt) return mirror.value;
    let localMetadata = null;
    let raw = null;
    let local = missing;
    try {
        const storage = browserStorage();
        raw = storage?.getItem(storageKey);
        if (raw != null) local = JSON.parse(raw);
        try { localMetadata = JSON.parse(storage?.getItem(metadataKey(storageKey)) || "null"); } catch {}
    } catch {}
    if (local === missing) return restore(stored);
    const currentFingerprint = fingerprint(raw);
    if (localMetadata?.fingerprint === currentFingerprint && Number.isFinite(localMetadata.writtenAt)) {
        return localMetadata.writtenAt > record.writtenAt ? local : restore(stored);
    }
    if (Object.prototype.hasOwnProperty.call(record, "localFingerprint")) {
        // An unchanged mirror predates this commit, even when savedAt values
        // tie. A changed unversioned mirror can be a later local-only save.
        return record.localFingerprint === currentFingerprint ? restore(stored) : local;
    }
    // Older snapshots lack a mirror fingerprint. Only a strictly newer Box
    // timestamp proves that the local value supersedes the confirmed commit.
    if (Number.isFinite(local?.savedAt) && Number.isFinite(stored?.savedAt) && local.savedAt > stored.savedAt) return local;
    return restore(stored);
};
export const writeDurableStorage = async (key, value, options = {}) => {
    const scope = effectiveScope(options);
    const epoch = knownCopyEpoch(scope);
    if (isProtectedStorageKey(key) && !scopeWritable(scope, epoch)) return false;
    const storageKey = resolveStorageKey(key, { scope });
    // The small synchronous mirror starts before the first await, including on
    // pagehide. A full localStorage leaves its previous snapshot intact.
    const writtenAt = nextWriteTime();
    const localSaved = writeLocal(storageKey, value, writtenAt);
    const durable = await queueSnapshot(storageKey, "write", value, writtenAt, scope, isProtectedStorageKey(key) ? epoch : undefined);
    if (isProtectedStorageKey(key) && !scopeWritable(scope, epoch)) return false;
    const saved = localSaved || durable.ok;
    if (saved) {
        if (scope === activeScope && PROTECTED_KEYS.has(key)) {
            const previous = confirmedMirrors.get(storageKey);
            if (!previous || previous.writtenAt <= writtenAt) confirmedMirrors.set(storageKey, { value, writtenAt });
        }
        notify(key, scope, value);
    }
    return saved;
};
export const removeDurableStorage = async (key, options = {}) => {
    const scope = effectiveScope(options);
    const epoch = knownCopyEpoch(scope);
    if (isProtectedStorageKey(key) && !scopeWritable(scope, epoch)) return false;
    const storageKey = resolveStorageKey(key, { scope });
    const writtenAt = nextWriteTime();
    const localRemoved = removeLocal(storageKey);
    const durable = await queueSnapshot(storageKey, "remove", undefined, writtenAt, scope, isProtectedStorageKey(key) ? epoch : undefined);
    if (isProtectedStorageKey(key) && !scopeWritable(scope, epoch)) return false;
    const removed = localRemoved || durable.ok;
    if (removed) {
        if ((confirmedMirrors.get(storageKey)?.writtenAt || 0) <= writtenAt) confirmedMirrors.delete(storageKey);
        notify(key, scope, undefined, true);
    }
    return removed;
};

// Legacy receipt storage enumerates keys. Its facade sees only the active
// account (or the original unprefixed guest keys), so histories stay isolated.
export const getScopedBrowserStorage = (options = {}) => {
    const storage = browserStorage();
    if (!storage) return null;
    const scope = effectiveScope(options);
    const prefix = scope ? `${ACCOUNT_PREFIX}${encodeURIComponent(scope)}:` : "";
    const visibleKeys = () => {
        const keys = [];
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (!key) continue;
            if (scope && key.startsWith(prefix)) keys.push(key.slice(prefix.length));
            if (!scope && !key.startsWith(ACCOUNT_PREFIX)) keys.push(key);
        }
        return keys;
    };
    return {
        get length() { return visibleKeys().length; },
        key: index => visibleKeys()[index] ?? null,
        getItem: key => storage.getItem(resolveStorageKey(key, { scope })),
        setItem: (key, value) => {
            if (isProtectedStorageKey(key) && !scopeWritable(scope)) throw new Error("Esta cópia foi apagada em outra aba. Reabra o MyOwnDex para continuar.");
            storage.setItem(resolveStorageKey(key, { scope }), value);
            let parsed;
            try { parsed = JSON.parse(value); } catch { parsed = value; }
            notify(key, scope, parsed);
        },
        removeItem: key => {
            if (isProtectedStorageKey(key) && !scopeWritable(scope)) throw new Error("Esta cópia foi apagada em outra aba. Reabra o MyOwnDex para continuar.");
            storage.removeItem(resolveStorageKey(key, { scope })); notify(key, scope, undefined, true);
        },
    };
};

// Backward-compatible aliases for external imports.
export const readStorageJson = readStorage;
export const writeStorageJson = writeStorage;
export const removeStorageKey = removeStorage;
