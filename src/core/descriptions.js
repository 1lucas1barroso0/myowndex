import {
    convertToTTRPG,
    formatDamageClass,
    formatName,
    formatNumberPtBr,
    formatType,
    preferredLocalizedEntry,
} from "./mechanics.js";
import { finiteNumber as asNumber, finiteNumberOrNull } from "./math.js";
import {
    getAbilityProfile,
    getItemProfile,
    moveHasTrait,
    TRAIT_AUTOMATION_LABELS,
} from "./traitMechanics.js";

const asArray = value => Array.isArray(value) ? value : [];
const asSlug = value => String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");

const proportion = (numerator, denominator) => {
    const value = Number(numerator) / Number(denominator) * 100;
    if (!Number.isFinite(value) || Number(denominator) <= 0) return `${numerator}/${denominator}`;
    const approximate = Math.abs(value * 100 - Math.round(value * 100)) > 1e-8;
    return `${approximate ? "≈ " : ""}${formatNumberPtBr(value)}%`;
};

export const formatCatalogProportions = value => String(value || "")
    .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (original, numerator, denominator) => Number(numerator) <= Number(denominator) ? proportion(numerator, denominator) : original)
    .replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, glyph => ({ "½": "50%", "⅓": "≈ 33,33%", "⅔": "≈ 66,67%", "¼": "25%", "¾": "75%", "⅛": "12,5%", "⅜": "37,5%", "⅝": "62,5%", "⅞": "87,5%" })[glyph])
    .replace(/\b(?:one[ -]third|a third|one[ -]quarter|a quarter|one[ -]eighth|one[ -]sixteenth)\b/gi, words => {
        const normalized = words.toLowerCase().replace(/-/g, " ");
        if (normalized.endsWith("third")) return "≈ 33,33%";
        if (normalized.endsWith("quarter")) return "25%";
        return normalized.endsWith("sixteenth") ? "6,25%" : "12,5%";
    });

export const cleanDescription = (value, effectChance = "") => formatCatalogProportions(String(value || "")
    .replace(/\$effect_chance/g, effectChance === "" || effectChance == null ? "a chance indicada" : String(effectChance))
    .replace(/[\n\f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bPOK[ÉE]MON\b/gi, "Pokémon")
    .trim());

const languageMeta = entry => {
    const code = String(entry?.language?.name || "").toLowerCase();
    if (["pt-br", "pt"].includes(code)) return { code: "pt-BR", label: "Descrição do catálogo" };
    if (code === "en") return { code: "en", label: "Descrição original disponível em inglês" };
    return { code: code || "pt-BR", label: "Descrição do catálogo" };
};

export const catalogDescription = (entries, fields, effectChance = "") => {
    const entry = preferredLocalizedEntry(entries);
    const field = fields.find(key => cleanDescription(entry?.[key], effectChance));
    const text = field ? cleanDescription(entry?.[field], effectChance) : "";
    return { text, ...languageMeta(entry) };
};

const TARGET_COPY = Object.freeze({
    user: "O efeito fica em quem usa o movimento; não é preciso escolher outro Pokémon.",
    "users-field": "O efeito fica no lado de quem usa e alcança a equipe conforme a regra do movimento.",
    "user-and-allies": "O efeito alcança quem usa e todos os aliados presentes.",
    "all-allies": "O efeito alcança todos os aliados presentes.",
    ally: "É preciso escolher um aliado como alvo.",
    "user-or-ally": "É preciso escolher quem usa ou um aliado como alvo.",
    "all-opponents": "O efeito alcança todos os oponentes presentes; não se escolhe apenas um deles.",
    "opponents-field": "O efeito fica no lado dos oponentes e não exige escolher um Pokémon específico.",
    "random-opponent": "O alvo é um oponente escolhido ao acaso.",
    "all-other-pokemon": "O efeito alcança todos os outros Pokémon em cena, aliados e oponentes.",
    "all-pokemon": "O efeito alcança todos os Pokémon em cena, inclusive quem usa.",
    "entire-field": "O efeito altera o campo inteiro e não exige escolher um Pokémon.",
    "specific-move": "O alvo é definido pelo movimento que esta ação está respondendo.",
    "selected-pokemon-me-first": "É preciso escolher o oponente cujo movimento será antecipado.",
    "selected-pokemon": "É preciso escolher um Pokémon como alvo.",
});

const AILMENT_COPY = Object.freeze({
    burn: "Burn",
    freeze: "Freeze",
    paralysis: "Paralysis",
    poison: "Poison",
    sleep: "Sleep",
    confusion: "Confusion",
    infatuation: "Infatuation",
    trap: "aprisionamento",
    torment: "tormento",
    disable: "bloqueio de movimento",
    yawn: "sonolência por Yawn",
});

const STAT_COPY = Object.freeze({
    attack: "Ataque",
    defense: "Defesa",
    "special-attack": "Ataque Especial",
    "special-defense": "Defesa Especial",
    speed: "Velocidade",
    accuracy: "Precisão",
    evasion: "Evasão",
});

const chanceSentence = (chance, text) => {
    const value = asNumber(chance);
    if (value <= 0) return "";
    return value >= 100 ? `${text} sempre que o movimento produzir esse efeito.` : `${text} em ${value}% dos acertos.`;
};

export const describeMove = (move, { isTTRPG = false } = {}) => {
    if (!move) {
        return {
            summary: "Os detalhes deste movimento ainda não chegaram. Nenhuma regra será presumida até que a Pokédex consiga consultá-los.",
            facts: [],
            catalog: { text: "", code: "pt-BR", label: "Descrição do catálogo" },
        };
    }

    const damageClass = asSlug(move.damage_class?.name);
    const moveType = formatType(move.type?.name);
    const physical = damageClass === "physical";
    const special = damageClass === "special";
    const damaging = physical || special;
    const target = asSlug(move.target?.name) || "selected-pokemon";
    const facts = [];

    if (physical) {
        facts.push(`É um movimento físico do tipo ${moveType}: usa o Ataque de quem age contra a Defesa do alvo.`);
    } else if (special) {
        facts.push(`É um movimento especial do tipo ${moveType}: usa o Ataque Especial de quem age contra a Defesa Especial do alvo.`);
    } else {
        facts.push(`É um movimento de estado do tipo ${moveType}. Ele não causa dano direto; seu resultado vem do efeito descrito abaixo.`);
    }

    facts.push(TARGET_COPY[target] || "É preciso confirmar o alvo indicado pela regra do movimento antes de resolver a ação.");

    if (move.accuracy == null || move.accuracy === true) {
        facts.push("Não há teste de precisão próprio: depois de uma declaração válida, o movimento acerta, salvo se outra regra o impedir.");
    } else {
        facts.push(`A precisão base é ${asNumber(move.accuracy)}%. Precisão, Evasão, habilidades, itens e condições da cena podem alterar essa chance.`);
    }

    if (damaging && asNumber(move.power) > 0) {
        const power = isTTRPG ? convertToTTRPG(move.power) : asNumber(move.power);
        facts.push(`O poder considerado neste modo é ${power}${isTTRPG ? ", já convertido para as regras do RPG" : ""}.`);
    } else if (damaging) {
        facts.push("O movimento causa dano, mas o valor depende de sua regra especial ou do estado atual da batalha; não use um poder inventado.");
    }

    const pp = asNumber(move.pp);
    facts.push(pp > 0
        ? `Possui ${pp} PP antes de ajustes de PP Up, PP Max ou regras de cópia.`
        : "O catálogo não informa um valor comum de PP; confirme a regra própria antes de gastar um uso.");

    const priority = asNumber(move.priority);
    if (priority > 0) facts.push(`Tem prioridade +${priority} e entra antes de movimentos sem prioridade na mesma rodada.`);
    if (priority < 0) facts.push(`Tem prioridade ${priority} e normalmente acontece depois de movimentos sem prioridade.`);

    facts.push(moveHasTrait(move, "contact")
        ? "Exige contato direto com o alvo e pode ativar habilidades ou itens que respondem ao toque."
        : "Não exige contato direto; efeitos que dependem de toque não são ativados apenas por este movimento.");

    const minimumHits = asNumber(move.meta?.min_hits);
    const maximumHits = asNumber(move.meta?.max_hits);
    if (maximumHits > 1) facts.push(`Pode acertar de ${Math.max(1, minimumHits)} a ${maximumHits} vezes; cada acerto é acompanhado separadamente.`);

    const ailment = asSlug(move.meta?.ailment?.name);
    if (ailment && ailment !== "none") {
        const ailmentName = AILMENT_COPY[ailment] || formatName(ailment).toLowerCase();
        const chance = move.meta?.ailment_chance || move.effect_chance || (damageClass === "status" ? 100 : 0);
        const sentence = chanceSentence(chance, `Pode causar ${ailmentName}`);
        if (sentence) facts.push(sentence);
    }

    const flinch = chanceSentence(move.meta?.flinch_chance, "Pode fazer o alvo hesitar");
    if (flinch) facts.push(flinch);

    asArray(move.stat_changes).forEach(change => {
        const amount = asNumber(change.change);
        if (!amount) return;
        const stat = STAT_COPY[asSlug(change.stat?.name)] || formatName(change.stat?.name);
        const chance = move.meta?.stat_chance || move.effect_chance || 100;
        const direction = amount > 0 ? "aumenta" : "reduz";
        const sentence = chanceSentence(chance, `${direction.charAt(0).toUpperCase()}${direction.slice(1)} ${stat} em ${Math.abs(amount)} estágio${Math.abs(amount) === 1 ? "" : "s"}`);
        if (sentence) facts.push(sentence);
    });

    const drain = asNumber(move.meta?.drain);
    if (drain > 0) facts.push(`Quem usa recupera HP equivalente a ${drain}% do dano realmente causado.`);
    if (drain < 0) facts.push(`Quem usa sofre recuo equivalente a ${Math.abs(drain)}% do dano realmente causado.`);
    const healing = asNumber(move.meta?.healing);
    if (healing > 0) facts.push(`Recupera ${healing}% do HP máximo quando a cura é permitida.`);

    const catalog = catalogDescription(move.effect_entries, ["effect", "short_effect"], move.effect_chance);
    const summary = `${formatName(move.name)} é ${formatDamageClass(move.damage_class?.name).toLowerCase()} e ${damaging ? "pode causar dano" : "atua por efeito"}. ${facts[1]}`;
    return { summary, facts, catalog };
};

export const describeTrait = (kind, id, detail) => {
    const profile = kind === "ability" ? getAbilityProfile(id) : getItemProfile(id);
    if (!profile) return null;
    const entries = asArray(detail?.effect_entries);
    const flavorEntries = asArray(detail?.flavor_text_entries);
    const catalog = catalogDescription(entries.length ? entries : flavorEntries, entries.length ? ["effect", "short_effect"] : ["flavor_text"]);
    const subject = kind === "ability" ? "A habilidade" : "O item";
    return {
        profile,
        catalog,
        summary: profile.summary,
        trigger: `${subject} entra em jogo quando ocorre: ${profile.trigger.toLowerCase()}.`,
        handling: `${TRAIT_AUTOMATION_LABELS[profile.automation]}. O efeito oficial continua visível para que nenhuma exceção seja escondida.`,
    };
};

const HABITAT_COPY = Object.freeze({
    cave: "Cave", forest: "Forest", grassland: "Grassland", mountain: "Mountain",
    rare: "Rare", "rough-terrain": "Rough Terrain", sea: "Sea", urban: "Urban",
    "waters-edge": "Water’s Edge",
});

const GROWTH_COPY = Object.freeze({
    slow: "Slow", medium: "Medium Fast", fast: "Fast",
    "medium-slow": "Medium Slow", "slow-then-very-fast": "Erratic", "fast-then-very-slow": "Fluctuating",
});

export const describeSpecies = (species, pokemon) => {
    const flavor = catalogDescription(species?.flavor_text_entries, ["flavor_text"]);
    const genus = catalogDescription(asArray(species?.genera).filter(entry => entry.language?.name === "en"), ["genus"]);
    const facts = [];
    if (genus.text) facts.push(genus.text);
    const habitat = asSlug(species?.habitat?.name);
    if (habitat) facts.push(`Habitat associado: ${HABITAT_COPY[habitat] || formatName(habitat).toLowerCase()}.`);
    const growth = asSlug(species?.growth_rate?.name);
    if (growth) facts.push(`Ritmo de crescimento: ${GROWTH_COPY[growth] || formatName(growth).toLowerCase()}.`);
    const captureRate = finiteNumberOrNull(species?.capture_rate);
    if (captureRate != null) {
        facts.push(`Taxa de captura dos jogos: ${captureRate} em 255; números maiores representam capturas mais fáceis, antes dos bônus da Poké Ball e da condição do alvo.`);
    }
    const baseHappiness = finiteNumberOrNull(species?.base_happiness);
    if (baseHappiness != null) {
        facts.push(`Amizade inicial de referência: ${baseHappiness} em 255; a ficha da sua aventura pode registrar outro vínculo.`);
    }
    const height = finiteNumberOrNull(pokemon?.height);
    const weight = finiteNumberOrNull(pokemon?.weight);
    if (height != null && weight != null) {
        facts.push(`A forma consultada mede ${(height / 10).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m e pesa ${(weight / 10).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg.`);
    }
    return {
        flavor,
        facts,
        summary: flavor.text || "A Pokédex ainda não recebeu um relato biológico para esta espécie. Os dados objetivos abaixo continuam disponíveis, sem preencher lacunas por suposição.",
    };
};
