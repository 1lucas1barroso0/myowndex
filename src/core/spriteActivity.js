/** One observer and one preference subscription serve the whole collection.
 * Offscreen or background-tab sprites release their animated image source;
 * the browser can stop decoding frames without an interval per Pokémon. */
export const createSpriteActivityRegistry = ({ window: browserWindow, document: browserDocument } = {}) => {
    const subscriptions = new Map();
    let observer = null;
    let modalObserver = null;
    let motionQuery = null;
    let queued = false;
    const publish = () => {
        queued = false;
        const pageVisible = !browserDocument?.hidden;
        const reducedMotion = Boolean(motionQuery?.matches);
        const modals = [...(browserDocument?.querySelectorAll?.('dialog[open],[aria-modal="true"]') || [])];
        const activeModal = modals.filter(modal => !modal.closest?.("[inert],[hidden]") && Boolean(modal.getClientRects?.().length)).at(-1);
        for (const [element, subscription] of subscriptions.entries()) {
            const covered = Boolean(element.closest?.("[inert],[hidden]")) || Boolean(activeModal && !activeModal.contains(element));
            const state = { ready: true, visible: subscription.visible && pageVisible && !covered, reducedMotion };
            if (subscription.lastState?.visible === state.visible && subscription.lastState?.reducedMotion === state.reducedMotion) continue;
            subscription.lastState = state;
            for (const listener of subscription.listeners) listener(state);
        }
    };
    const schedule = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(publish);
    };
    const start = () => {
        motionQuery = browserWindow?.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
        motionQuery?.addEventListener?.("change", schedule);
        browserDocument?.addEventListener?.("visibilitychange", schedule);
        const Observer = browserWindow?.IntersectionObserver;
        if (Observer) observer = new Observer(entries => {
            for (const entry of entries) {
                const subscription = subscriptions.get(entry.target);
                if (subscription) subscription.visible = entry.isIntersecting;
            }
            schedule();
        }, { rootMargin: "0px", threshold: 0 });
        const ModalObserver = browserWindow?.MutationObserver;
        if (ModalObserver && browserDocument?.body) {
            modalObserver = new ModalObserver(schedule);
            modalObserver.observe(browserDocument.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert", "hidden", "open", "aria-modal"] });
        }
    };
    const stop = () => {
        observer?.disconnect();
        observer = null;
        modalObserver?.disconnect();
        modalObserver = null;
        motionQuery?.removeEventListener?.("change", schedule);
        browserDocument?.removeEventListener?.("visibilitychange", schedule);
        motionQuery = null;
    };
    return {
        subscribe(element, listener) {
            if (!element) return () => {};
            if (!subscriptions.size) start();
            let subscription = subscriptions.get(element);
            if (!subscription) {
                subscription = { visible: !observer, listeners: new Set(), lastState: null };
                subscriptions.set(element, subscription);
                observer?.observe(element);
            }
            subscription.listeners.add(listener);
            subscription.lastState = null;
            schedule();
            return () => {
                subscription.listeners.delete(listener);
                if (!subscription.listeners.size) {
                    observer?.unobserve(element);
                    subscriptions.delete(element);
                }
                if (!subscriptions.size) stop();
            };
        },
    };
};

let registry = null;
export const subscribeSpriteActivity = (element, listener) => {
    if (!registry && typeof window !== "undefined") registry = createSpriteActivityRegistry({ window, document });
    return registry?.subscribe(element, listener) || (() => {});
};
