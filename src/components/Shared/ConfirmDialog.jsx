import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    tone = "danger",
    onConfirm,
    onCancel
}) {
    const cancelRef = useRef(null);
    const dialogRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    const onCancelRef = useRef(onCancel);

    useEffect(() => {
        onCancelRef.current = onCancel;
    }, [onCancel]);

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const handleKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                onCancelRef.current();
                return;
            }
            if (event.key !== "Tab") return;
            const buttons = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled)") || []);
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (!first) {
                event.preventDefault();
                dialogRef.current?.focus();
            } else if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown, true);
        const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus());
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            window.cancelAnimationFrame(focusFrame);
            document.body.style.overflow = previousOverflow;
            previous?.focus?.();
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;
    return createPortal(
        <div className="confirm-dialog-overlay" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
            <section ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={`game-shell confirm-dialog-shell ${tone === "danger" ? "is-danger" : "is-info"}`}>
                <div className="confirm-dialog-symbol" aria-hidden="true">
                    {tone === "danger" ? "!" : "?"}
                </div>
                <h2 id={titleId}>{title}</h2>
                <p id={descriptionId}>{description}</p>
                <div className="confirm-dialog-actions">
                    <button ref={cancelRef} type="button" onClick={onCancel} className="room-secondary-button">{cancelLabel}</button>
                    <button type="button" onClick={onConfirm} className="room-primary-button confirm-dialog-confirm">{confirmLabel}</button>
                </div>
            </section>
        </div>,
        document.body
    );
}
