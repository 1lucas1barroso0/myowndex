const PRESSURE_SAMPLE_AGE_MS = 30000;
const RESERVED_PLAYER_BYTES = 16 * 1024 * 1024;
const MAXIMUM_CACHE_RATIO = 0.8;
let sampledOwner;
let sampleExpiresAt = 0;
let sampledCapacity = null;
let pendingSample = null;
let persistenceOwner;
let persistencePromise;

const browserStorageManager = () => {
    try { return typeof window === "undefined" ? null : window.navigator?.storage; } catch { return null; }
};
export const getStorageCapacity = async ({ force = false } = {}) => {
    const storage = browserStorageManager();
    if (!storage || typeof storage.estimate !== "function") return null;
    if (sampledOwner !== storage) {
        sampledOwner = storage;
        sampledCapacity = null;
        sampleExpiresAt = 0;
        pendingSample = null;
    }
    if (!force && Date.now() < sampleExpiresAt) return sampledCapacity;
    if (pendingSample) return pendingSample;
    const task = Promise.resolve().then(() => storage.estimate()).then(estimate => {
        const usage = Number(estimate?.usage);
        const quota = Number(estimate?.quota);
        return Number.isFinite(usage) && usage >= 0 && Number.isFinite(quota) && quota > 0 ? { usage, quota, remaining: Math.max(0, quota - usage) } : null;
    }).catch(() => null);
    pendingSample = task;
    const capacity = await task;
    if (sampledOwner === storage) {
        sampledCapacity = capacity;
        sampleExpiresAt = Date.now() + PRESSURE_SAMPLE_AGE_MS;
        if (pendingSample === task) pendingSample = null;
    }
    return capacity;
};

// Optional catalogue/image caches give saved player data room to grow. This is
// a budget within the browser's finite quota, never a promise of infinite disk.
export const canWriteRegenerableCache = async (bytes = 0) => {
    const capacity = await getStorageCapacity();
    if (!capacity) return true;
    const requested = Math.max(0, Number(bytes) || 0);
    const reserve = Math.min(RESERVED_PLAYER_BYTES, capacity.quota * 0.2);
    return capacity.usage + requested < capacity.quota * MAXIMUM_CACHE_RATIO
        && capacity.remaining - requested >= reserve;
};

export const requestPersistentStorage = () => {
    const storage = browserStorageManager();
    if (!storage || typeof storage.persist !== "function") return Promise.resolve(false);
    if (persistenceOwner !== storage) {
        persistenceOwner = storage;
        persistencePromise = Promise.resolve().then(async () => {
            if (typeof storage.persisted === "function" && await storage.persisted()) return true;
            return Boolean(await storage.persist());
        }).catch(() => false);
    }
    return persistencePromise;
};
export const jsonByteSize = value => {
    try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { return Infinity; }
};
