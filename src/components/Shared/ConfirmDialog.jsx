import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const RETURN_FOCUS_TARGETS = 'button,input,select,textarea,summary,a[href],[tabindex="0"]';
const canReturnFocus = element => {
    const closedDetails = element.closest('details:not([open])');
    return element.tabIndex >= 0 && element.getClientRects().length
        && getComputedStyle(element).visibility !== "hidden"
        && !element.closest("[hidden],[inert]") && !element.matches(':disabled,[aria-disabled="true"]')
        && (!closedDetails || closedDetails.querySelector(":scope > summary")?.contains(element));
};

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    tone = "danger",
    busy = false,
    onConfirm,
    onCancel
}) {
    const cancelRef = useRef(null);
    const dialogRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    const onCancelRef = useRef(onCancel);
    const busyRef = useRef(busy);

    useEffect(() => {
        onCancelRef.current = onCancel;
        busyRef.current = busy;
    }, [onCancel, busy]);

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        const returnContexts = [];
        for (let context = previous?.parentElement; context; context = context.parentElement) returnContexts.push(context);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const overlay = dialogRef.current?.parentElement;
        const siblings = [...overlay?.parentElement?.children || []]
            .filter(element => element instanceof HTMLElement && element !== overlay
                && !["SCRIPT", "STYLE", "LINK"].includes(element.tagName))
            .map(element => [element, element.inert]);
        for (const [element] of siblings) element.inert = true;
        const handleKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!busyRef.current) onCancelRef.current();
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
        const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus({ preventScroll: true }));
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            window.cancelAnimationFrame(focusFrame);
            document.body.style.overflow = previousOverflow;
            for (const [element, original] of siblings) element.inert = original;
            if (previous?.isConnected && canReturnFocus(previous)) previous.focus({ preventScroll: true });
            else {
                // Deleting a partner or Box can remove the original button.
                // Continue in its closest surviving list or editor instead.
                for (const context of returnContexts) {
                    if (!context.isConnected) continue;
                    const next = [...context.querySelectorAll(RETURN_FOCUS_TARGETS)].find(canReturnFocus);
                    if (next) { next.focus({ preventScroll: true }); break; }
                }
            }
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;
    return createPortal(
        <div className="confirm-dialog-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && onCancel()}>
            <section ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-busy={busy} aria-labelledby={titleId} aria-describedby={descriptionId} className={`game-shell confirm-dialog-shell ${tone === "danger" ? "is-danger" : "is-info"}`}>
                <div className="confirm-dialog-symbol" aria-hidden="true">
                    {tone === "danger" ? "!" : "?"}
                </div>
                <h2 id={titleId}>{title}</h2>
                <p id={descriptionId}>{description}</p>
                <div className="confirm-dialog-actions">
                    <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="room-secondary-button">{cancelLabel}</button>
                    <button type="button" disabled={busy} onClick={onConfirm} className="room-primary-button confirm-dialog-confirm">{confirmLabel}</button>
                </div>
            </section>
        </div>,
        [...document.querySelectorAll("dialog[open]")].at(-1) || document.body
    );
}
