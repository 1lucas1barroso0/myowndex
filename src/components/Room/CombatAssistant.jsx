import React, { useEffect, useMemo, useState } from "react";
import {
    fetchCached,
    formatDamageClass,
    formatName,
    formatNumberPtBr,
    formatType,
} from "../../core/mechanics.js";
import {
    applyMoveConsequences,
    getAffectedMoveTargets,
    getHitKillProtectionKey,
    hasHitKillSurvivalGrace,
    getMoveAutomationTags,
    getMovePpState,
    getMoveResolutionProfile,
    getSelectableMoveTargets,
    isDirectKnockoutMove,
    resolveKnockoutProtection,
    STAGE_LABELS,
} from "../../core/automation.js";
import { formatCount, formatRemainingPp } from "../../core/copy.js";
import { calculateMoveResolution, STATUS_LABELS } from "../../core/room.js";
import {
    getMoveSpecialProfile,
    getSpecialMoveBlockReason,
    SPECIAL_AUTOMATION_LABELS,
} from "../../core/specialMechanics.js";
import { getTraitMoveBlock, isWeatherSuppressed } from "../../core/traitMechanics.js";

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
    hitKillBypassedByAttackerCritical: false,
    hitKillBypassedByDefenderFumble: false,
    hitKillThreshold: 0,
    fainted: false,
    fieldChange: null,
    scheduledDamage: 0,
    specialNarratives: [],
    abilityBlocks: [],
    abilityDamage: 0,
    itemDamage: 0,
    traitHealing: 0,
    traitProtected: false,
    survivalGraceGranted: false,
    survivalGraceUsed: false,
    traitActivations: [],
    consumedItems: [],
    traitStatuses: [],
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
    hitKillBypassedByAttackerCritical: summary.hitKillBypassedByAttackerCritical || Boolean(current.hitKillBypassedByAttackerCritical),
    hitKillBypassedByDefenderFumble: summary.hitKillBypassedByDefenderFumble || Boolean(current.hitKillBypassedByDefenderFumble),
    hitKillThreshold: Math.max(summary.hitKillThreshold, Number(current.hitKillThreshold) || 0),
    fainted: summary.fainted || Boolean(current.fainted),
    fieldChange: current.fieldChange || summary.fieldChange,
    scheduledDamage: summary.scheduledDamage + (Number(current.scheduledDamage) || 0),
    specialNarratives: [...summary.specialNarratives, ...(current.specialNarratives || [])],
    abilityBlocks: current.abilityBlock
        ? [...summary.abilityBlocks, current.abilityBlock]
        : summary.abilityBlocks,
    abilityDamage: summary.abilityDamage + (Number(current.abilityDamage) || 0),
    itemDamage: summary.itemDamage + (Number(current.itemDamage) || 0),
    traitHealing: summary.traitHealing + (Number(current.traitHealing) || 0),
    traitProtected: summary.traitProtected || Boolean(current.traitProtected),
    survivalGraceGranted: summary.survivalGraceGranted || Boolean(current.survivalGraceGranted),
    survivalGraceUsed: summary.survivalGraceUsed || Boolean(current.survivalGraceUsed),
    traitActivations: [...summary.traitActivations, ...(current.traitActivations || [])],
    consumedItems: [...summary.consumedItems, ...(current.consumedItems || [])],
    traitStatuses: [...summary.traitStatuses, ...(current.traitStatuses || [])],
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
    const [calledMoveName, setCalledMoveName] = useState("");
    const [calledMoveData, setCalledMoveData] = useState(null);
    const [loadingCalledMove, setLoadingCalledMove] = useState(false);
    const tokens = snapshot.tokens;
    const attacker = tokens.find(token => token.id === attackerId);
    const defender = tokens.find(token => token.id === defenderId);
    const activeTokenExists = Boolean(activeId && tokens.some(token => token.id === activeId));

    useEffect(() => {
        if (activeTokenExists) setAttackerId(activeId);
    }, [activeId, activeTokenExists]);

    useEffect(() => {
        setCalledMoveName("");
        setCalledMoveData(null);
        setResult(null);
    }, [attackerId, moveName]);

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
    const specialProfile = useMemo(() => getMoveSpecialProfile(moveData), [moveData]);
    const needsCalledMove = specialProfile?.id === "called-move";
    const resolvedMoveData = needsCalledMove ? calledMoveData : moveData;
    const resolutionProfile = useMemo(
        () => resolvedMoveData ? getMoveResolutionProfile(resolvedMoveData) : null,
        [resolvedMoveData],
    );
    const selectableTargets = useMemo(
        () => resolvedMoveData ? getSelectableMoveTargets(tokens, attacker, resolvedMoveData) : [],
        [tokens, attacker, resolvedMoveData],
    );
    const affectedTargets = useMemo(
        () => resolvedMoveData ? getAffectedMoveTargets(tokens, attacker, defender, resolvedMoveData) : [],
        [tokens, attacker, defender, resolvedMoveData],
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
    const originalSpecialBlock = moveData
        ? getSpecialMoveBlockReason({ move: moveData, attacker, defender, round: snapshot.round })
        : "";
    const originalTraitBlock = moveData ? getTraitMoveBlock({ move: moveData, attacker, defender }) : null;
    const canResolve = Boolean(
        attacker
        && moveName
        && moveData
        && resolvedMoveData
        && resolutionProfile
        && hasRequiredTarget
        && !outOfPp
        && !originalSpecialBlock
        && !originalTraitBlock?.attackerBlocked
    );
    const automationTags = getMoveAutomationTags(resolvedMoveData);

    const selectMove = async name => {
        setMoveName(name);
        setMoveData(null);
        setResult(null);
        setCalledMoveName("");
        setCalledMoveData(null);
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

    const loadCalledMove = async () => {
        const name = calledMoveName.trim().toLowerCase().replace(/\s+/g, "-");
        if (!name) return;
        setLoadingCalledMove(true);
        setCalledMoveData(null);
        setResult(null);
        try {
            const detail = await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`);
            if (!detail) throw new Error("Esse movimento resultante não foi encontrado.");
            setCalledMoveData(detail);
            setCalledMoveName(detail.name);
        } catch (error) {
            onError?.(error);
        } finally {
            setLoadingCalledMove(false);
        }
    };

    const resolve = async () => {
        if (!canResolve) return;
        setRunning(true);
        try {
            const move = resolvedMoveData || await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveName)}`);
            if (!move) throw new Error("A Pokédex não conseguiu abrir este movimento agora.");
            const targetsToResolve = affectedTargets.length ? affectedTargets : [null];
            let workingTokens = snapshot.tokens;
            let workingHitKillProtectionUsed = snapshot.hitKillProtectionUsed;
            let workingHitKillSurvivalGrace = snapshot.hitKillSurvivalGrace;
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
                    round: snapshot.round,
                    weather: snapshot.weather,
                    terrain: snapshot.terrain,
                    weatherSuppressed: isWeatherSuppressed(workingTokens),
                });

                if (role === "narrator") {
                    const automated = applyMoveConsequences({
                        tokens: workingTokens,
                        attackerId: attacker.id,
                        targetId: currentTarget?.id,
                        move,
                        ppMove: moveData,
                        resolution,
                        consumePp: index === 0,
                        applySelfChanges: index === 0,
                        clearDeclaration: index === targetsToResolve.length - 1,
                        round: snapshot.round,
                        hitKillProtectionUsed: workingHitKillProtectionUsed,
                        hitKillSurvivalGrace: workingHitKillSurvivalGrace,
                    });
                    workingTokens = automated.tokens;
                    workingHitKillProtectionUsed = automated.hitKillProtectionUsed;
                    workingHitKillSurvivalGrace = automated.hitKillSurvivalGrace;
                    consequences = addConsequences(consequences, automated.consequences);
                    targetResults.push({ target: currentTarget, resolution, consequences: automated.consequences });
                } else {
                    const previewHitKill = currentTarget
                        ? resolveKnockoutProtection({
                            token: currentTarget,
                            damage: resolution.damageHit ? resolution.damage : 0,
                            hitCount: Number(resolution.hitCount) || 1,
                            round: snapshot.round,
                            protectionUsed: snapshot.hitKillProtectionUsed.includes(
                                getHitKillProtectionKey(currentTarget),
                            ),
                            survivalGrace: hasHitKillSurvivalGrace(
                                snapshot.hitKillSurvivalGrace,
                                currentTarget,
                            ),
                            critical: Boolean(resolution.attackTest?.critical),
                            defenderFumble: Boolean(resolution.defenseTest?.fumble),
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
                    hitKillProtectionUsed: workingHitKillProtectionUsed,
                    hitKillSurvivalGrace: workingHitKillSurvivalGrace,
                });
                await onEvent("move", {
                    attackerName: attacker.name,
                    attackerId: attacker.id,
                    defenderName: affectedTargets.map(token => token.name).join(", ") || representative.profile.target.label,
                    defenderId: defender?.id || "",
                    moveName: formatName(move.name),
                    selectedMoveName: formatName(moveData.name),
                    calledMoveName: needsCalledMove ? formatName(move.name) : "",
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
                    defenderFumble: consequences.hitKillBypassedByDefenderFumble,
                    specialNarrative: consequences.specialNarratives.join(" "),
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

    const targetDescription = needsCalledMove && !calledMoveData
        ? "Confirme qual movimento foi chamado para revelar alvo, precisão e forma de resolução."
        : resolutionProfile
        ? resolutionProfile.target.requiresSelection
            ? defender
                ? `${defender.name || "O Pokémon escolhido"} receberá o movimento.`
                : "Escolha quem recebe o movimento."
            : resolutionProfile.target.recipient === "group"
                ? `${resolutionProfile.target.label}: ${formatCount(affectedTargets.length, "alvo")} em cena.`
                : `${resolutionProfile.target.label}; não exige selecionar um adversário.`
        : "Abra um movimento para conferir seus alvos.";
    const resultCeilings = result
        ? [...new Set(result.targetResults
            .filter(entry => entry.resolution.profile.requiresDamageContest)
            .map(entry => formatNumberPtBr(entry.resolution.ceiling)))]
        : [];
    const resultCalculatedDamage = result
        ? result.consequences?.calculatedDamage
            ?? result.targetResults.reduce(
                (sum, entry) => sum + (Number(entry.previewHitKill?.calculatedDamage ?? entry.resolution.damage) || 0),
                0,
            )
        : 0;
    const resultAppliedDamage = result
        ? result.consequences?.damage ?? result.previewDamage ?? 0
        : 0;

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

                {specialProfile && (
                    <section className={`combat-special-card is-${specialProfile.automation}`} aria-live="polite">
                        <header>
                            <span>Mecânica excepcional</span>
                            <b>{SPECIAL_AUTOMATION_LABELS[specialProfile.automation]}</b>
                        </header>
                        <strong>{specialProfile.title}</strong>
                        <p>{specialProfile.summary}</p>
                        {specialProfile.rules?.length > 0 && (
                            <ul>
                                {specialProfile.rules.map(rule => <li key={rule}>{rule}</li>)}
                            </ul>
                        )}
                        {needsCalledMove && (
                            <div className="combat-called-move">
                                <label>
                                    <span>Movimento resultante</span>
                                    <input
                                        value={calledMoveName}
                                        onChange={event => { setCalledMoveName(event.target.value); setCalledMoveData(null); setResult(null); }}
                                        onKeyDown={event => {
                                            if (event.key !== "Enter") return;
                                            event.preventDefault();
                                            void loadCalledMove();
                                        }}
                                        placeholder="Ex.: flamethrower"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                    />
                                </label>
                                <button type="button" disabled={!calledMoveName.trim() || loadingCalledMove} onClick={() => void loadCalledMove()}>
                                    {loadingCalledMove ? "Consultando…" : calledMoveData ? "Movimento confirmado" : "Confirmar resultado"}
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {resolvedMoveData && (
                    <div className="combat-automation" aria-live="polite">
                        <span>{formatType(resolvedMoveData.type?.name)}</span>
                        <span>{formatDamageClass(resolvedMoveData.damage_class?.name)}</span>
                        <span>PP {formatNumberPtBr(ppState.remaining ?? moveData.pp ?? 0)}/{formatNumberPtBr(ppState.maximum ?? moveData.pp ?? 0)}</span>
                        {needsCalledMove && calledMoveData && <span>Chamado por {formatName(moveData.name)}</span>}
                        {automationTags.map(tag => <span key={tag}>{tag}</span>)}
                        {declaring && <span className="is-syncing">Preparando a prioridade…</span>}
                    </div>
                )}
                <p className="combat-target-note">{targetDescription}</p>
                {originalSpecialBlock && <p className="combat-special-block">Não pode ser resolvido agora: {originalSpecialBlock}.</p>}
                {originalTraitBlock?.attackerBlocked && <p className="combat-special-block">Item ativo: {originalTraitBlock.reason}.</p>}
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
                        <div className="combat-result-metric is-resolution">
                            <small>Forma de resolução</small>
                            <strong>{result.resolutionLabel}</strong>
                        </div>
                        <div className="combat-result-metric is-ceiling">
                            <small>Limite comum</small>
                            <strong className="combat-damage-limit">{resultCeilings.length ? resultCeilings.join(" / ") : "Não se aplica"}</strong>
                        </div>
                        <div className="combat-result-metric is-calculated">
                            <small>Dano calculado</small>
                            <strong>{formatNumberPtBr(resultCalculatedDamage)}</strong>
                        </div>
                        <div className="combat-result-metric is-applied">
                            <small>Dano {role === "narrator" ? "aplicado" : "simulado"}</small>
                            <strong>{formatNumberPtBr(resultAppliedDamage)}</strong>
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
                                            <span className="combat-damage-math">
                                                <span>{modifierLabel(resolution.effectiveness)}; STAB {formatNumberPtBr(resolution.stab)}×.</span>
                                                <strong className="combat-damage-limit">Limite comum: {formatNumberPtBr(resolution.ceiling)} por acerto.</strong>
                                                {resolution.rawDamagePerHit > resolution.damagePerHit && (
                                                    <span>O cálculo chegou a {formatNumberPtBr(resolution.rawDamagePerHit)} por acerto antes do limite.</span>
                                                )}
                                            </span>
                                        )}
                                        {resolution.attackTest?.critical && <span className="combat-damage-exception">Acerto crítico: o limite comum e a proteção contra Hit Kill não se aplicam.</span>}
                                        {resolution.defenseTest?.fumble && <span className="combat-damage-exception">Erro crítico do defensor: a proteção contra Hit Kill não se aplica.</span>}
                                        {resolution.directKnockout && <span className="combat-damage-exception">Nocaute direto: ignora o limite comum e a proteção geral contra Hit Kill; efeitos próprios, como Sturdy ou Focus Sash, são resolvidos separadamente.</span>}
                                        {resolution.fixedDamage != null && <span className="combat-damage-exception">Dano fixo: usa o valor próprio do movimento em vez do limite comum.</span>}
                                        {resolution.dynamicPower && <span>Poder situacional {formatNumberPtBr(resolution.power)}: {resolution.dynamicPower.explanation}.</span>}
                                        {resolution.statProfile?.explanation && <span>{resolution.statProfile.explanation}.</span>}
                                        {resolution.flashFireMultiplier > 1 && <span>Flash Fire fortaleceu o dano em {formatNumberPtBr(resolution.flashFireMultiplier)}×.</span>}
                                        {resolution.traitModifiers?.entries.map((modifier, modifierIndex) => (
                                            <span key={`${modifier.kind}-${modifier.sourceId}-${modifierIndex}`} className="combat-trait-line">
                                                {formatName(modifier.sourceId)}: {modifier.detail} ({formatNumberPtBr(modifier.multiplier)}×).
                                            </span>
                                        ))}
                                        {resolution.accuracyState.traitModifiers?.entries.map((modifier, modifierIndex) => (
                                            <span key={`accuracy-${modifier.sourceId}-${modifierIndex}`} className="combat-trait-line">
                                                {formatName(modifier.sourceId)}: {modifier.detail} na precisão ({formatNumberPtBr(modifier.multiplier)}×).
                                            </span>
                                        ))}
                                        {resolution.multiHitTraits?.source && <span className="combat-trait-line">{formatName(resolution.multiHitTraits.source)} definiu {resolution.hitCount} acertos.</span>}
                                        {resolution.weatherSuppressed && <span className="combat-trait-line">Cloud Nine ou Air Lock manteve o clima visível, mas neutralizou seus efeitos.</span>}
                                        {resolution.typeBlocked && <span>Imunidade de tipo impediu o movimento.</span>}
                                        {resolution.abilityBlock && <span>{resolution.abilityBlock.reason}.</span>}
                                        {resolution.traitBlock && <span>{resolution.traitBlock.reason}.</span>}
                                        {resolution.specialBlockReason && <span>Condição especial não atendida: {resolution.specialBlockReason}.</span>}
                                        {resolution.accuracyState.noGuard && <span>No Guard dispensou o teste de precisão.</span>}
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
                                {result.consequences.abilityDamage > 0 && <li>Perdeu {formatNumberPtBr(result.consequences.abilityDamage)} HP ao ativar a própria habilidade.</li>}
                                {result.consequences.itemDamage > 0 && <li>Perdeu {formatNumberPtBr(result.consequences.itemDamage)} HP por um item reativo.</li>}
                                {result.consequences.traitHealing > 0 && <li>Itens ou habilidades recuperaram {formatNumberPtBr(result.consequences.traitHealing)} HP.</li>}
                                {result.consequences.appliedStatuses.map((status, index) => <li key={`${status}-${index}`}>Condição: {STATUS_LABELS[status] || formatName(status)}.</li>)}
                                {result.consequences.traitStatuses.map((entry, index) => <li key={`trait-status-${entry.tokenId}-${index}`}>{formatName(entry.sourceId)} aplicou {STATUS_LABELS[entry.status] || formatName(entry.status)}.</li>)}
                                {result.consequences.blockedStatuses.map((reason, index) => <li key={`${reason}-${index}`}>Condição impedida: {reason}.</li>)}
                                {result.consequences.trackedEffects.includes("yawn") && <li>Bocejo marcado: o sono será verificado no encerramento da próxima rodada.</li>}
                                {result.consequences.trackedEffects.filter(effect => effect !== "yawn").map(effect => (
                                    <li key={effect}>{formatName(effect)} registrado até o fim da rodada.</li>
                                ))}
                                {stageSummary(result.consequences.stageChanges) && <li>Mudanças de atributo: {stageSummary(result.consequences.stageChanges)}.</li>}
                                {result.consequences.fieldChange?.weather && <li>Clima alterado para {formatName(result.consequences.fieldChange.weather)}.</li>}
                                {result.consequences.fieldChange?.terrain && <li>Terreno alterado para {formatName(result.consequences.fieldChange.terrain)}.</li>}
                                {result.consequences.scheduledDamage > 0 && <li>Impacto adiado: {formatNumberPtBr(result.consequences.scheduledDamage)} de dano preparado.</li>}
                                {result.consequences.specialNarratives.map((narrative, index) => <li key={`special-${index}`}>{narrative}</li>)}
                                {result.consequences.consumedItems.length > 0 && (() => {
                                    const items = [...new Set(result.consequences.consumedItems)];
                                    return <li>{formatCount(items.length, "item")} {items.length === 1 ? "consumido ou removido" : "consumidos ou removidos"}: {items.map(formatName).join(", ")}.</li>;
                                })()}
                                {result.consequences.traitProtected && <li className="combat-consequence-trait">Habilidade ou item de sobrevivência: preservou 1 HP. Esta proteção é própria do efeito, não a regra de Hit Kill.</li>}
                                {result.consequences.hitKillProtected && <li className="combat-consequence-hit-kill">Proteção contra Hit Kill consumida nesta batalha: calculado {formatNumberPtBr(result.consequences.calculatedDamage)}, aplicado {formatNumberPtBr(result.consequences.damage)}; o alvo permaneceu com 1 HP.</li>}
                                {result.consequences.survivalGraceGranted && <li className="combat-consequence-trait">Sturdy, Focus Sash ou efeito equivalente permaneceu disponível como proteção adicional; o próximo dano que alcançar o Pokémon encerra essa elegibilidade preservada.</li>}
                                {result.consequences.survivalGraceUsed && <li className="combat-consequence-trait">A proteção adicional preservada após o Hit Kill foi usada e não continuará para outro dano.</li>}
                                {result.targetResults.some(entry => entry.resolution.attackTest?.fumble) && <li>Erro crítico: escolha uma consequência coerente com a cena; o MyOwnDex não toma essa decisão pelo grupo.</li>}
                                {result.consequences.fainted && <li>Um alvo não pode mais batalhar.</li>}
                            </ul>
                        )}
                        {!result.consequences && result.targetResults.some(entry => entry.previewHitKill?.protectedFromKnockout) && (
                            <ul className="combat-consequences">
                                <li className="combat-consequence-hit-kill">Prévia da proteção contra Hit Kill: calculado {formatNumberPtBr(resultCalculatedDamage)}, simulado {formatNumberPtBr(resultAppliedDamage)}; o alvo permaneceria com 1 HP e consumiria a proteção desta batalha.</li>
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}
