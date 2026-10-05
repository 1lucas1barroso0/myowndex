import React, { useId, useMemo, useState } from "react";
import { getHitKillProtectionKey } from "../../core/automation.js";
import { formatPokemonInScene } from "../../core/copy.js";
import { formatName, formatType } from "../../core/mechanics.js";
import { clampFinite, safeDivide } from "../../core/math.js";
import { ROOM_SCENARIOS, ROOM_TERRAINS, ROOM_WEATHERS, STATUS_LABELS } from "../../core/room.js";
import { getBattleDisplayIdentity } from "../../core/specialMechanics.js";
import { getTraitStatus } from "../../core/traitMechanics.js";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import RoomSelect from "../Shared/RoomSelect.jsx";

const clamp = (value, minimum, maximum) => clampFinite(value, minimum, maximum, minimum);

const HIT_KILL_FIELD_LABELS = Object.freeze({
    available: "proteção contra hit kill disponível",
    used: "proteção contra hit kill consumida nesta batalha",
    lost: "proteção contra hit kill encerrada por autocusto nesta batalha",
});

const getHpTone = token => {
    const percentage = safeDivide(token.currentHp, token.maxHp, 0);
    if (percentage <= 0.25) return "danger";
    if (percentage <= 0.5) return "warning";
    return "healthy";
};

const Token = ({
    token,
    isCurrent,
    isSelected,
    canMove,
    position,
    mirrored,
    showHp,
    protectionState,
    onSelect,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyMove,
    movementHelpId,
}) => {
    const display = getBattleDisplayIdentity(token);
    const traits = getTraitStatus(token);

    return (
    <button
        type="button"
        className={`room-token side-${token.side} ${canMove ? "can-move" : ""} ${isCurrent ? "is-current" : ""} ${isSelected ? "is-selected" : ""} ${token.currentHp <= 0 ? "is-fainted" : ""} ${token.teraActive ? "is-tera" : ""} ${display.transformed ? "is-transformed" : ""} ${display.disguised ? "is-illusion" : ""}`}
        style={{ left: `clamp(3.5rem, ${position.x}%, calc(100% - 3.5rem))`, top: `clamp(3.5rem, ${position.y}%, calc(100% - 3.5rem))` }}
        onClick={() => onSelect(isSelected ? "" : token.id)}
        onPointerDown={event => canMove && onPointerDown(event, token)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={event => {
            if (!canMove || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? 5 : 2;
            onKeyMove(token, {
                x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
                y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
            });
        }}
        aria-pressed={isSelected}
        aria-describedby={canMove ? movementHelpId : undefined}
        aria-label={`${display.name}, nível ${token.level}${showHp ? `, ${token.currentHp} de ${token.maxHp} pontos de vida` : ""}${token.status ? `, ${STATUS_LABELS[token.status] || formatName(token.status)}` : ""}, ${HIT_KILL_FIELD_LABELS[protectionState]}${token.currentHp <= 0 ? ", não pode mais batalhar" : ""}${token.teraActive ? `, tipo Tera ${formatType(token.teraType)} ativo` : ""}${traits.ability ? `, habilidade ${formatName(traits.ability.id)} ${traits.abilityActive ? "ativa" : "suprimida"}` : ""}${traits.item ? `, item ${formatName(traits.item.id)} ${traits.itemConsumed ? "consumido" : "ativo"}` : ""}${display.transformed ? ", transformação ativa" : ""}${display.disguised ? ", aparência alterada" : ""}${canMove ? ", pode ser movido" : ""}`}
    >
        <span className="room-token-sprite-shell">
            {display.sprite ? (
                <PokemonSprite
                    src={display.sprite}
                    pokemonId={display.disguised ? token.specialState?.illusion?.speciesId || token.speciesId : token.speciesId}
                    alt=""
                    className={`room-token-sprite pixelated ${mirrored && token.side === "ally" ? "is-mirrored" : ""}`}
                    fallbackClassName="room-token-fallback"
                />
            ) : <span className="room-token-fallback" aria-hidden="true">●</span>}
        </span>
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
    onChoosePokemon,
    compact = false,
}) {
    const battle = snapshot.phase === "batalha";
    const [drag, setDrag] = useState(null);
    const movementHelpId = useId();
    const currentTokenId = battle ? snapshot.initiative[snapshot.turnIndex] || "" : "";
    const tokenById = useMemo(
        () => Object.fromEntries(snapshot.tokens.map(token => [token.id, token])),
        [snapshot.tokens],
    );
    const hitKillProtectionUsed = useMemo(
        () => new Set(snapshot.hitKillProtectionUsed),
        [snapshot.hitKillProtectionUsed],
    );
    const hitKillProtectionDisabled = useMemo(
        () => new Set(snapshot.hitKillProtectionDisabled),
        [snapshot.hitKillProtectionDisabled],
    );

    const selectedToken = snapshot.tokens.find(token => token.id === selectedTokenId);
    const selectedDisplay = selectedToken ? getBattleDisplayIdentity(selectedToken) : null;
    const visibleTokens = snapshot.tokens.filter(token => !token.hidden && !token.captured);

    const canMoveToken = token => role === "narrator"
        || (snapshot.settings.allowPlayerMovement && token.ownerPlayerId === playerId);

    const updatePosition = (event, commit = false) => {
        if (!drag) return;
        const rect = event.currentTarget.closest(".battlefield-board")?.getBoundingClientRect();
        if (!rect) return;
        const deltaX = event.clientX - drag.startClientX;
        const deltaY = event.clientY - drag.startClientY;
        const x = clamp(drag.startX + deltaX / rect.width * 100, 4, 96);
        const y = clamp(drag.startY + deltaY / rect.height * 100, 8, 92);
        setDrag(current => current ? { ...current, x, y } : current);
        if (commit && Math.hypot(deltaX, deltaY) > 3) {
            onSnapshotChange({
                ...snapshot,
                tokens: snapshot.tokens.map(token => token.id === drag.tokenId ? { ...token, x, y } : token),
            });
        }
        if (commit) setDrag(null);
    };

    const handlePointerDown = (event, token) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.focus({ preventScroll: true });
        setDrag({ tokenId: token.id, x: token.x, y: token.y, startX: token.x, startY: token.y, startClientX: event.clientX, startClientY: event.clientY });
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
        <section className={`battlefield-card ${battle ? "is-battle-scene" : "is-story-scene"}${compact ? " is-compact-scene" : ""}`} aria-label={battle ? "Campo de batalha" : "Cena da aventura"}>
            <p id={movementHelpId} className="sr-only">Para mover um Pokémon com o teclado, use as setas. Segure Shift para mover mais longe.</p>
            <div className="battlefield-toolbar">
                <div>
                    <h3>{battle ? "Campo de batalha" : "Cena"}</h3>
                </div>
                <details className="battlefield-environment">
                    <summary>{battle ? "Preparar o campo" : "Escolher cenário"}</summary>
                    <div className="battlefield-selectors">
                    <label>
                        <span>Cenário</span>
                        <RoomSelect
                            value={snapshot.scenario}
                            disabled={role !== "narrator"}
                            onChange={event => onSnapshotChange({ ...snapshot, scenario: event.target.value })}
                        >
                            {ROOM_SCENARIOS.map(scene => <option key={scene.id} value={scene.id}>{scene.label}</option>)}
                        </RoomSelect>
                    </label>
                    {!compact && <label>
                        <span>Clima</span>
                        <RoomSelect
                            value={snapshot.weather}
                            disabled={role !== "narrator"}
                            onChange={event => onSnapshotChange({ ...snapshot, weather: event.target.value })}
                        >
                            {ROOM_WEATHERS.map(weather => <option key={weather.id} value={weather.id}>{weather.label}</option>)}
                        </RoomSelect>
                    </label>}
                    {battle && <label>
                        <span>Terreno</span>
                        <RoomSelect
                            value={snapshot.terrain}
                            disabled={role !== "narrator"}
                            onChange={event => onSnapshotChange({ ...snapshot, terrain: event.target.value })}
                        >
                            {ROOM_TERRAINS.map(terrain => <option key={terrain.id} value={terrain.id}>{terrain.label}</option>)}
                        </RoomSelect>
                    </label>}
                    </div>
                </details>
            </div>

            {compact && snapshot.phase === "intervalo" && visibleTokens.length > 0 && <div className="scene-rest-party" role="group" aria-label="Pokémon no intervalo">
                {visibleTokens.map(token => { const display = getBattleDisplayIdentity(token); return <button type="button" key={token.id} aria-pressed={selectedTokenId === token.id} aria-label={`Cuidar de ${display.name}`} onClick={() => onSelectToken(selectedTokenId === token.id ? "" : token.id)}>
                    <PokemonSprite src={display.sprite} pokemonId={display.disguised ? token.specialState?.illusion?.speciesId || token.speciesId : token.speciesId} alt="" />
                    <span><strong>{display.name}</strong>{snapshot.settings.showHp && <small>HP {token.currentHp} de {token.maxHp}</small>}</span>
                </button>; })}
            </div>}

            {!compact && <div className={`battlefield-board ${visibleTokens.length ? "has-pokemon" : "is-empty-field"} scene-${snapshot.scenario} weather-${snapshot.weather} terrain-${snapshot.terrain}`} style={{ "--field-token-size": `${visibleTokens.length > 8 ? 4 : visibleTokens.length > 4 ? 5 : 7}rem` }}>
                <img className="battlefield-scenery" src={`/scenes/${snapshot.scenario}.svg`} alt="" aria-hidden="true" draggable="false" />
                {battle && <><div className="battlefield-center-line" /><div className="battlefield-side-label label-opponent">Oponentes</div><div className="battlefield-side-label label-ally">Aliados</div></>}
                {visibleTokens.map(token => {
                    const position = drag?.tokenId === token.id ? drag : token;
                    const protectionKey = getHitKillProtectionKey(token);
                    const protectionState = protectionKey && hitKillProtectionUsed.has(protectionKey)
                        ? "used"
                        : protectionKey && hitKillProtectionDisabled.has(protectionKey)
                            ? "lost"
                            : "available";
                    return (
                        <Token
                            key={token.id}
                            token={token}
                            position={position}
                            isCurrent={currentTokenId === token.id}
                            isSelected={selectedTokenId === token.id}
                            canMove={canMoveToken(token)}
                            mirrored={snapshot.settings.mirrorSprites}
                            showHp={battle && snapshot.settings.showHp}
                            protectionState={protectionState}
                            onSelect={onSelectToken}
                            onPointerDown={handlePointerDown}
                            onPointerMove={event => updatePosition(event, false)}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={() => setDrag(null)}
                            onKeyMove={handleKeyMove}
                            movementHelpId={movementHelpId}
                        />
                    );
                })}
                {!visibleTokens.length && (
                    <div className="battlefield-empty">
                        <strong>{battle ? "Quem vai batalhar?" : "Quem vai explorar?"}</strong>
                        {onChoosePokemon
                            ? <button type="button" className="room-primary-button battlefield-choose-pokemon" onClick={onChoosePokemon}>Escolher Pokémon</button>
                            : <small>Escolha um parceiro em “Equipe para a cena”.</small>}
                    </div>
                )}
                <div className="battlefield-pixel-grid" aria-hidden="true" />
            </div>}

            {selectedToken && !compact && <div className={`battlefield-focus side-${selectedToken.side}`} aria-live="polite">
                <span className="battlefield-focus-identity"><strong>{selectedDisplay.name}</strong><small>Nv. {selectedToken.level}{selectedToken.status ? ` · ${STATUS_LABELS[selectedToken.status] || formatName(selectedToken.status)}` : ""}</small></span>
                {battle && snapshot.settings.showHp && <span className="battlefield-focus-health"><span className={`room-token-hp is-${getHpTone(selectedToken)}`} aria-hidden="true"><span style={{ width: `${selectedToken.maxHp ? clamp(selectedToken.currentHp / selectedToken.maxHp * 100, 0, 100) : 0}%` }} /></span><strong>HP {selectedToken.currentHp} de {selectedToken.maxHp}</strong></span>}
            </div>}
            <div className="battlefield-footer">
                <span>{ROOM_SCENARIOS.find(scene => scene.id === snapshot.scenario)?.label}</span>
                {!compact && snapshot.weather !== "limpo" && <span>{ROOM_WEATHERS.find(weather => weather.id === snapshot.weather)?.label}</span>}
                {battle && snapshot.terrain !== "nenhum" && <span>{ROOM_TERRAINS.find(terrain => terrain.id === snapshot.terrain)?.label}</span>}
                {!compact && visibleTokens.length > 0 && <>
                    <span>{formatPokemonInScene(visibleTokens.length)}</span>
                    {battle && <span>{tokenById[currentTokenId]?.name ? `Turno de ${tokenById[currentTokenId].name}` : "Escolha os movimentos para começar"}</span>}
                </>}
            </div>
        </section>
    );
}
