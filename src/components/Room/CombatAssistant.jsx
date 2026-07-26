import React, { useEffect, useMemo, useState } from "react";
import { fetchCached, formatName, formatNumberPtBr } from "../../core/mechanics.js";
import { calculateMoveResolution } from "../../core/room.js";

const modifierLabel = value => {
    if (value === 0) return "Imune";
    if (value > 1) return `${formatNumberPtBr(value)}× super efetivo`;
    if (value < 1) return `${formatNumberPtBr(value)}× pouco efetivo`;
    return "Efetividade neutra";
};

export default function CombatAssistant({
    role,
    snapshot,
    selectedTokenId,
    onSnapshotChange,
    onEvent,
    onError,
}) {
    const activeId = snapshot.initiative[snapshot.turnIndex] || selectedTokenId || snapshot.tokens[0]?.id || "";
    const [attackerId, setAttackerId] = useState(activeId);
    const [defenderId, setDefenderId] = useState(snapshot.tokens.find(token => token.id !== activeId)?.id || "");
    const [moveName, setMoveName] = useState("");
    const [mode, setMode] = useState("normal");
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const tokens = snapshot.tokens;
    const attacker = tokens.find(token => token.id === attackerId);
    const defender = tokens.find(token => token.id === defenderId);

    useEffect(() => {
        if (activeId && tokens.some(token => token.id === activeId)) setAttackerId(activeId);
    }, [activeId, tokens]);

    useEffect(() => {
        if (!attacker?.moves?.includes(moveName)) setMoveName(attacker?.moves?.find(Boolean) || "");
    }, [attacker, moveName]);

    useEffect(() => {
        if (defenderId === attackerId || !tokens.some(token => token.id === defenderId)) {
            setDefenderId(tokens.find(token => token.id !== attackerId)?.id || "");
        }
    }, [attackerId, defenderId, tokens]);

    const canResolve = Boolean(attacker && defender && moveName);
    const moves = useMemo(() => attacker?.moves?.filter(Boolean) || [], [attacker]);

    const resolve = async () => {
        if (!canResolve) return;
        setRunning(true);
        try {
            const move = await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveName)}`);
            if (!move) throw new Error("Os dados deste Movimento não estão disponíveis.");
            const resolution = calculateMoveResolution({ attacker, defender, move, mode });
            setResult({ ...resolution, move });
            if (role === "narrator") {
                const nextHp = Math.max(0, defender.currentHp - resolution.damage);
                onSnapshotChange({
                    ...snapshot,
                    tokens: snapshot.tokens.map(token => token.id === defender.id
                        ? { ...token, currentHp: nextHp }
                        : token),
                });
                await onEvent("roll", {
                    label: `${attacker.name} usou ${formatName(move.name)}`,
                    result: `${resolution.attackTest.total} × ${resolution.defenseTest.total}`,
                    damage: resolution.damage,
                    attackerId: attacker.id,
                    defenderId: defender.id,
                });
            } else {
                await onEvent("roll", {
                    label: `simulação de ${formatName(move.name)}`,
                    result: `${resolution.attackTest.total} × ${resolution.defenseTest.total}`,
                    damage: resolution.damage,
                });
            }
        } catch (error) {
            onError(error);
        } finally {
            setRunning(false);
        }
    };

    return (
        <details className="room-tool">
            <summary>
                <span>
                    <small>Resolução automática</small>
                    <strong>Assistente de Movimento</strong>
                </span>
                <span className="room-tool-badge">2d6</span>
            </summary>
            <div className="room-tool-body">
                <div className="combat-grid">
                    <label>
                        <span>Atacante</span>
                        <select value={attackerId} onChange={event => setAttackerId(event.target.value)}>
                            {tokens.map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Defensor</span>
                        <select value={defenderId} onChange={event => setDefenderId(event.target.value)}>
                            {tokens.filter(token => token.id !== attackerId).map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Movimento</span>
                        <select value={moveName} onChange={event => setMoveName(event.target.value)}>
                            {!moves.length && <option value="">Sem Movimento</option>}
                            {moves.map(move => <option key={move} value={move}>{formatName(move)}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Condição</span>
                        <select value={mode} onChange={event => setMode(event.target.value)}>
                            <option value="normal">Normal</option>
                            <option value="advantage">Vantagem</option>
                            <option value="disadvantage">Desvantagem</option>
                        </select>
                    </label>
                </div>
                <button type="button" className="room-primary-button" disabled={!canResolve || running} onClick={resolve}>
                    {running ? "Consultando Movimento…" : role === "narrator" ? "Resolver e aplicar" : "Simular e enviar"}
                </button>
                {result && (
                    <div className={`combat-result ${result.hit ? "is-hit" : "is-miss"}`} aria-live="polite">
                        <div>
                            <small>Ataque × defesa</small>
                            <strong>{result.attackTest.total} × {result.defenseTest.total}</strong>
                        </div>
                        <div>
                            <small>Dano aplicado</small>
                            <strong>{formatNumberPtBr(result.damage)}</strong>
                        </div>
                        <p>
                            {result.hit ? "O atacante superou a defesa." : "A defesa venceu, inclusive em empate."}
                            {" "}{result.accuracyTest.automatic
                                ? "Precisão automática."
                                : `Precisão ${result.accuracyTest.result}/${result.accuracyTest.chance}${result.accuracyTest.rolls.length > 1 ? " com vantagem" : ""}.`}
                            {" "}{modifierLabel(result.effectiveness)}; STAB {formatNumberPtBr(result.stab)}×; teto {formatNumberPtBr(result.ceiling)}.
                        </p>
                    </div>
                )}
            </div>
        </details>
    );
}
