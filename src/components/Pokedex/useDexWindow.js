import { useCallback, useEffect, useRef } from "react";
import { dexWindowSize } from "../../core/dexLayout.js";

export default function useDexWindow({ active, total, limit, setLimit }) {
    const gridRef = useRef(null);
    const moreRef = useRef(null);
    const layout = useRef({ columns: 1, rowHeight: 200, viewportHeight: 600 });
    const loadMore = useCallback(() => {
        setLimit(current => dexWindowSize({ ...layout.current, current: current + layout.current.columns * Math.max(2, Math.ceil(layout.current.viewportHeight / layout.current.rowHeight)), total }));
    }, [setLimit, total]);
    useEffect(() => {
        if (!active || !gridRef.current) return;
        const grid = gridRef.current;
        const root = grid.closest(".app-scroll-area");
        let frame;
        const measure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const card = grid.firstElementChild;
                if (!card) return;
                const style = getComputedStyle(grid);
                const columns = style.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
                layout.current = { columns, rowHeight: card.getBoundingClientRect().height + (parseFloat(style.rowGap) || 0), viewportHeight: root?.clientHeight || window.innerHeight };
                setLimit(current => dexWindowSize({ ...layout.current, current, total }));
            });
        };
        const resize = new ResizeObserver(measure);
        resize.observe(grid);
        if (root) resize.observe(root);
        window.visualViewport?.addEventListener("resize", measure);
        measure();
        return () => { cancelAnimationFrame(frame); resize.disconnect(); window.visualViewport?.removeEventListener("resize", measure); };
    }, [active, total, limit, setLimit]);
    useEffect(() => {
        if (!active || !moreRef.current || limit >= total) return;
        const button = moreRef.current;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) loadMore();
        }, { root: button.closest(".app-scroll-area"), rootMargin: "0px 0px 180px 0px" });
        observer.observe(button);
        return () => observer.disconnect();
    }, [active, limit, total, loadMore]);
    return { gridRef, moreRef, loadMore };
}
