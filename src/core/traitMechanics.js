import { formatEnglishName } from "./names.js";
import {
    clampFinite as clamp,
    finiteNumber as asNumber,
    finiteProduct,
    integerInRange,
    MAX_SAFE_GAME_INTEGER,
    safeDivide,
} from "./math.js";

const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === "string" ? value : "";
export const traitSlug = value => asText(value).trim().toLowerCase().replace(/[\s_]+/g, "-");

export const normalizeHeldItemOrigin = (value, item = "") => {
    const itemId = traitSlug(value?.itemId).slice(0, 80);
    const teamId = asText(value?.teamId).slice(0, 160);
    const teamShareId = asText(value?.teamShareId).slice(0, 160);
    const pokemonId = asText(value?.pokemonId).slice(0, 160);
    if (!itemId || !pokemonId || (!teamId && !teamShareId) || (item && traitSlug(item) !== itemId)) return null;
    return { teamId, teamShareId, pokemonId, itemId,
        revision: asText(value?.revision).slice(0, 80),
        sequence: integerInRange(value?.sequence, 0, Number.MAX_SAFE_INTEGER, 0) };
};

const nextItemOrigin = origin => origin ? { ...origin, sequence: Math.min(Number.MAX_SAFE_INTEGER, origin.sequence + 1) } : null;

export const TRAIT_STATE_VERSION = 1;
export const TRAIT_AUTOMATION_LABELS = Object.freeze({
    automatic: "O MyOwnDex resolve quando o gatilho acontece",
    contextual: "O MyOwnDex acompanha e pede a escolha necessária",
    guided: "O Narrador confirma com a regra à vista",
});

const normalizeHistoryEntry = value => {
    if (!value || typeof value !== "object") return null;
    const sourceId = traitSlug(value.sourceId);
    if (!sourceId) return null;
    return {
        kind: ["ability", "item", "environment", "state"].includes(value.kind) ? value.kind : "state",
        sourceId,
        label: asText(value.label).slice(0, 80),
        detail: asText(value.detail).slice(0, 240),
        round: integerInRange(value.round, 0, 9999, 0),
        ...(value.kind === "item" && ["consumed", "available"].includes(value.itemAvailability) && normalizeHeldItemOrigin(value.origin, sourceId)
            ? { origin: normalizeHeldItemOrigin(value.origin, sourceId), itemAvailability: value.itemAvailability } : {}),
    };
};

const normalizeTraitHistory = value => {
    const regular = [];
    const availability = new Map();
    for (const entry of asArray(value).map(normalizeHistoryEntry).filter(Boolean)) {
        if (!entry.itemAvailability) { regular.push(entry); continue; }
        const origin = entry.origin;
        const key = JSON.stringify([origin.teamShareId || origin.teamId, origin.pokemonId, origin.itemId, origin.revision]);
        const previous = availability.get(key);
        if (previous && previous.origin.sequence > origin.sequence) continue;
        availability.delete(key);
        availability.set(key, entry);
    }
    // Reserve room for the 80 possible active/benched owners. Other ability
    // events cannot evict a pending consumption before progress is recorded.
    return [...[...availability.values()].slice(-80), ...regular.slice(-24)];
};

export const normalizeTraitState = (value, currentItem = "", currentAbility = "") => {
    const itemId = traitSlug(currentItem);
    const abilityId = traitSlug(currentAbility);
    const previousItemId = traitSlug(value?.item?.originalId);
    const sameRestoredItem = Boolean(itemId && itemId === previousItemId);
    const origin = normalizeHeldItemOrigin(value?.item?.origin, itemId || previousItemId);
    return {
        version: TRAIT_STATE_VERSION,
        item: {
            originalId: itemId || previousItemId,
            consumed: itemId ? false : Boolean(value?.item?.consumed && previousItemId),
            consumedRound: itemId ? 0 : integerInRange(value?.item?.consumedRound, 0, 9999, 0),
            consumedReason: itemId ? "" : asText(value?.item?.consumedReason).slice(0, 160),
            restored: sameRestoredItem && Boolean(value?.item?.restored),
            ...(origin ? { origin } : {}),
        },
        ability: {
            id: abilityId,
            suppressed: Boolean(value?.ability?.suppressed && abilityId),
            suppressionReason: abilityId ? asText(value?.ability?.suppressionReason).slice(0, 160) : "",
        },
        markers: [...new Set(asArray(value?.markers).map(traitSlug).filter(Boolean))].slice(0, 24),
        history: normalizeTraitHistory(value?.history),
    };
};

export const recordTraitEvent = (token, entry) => {
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    const normalized = normalizeHistoryEntry(entry);
    if (!normalized) return { ...token, traitState: state };
    return {
        ...token,
        traitState: {
            ...state,
            history: normalizeTraitHistory([...state.history, normalized]),
        },
    };
};

export const consumeHeldItem = (token, { reason = "O item foi consumido", round = 0 } = {}) => {
    const itemId = traitSlug(token?.item);
    const state = normalizeTraitState(token?.traitState, itemId, token?.ability);
    if (!itemId) return { applied: false, token: { ...token, traitState: state }, itemId: state.item.originalId };
    const origin = nextItemOrigin(state.item.origin);
    const changed = {
        ...token,
        item: "",
        traitState: {
            ...state,
            item: {
                originalId: itemId,
                consumed: true,
                consumedRound: integerInRange(round, 0, 9999, 0),
                consumedReason: asText(reason).slice(0, 160),
                restored: false,
                ...(origin ? { origin } : {}),
            },
        },
    };
    return {
        applied: true,
        itemId,
        token: recordTraitEvent(changed, {
            kind: "item",
            sourceId: itemId,
            label: "Item consumido",
            detail: reason,
            round,
            ...(origin ? { origin, itemAvailability: "consumed" } : {}),
        }),
    };
};

export const restoreHeldItem = (token, { round = 0, reason = "Item restaurado pelo Narrador" } = {}) => {
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    const itemId = traitSlug(token?.item) || state.item.originalId;
    if (!itemId || (token?.item && !state.item.consumed)) return { applied: false, token: { ...token, traitState: state } };
    const origin = nextItemOrigin(state.item.origin);
    const changed = {
        ...token,
        item: itemId,
        traitState: {
            ...state,
            item: {
                originalId: itemId,
                consumed: false,
                consumedRound: 0,
                consumedReason: "",
                restored: true,
                ...(origin ? { origin } : {}),
            },
        },
    };
    return {
        applied: true,
        itemId,
        token: recordTraitEvent(changed, {
            kind: "item",
            sourceId: itemId,
            label: "Item restaurado",
            detail: reason,
            round,
            ...(origin ? { origin, itemAvailability: "available" } : {}),
        }),
    };
};

export const assignHeldItem = (token, item, { round = 0, reason = "Item recebido", origin: originInput } = {}) => {
    const itemId = traitSlug(item);
    const state = normalizeTraitState({}, itemId, token?.ability);
    const previous = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    const previousOrigin = previous.item.origin;
    const sameOwner = previousOrigin?.pokemonId === token?.pokemonId
        && (previousOrigin.teamId === token?.teamId || (previousOrigin.teamShareId && previousOrigin.teamShareId === token?.teamShareId));
    const origin = itemId ? normalizeHeldItemOrigin(originInput === undefined ? {
        teamId: token?.teamId, teamShareId: token?.teamShareId, pokemonId: token?.pokemonId, itemId,
        revision: sameOwner && previousOrigin.itemId === itemId ? previousOrigin.revision : "",
        sequence: sameOwner && previousOrigin.itemId === itemId ? Math.min(Number.MAX_SAFE_INTEGER, previousOrigin.sequence + 1) : 0,
    } : originInput, itemId) : null;
    const changed = { ...token, item: itemId, traitState: { ...state,
        item: { ...state.item, ...(origin ? { origin } : {}) },
        ability: previous.ability, markers: previous.markers, history: previous.history } };
    if (!itemId) return changed;
    return recordTraitEvent(changed, { kind: "item", sourceId: itemId, label: "Item equipado", detail: reason, round,
        ...(origin ? { origin, itemAvailability: "available" } : {}) });
};

const sameItemOrigin = (first, second) => Boolean(first && second
    && first.pokemonId === second.pokemonId && first.itemId === second.itemId && first.revision === second.revision
    && (first.teamId === second.teamId || (first.teamShareId && first.teamShareId === second.teamShareId)));

/** A cached HP/notes edit cannot quietly recreate a spent item. */
export const getHeldItemPatchBlockReason = (previousSnapshot, nextSnapshot) => {
    const nextTokens = new Map([...asArray(nextSnapshot?.tokens), ...asArray(nextSnapshot?.benchTokens)].map(token => [token?.id, token]));
    for (const previous of [...asArray(previousSnapshot?.tokens), ...asArray(previousSnapshot?.benchTokens)]) {
        const before = normalizeTraitState(previous?.traitState, previous?.item, previous?.ability);
        const next = nextTokens.get(previous?.id);
        if (!next) continue;
        const after = normalizeTraitState(Object.hasOwn(next, "traitState") ? next.traitState : previous.traitState, next.item, next.ability);
        const newOrigin = after.item.origin;
        const spentOrigins = [
            ...before.history.filter(entry => entry.itemAvailability === "consumed").map(entry => entry.origin),
            ...(before.item.consumed && before.item.origin ? [before.item.origin] : []),
        ];
        for (const oldOrigin of spentOrigins) {
            const activeOriginal = traitSlug(next.item) === oldOrigin.itemId && (!newOrigin || sameItemOrigin(oldOrigin, newOrigin));
            const stillSpent = !activeOriginal && ((after.item.consumed && sameItemOrigin(oldOrigin, newOrigin) && newOrigin.sequence >= oldOrigin.sequence)
                || after.history.some(entry => entry.itemAvailability === "consumed" && sameItemOrigin(oldOrigin, entry.origin)
                    && entry.origin.sequence >= oldOrigin.sequence));
            const explicitRestore = after.item.restored && sameItemOrigin(oldOrigin, newOrigin)
                && newOrigin.sequence > oldOrigin.sequence && after.history.some(entry => entry.label === "Item restaurado"
                    && entry.itemAvailability === "available" && sameItemOrigin(oldOrigin, entry.origin)
                    && entry.origin.sequence === newOrigin.sequence);
            const freshOwnedCopy = newOrigin?.revision && newOrigin.revision !== oldOrigin.revision
                && newOrigin.pokemonId === next.pokemonId && newOrigin.pokemonId === oldOrigin.pokemonId && newOrigin.sequence === 0
                && (newOrigin.teamId === oldOrigin.teamId || (newOrigin.teamShareId && newOrigin.teamShareId === oldOrigin.teamShareId))
                && (newOrigin.teamId === next.teamId || (newOrigin.teamShareId && newOrigin.teamShareId === next.teamShareId));
            if (!stillSpent && !explicitRestore && !freshOwnedCopy) {
                return `Para repor ${formatEnglishName(oldOrigin.itemId)}, use Restaurar item ou equipe uma cópia nova na Box.`;
            }
        }
        if (before.item.consumed && !before.item.origin && before.item.originalId) {
            const stillSpent = !next.item && after.item.consumed && after.item.originalId === before.item.originalId;
            const explicitRestore = traitSlug(next.item) === before.item.originalId && after.item.restored
                && after.history.some(entry => entry.kind === "item" && entry.sourceId === before.item.originalId && entry.label === "Item restaurado");
            const freshOwnedCopy = newOrigin?.revision && newOrigin.sequence === 0
                && newOrigin.pokemonId === previous.pokemonId && newOrigin.pokemonId === next.pokemonId
                && (newOrigin.teamId === previous.teamId || (newOrigin.teamShareId && newOrigin.teamShareId === previous.teamShareId))
                && (newOrigin.teamId === next.teamId || (newOrigin.teamShareId && newOrigin.teamShareId === next.teamShareId));
            if (!stillSpent && !explicitRestore && !freshOwnedCopy) {
                return `Para repor ${formatEnglishName(before.item.originalId)}, use Restaurar item ou equipe uma cópia nova na Box.`;
            }
        }
    }
    return "";
};

export const setAbilitySuppressed = (token, suppressed, reason = "Efeito da cena") => {
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    return {
        ...token,
        traitState: {
            ...state,
            ability: {
                ...state.ability,
                suppressed: Boolean(suppressed && state.ability.id),
                suppressionReason: suppressed ? asText(reason).slice(0, 160) : "",
            },
        },
    };
};

export const isAbilityActive = token => {
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    return Boolean(state.ability.id && !state.ability.suppressed);
};

export const isWeatherSuppressed = tokens => asArray(tokens).some(token => token?.currentHp > 0
    && isAbilityActive(token)
    && ["air-lock", "cloud-nine"].includes(traitSlug(token?.ability)));

export const isHeldItemActive = token => {
    const itemId = traitSlug(token?.item);
    if (!itemId) return false;
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    const itemSuppressed = asArray(token?.volatileEffects).some(effect => ["embargo", "magic-room"].includes(traitSlug(effect?.id || effect)));
    const klutzActive = state.ability.id === "klutz" && !state.ability.suppressed;
    return !itemSuppressed && !klutzActive;
};

const profile = (id, summary, trigger, automation = "contextual") => ({ id, title: formatEnglishName(id), summary, trigger, automation });

const ABILITY_PROFILES = Object.freeze({
    adaptability: profile("adaptability", "Eleva o bônus de golpes dos próprios tipos e acompanha a Terastallization.", "Ao calcular dano de um tipo compatível", "automatic"),
    aftermath: profile("aftermath", "Fere quem nocauteia o usuário com contato direto.", "Ao desmaiar por contato", "automatic"),
    analytic: profile("analytic", "Fortalece o golpe quando o usuário age depois do alvo.", "Ordem de turno", "guided"),
    blaze: profile("blaze", "Aumenta o dano de Fire em 50% quando resta até ≈ 33,33% do HP máximo.", "HP crítico + golpe de Fire", "automatic"),
    chlorophyll: profile("chlorophyll", "Dobra a Velocidade sob sol forte.", "Iniciativa sob sol", "automatic"),
    "compound-eyes": profile("compound-eyes", "Aumenta a precisão dos movimentos.", "Teste de precisão", "automatic"),
    "dry-skin": profile("dry-skin", "Absorve Water, recupera HP na chuva e sofre com sol e Fire.", "Water, clima ou Fire", "automatic"),
    guts: profile("guts", "Fortalece golpes físicos enquanto há uma condição principal.", "Condição + golpe físico", "automatic"),
    "huge-power": profile("huge-power", "Dobra a pressão ofensiva de golpes físicos.", "Golpe físico", "automatic"),
    intimidate: profile("intimidate", "Reduz o Ataque dos oponentes ao entrar em cena.", "Entrada em campo", "automatic"),
    "iron-barbs": profile("iron-barbs", "Fere quem acerta o usuário por contato.", "Dano por contato", "automatic"),
    "ice-scales": profile("ice-scales", "Reduz pela metade o dano especial recebido.", "Dano especial", "automatic"),
    "iron-fist": profile("iron-fist", "Fortalece movimentos de soco.", "Movimento de soco", "automatic"),
    "magic-guard": profile("magic-guard", "Impede dano indireto sem apagar cura, estados ou efeitos narrativos.", "Dano residual ou de item", "automatic"),
    "mold-breaker": profile("mold-breaker", "Ignora habilidades defensivas que normalmente impediriam o golpe.", "Resolução contra habilidade defensiva", "automatic"),
    moxie: profile("moxie", "Aumenta o Ataque depois de nocautear um alvo.", "Nocaute causado", "automatic"),
    multiscale: profile("multiscale", "Reduz pela metade o dano recebido com HP cheio.", "Golpe recebido com HP cheio", "automatic"),
    "neutralizing-gas": profile("neutralizing-gas", "Suprime as demais habilidades em cena; Ability Shield preserva a habilidade de seu portador.", "Enquanto o usuário está consciente em cena", "automatic"),
    "no-guard": profile("no-guard", "Dispensa o teste de precisão dos movimentos que envolvem o usuário.", "Movimento declarado", "automatic"),
    overcoat: profile("overcoat", "Protege contra dano de clima e efeitos de pó.", "Clima ou movimento de pó", "automatic"),
    overgrow: profile("overgrow", "Aumenta o dano de Grass em 50% quando resta até ≈ 33,33% do HP máximo.", "HP crítico + golpe de Grass", "automatic"),
    "poison-heal": profile("poison-heal", "Converte o dano de veneno em recuperação.", "Fim da rodada envenenado", "automatic"),
    "pure-power": profile("pure-power", "Dobra a pressão ofensiva de golpes físicos.", "Golpe físico", "automatic"),
    "rain-dish": profile("rain-dish", "Recupera HP no fim da rodada sob chuva.", "Fim da rodada na chuva", "automatic"),
    "rough-skin": profile("rough-skin", "Fere quem acerta o usuário por contato.", "Dano por contato", "automatic"),
    "sand-rush": profile("sand-rush", "Dobra a Velocidade durante tempestade de areia.", "Iniciativa na areia", "automatic"),
    "shadow-shield": profile("shadow-shield", "Reduz pela metade o dano recebido com HP cheio.", "Golpe recebido com HP cheio", "automatic"),
    "shed-skin": profile("shed-skin", "Pode remover a condição principal no fim da rodada.", "Fim da rodada", "automatic"),
    "sheer-force": profile("sheer-force", "Fortalece golpes com efeitos secundários e remove esses efeitos.", "Golpe com efeito secundário", "automatic"),
    "skill-link": profile("skill-link", "Faz movimentos de múltiplos golpes alcançarem o máximo.", "Movimento de múltiplos golpes", "automatic"),
    "slush-rush": profile("slush-rush", "Dobra a Velocidade sob neve.", "Iniciativa na neve", "automatic"),
    "solar-power": profile("solar-power", "Fortalece golpes especiais no sol e cobra HP no fim da rodada.", "Golpe especial ou fim da rodada sob sol", "automatic"),
    "speed-boost": profile("speed-boost", "Aumenta a Velocidade ao fim de cada rodada ativa.", "Fim da rodada", "automatic"),
    "strong-jaw": profile("strong-jaw", "Fortalece movimentos de mordida.", "Movimento de mordida", "automatic"),
    sturdy: profile("sturdy", "Impede um nocaute de um único golpe quando o HP está cheio.", "Golpe fatal com HP cheio", "automatic"),
    swarm: profile("swarm", "Aumenta o dano de Bug em 50% quando resta até ≈ 33,33% do HP máximo.", "HP crítico + golpe de Bug", "automatic"),
    "swift-swim": profile("swift-swim", "Dobra a Velocidade sob chuva.", "Iniciativa na chuva", "automatic"),
    technician: profile("technician", "Fortalece golpes de baixo poder.", "Movimento de até 60 de poder", "automatic"),
    "thick-fat": profile("thick-fat", "Reduz pela metade dano de Fire e Ice.", "Golpe de Fire ou Ice", "automatic"),
    "tinted-lens": profile("tinted-lens", "Compensa a resistência do alvo a golpes pouco efetivos.", "Golpe resistido", "automatic"),
    torrent: profile("torrent", "Aumenta o dano de Water em 50% quando resta até ≈ 33,33% do HP máximo.", "HP crítico + golpe de Water", "automatic"),
    unaware: profile("unaware", "Ignora modificadores ofensivos ou defensivos pertinentes ao confronto.", "Disputa de dano", "automatic"),
    unburden: profile("unburden", "Dobra a Velocidade depois que o item do usuário é consumido ou perdido.", "Iniciativa sem o item original", "automatic"),
    "water-bubble": profile("water-bubble", "Fortalece Water, reduz Fire e impede queimadura.", "Golpe de Water/Fire ou queimadura", "automatic"),
    "air-lock": profile("air-lock", "Mantém o clima visível, mas neutraliza seus efeitos mecânicos.", "Enquanto o usuário está consciente em cena", "automatic"),
    "cloud-nine": profile("cloud-nine", "Mantém o clima visível, mas neutraliza seus efeitos mecânicos.", "Enquanto o usuário está consciente em cena", "automatic"),
});

const ITEM_PROFILES = Object.freeze({
    "ability-shield": profile("ability-shield", "Impede que outros efeitos suprimam, troquem, substituam ou ignorem a habilidade do portador.", "Tentativa de alterar ou ignorar a habilidade", "automatic"),
    "air-balloon": profile("air-balloon", "Concede imunidade a golpes de Ground até estourar ao sofrer dano.", "Golpe de Ground ou dano recebido", "automatic"),
    "assault-vest": profile("assault-vest", "Reduz dano especial, mas impede movimentos de estado.", "Golpe especial recebido ou movimento de estado", "automatic"),
    "black-sludge": profile("black-sludge", "Recupera Pokémon de Poison e fere os demais no fim da rodada.", "Fim da rodada", "automatic"),
    "choice-band": profile("choice-band", "Fortalece golpes físicos e registra o primeiro movimento para o bloqueio de escolha.", "Primeiro movimento ofensivo", "contextual"),
    "choice-scarf": profile("choice-scarf", "Aumenta a Velocidade e registra o primeiro movimento para o bloqueio de escolha.", "Iniciativa e primeiro movimento", "contextual"),
    "choice-specs": profile("choice-specs", "Fortalece golpes especiais e registra o primeiro movimento para o bloqueio de escolha.", "Primeiro movimento ofensivo", "contextual"),
    "covert-cloak": profile("covert-cloak", "Impede efeitos secundários de golpes recebidos.", "Efeito secundário recebido", "automatic"),
    "expert-belt": profile("expert-belt", "Fortalece golpes superefetivos.", "Golpe superefetivo", "automatic"),
    "flame-orb": profile("flame-orb", "Queima o portador no fim da rodada se isso for permitido.", "Fim da rodada", "automatic"),
    "focus-sash": profile("focus-sash", "É consumida para impedir um nocaute de um único golpe com HP cheio.", "Golpe fatal com HP cheio", "automatic"),
    "leftovers": profile("leftovers", "Recupera 6,25% do HP máximo no fim da rodada, arredondado para baixo.", "Fim da rodada", "automatic"),
    "life-orb": profile("life-orb", "Fortalece golpes e cobra HP depois de causar dano direto.", "Golpe que causa dano", "automatic"),
    "loaded-dice": profile("loaded-dice", "Faz movimentos de 2–5 golpes atingirem pelo menos quatro vezes.", "Movimento de múltiplos golpes", "automatic"),
    "lum-berry": profile("lum-berry", "Cura qualquer condição principal e é consumida.", "Condição principal", "automatic"),
    "muscle-band": profile("muscle-band", "Fortalece golpes físicos.", "Golpe físico", "automatic"),
    "oran-berry": profile("oran-berry", "Recupera HP ao atingir metade da vida e é consumida.", "HP em 50% ou menos", "automatic"),
    "punching-glove": profile("punching-glove", "Fortalece socos e evita contato direto nesses movimentos.", "Movimento de soco", "automatic"),
    "rocky-helmet": profile("rocky-helmet", "Fere quem acerta o portador por contato.", "Dano por contato", "automatic"),
    "shell-bell": profile("shell-bell", "Recupera HP proporcional ao dano causado.", "Dano direto causado", "automatic"),
    "sitrus-berry": profile("sitrus-berry", "Recupera um quarto do HP ao atingir metade da vida e é consumida.", "HP em 50% ou menos", "automatic"),
    "toxic-orb": profile("toxic-orb", "Envenena gravemente o portador no fim da rodada se isso for permitido.", "Fim da rodada", "automatic"),
    "weakness-policy": profile("weakness-policy", "É consumido após dano superefetivo para elevar os dois ataques.", "Dano superefetivo", "automatic"),
    "white-herb": profile("white-herb", "É consumida para neutralizar modificadores negativos.", "Modificador negativo", "automatic"),
    "wide-lens": profile("wide-lens", "Aumenta a precisão dos movimentos.", "Teste de precisão", "automatic"),
    "wise-glasses": profile("wise-glasses", "Fortalece golpes especiais.", "Golpe especial", "automatic"),
});

export const getAbilityProfile = ability => {
    const id = traitSlug(ability);
    if (!id) return null;
    return ABILITY_PROFILES[id] || profile(
        id,
        "",
        "",
        "guided",
    );
};

export const getItemProfile = item => {
    const id = traitSlug(item);
    if (!id) return null;
    return ITEM_PROFILES[id] || profile(
        id,
        "",
        "",
        "guided",
    );
};

const PUNCH_MOVES = new Set(["bullet-punch", "comet-punch", "dizzy-punch", "double-iron-bash", "drain-punch", "dynamic-punch", "fire-punch", "focus-punch", "hammer-arm", "headlong-rush", "ice-hammer", "ice-punch", "jet-punch", "mach-punch", "mega-punch", "meteor-mash", "plasma-fists", "power-up-punch", "rage-fist", "shadow-punch", "sky-uppercut", "surging-strikes", "thunder-punch", "wicked-blow"]);
const BITE_MOVES = new Set(["bite", "crunch", "fire-fang", "fishious-rend", "hyper-fang", "ice-fang", "jaw-lock", "poison-fang", "psychic-fangs", "thunder-fang"]);
const SOUND_MOVES = new Set(["alluring-voice", "boomburst", "bug-buzz", "chatter", "clangorous-soulblaze", "disarming-voice", "echoed-voice", "hyper-voice", "metal-sound", "noble-roar", "overdrive", "perish-song", "psychic-noise", "relic-song", "roar", "round", "screech", "sing", "snarl", "snore", "sparkling-aria", "supersonic", "torch-song", "uproar"]);
const BALL_BOMB_MOVES = new Set(["acid-spray", "aura-sphere", "barrage", "beak-blast", "bullet-seed", "egg-bomb", "electro-ball", "energy-ball", "focus-blast", "gyro-ball", "ice-ball", "magnet-bomb", "mist-ball", "mud-bomb", "octazooka", "pollen-puff", "pyro-ball", "rock-blast", "rock-wrecker", "seed-bomb", "shadow-ball", "sludge-bomb", "weather-ball", "zap-cannon"]);
const POWDER_MOVES = new Set(["cotton-spore", "magic-powder", "poison-powder", "powder", "rage-powder", "sleep-powder", "spore", "stun-spore"]);
const ABILITY_CHANGE_MOVES = new Set(["entrainment", "gastro-acid", "role-play", "simple-beam", "skill-swap", "worry-seed"]);
const CONTACT_EXCEPTIONS = new Set(["accelerock", "aqua-jet", "aqua-step", "astonish", "body-slam", "brave-bird", "close-combat", "double-edge", "dragon-claw", "drain-punch", "extreme-speed", "facade", "fake-out", "flare-blitz", "flip-turn", "headbutt", "high-jump-kick", "iron-head", "knock-off", "leaf-blade", "mach-punch", "nuzzle", "play-rough", "quick-attack", "rapid-spin", "scratch", "shadow-claw", "tackle", "take-down", "thunderous-kick", "u-turn", "volt-tackle", "waterfall", "wild-charge", "wood-hammer"]);

export const moveHasTrait = (move, trait) => {
    const name = traitSlug(move?.name);
    if (trait === "punch") return PUNCH_MOVES.has(name);
    if (trait === "bite") return BITE_MOVES.has(name);
    if (trait === "sound") return SOUND_MOVES.has(name);
    if (trait === "contact") return PUNCH_MOVES.has(name) || BITE_MOVES.has(name) || CONTACT_EXCEPTIONS.has(name);
    if (trait === "secondary") {
        return asNumber(move?.effect_chance) > 0
            || asNumber(move?.meta?.ailment_chance) > 0
            || asNumber(move?.meta?.flinch_chance) > 0
            || asNumber(move?.meta?.stat_chance) > 0;
    }
    return false;
};

export const getTraitMoveBlock = ({ attacker, defender, move } = {}) => {
    const moveName = traitSlug(move?.name);
    const moveType = traitSlug(move?.type?.name);
    const damageClass = traitSlug(move?.damage_class?.name);
    const ability = isAbilityActive(defender) ? traitSlug(defender?.ability) : "";
    const item = isHeldItemActive(defender) ? traitSlug(defender?.item) : "";
    const attackerItem = isHeldItemActive(attacker) ? traitSlug(attacker?.item) : "";
    const choiceLock = getChoiceLock(attacker);
    if (choiceLock && choiceLock !== moveName) {
        return { kind: "item", sourceId: attackerItem, reason: `${attackerItem} mantém a escolha em ${choiceLock}`, absorbed: false, attackerBlocked: true };
    }
    if (attackerItem === "assault-vest" && damageClass === "status") {
        return { kind: "item", sourceId: attackerItem, reason: "Assault Vest impede movimentos de estado", absorbed: false, attackerBlocked: true };
    }
    if (item === "air-balloon" && moveType === "ground" && damageClass !== "status") {
        return { kind: "item", sourceId: item, reason: "Air Balloon manteve o alvo fora do alcance do golpe de Ground", absorbed: true };
    }
    if (ability === "bulletproof" && BALL_BOMB_MOVES.has(moveName)) {
        return { kind: "ability", sourceId: ability, reason: "Bulletproof bloqueou o movimento de esfera ou bomba", absorbed: true };
    }
    if (ability === "soundproof" && moveHasTrait(move, "sound")) {
        return { kind: "ability", sourceId: ability, reason: "Soundproof bloqueou o movimento sonoro", absorbed: true };
    }
    if ((ability === "overcoat" || item === "safety-goggles") && POWDER_MOVES.has(moveName)) {
        const sourceId = ability === "overcoat" ? ability : item;
        return { kind: ability === "overcoat" ? "ability" : "item", sourceId, reason: `${sourceId} bloqueou o movimento de pó`, absorbed: true };
    }
    if (item === "ability-shield" && ABILITY_CHANGE_MOVES.has(moveName)) {
        return { kind: "item", sourceId: item, reason: "Ability Shield protegeu a habilidade contra alteração", absorbed: true };
    }
    return null;
};

const TYPE_BOOST_ITEMS = Object.freeze({
    "black-belt": "fighting", "black-glasses": "dark", charcoal: "fire", "dragon-fang": "dragon",
    "hard-stone": "rock", magnet: "electric", "metal-coat": "steel", "miracle-seed": "grass",
    "mystic-water": "water", "never-melt-ice": "ice", "poison-barb": "poison", "sharp-beak": "flying",
    "silk-scarf": "normal", "silver-powder": "bug", "soft-sand": "ground", "spell-tag": "ghost",
    "twisted-spoon": "psychic", "blank-plate": "normal", "draco-plate": "dragon", "dread-plate": "dark",
    "earth-plate": "ground", "fist-plate": "fighting", "flame-plate": "fire", "icicle-plate": "ice",
    "insect-plate": "bug", "iron-plate": "steel", "meadow-plate": "grass", "mind-plate": "psychic",
    "pixie-plate": "fairy", "sky-plate": "flying", "splash-plate": "water", "spooky-plate": "ghost",
    "stone-plate": "rock", "toxic-plate": "poison", "zap-plate": "electric",
});

const addModifier = (entries, kind, sourceId, multiplier, detail) => {
    if (!sourceId || multiplier === 1) return;
    entries.push({ kind, sourceId, multiplier, detail });
};

export const getDamageTraitModifiers = ({ attacker, defender, move, effectiveness = 1, stab = 1, weather = "limpo", terrain = "nenhum", critical = false } = {}) => {
    const entries = [];
    const ability = isAbilityActive(attacker) ? traitSlug(attacker?.ability) : "";
    const defenderAbility = isAbilityActive(defender) ? traitSlug(defender?.ability) : "";
    const item = isHeldItemActive(attacker) ? traitSlug(attacker?.item) : "";
    const defenderItem = isHeldItemActive(defender) ? traitSlug(defender?.item) : "";
    const moveType = traitSlug(move?.type?.name);
    const damageClass = traitSlug(move?.damage_class?.name);
    const power = Math.max(0, asNumber(move?.power));
    const hpRatio = clamp(safeDivide(asNumber(attacker?.currentHp), Math.max(1, asNumber(attacker?.maxHp, 1)), 0), 0, 1);
    let adjustedStab = stab;

    if (ability === "adaptability" && stab > 1) {
        adjustedStab = stab >= 2 ? 2.25 : 2;
        addModifier(entries, "ability", ability, adjustedStab / stab, "Adaptability elevou o STAB");
    }
    if (["huge-power", "pure-power"].includes(ability) && damageClass === "physical") addModifier(entries, "ability", ability, 2, "Golpe físico fortalecido");
    if (ability === "guts" && attacker?.status && damageClass === "physical") addModifier(entries, "ability", ability, 1.5, "Condição ativou Guts");
    if (attacker?.status === "burn" && damageClass === "physical" && ability !== "guts" && traitSlug(move?.name) !== "facade") addModifier(entries, "condition", "burn", 0.5, "Queimadura reduziu o dano físico");
    if (ability === "technician" && power > 0 && power <= 60) addModifier(entries, "ability", ability, 1.5, "Poder base até 60");
    if (ability === "strong-jaw" && moveHasTrait(move, "bite")) addModifier(entries, "ability", ability, 1.5, "Movimento de mordida");
    if (ability === "iron-fist" && moveHasTrait(move, "punch")) addModifier(entries, "ability", ability, 1.2, "Movimento de soco");
    if (ability === "sheer-force" && moveHasTrait(move, "secondary")) addModifier(entries, "ability", ability, 1.3, "Efeitos secundários convertidos em força");
    if (ability === "tinted-lens" && effectiveness > 0 && effectiveness < 1) addModifier(entries, "ability", ability, 2, "Resistência compensada");
    if (ability === "neuroforce" && effectiveness > 1) addModifier(entries, "ability", ability, 1.25, "Fraqueza explorada");
    if (ability === "sniper" && critical) addModifier(entries, "ability", ability, 1.5, "Acerto crítico ampliado");
    if (ability === "water-bubble" && moveType === "water") addModifier(entries, "ability", ability, 2, "Water Bubble fortaleceu Water");
    const criticalTypeAbility = { blaze: "fire", torrent: "water", overgrow: "grass", swarm: "bug" }[ability];
    if (criticalTypeAbility === moveType && hpRatio <= 1 / 3) addModifier(entries, "ability", ability, 1.5, "HP crítico ativou a habilidade");
    const fixedTypeAbility = { "dragons-maw": "dragon", steelworker: "steel", "rocky-payload": "rock", transistor: "electric" }[ability];
    if (fixedTypeAbility === moveType) addModifier(entries, "ability", ability, 1.5, "Tipo favorecido pela habilidade");
    if (ability === "solar-power" && weather === "sol" && damageClass === "special") addModifier(entries, "ability", ability, 1.5, "Sol ativou Solar Power");

    if (item === "life-orb") addModifier(entries, "item", item, 1.3, "Life Orb fortaleceu o golpe");
    if (item === "expert-belt" && effectiveness > 1) addModifier(entries, "item", item, 1.2, "Golpe superefetivo");
    if (item === "muscle-band" && damageClass === "physical") addModifier(entries, "item", item, 1.1, "Golpe físico fortalecido");
    if (item === "wise-glasses" && damageClass === "special") addModifier(entries, "item", item, 1.1, "Golpe especial fortalecido");
    if (item === "choice-band" && damageClass === "physical") addModifier(entries, "item", item, 1.5, "Choice Band fortaleceu o golpe físico");
    if (item === "choice-specs" && damageClass === "special") addModifier(entries, "item", item, 1.5, "Choice Specs fortaleceu o golpe especial");
    if (item === "punching-glove" && moveHasTrait(move, "punch")) addModifier(entries, "item", item, 1.1, "Punching Glove fortaleceu o soco");
    if (TYPE_BOOST_ITEMS[item] === moveType) {
        addModifier(entries, "item", item, 1.2, "Item fortaleceu o tipo do movimento");
    }

    if (["multiscale", "shadow-shield"].includes(defenderAbility) && asNumber(defender?.currentHp) >= asNumber(defender?.maxHp, 1)) {
        addModifier(entries, "ability", defenderAbility, 0.5, "HP cheio reduziu o dano");
    }
    if (["filter", "solid-rock", "prism-armor"].includes(defenderAbility) && effectiveness > 1) addModifier(entries, "ability", defenderAbility, 0.75, "Dano superefetivo reduzido");
    if (defenderAbility === "thick-fat" && ["fire", "ice"].includes(moveType)) addModifier(entries, "ability", defenderAbility, 0.5, "Tipo amortecido");
    if (defenderAbility === "ice-scales" && damageClass === "special") addModifier(entries, "ability", defenderAbility, 0.5, "Dano especial reduzido");
    if (defenderAbility === "fur-coat" && damageClass === "physical") addModifier(entries, "ability", defenderAbility, 0.5, "Dano físico reduzido");
    if (defenderAbility === "water-bubble" && moveType === "fire") addModifier(entries, "ability", defenderAbility, 0.5, "Water Bubble amortizou Fire");
    if (defenderAbility === "dry-skin" && moveType === "fire") addModifier(entries, "ability", defenderAbility, 1.25, "Dry Skin agravou Fire");
    if (defenderAbility === "fluffy") {
        if (moveType === "fire") addModifier(entries, "ability", defenderAbility, 2, "Fluffy agravou Fire");
        if (moveHasTrait(move, "contact")) addModifier(entries, "ability", defenderAbility, 0.5, "Contato amortecido por Fluffy");
    }
    if (defenderAbility === "punk-rock" && moveHasTrait(move, "sound")) addModifier(entries, "ability", defenderAbility, 0.5, "Som amortecido por Punk Rock");
    if (defenderItem === "assault-vest" && damageClass === "special") addModifier(entries, "item", defenderItem, 2 / 3, "Assault Vest reduziu o dano especial");

    if (weather === "chuva" && moveType === "water") addModifier(entries, "environment", "chuva", 1.5, "Chuva fortaleceu Water");
    if (weather === "chuva" && moveType === "fire") addModifier(entries, "environment", "chuva", 0.5, "Chuva enfraqueceu Fire");
    if (weather === "sol" && moveType === "fire") addModifier(entries, "environment", "sol", 1.5, "Sol fortaleceu Fire");
    if (weather === "sol" && moveType === "water") addModifier(entries, "environment", "sol", 0.5, "Sol enfraqueceu Water");
    if (terrain === "eletrico" && moveType === "electric") addModifier(entries, "environment", "terreno-eletrico", 1.3, "Terreno fortaleceu Electric");
    if (terrain === "gramado" && moveType === "grass") addModifier(entries, "environment", "terreno-gramado", 1.3, "Terreno fortaleceu Grass");
    if (terrain === "psiquico" && moveType === "psychic") addModifier(entries, "environment", "terreno-psiquico", 1.3, "Terreno fortaleceu Psychic");
    if (terrain === "nevoa" && moveType === "dragon") addModifier(entries, "environment", "terreno-nevoa", 0.5, "Névoa amortizou Dragon");

    return {
        stab: adjustedStab,
        multiplier: finiteProduct(entries.map(entry => entry.multiplier), { minimum: 0, maximum: MAX_SAFE_GAME_INTEGER, fallback: 0 }),
        entries,
        suppressTargetSecondaries: ability === "sheer-force" && moveHasTrait(move, "secondary"),
        blockTargetSecondaries: ["shield-dust"].includes(defenderAbility) || defenderItem === "covert-cloak",
    };
};

export const getAccuracyTraitModifiers = ({ attacker, defender, move, weather = "limpo" } = {}) => {
    const entries = [];
    const ability = isAbilityActive(attacker) ? traitSlug(attacker?.ability) : "";
    const defenderAbility = isAbilityActive(defender) ? traitSlug(defender?.ability) : "";
    const item = isHeldItemActive(attacker) ? traitSlug(attacker?.item) : "";
    const defenderItem = isHeldItemActive(defender) ? traitSlug(defender?.item) : "";
    const damageClass = traitSlug(move?.damage_class?.name);
    if (ability === "compound-eyes") addModifier(entries, "ability", ability, 1.3, "Compound Eyes elevou a precisão");
    if (ability === "hustle" && damageClass === "physical") addModifier(entries, "ability", ability, 0.8, "Hustle reduziu a precisão física");
    if (item === "wide-lens") addModifier(entries, "item", item, 1.1, "Wide Lens elevou a precisão");
    if (["bright-powder", "lax-incense"].includes(defenderItem)) addModifier(entries, "item", defenderItem, 0.9, "Item do alvo dificultou o golpe");
    if (defenderAbility === "sand-veil" && weather === "areia") addModifier(entries, "ability", defenderAbility, 0.8, "Sand Veil dificultou o golpe");
    if (defenderAbility === "snow-cloak" && weather === "neve") addModifier(entries, "ability", defenderAbility, 0.8, "Snow Cloak dificultou o golpe");
    return {
        multiplier: finiteProduct(entries.map(entry => entry.multiplier), { minimum: 0, maximum: 100, fallback: 0 }),
        entries,
    };
};

export const getMultiHitTraitState = ({ attacker, minimumHits = 1, maximumHits = 1 } = {}) => {
    const ability = isAbilityActive(attacker) ? traitSlug(attacker?.ability) : "";
    const item = isHeldItemActive(attacker) ? traitSlug(attacker?.item) : "";
    if (maximumHits <= 1) return { minimumHits, maximumHits, source: "" };
    if (ability === "skill-link") return { minimumHits: maximumHits, maximumHits, source: ability };
    if (item === "loaded-dice" && maximumHits >= 4) return { minimumHits: Math.max(minimumHits, 4), maximumHits, source: item };
    return { minimumHits, maximumHits, source: "" };
};

export const getInitiativeTraitState = (token, { weather = "limpo", round = 0 } = {}) => {
    const entries = [];
    const ability = isAbilityActive(token) ? traitSlug(token?.ability) : "";
    const item = isHeldItemActive(token) ? traitSlug(token?.item) : "";
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    if (item === "choice-scarf") addModifier(entries, "item", item, 1.5, "Choice Scarf elevou a Velocidade");
    if (ability === "swift-swim" && weather === "chuva") addModifier(entries, "ability", ability, 2, "Chuva ativou Swift Swim");
    if (ability === "chlorophyll" && weather === "sol") addModifier(entries, "ability", ability, 2, "Sol ativou Chlorophyll");
    if (ability === "sand-rush" && weather === "areia") addModifier(entries, "ability", ability, 2, "Areia ativou Sand Rush");
    if (ability === "slush-rush" && weather === "neve") addModifier(entries, "ability", ability, 2, "Neve ativou Slush Rush");
    if (ability === "quick-feet" && token?.status) addModifier(entries, "ability", ability, 1.5, "Condição ativou Quick Feet");
    if (token?.status === "paralysis" && ability !== "quick-feet") addModifier(entries, "condition", "paralysis", 0.5, "Paralisia reduziu a Velocidade");
    if (ability === "unburden" && state.item.consumed) addModifier(entries, "ability", ability, 2, "Item perdido ativou Unburden");
    if (ability === "slow-start" && Math.max(0, asNumber(round) - asNumber(token?.enteredRound, round)) < 5) {
        addModifier(entries, "ability", ability, 0.5, "Slow Start ainda está ativo");
    }
    return {
        multiplier: finiteProduct(entries.map(entry => entry.multiplier), { minimum: 0, maximum: 100, fallback: 0 }),
        entries,
    };
};

export const getSurvivalTraitSources = token => {
    const sources = [];
    const ability = isAbilityActive(token) ? traitSlug(token?.ability) : "";
    const item = isHeldItemActive(token) ? traitSlug(token?.item) : "";
    if (ability === "sturdy") sources.push({ id: ability, kind: "ability" });
    if (item === "focus-sash") sources.push({ id: item, kind: "item" });
    return sources;
};

export const getSurvivalTrait = (token, {
    damage = 0,
    hitCount = 1,
    round = 0,
    fullHpEligibilityPreserved = false,
} = {}) => {
    const maximumHp = integerInRange(token?.maxHp, 1, 99999, 1);
    const hp = integerInRange(token?.currentHp, 0, maximumHp, maximumHp);
    const normalizedDamage = integerInRange(damage, 0, MAX_SAFE_GAME_INTEGER, 0);
    const fullHp = hp > 0 && hp === maximumHp;
    const wouldFaint = normalizedDamage >= hp;
    if ((!fullHp && !fullHpEligibilityPreserved) || !wouldFaint || integerInRange(hitCount, 1, 20, 1) !== 1) {
        return { applied: false, token, appliedDamage: Math.min(hp, normalizedDamage) };
    }
    const [source] = getSurvivalTraitSources(token);
    if (source?.id === "sturdy") {
        return {
            applied: true,
            token: recordTraitEvent(token, { kind: "ability", sourceId: source.id, label: "Nocaute impedido", detail: "Sturdy manteve 1 HP", round }),
            appliedDamage: Math.max(0, hp - 1),
            sourceId: source.id,
            sourceKind: "ability",
            narrative: "Sturdy impediu o nocaute e manteve 1 HP.",
        };
    }
    if (source?.id === "focus-sash") {
        const consumed = consumeHeldItem(token, { reason: "Focus Sash impediu o nocaute", round });
        return {
            applied: true,
            token: consumed.token,
            appliedDamage: Math.max(0, hp - 1),
            sourceId: source.id,
            sourceKind: "item",
            itemConsumed: source.id,
            narrative: "Focus Sash foi consumida e manteve 1 HP.",
        };
    }
    return { applied: false, token, appliedDamage: Math.min(hp, normalizedDamage) };
};

export const getChoiceLock = token => {
    const item = isHeldItemActive(token) ? traitSlug(token?.item) : "";
    if (!["choice-band", "choice-scarf", "choice-specs"].includes(item)) return "";
    return normalizeTraitState(token?.traitState, token?.item, token?.ability).markers
        .find(marker => marker.startsWith("choice-lock:"))?.slice("choice-lock:".length) || "";
};

export const setChoiceLock = (token, moveName, round = 0) => {
    const item = traitSlug(token?.item);
    if (!["choice-band", "choice-scarf", "choice-specs"].includes(item)) return token;
    const moveId = traitSlug(moveName);
    if (!moveId) return token;
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    const existing = state.markers.find(marker => marker.startsWith("choice-lock:"));
    if (existing) return token;
    const changed = { ...token, traitState: { ...state, markers: [...state.markers, `choice-lock:${moveId}`].slice(-24) } };
    return recordTraitEvent(changed, { kind: "item", sourceId: item, label: "Movimento fixado", detail: `Escolha bloqueada em ${moveId}`, round });
};

export const getTraitStatus = token => {
    const state = normalizeTraitState(token?.traitState, token?.item, token?.ability);
    return {
        ability: getAbilityProfile(token?.ability),
        item: getItemProfile(token?.item || state.item.originalId),
        abilityActive: Boolean(state.ability.id && !state.ability.suppressed),
        itemActive: Boolean(token?.item),
        itemConsumed: state.item.consumed,
        state,
    };
};
