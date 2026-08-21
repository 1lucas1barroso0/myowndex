import { isAbilityActive, isHeldItemActive, traitSlug } from "./traitMechanics.js";
import { rollDie } from "./random.js";

const asArray = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === "string" ? value : "";
const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const slug = value => asText(value).trim().toLowerCase().replace(/\s+/g, "-");
const unique = values => [...new Set(values.filter(Boolean))];
const positiveStageLabel = value => `${value} ${value === 1 ? "estágio positivo" : "estágios positivos"}`;
const STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
const STAGE_KEYS = ["attack", "defense", "special-attack", "special-defense", "speed", "accuracy", "evasion"];

export const SPECIAL_STATE_VERSION = 1;
export const SPECIAL_AUTOMATION_LABELS = Object.freeze({
    automatic: "O MyOwnDex resolve quando a condição acontece",
    guided: "O MyOwnDex orienta e pede a escolha necessária",
    narrated: "O Narrador decide com a regra à vista",
});

const copyNumbers = (value, keys, minimum = 0, maximum = 99999) => Object.fromEntries(
    keys.map(key => [key, clamp(asNumber(value?.[key]), minimum, maximum)])
);

const normalizeIdentity = value => {
    if (!value || typeof value !== "object") return null;
    const moves = asArray(value.moves).slice(0, 4).map(slug);
    const pp = asArray(value.pp).slice(0, 4).map(entry => entry == null ? null : clamp(asNumber(entry), 0, 99));
    while (moves.length < 4) moves.push("");
    while (pp.length < 4) pp.push(null);
    return {
        speciesName: slug(value.speciesName),
        speciesId: Math.max(0, Math.round(asNumber(value.speciesId))),
        sprite: asText(value.sprite).slice(0, 500),
        types: unique(asArray(value.types).map(slug)).slice(0, 3),
        originalTypes: unique(asArray(value.originalTypes).map(slug)).slice(0, 3),
        ability: slug(value.ability),
        weight: Math.max(0, asNumber(value.weight)),
        stats: copyNumbers(value.stats, STAT_KEYS),
        originalStats: copyNumbers(value.originalStats, STAT_KEYS),
        stages: copyNumbers(value.stages, STAGE_KEYS, -6, 6),
        moves,
        pp,
    };
};

export const captureBattleIdentity = token => normalizeIdentity(token);

const normalizeTransform = value => {
    if (!value || typeof value !== "object") return null;
    const base = normalizeIdentity(value.base);
    if (!base) return null;
    return {
        via: ["transform", "imposter", "manual"].includes(value.via) ? value.via : "transform",
        sourceTokenId: asText(value.sourceTokenId).slice(0, 120),
        sourceName: asText(value.sourceName).slice(0, 80),
        round: Math.max(0, Math.round(asNumber(value.round))),
        base,
    };
};

const normalizeIllusion = value => {
    if (!value || typeof value !== "object") return null;
    return {
        sourceTokenId: asText(value.sourceTokenId).slice(0, 120),
        sourceName: asText(value.sourceName).slice(0, 80),
        speciesName: slug(value.speciesName),
        speciesId: Math.max(0, Math.round(asNumber(value.speciesId))),
        sprite: asText(value.sprite).slice(0, 500),
        types: unique(asArray(value.types).map(slug)).slice(0, 3),
    };
};

const normalizeMoveOverride = value => {
    if (!value || typeof value !== "object") return null;
    const slot = Math.round(asNumber(value.slot, -1));
    const copiedMove = slug(value.copiedMove);
    if (slot < 0 || slot > 3 || !copiedMove) return null;
    return {
        slot,
        kind: value.kind === "sketch" ? "sketch" : "mimic",
        originalMove: slug(value.originalMove),
        originalPp: value.originalPp == null ? null : clamp(asNumber(value.originalPp), 0, 99),
        copiedMove,
        permanent: Boolean(value.permanent),
        sourceTokenId: asText(value.sourceTokenId).slice(0, 120),
        sourceName: asText(value.sourceName).slice(0, 80),
    };
};

const normalizeHistoryEntry = value => {
    if (!value || typeof value !== "object") return null;
    const moveName = slug(value.moveName);
    if (!moveName) return null;
    return {
        moveName,
        targetId: asText(value.targetId).slice(0, 120),
        targetName: asText(value.targetName).slice(0, 80),
        round: Math.max(0, Math.round(asNumber(value.round))),
        connected: Boolean(value.connected),
        damage: Math.max(0, asNumber(value.damage)),
        damageClass: slug(value.damageClass),
    };
};

export const normalizeSpecialState = value => ({
    version: SPECIAL_STATE_VERSION,
    transform: normalizeTransform(value?.transform),
    illusion: normalizeIllusion(value?.illusion),
    moveOverrides: asArray(value?.moveOverrides).map(normalizeMoveOverride).filter(Boolean).slice(0, 4),
    history: asArray(value?.history).map(normalizeHistoryEntry).filter(Boolean).slice(-12),
    markers: unique(asArray(value?.markers).map(slug)).slice(0, 12),
});

export const getLastBattleMove = token => {
    const history = normalizeSpecialState(token?.specialState).history;
    return history[history.length - 1] || null;
};

export const recordBattleMove = (token, entry) => {
    const state = normalizeSpecialState(token?.specialState);
    const normalized = normalizeHistoryEntry(entry);
    if (!normalized) return token;
    return {
        ...token,
        specialState: {
            ...state,
            history: [...state.history, normalized].slice(-12),
        },
    };
};

const transformedTargetBlocked = target => {
    const state = normalizeSpecialState(target?.specialState);
    const species = slug(target?.speciesName);
    if (state.transform) return "o alvo já está transformado";
    if (state.illusion) return "uma Ilusão ativa impede copiar a identidade verdadeira";
    if (asArray(target?.volatileEffects).some(effect => slug(effect?.id || effect) === "substitute")) return "Substitute impede copiar o alvo";
    if (species === "eternatus-eternamax") return "essa forma de Eternatus não pode ser copiada";
    if (["ogerpon", "terapagos"].some(name => species.startsWith(name)) && target?.teraActive) {
        return "essa forma terastalizada não pode ser copiada com segurança";
    }
    return "";
};

export const transformBattleToken = (attackerInput, target, { via = "transform", round = 0 } = {}) => {
    const attacker = attackerInput && typeof attackerInput === "object" ? attackerInput : null;
    if (!attacker || !target) return { token: attackerInput, applied: false, reason: "escolha um alvo válido" };
    const state = normalizeSpecialState(attacker.specialState);
    if (state.transform) return { token: attacker, applied: false, reason: "o usuário já está transformado" };
    if (Number(target.currentHp) <= 0) return { token: attacker, applied: false, reason: "o alvo não pode mais batalhar" };
    const blocked = transformedTargetBlocked(target);
    if (blocked) return { token: attacker, applied: false, reason: blocked };

    const base = captureBattleIdentity(attacker);
    const copied = captureBattleIdentity(target);
    if (!base || !copied) return { token: attacker, applied: false, reason: "a identidade de batalha está incompleta" };
    const moves = copied.moves;
    const pp = moves.map(move => move ? 5 : null);
    const stats = {
        ...copied.stats,
        hp: attacker.stats?.hp ?? base.stats.hp,
    };
    const originalStats = {
        ...copied.originalStats,
        hp: attacker.originalStats?.hp ?? base.originalStats.hp,
    };
    const targetTypes = target?.teraActive && target?.teraType
        ? [slug(target.teraType)]
        : copied.types;
    const next = {
        ...attacker,
        speciesName: copied.speciesName,
        speciesId: copied.speciesId,
        sprite: copied.sprite,
        types: targetTypes,
        originalTypes: targetTypes,
        ability: copied.ability,
        weight: copied.weight,
        stats,
        originalStats,
        stages: copied.stages,
        moves,
        pp,
        declaredMove: "",
        priority: 0,
        specialState: {
            ...state,
            transform: {
                via: ["transform", "imposter", "manual"].includes(via) ? via : "transform",
                sourceTokenId: asText(target.id),
                sourceName: asText(target.name),
                round: Math.max(0, Math.round(asNumber(round))),
                base,
            },
            illusion: null,
            moveOverrides: [],
        },
    };
    const viaLabel = via === "imposter" ? "Imposter" : "Transform";
    return {
        token: next,
        applied: true,
        narrative: `${attacker.name} assumiu a aparência, os tipos, a habilidade, os atributos não relacionados a HP, os estágios e os movimentos de ${target.name} por ${viaLabel}; HP, nível e item permaneceram próprios.`,
    };
};

export const revertBattleTransform = tokenInput => {
    const token = tokenInput && typeof tokenInput === "object" ? tokenInput : null;
    const state = normalizeSpecialState(token?.specialState);
    const base = state.transform?.base;
    if (!token || !base) return { token: tokenInput, applied: false };
    return {
        applied: true,
        token: {
            ...token,
            ...base,
            currentHp: token.currentHp,
            maxHp: token.maxHp,
            status: token.status,
            toxicCounter: token.toxicCounter,
            level: token.level,
            xp: token.xp,
            item: token.item,
            teraType: token.teraType,
            teraActive: false,
            declaredMove: "",
            priority: 0,
            specialState: {
                ...state,
                transform: null,
                moveOverrides: state.moveOverrides.filter(override => override.permanent),
            },
        },
    };
};

const UNSKETCHABLE_MOVES = new Set([
    "blazing-torque", "combat-torque", "dark-void", "hyperspace-fury", "magical-torque",
    "noxious-torque", "polar-flare", "revival-blessing", "sketch", "struggle",
    "tera-starstorm", "wicked-torque",
]);

export const copyObservedMove = (attackerInput, target, kind = "mimic") => {
    const attacker = attackerInput && typeof attackerInput === "object" ? attackerInput : null;
    const normalizedKind = kind === "sketch" ? "sketch" : "mimic";
    if (!attacker || !target) return { token: attackerInput, applied: false, reason: "escolha quem usou o movimento" };
    const state = normalizeSpecialState(attacker.specialState);
    if (state.transform) return { token: attacker, applied: false, reason: "um Pokémon transformado não pode copiar esse movimento" };
    const observed = getLastBattleMove(target);
    if (!observed?.moveName) return { token: attacker, applied: false, reason: `${target.name} ainda não usou um movimento registrado` };
    const moveName = observed.moveName;
    if (normalizedKind === "sketch" && UNSKETCHABLE_MOVES.has(moveName)) {
        return { token: attacker, applied: false, reason: `${moveName} não pode ser aprendido com Sketch` };
    }
    if (attacker.moves?.includes(moveName)) {
        return { token: attacker, applied: false, reason: `${attacker.name} já conhece esse movimento` };
    }
    const slot = asArray(attacker.moves).findIndex(move => slug(move) === normalizedKind);
    if (slot < 0) return { token: attacker, applied: false, reason: `${attacker.name} não possui ${normalizedKind}` };
    const moves = asArray(attacker.moves).slice(0, 4);
    const pp = asArray(attacker.pp).slice(0, 4);
    while (moves.length < 4) moves.push("");
    while (pp.length < 4) pp.push(null);
    const originalPp = pp[slot];
    moves[slot] = moveName;
    pp[slot] = normalizedKind === "mimic" ? 5 : null;
    const override = {
        slot,
        kind: normalizedKind,
        originalMove: normalizedKind,
        originalPp,
        copiedMove: moveName,
        permanent: normalizedKind === "sketch",
        sourceTokenId: asText(target.id),
        sourceName: asText(target.name),
    };
    const moveOverrides = [...state.moveOverrides.filter(entry => entry.slot !== slot), override];
    return {
        applied: true,
        token: { ...attacker, moves, pp, specialState: { ...state, moveOverrides } },
        override,
        narrative: normalizedKind === "sketch"
            ? `${attacker.name} observou ${target.name} e registrou ${moveName} permanentemente no lugar de Sketch.`
            : `${attacker.name} imitou ${moveName} de ${target.name}; a troca dura apenas nesta cena.`,
    };
};

export const revertTemporaryMoveCopies = tokenInput => {
    const token = tokenInput && typeof tokenInput === "object" ? tokenInput : null;
    const state = normalizeSpecialState(token?.specialState);
    const temporary = state.moveOverrides.filter(override => !override.permanent);
    if (!token || !temporary.length) return { token: tokenInput, applied: false };
    const moves = asArray(token.moves).slice(0, 4);
    const pp = asArray(token.pp).slice(0, 4);
    temporary.forEach(override => {
        moves[override.slot] = override.originalMove;
        pp[override.slot] = override.originalPp;
    });
    return {
        applied: true,
        token: {
            ...token,
            moves,
            pp,
            specialState: { ...state, moveOverrides: state.moveOverrides.filter(override => override.permanent) },
        },
    };
};

export const applyBattleIllusion = (tokenInput, disguise) => {
    const token = tokenInput && typeof tokenInput === "object" ? tokenInput : null;
    if (!token || !disguise || token.id === disguise.id) return { token: tokenInput, applied: false };
    const state = normalizeSpecialState(token.specialState);
    return {
        applied: true,
        token: {
            ...token,
            specialState: {
                ...state,
                illusion: {
                    sourceTokenId: asText(disguise.id),
                    sourceName: asText(disguise.name),
                    speciesName: slug(disguise.speciesName),
                    speciesId: Math.max(0, Math.round(asNumber(disguise.speciesId))),
                    sprite: asText(disguise.sprite).slice(0, 500),
                    types: unique(asArray(disguise.types).map(slug)).slice(0, 3),
                },
            },
        },
    };
};

export const revealBattleIllusion = tokenInput => {
    const token = tokenInput && typeof tokenInput === "object" ? tokenInput : null;
    const state = normalizeSpecialState(token?.specialState);
    if (!token || !state.illusion) return { token: tokenInput, applied: false };
    return { applied: true, token: { ...token, specialState: { ...state, illusion: null } } };
};

export const getBattleDisplayIdentity = token => {
    const state = normalizeSpecialState(token?.specialState);
    if (!state.illusion) {
        return {
            name: token?.name || "Pokémon",
            sprite: token?.sprite || "",
            types: asArray(token?.types),
            disguised: false,
            transformed: Boolean(state.transform),
        };
    }
    return {
        name: state.illusion.sourceName || token?.name || "Pokémon",
        sprite: state.illusion.sprite || token?.sprite || "",
        types: state.illusion.types.length ? state.illusion.types : asArray(token?.types),
        disguised: true,
        transformed: Boolean(state.transform),
    };
};

const speciesProfile = (id, title, summary, trigger, automation = "guided") => ({ id, title, summary, trigger, automation });

const SPECIES_PROFILES = Object.freeze({
    ditto: speciesProfile("ditto", "Corpo imitador", "Transform preserva HP, nível, item e progresso próprios, mas copia a identidade útil de batalha do alvo.", "Transform ou Imposter", "automatic"),
    smeargle: speciesProfile("smeargle", "Memória de artista", "Sketch substitui o próprio espaço pelo último movimento observado e grava a mudança na ficha vinculada.", "Sketch", "automatic"),
    zorua: speciesProfile("illusion", "Ilusão", "Pode entrar usando a aparência de um aliado; a ficha verdadeira continua intacta e pode ser revelada a qualquer momento.", "Entrada em cena ou dano", "guided"),
    zoroark: speciesProfile("illusion", "Ilusão", "Pode entrar usando a aparência de um aliado; a ficha verdadeira continua intacta e pode ser revelada a qualquer momento.", "Entrada em cena ou dano", "guided"),
    aegislash: speciesProfile("stance-change", "Mudança de postura", "Movimentos ofensivos e King's Shield alternam entre Blade Forme e Shield Forme; confirme a forma antes do cálculo.", "Movimento escolhido", "guided"),
    wishiwashi: speciesProfile("schooling", "Schooling", "A forma de cardume depende do nível e do HP; o painel mantém o gatilho visível para o Narrador.", "HP e nível", "guided"),
    minior: speciesProfile("shields-down", "Shields Down", "A carapaça e o núcleo mudam quando o HP cruza a metade, alterando forma e proteção contra condições.", "HP atual", "guided"),
    mimikyu: speciesProfile("disguise", "Disguise", "O disfarce absorve o primeiro golpe, rompe o marcador visual e cobra 1/8 do HP máximo.", "Primeiro golpe recebido", "automatic"),
    eiscue: speciesProfile("ice-face", "Ice Face", "A cabeça de gelo bloqueia o primeiro golpe físico e é restaurada pela neve.", "Golpe físico ou clima", "automatic"),
    palafin: speciesProfile("zero-to-hero", "Zero to Hero", "Depois de sair e voltar à cena, Palafin assume Hero Form; a troca deve permanecer explícita no diário.", "Retorno à cena", "narrated"),
    morpeko: speciesProfile("hunger-switch", "Hunger Switch", "Alterna Full Belly e Hangry a cada rodada, mudando o tipo de Aura Wheel.", "Fim da rodada", "guided"),
    cramorant: speciesProfile("gulp-missile", "Gulp Missile", "Surf ou Dive prepara a presa; o próximo dano recebido dispara o efeito correspondente.", "Surf, Dive e dano", "guided"),
    darmanitan: speciesProfile("zen-mode", "Zen Mode", "A forma muda conforme o HP e a habilidade; confirme a forma antes de usar tipos e atributos.", "HP atual", "guided"),
    zygarde: speciesProfile("power-construct", "Power Construct", "Ao cair para metade do HP, pode assumir Complete Forme mantendo o HP proporcional.", "HP atual", "guided"),
    shedinja: speciesProfile("wonder-guard", "HP singular e Wonder Guard", "Shedinja mantém 1 HP; golpes que não são super efetivos são barrados por Wonder Guard salvo quando uma habilidade ignora o bloqueio.", "Dano recebido", "automatic"),
    castform: speciesProfile("forecast", "Forecast", "O clima determina forma e tipo enquanto a habilidade estiver ativa.", "Mudança de clima", "guided"),
    cherrim: speciesProfile("flower-gift", "Flower Gift", "Sol forte revela Sunshine Form e fortalece aliados conforme a habilidade.", "Sol forte", "guided"),
    meloetta: speciesProfile("relic-song", "Relic Song", "Relic Song alterna Aria e Pirouette Forme após o movimento acertar.", "Relic Song", "guided"),
});

const ABILITY_PROFILE_ALIASES = Object.freeze({
    imposter: "ditto",
    illusion: "illusion",
    "stance-change": "stance-change",
    schooling: "schooling",
    "shields-down": "shields-down",
    disguise: "disguise",
    "ice-face": "ice-face",
    "zero-to-hero": "zero-to-hero",
    "hunger-switch": "hunger-switch",
    "gulp-missile": "gulp-missile",
    "zen-mode": "zen-mode",
    "power-construct": "power-construct",
    "wonder-guard": "wonder-guard",
    forecast: "forecast",
    "flower-gift": "flower-gift",
});

const profileForId = id => Object.values(SPECIES_PROFILES).find(profile => profile.id === id) || null;

export const getPokemonSpecialMechanics = token => {
    const state = normalizeSpecialState(token?.specialState);
    const originalSpecies = state.transform?.base?.speciesName || slug(token?.speciesName).split("-")[0];
    const candidates = [];
    const direct = SPECIES_PROFILES[originalSpecies];
    if (direct) candidates.push(direct);
    const abilityProfile = profileForId(ABILITY_PROFILE_ALIASES[slug(token?.ability)]);
    if (abilityProfile) candidates.push(abilityProfile);
    if (asArray(token?.moves).map(slug).includes("transform")) candidates.push(SPECIES_PROFILES.ditto);
    if (asArray(token?.moves).map(slug).includes("sketch")) candidates.push(SPECIES_PROFILES.smeargle);
    return [...new Map(candidates.filter(Boolean).map(profile => [profile.id, profile])).values()];
};

const moveProfile = (id, title, summary, automation, rules = []) => ({ id, title, summary, automation, rules });

const MOVE_FAMILIES = [
    {
        names: ["transform"],
        profile: moveProfile("transform", "Transformação integral", "Copia a identidade de batalha do alvo sem copiar HP, nível nem item.", "automatic", ["Copia tipos atuais, habilidade, atributos não relacionados a HP, estágios e quatro movimentos.", "Cada movimento copiado começa com 5 PP nesta transformação."]),
    },
    {
        names: ["sketch"],
        profile: moveProfile("sketch", "Aprendizado permanente", "Substitui Sketch pelo último movimento válido que o alvo usou; a ficha vinculada também recebe a mudança.", "automatic", ["Não funciona sem um movimento observado válido.", "Movimentos marcados como não copiáveis continuam protegidos."]),
    },
    {
        names: ["mimic"],
        profile: moveProfile("mimic", "Cópia temporária", "Imita o último movimento observado no lugar de Mimic durante esta cena.", "automatic", ["A ficha original não é alterada.", "O Narrador pode desfazer a cópia na ficha rápida."]),
    },
    {
        names: ["metronome", "copycat", "assist", "sleep-talk", "nature-power", "mirror-move", "me-first", "instruct"],
        profile: moveProfile("called-move", "Movimento que chama outro", "O primeiro movimento escolhe ou chama um segundo; resolva o movimento resultante como uma ação própria.", "guided", ["Consuma PP apenas do movimento originalmente escolhido.", "Respeite as exclusões de cópia/chamada indicadas pela descrição."]),
    },
    {
        names: ["future-sight", "doom-desire", "wish"],
        profile: moveProfile("delayed", "Efeito adiado", "O resultado fica marcado e acontece depois, sem aplicar o impacto imediatamente.", "automatic", ["O marcador mostra quantas rodadas faltam.", "O Diário registra preparação e resolução separadamente."]),
    },
    {
        names: ["counter", "mirror-coat", "metal-burst", "comeuppance", "bide"],
        profile: moveProfile("retaliation", "Retaliação por dano anterior", "O valor depende do dano recebido e da ação anterior, portanto o Assistente preserva o contexto e pede o valor quando necessário.", "guided"),
    },
    {
        names: ["pain-split", "endeavor", "super-fang", "natures-madness", "ruination", "final-gambit", "seismic-toss", "night-shade", "dragon-rage", "sonic-boom", "psywave"],
        profile: moveProfile("fixed-hp", "Dano ou HP fora da fórmula comum", "Usa nível, HP atual, média ou valor fixo em vez do poder convencional.", "automatic"),
    },
    {
        names: ["gyro-ball", "electro-ball", "low-kick", "grass-knot", "heavy-slam", "heat-crash", "flail", "reversal", "eruption", "water-spout", "dragon-energy", "hard-press", "crush-grip", "wring-out", "stored-power", "power-trip", "punishment", "facade", "hex", "infernal-parade", "venoshock", "barb-barrage", "acrobatics", "knock-off", "brine", "magnitude"],
        profile: moveProfile("dynamic-power", "Poder calculado pela situação", "HP, peso, velocidade, condição, item ou estágios definem o poder real antes da disputa.", "automatic"),
    },
    {
        names: ["fly", "dig", "dive", "bounce", "phantom-force", "shadow-force", "solar-beam", "solar-blade", "sky-attack", "skull-bash", "meteor-beam", "razor-wind", "geomancy", "electro-shot"],
        profile: moveProfile("two-turn", "Movimento em duas etapas", "A primeira declaração prepara a ação; a segunda resolve o impacto, salvo efeitos que eliminem a preparação.", "guided"),
    },
    {
        names: ["hyper-beam", "giga-impact", "blast-burn", "frenzy-plant", "hydro-cannon", "rock-wrecker", "roar-of-time", "meteor-assault", "eternabeam", "prismatic-laser"],
        profile: moveProfile("recharge", "Recarga obrigatória", "Depois do impacto, marque a próxima ação como recarga antes de voltar a escolher movimentos.", "guided"),
    },
    {
        names: ["trick", "switcheroo", "skill-swap", "role-play", "entrainment", "simple-beam", "worry-seed", "gastro-acid", "soak", "magic-powder", "trick-or-treat", "forests-curse", "conversion", "conversion-2", "reflect-type"],
        profile: moveProfile("identity-state", "Mudança de item, habilidade ou tipo", "Altera uma parte específica da identidade de batalha sem reescrever a ficha inteira.", "guided"),
    },
    {
        names: ["haze", "clear-smog", "psych-up", "heart-swap", "power-swap", "guard-swap", "speed-swap", "power-trick", "topsy-turvy"],
        profile: moveProfile("stage-control", "Controle excepcional de modificadores", "Limpa, copia, troca ou inverte estágios em vez de aplicar uma alteração simples.", "automatic"),
    },
    {
        names: ["substitute", "leech-seed", "perish-song", "aqua-ring", "ingrain"],
        profile: moveProfile("persistent", "Efeito persistente", "Cria um estado visível que continua entre ações e é resolvido no fim de cada rodada.", "automatic"),
    },
    {
        names: ["destiny-bond", "grudge", "curse"],
        profile: moveProfile("conditional-persistent", "Vínculo persistente condicional", "O efeito continua em cena, mas seu resultado depende de quem age, de como ocorre o nocaute ou do tipo do usuário.", "guided", ["O painel mantém a exceção visível.", "O Narrador confirma o gatilho antes de alterar HP ou PP."]),
    },
    {
        names: ["explosion", "self-destruct", "misty-explosion", "final-gambit", "memento", "healing-wish", "lunar-dance"],
        profile: moveProfile("self-sacrifice", "Sacrifício do usuário", "O usuário sai de combate automaticamente; quando o movimento prepara cura para quem entrar depois, o Narrador escolhe o destinatário.", "guided", ["O Diário separa o resultado causado do custo pago.", "Healing Wish e Lunar Dance aguardam a entrada do próximo Pokémon válido."]),
    },
    {
        names: ["baton-pass", "u-turn", "volt-switch", "flip-turn", "parting-shot", "teleport", "chilly-reception", "shed-tail", "roar", "whirlwind", "dragon-tail", "circle-throw"],
        profile: moveProfile("position-switch", "Troca ou reposicionamento", "O efeito depende de quem deixa ou entra na cena; o campo sinaliza a etapa, mas o Narrador escolhe o substituto.", "narrated"),
    },
];

const MOVE_PROFILE_MAP = new Map();
MOVE_FAMILIES.forEach(family => family.names.forEach(name => MOVE_PROFILE_MAP.set(name, family.profile)));

export const getMoveSpecialProfile = move => MOVE_PROFILE_MAP.get(slug(move?.name)) || null;

const positiveStages = stages => STAGE_KEYS.reduce((sum, key) => sum + Math.max(0, asNumber(stages?.[key])), 0);
const hpRatio = token => clamp(asNumber(token?.currentHp) / Math.max(1, asNumber(token?.maxHp, 1)), 0, 1);

export const calculateDynamicMovePower = ({ move, attacker, defender, random } = {}) => {
    const name = slug(move?.name);
    let power = null;
    let explanation = "";
    const attackerSpeed = Math.max(1, asNumber(attacker?.stats?.speed, 1));
    const defenderSpeed = Math.max(1, asNumber(defender?.stats?.speed, 1));
    const attackerWeight = Math.max(0.1, asNumber(attacker?.weight, 0.1));
    const defenderWeight = Math.max(0.1, asNumber(defender?.weight, 0.1));
    const basePower = Math.max(0, asNumber(move?.power));

    if (["eruption", "water-spout", "dragon-energy"].includes(name)) {
        power = Math.max(1, Math.floor((basePower || 150) * hpRatio(attacker)));
        explanation = `HP do usuário: ${Math.round(hpRatio(attacker) * 100)}%`;
    } else if (["hard-press", "crush-grip", "wring-out"].includes(name)) {
        const maximum = name === "hard-press" ? 100 : 120;
        power = Math.max(1, Math.floor(maximum * hpRatio(defender)));
        explanation = `HP do alvo: ${Math.round(hpRatio(defender) * 100)}%`;
    } else if (["flail", "reversal"].includes(name)) {
        const ratio = hpRatio(attacker);
        power = ratio <= 1 / 24 ? 200 : ratio <= 1 / 9.6 ? 150 : ratio <= 1 / 4.8 ? 100 : ratio <= 1 / 2.823 ? 80 : ratio <= 1 / 1.455 ? 40 : 20;
        explanation = `HP do usuário: ${Math.round(ratio * 100)}%`;
    } else if (name === "gyro-ball") {
        power = Math.min(150, Math.floor(25 * defenderSpeed / attackerSpeed) + 1);
        explanation = `Velocidade ${attackerSpeed} contra ${defenderSpeed}`;
    } else if (name === "electro-ball") {
        const ratio = attackerSpeed / defenderSpeed;
        power = ratio >= 4 ? 150 : ratio >= 3 ? 120 : ratio >= 2 ? 80 : ratio >= 1 ? 60 : 40;
        explanation = `Razão de Velocidade ${ratio.toFixed(2)}×`;
    } else if (["low-kick", "grass-knot"].includes(name)) {
        const kilograms = defenderWeight / 10;
        power = kilograms < 10 ? 20 : kilograms < 25 ? 40 : kilograms < 50 ? 60 : kilograms < 100 ? 80 : kilograms < 200 ? 100 : 120;
        explanation = `Peso do alvo: ${kilograms.toFixed(1)} kg`;
    } else if (["heavy-slam", "heat-crash"].includes(name)) {
        const ratio = attackerWeight / defenderWeight;
        power = ratio >= 5 ? 120 : ratio >= 4 ? 100 : ratio >= 3 ? 80 : ratio >= 2 ? 60 : 40;
        explanation = `Razão de peso ${ratio.toFixed(2)}×`;
    } else if (["stored-power", "power-trip"].includes(name)) {
        const stages = positiveStages(attacker?.stages);
        power = 20 + stages * 20;
        explanation = positiveStageLabel(stages);
    } else if (name === "punishment") {
        const stages = positiveStages(defender?.stages);
        power = Math.min(200, 60 + stages * 20);
        explanation = `${positiveStageLabel(stages)} no alvo`;
    } else if (name === "facade" && attacker?.status) {
        power = (basePower || 70) * 2;
        explanation = "Condição principal do usuário dobrou o poder";
    } else if (["hex", "infernal-parade"].includes(name) && defender?.status) {
        power = (basePower || (name === "hex" ? 65 : 60)) * 2;
        explanation = "Condição principal do alvo dobrou o poder";
    } else if (["venoshock", "barb-barrage"].includes(name) && ["poison", "bad-poison"].includes(defender?.status)) {
        power = (basePower || 65) * 2;
        explanation = "Envenenamento do alvo dobrou o poder";
    } else if (name === "acrobatics" && !attacker?.item) {
        power = (basePower || 55) * 2;
        explanation = "Usuário sem item";
    } else if (name === "knock-off" && defender?.item) {
        power = Math.floor((basePower || 65) * 1.5);
        explanation = "O alvo ainda possui um item removível";
    } else if (name === "brine" && hpRatio(defender) <= 0.5) {
        power = (basePower || 65) * 2;
        explanation = "Alvo com metade do HP ou menos";
    } else if (name === "magnitude") {
        const roll = rollDie(100, random);
        const magnitude = roll <= 5 ? 4 : roll <= 15 ? 5 : roll <= 35 ? 6 : roll <= 65 ? 7 : roll <= 85 ? 8 : roll <= 95 ? 9 : 10;
        power = ({ 4: 10, 5: 30, 6: 50, 7: 70, 8: 90, 9: 110, 10: 150 })[magnitude];
        explanation = `Magnitude ${magnitude}`;
    }

    return power == null ? null : { power, explanation };
};

export const getMoveStatProfile = ({ move, attacker, defender } = {}) => {
    const name = slug(move?.name);
    const category = slug(move?.damage_class?.name);
    let attackKey = category === "special" ? "special-attack" : "attack";
    let defenseKey = category === "special" ? "special-defense" : "defense";
    let attackSource = "attacker";
    let explanation = "";
    if (name === "body-press") {
        attackKey = "defense";
        explanation = "Body Press usa a Defesa do usuário";
    } else if (name === "foul-play") {
        attackKey = "attack";
        attackSource = "defender";
        explanation = "Foul Play usa o Ataque do alvo";
    } else if (["psyshock", "psystrike", "secret-sword"].includes(name)) {
        attackKey = "special-attack";
        defenseKey = "defense";
        explanation = "O ataque é especial, mas disputa contra Defesa";
    } else if (["photon-geyser", "light-that-burns-the-sky"].includes(name) || (name === "tera-blast" && attacker?.teraActive)) {
        const physical = asNumber(attacker?.stats?.attack) > asNumber(attacker?.stats?.["special-attack"]);
        attackKey = physical ? "attack" : "special-attack";
        defenseKey = physical ? "defense" : "special-defense";
        explanation = `Usa o maior atributo ofensivo: ${physical ? "Ataque" : "Ataque Especial"}`;
    } else if (name === "shell-side-arm" && defender) {
        const physicalRatio = asNumber(attacker?.stats?.attack) / Math.max(1, asNumber(defender?.stats?.defense, 1));
        const specialRatio = asNumber(attacker?.stats?.["special-attack"]) / Math.max(1, asNumber(defender?.stats?.["special-defense"], 1));
        const physical = physicalRatio > specialRatio;
        attackKey = physical ? "attack" : "special-attack";
        defenseKey = physical ? "defense" : "special-defense";
        explanation = `Shell Side Arm escolheu a rota ${physical ? "física" : "especial"}`;
    }
    return { attackKey, defenseKey, attackSource, explanation };
};

const ABILITY_TYPE_BLOCKS = Object.freeze({
    ground: new Set(["levitate"]),
    fire: new Set(["flash-fire", "well-baked-body"]),
    water: new Set(["water-absorb", "storm-drain", "dry-skin"]),
    electric: new Set(["volt-absorb", "lightning-rod", "motor-drive"]),
    grass: new Set(["sap-sipper"]),
});
const ABILITY_BREAKERS = new Set(["mold-breaker", "teravolt", "turboblaze"]);
const PROTECTION_BYPASS_MOVES = new Set(["feint", "hyperspace-fury", "hyperspace-hole", "phantom-force", "shadow-force"]);
const SUBSTITUTE_BYPASS_MOVES = new Set([
    "boomburst", "bug-buzz", "chatter", "clangorous-soulblaze", "disarming-voice",
    "echoed-voice", "hyper-voice", "metal-sound", "noble-roar", "overdrive",
    "parting-shot", "perish-song", "relic-song", "roar", "round", "screech",
    "sing", "snarl", "snore", "sparkling-aria", "supersonic", "uproar",
]);

export const getAbilityMoveBlock = ({ move, attacker, defender, effectiveness = 1 } = {}) => {
    const abilityShield = isHeldItemActive(defender) && traitSlug(defender?.item) === "ability-shield";
    if (!defender || (isAbilityActive(attacker) && ABILITY_BREAKERS.has(slug(attacker?.ability)) && !abilityShield)) return null;
    const ability = isAbilityActive(defender) ? slug(defender.ability) : "";
    const moveType = slug(move?.type?.name);
    const moveName = slug(move?.name);
    const damageClass = slug(move?.damage_class?.name);
    const damaging = damageClass === "physical" || damageClass === "special";
    if (ABILITY_TYPE_BLOCKS[moveType]?.has(ability) && !(ability === "levitate" && moveName === "thousand-arrows")) {
        return { ability, reason: `${ability} anulou o movimento de tipo ${moveType}`, absorbed: true };
    }
    if (ability === "wonder-guard" && damaging && effectiveness <= 1 && moveName !== "struggle") {
        return { ability, reason: "Wonder Guard só permite dano super efetivo", absorbed: false };
    }
    const markers = normalizeSpecialState(defender.specialState).markers;
    if (ability === "disguise" && damaging && !markers.includes("disguise-broken")) {
        return { ability, reason: "Disguise absorveu o primeiro golpe", marker: "disguise-broken" };
    }
    if (ability === "ice-face" && damageClass === "physical" && !markers.includes("ice-face-broken")) {
        return { ability, reason: "Ice Face absorveu o primeiro golpe físico", marker: "ice-face-broken" };
    }
    return null;
};

export const getSpecialMoveBlockReason = ({ move, attacker, defender, round } = {}) => {
    const name = slug(move?.name);
    const protectedTarget = asArray(defender?.volatileEffects).some(effect => slug(effect?.id || effect) === "protection");
    const targetName = slug(move?.target?.name);
    const damageClass = slug(move?.damage_class?.name);
    const opponentDirected = !["user", "users-field", "user-and-allies", "all-allies", "entire-field", "all-pokemon"].includes(targetName);
    if (protectedTarget && opponentDirected && !PROTECTION_BYPASS_MOVES.has(name)) return "a proteção ativa bloqueou o movimento";
    const substituteActive = asArray(defender?.volatileEffects).some(effect => slug(effect?.id || effect) === "substitute");
    if (
        substituteActive
        && opponentDirected
        && damageClass === "status"
        && !(isAbilityActive(attacker) && slug(attacker?.ability) === "infiltrator")
        && !SUBSTITUTE_BYPASS_MOVES.has(name)
    ) return "Substitute protegeu o alvo desse efeito";
    if (["dream-eater", "nightmare"].includes(name) && !["sleep"].includes(defender?.status) && !(isAbilityActive(defender) && slug(defender?.ability) === "comatose")) {
        return "o alvo precisa estar dormindo";
    }
    if (["snore", "sleep-talk"].includes(name) && attacker?.status !== "sleep") return "o usuário precisa estar dormindo";
    if (name === "rest" && asNumber(attacker?.currentHp) >= asNumber(attacker?.maxHp)) return "o HP já está cheio";
    if (["sucker-punch", "thunderclap", "upper-hand"].includes(name) && !defender?.declaredMove) return "o alvo ainda não declarou uma ação compatível";
    if (["fake-out", "first-impression", "mat-block"].includes(name) && round && asNumber(attacker?.enteredRound, 1) < asNumber(round)) {
        return "só funciona na primeira rodada do usuário em cena";
    }
    if (name === "last-resort") {
        const required = asArray(attacker?.moves).map(slug).filter(moveName => moveName && moveName !== "last-resort");
        const used = new Set(normalizeSpecialState(attacker?.specialState).history.map(entry => entry.moveName));
        if (required.some(moveName => !used.has(moveName))) return "os outros movimentos precisam ter sido usados antes";
    }
    if (name === "transform") {
        if (normalizeSpecialState(attacker?.specialState).transform) return "o usuário já está transformado";
        return defender ? transformedTargetBlocked(defender) : "escolha um alvo válido";
    }
    if (["sketch", "mimic"].includes(name) && !getLastBattleMove(defender)) return "o alvo ainda não possui um último movimento registrado";
    return "";
};

export const ignoresGhostTypeImmunity = (attacker, moveType, defenderTypes) => {
    const ability = isAbilityActive(attacker) ? slug(attacker?.ability) : "";
    const type = slug(moveType);
    const types = asArray(defenderTypes).map(slug);
    return ["scrappy", "mind-s-eye"].includes(ability)
        && types.includes("ghost")
        && ["normal", "fighting"].includes(type);
};
