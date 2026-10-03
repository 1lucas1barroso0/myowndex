// Normalize and serialize once after a burst of edits. A synchronous save still
// finishes inside pagehide; durable asynchronous saves keep their pending edit
// until the database transaction reports success.
export function createScheduledSave({ save, onResult = () => {}, delayMs = 300, maxWaitMs = 900 } = {}) {
    if (typeof save !== "function") throw new TypeError("A save function is required.");
    let pendingValue;
    let pending = false;
    let revision = 0;
    let delayTimer = null;
    let maximumTimer = null;
    const inFlight = new Map();

    const cancel = () => {
        clearTimeout(delayTimer);
        clearTimeout(maximumTimer);
        delayTimer = null;
        maximumTimer = null;
    };
    const complete = (savingRevision, saved) => {
        if (revision === savingRevision) {
            if (saved) { pending = false; pendingValue = undefined; }
            onResult(saved);
        }
        return saved;
    };
    const flush = () => {
        cancel();
        if (!pending) return inFlight.size ? Promise.all(inFlight.values()).then(results => results.every(Boolean)) : true;
        const savingRevision = revision;
        if (inFlight.has(savingRevision)) return inFlight.get(savingRevision);
        let result;
        try { result = save(pendingValue); } catch { return complete(savingRevision, false); }
        if (!result || typeof result.then !== "function") return complete(savingRevision, result !== false);
        const task = Promise.resolve(result).then(
            saved => complete(savingRevision, saved !== false),
            () => complete(savingRevision, false),
        ).finally(() => { inFlight.delete(savingRevision); });
        inFlight.set(savingRevision, task);
        return task;
    };
    const schedule = value => {
        pendingValue = value;
        pending = true;
        revision += 1;
        clearTimeout(delayTimer);
        delayTimer = setTimeout(flush, Math.max(0, delayMs));
        if (maximumTimer === null) maximumTimer = setTimeout(flush, Math.max(0, maxWaitMs));
    };

    // Cancel stops timers without discarding a failed or not-yet-saved edit.
    return { schedule, flush, cancel, hasPending: () => pending || inFlight.size > 0 };
}
