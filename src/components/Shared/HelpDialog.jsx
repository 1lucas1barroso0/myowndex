import React, { useEffect, useId, useRef } from "react";

export default function HelpDialog({ open, title, onClose, returnFocusRef, children }) {
    const dialog = useRef(null);
    const close = useRef(null);
    const titleId = useId();
    useEffect(() => {
        if (!open) return;
        const element = dialog.current;
        const previous = returnFocusRef?.current || document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        element.showModal();
        close.current?.focus({ preventScroll: true });
        return () => {
            element.close();
            document.body.style.overflow = overflow;
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, [open, returnFocusRef]);
    return <dialog ref={dialog} className="app-help-dialog" aria-labelledby={titleId}
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
        }}
        onKeyDown={event => {
            if (event.key !== "Tab") return;
            const buttons = [...event.currentTarget.querySelectorAll("button:not(:disabled),a[href]")];
            const first = buttons[0], last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
        }}>
        <header><h2 id={titleId}>{title}</h2><button ref={close} type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
        <div className="app-help-dialog-content">{children}<button type="button" className="app-help-acknowledge" onClick={onClose}>Entendi</button></div>
    </dialog>;
}
