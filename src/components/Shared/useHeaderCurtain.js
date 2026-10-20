import { useCallback, useEffect, useState } from "react";

const KEY = "myowndex_header_curtain_v1";
const LABELS = ["Marca", "Navegação", "Ferramentas", "Tudo"];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function useHeaderCurtain() {
    const [mobile, setMobile] = useState(false);
    const [level, setLevel] = useState(3);
    const [marks, setMarks] = useState([]);
    const [gesture, setGesture] = useState(null);
    const [dragHeight, setDragHeight] = useState(null);
    const [ignoreClick, setIgnoreClick] = useState(false);
    const choose = useCallback(value => {
        const next = clamp(value, 0, 3);
        setLevel(next); setDragHeight(null); setGesture(null);
        try { localStorage.setItem(KEY, String(next)); } catch { /* Optional preference. */ }
    }, []);

    useEffect(() => {
        try { const saved = localStorage.getItem(KEY); if (/^[0-3]$/.test(saved || "")) setLevel(Number(saved)); } catch { /* Fine without storage. */ }
    }, []);

    useEffect(() => {
        const header = document.querySelector(".app-header-curtain");
        if (!header) return;
        const measure = () => {
            const narrow = matchMedia("(max-width:700px)").matches;
            setMobile(narrow);
            if (!narrow) return;
            const top = header.getBoundingClientRect().top;
            const selectors = [".app-brand-cluster", ".app-nav", ".app-tool-actions", ".app-preferences"];
            const stops = selectors.map(selector => {
                const element = header.querySelector(selector);
                return element ? Math.ceil(element.getBoundingClientRect().bottom - top + 36) : 0;
            });
            for (let i = 1; i < stops.length; i++) stops[i] = Math.max(stops[i], stops[i-1] + 1);
            setMarks(old => old.length === 4 && old.every((height, i) => height === stops[i]) ? old : stops);
        };
        measure();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        [header, ...header.querySelectorAll(".app-brand-cluster, .app-nav, .app-tool-actions, .app-preferences")].forEach(element => observer?.observe(element));
        window.addEventListener("resize", measure);
        window.addEventListener("orientationchange", measure);
        return () => { observer?.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("orientationchange", measure); };
    }, []);

    const down = useCallback(event => {
        if (!mobile || marks.length !== 4 || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        setGesture({ id: event.pointerId, y: event.clientY, height: marks[level], level, delta: 0, moved: false });
        setIgnoreClick(false);
        event.currentTarget.setPointerCapture(event.pointerId);
    }, [mobile, marks, level]);

    const move = useCallback(event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const delta = event.clientY - gesture.y;
        if (!gesture.moved && Math.abs(delta) < 9) return;
        event.preventDefault();
        setGesture(old => old && old.id === event.pointerId ? { ...old, delta, moved: true } : old);
        setDragHeight(clamp(gesture.height + delta, marks[0], marks[3]));
    }, [gesture, marks]);

    const finish = useCallback((event, canceled = false) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (canceled || !gesture.moved) { setGesture(null); setDragHeight(null); return; }
        setIgnoreClick(true);
        const position = clamp(gesture.height + gesture.delta, marks[0], marks[3]);
        let nearest = marks.reduce((best, height, index) =>
            Math.abs(height - position) < Math.abs(marks[best] - position) ? index : best, 0);
        if (nearest === gesture.level && Math.abs(gesture.delta) >= 28)
            nearest = clamp(gesture.level + (gesture.delta > 0 ? 1 : -1), 0, 3);
        choose(nearest);
    }, [gesture, marks, choose]);

    const click = useCallback(() => {
        if (ignoreClick) { setIgnoreClick(false); return; }
        choose(level === 3 ? 0 : level + 1);
    }, [ignoreClick, level, choose]);

    const keyDown = useCallback(event => {
        const values = { ArrowUp: Math.max(0, level - 1), ArrowDown: Math.min(3, level + 1), Home: 0, End: 3 };
        if (Object.hasOwn(values, event.key)) { event.preventDefault(); choose(values[event.key]); }
    }, [choose, level]);

    return {
        mobile, level, dragging: dragHeight !== null,
        height: mobile ? (dragHeight ?? marks[level]) : undefined,
        label: `Ajustar cortina do topo: ${LABELS[level]}. Arraste ou use as setas.`,
        down, move, finish, click, keyDown,
    };
}
