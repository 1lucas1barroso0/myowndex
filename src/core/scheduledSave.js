// Keep expensive normalization/serialization out of every input keystroke.
// Saving remains synchronous so pagehide can commit before the page leaves.
export function createScheduledSave({ save, onResult = () => {}, delayMs = 300, maxWaitMs = 900 } = {}) {
    if (typeof save !== "function") throw new TypeError("A save function is required.");
    let pendingValue;
    let pending = false;
    let revision = 0;
    let delayTimer = null;
    let maximumTimer = null;

    const cancel = () => {
        clearTimeout(delayTimer);
        clearTimeout(maximumTimer);
        delayTimer = null;
        maximumTimer = null;
    };

    const flush = () => {
        cancel();
        if (!pending) return true;
        const savingRevision = revision;
        let saved = false;
        try { saved = save(pendingValue) !== false; } catch { /* The last persisted snapshot remains intact. */ }
        if (saved && revision === savingRevision) {
            pending = false;
            pendingValue = undefined;
        }
        onResult(saved);
        return saved;
    };

    const schedule = value => {
        pendingValue = value;
        pending = true;
        revision += 1;
        clearTimeout(delayTimer);
        delayTimer = setTimeout(flush, Math.max(0, delayMs));
        if (maximumTimer === null) maximumTimer = setTimeout(flush, Math.max(0, maxWaitMs));
    };

    // Cancel stops timers, but never discards a failed or not-yet-saved edit.
    // Its owner calls flush on pagehide, visibilitychange and effect cleanup.
    return { schedule, flush, cancel };
}
