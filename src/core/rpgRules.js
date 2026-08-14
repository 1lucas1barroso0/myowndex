import { convertToTTRPG } from "./mechanics.js";

export const FUMBLE_SUGGESTIONS = Object.freeze([
    "Perder uma posição favorável ou ficar exposto até a próxima ação.",
    "Atingir o cenário e criar uma complicação que mude a cena.",
    "Gastar um recurso adicional, como PP, item ou tempo, quando isso fizer sentido.",
    "Dar ao oponente uma oportunidade imediata, sem retirar a decisão do Narrador.",
]);

export const getFumbleSuggestion = (random = Math.random) =>
    FUMBLE_SUGGESTIONS[Math.floor(random() * FUMBLE_SUGGESTIONS.length)] || FUMBLE_SUGGESTIONS[0];

export const EXPERIENCE_MODES = {
    rpg: {
        id: "rpg",
        label: "RPG",
        shortLabel: "RPG",
        description: "Regras dos jogos adaptadas à mesa, com espaço para soluções criativas.",
        isTTRPG: true,
        isFreeform: false,
        color: "violet"
    },
    game: {
        id: "game",
        label: "Como nos jogos",
        shortLabel: "Jogos",
        description: "Atributos originais e sugestões compatíveis com o jogo escolhido.",
        isTTRPG: false,
        isFreeform: false,
        color: "blue"
    },
    free: {
        id: "free",
        label: "Criação livre",
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
        title: "Rolagens e testes",
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
                    "Acertos críticos superam o limite de dano por nível e a proteção contra hit kill.",
                    "Erro crítico: obtenha 1 e 1 nos dados mantidos; o MyOwnDex sugere uma consequência, e Narrador e jogadores escolhem a que respeita melhor a cena.",
                    ...FUMBLE_SUGGESTIONS,
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
        title: "Cálculos da aventura",
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
                body: "Ataque, Defesa, Ataque Especial, Defesa Especial e Velocidade usam estágios de −6 a +6 sobre o valor original; só depois o resultado é dividido por 20. Precisão e Evasão também usam estágios de −6 a +6 e ajustam a chance percentual do movimento."
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
                body: "Movimentos que ignoram precisão e evasão nos jogos não exigem rolagem. Uma precisão numérica — inclusive 100% — continua sujeita aos estágios de Precisão e Evasão; role 1d100 e obtenha um valor igual ou menor que a chance ajustada. Em um ataque, margem superior a 1 na disputa concede o segundo d100 previsto na regra 1.4."
            },
            {
                id: "3.3",
                title: "Resolução de movimentos",
                body: "Só movimentos que causam dano fazem a disputa de atributos: Físicos testam Ataque contra Defesa; Especiais testam Ataque Especial contra Defesa Especial. Movimentos de status dirigidos a outro Pokémon usam precisão e imunidades, mas não inventam uma disputa de dano. Ações sobre o usuário ou o campo, como Recuperar e Dança de Espadas, resolvem-se pela declaração.",
                bullets: [
                    "Para causar dano, o atacante precisa superar o defensor. Um empate ou resultado menor impede o dano, mas não apaga efeitos secundários se o movimento alcançou o alvo.",
                    "O alvo original do movimento determina quem recebe cura, condição e modificadores; efeitos sobre o usuário não são transferidos ao adversário.",
                    "O dano final combina dano base, STAB e modificadores de tipo.",
                    "Um golpe não causa mais que metade do nível do atacante; no nível 1, vale o mínimo de 1 de dano. Aumentos temporários elevam esse limite proporcionalmente."
                ]
            },
            {
                id: "3.4",
                title: "Proteção contra hit kill",
                bullets: [
                    "Se um único movimento ofensivo fosse derrubar um alvo que estava com HP positivo, o dano precisa alcançar pelo menos três vezes o HP atual desse alvo.",
                    "Abaixo desse valor, o dano é registrado normalmente, mas o alvo permanece com 1 HP.",
                    "Acertos críticos e movimentos que declaram nocaute direto ignoram essa proteção.",
                    "Movimentos de múltiplos acertos somam todos os golpes como um único movimento para essa comparação. Dano residual, clima, terreno e condições são resolvidos separadamente.",
                    "Substitutos e efeitos especiais recebem primeiro o tratamento próprio; a proteção só é verificada no dano que realmente alcança o Pokémon.",
                ]
            },
            {
                id: "3.5",
                title: "Regras herdadas dos jogos",
                body: "Tipos, STAB, imunidades, condições, golpes de múltiplos acertos, recuo, drenagem e outras regras mantêm sua intenção original, adaptadas apenas à escala e à narrativa."
            },
            {
                id: "3.6",
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
                body: "Usar um item ou lançar uma Poké Ball não consome o turno do Pokémon, mas o Treinador pode fazer apenas uma intervenção por rodada."
            },
            {
                id: "4.2",
                title: "Capturas",
                body: "Role 1d100 contra a chance dinâmica da fórmula dos jogos, considerando a Poké Ball escolhida, o HP restante e as condições do alvo."
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
        id: "criacao",
        number: 5,
        title: "Fichas e criação",
        summary: "Do conceito do Treinador aos dados completos de cada parceiro.",
        rules: [
            {
                id: "5.1",
                title: "Começando um Treinador",
                body: "Defina nome, aparência, objetivo, origem, vínculos e o tipo de jornada que deseja viver. Esses elementos orientam escolhas e testes; não obrigam o personagem a seguir um caminho único."
            },
            {
                id: "5.2",
                title: "Criando um Pokémon",
                bullets: [
                    "Escolha espécie e forma, nível, natureza, habilidade, gênero, tipos, IVs, EVs, item, até quatro movimentos e os detalhes da jornada.",
                    "O PC calcula os atributos e a escala do RPG. Campos livres servem a criações próprias sem alterar os identificadores usados na Pokédex e nos códigos de compartilhamento.",
                    "HP atual, condição, XP e PP formam o progresso vivo da ficha e acompanham o Pokémon quando ele entra em cena."
                ]
            },
            {
                id: "5.3",
                title: "Movimentos e repertório",
                body: "Cada Pokémon mantém até quatro movimentos ativos. Categoria, tipo, poder, precisão, PP, prioridade e efeitos vêm da versão consultada; uma criação livre pode substituir esses valores quando o grupo registrar claramente a exceção."
            },
            {
                id: "5.4",
                title: "Progressão e evolução",
                bullets: [
                    "Ao completar a XP exigida, avance um nível, recalcule os atributos dependentes e volte a contagem de XP para zero.",
                    "Evoluções por nível, item, amizade, troca, local, horário ou outra condição mantêm a intenção dos jogos. A cena pode transformar a condição em um momento narrativo equivalente.",
                    "Uma evolução nunca apaga apelido, vínculo, histórico, PP, condição ou escolhas já registradas."
                ]
            }
        ]
    },
    {
        id: "condicoes",
        number: 6,
        title: "Condições, cura e efeitos",
        summary: "Como registrar consequências sem misturar dano direto e efeitos contínuos.",
        rules: [
            {
                id: "6.1",
                title: "Condições principais",
                body: "Queimadura, congelamento, paralisia, envenenamento, envenenamento grave e sono mantêm a intenção dos jogos. Marque uma condição por vez na ficha; imunidades, habilidades e efeitos que a removem continuam valendo."
            },
            {
                id: "6.2",
                title: "Dano contínuo e indireto",
                body: "Condições, clima, terreno, armadilhas, recuo e outros danos indiretos são resolvidos separadamente do movimento ofensivo. Eles não ativam a proteção contra hit kill. Ao encerrar a rodada, o MyOwnDex aplica queimadura, envenenamento, envenenamento grave e tempestade de areia; também avança Bocejo, Future Sight, Doom Desire, Wish, Leech Seed, Aqua Ring, Ingrain e Perish Song, registrando cada mudança no Diário."
            },
            {
                id: "6.3",
                title: "Cura e recuperação",
                body: "A cura respeita o efeito original e nunca ultrapassa o HP máximo. Drenagem usa o dano realmente aplicado; recuo, restauração de PP e remoção de condições são registrados separadamente para que o resultado permaneça consultável."
            },
            {
                id: "6.4",
                title: "Empoderamentos e enfraquecimentos",
                body: "Os sete modificadores — Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, Precisão e Evasão — usam estágios de −6 a +6. Os cinco atributos numéricos são recalculados a partir do original antes da divisão por 20; Precisão e Evasão ajustam o d100. Habilidades como Unaware ignoram exatamente os estágios determinados por sua descrição."
            }
        ]
    },
    {
        id: "recursos-pokemon",
        number: 7,
        title: "Habilidades, itens e formas",
        summary: "Elementos canônicos preservados com liberdade para exceções registradas.",
        rules: [
            {
                id: "7.1",
                title: "Habilidades",
                body: "Cada habilidade tem gatilho, estado e histórico. Entrada em campo, clima, terreno, precisão, dano, contato, nocaute, imunidade e fim de rodada são aplicados na ordem correta quando o contexto é objetivo; isso inclui famílias como Intimidate, Download, habilidades de clima e terreno, Sturdy, Adaptability, Technician, absorções, reações de contato, recuperação e alterações de Velocidade. Imposter e Illusion preservam suas regras próprias. Quando alvo, troca, ordem, escolha ou interpretação ainda estiverem abertos, o painel mantém a descrição oficial visível e marca a resolução como guiada em vez de inventar uma resposta."
            },
            {
                id: "7.2",
                title: "Itens",
                body: "Itens segurados possuem estado próprio na cena: ativo, consumido, removido, trocado ou restaurado. Frutas, itens de escolha, Life Orb, Leftovers, Focus Sash, Weakness Policy, Air Balloon, sementes de terreno, orbes, itens de precisão e modificadores de dano integram o mesmo cálculo e deixam uma trilha narrativa. Trick, Switcheroo, Knock Off, Thief, Covet, Fling, Recycle, Bug Bite, Pluck e Incinerate atualizam esse estado. A ficha da Box conserva o equipamento de origem; mudanças da batalha permanecem na cena até o Narrador editar a ficha ou restaurar o item, evitando que um efeito temporário reescreva a coleção por acidente."
            },
            {
                id: "7.3",
                title: "Formas e transformações",
                body: "Formas regionais, Mega Evolution, Dynamax, Gigantamax, Terastalização e outras mecânicas alteram apenas o que suas regras determinam. Transform copia aparência, tipos atuais, habilidade, atributos não relacionados a HP, modificadores e movimentos do alvo com 5 PP, mas preserva HP, nível, item e progresso do usuário; tudo pode ser revertido sem alterar sua ficha original. Mudanças como Stance Change, Schooling, Shields Down, Zero to Hero, Hunger Switch, Gulp Missile, Zen Mode, Power Construct e Forecast mostram o gatilho, o que muda, o que permanece e se o MyOwnDex já possui contexto para aplicar o efeito."
            },
            {
                id: "7.4",
                title: "Movimentos que copiam ou chamam outros",
                body: "Sketch troca permanentemente o próprio espaço pelo último movimento observado que seja válido, e a ficha vinculada também recebe a mudança. Mimic cria uma cópia temporária com 5 PP e restaura o movimento e o PP anteriores quando a cena termina ou o Narrador desfaz a cópia. Metronome, Copycat, Assist, Sleep Talk, Nature Power, Mirror Move, Me First e Instruct pedem o movimento resultante e consomem PP apenas da escolha original."
            },
            {
                id: "7.5",
                title: "Tipos, STAB e Terastalização",
                body: "A defesa usa os tipos atuais do alvo. O STAB é 1,5× quando o movimento corresponde a um tipo original ou ao Tera Type; se corresponder aos dois, torna-se 2×. Adaptability ajusta esses valores quando está ativa. Imunidade reduz o dano a zero. Sol, chuva e terrenos modificam os tipos pertinentes e aparecem como parcelas separadas no resultado."
            },
            {
                id: "7.6",
                title: "Ordem de resolução conectada",
                body: "Verifique restrições do usuário, alvo, precisão e imunidades; resolva a disputa; aplique poder situacional, STAB, tipo, clima, terreno, habilidade e item; depois trate sobrevivência, dano, efeitos secundários, contato, consumo, cura, nocaute e histórico. Shield Dust, Covert Cloak e Sheer Force só alteram efeitos secundários, sem apagar efeitos principais ou custos próprios."
            }
        ]
    },
    {
        id: "mesa",
        number: 8,
        title: "Condução da aventura",
        summary: "Papéis, decisões manuais, transparência e exceções.",
        rules: [
            {
                id: "8.1",
                title: "Narrador e jogadores",
                body: "O Narrador conduz a cena, confirma consequências, aplica mudanças coletivas e resolve exceções. Cada Jogador apresenta sua equipe, declara ações e controla seus próprios Pokémon; todos consultam o mesmo estado da aventura."
            },
            {
                id: "8.2",
                title: "Ajuda sem tirar a liberdade",
                body: "O MyOwnDex aplica sozinho apenas o que possui resposta objetiva e mostra cada parcela do cálculo. Escolhas criativas, consequências de erro crítico e exceções narrativas continuam com o grupo; registre a decisão para que ela permaneça consistente."
            },
            {
                id: "8.3",
                title: "Como resolver uma exceção",
                bullets: [
                    "Primeiro, confira a descrição do movimento, habilidade, item ou forma.",
                    "Depois, aplique imunidades, alterações de atributo, precisão, disputa, dano, limites e consequências uma única vez e nessa ordem.",
                    "Se ainda houver dúvida, escolha a solução que preserva a intenção da regra, a clareza para todos e o movimento da aventura."
                ]
            },
            {
                id: "8.4",
                title: "A regra de ouro",
                body: "A precisão dos jogos com o coração das grandes aventuras Pokémon. Use terreno, improvisos, defesas criativas e combinações inesperadas. A matemática sustenta a aventura; ela não limita a imaginação do grupo."
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
