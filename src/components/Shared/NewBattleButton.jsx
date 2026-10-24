import React, { useRef, useState } from "react";
import ConfirmDialog from "./ConfirmDialog.jsx";

/** Restart only the battle records; story phase changes never do this. */
export default function NewBattleButton({ onStart, activeRound = false, disabled = false, onError, ending = false }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState("");
    const lock = useRef(false);
    const confirm = async () => {
        if (lock.current || disabled || activeRound) return;
        lock.current = true;
        setBusy(true);
        setFailure("");
        try {
            const started = await onStart();
            if (started !== false) setConfirming(false);
        } catch (error) { setFailure(error instanceof Error ? error.message : "Não foi possível começar. Tente novamente."); onError?.(error); }
        finally { lock.current = false; setBusy(false); }
    };
    return <>
        <button type="button" className="room-secondary-button" disabled={disabled || busy || activeRound}
            onClick={() => { setFailure(""); setConfirming(true); }}>{ending ? "Encerrar batalha" : "Nova batalha"}</button>
        {activeRound && <small>Termine a rodada antes de encerrar ou começar outra batalha.</small>}
        <ConfirmDialog busy={busy} open={confirming} title={ending ? "Encerrar esta batalha?" : "Começar uma nova batalha?"} tone="info"
            description={`${ending ? "A batalha termina, e as transformações e os efeitos temporários também. HP, PP, condições, XP e itens gastos continuam como estavam. Encerrar não devolve proteções nem usos de técnicas." : "A nova batalha começa na rodada 1, com novas ações e proteção contra hit kill. HP, PP, condições, Amizade, XP e itens usados ficam como estão."}${failure ? ` ${failure}` : ""}`}
            confirmLabel={busy ? "Preparando…" : ending ? "Encerrar confronto" : "Começar batalha"} onConfirm={() => void confirm()}
            onCancel={() => { if (!busy) setConfirming(false); }} />
    </>;
}
