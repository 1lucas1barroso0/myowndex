import React, { useMemo, useState } from "react";
import { formatPokemonInScene } from "../../core/copy.js";
import { formatName, formatType } from "../../core/mechanics.js";
import { ROOM_SCENARIOS, ROOM_TERRAINS, ROOM_WEATHERS } from "../../core/room.js";
import { getBattleDisplayIdentity } from "../../core/specialMechanics.js";
import { getTraitStatus } from "../../core/traitMechanics.js";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const Token = ({
    token,
    isCurrent,
    isSelected,
    canMove,
    position,
    showHp,
    mirrored,
    onSelect,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyMove,
}) => {
    const display = getBattleDisplayIdentity(token);
    const traits = getTraitStatus(token);
    return (
    <button
        type="button"
        className={`room-token side-${token.side} ${isCurrent ? "is-current" : ""} ${isSelected ? "is-selected" : ""} ${token.currentHp <= 0 ? "is-fainted" : ""} ${token.teraActive ? "is-tera" : ""} ${display.transformed ? "is-transformed" : ""} ${display.disguised ? "is-illusion" : ""}`}
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
        onClick={() => onSelect(token.id)}
        onPointerDown={event => canMove && onPointerDown(event, token)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={event => {
            if (!canMove || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? 5 : 2;
            onKeyMove(token, {
                x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
                y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
            });
        }}
        aria-label={`${display.name}, ${token.currentHp} de ${token.maxHp} pontos de vida${token.currentHp <= 0 ? ", não pode mais batalhar" : ""}${token.teraActive ? `, tipo Tera ${formatType(token.teraType)} ativo` : ""}${traits.ability ? `, habilidade ${formatName(traits.ability.id)} ${traits.abilityActive ? "ativa" : "suprimida"}` : ""}${traits.item ? `, item ${formatName(traits.item.id)} ${traits.itemConsumed ? "consumido" : "ativo"}` : ""}${display.transformed ? ", transformação ativa" : ""}${display.disguised ? ", aparência alterada" : ""}${canMove ? ", pode ser movido" : ""}`}
    >
        <span className="room-token-sprite-shell">
            {display.sprite ? (
                <img
                    src={display.sprite}
                    alt=""
                    className={`room-token-sprite pixelated ${mirrored && token.side === "ally" ? "is-mirrored" : ""}`}
                    draggable="false"
                />
            ) : <span className="room-token-fallback" aria-hidden="true">●</span>}
        </span>
        <span className="room-token-name">{display.name}</span>
        {(display.transformed || display.disguised) && (
            <span className="room-token-special" aria-hidden="true">{display.disguised ? "Ilusão" : "Transform"}</span>
        )}
        {(traits.ability || traits.item) && (
            <span className="room-token-traits" aria-hidden="true">
                {traits.ability && <i className={traits.abilityActive ? "is-ability" : "is-paused"} title={formatName(traits.ability.id)}>◆</i>}
                {traits.item && <i className={traits.itemConsumed ? "is-consumed" : "is-item"} title={formatName(traits.item.id)}>●</i>}
            </span>
        )}
        {showHp && (
            <span className="room-token-hp" aria-hidden="true">
                <span style={{ width: `${token.maxHp ? token.currentHp / token.maxHp * 100 : 0}%` }} />
            </span>
        )}
    </button>
    );
};

export default function Battlefield({
    snapshot,
    role,
    playerId,
    selectedTokenId,
    onSelectToken,
    onSnapshotChange,
}) {
    const [drag, setDrag] = useState(null);
    const currentTokenId = snapshot.initiative[snapshot.turnIndex] || "";
    const tokenById = useMemo(
        () => Object.fromEntries(snapshot.tokens.map(token => [token.id, token])),
        [snapshot.tokens],
    );

    const canMoveToken = token => role === "narrator"
        || (snapshot.settings.allowPlayerMovement && token.ownerPlayerId === playerId);

    const updatePosition = (event, commit = false) => {
        if (!drag) return;
        const rect = event.currentTarget.closest(".battlefield-board")?.getBoundingClientRect();
        if (!rect) return;
        const x = clamp((event.clientX - rect.left) / rect.width * 100, 4, 96);
        const y = clamp((event.clientY - rect.top) / rect.height * 100, 8, 92);
        setDrag(current => current ? { ...current, x, y } : current);
        if (commit) {
            onSnapshotChange({
                ...snapshot,
                tokens: snapshot.tokens.map(token => token.id === drag.tokenId ? { ...token, x, y } : token),
            });
            setDrag(null);
        }
    };

    const handlePointerDown = (event, token) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDrag({ tokenId: token.id, x: token.x, y: token.y });
    };

    const handlePointerUp = event => {
        if (!drag) return;
        updatePosition(event, true);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const handleKeyMove = (token, delta) => {
        onSnapshotChange({
            ...snapshot,
            tokens: snapshot.tokens.map(item => item.id === token.id
                ? {
                    ...item,
                    x: clamp(item.x + delta.x, 4, 96),
                    y: clamp(item.y + delta.y, 8, 92),
                }
                : item),
        });
    };

    return (
        <section className="battlefield-card" aria-label="Campo de batalha">
            <div className="battlefield-toolbar">
                <div>
                    <span className="room-kicker">A cena agora</span>
                    <h3>Campo de batalha</h3>
                </div>
                <div className="battlefield-selectors">
                    <label>
                        <span className="sr-only">Cenário</span>
                        <select
                            value={snapshot.scenario}
                            disabled={role !== "narrator"}
                            onChange={event => onSnapshotChange({ ...snapshot, scenario: event.target.value })}
                        >
                            {ROOM_SCENARIOS.map(scene => <option key={scene.id} value={scene.id}>{scene.label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">Clima</span>
                        <select
                            value={snapshot.weather}
                            disabled={role !== "narrator"}
                            onChange={event => onSnapshotChange({ ...snapshot, weather: event.target.value })}
                        >
                            {ROOM_WEATHERS.map(weather => <option key={weather.id} value={weather.id}>{weather.label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">Terreno</span>
                        <select
                            value={snapshot.terrain}
                            disabled={role !== "narrator"}
                            onChange={event => onSnapshotChange({ ...snapshot, terrain: event.target.value })}
                        >
                            {ROOM_TERRAINS.map(terrain => <option key={terrain.id} value={terrain.id}>{terrain.label}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            <div className={`battlefield-board scene-${snapshot.scenario} weather-${snapshot.weather} terrain-${snapshot.terrain}`}>
                <div className="battlefield-depth battlefield-depth-back" />
                <div className="battlefield-center-line" />
                <div className="battlefield-side-label label-opponent">Oponentes</div>
                <div className="battlefield-side-label label-ally">Treinadores</div>
                {snapshot.tokens.map(token => {
                    const position = drag?.tokenId === token.id ? drag : token;
                    return (
                        <Token
                            key={token.id}
                            token={token}
                            position={position}
                            isCurrent={currentTokenId === token.id}
                            isSelected={selectedTokenId === token.id}
                            canMove={canMoveToken(token)}
                            showHp={snapshot.settings.showHp}
                            mirrored={snapshot.settings.mirrorSprites}
                            onSelect={onSelectToken}
                            onPointerDown={handlePointerDown}
                            onPointerMove={event => updatePosition(event, false)}
                            onPointerUp={handlePointerUp}
                            onKeyMove={handleKeyMove}
                        />
                    );
                })}
                {!snapshot.tokens.length && (
                    <div className="battlefield-empty">
                        <span aria-hidden="true">◇</span>
                        <strong>O campo está pronto</strong>
                        <small>Leve uma equipe para a cena quando estiver tudo pronto.</small>
                    </div>
                )}
                <div className="battlefield-pixel-grid" aria-hidden="true" />
            </div>

            <div className="battlefield-footer">
                <span>{ROOM_SCENARIOS.find(scene => scene.id === snapshot.scenario)?.label}</span>
                <span>{formatPokemonInScene(snapshot.tokens.length)}</span>
                <span>{tokenById[currentTokenId]?.name ? `Turno de ${tokenById[currentTokenId].name}` : "Aguardando iniciativa"}</span>
            </div>
        </section>
    );
}
