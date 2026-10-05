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
                body: "Role dois dados de seis lados: isso é 2d6. Em uma disputa entre Pokémon, escolha quem age e quem responde. O MyOwnDex rola os dois lados e usa os atributos, nível, IVs, EVs, natureza, estágios, condições, habilidades e itens de cada um. Aventura e Dados seguem a mesma regra.\n\nQuem age precisa superar quem se defende. Empate favorece a defesa. O jogo faz as contas proporcionais: você acompanha o resultado sem precisar multiplicar números grandes."
            },
            {
                id: "1.2",
                title: "Vantagem e desvantagem",
                body: "Uma boa preparação pode ajudar; um obstáculo pode atrapalhar. Combine isso antes de rolar.",
                bullets: [
                    "Vantagem: role 3d6 e mantenha os dois maiores.",
                    "Desvantagem: role 3d6 e mantenha os dois menores.",
                    "Use apenas um modo. Duas vantagens não dão mais dados. Se houver vantagem e desvantagem juntas, use Normal.",
                ]
            },
            {
                id: "1.3",
                title: "Acertos e erros críticos",
                body: "Dois resultados iguais podem dar um momento especial à cena.",
                bullets: [
                    "Dois 6 nos dados mantidos podem virar um acerto crítico. Primeiro, o ataque precisa vencer a defesa e alcançar o alvo. Empate, erro ou imunidade não viram sucesso só por causa dos dados.",
                    "Um acerto crítico multiplica o dano por 1,5× e pode passar do limite comum. A proteção contra hit kill ainda funciona quando seus requisitos são atendidos.",
                    "Dois 1 nos dados mantidos são um erro crítico. O jogo sugere uma complicação; o grupo escolhe algo que faça sentido na cena.",
                    "Um erro crítico da defesa pode trazer outra complicação, mas não remove sozinho a proteção contra hit kill.",
                    ...FUMBLE_SUGGESTIONS,
                ]
            },
            {
                id: "1.4",
                title: "Probabilidades e efeitos secundários",
                body: "Para uma chance inteira em porcentagem, role 1d100. Resultado igual ou menor que a chance é sucesso. Com vantagem, o jogo tenta duas vezes e fica com o melhor resultado; com desvantagem, fica com o pior. Chances exatas que o d100 não consegue representar são sorteadas sem aproximação.\n\nEm um ataque, vencer a disputa e somar pelo menos 2 a mais nos dados mantidos do que a defesa ativa Vantagem para a precisão e para efeitos secundários quando a regra pedir outra chance. Compare os dados, não o total dos atributos. O jogo verifica isso para você."
            }
        ]
    },
    {
        id: "matematica",
        number: 2,
        title: "Cálculos da aventura",
        summary: "Atributos, escala por 10, estágios, XP e valores mínimos.",
        rules: [
            {
                id: "2.1",
                title: "Construção dos atributos",
                body: "Cada Pokémon tem suas próprias forças. Nível, IVs, EVs e natureza ajudam a definir seus atributos, como nos jogos. O MyOwnDex calcula esses valores; o Narrador também pode usar uma ficha já pronta."
            },
            {
                id: "2.2",
                title: "Divisão por 10",
                body: "Para caber no RPG, os atributos e o poder-base dos movimentos usam a escala dividida por 10. O resultado fica no inteiro mais próximo. Se parar exatamente em 0,5, atributos e poder descem; HP sobe. Por exemplo: 55 vira 5 como atributo e 6 como HP.\n\nEfeitos sobre uma parte do HP, como veneno ou Leftovers, seguem seu próprio arredondamento. Amizade vai de 0 a 255 na ficha original: divida por 10 e sempre arredonde para baixo. No RPG, o máximo é 25."
            },
            {
                id: "2.3",
                title: "Estágios de atributos",
                body: "Um movimento pode fortalecer ou enfraquecer um atributo em estágios, de −6 a +6. O jogo ajusta o valor original antes de dividi-lo por 10. Precisão e Evasão também usam estágios. Respeitados os pisos e limites, cada mudança válida faz diferença na direção certa."
            },
            {
                id: "2.4",
                title: "Zeros e limites mínimos",
                body: "Um atributo pode ser 0: nesse caso, só os dados participam do teste. HP máximo é sempre pelo menos 1. Um efeito que realmente causa dano tira pelo menos 1 HP depois das contas; erro, imunidade, bloqueio e efeito anulado continuam em 0. Esse mínimo não dá permissão para ignorar uma proteção."
            },
            {
                id: "2.5",
                title: "Experiência e evolução",
                body: "XP mostra o que o Pokémon aprendeu ao superar um desafio.",
                bullets: [
                    "Para chegar ao próximo nível, a meta é metade do novo nível, arredondada para baixo. Do nível 10 para o 11, são 5 XP. A contagem volta a zero depois de subir.",
                    "O Narrador escolhe a recompensa-base: 1 XP para um desafio comum, 2 para um importante e 3 para uma grande conquista. Fora de batalha, ela fica de 1 a 3. Repetir algo trivial ou sem risco não cria outro desafio.",
                    "Na vitória em batalha, dobre a recompensa se ao menos um adversário tiver o dobro ou mais do maior nível do lado vencedor. Dobre também se o lado adversário tiver o dobro ou mais de Pokémon participantes. As duas condições juntas dão ×4. Compare os níveis de entrada na batalha e conte quem participou, incluindo quem saiu ou foi derrotado; quem ficou só no banco não conta.",
                    "Se essas condições estiverem do lado vencedor, cada uma tira 1 da base e não dá multiplicador. Em casos mistos, tire primeiro, multiplique depois e mantenha no mínimo 1 XP ao final. Exemplo: base 3, vencedor com vantagem de nível e adversários em dobro dão (3 − 1) ×2 = 4 XP.",
                    "Vencer, capturar, negociar, resgatar ou descobrir podem resolver o mesmo desafio. Recompense esse desafio uma vez, não uma vez por botão, golpe ou resultado.",
                    "A XP recebida já é inteira. Se o grupo usar uma recompensa coletiva, a divisão padrão é igual, com resultado arredondado para baixo; combine outra divisão antes de conceder. Cada Pokémon que participou recebe pelo menos 1 XP em um desafio recompensado. Editar a XP atual corrige a ficha: não concede outra recompensa.",
                    "Cada aquisição de XP entrega o dobro em EVs. Receber 3 XP, por exemplo, dá 6 EVs para distribuir: até 252 por atributo e 510 no total. A mesma recompensa registrada não entrega XP nem EVs duas vezes.",
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
                body: "Antes de Rolar iniciativa, cada Pokémon escolhe um movimento ou Outra ação. Pode mudar a escolha até a rolagem. Declarar só prepara: não usa PP nem executa o movimento.",
                bullets: [
                    "Prioridade maior age primeiro: Protect (+4), Quick Attack (+1), Tackle (0). Valores negativos vêm depois de 0. Outra ação usa 0. Prioridade não aumenta a Velocidade nem dá outra ação.",
                    "Entre escolhas de mesma prioridade, o jogo rola 2d6 e usa a Velocidade atual, com seus modificadores. Se houver empate real, rola 1d6 só entre os empatados, repetindo até decidir.",
                    "Habilidades ativas também contam: Prankster dá +1 a movimentos de status; Gale Wings dá +1 a Flying com HP cheio; Triage dá +3 aos movimentos de cura que sua regra permite. A prioridade aparece antes de rolar.",
                    "Depois de rolar, a escolha e a ordem ficam firmes. Mudar a seleção não permite agir antes ou refazer a iniciativa. Mudanças de Velocidade entram na próxima rodada; efeitos que mudam a ordem de propósito seguem suas próprias regras.",
                    "Próximo turno passa a vez. Depois do último, Encerrar rodada aplica os efeitos finais e libera novas escolhas. Escolha de novo e role a iniciativa da próxima rodada.",
                ]
            },
            {
                id: "3.2",
                title: "Precisão",
                body: "A precisão responde: o movimento alcançou o alvo? Se a regra do movimento dispensa esse teste, não há rolagem. Se há uma chance numérica, até 100% pode mudar com Precisão e Evasão. No d100, igual ou menor que a chance ajustada é acerto.\n\nAo vencer a disputa com pelo menos 2 a mais na soma dos dados mantidos, o ataque ganha a segunda tentativa da regra 1.4."
            },
            {
                id: "3.3",
                title: "Resolução de movimentos",
                body: "Movimentos Físicos disputam Ataque contra Defesa. Especiais usam Ataque Especial contra Defesa Especial. Movimentos de status não fazem uma disputa de dano inventada: usam seus alvos, precisão, imunidades e efeitos próprios.\n\nRecover e Swords Dance agem sobre o usuário; não sobre o adversário. Eles também esperam sua vez e precisam ser resolvidos. Declarar ainda não aplica o efeito.",
                bullets: [
                    "O atacante precisa superar a defesa para causar dano. Empate ou resultado menor impedem o dano. Se o movimento alcançou o alvo, seus efeitos secundários ainda podem funcionar.",
                    "Cada efeito vai para o alvo que sua regra determina: usuário, Pokémon escolhido, grupo ou campo.",
                    "O jogo combina poder, STAB, tipos e demais multiplicadores antes de arredondar o dano final uma vez.",
                    "O limite comum de dano por hit é o nível do atacante. No nível 10, o limite-base é 10. Superefetividade e estágios positivos do atributo ofensivo elevam esse teto proporcionalmente; críticos e movimentos de regra própria usam suas exceções. Resistência reduz o dano, mas não aumenta o teto.",
                ]
            },
            {
                id: "3.4",
                title: "Proteção contra hit kill",
                bullets: [
                    "Com HP cheio e proteção disponível, um golpe que zeraria o HP pode deixar o Pokémon com 1 HP. O dano precisa ser menor que três vezes o HP máximo.",
                    "Essa chance vale uma vez por Pokémon em cada batalha. Depois de usada, curar, trocar ou voltar ao campo não a devolve. Outro dano que zere o HP pode derrotá-lo.",
                    "Só conta o dano que chega ao Pokémon. Erro, imunidade, bloqueio, tentativa falha e dano absorvido por Substitute não gastam nem removem a proteção.",
                    "Se o HP já estava abaixo do máximo, a proteção não age. Um dano que não derrube o Pokémon também não gasta a chance. Se ele recuperar o HP cheio sem ter usado ou perdido a proteção, pode usá-la depois.",
                    "Pagar HP, sofrer recuo ou tirar o próprio HP com um movimento, habilidade ou item encerra essa proteção até o fim da batalha. Cura e troca não desfazem essa perda.",
                    "Mudar de fase não começa outra batalha, mesmo entre rodadas. Só Nova batalha, confirmada pelo Narrador e sem rodada em curso, renova a proteção geral. O jogo não recupera HP, PP ou itens por causa disso. Sair e voltar à cena durante o mesmo combate conserva o uso anterior.",
                    "Um movimento de nocaute direto passa pela proteção geral. Um crítico ou erro crítico não passa só por ser crítico: o dano precisa chegar a três vezes o HP máximo ou mais.",
                    "Shedinja e outras espécies ou formas com HP máximo 1 por regra própria não recebem a proteção geral. Sturdy, Focus Sash e semelhantes são chances separadas. Quando a proteção geral age primeiro, ela não gasta essas chances e guarda a condição que permitia usá-las antes do golpe.",
                    "Essa chance extra guardada dura até o próximo dano que alcançar o Pokémon. Nesse dano, a habilidade ou o item pode deixá-lo com 1 HP, se sua própria regra permitir. O próximo dano encerra essa reserva, tenha ela sido usada ou não. Cura e troca não recriam a proteção geral.",
                    "Se o dano já deixaria pelo menos 1 HP sem ajuda, a proteção geral não age e não guarda uma chance extra de Sturdy ou Focus Sash.",
                    "Em um movimento de vários acertos, conte cada hit. Um pode gastar a proteção geral; outro pode ativar uma habilidade ou item ainda apto; um seguinte pode derrotar o Pokémon.",
                    "Condição, clima, terreno e outros danos indiretos também são contados um a um. A proteção geral pode agir quando os requisitos forem atendidos. Sturdy, Focus Sash e semelhantes só funcionam nos tipos de dano que suas próprias regras permitem.",
                    "Resolva Substitute e outros efeitos especiais primeiro. Só depois verifique o dano que alcança o próprio Pokémon.",
                ]
            },
            {
                id: "3.5",
                title: "Regras herdadas dos jogos",
                body: "Os jogos Pokémon são a base. Tipos, STAB, imunidades, condições, recuo e drenagem seguem suas regras, com as adaptações deste Guia.\n\nNos movimentos comuns de 2 a 5 acertos, o RPG usa 35% para 2, 35% para 3, 15% para 4 e 15% para 5. Skill Link garante o máximo; Loaded Dice dá 4 ou 5 com chances iguais. Contagens fixas e movimentos especiais seguem sua própria regra. Escolher um jogo para o repertório não muda silenciosamente as regras do RPG."
            },
            {
                id: "3.6",
                title: "Posicionamento e espaço",
                body: "Imagine a cena: Perto, Longe ou Muito Longe. Não é preciso contar quadradinhos. Alcance, obstáculos, área e Velocidade ajudam o grupo a decidir o que é possível.\n\nArrastar um sprite apenas organiza o campo: não dá movimento grátis, alcance maior ou outra ação. A equipe entra com o Pokémon escolhido; os outros ficam no banco. Trocar preserva HP, PP, condições, itens gastos e a proteção já usada ou perdida."
            },
            {
                id: "3.7",
                title: "Ações, trocas e reações",
                body: "Cada Pokémon tem sua vez, e a mesma ação não pode ser usada duas vezes.",
                bullets: [
                    "Cada Pokémon ativo tem uma ação principal por rodada: usar um movimento, fazer um improviso importante ou cedê-la para trocar. Em batalha, espere aparecer Agora e ainda não ter gasto sua ação. Prioridade só define a vez. O Campo dos Dados começa como Treino livre; Rolar iniciativa inicia a batalha. Encerrar a rodada não devolve o treino nem libera ataques antes da próxima iniciativa.",
                    "Uma tentativa válida gasta a ação mesmo se uma condição impedir o movimento, ele errar ou seu efeito for bloqueado. Se uma condição impede a ação, não se gasta PP. Uma escolha inválida, como um movimento sem PP, pode ser corrigida antes da tentativa e não gasta a ação.",
                    "Para trocar por vontade própria, declare Outra ação antes da iniciativa. A troca usa a ação do Pokémon que sai. Quem entra ocupa esse lugar e não ganha outra ação na rodada. Substituir um Pokémon derrotado não gasta a ação da rodada seguinte. Os recursos de cada Pokémon continuam com ele.",
                    "Mover-se dentro da mesma faixa pode acompanhar a ação. Cruzar uma faixa sob oposição ou conquistar uma posição decisiva pode exigir a ação e um teste. Combine alcance, terreno e Velocidade antes de rolar.",
                    "Uma reação precisa ser permitida por movimento, habilidade, item ou situação. A defesa normal já faz parte da disputa: não é cobrada como outra ação.",
                    "Outra ação guarda uma vez de prioridade 0 para trocar, improvisar ou escolher um movimento de prioridade 0. Não permite escolher uma prioridade maior depois da rolagem. Resolva e avance. Efeitos que dão outra ação ou mudam a ordem precisam de uma permissão própria; o Narrador registra a exceção no Histórico da aventura.",
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
                body: "O Treinador também pode ajudar! Usar um item ou lançar uma Poké Ball não toma a ação do Pokémon. Em batalha, porém, cada Treinador tem apenas uma dessas intervenções por rodada, não uma por Pokémon. Uma tentativa que gasta o recurso também gasta a intervenção, mesmo se falhar."
            },
            {
                id: "4.2",
                title: "Capturas",
                body: "Só capture um Pokémon selvagem, consciente e permitido na cena. Uma tentativa gasta a Poké Ball e a intervenção do Treinador em batalha, mesmo se falhar; não gasta a ação do Pokémon. O jogo calcula a chance adaptada do RPG.",
                bullets: [
                    "Chance = 100 × taxa da espécie ÷ 255 × (3 × HP máximo − 2 × HP atual) ÷ (3 × HP máximo) × bônus da Ball × bônus da condição. O jogo arredonda para baixo e mantém de 1% a 100% quando a taxa é positiva. Taxa 0 não permite captura comum.",
                    "Poké Ball, Premier Ball, Luxury Ball e Heal Ball: ×1; Great Ball: ×1,5; Ultra Ball: ×2. Sono ou congelamento: ×2,5; queimadura, paralisia ou veneno: ×1,5. Master Ball dispensa o teste, mas não permite capturar o Pokémon de outro Treinador.",
                    "No d100, igual ou menor que a chance é captura. A taxa vem da Pokédex; HP e condição vêm da cena. A vantagem de um ataque não passa para a captura.",
                    "Uma Ball especial mantém sua própria descrição e bônus: não é tratada silenciosamente como uma Poké Ball comum. O Narrador registra uma exceção quando necessário. Depois da captura, registre o Pokémon no PC e ajuste o inventário; o Histórico da aventura guarda o resultado.",
                ]
            },
            {
                id: "4.3",
                title: "PP e Cura",
                bullets: [
                    "HP, PP e condições acompanham a jornada. Terminar uma cena, sessão ou capítulo não os recupera sozinho.",
                    "Descanso seguro, Centro Pokémon ou outro refúgio permitem os cuidados combinados com o Narrador e acesso ao PC. Movimentos, habilidades e itens de cura também funcionam durante a aventura e a batalha, com seus efeitos e custos próprios. Não é preciso esperar um Centro Pokémon para usar uma cura permitida.",
                ]
            },
            {
                id: "4.4",
                title: "Recursos e dinheiro",
                body: "Guarde os itens e Pokédólares que ganhar e retire o que gastar. Um recurso consumido não pode ser usado de novo sem ser recuperado por uma regra que permita isso. O inventário acompanha a jornada; uma correção do Narrador serve para acertar o registro, não para criar recompensas repetidas."
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
                body: "Quem é seu Treinador? Escolha nome, aparência, origem, objetivo e pessoas importantes para ele. Essas ideias ajudam a decidir suas escolhas e especialidades. Seu personagem pode descobrir novos caminhos durante a aventura."
            },
            {
                id: "5.2",
                title: "Criando um Pokémon",
                body: "Monte a ficha ou use o Gerador para começar.",
                bullets: [
                    "Escolha espécie e forma, nível, natureza, habilidade, gênero, tipos, IVs, EVs e até quatro movimentos. Em Jogos, use as opções daquela edição. No RPG, o jogo escolhido define os movimentos; atributos, tipos e habilidades seguem a referência atual. Livre permite criar exceções de propósito.",
                    "Anote o que acompanha o Pokémon: item, Poké Ball, Treinador original, amizade e notas da jornada.",
                    "O MyOwnDex calcula os atributos. Se o grupo combinar um valor personalizado, registre essa escolha claramente. Uma transformação de batalha não deve apagar a ficha de origem.",
                ]
            },
            {
                id: "5.3",
                title: "Movimentos e repertório",
                body: "Um Pokémon leva até quatro movimentos para a batalha. Ao aprender outro, escolha o que sai; trocar o repertório não dá uma ação nem recupera PP no meio do combate.\n\nConsulte o repertório do jogo escolhido. O mais recente disponível é o padrão; jogos anteriores continuam acessíveis. O movimento conserva seu nome original, alvos, precisão, PP, tipo e efeitos. Exceções combinadas ficam registradas."
            },
            {
                id: "5.4",
                title: "Progressão e evolução",
                bullets: [
                    "Ao completar a meta de XP, suba um nível, atualize os atributos e zere a contagem. Uma aquisição sobe no máximo um nível; a sobra não passa para outro. Os EVs consideram toda a XP recebida. Subir de nível não revive um Pokémon com HP 0.",
                    "Evoluir pode depender de nível, item, amizade, troca, lugar, horário ou outra condição. Preserve a ideia dos jogos; o grupo pode transformá-la em um momento equivalente da história.",
                    "Evoluir não apaga apelido, vínculo, histórico, PP, condição ou escolhas registradas.",
                    "Amizade muda pela decisão do Narrador, conforme Pokémon, Treinador e contexto. Ao fim da sessão, ele avalia se algo deve mudar; normalmente ajusta 5 para uma mudança pequena ou 50 para uma mudança grande, para mais ou para menos. XP, nível e fim de sessão não mudam amizade automaticamente.",
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
                body: "Uma condição principal por vez. O jogo verifica seu efeito antes da ação, uma vez por tentativa — não uma vez por alvo ou hit. Se impedir a ação, a vez é usada, mas não se gasta PP. Estas são as durações e chances adotadas pelo RPG.",
                bullets: [
                    "Queimadura: metade do dano físico, salvo Guts ou Facade; perde 6,25% do HP máximo no fim da rodada, com mínimo 1 quando houver dano.",
                    "Paralisia: metade da Velocidade, salvo Quick Feet; antes de agir, há 1 em 8 de chance de perder a ação. Não se cura sozinha.",
                    "Sono: impede 1 ou 2 oportunidades de agir. Há 1 em 3 de chance de acordar antes da segunda; se não acordar, desperta antes da terceira. Trocar guarda a contagem. Rest tem sua duração própria; Early Bird reduz a duração; Snore e Sleep Talk permitem agir dormindo.",
                    "Congelamento: antes de agir, há 25% de chance de descongelar. Se não acontecer nas duas primeiras oportunidades, descongela antes da terceira. Um movimento que descongela o usuário dispensa o teste. Dano de Fire e efeitos próprios de descongelar também removem a condição.",
                    "Veneno: perde 12,5% do HP máximo ao fim da rodada. Envenenamento grave: começa em 6,25% e aumenta 6,25% por rodada, até 93,75%. Trocar reinicia esse aumento; não cura o veneno.",
                ]
            },
            {
                id: "6.2",
                title: "Dano contínuo e indireto",
                body: "Conte cada fonte de dano separadamente: condição, clima, terreno, armadilha, recuo e outras. A parte do HP usada por cada efeito segue sua regra original de arredondamento. Se o efeito causa dano, tira no mínimo 1 HP; imunidade ou efeito anulado tira 0.\n\nEncerrar rodada resolve queimadura, veneno, envenenamento grave e tempestade de areia. Também avança Yawn, Future Sight, Doom Desire, Wish, Leech Seed, Aqua Ring, Ingrain e Perish Song. O Histórico da aventura mostra as mudanças. Dano real pode acionar a proteção contra hit kill; tirar o próprio HP a encerra naquela batalha."
            },
            {
                id: "6.3",
                title: "Cura e recuperação",
                body: "Curar nunca passa do HP máximo. Drenar recupera HP a partir do dano realmente causado, não do dano que ficou bloqueado.\n\nCusto de HP, recuo e dano residual positivo tiram pelo menos 1 HP depois de aplicar sua fórmula. Uma drenagem positiva recupera HP conforme sua própria regra; não cobra esse HP de novo do usuário. Imunidade, bloqueio ou ausência de efeito continuam em 0. O jogo registra cada consequência separadamente."
            },
            {
                id: "6.4",
                title: "Empoderamentos e enfraquecimentos",
                body: "Fortalecer ou enfraquecer usa estágios de −6 a +6 em Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, Precisão e Evasão. O jogo recalcula os atributos a partir do original antes da escala por 10. Precisão e Evasão mudam a chance de acerto. Unaware e outras habilidades ignoram somente os estágios que sua descrição determina."
            },
            {
                id: "6.5",
                title: "Efeitos voláteis",
                body: "Confusão e hesitação são efeitos voláteis: separados da condição principal e podem existir junto dela.",
                bullets: [
                    "Confusão: Dura de 2 a 5 oportunidades próprias; antes da última, o Pokémon se recupera. Enquanto estiver ativa, há 1 em 3 de chance de perder a ação e atingir a si mesmo com um ataque físico sem tipo de poder 40. Usa seu próprio Ataque, Defesa, nível e estágios, sem STAB, efetividade, crítico ou disputa adicional. Esse dano encerra a proteção geral contra hit kill; Sturdy, Focus Sash e outras proteções só agem quando suas próprias regras permitem. Trocar encerra a confusão.",
                    "Hesitação: impede apenas a próxima ação da mesma rodada, se o alvo ainda não agiu. Trocar encerra o efeito.",
                ]
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
                body: "Uma habilidade pode agir ao entrar em campo, receber contato, causar dano, mudar o clima ou chegar ao fim da rodada. Ela precisa estar ativa e cumprir seu gatilho; não basta estar escrita na ficha.\n\nIntimidate, Download, habilidades de clima e terreno, Sturdy, Adaptability, Technician, absorções, recuperação e mudanças de Velocidade entram nos cálculos. Imposter e Illusion mantêm suas regras próprias. O painel explica o efeito e deixa a descrição oficial disponível. Quando a habilidade oferece uma escolha de alvo, troca ou ordem, quem joga faz essa escolha."
            },
            {
                id: "7.2",
                title: "Itens",
                body: "Um item pode estar ativo, consumido, removido, trocado ou restaurado. Se já foi consumido ou removido, não funciona de novo sem uma regra que o recupere.\n\nBerries, itens de escolha, Life Orb, Leftovers, Focus Sash, Weakness Policy, Air Balloon, sementes, orbes e modificadores entram no mesmo cálculo. Trick, Switcheroo, Knock Off, Thief, Covet, Fling, Recycle, Bug Bite, Pluck e Incinerate atualizam esse estado.\n\nA Box guarda qual era o equipamento de origem. Ao registrar o progresso, um item original consumido continua consumido: encerrar a cena não o repõe. Trocas temporárias não reescrevem esse equipamento; o consumo acompanha a origem do item. Uma regra como Recycle ou uma reposição registrada pode devolvê-lo."
            },
            {
                id: "7.3",
                title: "Formas e transformações",
                body: "Formas regionais, Mega Evolution, Dynamax, Gigantamax e Terastallization mudam somente o que sua regra permite. Transformar não dá outra ação nem recupera recursos por conta própria.\n\nTransform copia aparência, tipos atuais, habilidade, atributos que não são HP, estágios e movimentos com 5 PP. Mantém HP, nível, item e progresso do usuário. Reverter não apaga sua ficha original.\n\nStance Change, Schooling, Shields Down, Zero to Hero, Hunger Switch, Gulp Missile, Zen Mode, Power Construct e Forecast têm gatilhos próprios. O painel mostra o que muda e o que permanece."
            },
            {
                id: "7.4",
                title: "Movimentos que copiam ou chamam outros",
                body: "Sketch aprende permanentemente o último movimento observado que seja válido, no lugar de Sketch, inclusive na ficha vinculada. Mimic copia temporariamente com 5 PP; ao desfazer a cópia ou encerrar a cena, restaura o movimento e PP anteriores.\n\nMetronome, Copycat, Assist, Sleep Talk, Nature Power, Mirror Move, Me First e Instruct pedem o movimento que será chamado. Só a escolha original gasta PP. O movimento chamado usa essa mesma ação e vez: sua prioridade não cria outro turno nem refaz a iniciativa."
            },
            {
                id: "7.5",
                title: "Tipos, STAB e Terastallization",
                body: "Tipos mostram a efetividade do movimento contra o alvo: imune causa 0; uma resistência aplica 50%; duas resistências, 25%; neutro vale ×1; superefetivo contra um tipo vale ×2; superefetivo contra os dois tipos vale ×4. Uma fraqueza e uma resistência juntas dão ×1. Use os tipos atuais do alvo. Uma imunidade continua em 0, salvo um efeito que a remova.\n\nSTAB é o bônus de usar um movimento do próprio tipo: normalmente 1,5×. Com Terastallization ativa, vale para um tipo original ou o Tera Type; se corresponder aos dois, é 2×. Adaptability ajusta esse bônus quando ativa. Sol, chuva e terrenos têm seus próprios efeitos, mostrados separadamente no resultado."
            },
            {
                id: "7.6",
                title: "Ordem de resolução conectada",
                body: "Escolha o movimento e seu alvo; o jogo resolve uma vez, em ordem: permissões e condições, disputa quando houver, precisão e imunidades, cálculo e proteções, dano, efeitos secundários, contato, custos, cura e nocaute. O Histórico da aventura guarda o resultado.\n\nAlvo, troca ou movimento chamado continuam sendo escolhas quando a própria regra permite. Um crítico só vale depois de acertar. Shield Dust, Covert Cloak e Sheer Force mexem nos efeitos secundários, não apagam efeitos principais nem custos do usuário."
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
                body: "O Narrador apresenta o mundo, acompanha a cena e ajuda a resolver dúvidas. Cada Jogador escolhe as ações e cuida dos seus Pokémon. Todos veem o mesmo estado da aventura. O Narrador confirma mudanças coletivas e registra exceções para ninguém jogar com uma regra diferente sem saber."
            },
            {
                id: "8.2",
                title: "Ajuda sem tirar a liberdade",
                body: "O jogo faz as contas e resolve o que tem resposta definida. Você continua escolhendo o que seu personagem tenta fazer. Ideias criativas e consequências da história ficam com o grupo. Combine antes de rolar e registre uma exceção no Histórico da aventura para aplicá-la do mesmo jeito depois."
            },
            {
                id: "8.3",
                title: "Como resolver uma exceção",
                body: "Quando duas explicações parecem diferentes, siga esta ordem:",
                bullets: [
                    "Primeiro, use a adaptação explícita deste Guia para o modo RPG. Ela vale para todos os lados e não muda ao escolher um jogo antigo no catálogo.",
                    "Onde o Guia não adapta a mecânica, use a regra oficial mais recente e corrigida disponível. Uma correção posterior vale mais que uma descrição antiga. Escolher uma referência histórica não troca as regras do RPG sem avisar o grupo.",
                    "Tiers, banlists, cláusulas e regras de torneio não entram automaticamente no RPG. Aqui, a base é a mecânica Pokémon com aventura e narrativa, sem restrições competitivas importadas em silêncio.",
                    "Resolva cada ação uma vez, na ordem da regra 7.6. Uma exceção não devolve PP, HP, item ou turno sem dizer claramente que devolve.",
                    "Se a dúvida continuar, o Narrador combina uma solução clara antes da rolagem e a registra. A decisão vale igualmente para aliados e oponentes na mesma situação; não muda depois de ver os dados.",
                ]
            },
            {
                id: "8.4",
                title: "A regra de ouro",
                body: "Jogue uma aventura Pokémon: explore, imagine, cuide e descubra. Use o cenário, defesas criativas e combinações inesperadas. Combine o que a ideia tenta fazer antes de rolar. Criatividade abre caminhos; não dá recursos ou ações extras sem uma regra ou exceção combinada. As mesmas escolhas e limites valem para todos."
            },
            {
                id: "8.5",
                title: "Testes do Treinador",
                body: "Só role quando houver uma dúvida importante e algo em jogo. Diga o que quer fazer, o que atrapalha e o que pode acontecer. Um Treinador usa 2d6; não recebe atributos inventados de Pokémon.\n\nUma especialidade da sua história, boa preparação ou ajuda útil pode dar vantagem. Um obstáculo importante pode dar desvantagem. Várias ajudas não acrescentam dados; vantagem e desvantagem juntas usam Normal.\n\nComo referência de dificuldade, use 5 para favorável, 7 para exigente e 9 para muito difícil. O total precisa superar a dificuldade: empate não basta. O jogo calcula e mostra o resultado. Uma ação tranquila não pede dados; uma impossível pede outro plano."
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

export const rollProportionalAttributeTest = ({
    mode = "normal",
    attribute = 1,
    random,
} = {}) => {
    const base = rollAttributeTest({ mode, attribute: 0, random });
    const normalizedAttribute = integerInRange(attribute, 1, 99999, 1);
    const score = base.diceTotal * normalizedAttribute;
    return {
        ...base,
        attribute: normalizedAttribute,
        total: score,
        score,
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
        : advantage === true && disadvantage === true
            ? "normal"
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

export const getNextLevelXp = level => Math.floor((integerInRange(level, 1, 200, 1) + 1) / 2);

export const getDamageCeiling = level => Math.max(1, integerInRange(level, 1, 200, 1));
