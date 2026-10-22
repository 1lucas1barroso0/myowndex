import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import useFrameState from "./useFrameState.js";

const KEY = "myowndex_header_curtain_v2";
const LABELS = ["Só o puxador", "Marca", "Navegação", "Ferramentas", "Tudo"];
const ROWS = [".app-brand-cluster", ".app-nav", ".app-tool-actions", ".app-preferences"];
const LAST = LABELS.length - 1;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const restoredLevel = () => {
    try {
        const saved = localStorage.getItem(KEY);
        if (/^[0-4]$/.test(saved || "")) return Number(saved);
        const previous = localStorage.getItem("myowndex_header_curtain_v1");
        if (/^[0-3]$/.test(previous || "")) return Number(previous) + 1;
    } catch { /* The optional preference may be unavailable. */ }
    return LAST;
};

export default function useHeaderCurtain(ready = true) {
    const [mobile, setMobile] = useState(false);
    const [preferredLevel, setLevel] = useState(restoredLevel);
    const [availableLevel, setAvailableLevel] = useState(LAST);
    const level = Math.min(preferredLevel, availableLevel);
    const [marks, setMarks] = useState([]);
    const gesture = useRef(null);
    const ignoreClick = useRef(false);
    const [dragHeight, setDragHeight, previewDragHeight] = useFrameState(null);
    const cancel = useCallback(() => {
        const active = gesture.current;
        gesture.current = null;
        setDragHeight(null);
        if (!active) return;
        ignoreClick.current = true;
        if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
    }, [setDragHeight]);
    const choose = useCallback(value => {
        const next = clamp(value, 0, LAST);
        cancel();
        setLevel(next);
        try { localStorage.setItem(KEY, String(next)); } catch { /* Optional preference. */ }
    }, [cancel]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(KEY);
            if (/^[0-4]$/.test(saved || "")) setLevel(Number(saved));
            else {
                const previous = localStorage.getItem("myowndex_header_curtain_v1");
                if (/^[0-3]$/.test(previous || "")) {
                    const migrated = Number(previous) + 1;
                    setLevel(migrated);
                    localStorage.setItem(KEY, String(migrated));
                }
            }
        } catch { /* Fine without storage. */ }
    }, []);

    // Measure the first visible header before paint, so a restored collapsed
    // curtain cannot briefly expose desktop rows on a narrow screen.
    useLayoutEffect(() => {
        if (!ready) return;
        const header = document.querySelector(".app-header-curtain");
        if (!header) return;
        const measure = () => {
            const narrow = matchMedia("(max-width:700px)").matches;
            setMobile(narrow);
            if (!narrow) return;
            const top = header.getBoundingClientRect().top;
            const handleHeight = header.querySelector(".app-curtain-grip")?.getBoundingClientRect().height || 44;
            const stops = [Math.ceil(handleHeight + 4), ...ROWS.map(selector => {
                const element = header.querySelector(selector);
                return element ? Math.ceil(element.getBoundingClientRect().bottom - top + handleHeight + 4) : 0;
            })];
            for (let i = 1; i < stops.length; i++) stops[i] = Math.max(stops[i], stops[i-1] + 1);
            const viewport = window.visualViewport;
            const height = viewport && Math.abs(viewport.scale - 1) < .02 ? viewport.height : window.innerHeight;
            const footerHeight = document.querySelector(".device-footer")?.getBoundingClientRect().height || 56;
            const editing = document.activeElement?.matches('textarea,select,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])');
            // Leave room for a labeled field while editing. Outside editing,
            // keep all menu rows available whenever they fit with a touch target.
            const budget = height - footerHeight - (editing ? 160 : 44);
            setAvailableLevel(Math.max(0, stops.findLastIndex(stop => stop <= budget)));
            setMarks(old => old.length === stops.length && old.every((height, i) => height === stops[i]) ? old : stops);
        };
        const remeasure = () => { cancel(); measure(); };
        measure();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        [...header.querySelectorAll(ROWS.join(",")), document.querySelector(".device-footer")].filter(Boolean).forEach(element => observer?.observe(element));
        window.visualViewport?.addEventListener("resize", remeasure);
        window.addEventListener("resize", remeasure);
        window.addEventListener("orientationchange", remeasure);
        window.addEventListener("blur", cancel);
        return () => {
            observer?.disconnect();
            window.visualViewport?.removeEventListener("resize", remeasure);
            window.removeEventListener("resize", remeasure);
            window.removeEventListener("orientationchange", remeasure);
            window.removeEventListener("blur", cancel);
        };
    }, [ready, cancel]);

    // Keep hidden rows out of focus, including browsers with partial React inert support.
    useEffect(() => {
        const header = document.querySelector(".app-header-curtain");
        if (!header) return;
        ROWS.forEach((selector, index) => {
            const element = header.querySelector(selector);
            if (mobile && level <= index) element?.setAttribute("inert", "");
            else element?.removeAttribute("inert");
        });
    }, [mobile, level]);

    const down = useCallback(event => {
        if (!mobile || marks.length !== LABELS.length || gesture.current || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        ignoreClick.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.currentTarget, height: marks[level], level, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [mobile, marks, level]);

    const move = useCallback(event => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        const delta = event.clientY - active.y;
        if (!active.moved && Math.hypot(event.clientX - active.x, delta) < 9) return;
        event.preventDefault();
        active.moved = true;
        previewDragHeight(clamp(active.height + delta, marks[0], marks[availableLevel]));
    }, [marks, availableLevel, previewDragHeight]);

    const finish = useCallback((event, canceled = false) => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        cancel();
        if (canceled) return;
        if (!active.moved) { ignoreClick.current = false; return; }
        const delta = event.clientY - active.y;
        const position = clamp(active.height + delta, marks[0], marks[availableLevel]);
        let nearest = marks.slice(0, availableLevel + 1).reduce((best, height, index) =>
            Math.abs(height - position) < Math.abs(marks[best] - position) ? index : best, 0);
        if (nearest === active.level && Math.abs(delta) >= 28)
            nearest = clamp(active.level + (delta > 0 ? 1 : -1), 0, availableLevel);
        choose(nearest);
    }, [marks, choose, cancel, availableLevel]);

    const click = useCallback(event => {
        if (event.detail !== 0 && ignoreClick.current) { ignoreClick.current = false; return; }
        choose(level >= availableLevel ? 0 : level + 1);
    }, [level, choose, availableLevel]);

    const keyDown = useCallback(event => {
        const values = { ArrowUp: Math.max(0, level - 1), ArrowDown: Math.min(availableLevel, level + 1), Home: 0, End: availableLevel };
        if (Object.hasOwn(values, event.key)) { event.preventDefault(); choose(values[event.key]); }
        else if (event.key === "Escape") { event.preventDefault(); cancel(); }
    }, [choose, level, cancel, availableLevel]);

    return {
        mobile, level, dragging: dragHeight !== null,
        height: mobile ? (dragHeight ?? marks[level]) : undefined,
        label: `Ajustar cortina do topo: ${LABELS[level]}. Arraste ou use as setas.`,
        down, move, finish, click, keyDown,
    };
}
