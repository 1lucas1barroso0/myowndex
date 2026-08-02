import React, { useEffect, useMemo, useState } from "react";
import {
    fetchCached,
    formatDamageClass,
    formatName,
    formatNumberPtBr,
    formatType,
} from "../../core/mechanics.js";
import {
    applyHitKillProtection,
    applyMoveConsequences,
    getAffectedMoveTargets,
    getMoveAutomationTags,
    getMovePpState,
    getMoveResolutionProfile,
    getSelectableMoveTargets,
    isDirectKnockoutMove,
    STAGE_LABELS,
} from "../../core/automation.js";
import { formatRemainingPp } from "../../core/copy.js";
import { calculateMoveResolution, STATUS_LABELS } from "../../core/room.js";

const modifierLabel = value => {
    if (value === 0) return "Imune";
    if (value > 1) return `Super efetivo (${formatNumberPtBr(value)}×)`;
    if (value < 1) return `Pouco efetivo (${formatNumberPtBr(value)}×)`;
    return "Efetividade normal";
};

const stageSummary = changes => changes
    ?.filter(change => change.change)
    .map(change => {
        const direction = change.change > 0 ? `+${change.change}` : change.change;
        return `${STAGE_LABELS[change.stat] || formatName(change.stat)} ${direction}`;
    }).join(", ") || "";

const emptyConsequences = () => ({
    ppAfter: null,
    damage: 0,
    calculatedDamage: 0,
    healed: 0,
    recoil: 0,
    stageChanges: [],
    appliedStatuses: [],
    blockedStatuses: [],
    trackedEffects: [],
    hitKillProtected: false,
    hitKillThreshold: 0,
    fainted: false,
    fieldChange: null,
});

const addConsequences = (summary, current) => ({
    ...summary,
    ppAfter: summary.ppAfter ?? current.ppAfter,
    damage: summary.damage + (Number(current.damage) || 0),
    calculatedDamage: summary.calculatedDamage + (Number(current.calculatedDamage) || 0),
    healed: summary.healed + (Number(current.healed) || 0),
    recoil: summary.recoil + (Number(current.recoil) || 0),
    stageChanges: [...summary.stageChanges, ...(current.stageChanges || [])],
    appliedStatuses: current.appliedStatus
        ? [...summary.appliedStatuses, current.appliedStatus]
        : summary.appliedStatuses,
    blockedStatuses: current.blockedStatus
        ? [...summary.blockedStatuses, current.blockedStatus]
        : summary.blockedStatuses,
    trackedEffects: current.trackedEffect
        ? [...summary.trackedEffects, current.trackedEffect]
        : summary.trackedEffects,
    hitKillProtected: summary.hitKillProtected || Boolean(current.hitKillProtected),
    hitKillThreshold: Math.max(summary.hitKillThreshold, Number(current.hitKillThreshold) || 0),
    fainted: summary.fainted || Boolean(current.fainted),
    fieldChange: current.fieldChange || summary.fieldChange,
});

const resolutionRollLabel = resolution => {
    if (resolution.attackTest && resolution.defenseTest) {
        return `${resolution.attackTest.total} × ${resolution.defenseTest.total}`;
    }
    if (!resolution.accuracyTest.automatic) {
        return `${resolution.accuracyTest.result}/${resolution.accuracyTest.chance}`;
    }
    return "declarado";
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
    const activeTokenExists = Boolean(activeId && tokens.some(token => token.id === activeId));

    useEffect(() => {
        if (activeTokenExists) setAttackerId(activeId);
    }, [activeId, activeTokenExists]);

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
            })
            .catch(() => {
                if (active) setMoveData(null);
            });
        return () => { active = false; };
    }, [moveName]);

    const moves = useMemo(() => attacker?.moves?.filter(Boolean) || [], [attacker]);
    const resolutionProfile = useMemo(
        () => moveData ? getMoveResolutionProfile(moveData) : null,
        [moveData],
    );
    const selectableTargets = useMemo(
        () => moveData ? getSelectableMoveTargets(tokens, attacker, moveData) : [],
        [tokens, attacker, moveData],
    );
    const affectedTargets = useMemo(
        () => moveData ? getAffectedMoveTargets(tokens, attacker, defender, moveData) : [],
        [tokens, attacker, defender, moveData],
    );

    useEffect(() => {
        if (!resolutionProfile?.target.requiresSelection) return;
        if (!selectableTargets.some(token => token.id === defenderId)) {
            setDefenderId(selectableTargets[0]?.id || "");
        }
    }, [defenderId, resolutionProfile, selectableTargets]);

    const ppState = useMemo(
        () => getMovePpState(attacker, moveData, moveName),
        [attacker, moveData, moveName],
    );
    const canControlAttacker = role === "narrator"
        || Boolean(playerId && attacker?.ownerPlayerId === playerId);
    const outOfPp = ppState.remaining != null && ppState.remaining <= 0;
    const hasRequiredTarget = !resolutionProfile?.target.requiresSelection || Boolean(defender);
    const canResolve = Boolean(attacker && moveName && moveData && resolutionProfile && hasRequiredTarget && !outOfPp);
    const automationTags = getMoveAutomationTags(moveData);

    const selectMove = async name => {
        setMoveName(name);
        setMoveData(null);
        setResult(null);
        if (!name || !attacker || !canControlAttacker) return;
        setDeclaring(true);
        try {
            const detail = await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`);
            if (!detail) throw new Error("A Pokédex não conseguiu abrir este movimento agora.");
            setMoveData(detail);
            await onDeclareMove?.(attacker.id, detail);
        } catch (error) {
            onError?.(error);
        } finally {
            setDeclaring(false);
        }
    };

    const resolve = async () => {
        if (!canResolve) return;
        setRunning(true);
        try {
            const move = moveData || await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveName)}`);
            if (!move) throw new Error("A Pokédex não conseguiu abrir este movimento agora.");
            const targetsToResolve = affectedTargets.length ? affectedTargets : [null];
            let workingTokens = snapshot.tokens;
            let consequences = emptyConsequences();
            const targetResults = [];

            for (const [index, originalTarget] of targetsToResolve.entries()) {
                const currentAttacker = workingTokens.find(token => token.id === attacker.id) || attacker;
                const currentTarget = originalTarget
                    ? workingTokens.find(token => token.id === originalTarget.id) || originalTarget
                    : null;
                const resolution = calculateMoveResolution({
                    attacker: currentAttacker,
                    defender: currentTarget,
                    move,
                    mode,
                });

                if (role === "narrator") {
                    const automated = applyMoveConsequences({
                        tokens: workingTokens,
                        attackerId: attacker.id,
                        targetId: currentTarget?.id,
                        move,
                        resolution,
                        consumePp: index === 0,
                        applySelfChanges: index === 0,
                        clearDeclaration: index === targetsToResolve.length - 1,
                    });
                    workingTokens = automated.tokens;
                    consequences = addConsequences(consequences, automated.consequences);
                    targetResults.push({ target: currentTarget, resolution, consequences: automated.consequences });
                } else {
                    const previewHitKill = currentTarget
                        ? applyHitKillProtection({
                            damage: resolution.damageHit ? resolution.damage : 0,
                            currentHp: currentTarget.currentHp,
                            critical: Boolean(resolution.attackTest?.critical),
                            directKnockout: resolution.directKnockout || isDirectKnockoutMove(move),
                        })
                        : null;
                    targetResults.push({ target: currentTarget, resolution, previewHitKill });
                }
            }

            const connected = targetResults.some(entry => entry.resolution.moveConnected);
            const damageHit = targetResults.some(entry => entry.resolution.damageHit);
            const representative = targetResults[0].resolution;
            const previewDamage = targetResults.reduce(
                (sum, entry) => sum + (Number(entry.previewHitKill?.appliedDamage) || 0),
                0,
            );
            const nextResult = {
                ...representative,
                hit: connected,
                moveConnected: connected,
                damageHit,
                move,
                targetResults,
                consequences: role === "narrator" ? consequences : null,
                previewDamage,
            };
            setResult(nextResult);

            if (role === "narrator") {
                const fieldChange = consequences.fieldChange;
                onSnapshotChange({
                    ...snapshot,
                    ...(fieldChange?.weather ? { weather: fieldChange.weather } : {}),
                    ...(fieldChange?.terrain ? { terrain: fieldChange.terrain } : {}),
                    tokens: workingTokens,
                });
                await onEvent("move", {
                    attackerName: attacker.name,
                    attackerId: attacker.id,
                    defenderName: affectedTargets.map(token => token.name).join(", ") || representative.profile.target.label,
                    defenderId: defender?.id || "",
                    moveName: formatName(move.name),
                    hit: connected,
                    moveConnected: connected,
                    damageHit,
                    effectOnly: representative.profile.effectOnly,
                    resolutionLabel: representative.resolutionLabel,
                    damage: consequences.damage,
                    calculatedDamage: consequences.calculatedDamage,
                    hitKillThreshold: consequences.hitKillThreshold,
                    hitKillProtected: consequences.hitKillProtected,
                    fainted: consequences.fainted,
                    status: consequences.appliedStatuses[0] || "",
                    ppAfter: consequences.ppAfter,
                    fumble: targetResults.some(entry => entry.resolution.attackTest?.fumble),
                });
                if (connected) {
                    const critical = targetResults.some(entry => entry.resolution.attackTest?.critical);
                    const healedOnly = consequences.healed > 0 && !consequences.damage;
                    await onEvent("sfx", {
                        effectId: critical ? "critical" : healedOnly ? "heal" : representative.profile.effectOnly ? "confirm" : "hit",
                        label: critical ? "Crítico" : healedOnly ? "Cura" : representative.profile.effectOnly ? "Efeito" : "Impacto",
                    });
                }
            } else {
                await onEvent("roll", {
                    label: `simulação de ${formatName(move.name)}`,
                    result: targetResults.map(entry => resolutionRollLabel(entry.resolution)).join("; "),
                    damage: previewDamage,
                    calculatedDamage: targetResults.reduce((sum, entry) => sum + entry.resolution.damage, 0),
                    hitKillProtected: targetResults.some(entry => entry.previewHitKill?.protectedFromKnockout),
                    attackerId: attacker.id,
                    defenderId: defender?.id || "",
                });
            }
        } catch (error) {
            onError?.(error);
        } finally {
            setRunning(false);
        }
    };

    const targetDescription = resolutionProfile
        ? resolutionProfile.target.requiresSelection
            ? "Escolha quem recebe o movimento."
            : resolutionProfile.target.recipient === "group"
                ? `${resolutionProfile.target.label}: ${affectedTargets.length} alvo(s) em cena.`
                : `${resolutionProfile.target.label}; não exige selecionar um adversário.`
        : "Abra um movimento para conferir seus alvos.";

    return (
        <details className="room-tool">
            <summary>
                <span>
                    <small>Assistente Rotom</small>
                    <strong>Resolver um movimento</strong>
                </span>
                <span className="room-tool-badge">Rotom</span>
            </summary>
            <div className="room-tool-body">
                <div className="combat-grid">
                    <label>
                        <span>Usuário</span>
                        <select value={attackerId} onChange={event => { setAttackerId(event.target.value); setResult(null); }}>
                            {tokens.map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                        </select>
                    </label>
                    {resolutionProfile?.target.requiresSelection && (
                        <label>
                            <span>Alvo</span>
                            <select value={defenderId} onChange={event => { setDefenderId(event.target.value); setResult(null); }}>
                                {!selectableTargets.length && <option value="">Nenhum alvo válido</option>}
                                {selectableTargets.map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                            </select>
                        </label>
                    )}
                    <label>
                        <span>Movimento</span>
                        <select value={moveName} onChange={event => void selectMove(event.target.value)}>
                            {!moves.length && <option value="">Nenhum movimento</option>}
                            {moves.map(move => <option key={move} value={move}>{formatName(move)}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Situação da disputa</span>
                        <select
                            value={resolutionProfile?.requiresDamageContest ? mode : "normal"}
                            disabled={Boolean(resolutionProfile && !resolutionProfile.requiresDamageContest)}
                            onChange={event => setMode(event.target.value)}
                        >
                            {resolutionProfile && !resolutionProfile.requiresDamageContest
                                ? <option value="normal">Não usa disputa</option>
                                : <>
                                    <option value="normal">Normal</option>
                                    <option value="advantage">Vantagem</option>
                                    <option value="disadvantage">Desvantagem</option>
                                </>}
                        </select>
                    </label>
                </div>

                {moveData && (
                    <div className="combat-automation" aria-live="polite">
                        <span>{formatType(moveData.type?.name)}</span>
                        <span>{formatDamageClass(moveData.damage_class?.name)}</span>
                        <span>PP {formatNumberPtBr(ppState.remaining ?? moveData.pp ?? 0)}/{formatNumberPtBr(ppState.maximum ?? moveData.pp ?? 0)}</span>
                        {automationTags.map(tag => <span key={tag}>{tag}</span>)}
                        {declaring && <span className="is-syncing">Preparando a prioridade…</span>}
                    </div>
                )}
                <p className="combat-target-note">{targetDescription}</p>
                {!canControlAttacker && role === "player" && (
                    <p className="combat-permission-note">Você pode testar este Pokémon aqui. Para declarar o movimento na rodada, escolha um Pokémon sob seu controle.</p>
                )}
                <button type="button" className="room-primary-button" disabled={!canResolve || running || declaring} onClick={resolve}>
                    {outOfPp
                        ? "Sem PP para este movimento"
                        : running
                            ? "Calculando a jogada…"
                            : role === "narrator"
                                ? `Resolver: ${resolutionProfile?.resolutionLabel || "movimento"}`
                                : "Simular e compartilhar"}
                </button>
                {result && (
                    <div className={`combat-result ${result.moveConnected ? "is-hit" : "is-miss"}`} aria-live="polite">
                        <div>
                            <small>Forma de resolução</small>
                            <strong>{result.resolutionLabel}</strong>
                        </div>
                        <div>
                            <small>Dano {role === "narrator" ? "aplicado" : "simulado"}</small>
                            <strong>{formatNumberPtBr(result.consequences?.damage ?? result.previewDamage ?? 0)}</strong>
                        </div>

                        <div className="combat-target-results">
                            {result.targetResults.map((entry, index) => {
                                const resolution = entry.resolution;
                                const targetName = entry.target?.name || resolution.profile.target.label;
                                return (
                                    <article key={entry.target?.id || `field-${index}`}>
                                        <strong>{targetName}</strong>
                                        {resolution.attackTest && resolution.defenseTest && (
                                            <span>Disputa {resolution.attackTest.total} × {resolution.defenseTest.total}: {resolution.contestSuccess ? "ataque venceu" : "defesa venceu"}.</span>
                                        )}
                                        <span>
                                            {resolution.accuracyTest.automatic
                                                ? "Sem teste de precisão."
                                                : `Precisão ${resolution.accuracyTest.result}/${resolution.accuracyTest.chance}${resolution.accuracyTest.rolls.length > 1 ? " com dois d100" : ""}.`}
                                            {resolution.accuracyState.baseAccuracy != null && resolution.accuracyState.baseAccuracy !== resolution.adjustedAccuracy
                                                ? ` Base ${resolution.accuracyState.baseAccuracy}%, ajustada por Precisão/Evasão.`
                                                : ""}
                                        </span>
                                        {resolution.profile.requiresDamageContest && (
                                            <span>{modifierLabel(resolution.effectiveness)}; STAB {formatNumberPtBr(resolution.stab)}×; limite comum {formatNumberPtBr(resolution.ceiling)}.</span>
                                        )}
                                        {resolution.typeBlocked && <span>Imunidade de tipo impediu o movimento.</span>}
                                        {resolution.moveConnected && !resolution.damageHit && resolution.profile.requiresDamageContest && (
                                            <span>O movimento alcançou o alvo, mas a defesa impediu o dano; efeitos secundários ainda são resolvidos.</span>
                                        )}
                                        {resolution.manualDamage && <span>Este dano depende da ação anterior; registre manualmente o valor devolvido.</span>}
                                        {resolution.attackerStagesIgnored && <span>Unaware ignorou os estágios ofensivos do usuário.</span>}
                                        {resolution.defenderStagesIgnored && <span>Unaware ignorou os estágios defensivos do alvo.</span>}
                                    </article>
                                );
                            })}
                        </div>

                        {result.consequences && (
                            <ul className="combat-consequences">
                                {result.consequences.ppAfter != null && <li>{formatRemainingPp(result.consequences.ppAfter)}</li>}
                                {result.consequences.healed > 0 && <li>Recuperou {formatNumberPtBr(result.consequences.healed)} HP.</li>}
                                {result.consequences.recoil > 0 && <li>Perdeu {formatNumberPtBr(result.consequences.recoil)} HP com o recuo.</li>}
                                {result.consequences.appliedStatuses.map((status, index) => <li key={`${status}-${index}`}>Condição: {STATUS_LABELS[status] || formatName(status)}.</li>)}
                                {result.consequences.blockedStatuses.map((reason, index) => <li key={`${reason}-${index}`}>Condição impedida: {reason}.</li>)}
                                {result.consequences.trackedEffects.includes("yawn") && <li>Bocejo marcado: o sono será verificado no encerramento da próxima rodada.</li>}
                                {result.consequences.trackedEffects.filter(effect => effect !== "yawn").map(effect => (
                                    <li key={effect}>{formatName(effect)} registrado até o fim da rodada.</li>
                                ))}
                                {stageSummary(result.consequences.stageChanges) && <li>Mudanças de atributo: {stageSummary(result.consequences.stageChanges)}.</li>}
                                {result.consequences.fieldChange?.weather && <li>Clima alterado para {formatName(result.consequences.fieldChange.weather)}.</li>}
                                {result.consequences.fieldChange?.terrain && <li>Terreno alterado para {formatName(result.consequences.fieldChange.terrain)}.</li>}
                                {result.consequences.hitKillProtected && <li>Proteção contra hit kill: o cálculo chegou a {formatNumberPtBr(result.consequences.calculatedDamage)} de dano; o alvo permaneceu com 1 HP.</li>}
                                {result.targetResults.some(entry => entry.resolution.attackTest?.fumble) && <li>Erro crítico: escolha uma consequência coerente com a cena; o MyOwnDex não toma essa decisão pelo grupo.</li>}
                                {result.consequences.fainted && <li>Um alvo não pode mais batalhar.</li>}
                            </ul>
                        )}
                        {!result.consequences && result.targetResults.some(entry => entry.previewHitKill?.protectedFromKnockout) && (
                            <ul className="combat-consequences">
                                <li>A prévia aplicou a proteção contra hit kill e manteria o alvo com 1 HP.</li>
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}
