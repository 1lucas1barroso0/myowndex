import { convertToTTRPG } from "./mechanics.js";

export const TRAINER_GUIDE_URL = "https://guia-do-treinador-pokemon.vercel.app/";

export const EXPERIENCE_MODES = {
    rpg: {
        id: "rpg",
        label: "RPG",
        shortLabel: "RPG",
        description: "Regras dos jogos adaptadas à mesa, com espaço para soluções criativas.",
        isTTRPG: true,
        isFreeform: false,
        color: "amber"
    },
    game: {
        id: "game",
        label: "Videogame",
        shortLabel: "Jogo",
        description: "Atributos originais e sugestões compatíveis com o jogo escolhido.",
        isTTRPG: false,
        isFreeform: false,
        color: "blue"
    },
    free: {
        id: "free",
        label: "Modo livre",
        shortLabel: "Livre",
        description: "Crie sem limites: movimentos, habilidades, tipos e atributos ficam à sua escolha.",
        isTTRPG: true,
        isFreeform: true,
        color: "purple"
    }
};

export const RPG_RULE_SECTIONS = [
    {
        id: "rolagens",
        number: 1,
        title: "Sistema de rolagens",
        summary: "Testes com 2d6, vantagem, críticos e chances percentuais.",
        rules: [
            {
                id: "1.1",
                title: "Testes básicos",
                body: "Role 2d6 e some o atributo correspondente do Pokémon. Em uma disputa, o alvo que se defende vence os empates."
            },
            {
                id: "1.2",
                title: "Vantagem e desvantagem",
                body: "A cena, o clima e o ambiente podem alterar os dados do teste.",
                bullets: [
                    "Vantagem: role 3d6 e mantenha os dois maiores.",
                    "Desvantagem: role 3d6 e mantenha os dois menores."
                ]
            },
            {
                id: "1.3",
                title: "Acertos e erros críticos",
                bullets: [
                    "Acerto crítico: obtenha 6 e 6 nos dados mantidos; o resultado funciona como um golpe crítico dos jogos.",
                    "Erro crítico: obtenha 1 e 1 nos dados mantidos; o resultado traz uma consequência narrativa ou mecânica grave."
                ]
            },
            {
                id: "1.4",
                title: "Probabilidades e efeitos secundários",
                body: "Para uma chance percentual, role 1d100: o teste tem sucesso quando o resultado é igual ou menor que a chance. Se o teste do movimento superar a oposição por mais de 1, role o d100 duas vezes e use o melhor resultado. Um movimento nunca concede mais de dois d100."
            }
        ]
    },
    {
        id: "matematica",
        number: 2,
        title: "Matemática do RPG",
        summary: "Atributos, escala por 20, estágios, XP e valores mínimos.",
        rules: [
            {
                id: "2.1",
                title: "Construção dos atributos",
                body: "IVs, EVs, naturezas e nível funcionam como nos jogos. Para manter a aventura fluida, o Narrador pode entregar os atributos já calculados."
            },
            {
                id: "2.2",
                title: "Divisão por 20",
                body: "Atributos, dano base dos movimentos e Amizade são divididos por 20. Partes decimais de 0,55 ou menos são arredondadas para baixo; partes de 0,56 ou mais, para cima."
            },
            {
                id: "2.3",
                title: "Estágios de atributos",
                body: "Aumentos e reduções de atributos seguem as regras dos jogos e são aplicados ao valor original. Só depois disso o resultado é dividido por 20."
            },
            {
                id: "2.4",
                title: "Zeros e limites mínimos",
                body: "Um atributo pode chegar a 0; nesse caso, role apenas os dados. HP máximo nunca fica abaixo de 1. Ataques causam ao menos 1 de dano, salvo imunidade ou redução final para 0,55 ou menos."
            },
            {
                id: "2.5",
                title: "Experiência e evolução",
                bullets: [
                    "Para alcançar o próximo nível, acumule XP igual à metade desse novo nível. A contagem volta a zero depois do avanço.",
                    "Em batalhas com vários aliados, divida a XP proporcionalmente. Todo Pokémon que entrou em campo recebe pelo menos 1 XP."
                ]
            }
        ]
    },
    {
        id: "combate",
        number: 3,
        title: "Combate e movimentos",
        summary: "Iniciativa, precisão, dano e liberdade de movimento na cena.",
        rules: [
            {
                id: "3.1",
                title: "Ordem dos turnos",
                body: "No início de cada rodada, todos testam Velocidade. Movimentos com prioridade são resolvidos primeiro; empates de iniciativa usam uma rolagem rápida de desempate."
            },
            {
                id: "3.2",
                title: "Precisão",
                body: "Movimentos que ignoram precisão e evasão nos jogos não exigem rolagem: se a ação não for interrompida, ela acerta. Nos demais casos, role 1d100 e obtenha um valor igual ou menor que a precisão. Uma margem superior a 1 na disputa concede o segundo d100 previsto na regra 1.4."
            },
            {
                id: "3.3",
                title: "Resolução do dano",
                body: "Físicos testam Ataque contra Defesa; Especiais testam Ataque Especial contra Defesa Especial.",
                bullets: [
                    "O atacante precisa superar o defensor. Um empate ou resultado menor não causa dano, embora os efeitos secundários ainda possam acontecer.",
                    "O dano final combina dano base, STAB e modificadores de tipo.",
                    "Um golpe não causa mais que metade do nível do atacante; no nível 1, vale o mínimo de 1 de dano. Aumentos temporários elevam esse limite proporcionalmente."
                ]
            },
            {
                id: "3.4",
                title: "Regras herdadas dos jogos",
                body: "Tipos, STAB, imunidades, condições, golpes de múltiplos acertos, recuo, drenagem e outras regras mantêm sua intenção original, adaptadas apenas à escala e à narrativa."
            },
            {
                id: "3.5",
                title: "Posicionamento e espaço",
                body: "O jogo não exige um tabuleiro quadriculado. As distâncias são narrativas: Perto, Longe e Muito Longe. Área, alcance, cenário e Velocidade são interpretados conforme a cena."
            }
        ]
    },
    {
        id: "treinador",
        number: 4,
        title: "Treinador e jornada",
        summary: "Intervenções, captura, PP, cura e recursos.",
        rules: [
            {
                id: "4.1",
                title: "Intervenções em combate",
                body: "Usar um item ou lançar uma Poké Bola não consome o turno do Pokémon, mas o Treinador pode fazer apenas uma intervenção por rodada."
            },
            {
                id: "4.2",
                title: "Capturas",
                body: "Role 1d100 contra a chance dinâmica da fórmula dos jogos, considerando a Poké Bola, o HP restante e as condições do alvo."
            },
            {
                id: "4.3",
                title: "PP e Cura",
                bullets: [
                    "Os PP originais são mantidos por toda a sessão ou capítulo e só são restaurados ao fim do período mais longo.",
                    "Curar HP, restaurar PP ou acessar o PC exige um lugar seguro na narrativa, como um Centro Pokémon ou refúgio equivalente."
                ]
            },
            {
                id: "4.4",
                title: "Recursos e dinheiro",
                body: "Pokédólares e itens aparecem naturalmente ao longo da jornada. O inventário é leve e acompanha a aventura sem interromper seu ritmo."
            }
        ]
    },
    {
        id: "filosofia",
        number: 5,
        title: "Espírito da aventura",
        summary: "A matemática serve à aventura, não o contrário.",
        rules: [
            {
                id: "5.1",
                title: "A regra de ouro",
                body: "A precisão dos jogos com o coração das grandes aventuras Pokémon. Preserve a intenção das regras, a fluidez da cena e o espírito da franquia. Use o terreno, improvisos, defesas criativas e combinações inesperadas; quando surgir uma dúvida, escolha o caminho que mantém a aventura em movimento."
            }
        ]
    }
];

const defaultRandom = () => {
    if (globalThis.crypto?.getRandomValues) {
        const value = new Uint32Array(1);
        globalThis.crypto.getRandomValues(value);
        return value[0] / 4294967296;
    }
    return Math.random();
};

const die = (sides, random = defaultRandom) => Math.floor(random() * sides) + 1;

export const rollAttributeTest = ({
    mode = "normal",
    attribute = 0,
    opposition = null,
    random = defaultRandom
} = {}) => {
    const dice = Array.from({ length: mode === "normal" ? 2 : 3 }, () => die(6, random));
    const ordered = [...dice].sort((a, b) => a - b);
    const kept = mode === "advantage" ? ordered.slice(-2) : mode === "disadvantage" ? ordered.slice(0, 2) : dice;
    const diceTotal = kept.reduce((sum, value) => sum + value, 0);
    const total = diceTotal + (Number(attribute) || 0);
    const target = opposition === "" || opposition == null ? null : Number(opposition);
    return {
        dice,
        kept,
        diceTotal,
        total,
        critical: kept.every(value => value === 6),
        fumble: kept.every(value => value === 1),
        success: Number.isFinite(target) ? total > target : null,
        margin: Number.isFinite(target) ? total - target : null
    };
};

export const rollPercentTest = ({
    chance = 100,
    advantage = false,
    random = defaultRandom
} = {}) => {
    const rolls = Array.from({ length: advantage ? 2 : 1 }, () => die(100, random));
    const result = Math.min(...rolls);
    const normalizedChance = Math.min(100, Math.max(0, Number(chance) || 0));
    return { rolls, result, chance: normalizedChance, success: result <= normalizedChance };
};

export const getRpgScale = (value, isHp = false) => convertToTTRPG(value, isHp);

export const getNextLevelXp = level => Math.max(1, (Math.max(1, Number(level) || 1) + 1) / 2);

export const getDamageCeiling = level => Math.max(1, (Math.max(1, Number(level) || 1)) / 2);
