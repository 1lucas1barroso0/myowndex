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
                "example": "Pikachu tenta alcançar um Pidgey que está fugindo. Os dois disputam Velocidade; se empatarem, Pikachu ainda não o alcança.",
                "collapsibleDetails": true
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
                "example": "O Treinador tenta seguir as pegadas de Eevee antes de a chuva apagá-las. Como preparou um mapa da trilha, o Narrador dá vantagem na busca."
            },
            {
                "id": "1.3",
                "title": "Acertos e erros críticos",
                "plain": "Dois 6 podem deixar um acerto ainda melhor! Dois 1 podem trazer uma complicação para a cena.",
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
                "example": "Bulbasaur tenta alcançar uma corda com Vine Whip. Com um erro crítico, suas vinhas se prendem no galho errado. O grupo combina uma complicação que faça sentido para a cena."
            },
            {
                "id": "1.4",
                "title": "Testes de chance e efeitos extras",
                "plain": "Alguns movimentos podem errar ou causar um efeito extra. O MyOwnDex faz o sorteio e mostra o resultado.",
                "body": "1d100 é uma rolagem de 1 a 100. Se o resultado for igual ou menor que a chance, funciona. Com vantagem, faça duas tentativas e fique com a melhor; com desvantagem, fique com a pior. Quando a chance não cabe certinho no d100, o MyOwnDex usa um sorteio exato.\n\nUm ataque que vence a disputa ganha vantagem na precisão e nos efeitos secundários se a soma de seus dados mantidos for pelo menos 2 maior que a da defesa. Compare só os dados, sem os atributos. O aplicativo confere isso para você.",
                "example": "Pikachu acerta Thunder Shock em Eevee. Além de causar dano, esse movimento pode paralisar o alvo. O MyOwnDex mostra se isso aconteceu.",
                "collapsibleDetails": true
            },
            {
                "id": "1.5",
                "title": "Um pouquinho mais ou menos de dano",
                "plain": "Um golpe pode sair um pouco mais forte ou mais fraco. A diferença é pequena e sempre usa números inteiros.",
                "body": "Calcule o dano com seus modificadores e arredonde. Depois, role um d6 para cada impacto em cada alvo: de 2 a 5, o dano fica como está; com 1, diminui um passo; com 6, aumenta um passo.\n\nO passo é o dano-base dividido por 10, arredondado para baixo, com mínimo de 1. Dano-base 1 continua em 1. Depois aplique o limite comum de dano, salvo as exceções da regra do movimento. Esse limite pode cortar o aumento.\n\nCura, custos de HP, recuo, dano contínuo, dano fixo e dano baseado no HP não usam essa variação. O resultado é sorteado ao aplicar o impacto e fica registrado; consultá-lo outra vez não dá uma nova rolagem. Esta é uma adaptação do RPG.",
                "example": "Thunder Shock continua sendo o mesmo movimento de Pikachu. Ao atingir Eevee, pode sair um pouco mais forte ou mais fraco; o aplicativo mostra quanto HP mudou.",
                "collapsibleDetails": true
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
                "example": "Seu Pikachu pode ser mais veloz que outro Pikachu da equipe. A ficha considera as características e o treinamento de cada parceiro."
            },
            {
                "id": "2.2",
                "title": "Números menores para jogar",
                "plain": "No RPG, usamos números menores para facilitar as contas. O aplicativo faz essa conversão por você.",
                "body": "Divida o HP original por 8. Divida os outros atributos e o poder dos movimentos por 10. Escolha o inteiro mais próximo: se ficar exatamente no meio, o HP sobe e os outros valores descem. Shedinja continua com 1 HP.\n\nHP, dano, cura, XP, EVs e Amizade não ficam quebrados. STAB é o bônus de usar um movimento do próprio tipo. Para o bônus comum, multiplique por 3 e divida por 2 antes de arredondar. A regra 6.2 explica os efeitos pequenos.\n\nA Amizade usa a escala de 0 a 255 na ficha original. No RPG, divida por 10 e arredonde para baixo: o máximo é 25.",
                "example": "Ao mostrar a ficha de Bulbasaur na escala do RPG, o MyOwnDex usa números menores. Ele continua sendo o mesmo parceiro, com seus tipos, movimentos e história.",
                "collapsibleDetails": true
            },
            {
                "id": "2.3",
                "title": "Atributos que sobem e descem",
                "plain": "Um movimento pode aumentar ou diminuir um atributo durante a batalha. Cada mudança fica marcada na ficha.",
                "body": "Essas mudanças são os estágios: vão de −6 a +6. O MyOwnDex ajusta o atributo original antes de passá-lo para a escala do RPG. Precisão e Evasão também têm estágios.\n\nÀs vezes, dois estágios mostram o mesmo número pequeno. A mudança não se perdeu: outro aumento pode alcançar o próximo número. O valor nunca anda para o lado contrário ao estágio.",
                "example": "Bulbasaur acerta Growl em Pikachu e diminui seu Ataque. Mesmo que o número pequeno da ficha ainda pareça igual, a mudança continua guardada e vale nas próximas disputas.",
                "collapsibleDetails": true
            },
            {
                "id": "2.4",
                "title": "Quando um valor chega a zero",
                "plain": "Com 0 HP, o Pokémon desmaia e precisa de cuidados. Isso não significa que ele morreu.",
                "body": "O HP máximo nunca fica abaixo de 1. Um dano direto que realmente acontece causa pelo menos 1 de dano. Um erro, uma imunidade ou um bloqueio pode causar 0.\n\nEfeitos pequenos também podem dar 0 naquela vez, como explica a regra 6.2. Isso não remove uma condição nem ignora uma proteção. Se uma escolha exige pagar HP, o custo continua sendo pelo menos 1.",
                "example": "Pikachu usa Thunder Shock contra um Geodude de Kanto. Por ser do tipo Ground (Terra), Geodude é imune ao golpe; ele não recebe um dano mínimo só porque Pikachu atacou."
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
                    "Vitória mais fácil: se o dobro do nível ou dos participantes favorecer o vencedor, tire 1 XP por situação, sem dar o multiplicador daquela situação. Quando houver uma vantagem de cada lado, multiplique primeiro e subtraia depois. A recompensa final fica em pelo menos 1 XP. Por exemplo: base 3, vantagem de nível do vencedor e adversários em dobro dão 3 × 2 − 1 = 5 XP.",
                    "Recompensa do grupo: a XP recebida já é inteira. A divisão padrão é igual, com resultado arredondado para baixo; combinem outra divisão antes. Cada Pokémon que contribuiu de verdade e enfrentou o risco recebe pelo menos 1 XP. Assim, dividir uma recompensa-base de 1 entre seis participantes válidos dá 1 XP para cada um. Só entrar em campo ou ficar na Box não basta.",
                    "Treinamento: cada XP recebida dá 2 EVs para distribuir. Receber 3 XP dá 6 EVs. São até 252 EVs por atributo e 510 ao todo. Registrar a mesma recompensa de novo não entrega XP ou EVs outra vez. Editar a XP atual serve para corrigir a ficha."
                ],
                "example": "Depois da batalha, Eevee recebe experiência pelo desafio que ajudou a superar. Se puder subir de nível, o MyOwnDex atualiza sua ficha e guarda a experiência que sobrou.",
                "collapsibleDetails": true
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
                "plain": "Cada rodada é uma volta em que todos têm sua vez. Primeiro vocês escolhem as ações; depois o jogo organiza a ordem.",
                "body": "Antes de rolar a iniciativa, escolha um movimento, Trocar Pokémon, Improvisar / interagir, Tentar fugir ou Aguardar / passar a vez. Escolher ainda não gasta PP. Você pode mudar até a iniciativa ser rolada.\n\nDepois disso, siga sua escolha. Se o plano ficar impossível, você pode aguardar ou seguir uma alternativa já combinada. Isso não libera outro ataque para escolher depois de ver a ordem.",
                "bullets": [
                    "Prioridade: movimentos de prioridade maior vêm primeiro. Protect tem +4, Quick Attack tem +1 e Tackle tem 0. Valores negativos vêm depois de 0. Aguardar, improvisar, fugir e trocar usam 0. Prioridade não aumenta a Velocidade nem dá outra ação.",
                    "Mesma prioridade: o jogo rola 2d6 e usa a Velocidade atual, com seus ajustes. Se ainda houver empate, role 1d6 entre os empatados e repita até decidir.",
                    "Habilidades: Prankster dá +1 a movimentos de status; Gale Wings dá +1 a movimentos do tipo Flying (Voador) com HP cheio; Triage dá +3 às curas que sua regra permite. A habilidade precisa estar ativa. Você vê a prioridade antes de rolar.",
                    "Durante a rodada: a ordem fica como foi rolada. Uma mudança de Velocidade conta na próxima rodada, salvo um efeito que mude a ordem de propósito. Mudar a seleção não adianta sua vez.",
                    "Para continuar: use Próximo turno depois da ação. No último turno, Encerrar rodada aplica os efeitos finais. Então escolha de novo e role a próxima iniciativa."
                ],
                "example": "Pikachu escolhe Quick Attack, e Bulbasaur escolhe Tackle. Nessa disputa, Quick Attack vem primeiro pela prioridade, mesmo que Pikachu esteja menos veloz."
            },
            {
                "id": "3.2",
                "title": "O movimento acertou?",
                "plain": "A precisão mostra a chance de um movimento alcançar o alvo. O MyOwnDex confere a rolagem e os ajustes.",
                "body": "Alguns movimentos dispensam o teste de precisão. Os que têm uma chance numérica usam d100: igual ou menor que a chance ajustada é acerto. Mesmo uma precisão de 100% pode mudar com os estágios de Precisão e Evasão.\n\nSe o ataque vencer a disputa e a soma de seus dados mantidos for pelo menos 2 maior que a da defesa, ele ganha a segunda tentativa da regra 1.4.",
                "example": "Eevee usou Sand Attack e atrapalhou a visão de Pikachu. Agora Thunder Shock pode errar; o MyOwnDex confere a precisão antes de aplicar o golpe."
            },
            {
                "id": "3.3",
                "title": "Usar um movimento",
                "plain": "Escolha o movimento e seu alvo. Cada movimento faz o que sua própria regra permite.",
                "body": "Movimentos físicos usam Ataque contra Defesa. Movimentos especiais usam Ataque Especial contra Defesa Especial. Movimentos de status podem fortalecer, atrapalhar ou mudar a cena. Eles seguem seus próprios alvos, precisão, imunidades e efeitos; não recebem uma disputa de dano inventada.\n\nRecover e Swords Dance, por exemplo, agem no próprio usuário. Eles também esperam a vez do Pokémon. Escolher um movimento ainda não aplica seu efeito.",
                "bullets": [
                    "Para causar dano, o atacante precisa superar a defesa. Empate ou resultado menor impedem o dano. Se o movimento acertou, um efeito secundário ainda pode funcionar.",
                    "Aplique cada efeito em quem a descrição manda: o usuário, o Pokémon escolhido, um grupo ou o campo.",
                    "O jogo combina poder, STAB, tipos e outros bônus antes de arredondar uma vez. Depois vêm a pequena variação da regra 1.5 e o limite comum.",
                    "O limite comum por impacto é o nível do atacante: no nível 10, começa em 10. Superefetividade e estágios positivos do atributo de ataque podem aumentar esse limite. Resistência diminui o dano, mas não aumenta o limite. Críticos e movimentos com regras próprias seguem suas exceções."
                ],
                "example": "Scyther usa Swords Dance para fortalecer o próprio Ataque. O movimento age nele mesmo, sem precisar vencer a Defesa de outro Pokémon.",
                "collapsibleDetails": true
            },
            {
                "id": "3.4",
                "title": "Aguentar um golpe decisivo",
                "plain": "Com HP cheio, seu Pokémon pode aguentar um golpe que o derrubaria e continuar com 1 HP!",
                "body": "Esta é a Proteção contra hit kill do MyOwnDex, uma adaptação para o RPG. Ela pode ajudar uma vez por Pokémon em cada batalha. Ela precisa estar disponível quando a ação começa, com o HP cheio.\n\nSome o dano direto dos impactos do mesmo movimento que realmente chegaram ao Pokémon, depois da precisão, dos bloqueios e do limite de dano. Se esse total o derrubaria, mas for menor que três vezes seu HP máximo, ele termina o dano direto da ação com 1 HP. Os outros impactos dessa mesma ação não tiram esse último HP. A proteção fica usada.\n\nShedinja não tem esta proteção geral. Movimentos de nocaute direto e dano total de pelo menos três vezes o HP máximo seguem suas exceções. Um crítico sozinho não remove a proteção.\n\nOutras ações, efeitos de contato e dano contínuo são contados à parte. Sturdy, Focus Sash e a reserva de sobrevivência seguem suas próprias regras; usar a proteção geral não consome Focus Sash no mesmo movimento. Curar, trocar ou mudar de fase não renova a proteção. Tirar o próprio HP encerra essa proteção na batalha.",
                "example": "Eevee acerta um Tackle que derrubaria Pikachu, mas não atravessa essa proteção. Como Pikachu estava com HP cheio no começo da ação e ainda não tinha usado sua chance, ele aguenta com 1 HP. Essa chance de continuar é uma regra do nosso RPG."
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
                "example": "Combusken usa Double Kick: é um movimento de dois chutes, não uma sequência de tamanho sorteado. Cada chute ainda respeita bloqueios e proteções."
            },
            {
                "id": "3.6",
                "title": "Onde seu Pokémon está?",
                "plain": "Imagine a cena com seus amigos. O que está perto? O que ficou longe? O cenário ajuda a decidir o que dá para fazer.",
                "body": "Use três distâncias simples: Perto, Longe e Muito Longe. Não precisa contar quadradinhos. Considere alcance, obstáculos, área e Velocidade.\n\nArrastar o desenho de um Pokémon só organiza o campo. Isso não dá deslocamento grátis, alcance maior ou outra ação. Traga o parceiro escolhido para o campo; os demais ficam no banco. Uma troca preserva HP, PP, condições, itens gastos e a proteção já usada ou perdida.",
                "example": "Há um rio entre Pikachu e a outra margem. Arrastar seu desenho na tela não o faz atravessar: a equipe ainda precisa encontrar um caminho seguro."
            },
            {
                "id": "3.7",
                "title": "Sua vez de agir",
                "plain": "Cada Pokémon ativo tem uma ação principal por rodada. Espere sua vez, faça sua escolha e continue a aventura.",
                "body": "Na batalha, procure Agora para saber de quem é a vez. A defesa normal já faz parte da disputa e não custa outra ação.",
                "bullets": [
                    "Ação principal: use um movimento, faça um improviso importante ou troque de Pokémon. Prioridade só define a vez. No Campo dos Dados, Treino livre permite praticar; Rolar iniciativa começa uma batalha. Encerrar rodada não devolve o treino livre nem permite atacar antes da próxima iniciativa.",
                    "Tentativa válida: gasta a ação mesmo que o movimento erre, seja bloqueado ou uma condição impeça agir. Se a condição impedir a ação, não gaste PP. Uma escolha inválida, como um movimento sem PP, pode ser corrigida antes da tentativa e não gasta a ação.",
                    "Troca por escolha: declare Trocar Pokémon antes da iniciativa. Quem sai usa sua ação; quem entra ocupa esse lugar e não ganha outra ação nessa rodada. Substituir um parceiro desmaiado não gasta a ação da rodada seguinte. Os recursos de cada Pokémon continuam com ele.",
                    "Deslocamento: mover-se na mesma faixa pode acompanhar a ação. Atravessar uma faixa sob oposição ou conquistar uma posição importante pode exigir a ação e um teste. Combine isso antes de rolar.",
                    "Reação: só acontece quando um movimento, habilidade, item ou situação permite. Ela não dá uma nova ação por conta própria.",
                    "Aguardar, improvisar, fugir e trocar: usam prioridade 0. Aguardar passa a vez sem outro efeito. Para improvisar, combine objetivo e risco antes da iniciativa e anote o plano. Nenhuma dessas opções guarda um ataque para escolher depois. Se uma regra der outra ação ou mudar a ordem, o Narrador registra a exceção no Diário."
                ],
                "example": "Você troca Pikachu por Bulbasaur. Bulbasaur entra no lugar dele, mas não recebe um ataque extra nessa rodada."
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
                "example": "No começo do turno de Pikachu, seu Treinador usa uma Potion nele para cuidar do HP perdido. Depois, Pikachu ainda pode fazer sua própria ação."
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
                "example": "Um Pidgey selvagem está cansado da batalha, mas ainda não desmaiou. Seu Treinador pode tentar uma Poké Ball. Se Pidgey desmaiar, essa captura comum já não será possível.",
                "collapsibleDetails": true
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
                "example": "Eevee está cansado, mas não desmaiou. Numa pausa segura, pode recuperar um pouco de HP; PP e condições precisam de seus próprios cuidados."
            },
            {
                "id": "4.4",
                "title": "Itens e Pokédólares",
                "plain": "Guarde o que ganhar e marque o que gastar. Assim, você sempre sabe o que ainda pode levar para a aventura.",
                "body": "Use a bolsa para acompanhar itens e Pokédólares. Um item consumido só volta se uma regra permitir recuperá-lo ou se você conseguir uma reposição. O Narrador pode corrigir um registro errado; essa correção não cria outra recompensa.",
                "example": "Seu Treinador usou a última Potion em Pikachu. Antes de usar outra, precisa conseguir uma reposição na bolsa."
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
                "example": "Uma Treinadora sonha em conhecer Lapras. Esse desejo pode levar a equipe até o mar e abrir uma nova aventura."
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
                "example": "Seu Eevee recebe o apelido de Amora. Na ficha, você anota onde se conheceram; essa história acompanha Amora na Box e na aventura."
            },
            {
                "id": "5.3",
                "title": "Escolher os movimentos",
                "plain": "Seu Pokémon leva até quatro movimentos para a batalha. Escolha os que combinam com ele e com o jogo de referência.",
                "body": "Quando aprender outro movimento, escolha qual sai. Trocar os movimentos não dá outra ação nem recupera PP durante a batalha.\n\nConsulte o repertório do jogo escolhido. Jogos anteriores continuam disponíveis. Gerar Pokémon e Adicionar à Box usam a mesma seleção automática de movimentos aprendidos por nível. A opção automática procura o jogo mais recente com esse aprendizado. Uma escolha explícita de jogo continua valendo para aquele jogo.\n\nNv. 1 e Ao evoluir são aprendizados diferentes. Movimentos de evolução, Máquina, Tutor, Ovo ou Treinamento não entram como aprendizado comum automático. Em Champions, escolha os movimentos por treinamento na ficha. O movimento mantém nome original, alvos, precisão, PP, tipo e efeitos. Deixe exceções combinadas anotadas.",
                "example": "Em Scarlet/Violet, Combusken pode aprender Double Kick ao evoluir de Torchic. A ficha mostra Ao evoluir para você reconhecer esse momento."
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
                "example": "Machoke evolui para Machamp por troca. Ele muda de aparência, mas continua com o apelido e a história que vocês viveram juntos."
            },
            {
                "id": "5.5",
                "title": "Amizade e confiança",
                "plain": "Cuidar, confiar e viver grandes momentos juntos fortalece o vínculo com seu Pokémon.",
                "body": "O Narrador pode dar +5 por um cuidado significativo, +10 por um marco e +20 por uma grande virada. +50 fica para um acontecimento excepcional. Cuidados do dia a dia somam no máximo +10 por sessão; grandes marcos diferentes não entram nesse limite. Conte cada acontecimento uma vez.\n\nDesmaiar, perder ou falhar não reduz a Amizade automaticamente. Uma perda de confiança precisa fazer sentido na história e ser conversada. Evoluções usam o valor original, de 0 a 255. A Amizade não dá salvamentos, críticos ou ações extras sem uma regra que permita isso.",
                "example": "Pikachu está com medo de atravessar uma ponte. Seu Treinador o acompanha com calma e cuida dele. O Narrador pode reconhecer esse momento no vínculo dos dois."
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
                "example": "O sono impede Eevee de usar Tackle. Ele passa a vez, mas mantém os PP do movimento que não conseguiu usar.",
                "collapsibleDetails": true
            },
            {
                "id": "6.2",
                "title": "Veneno, clima e outros efeitos",
                "plain": "Veneno e clima podem tirar HP aos poucos. O MyOwnDex mostra o resultado de cada rodada e lembra os efeitos que continuam ativos.",
                "body": "Resolva cada efeito no seu momento. Não transforme todo resultado pequeno em 1 HP: isso faria alguns efeitos ficarem fortes demais. Use a parte inteira e sorteie a chance de mais 1.\n\nCom 3 HP para dividir por 16, há 3 chances em 16 de perder 1 HP; nas outras vezes, perde 0. Com 19 dividido por 16, perde 1 HP e tem 3 chances em 16 de perder mais 1. Não fica nenhum pedaço de HP para pagar depois.\n\nO MyOwnDex sorteia ao aplicar cada efeito e guarda o resultado. Abrir a prévia ou consultar o mesmo resultado não faz outro sorteio. Cada efeito continua respeitando suas imunidades, seus custos e o momento de acontecer. Dano 0 não gasta proteção e não cura uma condição ativa.\n\nEm Dynamax e Gigantamax, efeitos proporcionais comuns usam o HP máximo de antes da transformação, salvo uma regra específica. Esse jeito de trabalhar com números inteiros é uma adaptação do RPG.",
                "example": "Pikachu está envenenado. Em uma rodada, ele pode continuar com o mesmo HP, mas o veneno não desaparece.",
                "collapsibleDetails": true
            },
            {
                "id": "6.3",
                "title": "Recuperar HP",
                "plain": "Um movimento de cura ajuda seu Pokémon a recuperar HP, até o máximo que ele pode ter.",
                "body": "Uma cura comum não revive um Pokémon desmaiado; isso precisa de uma regra que permita. Drenagem recupera HP; recuo é o dano que o próprio usuário recebe ao usar certos movimentos. Os dois usam o dano que realmente foi aplicado. Drenagem, recuo e curas baseadas no HP seguem a regra 6.2; o MyOwnDex faz essas contas.\n\nUma escolha com custo de HP, como Substitute, custa pelo menos 1 HP e exige poder pagar esse custo. Um resultado 0 não dá o benefício de graça. Curar HP não devolve PP, itens ou proteção por conta própria.",
                "example": "Bulbasaur já aprendeu Giga Drain por TM, uma máquina que ensina movimentos. Ao tirar HP de Eevee com o golpe, ele pode recuperar HP, sem passar do próprio máximo."
            },
            {
                "id": "6.4",
                "title": "Fortalecer ou enfraquecer atributos",
                "plain": "Alguns movimentos ajudam seu parceiro a ficar mais forte. Outros atrapalham os atributos do adversário.",
                "body": "Use os estágios de −6 a +6 para Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, Precisão e Evasão. O MyOwnDex recalcula a partir do atributo original antes de dividir por 10.\n\nPrecisão e Evasão mudam a chance de acerto. Unaware e outras habilidades ignoram apenas os estágios que sua própria descrição manda ignorar.",
                "example": "Geodude usa Defense Curl e fortalece a própria Defesa. O MyOwnDex guarda essa mudança para os próximos golpes que dependem dela.",
                "collapsibleDetails": true
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
                "example": "Pikachu está confuso e envenenado. Ao trocá-lo por Bulbasaur, a confusão de Pikachu termina, mas ele continua envenenado no banco.",
                "collapsibleDetails": true
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
                "example": "Seu Gyarados tem Intimidate. Ao entrar em campo com a habilidade ativa, ele pode diminuir o Ataque dos adversários que ela consegue afetar."
            },
            {
                "id": "7.2",
                "title": "Itens que acompanham seu parceiro",
                "plain": "Um item pode ajudar muito, mas alguns são consumidos. Acompanhe o que seu Pokémon ainda está segurando.",
                "body": "Itens podem estar ativos, consumidos, removidos, trocados ou recuperados. Um item consumido ou removido só funciona outra vez se alguma regra o devolver.\n\nBerries, itens de escolha, Life Orb, Leftovers, Focus Sash, Weakness Policy, Air Balloon, sementes, orbes e outros modificadores entram nos cálculos. Trick, Switcheroo, Knock Off, Thief, Covet, Fling, Recycle, Bug Bite, Pluck e Incinerate também atualizam o item.\n\nA Box guarda de quem era o equipamento. Um item original consumido continua consumido ao registrar o progresso. Uma troca temporária não muda o equipamento de origem na ficha; o consumo fica marcado na ficha de onde aquele item veio. Recycle ou uma reposição registrada pode devolvê-lo.",
                "example": "Eevee come a Oran Berry que estava segurando e recupera HP. Ao encerrar a cena, a Berry continua gasta; ele precisa de outra ou de uma regra que devolva o item."
            },
            {
                "id": "7.3",
                "title": "Variantes, formas e transformações",
                "plain": "Seu Pokémon pode ter uma aparência ou uma forma especial. Cada uma muda apenas o que sua regra permite.",
                "body": "Variantes regionais e outras variantes separadas são identidades diferentes. O mesmo parceiro não troca livremente entre elas. Diferenças só de aparência ficam agrupadas na Pokédex.\n\nFormas do mesmo Pokémon, Mega Evolution, Dynamax, Gigantamax e Terastallization seguem suas próprias regras. Transformar não dá outra ação nem recupera recursos por conta própria.\n\nTransform copia aparência, tipos atuais, habilidade, atributos que não são HP, estágios e movimentos com 5 PP. Mantém HP, nível, item e progresso do usuário. Ao voltar, a ficha original continua guardada.\n\nStance Change, Schooling, Shields Down, Zero to Hero, Hunger Switch, Gulp Missile, Zen Mode, Power Construct e Forecast mudam a forma em situações próprias. O painel mostra o que muda e o que permanece.",
                "example": "Numa batalha que permite Mega Evolução, Venusaur segura a Venusaurite e seu Treinador usa uma Key Stone. Ele se torna Mega Venusaur e continua sendo o mesmo parceiro da sua jornada."
            },
            {
                "id": "7.4",
                "title": "Copiar ou chamar um movimento",
                "plain": "Alguns movimentos permitem usar outro movimento. A cópia só vira aprendizado permanente quando a regra diz isso.",
                "body": "Sketch aprende permanentemente o último movimento observado que seja válido, no lugar de Sketch, inclusive na ficha vinculada. Mimic faz uma cópia temporária com 5 PP; ao desfazê-la ou encerrar a cena, voltam o movimento e os PP anteriores.\n\nMetronome, Copycat, Assist, Sleep Talk, Nature Power, Mirror Move, Me First e Instruct pedem o movimento que será usado. Só a escolha original gasta PP. O movimento chamado usa a mesma ação e a mesma vez; sua prioridade não cria outro turno nem muda a iniciativa.",
                "example": "Depois de Eevee usar Tackle, Bonsly usa Mimic em Eevee para copiá-lo. É uma cópia temporária: ao desfazê-la, Bonsly volta a ter Mimic."
            },
            {
                "id": "7.5",
                "title": "Tipos, STAB e Terastallization",
                "plain": "Conhecer os tipos ajuda a escolher seu próximo movimento. Fraquezas, resistências e imunidades fazem diferença!",
                "body": "Use os tipos atuais do alvo. Uma imunidade mantém o dano em 0, salvo um efeito que a remova.",
                "bullets": [
                    "Efetividade: uma resistência deixa metade do dano; duas deixam um quarto. Um acerto neutro mantém o dano. Uma fraqueza dobra; duas multiplicam por 4. Uma fraqueza e uma resistência se equilibram e mantêm o dano.",
                    "STAB: é o bônus de usar um movimento do próprio tipo. Normalmente, multiplique o dano por 3 e divida por 2.",
                    "Terastallization: o bônus vale para um tipo original ou para o tipo Tera. Se o movimento corresponder aos dois, o bônus dobra o dano. Adaptability ajusta o bônus quando está ativa.",
                    "Clima e terreno: sol, chuva e terrenos têm seus próprios efeitos. O resultado mostra cada um separadamente."
                ],
                "example": "Vine Whip, de Bulbasaur, funciona muito bem contra um Geodude de Kanto. Já Thunder Shock, de Pikachu, não o afeta por causa do tipo Ground (Terra).",
                "collapsibleDetails": true
            },
            {
                "id": "7.6",
                "title": "O que acontece depois da escolha",
                "plain": "Depois de escolher um movimento e um alvo, acompanhe o resultado. O MyOwnDex resolve cada ação uma vez.",
                "body": "O jogo confere se a ação é permitida e se alguma condição impede agir. Depois verifica a disputa, quando houver, a precisão e as imunidades. Calcula o dano e as proteções, aplica dano, efeitos secundários, contato, custos, cura e nocaute. O Diário guarda o resultado.\n\nVocê continua escolhendo alvo, troca ou movimento chamado quando a regra permite. Um crítico só vale depois de acertar. Shield Dust, Covert Cloak e Sheer Force mudam efeitos secundários; não apagam efeitos principais nem custos do usuário.",
                "example": "Pikachu usou Thunder Shock em Eevee. Ao abrir o Diário, você apenas revê o que aconteceu; Eevee não recebe outro golpe, e Pikachu não gasta PP de novo."
            },
            {
                "id": "7.7",
                "title": "Dynamax e Gigantamax",
                "plain": "Seu Pokémon fica enorme por três rodadas! O HP aumenta por um tempo e os movimentos também mudam.",
                "body": "Prepare a transformação antes da iniciativa. Ela não refaz uma ordem já rolada e não dá outra ação. Dynamax e Gigantamax compartilham um uso por Treinador em cada batalha e terminam ao trocar de Pokémon.",
                "bullets": [
                    "HP: o nível Dynamax vai de 0 a 10. No nível 10, o HP dobra. Nível 0 também é válido. A permissão de usar Dynamax é uma escolha separada do nível Dynamax.",
                    "Conta do HP: some 30 ao nível Dynamax. Multiplique o HP por esse resultado, que vai de 30 a 40, e divida por 20. Arredonde o máximo para baixo e aumente o HP atual na mesma proporção inteira, sem curar o dano que já havia. A ficha mostra o HP de antes e o HP Max.",
                    "Ao terminar: entrar e sair sem receber dano ou cura conserva exatamente o HP de entrada. Se o HP mudou, o jogo converte a mudança de volta e arredonda para baixo. Um Pokémon consciente fica com pelo menos 1 HP; um desmaiado continua com 0.",
                    "Gigantamax: usa o mesmo aumento de HP e exige o fator Gigantamax e uma espécie compatível. Shedinja fica com 1 HP. Zacian, Zamazenta e Eternatus não usam Dynamax comum. Eternamax tem atributos próprios; não é só dobrar o HP.",
                    "Movimentos: ataques viram Max Moves com prioridade 0; movimentos de status viram Max Guard com prioridade 4. Gastam PP do movimento original e usam efeitos próprios. Não copiam recuo, múltiplos acertos ou efeitos secundários do original.",
                    "Proteções e efeitos: não sofrem hesitação, nocaute direto, Low Kick, Grass Knot, Heavy Slam ou Heat Crash. Roar e Whirlwind falham. Efeitos percentuais comuns usam o HP máximo de antes da transformação."
                ],
                "example": "Numa batalha que permite Dynamax, Pikachu usa a transformação depois de perder um pouco de HP. Ele fica gigante, mas não fica curado. Quando volta ao tamanho normal, os ferimentos da batalha continuam contando.",
                "collapsibleDetails": true
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
                "example": "O Narrador descreve uma ponte quebrada. Uma jogadora propõe pedir ajuda a seu Machop; outra procura um caminho com Eevee. O grupo combina o que tentar."
            },
            {
                "id": "8.2",
                "title": "O aplicativo ajuda; você escolhe",
                "plain": "O MyOwnDex cuida das contas. Você e seus amigos continuam escolhendo o que tentar e como viver a aventura.",
                "body": "O aplicativo resolve o que já tem uma resposta definida. Ideias criativas e consequências da história ficam com o grupo. Combine a ideia antes de rolar. Se houver uma exceção, anote no Diário para usá-la do mesmo jeito depois.",
                "example": "Um rival pede ajuda para procurar seu Eevee. Seu Treinador decide se vai acompanhá-lo; o MyOwnDex ajuda com os testes que forem necessários."
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
                "example": "Bulbasaur quer puxar uma corda com suas vinhas. Antes dos dados, o Narrador combina o que ele alcança e o que pode acontecer. O combinado continua valendo depois do resultado."
            },
            {
                "id": "8.4",
                "title": "A regra de ouro",
                "plain": "Explore, imagine, cuide e descubra com seus Pokémon. As melhores ideias podem abrir novos caminhos para a equipe!",
                "body": "Use o cenário, pense em defesas criativas e experimente combinações inesperadas. Conte o que sua ideia quer conseguir e combine como tentar antes dos dados.\n\nCriatividade não dá recursos ou ações extras sem uma regra ou uma exceção combinada. As mesmas escolhas e os mesmos limites valem para todos.",
                "example": "Eevee ajuda um Pikachu perdido a encontrar seus amigos. Esse resgate pode ser o grande momento da sessão, mesmo sem uma batalha."
            },
            {
                "id": "8.5",
                "title": "Testes do Treinador",
                "plain": "Seu Treinador também pode investigar, escalar e ajudar. Role os dados quando houver uma dúvida importante e algo em jogo.",
                "body": "Diga o que quer fazer, o que atrapalha e o que pode acontecer. O Treinador rola 2d6; não usa atributos inventados de Pokémon. Uma ação tranquila não pede dados. Para uma ideia impossível, procure outro plano.\n\nUma especialidade da história, uma boa preparação ou uma ajuda útil pode dar vantagem. Um obstáculo importante pode dar desvantagem. Várias ajudas não acrescentam dados. Vantagem e desvantagem juntas usam Normal.\n\nO Narrador pode usar dificuldade 5 para uma situação favorável, 7 para uma exigente e 9 para uma muito difícil. O total precisa superar a dificuldade; empate não basta. O aplicativo mostra o resultado.",
                "example": "A Treinadora segue as pegadas de um Eevee na lama. Como pode perder a pista, o Narrador pede um teste e combina o risco antes dos dados.",
                "collapsibleDetails": true
            },
            {
                "id": "8.6",
                "title": "Tentar uma ideia diferente",
                "plain": "Quer usar um movimento de um jeito criativo? Conte seu plano e combine o que pode dar certo ou errado.",
                "body": "Improvisar pode dar vantagem, causar desvantagem ou mudar uma posição ou um objetivo. Antes dos dados, combinem o teste, o custo, o risco e quem será afetado. Em batalha, use a ação principal; se usar um movimento, gaste PP também.\n\nNo sucesso, escolha um benefício que combine com a ideia: vantagem ou desvantagem em um teste relacionado, ou uma mudança concreta de posição ou objetivo. O bônus no teste vale uma vez e acaba, no máximo, no fim da rodada seguinte.\n\nO improviso não junta dano completo com um bônus grátis, não acumula vantagem e não cria uma condição ou estágios permanentes sem a regra correspondente. Uma ideia tranquila não exige teste; uma impossível pede outro plano.",
                "example": "Num improviso do RPG, Bulbasaur usa Vine Whip para alcançar uma corda presa num galho. Antes dos dados, o grupo combina alcance, teste e risco. Se der certo, ele pode facilitar a travessia; isso não causa também o dano de um ataque."
            },
            {
                "id": "8.7",
                "title": "Vamos ajudar uns aos outros",
                "plain": "Trabalhar em equipe pode alcançar um resultado maior. Cada participante ajuda de verdade e compartilha o risco.",
                "body": "Para ajudar uma pessoa numa tarefa, ela rola com vantagem se sua ajuda for útil. Ajudantes compartilham o risco e usam sua ação em batalha.\n\nNum plano em grupo, cada participante faz sua parte e testa o atributo adequado. Antes de qualquer dado, combinem quem participa, a tarefa de cada um, quais são indispensáveis, o resultado que buscam e o que pode dar errado. Uma tarefa indispensável precisa funcionar para o plano dar certo.\n\nUm sucesso numa tarefa que possa alcançar o objetivo comum já pode bastar, desde que as tarefas indispensáveis também funcionem. Se todos passam, não há custo por falha. Se alguém falha, o risco combinado avança 1 passo, como fazer barulho ou gastar mais tempo. Se pelo menos metade falha, avança 2 passos. Não cobre uma punição para cada pessoa.\n\nNão acrescente participantes depois de ver os resultados nem invente tarefas inúteis para diminuir o peso das falhas. Resolva o objetivo uma vez. Para tentar de novo, siga a regra 8.8.",
                "example": "Fora da batalha, Bulbasaur segura uma corda com as vinhas, e Machop firma uma tábua para a travessia. O grupo combina que a corda não pode soltar. Se Bulbasaur falhar, a passagem precisa esperar, mesmo que Machop consiga fazer sua parte.",
                "collapsibleDetails": true
            },
            {
                "id": "8.8",
                "title": "Posso tentar de novo?",
                "plain": "Você pode tentar outra vez. Pense no que mudou e no que a próxima tentativa pode custar.",
                "body": "Uma falha muda a situação. Antes de tentar de novo, o Narrador explica o novo custo em tempo, recursos ou exposição ao perigo.\n\nSe você repetir imediatamente o mesmo plano sem uma mudança importante, use desvantagem quando ainda for possível continuar. Ela não se acumula. Preparar-se ou mudar de abordagem tira essa penalidade, mas não desfaz o perigo que já avançou.\n\nSe houver chance real de sucesso e nenhum custo ou risco, resolva o esforço sem uma sequência de rolagens repetidas. Essa regra não atrapalha ataques nem capturas comuns: eles já gastam ação, PP ou Balls e têm seus próprios riscos.",
                "example": "O Treinador não consegue mover uma pedra da passagem. Em vez de insistir do mesmo jeito, pede ajuda a Machop. O grupo combina como tentar outra vez."
            },
            {
                "id": "8.9",
                "title": "Fugir ou perseguir",
                "plain": "Às vezes, a melhor escolha é recuar. Combine a saída que a equipe procura e os riscos antes de rolar.",
                "body": "Declare Tentar fugir com prioridade 0. Na batalha, dispute Velocidade com quem impede a saída. Empate favorece quem bloqueia. No sucesso, deixe a cena de confronto; você não continua atacando de fora. Na falha, sua ação foi usada e os oponentes ainda podem agir. Efeitos que impedem fuga mantêm suas próprias exceções.\n\nNuma perseguição longa, use dois marcadores de 0 a 3: Fuga e Perigo. Faça uma disputa principal por rodada. Sucesso aumenta Fuga em 1; falha aumenta Perigo em 1. Outros personagens podem ajudar ou remover obstáculos com suas ações, sem criar outras disputas principais.\n\nQuando um marcador chegar a 3, conclua a saída ou a consequência combinada. Tentar outra vez não zera os marcadores.",
                "example": "Pikachu tenta fugir de um encontro com Pidgey. Se conseguir, ele sai do confronto. Se falhar, a tentativa usa sua vez; fugir não guarda um ataque para depois."
            },
            {
                "id": "8.10",
                "title": "Desafios para toda a equipe",
                "plain": "Uma grande batalha deve dar a cada parceiro uma chance de ajudar. Preparação, apoio e boas ideias também fazem diferença!",
                "body": "Para o Narrador: um chefe usa as mesmas regras. Não dobre atributos, ações ou barras de HP só por ele ser um chefe. Prepare movimentos físicos e especiais, aliados, terreno e sinais de ataques importantes. Inclua objetivos como resgatar, proteger ou recuar.\n\nAntes de jogar, compare as duas defesas com os ataques da equipe. Ataque original 10 contra Defesa original 60 nunca vence essa disputa, nem com vantagem. A fraqueza de tipo só muda o dano depois de acertar. Preserve a Defesa e ofereça caminhos claros: ataque especial, estágios, apoio, outro objetivo ou retirada. Não peça para repetir um ataque sem chance de funcionar.\n\nMudar a fase não cura, não devolve proteção e não dá outro turno. Uma raid, ou batalha especial em grupo, é um formato à parte: o grupo precisa conhecer antes as regras especiais, seus limites, de onde vêm e como responder a elas. Não existe um bônus universal de chefe.\n\nDurante a sessão, observe se todos conseguem escolher, agir e contribuir. Ajustar a aventura com pessoas jogando ajuda a perceber o que está divertido e o que precisa melhorar.",
                "example": "Na batalha contra Golem, Bulbasaur escolhe Vine Whip, enquanto Pikachu usa sua vez para ajudar Eevee a sair de uma área de pedras soltas. Atacar e proteger também fazem a equipe avançar."
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
