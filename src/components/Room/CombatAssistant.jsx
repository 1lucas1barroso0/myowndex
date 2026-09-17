import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    fetchCached,
    formatDamageClass,
    formatName,
    formatNumberPtBr,
    formatType,
} from "../../core/mechanics.js";
import {
    getAffectedMoveTargets,
    getMoveAutomationTags,
    getMovePpState,
    getMoveResolutionProfile,
    getSelectableMoveTargets,
    STAGE_LABELS,
} from "../../core/automation.js";
import { formatCount, formatRemainingPp } from "../../core/copy.js";
import { integerInRange, MAX_SAFE_GAME_INTEGER } from "../../core/math.js";
import { STATUS_LABELS } from "../../core/room.js";
import { resolveCombatAction } from "../../../server/authoritativeActions.js";
import {
    getMoveSpecialProfile,
    getSpecialMoveBlockReason,
    SPECIAL_AUTOMATION_LABELS,
} from "../../core/specialMechanics.js";
import { getTraitMoveBlock } from "../../core/traitMechanics.js";

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


export default function CombatAssistant({
    role,
    playerId,
    snapshot,
    selectedTokenId,
    remote,
    onAuthoritativeAction,
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
    const resolveInFlight = useRef(false);
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
        if (!canResolve || resolveInFlight.current) return;
        resolveInFlight.current = true;
        setRunning(true);
        try {
            const move = resolvedMoveData || await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(moveName)}`);
            if (!move) throw new Error("A Pokédex não conseguiu abrir este movimento agora.");
            if (remote) {
                const authoritative = await onAuthoritativeAction({
                    action: "combat",
                    attackerId: attacker.id,
                    defenderId: defender?.id || "",
                    moveName: moveData.name,
                    calledMoveName: needsCalledMove ? move.name : "",
                    mode,
                });
                setResult(authoritative.result);
                return;
            }
            const resolved = resolveCombatAction({
                snapshot, role,
                request: { attackerId: attacker.id, defenderId: defender?.id || "", moveName: moveData.name, calledMoveName: needsCalledMove ? move.name : "", mode },
                move: moveData, calledMove: needsCalledMove ? move : null,
            });
            setResult(resolved.result);
            if (resolved.nextSnapshot) onSnapshotChange(resolved.nextSnapshot);
            await onEvent(resolved.eventType, resolved.eventPayload);
            if (resolved.sfxPayload) await onEvent("sfx", resolved.sfxPayload);
        } catch (error) {
            onError?.(error);
        } finally {
            resolveInFlight.current = false;
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
                (sum, entry) => sum + integerInRange(entry.previewHitKill?.calculatedDamage ?? entry.resolution.damage, 0, MAX_SAFE_GAME_INTEGER, 0),
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
                        {result.conditionNotes?.map(note => <p key={note}>{note}</p>)}
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
                                        {resolution.criticalHit && <span className="combat-damage-exception">Acerto crítico: o limite comum e a proteção contra Hit Kill não se aplicam.</span>}
                                        {resolution.attackTest?.critical && !resolution.criticalHit && <span>Dois 6: crítico potencial, mas sem acerto com dano.</span>}
                                        {resolution.damageHit && resolution.defenseTest?.fumble && <span className="combat-damage-exception">Erro crítico do defensor: a proteção contra Hit Kill não se aplica.</span>}
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
                                {result.consequences.recoil > 0 && <li>Perdeu {formatNumberPtBr(result.consequences.recoil)} HP com recuo ou custo próprio.</li>}
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
                                {result.consequences.traitProtected && <li className="combat-consequence-trait">Habilidade ou item de sobrevivência protegeu no {result.consequences.traitProtectedHits.map(hit => `${hit}º hit`).join(", ") || "dano seguinte"}. É uma proteção própria do efeito.</li>}
                                {result.consequences.hitKillProtected && (
                                    <li className="combat-consequence-hit-kill">
                                        Proteção contra Hit Kill consumida no {result.consequences.hitKillProtectedHits.map(hit => `${hit}º hit`).join(", ") || "impacto fatal"}: calculado {formatNumberPtBr(result.consequences.calculatedDamage)}, aplicado {formatNumberPtBr(result.consequences.damage)}. {result.consequences.fainted ? `Outro hit derrotou o alvo${result.consequences.faintedOnHit ? ` no ${result.consequences.faintedOnHit}º hit` : " depois"}.` : "O alvo terminou a sequência em combate."}
                                    </li>
                                )}
                                {result.consequences.survivalGraceRemaining && <li className="combat-consequence-trait">Sturdy, Focus Sash ou efeito equivalente segue disponível como proteção adicional; somente o próximo dano positivo encerrará essa elegibilidade.</li>}
                                {result.consequences.survivalGraceUsed && !result.consequences.survivalGraceRemaining && <li className="combat-consequence-trait">O dano seguinte encerrou a elegibilidade adicional preservada; quando o efeito era aplicável, ele protegeu antes de se encerrar.</li>}
                                {result.consequences.protectionDisabledThisAction.map(entry => <li className="combat-consequence-hit-kill" key={`hit-kill-disabled-${entry.key}`}>{entry.tokenName} perdeu a proteção geral nesta batalha porque reduziu o próprio HP. Cura e troca não a restauram.</li>)}
                                {result.targetResults.some(entry => entry.resolution.attackTest?.fumble) && <li>Erro crítico: escolha uma consequência coerente com a cena; o MyOwnDex não toma essa decisão pelo grupo.</li>}
                                {result.consequences.fainted && <li>Um alvo não pode mais batalhar.</li>}
                            </ul>
                        )}
                        {!result.consequences && result.targetResults.some(entry => entry.previewHitKill?.protectedFromKnockout) && (
                            <ul className="combat-consequences">
                                <li className="combat-consequence-hit-kill">Prévia da proteção contra Hit Kill: calculado {formatNumberPtBr(resultCalculatedDamage)}, simulado {formatNumberPtBr(resultAppliedDamage)}. A proteção agiria por hit; {result.targetResults.some(entry => entry.previewHitKill?.faintedOnHit) ? "um hit posterior ainda derrotaria o alvo." : "o alvo terminaria a sequência em combate."}</li>
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}
