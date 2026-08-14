import React, { useEffect, useRef } from "react";
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

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.activeElement;
        const handleKeyDown = event => {
            if (event.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", handleKeyDown);
        window.requestAnimationFrame(() => cancelRef.current?.focus());
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previous?.focus?.();
        };
    }, [open, onCancel]);

    if (!open || typeof document === "undefined") return null;
    const confirmStyle = tone === "danger"
        ? "bg-red-500 text-white shadow-[0_4px_0_#991B1B] hover:bg-red-600"
        : "bg-blue-500 text-white shadow-[0_4px_0_#0EA5E9] hover:bg-blue-600";

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
            <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="game-shell w-full max-w-md p-5 text-center sm:p-7">
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-white text-2xl shadow-lg ${tone === "danger" ? "bg-red-500" : "bg-blue-500"}`} aria-hidden="true">
                    {tone === "danger" ? "!" : "?"}
                </div>
                <h2 id="confirm-dialog-title" className="mt-4 text-xl font-black text-slate-800">{title}</h2>
                <p id="confirm-dialog-description" className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                    <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-slate-400">{cancelLabel}</button>
                    <button type="button" onClick={onConfirm} className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${confirmStyle}`}>{confirmLabel}</button>
                </div>
            </section>
        </div>,
        document.body
    );
}
