import React, { useEffect, useMemo, useState } from "react";
import {
    fetchCached,
    formatDamageClass,
    formatName,
    formatNumberPtBr,
    formatType,
    STAT_MAP,
} from "../../core/mechanics.js";
import {
    applyMoveConsequences,
    getMoveAutomationTags,
    getMovePpState,
} from "../../core/automation.js";
import { calculateMoveResolution, STATUS_LABELS } from "../../core/room.js";

const modifierLabel = value => {
    if (value === 0) return "Imune";
    if (value > 1) return `${formatNumberPtBr(value)}× super efetivo`;
    if (value < 1) return `${formatNumberPtBr(value)}× pouco efetivo`;
    return "Efetividade neutra";
};

const stageSummary = changes => {
    if (!changes?.length) return "";
    return changes.map(change => {
        const direction = change.change > 0 ? `+${change.change}` : change.change;
        return `${STAT_MAP[change.stat] || formatName(change.stat)} ${direction}`;
    }).join(", ");
};

export default function CombatAssistant({
    role,
    playerId,
    snapshot,
    selectedTokenId,
    onSnapshotChange,
    onDeclareMove,
    onEvent,
    onError,
}) {
    const activeId = snapshot.initiative[snapshot.turnIndex] || selectedTokenId || snapshot.tokens[0]?.id || "";
    const [attackerId, setAttackerId] = useState(activeId);
    const [defenderId, setDefenderId] = useState(snapshot.tokens.find(token => token.id !== activeId)?.id || "");
    const [moveName, setMoveName] = useState("");
    const [moveData, setMoveData] = useState(null);
    const [mode, setMode] = useState("normal");
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [declaring, setDeclaring] = useState(false);
    const tokens = snapshot.tokens;
    const attacker = tokens.find(token => token.id === attackerId);
    const defender = tokens.find(token => token.id === defenderId);

    useEffect(() => {
        if (activeId && tokens.some(token => token.id === activeId)) setAttackerId(activeId);
    }, [activeId, tokens]);

    useEffect(() => {
        if (!attacker?.moves?.includes(moveName)) {
            setMoveName(attacker?.declaredMove || attacker?.moves?.find(Boolean) || "");
            setResult(null);
        }
    }, [attacker, moveName]);

    useEffect(() => {
        let active = true;
        if (!moveName) {
            setMoveData(null);
            return () => { active = false; };
        }
        fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveName)}`)
            .then(data => {
                if (active) setMoveData(data || null);
            });
        return () => { active = false; };
    }, [moveName]);

    useEffect(() => {
        if (defenderId === attackerId || !tokens.some(token => token.id === defenderId)) {
            setDefenderId(tokens.find(token => token.id !== attackerId)?.id || "");
        }
    }, [attackerId, defenderId, tokens]);

    const moves = useMemo(() => attacker?.moves?.filter(Boolean) || [], [attacker]);
    const ppState = useMemo(
        () => getMovePpState(attacker, moveData, moveName),
        [attacker, moveData, moveName],
    );
    const canControlAttacker = role === "narrator"
        || Boolean(playerId && attacker?.ownerPlayerId === playerId);
    const outOfPp = ppState.remaining != null && ppState.remaining <= 0;
    const canResolve = Boolean(attacker && defender && moveName && moveData && !outOfPp);
    const automationTags = getMoveAutomationTags(moveData);

    const selectMove = async name => {
        setMoveName(name);
        setMoveData(null);
        setResult(null);
        if (!name || !attacker || !canControlAttacker) return;
        setDeclaring(true);
        try {
            const detail = await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`);
            if (!detail) throw new Error("Os dados deste Movimento não estão disponíveis.");
            setMoveData(detail);
            await onDeclareMove?.(attacker.id, detail);
        } catch (error) {
            onError(error);
        } finally {
            setDeclaring(false);
        }
    };

    const resolve = async () => {
        if (!canResolve) return;
        setRunning(true);
        try {
            const move = moveData || await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveName)}`);
            if (!move) throw new Error("Os dados deste Movimento não estão disponíveis.");
            const resolution = calculateMoveResolution({ attacker, defender, move, mode });
            if (role === "narrator") {
                const automated = applyMoveConsequences({
                    tokens: snapshot.tokens,
                    attackerId: attacker.id,
                    defenderId: defender.id,
                    move,
                    resolution,
                });
                const nextDefender = automated.tokens.find(token => token.id === defender.id);
                setResult({ ...resolution, move, consequences: automated.consequences });
                onSnapshotChange({
                    ...snapshot,
                    tokens: automated.tokens,
                });
                await onEvent("move", {
                    attackerName: attacker.name,
                    attackerId: attacker.id,
                    defenderName: defender.name,
                    defenderId: defender.id,
                    moveName: formatName(move.name),
                    hit: resolution.hit,
                    damage: automated.consequences.damage,
                    remainingHp: nextDefender?.currentHp,
                    fainted: automated.consequences.fainted,
                    status: automated.consequences.appliedStatus,
                    ppAfter: automated.consequences.ppAfter,
                });
                if (resolution.hit) {
                    await onEvent("sfx", {
                        effectId: resolution.attackTest.critical ? "critical" : automated.consequences.healed > 0 && !automated.consequences.damage ? "heal" : "hit",
                        label: resolution.attackTest.critical ? "Crítico" : automated.consequences.healed > 0 && !automated.consequences.damage ? "Cura" : "Impacto",
                    });
                }
            } else {
                setResult({ ...resolution, move, consequences: null });
                await onEvent("roll", {
                    label: `simulação de ${formatName(move.name)}`,
                    result: `${resolution.attackTest.total} × ${resolution.defenseTest.total}`,
                    damage: resolution.damage,
                    attackerId: attacker.id,
                    defenderId: defender.id,
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
                    <small>Resolução reativa</small>
                    <strong>Assistente de Movimento</strong>
                </span>
                <span className="room-tool-badge">Rotom</span>
            </summary>
            <div className="room-tool-body">
                <div className="combat-grid">
                    <label>
                        <span>Atacante</span>
                        <select value={attackerId} onChange={event => { setAttackerId(event.target.value); setResult(null); }}>
                            {tokens.map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Defensor</span>
                        <select value={defenderId} onChange={event => { setDefenderId(event.target.value); setResult(null); }}>
                            {tokens.filter(token => token.id !== attackerId).map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Movimento</span>
                        <select value={moveName} onChange={event => void selectMove(event.target.value)}>
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

                {moveData && (
                    <div className="combat-automation" aria-live="polite">
                        <span>{formatType(moveData.type?.name)}</span>
                        <span>{formatDamageClass(moveData.damage_class?.name)}</span>
                        <span>PP {formatNumberPtBr(ppState.remaining ?? moveData.pp ?? 0)}/{formatNumberPtBr(ppState.maximum ?? moveData.pp ?? 0)}</span>
                        {automationTags.map(tag => <span key={tag}>{tag}</span>)}
                        {declaring && <span className="is-syncing">Sincronizando prioridade…</span>}
                    </div>
                )}
                {!canControlAttacker && role === "player" && (
                    <p className="combat-permission-note">Você pode simular este Pokémon; a declaração automática é reservada aos Pokémon sob seu controle.</p>
                )}
                <button type="button" className="room-primary-button" disabled={!canResolve || running || declaring} onClick={resolve}>
                    {outOfPp
                        ? "Sem PP disponível"
                        : running
                            ? "Resolvendo Movimento…"
                            : role === "narrator"
                                ? "Resolver e aplicar tudo"
                                : "Simular e enviar"}
                </button>
                {result && (
                    <div className={`combat-result ${result.hit ? "is-hit" : "is-miss"}`} aria-live="polite">
                        <div>
                            <small>Ataque × defesa</small>
                            <strong>{result.attackTest.total} × {result.defenseTest.total}</strong>
                        </div>
                        <div>
                            <small>Dano {role === "narrator" ? "aplicado" : "simulado"}</small>
                            <strong>{formatNumberPtBr(result.consequences?.damage ?? result.damage)}</strong>
                        </div>
                        <p>
                            {result.hit ? "O atacante superou a defesa." : "A defesa venceu, inclusive em empate."}
                            {" "}{result.accuracyTest.automatic
                                ? "Precisão automática."
                                : `Precisão ${result.accuracyTest.result}/${result.accuracyTest.chance}${result.accuracyTest.rolls.length > 1 ? " com vantagem" : ""}.`}
                            {" "}{modifierLabel(result.effectiveness)}; STAB {formatNumberPtBr(result.stab)}×
                            {result.attackTest.critical ? "; crítico 1,5×" : ""}; teto {formatNumberPtBr(result.ceiling)}.
                        </p>
                        {result.consequences && (
                            <ul className="combat-consequences">
                                {result.consequences.ppAfter != null && <li>PP restante: {formatNumberPtBr(result.consequences.ppAfter)}</li>}
                                {result.consequences.healed > 0 && <li>Cura automática: {formatNumberPtBr(result.consequences.healed)} HP</li>}
                                {result.consequences.recoil > 0 && <li>Recuo automático: {formatNumberPtBr(result.consequences.recoil)} HP</li>}
                                {result.consequences.appliedStatus && <li>Condição aplicada: {STATUS_LABELS[result.consequences.appliedStatus]}</li>}
                                {result.consequences.stageChanges.length > 0 && <li>Estágios: {stageSummary(result.consequences.stageChanges)}</li>}
                                {result.consequences.fainted && <li>O alvo ficou sem HP.</li>}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}
