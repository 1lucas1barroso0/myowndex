import { convertToTTRPG } from "./mechanics.js";
import { finiteNumberOrNull, integerInRange } from "./math.js";
import { randomChoice, roll2D6, rollD6, rollD100 } from "./random.js";

export const FUMBLE_SUGGESTIONS = Object.freeze([
    "Perder uma posição favorável ou ficar exposto até a próxima ação.",
    "Atingir o cenário e criar uma complicação que mude a cena.",
    "Gastar um recurso adicional, como PP, item ou tempo, quando isso fizer sentido.",
    "Dar ao oponente uma oportunidade imediata, sem retirar a decisão do Narrador.",
]);

export const getFumbleSuggestion = random =>
    randomChoice(FUMBLE_SUGGESTIONS, random) || FUMBLE_SUGGESTIONS[0];

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
                    "Dois 6 nos dados mantidos indicam um crítico potencial. Ele só se torna um acerto crítico se o ataque superar a defesa e alcançar o alvo; não transforma empate, erro ou imunidade em sucesso.",
                    "Acertos críticos superam o limite de dano por nível e a proteção contra hit kill.",
                    "Erro crítico: obtenha 1 e 1 nos dados mantidos; o MyOwnDex sugere uma consequência, e Narrador e jogadores escolhem a que respeita melhor a cena.",
                    "Quando o defensor obtém um erro crítico em uma disputa vencida pelo atacante, o dano também pode atravessar a proteção contra hit kill.",
                    ...FUMBLE_SUGGESTIONS,
                ]
            },
            {
                id: "1.4",
                title: "Probabilidades e efeitos secundários",
                body: "Para uma chance percentual, role 1d100: o teste tem sucesso quando o resultado é igual ou menor que a chance. Com vantagem, role dois d100 independentes e mantenha o menor; com desvantagem, mantenha o maior. Se o teste do movimento superar a oposição por mais de 1, ele concede a vantagem prevista aqui. Um movimento nunca concede mais de dois d100."
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
                body: "Ataque, Defesa, Ataque Especial, Defesa Especial e Velocidade usam estágios de −6 a +6 sobre o valor original; só depois o resultado é dividido por 20. Precisão e Evasão também usam estágios de −6 a +6. Dentro dos pisos e limites da regra, um estágio válido sempre altera o valor final na direção correta."
            },
            {
                id: "2.4",
                title: "Zeros e limites mínimos",
                body: "Um atributo pode chegar a 0; nesse caso, role apenas os dados. HP máximo nunca fica abaixo de 1. Depois de combinar força, modificadores e multiplicadores, um dano real positivo causa ao menos 1 HP; imunidade, bloqueio e efeitos que anulam o dano continuam causando 0. O piso impede que um golpe desapareça, sem substituir a proporção nem o limite da fórmula."
            },
            {
                id: "2.5",
                title: "Experiência e evolução",
                bullets: [
                    "Para alcançar o próximo nível, acumule XP igual à metade desse novo nível. A contagem volta a zero depois do avanço.",
                    "Por desafio resolvido, cada participante recebe 1 XP em um desafio comum, 2 XP em um desafio importante ou 3 XP em uma grande conquista. A categoria é definida pelo Narrador conforme risco e impacto, não pelo número de ataques ou nocautes.",
                    "Vitória, captura, negociação, resgate e descoberta podem resolver o mesmo desafio: conceda a recompensa uma única vez. Ações triviais, repetidas ou sem risco não geram XP.",
                    "A divisão padrão é igual entre os participantes. Uma divisão proporcional diferente deve ser combinada antes da recompensa; todo Pokémon que entrou em campo recebe pelo menos 1 XP. Meio ponto de XP é válido."
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
                body: "No início de cada rodada, declare os movimentos e depois teste Velocidade com 2d6. Resolva primeiro a prioridade do movimento e depois o total de Velocidade. Empatados rolam 1d6; somente quem continuar empatado repete até definir a ordem. Nenhum identificador interno decide a vez."
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
                    "O dano final combina a força original, STAB, tipo e demais multiplicadores antes de arredondar uma única vez.",
                    "O limite comum por hit é um número inteiro: metade do nível do atacante, arredondada para baixo; no nível 1, vale 1. Aumentos temporários elevam esse limite proporcionalmente."
                ]
            },
            {
                id: "3.4",
                title: "Proteção contra hit kill",
                bullets: [
                    "A proteção só pode agir quando uma instância real de dano derrubaria um alvo que estava com o HP máximo. Se o dano for menor que três vezes o HP máximo, o alvo permanece com 1 HP.",
                    "Cada Pokémon recebe essa proteção uma única vez por batalha. Depois de ativada, trocar o Pokémon, curá-lo ou levá-lo novamente ao HP máximo não restaura o uso; qualquer dano fatal posterior pode derrotá-lo normalmente.",
                    "Somente dano realmente causado conta. Erro, imunidade, bloqueio, tentativa falha ou impacto absorvido por Substitute não ativam, gastam nem removem a proteção.",
                    "Dano recebido abaixo do HP máximo não ativa a proteção. Dano não fatal também não consome o uso; se o Pokémon voltar ao HP máximo sem ter usado ou perdido a proteção, ela continua disponível.",
                    "Quando o próprio Pokémon paga HP, sofre recuo ou reduz o próprio HP por movimento, habilidade ou item, perde a proteção geral até o fim daquela batalha. Cura, troca e retorno ao campo não revertem essa perda.",
                    "Ao entrar em uma nova fase de Batalha, o MyOwnDex limpa automaticamente o registro da batalha anterior. Durante a batalha, o uso acompanha o próprio Pokémon mesmo que ele saia e volte à cena.",
                    "Acertos críticos do atacante, erros críticos do defensor e movimentos que declaram nocaute direto ignoram essa proteção geral.",
                    "Sturdy, Focus Sash e efeitos equivalentes são proteções próprias e adicionais. Quando a proteção geral age primeiro, ela não ativa nem consome esses efeitos; o MyOwnDex preserva a elegibilidade que eles possuíam antes do golpe.",
                    "Essa elegibilidade preservada vale até o próximo dano que realmente alcançar o Pokémon. Nesse dano, um efeito apto pode manter 1 HP; aplicado ou não, qualquer dano posterior encerra a preservação. Cura, troca e retorno à cena não recriam a proteção geral já consumida.",
                    "Se o primeiro dano deixar 1 HP ou mais naturalmente, a proteção geral não age e não preserva uma chance adicional para Sturdy, Focus Sash ou efeitos equivalentes.",
                    "Movimentos de múltiplos acertos são resolvidos hit por hit. Um hit pode consumir a proteção geral, o próximo pode acionar uma proteção própria ainda elegível e outro pode derrotar normalmente.",
                    "Dano residual, clima, terreno, condições e outras fontes indiretas são resolvidos uma a uma. Uma fonte que cause dano pode ativar ou romper a proteção geral; efeitos próprios como Sturdy e Focus Sash só agem quando suas próprias regras permitirem.",
                    "Substitutos e efeitos especiais recebem primeiro o tratamento próprio; a proteção só é verificada no dano que realmente alcança o Pokémon.",
                ]
            },
            {
                id: "3.5",
                title: "Regras herdadas dos jogos",
                body: "Tipos, STAB, imunidades, condições, recuo e drenagem mantêm sua intenção original, com as adaptações explícitas deste Guia. Para os movimentos comuns de 2 a 5 acertos, o RPG usa a distribuição moderna: 35% para 2, 35% para 3, 15% para 4 e 15% para 5. Skill Link garante o máximo; Loaded Dice dá 4 ou 5 com chances iguais nesses movimentos. Contagens fixas e movimentos de regra própria não são convertidos nessa tabela. O jogo de referência escolhe o repertório; não muda silenciosamente as regras do RPG."
            },
            {
                id: "3.6",
                title: "Posicionamento e espaço",
                body: "O jogo não exige um tabuleiro quadriculado. As distâncias são narrativas: Perto, Longe e Muito Longe. Área, alcance, cenário e Velocidade são interpretados conforme a cena. Na Central da Aventura, uma equipe entra com o Pokémon escolhido e mantém os demais no banco; a troca preserva HP, condição, PP, itens consumidos e o histórico da proteção contra hit kill."
            },
            {
                id: "3.7",
                title: "Ações, trocas e reações",
                bullets: [
                    "Cada Pokémon ativo tem uma ação principal por rodada: usar um movimento, realizar um improviso importante ou ceder sua ação para uma troca voluntária. O Pokémon que entra pela troca não recebe uma ação extra nessa rodada; a reposição após nocaute não gasta a ação da rodada seguinte.",
                    "Movimentar-se dentro da mesma faixa de distância acompanha a ação quando a cena permite. Cruzar uma faixa sob oposição ou obter uma posição decisiva pode exigir a ação principal e um teste; Velocidade, terreno e alcance fundamentam a decisão, sem metragem obrigatória.",
                    "Reações precisam de uma permissão de movimento, habilidade, item ou situação. A rolagem defensiva normal já integra a disputa: não é uma ação extra e não é cobrada duas vezes.",
                    "O Narrador controla a economia de ações e registra exceções no Diário. Movimentos que concedem outra ação, trocam o usuário ou alteram a ordem mantêm suas próprias permissões."
                ]
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
                body: "O Narrador confirma que o alvo é selvagem, está consciente e pode ser capturado. Uma tentativa gasta a intervenção do Treinador e a Poké Ball, mesmo se falhar; nunca ocupa a ação do Pokémon. O assistente usa uma adaptação explícita para d100, não uma reprodução de todas as fórmulas de cada geração.",
                bullets: [
                    "Chance = 100 × taxa da espécie ÷ 255 × (3 × HP máximo − 2 × HP atual) ÷ (3 × HP máximo) × bônus da Ball × bônus da condição. Arredonde para baixo, entre 1% e 100% para uma taxa positiva. Taxa 0 não permite captura comum.",
                    "Poké Ball, Premier Ball, Luxury Ball e Heal Ball: ×1; Great Ball: ×1,5; Ultra Ball: ×2. Sono ou congelamento: ×2,5; queimadura, paralisia ou veneno: ×1,5. Master Ball dispensa a chance, mas não permite capturar Pokémon de outro Treinador.",
                    "A taxa vem da Pokédex; HP e condição vêm da cena. O d100 deve ser igual ou menor que a chance. Captura não recebe a vantagem da disputa de ataque.",
                    "Balls e modificadores especiais não listados são resolvidos pelo Narrador com sua descrição e registrados como exceção, nunca tratados silenciosamente como uma Poké Ball comum. Uma captura confirmada fica no Diário; registre o novo parceiro no PC e ajuste o inventário."
                ]
            },
            {
                id: "4.3",
                title: "PP e Cura",
                bullets: [
                    "HP, PP e condições persistem entre cenas e sessões. Encerrar uma sessão ou capítulo não restaura recursos automaticamente.",
                    "Descanso seguro, Centro Pokémon ou refúgio equivalente permitem a recuperação definida pelo Narrador e o acesso ao PC. Movimentos, habilidades e itens de cura continuam funcionando durante a aventura ou batalha conforme suas regras e custos; não exigem um Centro Pokémon."
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
                body: "Marque apenas uma condição principal. O RPG usa as referências modernas abaixo, respeitando imunidades, habilidades e cura. A verificação ocorre uma vez antes da ação, não uma vez por alvo nem por hit. Se a condição impedir a ação, o turno é gasto, mas não há gasto de PP.",
                bullets: [
                    "Queimadura: metade do dano físico, salvo Guts ou Facade; perde 1/16 do HP máximo ao fim da rodada, respeitando o piso de dano positivo.",
                    "Paralisia: metade da Velocidade, salvo Quick Feet; antes de agir, 25% de chance de perder a ação. A condição não se cura sozinha.",
                    "Sono: dura de 1 a 3 oportunidades de agir, sorteadas uma vez. Depois disso, acorda antes da próxima ação. Trocar preserva a contagem. Early Bird reduz a duração; Snore e Sleep Talk mantêm a permissão de agir dormindo.",
                    "Congelamento: antes da ação, 20% de chance de descongelar e agir. Movimentos que descongelam o próprio usuário dispensam esse teste. Dano de Fogo e movimentos com efeito próprio de descongelar também removem a condição.",
                    "Veneno: perde 1/8 do HP máximo ao fim da rodada. Envenenamento grave: começa em 1/16 e aumenta em 1/16 por rodada, até 15/16; trocar reinicia o contador, não cura a condição.",
                    "Confusão e hesitação são efeitos voláteis, separados da condição principal. Confusão afeta de 1 a 4 oportunidades de agir (Axe Kick: 2 a 4); em cada uma, há 33% de chance de perder a ação e causar a si mesmo 2 HP de dano, a adaptação do poder 40 ÷20 do RPG, sem STAB, tipo, crítico ou disputa. Hesitação impede apenas a próxima ação da mesma rodada, se o alvo ainda não agiu. Trocar encerra ambas."
                ]
            },
            {
                id: "6.2",
                title: "Dano contínuo e indireto",
                body: "Condições, clima, terreno, armadilhas, recuo e outros danos indiretos são resolvidos separadamente e fonte por fonte. Dano positivo pode ativar ou romper a proteção contra hit kill; custo próprio de HP a torna indisponível naquele combate. Ao encerrar a rodada, o MyOwnDex aplica queimadura, envenenamento, envenenamento grave e tempestade de areia; também avança Bocejo, Future Sight, Doom Desire, Wish, Leech Seed, Aqua Ring, Ingrain e Perish Song, registrando cada mudança no Diário."
            },
            {
                id: "6.3",
                title: "Cura e recuperação",
                body: "A cura respeita o efeito original e nunca ultrapassa o HP máximo. Drenagem usa o dano realmente aplicado. Quando uma regra exige custo de HP, recuo, drenagem ou perda residual positiva, a fórmula é resolvida primeiro e remove ao menos 1 HP; imunidade, bloqueio ou ausência real de efeito continuam em 0. Cada consequência fica registrada separadamente."
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
                body: "Verifique restrições, condições do usuário e alvo. Nos movimentos de dano, resolva a disputa para conhecer a margem; depois role a precisão com a vantagem cabível e aplique imunidades. Combine poder, STAB, tipo, clima, terreno, habilidade e item; trate sobrevivência, dano, efeitos secundários, contato, consumo, cura, nocaute e histórico. Um crítico potencial só se aplica se houver acerto. Shield Dust, Covert Cloak e Sheer Force só alteram efeitos secundários, sem apagar efeitos principais ou custos próprios."
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
                    "Depois, siga a ordem da regra 7.6: restrições e condições, alvo, disputa quando houver, precisão, imunidades, dano, limites e consequências, uma única vez.",
                    "Se ainda houver dúvida, escolha a solução que preserva a intenção da regra, a clareza para todos e o movimento da aventura."
                ]
            },
            {
                id: "8.4",
                title: "A regra de ouro",
                body: "A precisão dos jogos com o coração das grandes aventuras Pokémon. Use terreno, improvisos, defesas criativas e combinações inesperadas. A matemática sustenta a aventura; ela não limita a imaginação do grupo."
            },
            {
                id: "8.5",
                title: "Testes do Treinador",
                body: "Só role diante de incerteza e risco relevantes. Declare intenção, oposição e consequências antes dos dados. O Treinador rola 2d6, sem inventar atributos de Pokémon para si; especialidade coerente com sua origem, preparação ou ajuda útil pode conceder vantagem, e um obstáculo relevante pode conceder desvantagem. Várias fontes não empilham dados; vantagem e desvantagem simultâneas se anulam. Contra dificuldade fixa, o total também precisa superá-la. Use 5 para um teste favorável, 7 para exigente e 9 para muito difícil como referências, ajustadas antes da rolagem. Ações impossíveis pedem outra abordagem; ações triviais não pedem dados."
            }
        ]
    }
];

export const rollAttributeTest = ({
    mode = "normal",
    attribute = 0,
    opposition = null,
    random
} = {}) => {
    const normalizedMode = ["normal", "advantage", "disadvantage"].includes(mode) ? mode : "normal";
    const dice = normalizedMode === "normal"
        ? roll2D6(random).dice
        : [rollD6(random), rollD6(random), rollD6(random)];
    const ordered = [...dice].sort((a, b) => a - b);
    const kept = normalizedMode === "advantage" ? ordered.slice(-2) : normalizedMode === "disadvantage" ? ordered.slice(0, 2) : dice;
    const diceTotal = kept.reduce((sum, value) => sum + value, 0);
    const normalizedAttribute = integerInRange(attribute, -99999, 99999, 0);
    const total = diceTotal + normalizedAttribute;
    const parsedTarget = opposition === "" || opposition == null ? null : finiteNumberOrNull(opposition);
    const target = parsedTarget == null ? null : integerInRange(parsedTarget, -99999, 99999, 0);
    return {
        mode: normalizedMode,
        dice,
        kept,
        diceTotal,
        attribute: normalizedAttribute,
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
    disadvantage = false,
    mode,
    random
} = {}) => {
    const normalizedMode = ["normal", "advantage", "disadvantage"].includes(mode)
        ? mode
        : advantage === true
            ? "advantage"
            : disadvantage === true
                ? "disadvantage"
                : "normal";
    const rolls = normalizedMode === "normal" ? [rollD100(random)] : [rollD100(random), rollD100(random)];
    const result = normalizedMode === "advantage" ? Math.min(...rolls) : Math.max(...rolls);
    const normalizedChance = integerInRange(chance, 0, 100, 0);
    return {
        rolls,
        result,
        chance: normalizedChance,
        mode: normalizedMode,
        advantage: normalizedMode === "advantage",
        disadvantage: normalizedMode === "disadvantage",
        success: result <= normalizedChance,
    };
};

export const getRpgScale = (value, isHp = false) => convertToTTRPG(value, isHp);

export const getNextLevelXp = level => (integerInRange(level, 1, 200, 1) + 1) / 2;

export const getDamageCeiling = level => Math.max(1, Math.floor(integerInRange(level, 1, 200, 1) / 2));
