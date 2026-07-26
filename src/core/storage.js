export const readStorage = (key, fallback = null) => {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};
export const writeStorage = (key, value) => {
    if (typeof window === "undefined") return false;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
};
export const removeStorage = key => {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(key); } catch {}
};

// Backward-compatible aliases for any external imports.
export const readStorageJson = readStorage;
export const writeStorageJson = writeStorage;
export const removeStorageKey = removeStorage;
