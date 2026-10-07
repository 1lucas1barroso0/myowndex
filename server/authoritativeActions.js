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
import { finiteNumberOrNull, integerInRange, MAX_SAFE_GAME_INTEGER } from "../src/core/math.js";
import { createSecureUint32Source, rollDie } from "../src/core/random.js";
import {
    advanceInitiative,
    applyEndOfRoundEffects,
    buildInitiative,
    getEffectiveMovePriority,
    getRoundMoveBlockReason,
    calculateMoveResolution,
    normalizeRoomSnapshot,
    startNewRoomBattle,
} from "../src/core/room.js";
import { getFumbleSuggestion, rollAttributeTest, rollPercentTest } from "../src/core/rpgRules.js";
import { getMoveSpecialProfile, getSpecialMoveBlockReason } from "../src/core/specialMechanics.js";
import { getTraitMoveBlock, isWeatherSuppressed, isAbilityActive } from "../src/core/traitMechanics.js";
import { checkActionConditions } from "../src/core/battleConditions.js";
import { CAPTURE_BALLS, captureTrainerKey, rollCapture } from "../src/core/capture.js";
import { getCurrentMoveReference } from "../src/core/championsMoves.js";

const ACTIONS = new Set(["quick-attribute", "quick-percent", "quick-free", "initiative", "advance-turn", "combat", "capture", "start-battle"]);
const MODES = new Set(["normal", "advantage", "disadvantage"]);
const FREE_DICE_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
const STATE_ACTIONS = new Set(["initiative", "advance-turn", "combat", "capture", "start-battle"]);
const COMMON_KEYS = new Set(["requestId", "action"]);
const ACTION_KEYS = Object.freeze({
    "quick-attribute": new Set(["mode", "attribute", "opposition", "label"]),
    "quick-percent": new Set(["mode", "chance", "label"]),
    "quick-free": new Set(["quantity", "sides", "modifier", "label"]),
    initiative: new Set(["expectedRevision"]),
    "start-battle": new Set(["expectedRevision"]),
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
    const number = finiteNumberOrNull(value);
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
                declaredDamageClass: typeof movePriorities.get(declaredMove) === "object" ? movePriorities.get(declaredMove)?.damage_class?.name || "" : token.declaredDamageClass,
                priority: declaredMove && movePriorities.has(declaredMove)
                    ? typeof movePriorities.get(declaredMove) === "object"
                        ? getEffectiveMovePriority({ token, move: movePriorities.get(declaredMove) })
                        : exactInteger(movePriorities.get(declaredMove), -7, 7, "A prioridade do movimento")
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
            throw new AuthoritativeActionError("O servidor não aceita dados de resultado enviados pelo dispositivo.");
        }
    }

    if (action === "quick-attribute") {
        const opposition = input.opposition === "" || input.opposition == null ? null : exactInteger(input.opposition, -99999, 99999, "A dificuldade");
        const label = text(input.label, 80);
        return {
            requestId,
            action,
            mode: requiredMode(input.mode),
            attribute: exactInteger(input.attribute ?? 0, -99999, 99999, "O modificador"),
            ...(opposition == null ? {} : { opposition }),
            ...(label ? { label } : {}),
        };
    }
    if (action === "quick-percent") {
        const label = text(input.label, 80);
        return {
            requestId,
            action,
            mode: requiredMode(input.mode),
            chance: exactInteger(input.chance ?? 50, 0, 100, "A chance"),
            ...(label ? { label } : {}),
        };
    }
    if (action === "quick-free") {
        const sides = exactInteger(input.sides ?? 6, 4, 100, "O dado");
        if (!FREE_DICE_SIDES.has(sides)) throw new AuthoritativeActionError("Escolha d4, d6, d8, d10, d12, d20 ou d100.");
        const label = text(input.label, 80);
        return {
            requestId,
            action,
            quantity: exactInteger(input.quantity ?? 1, 1, 20, "A quantidade"),
            sides,
            modifier: exactInteger(input.modifier ?? 0, -99999, 99999, "O modificador"),
            ...(label ? { label } : {}),
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
        return `${resolution.contestSuccess ? "ataque venceu" : "defesa venceu"} · dados ${resolution.attackTest.diceTotal} × ${resolution.defenseTest.diceTotal}`;
    }
    if (!resolution.accuracyTest.automatic) {
        return `d100 ${resolution.accuracyTest.result} contra ${resolution.accuracyTest.chance}%`;
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
    const test = rollAttributeTest({ mode: request.mode, attribute: request.attribute, opposition: request.opposition, random });
    const suggestion = test.fumble ? getFumbleSuggestion(random) : "";
    return {
        result: {
            title: test.critical
                ? "Crítico potencial"
                : test.fumble
                    ? "Erro crítico"
                    : test.success == null
                        ? `Total ${test.total}`
                        : `${test.success ? "Sucesso" : "Falha"} · ${test.total}`,
            detail: suggestion || `${test.dice.join(" • ")}${test.attribute ? ` + ${test.attribute}` : ""}${request.opposition == null ? "" : ` · dificuldade ${request.opposition}`}`,
        },
        nextSnapshot: null,
        audit: {
            type: "attribute",
            mode: test.mode,
            rawDice: test.dice,
            keptDice: test.kept,
            modifiers: { modifier: test.attribute, opposition: request.opposition },
            result: test.total,
            success: test.success,
            critical: test.critical,
            fumble: test.fumble,
            fumbleSuggestion: suggestion,
        },
        eventType: "roll",
        eventPayload: {
            label: request.label || (request.mode === "advantage" ? "teste com vantagem" : request.mode === "disadvantage" ? "teste com desvantagem" : "teste"),
            mode: test.mode,
            result: test.total,
            dice: test.dice,
            kept: test.kept,
            attribute: test.attribute,
            critical: test.critical,
            fumble: test.fumble,
        },
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
            label: request.label || (test.advantage
                ? "teste percentual com vantagem"
                : test.disadvantage
                    ? "teste percentual com desvantagem"
                    : "teste percentual"),
            mode: test.mode,
            result: test.result,
            rolls: test.rolls,
            chance: test.chance,
            success: test.success,
        },
    };
};

const quickFree = (request, random) => {
    const dice = Array.from({ length: request.quantity }, () => rollDie(request.sides, random));
    const total = dice.reduce((sum, value) => sum + value, 0) + request.modifier;
    const modifier = request.modifier
        ? ` ${request.modifier > 0 ? "+" : "−"} ${Math.abs(request.modifier)}`
        : "";
    return {
        result: {
            title: `Total ${total}`,
            detail: `${dice.join(" • ")}${modifier}`,
        },
        nextSnapshot: null,
        audit: {
            type: "free",
            mode: "normal",
            rawDice: dice,
            keptDice: dice,
            modifiers: { modifier: request.modifier },
            result: total,
            success: null,
            critical: false,
            fumble: false,
        },
        eventType: "roll",
        eventPayload: {
            label: request.label || `${request.quantity}d${request.sides}`,
            mode: "normal",
            result: total,
            dice,
            modifier: request.modifier,
        },
    };
};

const initiative = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    if (room.initiative.length) throw new AuthoritativeActionError("A rodada já começou. Encerre os turnos antes de rolar uma nova iniciativa.", 409);
    if (!room.tokens.some(token => !token.hidden && !token.captured && token.currentHp > 0)) throw new AuthoritativeActionError("Traga um Pokémon disponível para começar.", 409);
    const generated = buildInitiative(room, random);
    const order = generated.results.map(entry => {
        const token = room.tokens.find(candidate => candidate.id === entry.tokenId);
        const traits = entry.traitState.entries.map(item => formatName(item.sourceId)).join(" + ");
        return `${token?.name || "Pokémon"}${traits ? ` (${traits})` : ""}`;
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
    };
};

const advanceTurn = (snapshot, random) => {
    const room = normalizeRoomSnapshot(snapshot);
    if (!room.initiative.length) throw new AuthoritativeActionError("Escolha os movimentos e role a iniciativa para começar a rodada.", 409);
    const closingRound = room.turnIndex >= room.initiative.length - 1;
    const roundEnd = closingRound ? applyEndOfRoundEffects(room, random) : null;
    const nextSnapshot = closingRound
        ? {
            ...roundEnd.room,
            round: room.round + 1,
            turnIndex: 0,
            initiative: [],
            tokens: roundEnd.room.tokens.map(token => ({ ...token, declaredMove: "", declaredDamageClass: "", priority: 0 })),
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
    };
};

export const resolveCombatAction = ({ snapshot, role, request, move, calledMove = null, random = undefined }) => {
    move = getCurrentMoveReference(move);
    calledMove = getCurrentMoveReference(calledMove);
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
    const roundBlock = getRoundMoveBlockReason({ snapshot: room, token: attacker, move });
    if (roundBlock) throw new AuthoritativeActionError(roundBlock, 409);
    const specialProfile = getMoveSpecialProfile(move);
    const needsCalledMove = specialProfile?.id === "called-move";
    if (needsCalledMove && (!calledMove || slug(calledMove.name) !== request.calledMoveName)) {
        throw new AuthoritativeActionError("Confirme o movimento resultante antes de resolver a jogada.");
    }
    if (!needsCalledMove && request.calledMoveName) {
        throw new AuthoritativeActionError("Este movimento não aceita um movimento resultante enviado pelo dispositivo.");
    }
    const specialBlock = getSpecialMoveBlockReason({ move, attacker, defender, round: room.round });
    // A legal choice can fail when its prerequisite or target has changed.
    // Resolve that attempt so PP and the action are spent; a failed caller
    // cannot execute its called move.
    const resolvedMove = needsCalledMove && !specialBlock ? calledMove : move;
    const ppState = getMovePpState(attacker, move, request.moveName);
    if (ppState.remaining != null && ppState.remaining <= 0) {
        throw new AuthoritativeActionError("Este movimento está sem PP.", 409);
    }
    const traitBlock = getTraitMoveBlock({ move, attacker, defender });
    if (traitBlock?.attackerBlocked) throw new AuthoritativeActionError(`Item ativo: ${traitBlock.reason}.`, 409);

    const conditionCheck = checkActionConditions({ token: attacker, move, ability: isAbilityActive(attacker) ? attacker.ability : "", random });
    let conditionToken = { ...conditionCheck.token, lastActionRound: room.round };
    const activeMoveActions = Math.min(99999, integerInRange(attacker.activeMoveActions, 0, 99999, 0) + 1);
    let conditionNotes = [...conditionCheck.notes];
    let conditionSelfDamage = null;
    let conditionProtectionDisabled = room.hitKillProtectionDisabled;
    let conditionSurvivalGrace = room.hitKillSurvivalGrace;
    if (conditionCheck.selfDamage > 0) {
        conditionProtectionDisabled = disableHitKillProtection(conditionProtectionDisabled, attacker);
        conditionSurvivalGrace = clearHitKillSurvivalGrace(conditionSurvivalGrace, attacker);
        conditionSelfDamage = resolveDamageSequence({
            token: conditionToken,
            damage: conditionCheck.selfDamage,
            round: room.round,
            protectionDisabled: true,
            allowSurvivalTrait: false,
        });
        conditionToken = conditionSelfDamage.token || conditionToken;
        conditionNotes.push(`Sofreu ${conditionSelfDamage.appliedDamage} HP de dano ao próprio Pokémon.`);
        if (conditionSelfDamage.traitNarrative) conditionNotes.push(conditionSelfDamage.traitNarrative);
    }
    room = {
        ...room,
        tokens: room.tokens.map(token => token.id === attacker.id ? conditionToken : token),
        hitKillProtectionDisabled: conditionProtectionDisabled,
        hitKillSurvivalGrace: conditionSurvivalGrace,
    };
    if (!conditionCheck.canAct) {
        room = { ...room, tokens: room.tokens.map(token => token.id === attacker.id ? { ...token, activeMoveActions } : token) };
        const detail = `${attacker.name}: ${conditionNotes.join(" ")}`;
        return {
            result: { targetResults: [], conditionNotes, blockedByCondition: true, resolutionLabel: "Ação impedida", damage: 0, damageHit: false, moveConnected: false, consequences: role === "narrator" ? emptyConsequences() : null },
            nextSnapshot: role === "narrator" ? room : null,
            audit: { type: "combat", mode: request.mode, rawDice: conditionCheck.rolls, conditionCheck: { canAct: conditionCheck.canAct, notes: conditionNotes, rolls: conditionCheck.rolls, selfDamage: conditionCheck.selfDamage, appliedSelfDamage: conditionSelfDamage?.appliedDamage ?? 0 }, success: false, critical: false, fumble: false, result: detail },
            eventType: role === "narrator" ? "system" : "roll",
            eventPayload: role === "narrator" ? { text: detail } : { label: "simulação de condição", result: detail },
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
            // Called moves inherit the chosen caller's priority; the active order
            // also keeps the priority frozen when HP/abilities change after rolling.
            movePriority: room.initiative.length && attacker.declaredMove === move.name
                ? attacker.priority
                : getEffectiveMovePriority({ token: attacker, move }),
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
                clearDeclaration: !room.initiative.length && index === targetsToResolve.length - 1,
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

    // Consume this attempt once, after the resolver's own eligibility checks.
    // A spread move resolves several targets but is still only one action.
    workingTokens = workingTokens.map(token => token.id === attacker.id ? { ...token, activeMoveActions } : token);
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
            defenderFumble: targetResults.some(entry => entry.resolution.defenseTest?.fumble),
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
    };
};

export const getCaptureInterventionBlockReason = (snapshot, trainer) => {
    if (!trainer) return "";
    const trainerKey = captureTrainerKey(trainer);
    return snapshot.trainerInterventions?.some(entry => entry.trainerKey === trainerKey && entry.round === snapshot.round
        && (snapshot.battleStarted || snapshot.phase === "batalha" || snapshot.initiative?.length > 0 || entry.battle))
        ? "Este Treinador já usou a intervenção desta rodada." : "";
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
    const interventionBlock = getCaptureInterventionBlockReason(room, trainer);
    if (interventionBlock) throw new AuthoritativeActionError(interventionBlock, 409);
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
        trainerInterventions: [...room.trainerInterventions.filter(entry => entry.round === room.round), { trainerKey, round: room.round, battle: room.battleStarted || room.initiative.length > 0 }],
        initiative,
        turnIndex: initiative.length ? turnIndex : 0,
        tokens: room.tokens.map(token => token.id === target.id && result.success ? { ...token, captured: true, hidden: true } : token),
    };
    const detail = `${target.name}: ${result.success ? "captura confirmada" : "escapou"} com ${CAPTURE_BALLS[result.ball].label}. ${result.automatic ? "Captura automática." : `d100 ${result.result} contra ${result.chance}%.`} Taxa ${result.captureRate} de 255; HP ${result.currentHp} de ${result.maxHp}; Ball ×${result.ballBonus}; condição ×${result.statusBonus}.`;
    return {
        result: { ...result, targetName: target.name, detail }, nextSnapshot,
        audit: { type: "capture", mode: "normal", rawDice: result.rolls, modifiers: result, chance: result.chance, result: result.result, success: result.success, critical: false, fumble: false },
        eventType: "system", eventPayload: { text: detail },
    };
};

/**
 * @param {{ request: any, snapshot: any, role: "narrator" | "player", move?: any, calledMove?: any, species?: any, random: any }} options
 */
export const resolveAuthoritativeAction = ({ request, snapshot, role, move = null, calledMove = null, species = null, random }) => {
    if (request.action === "quick-attribute") return quickAttribute(request, random);
    if (request.action === "quick-percent") return quickPercent(request, random);
    if (request.action === "quick-free") return quickFree(request, random);
    if (request.action === "start-battle") {
        if (role !== "narrator") throw new AuthoritativeActionError("Só o Narrador pode começar uma nova batalha.", 403);
        const room = normalizeRoomSnapshot(snapshot);
        if (room.initiative.length) throw new AuthoritativeActionError("Termine a rodada antes de começar outra batalha.", 409);
        const nextSnapshot = startNewRoomBattle(room);
        return {
            result: { round: 1, detail: "Nova batalha pronta. Escolha as ações da primeira rodada." },
            nextSnapshot,
            audit: { type: "start-battle", mode: "normal", rawDice: [], modifiers: null,
                chance: null, result: { round: 1 }, success: true, critical: false, fumble: false },
            eventType: "system",
            eventPayload: { text: "Nova batalha pronta. Escolha as ações da primeira rodada." },
        };
    }
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
