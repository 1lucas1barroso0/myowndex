import React, { useId } from "react";
import PokemonSprite from "./PokemonSprite.jsx";
import GameIcon from "./GameIcon.jsx";
import { formatName } from "../../core/mechanics.js";

/** The same round controls in Adventures and the practice field.
 * This component only presents the snapshot; the existing engines resolve it. */
export default function TurnOrder({ snapshot, onSelect, onRoll, onAdvance, canControl = true, busy = false, local = false, onChoosePokemon }) {
    const titleId = useId();
    const order = snapshot.initiative.map((id, index) => ({ token: snapshot.tokens.find(token => token.id === id), index })).filter(entry => entry.token);
    const active = order.find(entry => entry.index === snapshot.turnIndex)?.token;
    const canRoll = snapshot.tokens.some(token => !token.hidden && token.currentHp > 0);
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
                        <span><strong>{token.name}</strong><small>{index === snapshot.turnIndex ? "Agora" : index < snapshot.turnIndex ? "Já jogou" : "A seguir"}</small></span>
                        {index < snapshot.turnIndex && <span className="turn-order-done" aria-hidden="true">✓</span>}
                    </button>
                </li>)}
            </ol>
        </> : <p className="turn-order-empty">{canRoll ? "Escolha os movimentos e role a ordem." : snapshot.tokens.length ? "Nenhum Pokémon pode agir agora." : "Traga Pokémon para começar."}</p>}
        {canControl && <div className="turn-order-actions local-field-turn-actions">
            {order.length > 0 ? <button type="button" className="room-primary-button" disabled={busy} onClick={onAdvance}>{lastTurn ? "Encerrar rodada" : "Próximo turno"}<span aria-hidden="true"> →</span></button>
                : canRoll ? <button type="button" className="room-primary-button" disabled={busy} onClick={onRoll}><GameIcon name="dice" />Rolar iniciativa</button>
                    : onChoosePokemon && <button type="button" disabled={busy} onClick={onChoosePokemon}>Escolher Pokémon</button>}
        </div>}
        {snapshot.tokens.length > 0 && <details className="turn-order-help local-field-initiative-help"><summary>Como funciona</summary><p>Escolha os movimentos antes de rolar. A prioridade do movimento e a Speed definem a ordem. Cada Pokémon tem seu turno. Ao encerrar a rodada, os efeitos são aplicados; escolha os movimentos e role uma nova iniciativa.</p>
            {snapshot.tokens.some(token => token.declaredMove) && <dl className="turn-order-moves" aria-label="Movimentos escolhidos">{snapshot.tokens.filter(token => token.declaredMove).map(token => <div key={token.id}><dt>{token.name}</dt><dd>{formatName(token.declaredMove)} · prioridade {token.priority > 0 ? `+${token.priority}` : token.priority}</dd></div>)}</dl>}
            {!canControl && <p>O Narrador avança os turnos e inicia cada rodada.</p>}</details>}
    </section>;
}
