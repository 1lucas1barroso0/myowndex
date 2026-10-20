import { useEffect } from "react";
import { revealInScrollArea } from "../../core/scroll.js";

// Mobile keyboards and system overlays may resize/pan the visual viewport
// without resizing 100dvh. Pin the game to the visible rectangle at normal zoom.
export default function useAppViewport() {
    useEffect(() => {
        const root = document.documentElement, viewport = window.visualViewport;
        let frame = 0, revealFrame = 0, previousHeight = 0;
        root.dataset.appViewport = "";
        const measure = () => {
            frame = 0;
            const normalZoom = !viewport || Math.abs(viewport.scale - 1) < .02;
            const height = normalZoom ? viewport?.height || window.innerHeight : window.innerHeight;
            const top = normalZoom ? Math.max(0, viewport?.offsetTop || 0) : 0;
            if (!Number.isFinite(height) || height <= 0) return;
            for (const [key, value] of [["--app-viewport-height", `${height}px`], ["--app-viewport-top", `${top}px`]]) {
                if (root.style.getPropertyValue(key) !== value) root.style.setProperty(key, value);
            }
            if (normalZoom && previousHeight && height < previousHeight) {
                cancelAnimationFrame(revealFrame);
                revealFrame = requestAnimationFrame(() => {
                    const active = document.activeElement;
                    if (active?.matches("input,select,textarea")) revealInScrollArea(active);
                });
            }
            previousHeight = height;
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
        measure();
        viewport?.addEventListener("resize", schedule);
        viewport?.addEventListener("scroll", schedule);
        window.addEventListener("resize", schedule);
        window.addEventListener("pageshow", schedule);
        document.addEventListener("visibilitychange", schedule);
        return () => {
            cancelAnimationFrame(frame); cancelAnimationFrame(revealFrame);
            viewport?.removeEventListener("resize", schedule);
            viewport?.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            window.removeEventListener("pageshow", schedule);
            document.removeEventListener("visibilitychange", schedule);
            delete root.dataset.appViewport;
            root.style.removeProperty("--app-viewport-height"); root.style.removeProperty("--app-viewport-top");
        };
    }, []);
}
