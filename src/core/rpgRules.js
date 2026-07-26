import { convertToTTRPG } from "./mechanics.js";

export const TRAINER_GUIDE_URL = "https://guia-do-treinador-pokemon.vercel.app/";

export const EXPERIENCE_MODES = {
    rpg: {
        id: "rpg",
        label: "RPG Anime",
        shortLabel: "RPG",
        description: "Matemática do VGC, escala de mesa e liberdade narrativa.",
        isTTRPG: true,
        isFreeform: false,
        color: "amber"
    },
    game: {
        id: "game",
        label: "Videogame",
        shortLabel: "Game",
        description: "Números originais e sugestões legais do jogo selecionado.",
        isTTRPG: false,
        isFreeform: false,
        color: "blue"
    },
    free: {
        id: "free",
        label: "Modo Livre",
        shortLabel: "Livre",
        description: "Todos os golpes, habilidades, tipos e atributos personalizados.",
        isTTRPG: true,
        isFreeform: true,
        color: "purple"
    }
};

export const RPG_RULE_SECTIONS = [
    {
        id: "rolagens",
        number: 1,
        title: "Sistema de Rolagens",
        summary: "2d6, vantagem, críticos e probabilidades.",
        rules: [
            {
                id: "1.1",
                title: "Testes Básicos",
                body: "Role 2d6 e some o atributo correspondente do Pokémon. Em disputas, o alvo passivo ou defensivo vence empates."
            },
            {
                id: "1.2",
                title: "Vantagem e Desvantagem",
                body: "A cena, o clima e o ambiente podem alterar os dados do teste.",
                bullets: [
                    "Vantagem: role 3d6 e mantenha os dois maiores.",
                    "Desvantagem: role 3d6 e mantenha os dois menores."
                ]
            },
            {
                id: "1.3",
                title: "Acertos e Erros Críticos",
                bullets: [
                    "Acerto crítico: 6 e 6 nos dados mantidos; funciona como um crítico do VGC.",
                    "Erro crítico: 1 e 1 nos dados mantidos; produz uma consequência narrativa ou mecânica catastrófica."
                ]
            },
            {
                id: "1.4",
                title: "Probabilidades e Efeitos Secundários",
                body: "Para chances percentuais, role 1d100 e obtenha um valor igual ou menor que a chance. Se o teste de Movimento superar a oposição por mais de 1, role o d100 duas vezes e mantenha o resultado mais favorável. Nunca há mais de dois d100 por Movimento."
            }
        ]
    },
    {
        id: "matematica",
        number: 2,
        title: "Matemática do Sistema",
        summary: "Atributos, divisão por 20, estágios, XP e mínimos.",
        rules: [
            {
                id: "2.1",
                title: "Construção dos Atributos",
                body: "IVs, EVs, Naturezas e nível funcionam normalmente. O Narrador pode entregar os atributos já calculados para preservar o ritmo da aventura."
            },
            {
                id: "2.2",
                title: "Divisão por 20",
                body: "Atributos, Dano Base dos Movimentos e Amizade são divididos por 20. Decimais de 0,55 ou menores descem; decimais de 0,56 ou maiores sobem."
            },
            {
                id: "2.3",
                title: "Estágios de Atributos",
                body: "Buffs e debuffs seguem o VGC e são aplicados ao valor original. Somente depois da alteração o resultado é dividido por 20."
            },
            {
                id: "2.4",
                title: "Zeros e Limites Mínimos",
                body: "Um atributo pode chegar a 0; nesse caso, role apenas os dados. HP máximo nunca fica abaixo de 1. Ataques causam ao menos 1 de dano, salvo imunidade ou redução final para 0,55 ou menos."
            },
            {
                id: "2.5",
                title: "Experiência e Evolução",
                bullets: [
                    "Para subir de nível, acumule XP igual à metade do nível desejado; a contagem zera ao subir.",
                    "Em batalhas com vários aliados, divida a XP proporcionalmente; todo Pokémon que entrou em campo recebe ao menos 1."
                ]
            }
        ]
    },
    {
        id: "combate",
        number: 3,
        title: "Combate e Movimentos",
        summary: "Iniciativa, precisão, dano, VGC e espaço narrativo.",
        rules: [
            {
                id: "3.1",
                title: "Ordem de Turnos",
                body: "A cada rodada, todos testam Velocidade. Prioridade age antes; empates de iniciativa usam uma rolagem rápida de desempate."
            },
            {
                id: "3.2",
                title: "Precisão",
                body: "Movimentos que não checam precisão/evasão no VGC não rolam. Se o ataque não for interrompido, acerta. Os demais exigem o teste de precisão apropriado."
            },
            {
                id: "3.3",
                title: "Resolução de Dano",
                body: "Físicos testam Ataque contra Defesa; Especiais testam Ataque Especial contra Defesa Especial.",
                bullets: [
                    "O atacante precisa superar o defensor. Empate ou resultado menor não causa dano, embora efeitos secundários ainda possam ocorrer.",
                    "Dano final combina Dano Base, STAB e modificadores de tipagem.",
                    "Um golpe não causa mais que metade do nível do atacante; buffs temporários elevam esse teto proporcionalmente."
                ]
            },
            {
                id: "3.4",
                title: "Mecânicas Herdadas do VGC",
                body: "Tipagem, STAB, imunidades, condições, multihit, recuo, drenagem e outras mecânicas preservam sua intenção original, adaptadas apenas à escala e à narrativa."
            },
            {
                id: "3.5",
                title: "Posicionamento e Espaço",
                body: "Não há grid. As distâncias são narrativas: Perto, Longe e Muito Longe. Área, alcance, cenário e Velocidade são interpretados conforme a cena."
            }
        ]
    },
    {
        id: "treinador",
        number: 4,
        title: "Treinador e Logística",
        summary: "Intervenções, captura, PP, cura e recursos.",
        rules: [
            {
                id: "4.1",
                title: "Intervenções em Combate",
                body: "Usar um item ou lançar uma Pokébola não consome o turno do Pokémon, mas o treinador só realiza uma intervenção por rodada."
            },
            {
                id: "4.2",
                title: "Capturas",
                body: "Role 1d100 contra a chance dinâmica da fórmula dos jogos, considerando Pokébola, HP restante e condições do alvo."
            },
            {
                id: "4.3",
                title: "PP e Cura",
                bullets: [
                    "Os PP originais são mantidos e valem para toda a sessão ou capítulo, o que durar mais.",
                    "Curar HP, restaurar PP ou acessar o PC exige segurança narrativa, como um Centro Pokémon ou refúgio equivalente."
                ]
            },
            {
                id: "4.4",
                title: "Recursos e Dinheiro",
                body: "Pokédólares e itens surgem organicamente. O inventário é informal e nunca deve travar o ritmo da aventura."
            }
        ]
    },
    {
        id: "filosofia",
        number: 5,
        title: "Filosofia do Jogo",
        summary: "A matemática serve à aventura, não o contrário.",
        rules: [
            {
                id: "5.1",
                title: "A Regra de Ouro",
                body: "A Matemática do VGC com o Coração do Anime. Preserve simultaneamente a intenção mecânica original, a fluidez da cena e o espírito dramático do anime. Use terreno, improvisos, defesas criativas e combinações inesperadas; quando houver dúvida, faça a aventura continuar."
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

export const getDamageCeiling = level => Math.max(0.5, (Math.max(1, Number(level) || 1)) / 2);
