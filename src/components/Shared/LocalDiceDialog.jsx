import React, { useEffect, useId, useRef } from "react";
import LocalDicePanel from "./LocalDicePanel.jsx";
import PokemonCompanion from "./PokemonCompanion.jsx";

/** Native modal keeps keyboard focus inside, makes the background inert and
 * remains in the app's theme inheritance even when presented in the top layer. */
export default function LocalDiceDialog({ open, onClose, ...diceProps }) {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const titleId = useId();
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        if (!open) {
            if (dialog.open) dialog.close();
            return undefined;
        }
        const previous = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        if (!dialog.open) dialog.showModal();
        const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
        return () => {
            window.cancelAnimationFrame(frame);
            if (dialog.open) dialog.close();
            document.body.style.overflow = overflow;
            previous?.focus?.();
        };
    }, [open]);

    return <dialog
        ref={dialogRef}
        className="local-dice-dialog"
        aria-labelledby={titleId}
        onCancel={event => {
            event.preventDefault();
            if (!document.querySelector('[role="alertdialog"][aria-modal="true"]')) onCloseRef.current?.();
        }}
        onClick={event => {
            if (event.target !== event.currentTarget) return;
            const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
            if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onCloseRef.current?.();
        }}
    >
        {open && <>
            <header className="local-dice-dialog-heading">
                <div><h2 id={titleId}>Dados</h2></div>
                <PokemonCompanion place="dice" className="companion-compact" eager />
                <button ref={closeRef} type="button" className="local-dice-dialog-close" aria-label="Fechar dados" onClick={() => onCloseRef.current?.()}>×</button>
            </header>
            <div className="local-dice-dialog-content"><LocalDicePanel {...diceProps} context="central" compact showHeading={false} /></div>
        </>}
    </dialog>;
}
