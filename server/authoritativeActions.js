import {
    applyMoveConsequences,
    disableHitKillProtection,
    clearHitKillSurvivalGrace,
    getAffectedMoveTargets,
    getHitKillProtectionKey,
    getMovePpState,
    hasHitKillProtectionDisabled,
    hasHitKillSurvivalGrace,
    isDirectKnockoutMove,
    resolveDamageSequence,
} from "../src/core/automation.js";
import { formatName } from "../src/core/mechanics.js";
import { integerInRange, MAX_SAFE_GAME_INTEGER } from "../src/core/math.js";
import { createSecureUint32Source } from "../src/core/random.js";
import {
    advanceInitiative,
    applyEndOfRoundEffects,
    buildInitiative,
    calculateMoveResolution,
    normalizeRoomSnapshot,
} from "../src/core/room.js";
import { getFumbleSuggestion, rollAttributeTest, rollPercentTest } from "../src/core/rpgRules.js";
import { getMoveSpecialProfile, getSpecialMoveBlockReason } from "../src/core/specialMechanics.js";
import { getTraitMoveBlock, isWeatherSuppressed, isAbilityActive } from "../src/core/traitMechanics.js";
import { checkActionConditions } from "../src/core/battleConditions.js";
import { CAPTURE_BALLS, captureTrainerKey, rollCapture } from "../src/core/capture.js";

const ACTIONS = new Set(["quick-attribute", "quick-percent", "initiative", "advance-turn", "combat", "capture"]);
const MODES = new Set(["normal", "advantage", "disadvantage"]);
const STATE_ACTIONS = new Set(["initiative", "advance-turn", "combat", "capture"]);
const COMMON_KEYS = new Set(["requestId", "action"]);
const ACTION_KEYS = Object.freeze({
    "quick-attribute": new Set(["mode", "attribute"]),
    "quick-percent": new Set(["mode", "chance"]),
    initiative: new Set(["expectedRevision"]),
    "advance-turn": new Set(["expectedRevision"]),
    combat: new Set(["expectedRevision", "attackerId", "defenderId", "moveName", "calledMoveName", "mode"]),
    capture: new Set(["expectedRevision", "trainerTokenId", "targetId", "ball", "wildConfirmed"]),
});

export class AuthoritativeActionError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = "AuthoritativeActionError";
        this.status = status;
    }
}

const text = (value, maximum = 100) => typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum)
    : "";

const slug = value => text(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const requiredMode = value => {
    const mode = text(value, 20) || "normal";
    if (!MODES.has(mode)) throw new AuthoritativeActionError("Escolha uma forma válida de rolagem.");
    return mode;
};

const exactInteger = (value, minimum, maximum, label) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
        throw new AuthoritativeActionError(`${label} precisa estar entre ${minimum} e ${maximum}.`);
    }
    return number;
};

export const actionChangesRoomState = action => STATE_ACTIONS.has(action);

export const applyAuthoritativeMovePriorities = (snapshot, movePriorities = new Map()) => {
    const room = normalizeRoomSnapshot(snapshot);
    return {
        ...room,
        tokens: room.tokens.map(token => {
            const declaredMove = token.moves.includes(token.declaredMove) ? token.declaredMove : "";
            return {
                ...token,
                declaredMove,
                priority: declaredMove && movePriorities.has(declaredMove)
                    ? exactInteger(movePriorities.get(declaredMove), -7, 7, "A prioridade do movimento")
                    : 0,
            };
        }),
    };
};

export const normalizeAuthoritativeRequest = input => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AuthoritativeActionError("Não conseguimos reconhecer esta solicitação de rolagem.");
    }
    const action = text(input.action, 30);
    if (!ACTIONS.has(action)) throw new AuthoritativeActionError("Esta rolagem não está disponível.");
    const requestId = text(input.requestId, 100);
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) {
        throw new AuthoritativeActionError("Esta solicitação precisa de um identificador válido.");
    }
    const allowed = ACTION_KEYS[action];
    for (const key of Object.keys(input)) {
        if (!COMMON_KEYS.has(key) && !allowed.has(key)) {
            throw new AuthoritativeActionError("O servidor não aceita dados de resultado enviados pelo aparelho.");
        }
    }

    if (action === "quick-attribute") {
        return {
            requestId,
            action,
            mode: requiredMode(input.mode),
            attribute: exactInteger(input.attribute ?? 0, -20, 99, "O atributo"),
        };
    }
    if (action === "quick-percent") {
        return {
            requestId,
            action,
            mode: requiredMode(input.mode),
            chance: exactInteger(input.chance ?? 50, 0, 100, "A chance"),
        };
    }

    const expectedRevision = exactInteger(
        input.expectedRevision,
        0,
        Number.MAX_SAFE_INTEGER,
        "A revisão da aventura",
    );
    if (action === "capture") {
        const trainerTokenId = text(input.trainerTokenId, 100), targetId = text(input.targetId, 100), ball = slug(input.ball);
        if (!trainerTokenId || !targetId || input.wildConfirmed !== true || !Object.hasOwn(CAPTURE_BALLS, ball)) {
            throw new AuthoritativeActionError("Confirme o Treinador, o alvo selvagem e a Poké Ball.");
        }
        return { requestId, action, expectedRevision, trainerTokenId, targetId, ball, wildConfirmed: true };
    }
    if (action !== "combat") return { requestId, action, expectedRevision };

    const attackerId = text(input.attackerId, 100);
    const defenderId = text(input.defenderId, 100);
    const moveName = slug(input.moveName);
    const calledMoveName = slug(input.calledMoveName);
    if (!attackerId || !moveName) {
        throw new AuthoritativeActionError("Escolha o Pokémon e o movimento antes de resolver a jogada.");
    }
    return {
        requestId,
        action,
        expectedRevision,
        attackerId,
        defenderId,
        moveName,
        calledMoveName,
        mode: requiredMode(input.mode),
    };
};

export const requestFingerprintPayload = request => {
    const payload = { ...request };
    delete payload.requestId;
    return payload;
};

export const createAuditedSecureRandom = (cryptoSource = globalThis.crypto) => {
    const nextUint32 = createSecureUint32Source(cryptoSource);
    const draws = [];
    return {
        source: {
            nextUint32,
            onInt: ({ maximum, value }) => draws.push({ kind: "integer", outcomes: maximum, zeroBasedOutcome: value }),
            onUnit: ({ value }) => draws.push({ kind: "unit", outcome: value }),
        },
        draws,
    };
};

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
    survivalGraceRemaining: false,
    protectionDisabledThisAction: [],
    indirectHitKillProtections: [],
    hitKillProtectedHits: [],
    traitProtectedHits: [],
    faintedOnHit: null,
    traitActivations: [],
    consumedItems: [],
    traitStatuses: [],
});

const addConsequences = (summary, current) => ({
    ...summary,
    ppAfter: summary.ppAfter ?? current.ppAfter,
    damage: summary.damage + integerInRange(current.damage, 0, MAX_SAFE_GAME_INTEGER, 0),
    calculatedDamage: summary.calculatedDamage + integerInRange(current.calculatedDamage, 0, MAX_SAFE_GAME_INTEGER, 0),
    healed: summary.healed + integerInRange(current.healed, 0, MAX_SAFE_GAME_INTEGER, 0),
    recoil: summary.recoil + integerInRange(current.recoil, 0, MAX_SAFE_GAME_INTEGER, 0),
    stageChanges: [...summary.stageChanges, ...(current.stageChanges || [])],
    appliedStatuses: current.appliedStatus ? [...summary.appliedStatuses, current.appliedStatus] : summary.appliedStatuses,
    blockedStatuses: current.blockedStatus ? [...summary.blockedStatuses, current.blockedStatus] : summary.blockedStatuses,
    trackedEffects: current.trackedEffect ? [...summary.trackedEffects, current.trackedEffect] : summary.trackedEffects,
    hitKillProtected: summary.hitKillProtected || Boolean(current.hitKillProtected),
    hitKillBypassedByAttackerCritical: summary.hitKillBypassedByAttackerCritical || Boolean(current.hitKillBypassedByAttackerCritical),
    hitKillBypassedByDefenderFumble: summary.hitKillBypassedByDefenderFumble || Boolean(current.hitKillBypassedByDefenderFumble),
    hitKillThreshold: Math.max(summary.hitKillThreshold, integerInRange(current.hitKillThreshold, 0, MAX_SAFE_GAME_INTEGER, 0)),
    fainted: summary.fainted || Boolean(current.fainted),
    fieldChange: current.fieldChange || summary.fieldChange,
    scheduledDamage: summary.scheduledDamage + integerInRange(current.scheduledDamage, 0, MAX_SAFE_GAME_INTEGER, 0),
    specialNarratives: [...summary.specialNarratives, ...(current.specialNarratives || [])],
    abilityBlocks: current.abilityBlock ? [...summary.abilityBlocks, current.abilityBlock] : summary.abilityBlocks,
    abilityDamage: summary.abilityDamage + integerInRange(current.abilityDamage, 0, MAX_SAFE_GAME_INTEGER, 0),
    itemDamage: summary.itemDamage + integerInRange(current.itemDamage, 0, MAX_SAFE_GAME_INTEGER, 0),
    traitHealing: summary.traitHealing + integerInRange(current.traitHealing, 0, MAX_SAFE_GAME_INTEGER, 0),
    traitProtected: summary.traitProtected || Boolean(current.traitProtected),
    survivalGraceGranted: summary.survivalGraceGranted || Boolean(current.survivalGraceGranted),
    survivalGraceUsed: summary.survivalGraceUsed || Boolean(current.survivalGraceUsed),
    survivalGraceRemaining: summary.survivalGraceRemaining || Boolean(current.survivalGraceRemaining),
    protectionDisabledThisAction: [...summary.protectionDisabledThisAction, ...(current.protectionDisabledThisAction || [])],
    indirectHitKillProtections: [...summary.indirectHitKillProtections, ...(current.indirectHitKillProtections || [])],
    hitKillProtectedHits: [...summary.hitKillProtectedHits, ...(current.hitKillProtectedHits || [])],
    traitProtectedHits: [...summary.traitProtectedHits, ...(current.traitProtectedHits || [])],
    faintedOnHit: summary.faintedOnHit || current.faintedOnHit || null,
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

const roundEffectSummary = effect => {
    if (effect.kind === "status") return effect.status
        ? `${effect.tokenName} recebeu ${formatName(effect.status)} por ${effect.sources.join(" e ")}`
        : `${effect.tokenName} teve a condição removida por ${effect.sources.join(" e ")}`;
    if (effect.kind === "heal") return `${effect.tokenName} recuperou ${effect.healed} HP por ${effect.sources.join(" e ")}`;
    if (effect.kind === "perish") return `${effect.tokenName} chegou ao fim da contagem de Perish Song e não pode mais batalhar`;
    if (effect.kind === "state" || effect.kind === "stage") return `${effect.tokenName}: ${effect.sources.join(" e ")}`;
    if (effect.protectedFromKnockout) return `${effect.tokenName} sofreu ${effect.damage} de dano por ${effect.sources.join(" e ")}, mas consumiu a proteção contra Hit Kill`;
    return `${effect.tokenName} perdeu ${effect.damage} HP por ${effect.sources.join(" e ")}${effect.fainted ? " e não pode mais batalhar" : ""}`;
};

const quickAttribute = (request, random) => {
    const test = rollAttributeTest({ mode: request.mode, attribute: request.attribute, random });
    const suggestion = test.fumble ? getFumbleSuggestion(random) : "";
    return {
        result: {
            title: test.critical ? "Crítico potencial" : test.fumble ? "Erro crítico" : `Total ${test.total}`,
            detail: suggestion || `${test.dice.join(" • ")}${test.attribute ? ` + ${test.attribute}` : ""}`,
        },
        nextSnapshot: null,
        audit: {
            type: "attribute",
            mode: test.mode,
            rawDice: test.dice,
            keptDice: test.kept,
            modifiers: { attribute: test.attribute },
            result: test.total,
            success: test.success,
            critical: test.critical,
            fumble: test.fumble,
            fumbleSuggestion: suggestion,
        },
        eventType: "roll",
        eventPayload: {
            label: request.mode === "advantage" ? "teste com vantagem" : request.mode === "disadvantage" ? "teste com desvantagem" : "teste de atributo",
            mode: test.mode,
            result: test.total,
            dice: test.dice,
            kept: test.kept,
            attribute: test.attribute,
            critical: test.critical,
            fumble: test.fumble,
        },
        sfxPayload: null,
    };
};

const quickPercent = (request, random) => {
    const test = rollPercentTest({ chance: request.chance, mode: request.mode, random });
    return {
        result: {
            title: test.success ? "Sucesso" : "Falha",
            detail: `${test.rolls.join(" • ")} contra ${test.chance}%`,
        },
        nextSnapshot: null,
        audit: {
            type: "percent",
            mode: test.mode,
            rawDice: test.rolls,
            keptDice: [test.result],
            chance: test.chance,
            result: test.result,
            success: test.success,
            critical: false,
            fumble: false,
        },
        eventType: "roll",
        eventPayload: {
            label: test.advantage
                ? "teste percentual com vantagem"
                : test.disadvantage
                    ? "teste percentual com desvantagem"
                    : "teste percentual",
            mode: test.mode,
            result: test.result,
            rolls: test.rolls,
            chance: test.chance,
            success: test.success,
        },
        sfxPayload: null,
    };
};

const initiative = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    const generated = buildInitiative(room, random);
    const order = generated.results.map(entry => {
        const token = room.tokens.find(candidate => candidate.id === entry.tokenId);
        const traits = entry.traitState.entries.map(item => formatName(item.sourceId)).join(" + ");
        return `${token?.name || "Pokémon"} (${entry.total}${traits ? `; ${traits}` : ""})`;
    }).join(", ");
    return {
        result: { results: generated.results },
        nextSnapshot: generated.room,
        audit: {
            type: "initiative",
            mode: "normal",
            rawDice: generated.results.map(entry => ({ tokenId: entry.tokenId, dice: entry.dice, tieBreak: entry.tieBreak, tieBreakRolls: entry.tieBreakRolls })),
            modifiers: generated.results.map(entry => ({ tokenId: entry.tokenId, priority: entry.priority, traitState: entry.traitState })),
            chance: null,
            result: generated.room.initiative,
            success: true,
            critical: generated.results.filter(entry => entry.dice.every(value => value === 6)).map(entry => entry.tokenId),
            fumble: generated.results.filter(entry => entry.dice.every(value => value === 1)).map(entry => entry.tokenId),
        },
        eventType: "system",
        eventPayload: { text: `Ordem da rodada: ${order}.` },
        sfxPayload: null,
    };
};

const advanceTurn = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    const closingRound = room.initiative.length > 0 && room.turnIndex >= room.initiative.length - 1;
    const roundEnd = closingRound ? applyEndOfRoundEffects(room, random) : null;
    const nextSnapshot = closingRound
        ? {
            ...roundEnd.room,
            round: room.round + 1,
            turnIndex: 0,
            initiative: [],
            tokens: roundEnd.room.tokens.map(token => ({ ...token, declaredMove: "", priority: 0 })),
        }
        : advanceInitiative(room);
    const activeId = nextSnapshot.initiative[nextSnapshot.turnIndex];
    const active = nextSnapshot.tokens.find(token => token.id === activeId);
    const message = closingRound
        ? `${roundEnd.effects.length ? `${roundEnd.effects.map(roundEffectSummary).join("; ")}. ` : ""}Rodada ${nextSnapshot.round} pronta! Escolha os movimentos para formar a nova ordem.`
        : active
            ? `Turno de ${active.name}. Rodada ${nextSnapshot.round}.`
            : `Rodada ${nextSnapshot.round}.`;
    return {
        result: { closingRound, effects: roundEnd?.effects || [] },
        nextSnapshot,
        audit: {
            type: closingRound ? "end-round" : "advance-turn",
            mode: "normal",
            rawDice: [],
            modifiers: null,
            chance: null,
            result: { round: nextSnapshot.round, turnIndex: nextSnapshot.turnIndex, effects: roundEnd?.effects || [] },
            success: true,
            critical: false,
            fumble: false,
        },
        eventType: "system",
        eventPayload: { text: message },
        sfxPayload: null,
    };
};

export const resolveCombatAction = ({ snapshot, role, request, move, calledMove = null, random = undefined }) => {
    let room = normalizeRoomSnapshot(snapshot);
    const attacker = room.tokens.find(token => token.id === request.attackerId);
    const defender = room.tokens.find(token => token.id === request.defenderId) || null;
    if (!attacker) throw new AuthoritativeActionError("Este Pokémon não está mais na cena.", 409);
    if (!attacker.moves.includes(request.moveName)) {
        throw new AuthoritativeActionError("Escolha um movimento que pertença a este Pokémon.", 403);
    }
    if (!move || slug(move.name) !== request.moveName) {
        throw new AuthoritativeActionError("A Pokédex não conseguiu confirmar este movimento.", 502);
    }
    const specialProfile = getMoveSpecialProfile(move);
    const needsCalledMove = specialProfile?.id === "called-move";
    if (needsCalledMove && (!calledMove || slug(calledMove.name) !== request.calledMoveName)) {
        throw new AuthoritativeActionError("Confirme o movimento resultante antes de resolver a jogada.");
    }
    if (!needsCalledMove && request.calledMoveName) {
        throw new AuthoritativeActionError("Este movimento não aceita um movimento resultante enviado pelo aparelho.");
    }
    const resolvedMove = needsCalledMove ? calledMove : move;
    const ppState = getMovePpState(attacker, move, request.moveName);
    if (ppState.remaining != null && ppState.remaining <= 0) {
        throw new AuthoritativeActionError("Este movimento está sem PP.", 409);
    }
    const specialBlock = getSpecialMoveBlockReason({ move, attacker, defender, round: room.round });
    if (specialBlock) throw new AuthoritativeActionError(`Não pode ser resolvido agora: ${specialBlock}.`, 409);
    const traitBlock = getTraitMoveBlock({ move, attacker, defender });
    if (traitBlock?.attackerBlocked) throw new AuthoritativeActionError(`Item ativo: ${traitBlock.reason}.`, 409);

    const conditionCheck = checkActionConditions({ token: attacker, move, ability: isAbilityActive(attacker) ? attacker.ability : "", random });
    room = {
        ...room,
        tokens: room.tokens.map(token => token.id === attacker.id ? { ...conditionCheck.token, lastActionRound: room.round } : token),
        hitKillProtectionDisabled: conditionCheck.selfDamage > 0 ? disableHitKillProtection(room.hitKillProtectionDisabled, attacker) : room.hitKillProtectionDisabled,
        hitKillSurvivalGrace: conditionCheck.selfDamage > 0 ? clearHitKillSurvivalGrace(room.hitKillSurvivalGrace, attacker) : room.hitKillSurvivalGrace,
    };
    if (!conditionCheck.canAct) {
        const detail = `${attacker.name}: ${conditionCheck.notes.join(" ")}`;
        return {
            result: { targetResults: [], conditionNotes: conditionCheck.notes, blockedByCondition: true, resolutionLabel: "Ação impedida", damage: 0, damageHit: false, moveConnected: false, consequences: role === "narrator" ? emptyConsequences() : null },
            nextSnapshot: role === "narrator" ? room : null,
            audit: { type: "combat", mode: request.mode, rawDice: conditionCheck.rolls, conditionCheck: { canAct: conditionCheck.canAct, notes: conditionCheck.notes, rolls: conditionCheck.rolls, selfDamage: conditionCheck.selfDamage }, success: false, critical: false, fumble: false, result: detail },
            eventType: role === "narrator" ? "system" : "roll",
            eventPayload: role === "narrator" ? { text: detail } : { label: "simulação de condição", result: detail },
            sfxPayload: null,
        };
    }

    const affectedTargets = getAffectedMoveTargets(room.tokens, attacker, defender, resolvedMove);
    const targetsToResolve = affectedTargets.length ? affectedTargets : [null];
    let workingTokens = room.tokens;
    let workingHitKillProtectionUsed = room.hitKillProtectionUsed;
    let workingHitKillProtectionDisabled = room.hitKillProtectionDisabled;
    let workingHitKillSurvivalGrace = room.hitKillSurvivalGrace;
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
            move: resolvedMove,
            mode: request.mode,
            random,
            round: room.round,
            weather: room.weather,
            terrain: room.terrain,
            weatherSuppressed: isWeatherSuppressed(workingTokens),
        });

        if (role === "narrator") {
            const automated = applyMoveConsequences({
                tokens: workingTokens,
                attackerId: attacker.id,
                targetId: currentTarget?.id,
                move: resolvedMove,
                ppMove: move,
                resolution,
                random,
                consumePp: index === 0,
                applySelfChanges: index === 0,
                clearDeclaration: index === targetsToResolve.length - 1,
                round: room.round,
                hitKillProtectionUsed: workingHitKillProtectionUsed,
                hitKillProtectionDisabled: workingHitKillProtectionDisabled,
                hitKillSurvivalGrace: workingHitKillSurvivalGrace,
            });
            workingTokens = automated.tokens;
            workingHitKillProtectionUsed = automated.hitKillProtectionUsed;
            workingHitKillProtectionDisabled = automated.hitKillProtectionDisabled;
            workingHitKillSurvivalGrace = automated.hitKillSurvivalGrace;
            consequences = addConsequences(consequences, automated.consequences);
            targetResults.push({
                target: currentTarget ? { id: currentTarget.id, name: currentTarget.name } : null,
                resolution,
                consequences: automated.consequences,
            });
        } else {
            const previewHitKill = currentTarget
                ? resolveDamageSequence({
                    token: currentTarget,
                    damage: resolution.damageHit ? resolution.damage : 0,
                    damagePerHit: resolution.damagePerHit,
                    hitCount: integerInRange(resolution.hitCount, 1, 10, 1),
                    round: room.round,
                    protectionUsed: room.hitKillProtectionUsed.includes(getHitKillProtectionKey(currentTarget)),
                    protectionDisabled: hasHitKillProtectionDisabled(room.hitKillProtectionDisabled, currentTarget),
                    survivalGrace: hasHitKillSurvivalGrace(room.hitKillSurvivalGrace, currentTarget),
                    critical: Boolean(resolution.attackTest?.critical),
                    defenderFumble: Boolean(resolution.defenseTest?.fumble),
                    directKnockout: resolution.directKnockout || isDirectKnockoutMove(resolvedMove),
                })
                : null;
            targetResults.push({
                target: currentTarget ? { id: currentTarget.id, name: currentTarget.name } : null,
                resolution,
                previewHitKill,
            });
        }
    }

    const connected = targetResults.some(entry => entry.resolution.moveConnected);
    const damageHit = targetResults.some(entry => entry.resolution.damageHit);
    const representative = targetResults[0].resolution;
    const previewDamage = targetResults.reduce(
        (sum, entry) => sum + integerInRange(entry.previewHitKill?.appliedDamage, 0, MAX_SAFE_GAME_INTEGER, 0),
        0,
    );
    const result = {
        ...representative,
        conditionNotes: conditionCheck.notes,
        hit: connected,
        moveConnected: connected,
        damageHit,
        targetResults,
        consequences: role === "narrator" ? consequences : null,
        previewDamage,
    };
    const calculatedDamage = role === "narrator"
        ? consequences.calculatedDamage
        : targetResults.reduce((sum, entry) => sum + entry.resolution.damage, 0);
    const nextSnapshot = role === "narrator"
        ? {
            ...room,
            ...(consequences.fieldChange?.weather ? { weather: consequences.fieldChange.weather } : {}),
            ...(consequences.fieldChange?.terrain ? { terrain: consequences.fieldChange.terrain } : {}),
            tokens: workingTokens,
            hitKillProtectionUsed: workingHitKillProtectionUsed,
            hitKillProtectionDisabled: workingHitKillProtectionDisabled,
            hitKillSurvivalGrace: workingHitKillSurvivalGrace,
        }
        : null;
    const eventPayload = role === "narrator"
        ? {
            attackerName: attacker.name,
            attackerId: attacker.id,
            defenderName: affectedTargets.map(token => token.name).join(", ") || representative.profile.target.label,
            defenderId: defender?.id || "",
            moveName: formatName(resolvedMove.name),
            selectedMoveName: formatName(move.name),
            calledMoveName: needsCalledMove ? formatName(resolvedMove.name) : "",
            hit: connected,
            moveConnected: connected,
            damageHit,
            effectOnly: representative.profile.effectOnly,
            resolutionLabel: representative.resolutionLabel,
            damage: consequences.damage,
            calculatedDamage: consequences.calculatedDamage,
            hitKillThreshold: consequences.hitKillThreshold,
            hitKillProtected: consequences.hitKillProtected,
            hitKillProtectedHits: consequences.hitKillProtectedHits,
            traitProtectedHits: consequences.traitProtectedHits,
            faintedOnHit: consequences.faintedOnHit,
            fainted: consequences.fainted,
            status: consequences.appliedStatuses[0] || "",
            ppAfter: consequences.ppAfter,
            fumble: targetResults.some(entry => entry.resolution.attackTest?.fumble),
            defenderFumble: consequences.hitKillBypassedByDefenderFumble,
            specialNarrative: [...conditionCheck.notes, ...consequences.specialNarratives].join(" "),
        }
        : {
            label: `simulação de ${formatName(resolvedMove.name)}`,
            result: targetResults.map(entry => resolutionRollLabel(entry.resolution)).join("; "),
            damage: previewDamage,
            calculatedDamage,
            hitKillProtected: targetResults.some(entry => entry.previewHitKill?.protectedFromKnockout),
            hitKillProtectedHits: targetResults.flatMap(entry => entry.previewHitKill?.protectedHits || []),
            faintedOnHit: targetResults.find(entry => entry.previewHitKill?.faintedOnHit)?.previewHitKill?.faintedOnHit || null,
            attackerId: attacker.id,
            defenderId: defender?.id || "",
        };
    const critical = targetResults.some(entry => entry.resolution.criticalHit);
    const healedOnly = consequences.healed > 0 && !consequences.damage;
    const sfxPayload = role === "narrator" && connected
        ? {
            effectId: critical ? "critical" : healedOnly ? "heal" : representative.profile.effectOnly ? "confirm" : "hit",
            label: critical ? "Crítico" : healedOnly ? "Cura" : representative.profile.effectOnly ? "Efeito" : "Impacto",
        }
        : null;

    return {
        result,
        nextSnapshot,
        audit: {
            type: "combat",
            conditionCheck: { canAct: conditionCheck.canAct, notes: conditionCheck.notes, rolls: conditionCheck.rolls, selfDamage: conditionCheck.selfDamage },
            mode: request.mode,
            rawDice: targetResults.map(entry => ({
                targetId: entry.target?.id || null,
                attack: entry.resolution.attackTest?.dice || [],
                attackKept: entry.resolution.attackTest?.kept || [],
                defense: entry.resolution.defenseTest?.dice || [],
                defenseKept: entry.resolution.defenseTest?.kept || [],
                accuracy: entry.resolution.accuracyTest?.rolls || [],
            })),
            modifiers: { attackerId: attacker.id, defenderId: defender?.id || null, moveName: resolvedMove.name },
            chance: targetResults.map(entry => entry.resolution.accuracyTest?.chance ?? null),
            result: { connected, damageHit, damage: role === "narrator" ? consequences.damage : previewDamage, calculatedDamage },
            success: connected,
            critical,
            fumble: targetResults.some(entry => entry.resolution.attackTest?.fumble),
        },
        eventType: role === "narrator" ? "move" : "roll",
        eventPayload,
        sfxPayload,
    };
};

export const resolveCaptureAction = ({ request, snapshot, role, species, random = undefined }) => {
    if (role !== "narrator") throw new AuthoritativeActionError("Só o Narrador confirma uma captura na cena.", 403);
    const room = normalizeRoomSnapshot(snapshot);
    const trainer = room.tokens.find(token => token.id === request.trainerTokenId);
    const target = room.tokens.find(token => token.id === request.targetId);
    if (!trainer || trainer.side !== "ally" || !target || trainer.id === target.id || target.side === "ally" || target.hidden || target.ownerPlayerId || request.wildConfirmed !== true) {
        throw new AuthoritativeActionError("Confirme sua equipe e um alvo selvagem na cena.", 409);
    }
    const trainerKey = captureTrainerKey(trainer);
    if (room.phase === "batalha" && room.trainerInterventions.some(entry => entry.trainerKey === trainerKey && entry.round === room.round)) {
        throw new AuthoritativeActionError("Este Treinador já usou a intervenção desta rodada.", 409);
    }
    const result = rollCapture({ target, captureRate: species?.capture_rate, ball: request.ball }, random);
    const capturedInitiativeIndex = room.initiative.indexOf(target.id);
    const initiative = result.success
        ? room.initiative.filter(tokenId => tokenId !== target.id)
        : room.initiative;
    const turnIndex = result.success && capturedInitiativeIndex >= 0
        ? Math.max(0, Math.min(
            initiative.length - 1,
            room.turnIndex - (capturedInitiativeIndex < room.turnIndex ? 1 : 0),
        ))
        : room.turnIndex;
    const nextSnapshot = {
        ...room,
        trainerInterventions: [...room.trainerInterventions.filter(entry => entry.round === room.round), { trainerKey, round: room.round }],
        initiative,
        turnIndex: initiative.length ? turnIndex : 0,
        tokens: room.tokens.map(token => token.id === target.id && result.success ? { ...token, captured: true, hidden: true } : token),
    };
    const detail = `${target.name}: ${result.success ? "captura confirmada" : "escapou"} com ${CAPTURE_BALLS[result.ball].label}. ${result.automatic ? "Captura automática." : `d100 ${result.result} contra ${result.chance}%.`} Taxa ${result.captureRate}/255; HP ${result.currentHp}/${result.maxHp}; Ball ×${result.ballBonus}; condição ×${result.statusBonus}.`;
    return {
        result: { ...result, targetName: target.name, detail }, nextSnapshot,
        audit: { type: "capture", mode: "normal", rawDice: result.rolls, modifiers: result, chance: result.chance, result: result.result, success: result.success, critical: false, fumble: false },
        eventType: "system", eventPayload: { text: detail },
        sfxPayload: result.success ? { effectId: "capture", label: "Captura" } : null,
    };
};

/**
 * @param {{ request: any, snapshot: any, role: "narrator" | "player", move?: any, calledMove?: any, species?: any, random: any }} options
 */
export const resolveAuthoritativeAction = ({ request, snapshot, role, move = null, calledMove = null, species = null, random }) => {
    if (request.action === "quick-attribute") return quickAttribute(request, random);
    if (request.action === "quick-percent") return quickPercent(request, random);
    if (request.action === "capture") return resolveCaptureAction({ request, snapshot, role, species, random });
    if (request.action === "initiative") {
        if (role !== "narrator") throw new AuthoritativeActionError("Só o Narrador pode formar a iniciativa.", 403);
        return initiative(snapshot, random);
    }
    if (request.action === "advance-turn") {
        if (role !== "narrator") throw new AuthoritativeActionError("Só o Narrador pode avançar a rodada.", 403);
        return advanceTurn(snapshot, random);
    }
    return resolveCombatAction({ snapshot, role, request, move, calledMove, random });
};
