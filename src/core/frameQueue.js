/** Latest visual preview per frame. Final actions bypass the queue and cancel it. */
export function createFrameQueue({ publish, request, cancel }) {
    let frame = null;
    let pending;
    const clear = () => {
        if (frame !== null) cancel(frame);
        frame = null;
        pending = undefined;
    };
    return {
        schedule(value) {
            pending = value;
            if (frame !== null) return;
            frame = request(() => {
                const value = pending;
                frame = null;
                pending = undefined;
                publish(value);
            });
        },
        set(value) { clear(); publish(value); },
        cancel: clear,
    };
}
