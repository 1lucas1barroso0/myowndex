import React, { useCallback, useId, useRef, useState } from "react";
import PokemonSprite from "./PokemonSprite.jsx";
import GameIcon from "./GameIcon.jsx";
import { formatName } from "../../core/mechanics.js";
import RoundDeclarations from "./RoundDeclarations.jsx";

/** The same round controls in Adventures and the practice field.
 * This component only presents the snapshot; the existing engines resolve it. */
export default function TurnOrder({ snapshot, onSelect, onRoll, onAdvance, onDeclareMove, canDeclareToken, canControl = true, busy = false, local = false, onChoosePokemon }) {
    const titleId = useId();
    const pendingChoices = useRef(new Set());
    const [preparing, setPreparing] = useState(false);
    const choicePending = useCallback((id, pending) => {
        if (pending) pendingChoices.current.add(id); else pendingChoices.current.delete(id);
        setPreparing(pendingChoices.current.size > 0);
    }, []);
    const order = snapshot.initiative.map((id, index) => ({ token: snapshot.tokens.find(token => token.id === id), index })).filter(entry => entry.token);
    const active = order.find(entry => entry.index === snapshot.turnIndex)?.token;
    const participants = snapshot.tokens.filter(token => !token.hidden && !token.captured && token.currentHp > 0);
    const canRoll = participants.length > 0;
    const lastTurn = snapshot.turnIndex >= snapshot.initiative.length - 1;
    const Heading = local ? "h4" : "h3";

    return <section className={`turn-order ${local ? "room-tool local-pokemon-initiative" : "room-section room-initiative"}`} aria-labelledby={titleId}>
        <header className="turn-order-heading local-field-turn-heading">
            <Heading id={titleId}>Iniciativa</Heading>
            <span className="turn-order-round local-field-round">Rodada <b>{snapshot.round}</b></span>
        </header>
        {order.length > 0 ? <>
            <p className="sr-only" role="status">{active ? `Turno de ${active.name}. Rodada ${snapshot.round}.` : `Rodada ${snapshot.round}.`}</p>
            <ol className="turn-order-list local-field-turn-list" aria-label="Ordem da rodada">
                {order.map(({ token, index }) => <li key={token.id} aria-current={index === snapshot.turnIndex ? "step" : undefined} data-played={index < snapshot.turnIndex || undefined}>
                    <button type="button" onClick={() => onSelect?.(token.id)} aria-label={`Selecionar ${token.name}, ${index + 1}º na iniciativa${index === snapshot.turnIndex ? ", turno atual" : ""}`}>
                        <b className="turn-order-position local-field-turn-position">{index + 1}</b>
                        <PokemonSprite src={token.sprite} pokemonId={token.speciesId} alt="" />
                        <span><strong>{token.name}</strong><small>{index === snapshot.turnIndex ? token.lastActionRound === snapshot.round ? "Ação feita" : "Agora" : index < snapshot.turnIndex ? "Já jogou" : "A seguir"}{token.declaredMove ? ` · ${formatName(token.declaredMove)}${token.priority ? ` (${token.priority > 0 ? "+" : ""}${token.priority})` : ""}` : ""}</small></span>
                        {(index < snapshot.turnIndex || token.lastActionRound === snapshot.round) && <span className="turn-order-done" aria-hidden="true">✓</span>}
                    </button>
                </li>)}
            </ol>
        </> : <p className="turn-order-empty">{canRoll ? "Escolha os movimentos e role a ordem." : snapshot.tokens.length ? "Nenhum Pokémon pode agir agora." : "Traga Pokémon para começar."}</p>}
        {!order.length && canRoll && onDeclareMove && <RoundDeclarations tokens={participants} onDeclareMove={onDeclareMove} canDeclareToken={canDeclareToken || (() => canControl)} disabled={busy} onPending={choicePending} />}
        {canControl && <div className="turn-order-actions local-field-turn-actions">
            {order.length > 0 ? <button type="button" className="room-primary-button" disabled={busy} onClick={onAdvance}>{lastTurn ? "Encerrar rodada" : "Próximo turno"}<span aria-hidden="true"> →</span></button>
                : canRoll ? <button type="button" className="room-primary-button" disabled={busy || preparing} onClick={() => { if (!pendingChoices.current.size) onRoll(); }}><GameIcon name="dice" />Rolar iniciativa</button>
                    : onChoosePokemon && <button type="button" disabled={busy} onClick={onChoosePokemon}>Escolher Pokémon</button>}
        </div>}
        {snapshot.tokens.length > 0 && <details className="turn-order-help local-field-initiative-help"><summary>Como funciona</summary><p>Declare aqui antes de rolar. Prioridade maior age primeiro; na mesma prioridade, o MyOwnDex usa Speed e 2d6 para formar a ordem. Outra ação usa prioridade 0.</p><p>Depois da rolagem, cada Pokémon usa sua escolha no próprio turno. A ordem permanece até encerrar a rodada; então prepare as novas escolhas e role novamente.</p>
            {snapshot.tokens.some(token => token.declaredMove) && <dl className="turn-order-moves" aria-label="Movimentos escolhidos">{snapshot.tokens.filter(token => token.declaredMove).map(token => <div key={token.id}><dt>{token.name}</dt><dd>{formatName(token.declaredMove)} · prioridade {token.priority > 0 ? `+${token.priority}` : token.priority}</dd></div>)}</dl>}
            {!canControl && <p>O Narrador avança os turnos e inicia cada rodada.</p>}</details>}
    </section>;
}
