import React, { useEffect, useId, useRef, useState } from "react";
import { fetchCached, formatName } from "../../core/mechanics.js";
import { getCurrentMoveReference } from "../../core/championsMoves.js";
import PokemonSprite from "./PokemonSprite.jsx";
import RoomSelect from "./RoomSelect.jsx";

function RoundChoice({ token, onDeclareMove, canDeclare, disabled, onPending }) {
    const labelId = useId();
    const [choice, setChoice] = useState(token.declaredMove || "");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const alive = useRef(true);
    const locked = useRef(false);
    const failedChoices = useRef(new Set());
    useEffect(() => { setChoice(token.declaredMove || ""); }, [token.declaredMove]);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; onPending(token.id, false); };
    }, [token.id, onPending]);

    const choose = async name => {
        if (locked.current || disabled || !canDeclare) return;
        locked.current = true;
        setChoice(name); setPending(true); setError(""); onPending(token.id, true);
        try {
            const move = name ? getCurrentMoveReference(await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`, { forceRefresh: failedChoices.current.has(name) })) : null;
            if (name && !move) { failedChoices.current.add(name); throw new Error("Não foi possível abrir este movimento. Escolha novamente."); }
            failedChoices.current.delete(name);
            if (!alive.current) return;
            await onDeclareMove(token.id, move);
        } catch (cause) {
            if (alive.current) { setChoice(token.declaredMove || ""); setError(cause.message || "Não foi possível confirmar esta escolha."); }
        } finally {
            locked.current = false;
            onPending(token.id, false);
            if (alive.current) setPending(false);
        }
    };

    return <li className="round-choice">
        <div className="round-choice-identity"><PokemonSprite src={token.sprite} pokemonId={token.speciesId} alt="" /><strong id={labelId}>{token.name}</strong><span className="round-choice-priority" aria-label={`Prioridade ${token.priority > 0 ? "+" : ""}${token.priority || 0}`}>{token.priority > 0 ? "+" : ""}{token.priority || 0}</span></div>
        {canDeclare ? <RoomSelect aria-label={`Movimento de ${token.name} nesta rodada`} value={choice} disabled={disabled || pending} onChange={event => void choose(event.target.value)}>
            <option value="">Outra ação</option>
            {[...new Set(token.moves.filter(Boolean))].map(name => <option key={name} value={name}>{formatName(name)}</option>)}
        </RoomSelect> : <p className="round-choice-readonly">{token.declaredMove ? formatName(token.declaredMove) : "Outra ação"}</p>}
        {pending && <small role="status">Confirmando…</small>}
        {error && <p className="round-choice-error" role="alert">{error}</p>}
    </li>;
}

export default function RoundDeclarations({ tokens, onDeclareMove, canDeclareToken, disabled, onPending }) {
    return <ul className="round-declarations" aria-label="Escolhas para a próxima iniciativa">{tokens.map(token => <RoundChoice key={token.id} token={token} onDeclareMove={onDeclareMove} canDeclare={canDeclareToken(token)} disabled={disabled} onPending={onPending} />)}</ul>;
}
