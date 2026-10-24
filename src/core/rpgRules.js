import { convertToTTRPG } from "./mechanics.js";
import { finiteNumberOrNull, integerInRange } from "./math.js";
import { randomChoice, roll2D6, rollD6, rollD100 } from "./random.js";

export const FUMBLE_SUGGESTIONS = Object.freeze([
    "Seu Pokémon pode perder uma boa posição ou ficar exposto até a próxima ação.",
    "O movimento pode atingir o cenário e criar um novo problema.",
    "A tentativa pode custar mais PP, um item ou tempo, se isso fizer sentido.",
    "O oponente pode ganhar uma oportunidade. O Narrador decide como ela acontece.",
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
        "id": "rolagens",
        "number": 1,
        "title": "Dados e testes",
        "summary": "Quando rolar, como usar vantagem e o que os dados mostram.",
        "rules": [
            {
                "id": "1.1",
                "title": "Vamos rolar os dados",
                "plain": "Conte o que seu Pokémon quer fazer. Se houver uma disputa, os dados ajudam a descobrir o que acontece.",
                "body": "2d6 quer dizer dois dados de seis lados. Role os dois e some os resultados. Numa disputa entre Pokémon, cada lado multiplica essa soma pelo atributo original usado no teste, com os ajustes que estiverem valendo. O MyOwnDex faz essa conta.\n\nPara conseguir o que tentou, quem age precisa superar a defesa. Se empatar, a defesa vence. O aplicativo considera atributos, nível, IVs, EVs, natureza, estágios, condições, habilidades e itens. A regra é a mesma na Aventura e nos Dados.",
                "example": "Pikachu corre atrás de um Pidgey que está fugindo pela trilha. O Narrador pede uma disputa de Velocidade. Você acompanha os dados na tela: se Pikachu vencer, alcança Pidgey; se empatar, Pidgey continua à frente.",
                "collapsibleDetails": true,
                "context": "Na disputa, o MyOwnDex considera a Velocidade atual e os ajustes dos dois Pokémon. Use Dados para conferir a rolagem; empate não basta para quem tenta alcançar.",
                "steps": [
                    "Na perseguição, escolha Pikachu como quem tenta alcançar e Pidgey como quem tenta escapar. Use Velocidade para os dois.",
                    "Abra a disputa de Pokémon nos Dados. O aplicativo usa as fichas dos dois e mostra o vencedor.",
                    "Pikachu só alcança Pidgey se vencer a disputa. No empate, quem estava tentando impedir a ação leva a melhor. A Aventura e o Campo usam essa mesma regra."
                ],
                "auditCase": "race"
            },
            {
                "id": "1.2",
                "title": "Vantagem e desvantagem",
                "plain": "Uma boa preparação pode ajudar na rolagem. Um obstáculo pode deixá-la mais difícil.",
                "body": "O Narrador combina se há vantagem ou desvantagem antes de rolar.",
                "bullets": [
                    "Vantagem: role três dados de seis lados e some os dois maiores.",
                    "Desvantagem: role três dados de seis lados e some os dois menores.",
                    "Normal: role apenas dois dados. Use este modo se houver vantagem e desvantagem juntas.",
                    "Várias vantagens não dão mais dados. O mesmo vale para várias desvantagens."
                ],
                "example": "Seu Treinador quer seguir as pegadas de Eevee antes que a chuva as apague. O mapa que ele preparou pode ajudar. O Narrador combina a vantagem antes da tentativa, e o aplicativo cuida da rolagem. Se também houver um obstáculo que dê desvantagem, uma anula a outra.",
                "context": "O Narrador decide antes da rolagem se o mapa dá vantagem. Se a chuva também trouxer desvantagem, as duas se anulam. Várias ajudas iguais não dão dados extras.",
                "steps": [
                    "Antes da busca por Eevee, o Narrador decide se a preparação do Treinador ajuda e se há algum obstáculo importante.",
                    "Escolha Vantagem quando a ajuda valer: o aplicativo rola um dado extra e fica com os melhores. Desvantagem faz o contrário.",
                    "Se houver ajuda e obstáculo que deem esses dois modos ao mesmo tempo, escolha Normal. Juntar várias ajudas não acrescenta dados sem parar."
                ]
            },
            {
                "id": "1.3",
                "title": "Acertos e erros críticos",
                "plain": "Um acerto pode ficar mais forte, e um erro importante pode complicar a cena. Veja primeiro o que o Pokémon estava tentando fazer.",
                "body": "Olhe os dois dados que ficaram no teste, mesmo quando você rolou três.",
                "bullets": [
                    "Dois 6: o ataque pode ser crítico, mas primeiro precisa vencer a defesa e acertar o alvo. Um empate, erro ou imunidade não vira acerto por causa dos dados.",
                    "Dano crítico: multiplique o dano por 3 e divida por 2. Ele pode passar do limite comum, mas ainda respeita a proteção contra hit kill.",
                    "Dois 1: o Narrador e o grupo escolhem uma complicação que combine com a cena. Um erro crítico na defesa também pode complicar a situação; ele não retira a proteção contra hit kill sozinho.",
                    "Seu Pokémon pode perder uma boa posição ou ficar exposto até a próxima ação.",
                    "O movimento pode atingir o cenário e criar um novo problema.",
                    "A tentativa pode custar mais PP, um item ou tempo, se isso fizer sentido.",
                    "O oponente pode ganhar uma oportunidade. O Narrador decide como ela acontece."
                ],
                "example": "Bulbasaur usa Vine Whip para tentar alcançar uma corda. Se a tentativa der muito errado, as vinhas podem prender no galho errado e complicar a travessia. Essa é uma possibilidade da aventura, combinada com o Narrador, não um novo efeito oficial de Vine Whip.",
                "context": "Dois resultados máximos só ajudam se a tentativa for válida e acertar. Dois resultados mínimos podem trazer uma complicação combinada, nunca um poder inventado para Bulbasaur.",
                "steps": [
                    "Primeiro confira se a tentativa era possível. Um ataque também precisa vencer a defesa e acertar o alvo para se tornar um acerto crítico.",
                    "Os dois maiores resultados possíveis nos dados mantidos sinalizam um possível crítico. O aplicativo confirma o acerto e aplica o dano correto; isso não ignora imunidades nem a proteção de sobrevivência.",
                    "Os dois menores resultados podem trazer uma complicação. No improviso de Bulbasaur, o grupo pode combinar que as vinhas se prenderam no galho errado. O Narrador não transforma isso em um efeito oficial novo de Vine Whip.",
                    "Uma complicação na defesa também precisa fazer sentido. Ela não retira, por si só, a proteção de sobrevivência."
                ],
                "auditCase": "survival"
            },
            {
                "id": "1.4",
                "title": "Testes de chance e efeitos extras",
                "plain": "Alguns movimentos podem errar ou causar um efeito extra. O MyOwnDex faz o sorteio e mostra o resultado.",
                "body": "1d100 é uma rolagem de 1 a 100. Se o resultado for igual ou menor que a chance, funciona. Com vantagem, faça duas tentativas e fique com a melhor; com desvantagem, fique com a pior. Quando a chance não cabe certinho no d100, o MyOwnDex usa um sorteio exato.\n\nUm ataque que vence a disputa ganha vantagem na precisão e nos efeitos secundários se a soma de seus dados mantidos for pelo menos 2 maior que a da defesa. Compare só os dados, sem os atributos. O aplicativo confere isso para você.",
                "example": "Pikachu usa Thunder Shock em Eevee. O movimento pode causar dano e também pode deixar Eevee paralisado. Primeiro veja se o golpe acertou; depois confira na tela se a paralisia aconteceu. Nem todo acerto provoca esse efeito.",
                "collapsibleDetails": true,
                "context": "Acertar Eevee e paralisá-lo são dois acontecimentos diferentes. A chance extra de Thunder Shock só é verificada quando o movimento pode aplicar esse efeito.",
                "steps": [
                    "Pikachu escolhe Thunder Shock e Eevee é o alvo. Confira primeiro se o movimento alcançou Eevee.",
                    "A paralisia é um efeito separado: um golpe que alcançou o alvo pode não paralisá-lo. O painel registra o que aconteceu naquela tentativa.",
                    "Quando a vantagem nos dados permitir outra tentativa de precisão ou efeito, o aplicativo já faz essa verificação. Não repita o sorteio por fora para procurar um resultado melhor."
                ]
            },
            {
                "id": "1.5",
                "title": "Um pouquinho mais ou menos de dano",
                "plain": "Um golpe pode sair um pouco mais forte ou mais fraco. A diferença é pequena e sempre usa números inteiros.",
                "body": "Calcule o dano com seus modificadores e arredonde. Depois, role um d6 para cada impacto em cada alvo: de 2 a 5, o dano fica como está; com 1, diminui um passo; com 6, aumenta um passo.\n\nO passo é o dano-base dividido por 10, arredondado para baixo, com mínimo de 1. Dano-base 1 continua em 1. Depois aplique o limite comum de dano, salvo as exceções da regra do movimento. Esse limite pode cortar o aumento.\n\nCura, custos de HP, recuo, dano contínuo, dano fixo e dano baseado no HP não usam essa variação. O resultado é sorteado ao aplicar o impacto e fica registrado; consultá-lo outra vez não dá uma nova rolagem. Esta é uma adaptação do RPG.",
                "example": "Pikachu usa Thunder Shock em Eevee. Se o golpe acertar e causar dano, o MyOwnDex mostra quanto HP Eevee perdeu. O dano pode variar um pouco a cada impacto; abrir o Diário de novo não provoca outro ataque.",
                "collapsibleDetails": true,
                "context": "O dano de Thunder Shock muda um pouco em cada impacto. Veneno, cura e outras perdas de HP não recebem essa variação de ataque neste RPG.",
                "steps": [
                    "Se Thunder Shock causar dano em Eevee, leia o HP que mudou e o resultado registrado. O poder do movimento continua importando.",
                    "A pequena variação já faz parte de cada impacto. Não role outro dano só porque abriu a prévia ou o Diário.",
                    "O limite de dano ainda pode reduzir o resultado. Cura, veneno, recuo, custos de HP e movimentos de dano próprio seguem suas regras, sem receber essa variação extra."
                ],
                "auditCase": "damage"
            }
        ]
    },
    {
        "id": "matematica",
        "number": 2,
        "title": "Os números da ficha",
        "summary": "Entenda os atributos, os valores inteiros e o crescimento dos seus parceiros.",
        "rules": [
            {
                "id": "2.1",
                "title": "As forças do seu Pokémon",
                "plain": "Cada Pokémon tem suas próprias forças. O MyOwnDex monta os atributos para você acompanhar sua aventura.",
                "body": "Nível, IVs, EVs e natureza ajudam a formar os atributos, como nos jogos. IVs são características naturais; EVs vêm do treinamento; a natureza também influencia esses valores. Você pode usar os cálculos do aplicativo ou uma ficha pronta combinada com o Narrador.\n\nHP são os pontos de vida: mostram quanto seu parceiro ainda aguenta antes de desmaiar. PP são os pontos de poder: mostram quantas vezes ele pode usar cada movimento.",
                "example": "Dois Pikachu de Treinadores diferentes disputam uma corrida. Mesmo no mesmo nível, um pode ter mais Velocidade que o outro por causa de suas características e do treinamento. Abra as fichas para comparar os atributos.",
                "context": "HP é a energia de cada Pikachu. PP pertence a cada movimento. Velocidade, Defesa e outros atributos também podem mudar com o treinamento e as condições da batalha.",
                "steps": [
                    "Abra a ficha de cada Pikachu antes de comparar a corrida. Mesmo nível não significa que os parceiros são idênticos.",
                    "Natureza, características naturais e treinamento ajudam a formar os atributos. IVs é o nome usado para as características naturais; EVs registra o treinamento.",
                    "HP mostra quanto o parceiro aguenta antes de desmaiar. Os PP pertencem a cada movimento e mostram os usos que restam."
                ]
            },
            {
                "id": "2.2",
                "title": "Números menores para jogar",
                "plain": "No RPG, usamos números menores para facilitar as contas. O aplicativo faz essa conversão por você.",
                "body": "Divida o HP original por 8. Divida os outros atributos e o poder dos movimentos por 10. Escolha o inteiro mais próximo: se ficar exatamente no meio, o HP sobe e os outros valores descem. Shedinja continua com 1 HP.\n\nHP, dano, cura, XP, EVs e Amizade não ficam quebrados. STAB é o bônus de usar um movimento do próprio tipo. Para o bônus comum, multiplique por 3 e divida por 2 antes de arredondar. A regra 6.2 explica os efeitos pequenos.\n\nA Amizade usa a escala de 0 a 255 na ficha original. No RPG, divida por 10 e arredonde para baixo: o máximo é 25.",
                "example": "Bulbasaur usa Tackle contra Eevee numa batalha deste RPG. A ficha pode mostrar atributos e dano em números menores que os jogos principais. O MyOwnDex converte os valores; Bulbasaur continua sendo do tipo Grass/Poison e Tackle continua sendo do tipo Normal.",
                "collapsibleDetails": true,
                "context": "No modo RPG, veja os valores já convertidos. O tipo Normal e o efeito original de Tackle não mudam só porque o número apresentado é menor.",
                "steps": [
                    "Na ficha de Bulbasaur, escolha o modo RPG para ver os valores na escala da mesa. O aplicativo faz a conversão.",
                    "Compare o HP atual e o máximo na mesma escala. Não misture o dano de uma ficha convertida com o HP de uma ficha dos jogos.",
                    "Bulbasaur mantém seus tipos e a identidade de seus movimentos. O número menor não dá a Tackle o tipo Grass nem cria um efeito novo.",
                    "Shedinja continua com seu HP especial. Os resultados de jogo continuam inteiros; o caso conferido mostra como a ficha de Pikachu foi produzida."
                ],
                "auditCase": "scale"
            },
            {
                "id": "2.3",
                "title": "Atributos que sobem e descem",
                "plain": "Um movimento pode aumentar ou diminuir um atributo durante a batalha. Cada mudança fica marcada na ficha.",
                "body": "Essas mudanças são os estágios: vão de −6 a +6. O MyOwnDex ajusta o atributo original antes de passá-lo para a escala do RPG. Precisão e Evasão também têm estágios.\n\nÀs vezes, dois estágios mostram o mesmo número pequeno. A mudança não se perdeu: outro aumento pode alcançar o próximo número. O valor nunca anda para o lado contrário ao estágio.\n\nPara calcular sem aplicativo, comece pelo atributo original. No estágio +n, multiplique por (2 + n) ÷ 2; no estágio −n, multiplique por 2 ÷ (2 + n), com n representando a quantidade de estágios. Para a disputa, use a parte inteira do resultado, no mínimo 1. Para mostrar o atributo no RPG, divida o resultado por 10 e arredonde como na regra 2.2. Se a conversão esconder um aumento ou uma redução, marque ao menos um passo na direção correta quando isso for possível.\n\nPara Precisão e Evasão, subtraia o estágio de Evasão do alvo do estágio de Precisão do usuário, entre −6 e +6. Se o resultado for positivo, multiplique a chance por (3 + n) ÷ 3; se negativo, por 3 ÷ (3 + n), com n sendo a quantidade de estágios.",
                "example": "Bulbasaur usa Growl contra Pikachu e diminui seu Ataque. Quando Pikachu usar Quick Attack, que é físico, essa mudança conta. Thunder Shock usa Ataque Especial; Growl não diminuiu esse outro atributo.",
                "collapsibleDetails": true,
                "context": "Growl diminuiu o Ataque usado por Quick Attack. Se Pikachu escolher Thunder Shock, o aplicativo usa Ataque Especial, que não foi reduzido por esse Growl.",
                "steps": [
                    "Growl de Bulbasaur tenta diminuir o Ataque de Pikachu. Confira se o efeito foi aplicado na ficha.",
                    "Quando Pikachu usar Quick Attack, que é físico, esse Ataque enfraquecido será considerado. Thunder Shock usa Ataque Especial, outro atributo.",
                    "A marca da mudança continua guardada mesmo quando a escala pequena exibe o mesmo número. Não acrescente um bônus por fora para compensar o arredondamento."
                ]
            },
            {
                "id": "2.4",
                "title": "Quando um valor chega a zero",
                "plain": "Com 0 HP, o Pokémon desmaia e precisa de cuidados. Isso não significa que ele morreu.",
                "body": "O HP máximo nunca fica abaixo de 1. Um dano direto que realmente acontece causa pelo menos 1 de dano. Um erro, uma imunidade ou um bloqueio pode causar 0.\n\nEfeitos pequenos também podem dar 0 naquela vez, como explica a regra 6.2. Isso não remove uma condição nem ignora uma proteção. Se uma escolha exige pagar HP, o custo continua sendo pelo menos 1.",
                "example": "Pikachu usa Thunder Shock contra um Geodude de Kanto. Como Geodude é do tipo Ground (Terra), esse movimento elétrico não causa dano. O aplicativo mostra 0: uma imunidade não vira dano só para aparecer um número. Se o HP de um Pokémon chegar a 0, ele desmaia.",
                "context": "Thunder Shock não causa dano em Geodude de Kanto, por causa da imunidade ao tipo Electric. Isso não significa que Pikachu errou o alvo; o tipo impediu o dano.",
                "steps": [
                    "Se Thunder Shock alcançar Geodude de Kanto, confira a imunidade de Ground: o golpe não causa dano.",
                    "Isso é diferente de errar a precisão. Também não há um dano mínimo que possa atravessar a imunidade.",
                    "Quando um Pokémon fica sem HP, ele desmaia e precisa de cuidados; a regra não declara sua morte. Efeitos pequenos podem passar uma vez sem tirar HP e continuar ativos."
                ],
                "auditCase": "immunity"
            },
            {
                "id": "2.5",
                "title": "Ganhar XP e subir de nível",
                "plain": "Seus Pokémon aprendem ao superar desafios! O Narrador escolhe a recompensa e o MyOwnDex acompanha o crescimento.",
                "body": "XP quer dizer experiência: o que seu parceiro aprende na jornada. Você pode ganhar XP ao vencer, capturar, negociar, resgatar ou descobrir algo. Se tudo isso resolveu o mesmo desafio, receba a recompensa uma vez só.",
                "bullets": [
                    "Recompensa-base: 1 XP para um desafio comum, 2 para um importante e 3 para uma grande conquista. Fora de batalha, fique entre 1 e 3 XP. Repetir uma tarefa fácil e sem risco não cria outro desafio.",
                    "Depois da batalha: termine a rodada e use Encerrar batalha antes de dar XP. Trocar apenas a fase não basta. Termine também as transformações, inclusive Transform. Tera Shift é automático: fora da batalha, Terapagos pode crescer com as duas formas atualizadas juntas. Não refaça uma iniciativa em andamento para atualizar atributos.",
                    "Subir de nível: a meta é metade do próximo nível, arredondada para baixo. Ao alcançá-la, desconte a meta, suba e guarde a sobra. Se ainda tiver XP para outro nível, repita.",
                    "Vitória difícil: dobre a recompensa se um adversário tiver pelo menos o dobro do maior nível do lado vencedor. Dobre também se houver pelo menos o dobro de Pokémon participantes no lado adversário. As duas situações juntas multiplicam por 4. Use os níveis de entrada e conte quem participou, mesmo que tenha saído ou desmaiado; ficar só no banco não conta.",
                    "Vitória mais fácil: se o dobro do nível ou dos participantes favorecer o vencedor, tire 1 XP por situação, sem dar o multiplicador daquela situação. Quando houver uma vantagem de cada lado, multiplique primeiro e subtraia depois. A recompensa final fica em pelo menos 1 XP.",
                    "Recompensa do grupo: a XP recebida já é inteira. A divisão padrão é igual, com resultado arredondado para baixo; combinem outra divisão antes. Cada Pokémon que contribuiu de verdade e enfrentou o risco recebe pelo menos 1 XP. Só entrar em campo ou ficar na Box não basta.",
                    "Treinamento: cada XP recebida dá 2 EVs para distribuir. São até 252 EVs por atributo e 510 ao todo. Registrar a mesma recompensa de novo não entrega XP ou EVs outra vez. Editar a XP atual serve para corrigir a ficha."
                ],
                "example": "Eevee ajudou seu Treinador a encontrar o caminho de volta à trilha depois de uma tempestade. Quando o desafio termina, o Narrador pode conceder XP. A ficha mostra se Eevee subiu de nível e quanto de XP ficou guardado.",
                "collapsibleDetails": true,
                "context": "Se Eevee ajudou a concluir uma batalha, encerre-a antes de entregar XP. Depois confira os níveis e a experiência restante na ficha; conte a conquista uma vez só.",
                "steps": [
                    "Quando Eevee concluir o desafio, o Narrador escolhe a recompensa em Ganhar XP. Comum, Importante e Conquista representam a importância do que aconteceu.",
                    "Se foi uma batalha, conclua as vezes dos participantes e use Encerrar batalha antes de entregar a recompensa. Só mudar a fase não encerra o confronto.",
                    "O aplicativo considera a dificuldade da batalha, distribui a recompensa combinada e acompanha os níveis. Quem apenas entrou em campo ou ficou na Box não recebe crédito por contribuir.",
                    "Confira o nível, a XP guardada e os EVs para treinar na ficha de Eevee. Uma recompensa pode permitir mais de um crescimento; a XP que sobrar continua com ele.",
                    "Registre a mesma conquista apenas uma vez. Editar a XP para corrigir uma ficha não entrega novos EVs, e reler o registro não concede a recompensa outra vez."
                ],
                "auditCase": "xp"
            }
        ]
    },
    {
        "id": "combate",
        "number": 3,
        "title": "Hora da batalha",
        "summary": "Escolha sua ação, acompanhe a vez e descubra o resultado dos movimentos.",
        "rules": [
            {
                "id": "3.1",
                "title": "Quem joga primeiro?",
                "plain": "Pikachu tem sua vez e Bulbasaur tem a dele. Depois que todos terminarem, essa volta da batalha acaba: isso é uma rodada.",
                "body": "Antes de rolar a iniciativa, escolha um movimento, Trocar Pokémon, Improvisar / interagir, Tentar fugir ou Aguardar / passar a vez. Escolher ainda não gasta PP. Você pode mudar até a iniciativa ser rolada.\n\nDepois disso, siga sua escolha. Se o plano ficar impossível, você pode aguardar ou seguir uma alternativa já combinada. Isso não libera outro ataque para escolher depois de ver a ordem.",
                "bullets": [
                    "Prioridade: movimentos de prioridade maior vêm primeiro. Protect tem +4, Quick Attack tem +1 e Tackle tem 0. Valores negativos vêm depois de 0. Aguardar, improvisar, fugir e trocar usam 0. Prioridade não aumenta a Velocidade nem dá outra ação.",
                    "Mesma prioridade: o jogo rola 2d6 e usa a Velocidade atual, com seus ajustes. Se ainda houver empate, role 1d6 entre os empatados e repita até decidir.",
                    "Habilidades: Prankster dá +1 a movimentos de status; Gale Wings dá +1 a movimentos do tipo Flying (Voador) com HP cheio; Triage dá +3 às curas que sua regra permite. A habilidade precisa estar ativa. Você vê a prioridade antes de rolar.",
                    "Durante a rodada: a ordem fica como foi rolada. Uma mudança de Velocidade conta na próxima rodada, salvo um efeito que mude a ordem de propósito. Mudar a seleção não adianta sua vez.",
                    "Para continuar: use Próximo turno depois da ação. No último turno, Encerrar rodada aplica os efeitos finais. Então escolha de novo e role a próxima iniciativa."
                ],
                "example": "Pikachu e Bulbasaur vão batalhar. Cada um escolhe seu movimento antes de começar: Quick Attack para Pikachu e Tackle para Bulbasaur. Pikachu tenta primeiro pela prioridade. Depois vem a vez de Bulbasaur. Quando os dois terminarem, o grupo encerra essa rodada e prepara a próxima.",
                "context": "Turno é a vez de um Pokémon. Rodada é a volta que só termina depois das vezes dos participantes. Próximo turno passa ao próximo; Encerrar rodada aplica os efeitos finais e prepara outra volta.",
                "steps": [
                    "Uma rodada é uma volta completa da batalha. Nesta cena, Pikachu terá sua vez e Bulbasaur terá a dele. A vez de cada Pokémon também é chamada de turno.",
                    "Antes dessa volta começar, escolha Quick Attack para Pikachu e Tackle para Bulbasaur. Escolher não gasta PP.",
                    "Rolar iniciativa organiza a fila. Quick Attack tem prioridade maior e vem antes de Tackle; se a prioridade for igual, o aplicativo considera a Velocidade.",
                    "Quando Pikachu terminar sua tentativa, use Próximo turno para chegar à vez de Bulbasaur. Quando todos terminarem, use Encerrar rodada: o aplicativo aplica os efeitos finais e prepara uma nova volta.",
                    "A ordem e as escolhas ficam firmes durante essa volta. Uma mudança de Velocidade normalmente conta na próxima; se um plano ficar impossível, aguarde ou siga uma alternativa já combinada."
                ]
            },
            {
                "id": "3.2",
                "title": "O movimento acertou?",
                "plain": "A precisão mostra a chance de um movimento alcançar o alvo. O MyOwnDex confere a rolagem e os ajustes.",
                "body": "Alguns movimentos dispensam o teste de precisão. Os que têm uma chance numérica usam d100: igual ou menor que a chance ajustada é acerto. Mesmo uma precisão de 100% pode mudar com os estágios de Precisão e Evasão.\n\nSe o ataque vencer a disputa e a soma de seus dados mantidos for pelo menos 2 maior que a da defesa, ele ganha a segunda tentativa da regra 1.4.",
                "example": "Eevee usou Sand Attack para atrapalhar a precisão de Pikachu. Quando Pikachu tentar Thunder Shock, confira se acertou. Mesmo um movimento que normalmente acerta com facilidade pode falhar se sua precisão diminuir.",
                "context": "Sand Attack pode fazer até um movimento com boa precisão errar. Isso é diferente de uma imunidade de tipo, que pode impedir o dano mesmo quando o ataque acerta.",
                "steps": [
                    "Na vez de Eevee, Sand Attack pode atrapalhar a precisão de Pikachu. Depois chega a vez de Pikachu tentar Thunder Shock.",
                    "O aplicativo confere se o movimento alcançou Eevee. Uma precisão que costuma ser boa ainda pode piorar; movimentos que dispensam esse teste mantêm sua exceção.",
                    "Se Thunder Shock errar, não há impacto no alvo, mas a tentativa usou a vez e os PP. Uma imunidade de tipo é outra situação: ela não é um erro de precisão."
                ]
            },
            {
                "id": "3.3",
                "title": "Usar um movimento",
                "plain": "Escolha o movimento e seu alvo. Cada movimento faz o que sua própria regra permite.",
                "body": "Movimentos físicos usam Ataque contra Defesa. Movimentos especiais usam Ataque Especial contra Defesa Especial. Movimentos de status podem fortalecer, atrapalhar ou mudar a cena. Eles seguem seus próprios alvos, precisão, imunidades e efeitos; não recebem uma disputa de dano inventada.\n\nRecover e Swords Dance, por exemplo, agem no próprio usuário. Eles também esperam a vez do Pokémon. Escolher um movimento ainda não aplica seu efeito.\n\nPara calcular o dano de um movimento comum na mesa, comece pelo Poder do movimento: multiplique esse Poder pelos bônus de tipo próprio (STAB), efetividade e quaisquer modificadores válidos de crítico, habilidade, item, clima ou terreno; divida tudo por 10. Arredonde uma vez ao inteiro mais próximo, para baixo quando estiver exatamente no meio. Se o golpe acertou e o resultado positivo ficou menor que 1, use 1. Depois aplique a variação da regra 1.5 e o limite por impacto desta regra. Movimentos de dano fixo, nocaute direto e efeitos especiais seguem suas exceções.",
                "bullets": [
                    "Para causar dano, o atacante precisa superar a defesa. Empate ou resultado menor impedem o dano. Se o movimento acertou, um efeito secundário ainda pode funcionar.",
                    "Aplique cada efeito em quem a descrição manda: o usuário, o Pokémon escolhido, um grupo ou o campo.",
                    "O jogo combina poder, STAB, tipos e outros bônus antes de arredondar uma vez. Depois vêm a pequena variação da regra 1.5 e o limite comum.",
                    "O limite comum por impacto é o nível do atacante. Superefetividade e estágios positivos do atributo de ataque podem aumentar esse limite. Resistência diminui o dano, mas não aumenta o limite. Críticos e movimentos com regras próprias seguem suas exceções."
                ],
                "example": "Scyther usa Swords Dance para aumentar o próprio Ataque. Ele não precisa acertar outro Pokémon para isso. Espere a vez de Scyther, escolha Swords Dance e acompanhe a mudança na ficha. Um movimento de apoio não ganha dano extra só por ser usado em batalha.",
                "collapsibleDetails": true,
                "context": "Quando Scyther usar outro movimento físico mais tarde, seu Ataque fortalecido será levado em conta. Swords Dance por si só não escolhe adversário nem causa dano.",
                "steps": [
                    "Espere a vez de Scyther e escolha Swords Dance. O alvo do efeito é o próprio Scyther.",
                    "Confira o aumento de Ataque na ficha. Swords Dance não causa dano nem exige vencer a Defesa do adversário.",
                    "Mais tarde, Quick Attack de Scyther pode aproveitar esse Ataque fortalecido. Um movimento especial usaria Ataque Especial em vez dele.",
                    "Para um ataque que causa dano, o painel confere o atributo correto, a defesa, a precisão, os tipos e o limite. Um efeito secundário só segue se sua própria regra permitir."
                ]
            },
            {
                "id": "3.4",
                "title": "Aguentar um golpe decisivo",
                "plain": "Com HP cheio, seu Pokémon pode aguentar um golpe que o derrubaria e continuar com 1 HP!",
                "body": "Esta é a Proteção contra hit kill do MyOwnDex, uma adaptação para o RPG. Ela pode ajudar uma vez por Pokémon em cada batalha. Ela precisa estar disponível quando a ação começa, com o HP cheio.\n\nSome o dano direto dos impactos do mesmo movimento que realmente chegaram ao Pokémon, depois da precisão, dos bloqueios e do limite de dano. Se esse total o derrubaria, mas for menor que três vezes seu HP máximo, ele termina o dano direto da ação com 1 HP. Os outros impactos dessa mesma ação não tiram esse último HP. A proteção fica usada.\n\nShedinja não tem esta proteção geral. Movimentos de nocaute direto e dano total de pelo menos três vezes o HP máximo seguem suas exceções. Um crítico sozinho não remove a proteção.\n\nOutras ações, efeitos de contato e dano contínuo são contados à parte. Sturdy, Focus Sash e a reserva de sobrevivência seguem suas próprias regras; usar a proteção geral não consome Focus Sash no mesmo movimento. Curar, trocar ou mudar de fase não renova a proteção. Tirar o próprio HP encerra essa proteção na batalha.",
                "example": "Eevee usa Tackle em Pikachu. Se Pikachu começou a ação com HP cheio e ainda tem sua proteção disponível, pode resistir ao golpe e continuar com 1 HP. É uma proteção especial deste RPG; ela não funciona em todas as situações nem se renova ao trocar de Pokémon.",
                "context": "Pikachu precisa começar a ação com HP cheio e ter sua chance ainda disponível. A proteção especial deste RPG só vale nas condições descritas e não é garantida pelos jogos oficiais.",
                "steps": [
                    "Pikachu precisa estar com HP cheio quando a ação de Eevee começa e ainda não ter usado essa proteção na batalha.",
                    "Se o dano direto do movimento o derrubaria e estiver dentro dos limites da proteção, Pikachu termina essa ação com o último HP. Os outros impactos do mesmo movimento não tiram esse último ponto.",
                    "A proteção geral é uma adaptação do RPG. Shedinja não a recebe; nocaute direto e um golpe forte o bastante para atravessá-la mantêm suas exceções.",
                    "Veneno, contato e outras ações são acontecimentos separados. Sturdy, Focus Sash e a reserva de sobrevivência têm regras próprias. Curar, trocar ou mudar de fase não devolve a proteção; tirar o próprio HP a encerra nessa batalha.",
                    "Veja o caso conferido: ele mostra Eevee usando Tackle e a ficha de Pikachu antes e depois, em vez de supor um dano sem origem."
                ],
                "auditCase": "survival"
            },
            {
                "id": "3.5",
                "title": "Quando vale a regra dos jogos",
                "plain": "Os jogos Pokémon são nossa base. Quando o Guia muda uma regra para a mesa, ele explica essa mudança.",
                "body": "Tipos, STAB, imunidades, condições, recuo e drenagem seguem suas regras, com as adaptações deste Guia. Escolher outro jogo para consultar movimentos não muda as regras do RPG.",
                "bullets": [
                    "Movimentos comuns de 2 a 5 acertos: o RPG usa 35% para 2, 35% para 3, 15% para 4 e 15% para 5.",
                    "Skill Link: garante o máximo de acertos. Loaded Dice: dá 4 ou 5, com a mesma chance para cada resultado.",
                    "Contagens fixas e movimentos especiais: siga a descrição própria. Quando a sequência exige precisão, poder ou reações diferentes entre impactos, o painel avisa que o Narrador precisa acompanhá-la.",
                    "Sequência acompanhada pelo Narrador: o cálculo automático para antes de gastar recursos. Resolva e registre PP, dano, proteção e ação uma vez só."
                ],
                "example": "Combusken, que recebeu Double Kick ao evoluir de Torchic em Scarlet/Violet, usa esse movimento contra um Geodude de Kanto. Double Kick desfere dois chutes. O jogo confere o resultado de cada impacto; não sorteia uma quantidade de chutes diferente.",
                "context": "Alguns golpes têm dois acertos certos na sua descrição; outros podem acertar várias vezes em quantidade variável. O Narrador não deve trocar uma regra pela outra.",
                "steps": [
                    "Combusken aprendeu Double Kick ao evoluir de Torchic no jogo de referência indicado. Escolha esse movimento e Geodude como alvo.",
                    "Double Kick prevê dois chutes. O aplicativo não troca essa descrição pelo sorteio de movimentos com quantidade variável de impactos.",
                    "Skill Link e Loaded Dice só mudam as sequências que suas próprias regras permitem. Cada impacto respeita o alvo, as proteções e a possibilidade de o alvo já ter desmaiado.",
                    "Se o painel pedir acompanhamento do Narrador por causa de uma sequência especial, pare o cálculo automático antes de gastar recursos. Resolva e registre ação, PP e consequências sem repetir o gasto."
                ]
            },
            {
                "id": "3.6",
                "title": "Onde seu Pokémon está?",
                "plain": "Imagine a cena com seus amigos. O que está perto? O que ficou longe? O cenário ajuda a decidir o que dá para fazer.",
                "body": "Use três distâncias simples: Perto, Longe e Muito Longe. Não precisa contar quadradinhos. Considere alcance, obstáculos, área e Velocidade.\n\nArrastar o desenho de um Pokémon só organiza o campo. Isso não dá deslocamento grátis, alcance maior ou outra ação. Traga o parceiro escolhido para o campo; os demais ficam no banco. Uma troca preserva HP, PP, condições, itens gastos e a proteção já usada ou perdida.",
                "example": "Pikachu vê a outra margem de um rio. Arrastar seu desenho no campo não o faz atravessar a água. Conversem sobre a distância, os obstáculos e o que Pikachu pode tentar de verdade. O desenho ajuda a acompanhar a cena, mas não cria movimentos grátis.",
                "context": "No campo do RPG, considerem se Pikachu está Perto, Longe ou Muito Longe do objetivo. Obstáculos, terreno e alcance importam antes de decidir uma travessia.",
                "steps": [
                    "Pikachu quer chegar à outra margem. Primeiro observem o rio, a distância, os obstáculos e o que ele consegue fazer.",
                    "O grupo usa Perto, Longe e Muito Longe para acompanhar o espaço. Uma travessia sob perigo pode exigir a ação e um teste combinado antes dos dados.",
                    "Arrastar o desenho só organiza o campo. Não atravessa o rio, não aumenta o alcance e não oferece outra ação.",
                    "Os parceiros que não entraram ficam no banco. Trocar não apaga ferimentos, condições, PP gastos ou a proteção já usada."
                ]
            },
            {
                "id": "3.7",
                "title": "Sua vez de agir",
                "plain": "Cada Pokémon espera sua vez para fazer a ação escolhida. Depois da tentativa, a fila segue para o próximo participante.",
                "body": "Na batalha, procure Agora para saber de quem é a vez. A defesa normal já faz parte da disputa e não custa outra ação.",
                "bullets": [
                    "Ação principal: use um movimento, faça um improviso importante ou troque de Pokémon. Prioridade só define a vez. No Campo dos Dados, Treino livre permite praticar; Rolar iniciativa começa uma batalha. Encerrar rodada não devolve o treino livre nem permite atacar antes da próxima iniciativa.",
                    "Tentativa válida: gasta a ação mesmo que o movimento erre, seja bloqueado ou uma condição impeça agir. Se a condição impedir a ação, não gaste PP. Uma escolha inválida, como um movimento sem PP, pode ser corrigida antes da tentativa e não gasta a ação.",
                    "Troca por escolha: declare Trocar Pokémon antes da iniciativa. Quem sai usa sua ação; quem entra ocupa esse lugar e não ganha outra ação nessa rodada. Substituir um parceiro desmaiado não gasta a ação da rodada seguinte. Os recursos de cada Pokémon continuam com ele.",
                    "Deslocamento: mover-se na mesma faixa pode acompanhar a ação. Atravessar uma faixa sob oposição ou conquistar uma posição importante pode exigir a ação e um teste. Combine isso antes de rolar.",
                    "Reação: só acontece quando um movimento, habilidade, item ou situação permite. Ela não dá uma nova ação por conta própria.",
                    "Aguardar, improvisar, fugir e trocar: usam prioridade 0. Aguardar passa a vez sem outro efeito. Para improvisar, combine objetivo e risco antes da iniciativa e anote o plano. Nenhuma dessas opções guarda um ataque para escolher depois. Se uma regra der outra ação ou mudar a ordem, o Narrador registra a exceção no Diário."
                ],
                "example": "Pikachu escolheu Thunder Shock contra Eevee antes da iniciativa. Quando chegar a vez dele, confira a ação e o PP. Se não tiver PP, corrija a escolha antes de tentar. Se atacar e errar, Pikachu usou sua vez.",
                "context": "Se Pikachu tentou Thunder Shock e errou, sua vez terminou. Próximo turno leva ao próximo participante; quando todos acabarem, Encerrar rodada fecha essa volta da batalha.",
                "steps": [
                    "Procure Agora na fila da batalha para saber se é a vez de Pikachu. A defesa comum já faz parte da disputa, sem cobrar outra ação de quem se defende.",
                    "Pikachu pode tentar o movimento escolhido, trocar, improvisar, fugir ou aguardar conforme sua declaração. Se atacar e errar, sua vez foi usada.",
                    "Se uma condição impedir o movimento, a vez termina, mas os PP daquele movimento não são gastos. Se a escolha nem era válida, como um golpe sem PP, corrija antes da tentativa.",
                    "Ao trocar Pikachu por Bulbasaur, a troca ocupa a vez de Pikachu. Bulbasaur não ganha um ataque extra nessa mesma volta. Substituir um parceiro desmaiado não gasta a ação da rodada seguinte.",
                    "Próximo turno leva ao próximo Pokémon. Encerrar rodada fecha a volta depois que todos terminarem; não devolve treino livre nem permite um ataque antes da próxima iniciativa."
                ]
            }
        ]
    },
    {
        "id": "treinador",
        "number": 4,
        "title": "Seu Treinador na jornada",
        "summary": "Capturar, usar itens, cuidar da equipe e preparar a próxima aventura.",
        "rules": [
            {
                "id": "4.1",
                "title": "O Treinador também participa",
                "plain": "Seu Treinador pode usar um item ou tentar uma captura. Isso não tira a ação do seu Pokémon.",
                "body": "Cada Treinador tem uma intervenção por rodada em batalha. Use-a no começo do turno de um Pokémon sob seu controle, antes de verificar condições e fazer a ação. Se você controla vários parceiros, escolha uma dessas oportunidades: continua sendo uma intervenção.\n\nA intervenção é gasta mesmo se a tentativa falhar. Ela não interrompe uma rolagem ou um dano já resolvido para desfazer o resultado. Aliados e oponentes seguem o mesmo momento. Fora da batalha, considere o tempo e o risco da cena.",
                "example": "No começo da vez de Pikachu, seu Treinador pode usar uma intervenção antes do movimento do parceiro. Uma captura é registrada pelo assistente; um item, como Potion, precisa ter seu uso e seu efeito conduzidos pelo Narrador. Pikachu ainda conserva a própria ação, se puder agir.",
                "context": "A intervenção pertence ao Treinador, e a ação pertence a Pikachu. Uma tentativa que falhou não libera outra intervenção na mesma volta da batalha. O controle de itens usados manualmente ainda exige registro do Narrador.",
                "steps": [
                    "No começo da vez de Pikachu, antes de verificar sua condição ou seu movimento, o Treinador pode usar sua intervenção.",
                    "Se usar um item na mesa, o Narrador conduz o efeito e anota o gasto. Em Item do Treinador, escolha Pikachu, informe Potion e registre a intervenção. A marcação usa a oportunidade do Treinador; não aplica cura nem retira a Potion automaticamente.",
                    "Pikachu conserva a própria ação, se puder agir. O Treinador não ganha outra intervenção por controlar mais parceiros e não recupera a oportunidade se a tentativa falhar.",
                    "Não volte a uma rolagem já encerrada para usar um item e desfazer o resultado. Fora de batalha, combinem o tempo e o risco da cena."
                ]
            },
            {
                "id": "4.2",
                "title": "Vamos capturar um Pokémon!",
                "plain": "Encontrou um Pokémon selvagem? Escolha uma Poké Ball e tente fazer dele seu novo parceiro!",
                "body": "A captura comum precisa de um Pokémon selvagem, consciente e que possa ser capturado naquela cena. Em batalha, a tentativa usa uma Poké Ball e a intervenção do Treinador, mesmo se falhar. Ela não usa a ação do Pokémon.\n\nQuando um confronto terminar, conclua a rodada e use Encerrar batalha. Isso encerra transformações e efeitos temporários, mas não cura HP nem devolve PP, itens, proteção ou usos de técnicas. Só mudar a fase não encerra o confronto. Nova batalha começa outro.",
                "bullets": [
                    "Chance de captura: o MyOwnDex usa a taxa da espécie, o HP, a condição e a Ball. A conta é 100 × taxa da espécie ÷ 255 × (3 × HP máximo − 2 × HP atual) ÷ (3 × HP máximo) × bônus da Ball × bônus da condição. Arredonde só o resultado final para baixo. Taxa positiva dá de 1% a 100%; taxa 0 não permite captura comum.",
                    "Poké Balls: Poké Ball, Premier, Luxury e Heal usam bônus 1. Great multiplica por 3 e divide por 2. Ultra dobra. Balls especiais seguem sua própria descrição.",
                    "Condições: sono e congelamento multiplicam por 5 e dividem por 2. Queimadura, paralisia e veneno multiplicam por 3 e dividem por 2.",
                    "Resultado: no d100, igual ou menor que a chance é captura. A taxa vem da Pokédex; HP e condição vêm da cena. A vantagem de um ataque não passa para a captura. Master Ball dispensa o teste, mas não captura o parceiro de outro Treinador.",
                    "Bolsa e PC: anote suas Balls na bolsa. O aplicativo retira uma e registra resultado e intervenção juntos. Repetir o mesmo registro não gasta outra Ball. Depois da captura, guarde seu novo parceiro no PC.",
                    "Formas Max: termine Dynamax, Gigantamax ou Eternamax antes da captura. Para uma captura depois de uma raid, o grupo precisa combinar esse formato antes."
                ],
                "example": "Eevee enfrentou um Pidgey selvagem, que ainda não desmaiou. No início da próxima vez de Eevee, antes de seu movimento, o Treinador pode lançar uma Poké Ball pelo assistente de Captura. A Ball sai da bolsa mesmo se Pidgey escapar; Eevee ainda conserva sua própria ação.",
                "collapsibleDetails": true,
                "context": "No RPG, capturar usa uma intervenção do Treinador e uma Poké Ball. Eevee não gasta sua ação principal por essa tentativa, mas o Treinador não ganha outra intervenção na mesma rodada.",
                "steps": [
                    "Pidgey precisa ser selvagem, ainda não ter desmaiado e poder ser capturado naquela cena. A captura comum não toma o parceiro de outro Treinador.",
                    "No início da vez de Eevee, antes de seu movimento, abra Captura. Escolha quem está ajudando, o Pidgey selvagem e a Poké Ball que está na bolsa.",
                    "O assistente consulta a espécie e considera o HP perdido, a condição e a Ball. A chance e o resultado vêm dessa situação; a vantagem de um ataque anterior não passa para a captura.",
                    "Lançar a Ball usa a intervenção do Treinador e gasta a Ball mesmo se Pidgey escapar. Reler o registro não gasta outra. Eevee ainda conserva a própria ação.",
                    "Encerre uma forma Max antes de uma captura comum. Uma captura depois de raid precisa seguir o formato combinado. Depois de conseguir, registre o novo parceiro no PC."
                ],
                "auditCase": "capture"
            },
            {
                "id": "4.3",
                "title": "Hora de descansar",
                "plain": "Depois dos desafios, cuide da equipe! Descansar ou visitar um Centro Pokémon ajuda seus parceiros a seguir viagem.",
                "body": "HP, PP, condições e itens gastos acompanham seus Pokémon. Encerrar uma sessão não restaura esses recursos. Trocar de cena, de parceiro ou de fase também não os recupera.",
                "bullets": [
                    "Descanso curto: são dez minutos em segurança. Um Pokémon consciente recupera um quarto do HP máximo, arredondado para baixo, com mínimo de 1 e sem passar do máximo. Pode fazer isso uma vez entre descansos completos. Não recupera PP, não cura condições e não renova proteção. O uso fica registrado mesmo que você troque de fase ou de Pokémon.",
                    "Descanso completo: são oito horas em segurança ou atendimento completo num Centro Pokémon. Recupera HP e PP, trata condições comuns e permite outro descanso curto. Não devolve itens consumidos, dinheiro, Balls, Amizade ou a proteção da mesma batalha.",
                    "Antes do descanso: conclua a rodada e use Encerrar batalha. Mudar só a fase não basta. Termine as transformações, inclusive Transform, e as cópias temporárias de movimentos. Ferimentos da história precisam dos cuidados que o grupo combinou."
                ],
                "example": "Depois de enfrentar um Pidgey, Eevee ficou com pouco HP. Você encerra a batalha e encontra um lugar seguro. Uma pausa curta pode devolver um pouco de HP; para recuperar também PP e tratar condições, é preciso um descanso completo ou atendimento completo num Centro Pokémon.",
                "context": "Numa pausa segura de dez minutos, Eevee consciente pode recuperar parte do HP uma vez antes do próximo descanso completo. Para recuperar também PP e tratar condições, é preciso um descanso completo de oito horas ou atendimento completo num Centro Pokémon.",
                "steps": [
                    "Termine as vezes dos Pokémon e use Encerrar batalha. Depois, confirme com o Narrador que Eevee encontrou um lugar seguro para descansar.",
                    "Uma pausa curta dura dez minutos e ajuda um Pokémon que ainda não desmaiou a recuperar parte do HP. Ela não devolve PP, não cura a condição e não pode ser repetida até outro descanso completo.",
                    "Um descanso completo dura oito horas em segurança; atendimento completo num Centro Pokémon também serve. Ele recupera HP e PP e trata condições comuns.",
                    "Antes de descansar, termine transformações e cópias temporárias. Itens consumidos, dinheiro, Balls, Amizade e proteção gasta não voltam só porque o grupo descansou. Ferimentos da história precisam dos cuidados combinados."
                ],
                "auditCase": "rest"
            },
            {
                "id": "4.4",
                "title": "Itens e Pokédólares",
                "plain": "Guarde o que ganhar e marque o que gastar. Assim, você sempre sabe o que ainda pode levar para a aventura.",
                "body": "Use a bolsa para acompanhar itens e Pokédólares. Um item consumido só volta se uma regra permitir recuperá-lo ou se você conseguir uma reposição. O Narrador pode corrigir um registro errado; essa correção não cria outra recompensa.",
                "example": "Seu Treinador usou a última Potion para cuidar de Pikachu. O grupo anota que o item foi gasto e confirma a cura com o Narrador. Antes de usar outra Potion, será preciso conseguir uma reposição; encerrar a cena não cria outra na bolsa.",
                "context": "O assistente controla as Balls que foram registradas para captura. Outros usos narrativos de item precisam ser anotados pelo grupo; a tela não deve prometer uma retirada automática de Potion que não executa.",
                "steps": [
                    "Se o Treinador usou uma Potion em Pikachu, anote esse gasto e o efeito confirmado pelo Narrador. Um item consumido precisa ser reposto ou recuperado por uma regra.",
                    "O assistente de Captura controla a quantidade de Balls registrada na bolsa. Não atribua esse controle automático a outros itens que não foram registrados por uma ferramenta.",
                    "Pokédólares e recompensas também acompanham o que foi ganho ou gasto. Corrigir uma anotação errada não cria uma segunda compra ou recompensa."
                ]
            }
        ]
    },
    {
        "id": "criacao",
        "number": 5,
        "title": "Conheça seus parceiros",
        "summary": "Prepare fichas, escolha movimentos e acompanhe a história de cada Pokémon.",
        "rules": [
            {
                "id": "5.1",
                "title": "Seu Treinador, sua história",
                "plain": "Que tipo de aventura seu Treinador quer viver? Comece com uma ideia e deixe a história crescer com o grupo.",
                "body": "Escolha nome, aparência, origem, objetivo e pessoas importantes para seu Treinador. Essas ideias ajudam a definir suas especialidades e suas decisões. Ele pode descobrir novos sonhos pelo caminho.",
                "example": "Sua Treinadora sonha em conhecer Lapras. Esse desejo pode levá-la a explorar o mar e conhecer novas pessoas. Escolha o que move seu personagem e deixe a jornada mudar seus planos naturalmente.",
                "context": "O desejo de encontrar Lapras é o objetivo da Treinadora, não uma promessa de que o Pokémon aparecerá. O Narrador prepara possibilidades e o grupo escolhe como explorar.",
                "steps": [
                    "Escolha o nome, a aparência e de onde veio a Treinadora que quer conhecer Lapras.",
                    "Conte por que esse encontro é importante e quem já faz parte de sua história. Isso ajuda o Narrador a preparar lugares, pessoas e desafios.",
                    "Encontrar Lapras é um desejo, não uma recompensa garantida. A Treinadora pode descobrir outros sonhos durante a jornada."
                ]
            },
            {
                "id": "5.2",
                "title": "Preparar a ficha de um Pokémon",
                "plain": "Escolha seu parceiro e prepare sua ficha. Você também pode começar pelo Gerador e ajustar o que precisar.",
                "body": "A ficha guarda quem é o Pokémon e o que ele viveu na jornada.",
                "bullets": [
                    "Dados do parceiro: espécie e forma, nível, natureza, habilidade, gênero, tipos, IVs, EVs e até quatro movimentos. Em Jogos, use as opções daquela edição. No RPG, o jogo escolhido define os movimentos; atributos, tipos e habilidades usam a referência atual. Livre permite criar exceções de propósito.",
                    "Detalhes da jornada: anote item, Poké Ball, Treinador original, Amizade e o que aconteceu com esse parceiro.",
                    "Atributos: o MyOwnDex faz as contas. Se o grupo combinar um valor personalizado, deixe essa escolha anotada. Uma transformação de batalha não apaga a ficha de origem."
                ],
                "example": "Você conheceu um Eevee e lhe deu o apelido de Amora. Guarde o apelido e o lugar onde se encontraram na ficha. Essa história continua com Amora na equipe, na Box ou em outra aventura.",
                "context": "Na ficha de Amora, o apelido e a história acompanham a espécie, os movimentos e o Treinador original. Guardá-la na Box não cria um Eevee novo.",
                "steps": [
                    "Na ficha de Eevee, registre o apelido Amora e onde vocês se conheceram.",
                    "Confira espécie, forma, nível, natureza, habilidade, tipos, treinamento e movimentos no jogo de referência escolhido. O aplicativo monta os atributos.",
                    "Amora pode levar até quatro movimentos; se aprender outro, escolha qual sai. Guardar a ficha na Box conserva a identidade do parceiro.",
                    "Em Jogos, respeite a edição escolhida. No RPG, o jogo escolhido orienta o repertório. Livre permite exceções conscientes e registradas, sem apresentá-las como regra oficial."
                ]
            },
            {
                "id": "5.3",
                "title": "Escolher os movimentos",
                "plain": "Seu Pokémon leva até quatro movimentos para a batalha. Escolha os que combinam com ele e com o jogo de referência.",
                "body": "Quando aprender outro movimento, escolha qual sai. Trocar os movimentos não dá outra ação nem recupera PP durante a batalha.\n\nConsulte o repertório do jogo escolhido. Jogos anteriores continuam disponíveis. Gerar Pokémon e Adicionar à Box usam a mesma seleção automática de movimentos aprendidos por nível. A opção automática procura o jogo mais recente com esse aprendizado. Uma escolha explícita de jogo continua valendo para aquele jogo.\n\nNv. 1 e Ao evoluir são aprendizados diferentes. Movimentos de evolução, Máquina, Tutor, Ovo ou Treinamento não entram como aprendizado comum automático. Em Champions, escolha os movimentos por treinamento na ficha. O movimento mantém nome original, alvos, precisão, PP, tipo e efeitos. Deixe exceções combinadas anotadas.",
                "example": "Um Pokémon só aprende movimentos que realmente pode obter no jogo escolhido. Em Scarlet/Violet, Combusken pode receber Double Kick ao evoluir de Torchic. Na ficha, “Ao evoluir” indica esse momento; não significa que todo Combusken aprende o golpe no nível 1.",
                "context": "Em Scarlet/Violet, a indicação “Ao evoluir” diz quando Torchic pode receber Double Kick ao se tornar Combusken. Não trate isso como movimento aprendido automaticamente no nível 1 em qualquer jogo.",
                "steps": [
                    "Escolha o jogo antes de conferir como Torchic aprende seus movimentos. O aprendizado pode mudar de uma edição para outra.",
                    "Em Scarlet/Violet, Double Kick pode aparecer para Combusken como Ao evoluir. Isso marca a evolução de Torchic; não transforma o golpe em aprendizado inicial.",
                    "O Gerador e Adicionar à Box usam o mesmo critério de aprendizado por nível. TM, Tutor, Ovo, evolução e treinamento não devem entrar como se fossem aprendizado comum por nível.",
                    "Ao aprender um movimento para a ficha, confirme sua origem. Trocar o repertório durante a batalha não devolve PP nem oferece outra ação. Em Champions, a escolha por treinamento é feita na ficha."
                ]
            },
            {
                "id": "5.4",
                "title": "Crescer e evoluir",
                "plain": "Seu parceiro pode subir de nível e evoluir. Ele continua sendo o mesmo Pokémon, com sua história e suas escolhas.",
                "bullets": [
                    "Níveis: ao subir, desconte a meta de XP e guarde a sobra. Uma recompensa pode dar mais de um nível. Os EVs usam toda a XP recebida, uma vez só. O limite padrão é nível 100; uma exceção em Livre pode combinar outro limite, até 200. No limite, guarde a XP sem criar mais níveis. Subir de nível não acorda um Pokémon com 0 HP.",
                    "Evolução: pode pedir nível, item, Amizade, troca, lugar, horário ou outra condição. Preserve a ideia dos jogos; o grupo pode criar um momento equivalente na história.",
                    "Seu parceiro continua com apelido, vínculo, histórico, PP, condição e escolhas registradas. Evoluir não apaga isso.",
                    "Amizade: muda pelos acontecimentos da regra 5.5. Não aumenta automaticamente ao ganhar XP, subir de nível ou terminar a sessão."
                ],
                "example": "Machoke pode evoluir para Machamp por troca. A aparência muda, mas o Pokémon continua sendo o mesmo companheiro: apelido, lembranças e progresso não desaparecem. Confira as condições de cada evolução antes de realizá-la.",
                "context": "Machoke precisa cumprir a condição de evolução por troca. Ao se tornar Machamp, mantém apelido, vínculo, PP e condições registrados; a evolução não é uma cura gratuita.",
                "steps": [
                    "Confira a condição que permite a Machoke evoluir para Machamp. Evolução pode depender de troca, item, vínculo, lugar ou outra condição própria.",
                    "O parceiro mantém o apelido, a história, os PP e a condição registrada. Evoluir ou ganhar um nível não acorda um Pokémon desmaiado.",
                    "Quando a XP permitir crescer, o aplicativo guarda a sobra e os EVs recebidos. No limite do modo escolhido, a experiência pode continuar guardada sem criar outro nível.",
                    "Ganhar XP, evoluir ou terminar uma sessão não aumenta a Amizade automaticamente."
                ],
                "auditCase": "xp"
            },
            {
                "id": "5.5",
                "title": "Amizade e confiança",
                "plain": "Cuidar, confiar e viver grandes momentos juntos fortalece o vínculo com seu Pokémon.",
                "body": "O Narrador pode dar +5 por um cuidado significativo, +10 por um marco e +20 por uma grande virada. +50 fica para um acontecimento excepcional. Cuidados do dia a dia somam no máximo +10 por sessão; grandes marcos diferentes não entram nesse limite. Conte cada acontecimento uma vez.\n\nDesmaiar, perder ou falhar não reduz a Amizade automaticamente. Uma perda de confiança precisa fazer sentido na história e ser conversada. Evoluções usam o valor original, de 0 a 255. A Amizade não dá salvamentos, críticos ou ações extras sem uma regra que permita isso.",
                "example": "Pikachu tem medo de atravessar uma ponte. O Treinador o acompanha com cuidado, e o Narrador pode reconhecer esse momento na Amizade entre os dois. Subir de nível ou terminar a sessão, por si só, não aumenta a Amizade.",
                "context": "A Amizade entre Pikachu e seu Treinador depende dos acontecimentos da história. O Narrador decide o reconhecimento desse cuidado; subir de nível sozinho não concede pontos.",
                "steps": [
                    "Antes da ponte, Pikachu precisa de apoio do Treinador. Narrem o cuidado que realmente aconteceu.",
                    "O Narrador pode reconhecer esse acontecimento nos controles de Amizade. Um cuidado cotidiano, um marco importante e uma virada excepcional não são a mesma coisa.",
                    "Conte cada acontecimento uma vez. Repetir o botão não cria novas lembranças, e os cuidados cotidianos têm um limite por sessão.",
                    "Desmaiar, perder ou falhar não diminui a confiança automaticamente. Uma perda de vínculo precisa fazer sentido na história e ser conversada; Amizade não cria críticos ou ações extras por conta própria."
                ]
            }
        ]
    },
    {
        "id": "condicoes",
        "number": 6,
        "title": "Condições e cuidados",
        "summary": "Acompanhe o que afeta seu parceiro e descubra como ajudá-lo.",
        "rules": [
            {
                "id": "6.1",
                "title": "Queimadura, paralisia, sono e outras condições",
                "plain": "Uma condição pode mudar o que seu Pokémon consegue fazer. Acompanhe o efeito e cuide dele quando puder.",
                "body": "Um Pokémon tem uma condição principal por vez. Antes de agir, o jogo verifica seu efeito uma vez por tentativa, e não por alvo ou impacto. Se a condição impedir a ação, a vez é usada, mas não se gasta PP. Estas durações e chances são as usadas no RPG.",
                "bullets": [
                    "Queimadura: o dano físico cai pela metade, salvo Guts ou Facade. No fim da rodada, perde uma parte em 16 do HP máximo.",
                    "Paralisia: a Velocidade cai pela metade, salvo Quick Feet. Antes de agir, há 1 em 8 de chance de perder a ação. Não se cura sozinha.",
                    "Sono: impede 1 ou 2 oportunidades de agir. Há 1 em 3 de chance de acordar antes da segunda; se isso não acontecer, acorda antes da terceira. Trocar de Pokémon guarda essa contagem. Rest tem duração própria; Early Bird reduz a duração; Snore e Sleep Talk permitem agir dormindo.",
                    "Congelamento: antes de agir, há 25% de chance de descongelar. Se não acontecer nas duas primeiras oportunidades, descongela antes da terceira. Um movimento que descongela o usuário dispensa o teste. Dano do tipo Fire (Fogo) e efeitos próprios de descongelar também removem a condição.",
                    "Veneno: no fim da rodada, perde uma parte em 8 do HP máximo. No envenenamento grave, começa em uma parte em 16 e aumenta mais uma parte em 16 por rodada, até 15 partes em 16. Trocar reinicia esse aumento, mas não cura o veneno."
                ],
                "example": "Jigglypuff usa Sing em Eevee. Se o movimento acertar e Eevee adormecer, talvez não consiga usar Tackle na sua vez. O MyOwnDex mostra o sono e não gasta PP do golpe que Eevee não conseguiu usar.",
                "collapsibleDetails": true,
                "context": "Sing precisa funcionar para causar sono. As regras do RPG dizem quando Eevee poderá acordar; enquanto não conseguir agir, ele não gasta PP do movimento impedido.",
                "steps": [
                    "Jigglypuff tenta Sing contra Eevee. Só se o efeito funcionar é que Eevee fica dormindo.",
                    "Quando chegar a vez de Eevee tentar Tackle, o aplicativo confere o sono antes do movimento. Se ele não puder agir, passa a vez sem gastar os PP de Tackle.",
                    "Queimadura: pode enfraquecer o dano físico e tirar HP quando todos terminam suas vezes e a rodada é encerrada. Guts e Facade mantêm suas exceções.",
                    "Paralisia: atrapalha a Velocidade e pode impedir uma tentativa de agir. Sono e congelamento também têm sua própria verificação de recuperação; trocar não apaga a contagem de sono.",
                    "Veneno: é verificado ao encerrar a rodada, depois das vezes dos participantes. O envenenamento grave pode piorar com o tempo; trocar reinicia esse aumento, mas não cura a condição.",
                    "Uma condição principal ocupa seu próprio espaço na ficha. Não repita a verificação para cada alvo de um mesmo movimento. Rest, Early Bird, Snore, Sleep Talk, Quick Feet e movimentos que descongelam respeitam suas descrições."
                ],
                "auditCase": "sleep"
            },
            {
                "id": "6.2",
                "title": "Veneno, clima e outros efeitos",
                "plain": "Veneno e clima podem tirar HP aos poucos. O MyOwnDex mostra o resultado de cada rodada e lembra os efeitos que continuam ativos.",
                "body": "Alguns efeitos tiram uma quantidade tão pequena de HP que ela não chega a um ponto inteiro. Se todos esses efeitos tirassem sempre 1 HP, ficariam fortes demais. Por isso, o MyOwnDex usa a parte inteira do dano e sorteia se há mais 1 HP a perder.\n\nA quantidade de HP vem do efeito que está ativo e do HP máximo do Pokémon. O aplicativo aplica a parte inteira que couber e sorteia apenas a parte que resta. O caso de Pikachu identifica a ficha e mostra resultados produzidos por esse cálculo. Não existe saldo escondido para cobrar depois.\n\nO resultado é sorteado uma vez, quando o efeito acontece. Consultar a prévia ou abrir o Diário não sorteia outra vez. Se perder 0 HP, o Pokémon ainda está afetado pela condição, e nenhuma proteção foi gasta. Imunidades, custos e momentos próprios de cada efeito continuam valendo.\n\nEm Dynamax e Gigantamax, esses efeitos proporcionais comuns usam o HP máximo de antes da transformação, salvo quando uma regra disser outra coisa. Essa maneira de lidar com números inteiros é uma adaptação do RPG.\n\nExemplo conferido da regra: o Pikachu do caso tem 3 HP máximos na escala do RPG. O veneno comum vale um oitavo desse máximo no fim da rodada. Com um dado de oito faces, resultados 1, 2 ou 3 tiram 1 HP; os outros não tiram HP naquela rodada. Mesmo no segundo resultado, Pikachu continua envenenado. Isto não é um valor fixo para outros Pokémon.",
                "example": "Em Scarlet/Violet, Ekans usa Poison Sting contra Pikachu. Se acertar e conseguir envenená-lo, o veneno continua depois do golpe. Pikachu e os outros Pokémon têm suas vezes; quando todos terminam, o Narrador escolhe Encerrar rodada. O aplicativo aplica o veneno nesse momento. Mesmo sem perder HP nessa aplicação, Pikachu continua envenenado.",
                "collapsibleDetails": true,
                "context": "Tyranitar com Sand Stream pode criar uma tempestade de areia. Ao encerrar a volta da batalha, Pikachu exposto também pode sofrer esse efeito; Tyranitar é protegido por seu tipo Rock. Veneno e clima são conferidos separadamente.",
                "steps": [
                    "Na cena, Ekans usa Poison Sting e consegue envenenar Pikachu. O impacto do golpe e o veneno que continua depois são acontecimentos diferentes.",
                    "Pikachu ainda terá sua vez, e os demais Pokémon também terão as deles. Quando todos terminarem, o Narrador escolhe Encerrar rodada. É nesse momento que o veneno é aplicado.",
                    "Na escala pequena do RPG, o veneno nem sempre tira HP naquela aplicação. Se o registro mostrar que Pikachu não perdeu HP, ele continua envenenado. Isso não o curou e não cria uma cobrança escondida para depois.",
                    "Tempestade de areia, queimadura e outros efeitos são conferidos separadamente, com suas imunidades. Tyranitar com Sand Stream pode criar areia; ele não sofre esse dano por ser Rock, enquanto Pikachu exposto pode sofrer.",
                    "Abrir o Diário apenas relê o resultado guardado. Dynamax e Gigantamax usam o HP de antes da transformação para esses efeitos comuns, salvo uma exceção própria.",
                    "O caso conferido abaixo foi executado no núcleo do aplicativo. Ele identifica as fichas, o impacto de Poison Sting e os resultados de encerrar a rodada."
                ],
                "auditCase": "poison"
            },
            {
                "id": "6.3",
                "title": "Recuperar HP",
                "plain": "Um movimento de cura ajuda seu Pokémon a recuperar HP, até o máximo que ele pode ter.",
                "body": "Uma cura comum não revive um Pokémon desmaiado; isso precisa de uma regra que permita. Drenagem recupera HP; recuo é o dano que o próprio usuário recebe ao usar certos movimentos. Os dois usam o dano que realmente foi aplicado. Drenagem, recuo e curas baseadas no HP seguem a regra 6.2; o MyOwnDex faz essas contas.\n\nUma escolha com custo de HP, como Substitute, custa pelo menos 1 HP e exige poder pagar esse custo. Um resultado 0 não dá o benefício de graça. Curar HP não devolve PP, itens ou proteção por conta própria.",
                "example": "Bulbasaur aprendeu Giga Drain por TM. Se usar esse movimento e tirar HP de Eevee, poderá recuperar parte do próprio HP. Isso não devolve PP nem ultrapassa o HP máximo. Uma cura comum também não revive um Pokémon desmaiado.",
                "context": "Se Bulbasaur aprendeu Giga Drain pela TM disponível no jogo escolhido, ele pode recuperar HP depois de causar dano a Eevee. Um erro, uma imunidade ou dano 0 não gera recuperação a partir de dano inexistente.",
                "steps": [
                    "Bulbasaur aprendeu Giga Drain pela TM do jogo escolhido. Escolha Eevee como alvo quando chegar a vez de Bulbasaur.",
                    "Se o movimento retirar HP de Eevee, o painel pode recuperar HP de Bulbasaur a partir do dano que realmente aconteceu. Um erro ou uma imunidade não oferece energia para drenar.",
                    "A cura não ultrapassa o máximo e não revive um Pokémon desmaiado sem uma regra que permita. Ela também não devolve PP, itens ou proteção.",
                    "Recuo é o dano que certos movimentos causam ao próprio usuário. Uma escolha com custo de HP, como Substitute, precisa poder ser paga; um resultado arredondado não compra o benefício de graça."
                ]
            },
            {
                "id": "6.4",
                "title": "Fortalecer ou enfraquecer atributos",
                "plain": "Alguns movimentos ajudam seu parceiro a ficar mais forte. Outros atrapalham os atributos do adversário.",
                "body": "Use os estágios de −6 a +6 para Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, Precisão e Evasão. O MyOwnDex recalcula a partir do atributo original antes de dividir por 10.\n\nPrecisão e Evasão mudam a chance de acerto. Unaware e outras habilidades ignoram apenas os estágios que sua própria descrição manda ignorar.",
                "example": "Geodude enfrenta Eevee e usa Defense Curl para fortalecer a própria Defesa. Quando Eevee tentar Tackle, o MyOwnDex considera esse aumento. Confira os atributos na ficha; Defense Curl não cura HP.",
                "collapsibleDetails": true,
                "context": "Defense Curl aumenta a Defesa do próprio Geodude. Esse efeito é usado na próxima disputa que depender dela e termina quando uma regra mandar, sem recuperar HP.",
                "steps": [
                    "Na vez de Geodude, escolha Defense Curl para aumentar sua própria Defesa. O movimento não cura HP.",
                    "Quando Eevee usar Tackle, que é físico, a Defesa de Geodude entra na disputa. Não troque Defesa por Defesa Especial.",
                    "O aplicativo guarda os estágios, que são marcas temporárias de aumento ou redução. Precisão e Evasão mudam a chance de acertar; Unaware ignora apenas o que sua própria descrição permite."
                ]
            },
            {
                "id": "6.5",
                "title": "Confusão e hesitação",
                "plain": "Confusão e hesitação podem atrapalhar uma ação, mesmo quando seu Pokémon já tem outra condição.",
                "body": "São efeitos separados da condição principal, também chamados de efeitos voláteis. Cada um tem sua própria duração.",
                "bullets": [
                    "Confusão: Dura de 2 a 5 oportunidades próprias de agir; o Pokémon se recupera antes da última. Enquanto estiver confuso, há 1 em 3 de chance de perder a ação e se atingir com um ataque físico sem tipo de poder 40. Use seu próprio Ataque, Defesa, nível e estágios, sem STAB, efetividade, crítico ou disputa adicional. Esse dano encerra a proteção geral contra hit kill. Sturdy, Focus Sash e outras proteções só funcionam quando suas próprias regras permitem. Trocar encerra a confusão.",
                    "Hesitação: impede apenas a próxima ação da mesma rodada, se o Pokémon ainda não agiu. Trocar encerra o efeito."
                ],
                "example": "Em HeartGold/SoulSilver, Golbat usa Supersonic contra Pikachu. Se acertar, Pikachu fica confuso. Caso Pikachu também esteja envenenado, trocá-lo por Bulbasaur acaba com a confusão, mas não cura o veneno.",
                "collapsibleDetails": true,
                "context": "Supersonic tenta causar confusão, não veneno. Se Pikachu estiver envenenado ao mesmo tempo, esse veneno veio de outra causa e não desaparece quando a confusão termina.",
                "steps": [
                    "Golbat tenta Supersonic contra Pikachu. Se funcionar, a confusão é anotada separadamente da condição principal.",
                    "Quando Pikachu tentar agir, a confusão pode fazê-lo se atingir em vez de usar o movimento. O aplicativo usa os atributos dele para esse dano, sem inventar STAB, tipo ou crítico.",
                    "Esse dano no próprio Pokémon encerra a proteção geral de sobrevivência. Sturdy e Focus Sash só ajudam se suas regras específicas permitirem.",
                    "Trocar Pikachu por Bulbasaur termina a confusão de Pikachu. Se ele também estava envenenado, o veneno continua: Supersonic não foi a origem desse veneno.",
                    "Hesitação impede apenas a vez que o Pokémon ainda não usou naquela volta da batalha. Não tira uma vez que já passou e termina na troca."
                ]
            }
        ]
    },
    {
        "id": "recursos-pokemon",
        "number": 7,
        "title": "O que torna cada Pokémon especial",
        "summary": "Habilidades, itens, tipos e formas que fazem diferença na aventura.",
        "rules": [
            {
                "id": "7.1",
                "title": "As habilidades dos Pokémon",
                "plain": "Uma habilidade pode fazer a diferença na hora certa! Confira quando ela funciona e o que ela permite.",
                "body": "Habilidades podem agir ao entrar em campo, fazer contato, causar dano, mudar o clima ou chegar ao fim da rodada. A habilidade precisa estar ativa e a situação descrita precisa acontecer. Só estar escrita na ficha não basta.\n\nIntimidate, Download, habilidades de clima e terreno, Sturdy, Adaptability, Technician, absorções, recuperação e mudanças de Velocidade entram nos cálculos. Imposter e Illusion seguem suas próprias regras. O painel explica o efeito e mantém o texto de referência disponível. Se houver uma escolha de alvo, troca ou ordem, quem joga faz a escolha.",
                "example": "Gyarados entra no campo diante de Eevee com Intimidate ativa. A habilidade reduz o Ataque de Eevee, se ele puder ser afetado. O MyOwnDex mostra a mudança na ficha do adversário; só ter a habilidade escrita não a ativa em qualquer momento.",
                "context": "Intimidate acontece quando Gyarados entra em campo e a habilidade está ativa. Alguns adversários podem impedir ou ignorar a redução de Ataque por efeitos próprios.",
                "steps": [
                    "Coloque Gyarados em campo diante de Eevee com Intimidate ativa. Esse é o momento de verificar sua habilidade.",
                    "Se Eevee puder ser afetado, seu Ataque diminui. Se um efeito próprio o proteger, respeite essa proteção.",
                    "O painel mantém a descrição de cada habilidade. Intimidate não fica disponível para repetir a redução em qualquer momento só porque aparece na ficha.",
                    "Habilidades que pedem alvo, troca ou ordem deixam essa escolha com quem joga. Condições de entrada, contato, clima e fim da rodada são acontecimentos diferentes."
                ]
            },
            {
                "id": "7.2",
                "title": "Itens que acompanham seu parceiro",
                "plain": "Um item pode ajudar muito, mas alguns são consumidos. Acompanhe o que seu Pokémon ainda está segurando.",
                "body": "Itens podem estar ativos, consumidos, removidos, trocados ou recuperados. Um item consumido ou removido só funciona outra vez se alguma regra o devolver.\n\nBerries, itens de escolha, Life Orb, Leftovers, Focus Sash, Weakness Policy, Air Balloon, sementes, orbes e outros modificadores entram nos cálculos. Trick, Switcheroo, Knock Off, Thief, Covet, Fling, Recycle, Bug Bite, Pluck e Incinerate também atualizam o item.\n\nA Box guarda de quem era o equipamento. Um item original consumido continua consumido ao registrar o progresso. Uma troca temporária não muda o equipamento de origem na ficha; o consumo fica marcado na ficha de onde aquele item veio. Recycle ou uma reposição registrada pode devolvê-lo.",
                "example": "Depois de sofrer um Tackle de Pidgey, Eevee fica com pouco HP e consome a Oran Berry que segurava. A Berry ajuda a recuperar HP, mas fica gasta. Encerrar a batalha não devolve o item consumido.",
                "context": "A Oran Berry só é consumida quando seu efeito pode ser ativado. Ela recupera HP sem ultrapassar o máximo e não reaparece automaticamente depois da batalha.",
                "steps": [
                    "Eevee está segurando uma Oran Berry. Se o ferimento alcançar a condição de uso do item, a Berry pode recuperar HP e é consumida.",
                    "A recuperação respeita o máximo de Eevee. Encerrar a batalha não coloca outra Berry no lugar da que foi comida.",
                    "Acompanhe se o item está ativo, consumido, removido ou temporariamente trocado. Trick, Knock Off, Recycle e outros movimentos só fazem o que suas descrições permitem.",
                    "Registrar o progresso na Box conserva a origem e o gasto. Uma troca temporária de item não vira um equipamento novo de origem para cada parceiro."
                ]
            },
            {
                "id": "7.3",
                "title": "Variantes, formas e transformações",
                "plain": "Seu Pokémon pode ter uma aparência ou uma forma especial. Cada uma muda apenas o que sua regra permite.",
                "body": "Variantes regionais e outras variantes separadas são identidades diferentes. O mesmo parceiro não troca livremente entre elas. Diferenças só de aparência ficam agrupadas na Pokédex.\n\nFormas do mesmo Pokémon, Mega Evolution, Dynamax, Gigantamax e Terastallization seguem suas próprias regras. Transformar não dá outra ação nem recupera recursos por conta própria.\n\nTransform copia aparência, tipos atuais, habilidade, atributos que não são HP, estágios e movimentos com 5 PP. Mantém HP, nível, item e progresso do usuário. Ao voltar, a ficha original continua guardada.\n\nStance Change, Schooling, Shields Down, Zero to Hero, Hunger Switch, Gulp Missile, Zen Mode, Power Construct e Forecast mudam a forma em situações próprias. O painel mostra o que muda e o que permanece.",
                "example": "Venusaur está segurando Venusaurite; Blastoise é seu adversário. Numa batalha que permite Mega Evolução, o Treinador de Venusaur usa sua Key Stone para preparar Mega Venusaur. O parceiro muda de forma, mas conserva sua história e não recebe uma ação ou uma cura gratuita.",
                "context": "Mega Evolução precisa ser permitida naquele formato de batalha. Ela não está disponível em todos os jogos; a presença da pedra não libera a transformação em qualquer edição.",
                "steps": [
                    "Venusaur segura Venusaurite; Blastoise é o adversário. Numa batalha que permite Mega Evolução, a Key Stone do Treinador pode permitir Mega Venusaur.",
                    "Prepare a transformação no momento permitido pelo painel. Ela não cria outra ação nem devolve recursos por conta própria.",
                    "Uma variante regional identifica outro Pokémon: Vulpix de Kanto não vira Vulpix de Alola livremente. Uma transformação permitida do mesmo parceiro conserva sua história.",
                    "Transform mantém HP, nível, item e progresso do usuário, enquanto copia os elementos permitidos do alvo. Os movimentos copiados têm PP temporários.",
                    "Schooling, Stance Change e outras mudanças de forma dependem de suas próprias condições. Confira o que mudou antes de voltar a agir."
                ]
            },
            {
                "id": "7.4",
                "title": "Copiar ou chamar um movimento",
                "plain": "Alguns movimentos permitem usar outro movimento. A cópia só vira aprendizado permanente quando a regra diz isso.",
                "body": "Sketch aprende permanentemente o último movimento observado que seja válido, no lugar de Sketch, inclusive na ficha vinculada. Mimic faz uma cópia temporária com 5 PP; ao desfazê-la ou encerrar a cena, voltam o movimento e os PP anteriores.\n\nMetronome, Copycat, Assist, Sleep Talk, Nature Power, Mirror Move, Me First e Instruct pedem o movimento que será usado. Só a escolha original gasta PP. O movimento chamado usa a mesma ação e a mesma vez; sua prioridade não cria outro turno nem muda a iniciativa.",
                "example": "Eevee usa Tackle, e Bonsly usa Mimic para copiá-lo temporariamente. Quando o efeito termina, Bonsly volta a ter Mimic. Copiar um movimento por um tempo não significa aprendê-lo para sempre.",
                "context": "Mimic usa uma cópia temporária com PP próprios. Sketch, por outro lado, pode ensinar um movimento de modo permanente quando a cópia é válida.",
                "steps": [
                    "Eevee acabou de usar Tackle. Na vez de Bonsly, Mimic pode copiar esse último movimento válido do alvo.",
                    "A cópia é temporária e tem seus próprios PP. Ao terminar o efeito, Bonsly volta a ter Mimic e os PP que estavam guardados.",
                    "Sketch é diferente: pode registrar um aprendizado permanente válido, inclusive na ficha vinculada. Não trate Mimic como se fosse Sketch.",
                    "Movimentos como Metronome e Sleep Talk podem pedir a escolha do movimento chamado. Eles usam a mesma ação e o PP da escolha original, sem ganhar outra prioridade ou outro turno."
                ]
            },
            {
                "id": "7.5",
                "title": "Tipos, fraquezas e transformações",
                "plain": "Conhecer os tipos ajuda a escolher seu próximo movimento. Fraquezas, resistências e imunidades fazem diferença!",
                "body": "Use os tipos atuais do alvo. Uma imunidade mantém o dano em 0, salvo um efeito que a remova.",
                "bullets": [
                    "Efetividade: uma resistência deixa metade do dano; duas deixam um quarto. Um acerto neutro mantém o dano. Uma fraqueza dobra; duas multiplicam por 4. Uma fraqueza e uma resistência se equilibram e mantêm o dano.",
                    "STAB: é o bônus de usar um movimento do próprio tipo. Normalmente, multiplique o dano por 3 e divida por 2.",
                    "Terastallization: o bônus vale para um tipo original ou para o tipo Tera. Se o movimento corresponder aos dois, o bônus dobra o dano. Adaptability ajusta o bônus quando está ativa.",
                    "Clima e terreno: sol, chuva e terrenos têm seus próprios efeitos. O resultado mostra cada um separadamente."
                ],
                "example": "Bulbasaur usa Vine Whip contra Geodude de Kanto e aproveita suas fraquezas. Thunder Shock de Pikachu não causa dano nesse mesmo alvo, porque o tipo Ground (Terra) o torna imune. A forma de Alola tem tipos diferentes: confira qual Geodude está na ficha.",
                "collapsibleDetails": true,
                "context": "A forma muda a resposta: Geodude de Kanto é Rock/Ground e é imune a Electric. Geodude de Alola é Rock/Electric e resiste a Thunder Shock, mas não tem aquela imunidade.",
                "steps": [
                    "Confira qual Geodude está em campo e quais tipos ele tem agora. O de Kanto tem Ground; o de Alola tem Electric em seu lugar.",
                    "Vine Whip de Bulbasaur aproveita as fraquezas de Geodude de Kanto. Thunder Shock de Pikachu não causa dano nesse alvo por causa da imunidade de Ground.",
                    "Um movimento do próprio tipo do usuário pode receber o bônus chamado STAB. Tackle de Bulbasaur continua Normal e não recebe esse bônus por Bulbasaur ser Grass/Poison.",
                    "Terastallization, clima, terreno e habilidades podem mudar os bônus aplicáveis. O resultado registra os efeitos; não ignore uma imunidade só porque outro bônus é grande."
                ]
            },
            {
                "id": "7.6",
                "title": "O que acontece depois da escolha",
                "plain": "Depois de escolher um movimento e um alvo, acompanhe o resultado. O MyOwnDex resolve cada ação uma vez.",
                "body": "O jogo confere se a ação é permitida e se alguma condição impede agir. Depois verifica a disputa, quando houver, a precisão e as imunidades. Calcula o dano e as proteções, aplica dano, efeitos secundários, contato, custos, cura e nocaute. O Diário guarda o resultado.\n\nVocê continua escolhendo alvo, troca ou movimento chamado quando a regra permite. Um crítico só vale depois de acertar. Shield Dust, Covert Cloak e Sheer Force mudam efeitos secundários; não apagam efeitos principais nem custos do usuário.",
                "example": "Pikachu usa Thunder Shock em Eevee e o resultado fica no Diário. Reabrir o registro só mostra o que já aconteceu; não causa outro dano e não gasta mais PP. Você escolhe a ação; o MyOwnDex cuida para resolvê-la uma vez.",
                "context": "O Diário é só para consultar uma ação já resolvida. Só uma nova ação válida pode produzir outro ataque, gastar mais PP ou mudar novamente o HP do alvo.",
                "steps": [
                    "Escolha Thunder Shock e Eevee como alvo. O aplicativo confere se Pikachu pode agir antes de gastar os recursos da tentativa.",
                    "Depois são conferidos disputa, precisão, imunidades e o que o movimento realmente permite. O Diário guarda dano, efeitos e gastos confirmados.",
                    "Reler esse registro não aplica outro ataque. Uma tentativa nova precisa de sua própria vez e dos recursos necessários.",
                    "Shield Dust, Covert Cloak e Sheer Force podem alterar efeitos secundários, sem apagar os custos ou os efeitos principais por conta própria."
                ],
                "auditCase": "damage"
            },
            {
                "id": "7.7",
                "title": "Dynamax e Gigantamax",
                "plain": "Pikachu pode ficar gigante por um tempo numa batalha que permita Dynamax. O HP aumenta enquanto a transformação dura, sem apagar ferimentos.",
                "body": "Prepare a transformação antes da iniciativa. Ela não refaz uma ordem já rolada e não dá outra ação. Dynamax e Gigantamax compartilham um uso por Treinador em cada batalha e terminam ao trocar de Pokémon.",
                "bullets": [
                    "HP: o nível Dynamax vai de 0 a 10. No nível 10, o HP dobra. Nível 0 também é válido. A permissão de usar Dynamax é uma escolha separada do nível Dynamax.",
                    "Conta do HP: some 30 ao nível Dynamax. Multiplique o HP por esse resultado, que vai de 30 a 40, e divida por 20. Arredonde o máximo para baixo e aumente o HP atual na mesma proporção inteira, sem curar o dano que já havia. A ficha mostra o HP de antes e o HP Max.",
                    "Ao terminar: entrar e sair sem receber dano ou cura conserva exatamente o HP de entrada. Se o HP mudou, o jogo converte a mudança de volta e arredonda para baixo. Um Pokémon consciente fica com pelo menos 1 HP; um desmaiado continua com 0.",
                    "Gigantamax: usa o mesmo aumento de HP e exige o fator Gigantamax e uma espécie compatível. Shedinja fica com 1 HP. Zacian, Zamazenta e Eternatus não usam Dynamax comum. Eternamax tem atributos próprios; não é só dobrar o HP.",
                    "Movimentos: ataques viram Max Moves com prioridade 0; movimentos de status viram Max Guard com prioridade 4. Gastam PP do movimento original e usam efeitos próprios. Não copiam recuo, múltiplos acertos ou efeitos secundários do original.",
                    "Proteções e efeitos: não sofrem hesitação, nocaute direto, Low Kick, Grass Knot, Heavy Slam ou Heat Crash. Roar e Whirlwind falham. Efeitos percentuais comuns usam o HP máximo de antes da transformação."
                ],
                "example": "Em Pokémon Sword/Shield, Pikachu participa de uma batalha em que Dynamax é permitido. Antes da iniciativa do RPG, seu Treinador prepara a transformação. Pikachu fica enorme e ganha HP temporário, mas os ferimentos anteriores continuam contando.",
                "collapsibleDetails": true,
                "context": "Ao voltar ao tamanho normal, Pikachu conserva o efeito dos ferimentos que sofreu. A transformação não reinicia a rodada, não repõe PP nem dá uma nova ação.",
                "steps": [
                    "Na batalha permitida de Sword/Shield, prepare Dynamax de Pikachu antes de rolar a iniciativa. O nível Dynamax pertence à ficha; ter esse nível não substitui a permissão de transformar.",
                    "A ficha mostra HP normal e HP Max. Pikachu fica maior, mas o dano que já havia continua contando. Ao voltar sem dano ou cura no meio, conserva exatamente o HP com que entrou.",
                    "Dynamax dura três voltas completas da batalha: cada Pokémon tem sua vez em cada volta. O contador avança quando o grupo escolhe Encerrar rodada; trocar também termina a transformação.",
                    "Ataques se tornam Max Moves, e movimentos de apoio se tornam Max Guard. Eles usam PP do movimento original, com os próprios efeitos e prioridades.",
                    "Gigantamax exige espécie e fator compatíveis. Shedinja conserva seu HP especial; Zacian, Zamazenta e Eternatus não recebem Dynamax comum. Eternamax é uma forma própria.",
                    "As imunidades de Max a hesitação, nocaute direto, golpes de peso e expulsões específicas continuam valendo. O caso conferido mostra a entrada e a volta de um Pikachu de teste."
                ],
                "auditCase": "max"
            }
        ]
    },
    {
        "id": "mesa",
        "number": 8,
        "title": "Jogar em grupo",
        "summary": "Conte suas ideias, ajude seus amigos e encontrem novos caminhos juntos.",
        "rules": [
            {
                "id": "8.1",
                "title": "Narrador e jogadores",
                "plain": "A aventura é de todo o grupo. Cada pessoa participa das escolhas e ajuda a história a seguir em frente.",
                "body": "O Narrador apresenta o mundo, acompanha a cena e ajuda a resolver dúvidas. Cada jogador escolhe o que seu Treinador tenta fazer e cuida de seus Pokémon. Todos acompanham os mesmos registros da aventura.\n\nO Narrador confirma mudanças que afetam o grupo e anota exceções para todos saberem como jogar.",
                "example": "O Narrador descreve uma ponte quebrada. Uma jogadora propõe que Machop firme uma tábua; outra procura um caminho com Eevee. O grupo combina peso, apoio e riscos antes dos dados. Cada pessoa escolhe como ajudar, sem presumir que Machop aguenta qualquer carga.",
                "context": "Machop só firma a tábua que foi combinada, com peso e apoio avaliados. Procurar outra passagem com Eevee continua sendo uma escolha possível, não uma falha de participação.",
                "steps": [
                    "O Narrador apresenta a ponte quebrada. A jogadora de Machop propõe firmar uma tábua, não sustentar uma ponte inteira sem combinar peso e apoio.",
                    "A jogadora de Eevee pode procurar outra passagem. Cada pessoa escolhe as ações do próprio Treinador e de seus parceiros.",
                    "Antes dos dados, o Narrador combina riscos e consequências com o grupo. Exceções que afetarem todos ficam anotadas para a próxima situação parecida."
                ]
            },
            {
                "id": "8.2",
                "title": "O aplicativo ajuda; você escolhe",
                "plain": "O MyOwnDex cuida das contas. Você e seus amigos continuam escolhendo o que tentar e como viver a aventura.",
                "body": "O aplicativo resolve o que já tem uma resposta definida. Ideias criativas e consequências da história ficam com o grupo. Combine a ideia antes de rolar. Se houver uma exceção, anote no Diário para usá-la do mesmo jeito depois.",
                "example": "Um rival pede ajuda para encontrar seu Eevee. Seu Treinador decide se vai ajudar. O MyOwnDex registra ações e resultados, mas a escolha e as consequências fazem parte da história criada pelo grupo.",
                "context": "O grupo pode anotar no Diário que decidiu ajudar o rival. Isso preserva a consequência da escolha, sem entregar a decisão ao aplicativo.",
                "steps": [
                    "O rival pede ajuda para encontrar Eevee. Seu Treinador escolhe se vai acompanhá-lo e como pretende ajudar.",
                    "O aplicativo pode registrar a escolha e resolver os testes que tiverem uma resposta definida. Ele não escolhe a atitude do personagem.",
                    "As consequências da história ficam com o grupo. Anote uma exceção combinada no Diário para continuar usando o mesmo critério depois."
                ]
            },
            {
                "id": "8.3",
                "title": "E quando surgir uma dúvida?",
                "plain": "Se uma situação não estiver clara, conversem antes dos dados. O Narrador ajuda o grupo a encontrar uma resposta justa.",
                "body": "Quando duas explicações parecerem diferentes, confira nesta ordem:",
                "bullets": [
                    "Este Guia: use primeiro uma adaptação explícita do RPG. Ela vale para os dois lados e não muda só porque você consultou um jogo antigo.",
                    "Os jogos: quando o Guia não adapta a regra, use a regra oficial mais recente e corrigida disponível. Uma correção mais nova vale mais que um texto antigo. Consultar um jogo histórico não troca as regras do RPG sem combinar com o grupo.",
                    "Torneios: listas de Pokémon permitidos, banimentos, tiers e cláusulas de torneio não entram automaticamente na aventura. São regras de outros formatos.",
                    "Cada ação acontece uma vez: siga a ordem da regra 7.6. Uma exceção não devolve PP, HP, item ou turno sem dizer que devolve.",
                    "Dúvida que continua: o Narrador combina uma solução antes de rolar e anota. Aliados e oponentes seguem a mesma decisão na mesma situação. Não mude a regra depois de ver os dados."
                ],
                "example": "Bulbasaur quer puxar uma corda com Vine Whip. Antes de rolar, conversem sobre a distância e o risco. Depois, respeitem o que foi combinado, mesmo que os dados tragam um resultado inesperado.",
                "context": "Antes da rolagem, o Narrador e o grupo definem se Vine Whip alcança a corda, qual ajuda Bulbasaur pode oferecer e o que acontece se não conseguir.",
                "steps": [
                    "Antes de Bulbasaur usar Vine Whip para puxar a corda, confiram o alcance, o apoio e o que pode dar errado.",
                    "Uma adaptação explícita deste Guia vale no RPG. Quando não houver adaptação, usem a regra oficial mais recente e corrigida aplicável.",
                    "Se a dúvida continuar, o Narrador combina a resposta antes dos dados e a registra. O resultado não muda o combinado.",
                    "Aliados e oponentes seguem o mesmo critério. Regras de torneio, banimentos e tiers não entram automaticamente na aventura; uma exceção não devolve HP, PP, item ou ação sem permitir isso."
                ]
            },
            {
                "id": "8.4",
                "title": "A regra de ouro",
                "plain": "Explore, imagine, cuide e descubra com seus Pokémon. As melhores ideias podem abrir novos caminhos para a equipe!",
                "body": "Use o cenário, pense em defesas criativas e experimente combinações inesperadas. Conte o que sua ideia quer conseguir e combine como tentar antes dos dados.\n\nCriatividade não dá recursos ou ações extras sem uma regra ou uma exceção combinada. As mesmas escolhas e os mesmos limites valem para todos.",
                "example": "Eevee ajuda um Pikachu perdido a encontrar seus amigos. Essa conquista pode ser importante mesmo sem batalha. Escolhas criativas e cuidados podem fazer a aventura avançar, mas não dão poderes ou recompensas gratuitas.",
                "context": "Um resgate sem batalha pode valer uma conquista da história. O Narrador decide a recompensa ao concluir o desafio e não a repete para cada etapa da mesma tarefa.",
                "steps": [
                    "Eevee encontra Pikachu perdido e ajuda a guiá-lo de volta. Exploração e cuidado também podem ser o momento importante da aventura.",
                    "Conte o que seu parceiro tenta fazer e combine a consequência. Uma ideia tranquila pode funcionar sem dados; perigo real pode pedir uma tentativa.",
                    "Criatividade não oferece poderes, recursos ou ataques gratuitos. A recompensa reconhece o desafio concluído, sem se repetir para cada pequena etapa."
                ]
            },
            {
                "id": "8.5",
                "title": "Testes do Treinador",
                "plain": "Seu Treinador também pode investigar, escalar e ajudar. Role os dados quando houver uma dúvida importante e algo em jogo.",
                "body": "Diga o que quer fazer, o que atrapalha e o que pode acontecer. O Treinador rola 2d6; não usa atributos inventados de Pokémon. Uma ação tranquila não pede dados. Para uma ideia impossível, procure outro plano.\n\nUma especialidade da história, uma boa preparação ou uma ajuda útil pode dar vantagem. Um obstáculo importante pode dar desvantagem. Várias ajudas não acrescentam dados. Vantagem e desvantagem juntas usam Normal.\n\nO Narrador pode usar dificuldade 5 para uma situação favorável, 7 para uma exigente e 9 para uma muito difícil. O total precisa superar a dificuldade; empate não basta. O aplicativo mostra o resultado.",
                "example": "Seu Treinador procura pegadas de Eevee na lama. Se a chuva estiver apagando as marcas, o Narrador pode pedir um teste. Se não houver dificuldade nem perigo, basta dizer o que o Treinador encontrou.",
                "collapsibleDetails": true,
                "context": "Quando houver risco real, o Treinador usa a rolagem própria para investigar. Ele não pega os atributos de Eevee emprestados nem precisa testar tarefas sem dificuldade.",
                "steps": [
                    "O Treinador está procurando as pegadas de Eevee. O Narrador verifica se existe uma dúvida importante e o que acontece se a pista se perder.",
                    "Se houver risco, use o teste do Treinador nos Dados. Preparação pode ajudar, e um obstáculo importante pode atrapalhar; ele não usa os atributos de um Pokémon emprestado.",
                    "O Narrador escolhe a dificuldade antes da rolagem. O resultado precisa superar essa dificuldade; empate não basta.",
                    "Uma tarefa tranquila não exige uma sequência de testes. Para algo impossível, procure uma abordagem que possa funcionar."
                ]
            },
            {
                "id": "8.6",
                "title": "Tentar uma ideia diferente",
                "plain": "Quer usar um movimento de um jeito criativo? Conte seu plano e combine o que pode dar certo ou errado.",
                "body": "Improvisar pode dar vantagem, causar desvantagem ou mudar uma posição ou um objetivo. Antes dos dados, combinem o teste, o custo, o risco e quem será afetado. Em batalha, use a ação principal; se usar um movimento, gaste PP também.\n\nNo sucesso, escolha um benefício que combine com a ideia: vantagem ou desvantagem em um teste relacionado, ou uma mudança concreta de posição ou objetivo. O bônus no teste vale uma vez e acaba, no máximo, no fim da rodada seguinte.\n\nO improviso não junta dano completo com um bônus grátis, não acumula vantagem e não cria uma condição ou estágios permanentes sem a regra correspondente. Uma ideia tranquila não exige teste; uma impossível pede outro plano.",
                "example": "Bulbasaur quer alcançar uma corda com Vine Whip para ajudar a equipe a atravessar. O grupo combina o que é possível, o risco e o efeito da tentativa. Em batalha, isso usa a ação de Bulbasaur; não causa também o dano de um ataque gratuito.",
                "context": "O efeito combinado pode facilitar uma tentativa ou mudar a posição de alguém. Não acumula vantagens gratuitas nem se transforma em um ataque completo além do improviso.",
                "steps": [
                    "Antes de Bulbasaur alcançar a corda com Vine Whip, combinem o que ele pode alcançar, o risco, o custo e a ajuda que o sucesso oferece.",
                    "Na batalha, o improviso usa a vez de Bulbasaur e os PP do movimento empregado. Não vem junto de um ataque completo gratuito.",
                    "O sucesso pode facilitar uma tentativa relacionada ou mudar uma posição concreta. A ajuda para um teste é usada uma vez e não fica guardada indefinidamente.",
                    "Várias ajudas não acumulam dados. Uma ideia criativa não inventa uma condição ou estágios permanentes; respeite o cenário, o movimento e as regras próprias."
                ]
            },
            {
                "id": "8.7",
                "title": "Vamos ajudar uns aos outros",
                "plain": "Trabalhar em equipe pode alcançar um resultado maior. Cada participante ajuda de verdade e compartilha o risco.",
                "body": "Para ajudar uma pessoa numa tarefa, ela rola com vantagem se sua ajuda for útil. Ajudantes compartilham o risco e usam sua ação em batalha.\n\nNum plano em grupo, cada participante faz sua parte e testa o atributo adequado. Antes de qualquer dado, combinem quem participa, a tarefa de cada um, quais são indispensáveis, o resultado que buscam e o que pode dar errado. Uma tarefa indispensável precisa funcionar para o plano dar certo.\n\nUm sucesso numa tarefa que possa alcançar o objetivo comum já pode bastar, desde que as tarefas indispensáveis também funcionem. Se todos passam, não há custo por falha. Se alguém falha, o risco combinado avança 1 passo, como fazer barulho ou gastar mais tempo. Se pelo menos metade falha, avança 2 passos. Não cobre uma punição para cada pessoa.\n\nNão acrescente participantes depois de ver os resultados nem invente tarefas inúteis para diminuir o peso das falhas. Resolva o objetivo uma vez. Para tentar de novo, siga a regra 8.8.",
                "example": "Bulbasaur segura uma corda com as vinhas, enquanto Machop firma uma tábua. O grupo combina que as duas partes são necessárias. Se uma delas falhar, a travessia não fica pronta só porque a outra deu certo.",
                "collapsibleDetails": true,
                "context": "Se uma parte indispensável falhar, o grupo encara o risco combinado. Não é preciso punir Bulbasaur e Machop separadamente pela mesma falha coletiva.",
                "steps": [
                    "Bulbasaur segura a corda e Machop firma a tábua. Antes dos dados, o grupo define se cada parte é indispensável e o que a falha coloca em perigo.",
                    "Cada participante faz sua tarefa. Se uma parte indispensável falhar, outra pessoa ter feito bem a própria tarefa não completa a travessia.",
                    "O risco é compartilhado. O grupo sofre a consequência combinada para a tentativa, sem cobrar uma punição igual de cada pessoa.",
                    "Não acrescente gente depois de ver os dados só para diluir as falhas. Ajudar numa tarefa pode dar vantagem, mas a ajuda precisa servir para alguma coisa e usa a vez de quem ajuda em batalha.",
                    "O caso conferido mostra uma falha de Bulbasaur e um sucesso de Machop. Para tentar de novo, combinem a mudança de abordagem ou o novo custo."
                ],
                "auditCase": "group"
            },
            {
                "id": "8.8",
                "title": "Posso tentar de novo?",
                "plain": "Você pode tentar outra vez. Pense no que mudou e no que a próxima tentativa pode custar.",
                "body": "Uma falha muda a situação. Antes de tentar de novo, o Narrador explica o novo custo em tempo, recursos ou exposição ao perigo.\n\nSe você repetir imediatamente o mesmo plano sem uma mudança importante, use desvantagem quando ainda for possível continuar. Ela não se acumula. Preparar-se ou mudar de abordagem tira essa penalidade, mas não desfaz o perigo que já avançou.\n\nSe houver chance real de sucesso e nenhum custo ou risco, resolva o esforço sem uma sequência de rolagens repetidas. Essa regra não atrapalha ataques nem capturas comuns: eles já gastam ação, PP ou Balls e têm seus próprios riscos.",
                "example": "O Treinador não conseguiu mover uma pedra. Em vez de repetir a mesma tentativa sem mudar nada, pode pedir ajuda a Machop ou buscar outro caminho. Se insistir do mesmo jeito, o Narrador explica o novo risco antes de tentar.",
                "context": "Insistir imediatamente com o mesmo plano pode dar desvantagem. Pedir ajuda a Machop muda a abordagem, mas não desfaz o tempo ou os riscos já perdidos.",
                "steps": [
                    "A pedra não saiu do caminho. O Narrador explica o que mudou: pode ter passado tempo ou o perigo pode ter se aproximado.",
                    "Repetir imediatamente o mesmo esforço sem mudança importante pode trazer desvantagem. Ela não se acumula sem parar.",
                    "Pedir ajuda a Machop ou procurar uma ferramenta muda o plano, mas não desfaz o risco que já aconteceu.",
                    "Ataques e capturas comuns continuam seguindo seus próprios custos de vez, PP ou Balls; esta regra não acrescenta outra punição automática a eles."
                ]
            },
            {
                "id": "8.9",
                "title": "Fugir ou perseguir",
                "plain": "Às vezes, a melhor escolha é recuar. Combine a saída que a equipe procura e os riscos antes de rolar.",
                "body": "Declare Tentar fugir com prioridade 0. Na batalha, dispute Velocidade com quem impede a saída. Empate favorece quem bloqueia. No sucesso, deixe a cena de confronto; você não continua atacando de fora. Na falha, sua ação foi usada e os oponentes ainda podem agir. Efeitos que impedem fuga mantêm suas próprias exceções.\n\nNuma perseguição longa, use dois marcadores de 0 a 3: Fuga e Perigo. Faça uma disputa principal por rodada. Sucesso aumenta Fuga em 1; falha aumenta Perigo em 1. Outros personagens podem ajudar ou remover obstáculos com suas ações, sem criar outras disputas principais.\n\nQuando um marcador chegar a 3, conclua a saída ou a consequência combinada. Tentar outra vez não zera os marcadores.",
                "example": "Pikachu quer fugir de um encontro com Pidgey. Declare a fuga antes da iniciativa. Se Pikachu vencer a disputa para sair, o confronto termina para ele. Se falhar, usou sua vez e não pode escolher um ataque atrasado.",
                "context": "Se Pikachu escapar, deixa o confronto e não continua atacando à distância. Caso um movimento ou habilidade impeça a fuga, respeite essa condição antes de rolar.",
                "steps": [
                    "Antes da iniciativa, declare que Pikachu tentará fugir de Pidgey. Não espere descobrir a ordem para trocar essa escolha por um ataque.",
                    "Na vez de Pikachu, o aplicativo compara sua Velocidade com quem bloqueia a saída. Se conseguir, Pikachu deixa o confronto e não continua atacando de fora.",
                    "Se não conseguir, a tentativa usou sua vez. Movimentos e habilidades que impedem fuga continuam valendo.",
                    "Numa perseguição longa, o grupo combina a saída e o perigo e acompanha os marcadores Fuga e Perigo. Cada disputa principal avança o resultado correspondente; tentar outra vez não zera o que aconteceu."
                ],
                "auditCase": "chase"
            },
            {
                "id": "8.10",
                "title": "Desafios para toda a equipe",
                "plain": "Uma grande batalha deve dar a cada parceiro uma chance de ajudar. Preparação, apoio e boas ideias também fazem diferença!",
                "body": "Para o Narrador: um chefe usa as mesmas regras. Não dobre atributos, ações ou barras de HP só por ele ser um chefe. Prepare movimentos físicos e especiais, aliados, terreno e sinais de ataques importantes. Inclua objetivos como resgatar, proteger ou recuar.\n\nAntes de jogar, compare as duas defesas com os ataques da equipe. A fraqueza de tipo só muda o dano depois de acertar. Preserve a Defesa e ofereça caminhos claros: ataque especial, estágios, apoio, outro objetivo ou retirada. Não peça para repetir um ataque sem chance de funcionar.\n\nMudar a fase não cura, não devolve proteção e não dá outro turno. Uma raid, ou batalha especial em grupo, é um formato à parte: o grupo precisa conhecer antes as regras especiais, seus limites, de onde vêm e como responder a elas. Não existe um bônus universal de chefe.\n\nDurante a sessão, observe se todos conseguem escolher, agir e contribuir. Ajustar a aventura com pessoas jogando ajuda a perceber o que está divertido e o que precisa melhorar.",
                "example": "A equipe enfrenta um Golem de Kanto perto de uma encosta. Bulbasaur pode escolher Vine Whip, enquanto Pikachu usa sua vez para ajudar Eevee a sair de uma área de pedras soltas. A equipe pode atacar, proteger ou recuar, conforme o perigo.",
                "context": "Um chefe não ganha automaticamente HP ou turnos extras. Se a equipe não conseguir afetá-lo com determinado ataque, mostre opções de apoio, outro movimento, objetivo ou retirada.",
                "steps": [
                    "Prepare Golem com seus movimentos e defesas próprios. Ser chefe não lhe dá outra ação, cura escondida ou HP arbitrário.",
                    "Confira as opções reais da equipe: Bulbasaur pode tentar Vine Whip contra Golem, enquanto Pikachu usa sua vez para ajudar Eevee a sair das pedras soltas.",
                    "A fraqueza de tipo só melhora o dano depois de um ataque válido alcançar seu resultado. Se um caminho não puder funcionar, ofereça apoio, outro movimento, objetivo ou retirada compreensível.",
                    "Mudar uma fase da história não devolve proteção nem cria turno. Uma raid só usa regras especiais que o grupo conheceu antes, com limites e formas de resposta.",
                    "Observe as pessoas jogando: todos precisam conseguir escolher e contribuir. Os testes técnicos conferem funcionamento, não provam diversão ou compreensão por crianças."
                ]
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
