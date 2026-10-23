import React, { useEffect, useId, useRef, useState } from "react";
import { fetchCached, formatName } from "../../core/mechanics.js";
import { getCurrentMoveReference } from "../../core/championsMoves.js";
import PokemonSprite from "./PokemonSprite.jsx";
import RoomSelect from "./RoomSelect.jsx";

export const roundActionLabel = token => token?.declaredMove ? formatName(token.declaredMove) : ({
    other: "Aguardar / passar a vez",
    swap: "Trocar Pokémon",
    improvise: "Improvisar / interagir",
    flee: "Tentar fugir",
}[token?.declaredAction || "other"] || "Aguardar / passar a vez");

function RoundChoice({ token, onDeclareMove, canDeclare, disabled, onPending }) {
    const labelId = useId();
    const [choice, setChoice] = useState(token.declaredMove || `action:${token.declaredAction || "other"}`);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const alive = useRef(true);
    const locked = useRef(false);
    const failedChoices = useRef(new Set());
    useEffect(() => { setChoice(token.declaredMove || `action:${token.declaredAction || "other"}`); }, [token.declaredMove, token.declaredAction]);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; onPending(token.id, false); };
    }, [token.id, onPending]);

    const choose = async name => {
        if (locked.current || disabled || !canDeclare) return;
        locked.current = true;
        setChoice(name); setPending(true); setError(""); onPending(token.id, true);
        try {
            const actionKind = name.startsWith("action:") ? name.slice(7) : "";
            const move = actionKind ? { actionKind } : name ? getCurrentMoveReference(await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`, { forceRefresh: failedChoices.current.has(name) })) : null;
            if (name && !move) { failedChoices.current.add(name); throw new Error("Não foi possível abrir este movimento. Escolha novamente."); }
            failedChoices.current.delete(name);
            if (!alive.current) return;
            await onDeclareMove(token.id, move);
        } catch (cause) {
            if (alive.current) { setChoice(token.declaredMove || `action:${token.declaredAction || "other"}`); setError(cause.message || "Não foi possível confirmar esta escolha."); }
        } finally {
            locked.current = false;
            onPending(token.id, false);
            if (alive.current) setPending(false);
        }
    };

    return <li className="round-choice">
        <div className="round-choice-identity"><PokemonSprite src={token.sprite} pokemonId={token.speciesId} alt="" /><strong id={labelId}>{token.name}</strong><span className="round-choice-priority" aria-label={`Prioridade ${token.priority > 0 ? "+" : ""}${token.priority || 0}`}>{token.priority > 0 ? "+" : ""}{token.priority || 0}</span></div>
        {canDeclare ? <RoomSelect aria-label={`Escolha de ${token.name} nesta rodada`} value={choice} disabled={disabled || pending} onChange={event => void choose(event.target.value)}>
            <option value="action:other">Aguardar / passar a vez</option>
            <option value="action:swap">Trocar Pokémon</option>
            <option value="action:improvise">Improvisar / interagir</option>
            <option value="action:flee">Tentar fugir</option>
            {[...new Set(token.moves.filter(Boolean))].map(name => <option key={name} value={name}>{formatName(name)}</option>)}
        </RoomSelect> : <p className="round-choice-readonly">{roundActionLabel(token)}</p>}
        {canDeclare && !pending && choice === "action:other" && <small>Aguardar não exige teste nem produz efeito. Para tentar algo, escolha Improvisar.</small>}
        {canDeclare && !pending && choice === "action:improvise" && <small>Combine objetivo, risco e teste com o Narrador. Registre a ideia nas notas da cena.</small>}
        {canDeclare && !pending && choice === "action:flee" && <small>Fuga: disputa de Velocidade contra quem impede a saída. Empate favorece quem bloqueia.</small>}
        {pending && <small role="status">Confirmando…</small>}
        {error && <p className="round-choice-error" role="alert">{error}</p>}
    </li>;
}

export default function RoundDeclarations({ tokens, onDeclareMove, canDeclareToken, disabled, onPending }) {
    return <ul className="round-declarations" aria-label="Escolhas para a próxima iniciativa">{tokens.map(token => <RoundChoice key={token.id} token={token} onDeclareMove={onDeclareMove} canDeclare={canDeclareToken(token)} disabled={disabled} onPending={onPending} />)}</ul>;
}
