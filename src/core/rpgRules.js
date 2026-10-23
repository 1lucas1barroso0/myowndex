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
        "id": "rolagens",
        "number": 1,
        "title": "Rolagens e testes",
        "summary": "Testes com 2d6, vantagem, críticos e chances percentuais.",
        "rules": [
            {
                "id": "1.1",
                "title": "Testes básicos",
                "plain": "Quando existe oposição, o MyOwnDex compara os dois lados e faz os cálculos; você acompanha a decisão pelos dados e pelo resultado.",
                "body": "Role dois dados de seis lados: isso é 2d6. Em uma disputa entre Pokémon, escolha quem age e quem responde. O MyOwnDex rola os dois lados e usa os atributos, nível, IVs, EVs, natureza, estágios, condições, habilidades e itens de cada um. Aventura e Dados seguem a mesma regra.\n\nQuem age precisa superar quem se defende. Empate favorece a defesa. O jogo faz as contas proporcionais: você acompanha o resultado sem precisar multiplicar números grandes."
            },
            {
                "id": "1.2",
                "title": "Vantagem e desvantagem",
                "plain": "Vantagem e Desvantagem mudam quais dois dados de 3d6 ficam no teste; elas não se acumulam.",
                "body": "Uma boa preparação pode ajudar; um obstáculo pode atrapalhar. Combine isso antes de rolar.",
                "bullets": [
                    "Vantagem: role 3d6 e mantenha os dois maiores.",
                    "Desvantagem: role 3d6 e mantenha os dois menores.",
                    "Use apenas um modo. Duas vantagens não dão mais dados. Se houver vantagem e desvantagem juntas, use Normal."
                ]
            },
            {
                "id": "1.3",
                "title": "Acertos e erros críticos",
                "plain": "Críticos só melhoram um sucesso que já aconteceu; erros críticos criam uma complicação, não um resultado impossível.",
                "body": "Dois resultados iguais podem dar um momento especial à cena.",
                "bullets": [
                    "Dois 6 nos dados mantidos podem virar um acerto crítico. Primeiro, o ataque precisa vencer a defesa e alcançar o alvo. Empate, erro ou imunidade não viram sucesso só por causa dos dados.",
                    "Um acerto crítico multiplica o dano por 3 e divide por 2 e pode passar do limite comum. A proteção contra hit kill ainda funciona quando seus requisitos são atendidos.",
                    "Dois 1 nos dados mantidos são um erro crítico. O jogo sugere uma complicação; o grupo escolhe algo que faça sentido na cena.",
                    "Um erro crítico da defesa pode trazer outra complicação, mas não remove sozinho a proteção contra hit kill.",
                    "Perder uma posição favorável ou ficar exposto até a próxima ação.",
                    "Atingir o cenário e criar uma complicação que mude a cena.",
                    "Gastar um recurso adicional, como PP, item ou tempo, quando isso fizer sentido.",
                    "Dar ao oponente uma oportunidade imediata, sem retirar a decisão do Narrador."
                ]
            },
            {
                "id": "1.4",
                "title": "Probabilidades e efeitos secundários",
                "plain": "Chances percentuais usam d100, e uma boa vitória nos dados pode ajudar precisão ou efeitos secundários quando a regra permitir.",
                "body": "Para uma chance inteira em porcentagem, role 1d100. Resultado igual ou menor que a chance é sucesso. Com vantagem, o jogo tenta duas vezes e fica com o melhor resultado; com desvantagem, fica com o pior. Chances exatas que o d100 não consegue representar são sorteadas sem aproximação.\n\nEm um ataque, vencer a disputa e somar pelo menos 2 a mais nos dados mantidos do que a defesa dá vantagem na precisão e nos efeitos secundários. Compare os dados, não o total dos atributos. O jogo verifica isso para você."
            },
            {
                "id": "1.5",
                "title": "Variação de dano",
                "plain": "O poder continua definindo o dano; um d6 só acrescenta uma pequena variação inteira.",
                "body": "Depois dos modificadores e do arredondamento, role um d6 por impacto: 1 reduz um passo; 2 a 5 mantêm; 6 aumenta um passo. O passo é o dano-base dividido por 10, arredondado para baixo, mínimo 1. Base 6 resulta em 5, 6 ou 7. Base 20 resulta em 18, 20 ou 22. Base 1 permanece 1: não cria erro extra nem infla a média. Aplique depois o teto comum, exceto nas exceções já previstas.\n\nDano fixo, proporcional ao HP, custos, cura, recuo e residual não usam esse d6. Cada impacto e alvo têm seu próprio sorteio registrado uma vez; consulte o resultado sem rerrolar. O teto pode retirar a parte alta da distribuição. Esta é uma adaptação do RPG para valores inteiros."
            }
        ]
    },
    {
        "id": "matematica",
        "number": 2,
        "title": "Cálculos da aventura",
        "summary": "HP por 8, demais atributos por 10, estágios, XP e valores inteiros.",
        "rules": [
            {
                "id": "2.1",
                "title": "Construção dos atributos",
                "plain": "Os atributos vêm dos mesmos elementos dos jogos, e o MyOwnDex monta o valor usado na aventura.",
                "body": "Cada Pokémon tem suas próprias forças. Nível, IVs, EVs e natureza ajudam a definir seus atributos, como nos jogos. O MyOwnDex calcula esses valores; o Narrador também pode usar uma ficha já pronta."
            },
            {
                "id": "2.2",
                "title": "Escalas dos atributos",
                "plain": "O RPG reduz números grandes para uma escala menor; o MyOwnDex aplica o arredondamento correto automaticamente.",
                "body": "HP usa o valor original dividido por 8, arredondado ao inteiro mais próximo; uma metade exata sobe. Demais atributos e poder continuam divididos por 10; uma metade exata desce. Shedinja mantém 1 HP. Não existem HP, dano, cura, XP, EVs ou Amizade fracionários. Multiplicadores são razões: bônus de STAB comum significa multiplicar por 3 e dividir por 2 antes de arredondar.\n\nAmizade vai de 0 a 255 na referência original: no RPG, divida por 10 e arredonde para baixo, até 25. Efeitos pequenos seguem 6.2."
            },
            {
                "id": "2.3",
                "title": "Estágios de atributos",
                "plain": "Estágios de −6 a +6 fortalecem ou enfraquecem atributos antes da conversão para a escala do RPG.",
                "body": "Um movimento pode fortalecer ou enfraquecer um atributo em estágios, de −6 a +6. O jogo ajusta o valor original antes de dividi-lo por 10. Precisão e Evasão também usam estágios. Os valores nunca caminham contra o estágio. Na escala pequena, estágios vizinhos podem mostrar o mesmo inteiro; o estágio continua registrado e um novo ajuste pode atravessar o próximo degrau. Exemplo: Ataque original 10 vira 1 no estágio 0; de +1 a +3 pode permanecer 2. Não se perde o estágio nem se soma um bônus inventado."
            },
            {
                "id": "2.4",
                "title": "Zeros e limites mínimos",
                "plain": "Zero continua sendo um valor válido, mas HP máximo e dano real respeitam seus mínimos.",
                "body": "HP máximo é pelo menos 1; com 0 HP o Pokémon desmaia e fica fora de combate, sem morte automática. Dano direto positivo tem piso de 1. Erro, imunidade e bloqueio continuam em 0. Efeitos pequenos podem resultar em 0 naquela ocorrência, conforme 6.2; custos voluntários de HP continuam exigindo pelo menos 1. Nenhum mínimo ignora uma proteção."
            },
            {
                "id": "2.5",
                "title": "Experiência e evolução",
                "plain": "XP recompensa desafios reais, pode mudar conforme a dificuldade do confronto e também concede EVs sem duplicar recompensas.",
                "body": "XP mostra o que o Pokémon aprendeu ao superar um desafio.",
                "bullets": [
                    "A meta é metade do próximo nível, arredondada para baixo. Ao atingir a meta, desconte só essa meta, suba e guarde a sobra. Repita enquanto ela pagar outro nível. Exemplo: nível 10, saldo 4, prêmio 3: paga 5 e chega ao nível 11 com 2 XP. Registre o prêmio depois da batalha; use Encerrar batalha após concluir a rodada. Mudar só a fase não libera XP. Transformações de batalha, inclusive Transform, terminam antes da recompensa; não recalcule a iniciativa em curso. Tera Shift é automático: Terapagos pode crescer fora de batalha, com os atributos das duas formas atualizados juntos.",
                    "O Narrador escolhe a recompensa-base: 1 XP para um desafio comum, 2 para um importante e 3 para uma grande conquista. Fora de batalha, ela fica de 1 a 3. Repetir algo trivial ou sem risco não cria outro desafio.",
                    "Na vitória em batalha, dobre a recompensa se ao menos um adversário tiver o dobro ou mais do maior nível do lado vencedor. Dobre também se o lado adversário tiver o dobro ou mais de Pokémon participantes. As duas condições juntas dão ×4. Compare os níveis de entrada na batalha e conte quem participou, incluindo quem saiu ou foi derrotado; quem ficou só no banco não conta.",
                    "Se essas condições favorecerem o vencedor, cada uma tira 1 XP e não dá multiplicador. Em casos mistos, multiplique primeiro e subtraia depois e mantenha no mínimo 1 XP ao final. Exemplo: base 3, vencedor com vantagem de nível e adversários em dobro dão 3 ×2 − 1 = 5 XP.",
                    "Vencer, capturar, negociar, resgatar ou descobrir podem resolver o mesmo desafio. Recompense esse desafio uma vez, não uma vez por botão, golpe ou resultado.",
                    "A XP recebida já é inteira. Se o grupo usar uma recompensa coletiva, a divisão padrão é igual, com resultado arredondado para baixo; combine outra divisão antes de conceder. Cada Pokémon que contribuiu de maneira relevante e se expôs ao desafio recebe pelo menos 1 XP; só estar na Box ou entrar sem contribuir não basta. Esse piso é individual: base 1 dividida entre seis participantes válidos dá 1 XP para cada um, e não conserva um total fixo de 1 XP. Editar a XP atual corrige a ficha: não concede outra recompensa.",
                    "Cada aquisição de XP entrega o dobro em EVs. Receber 3 XP, por exemplo, dá 6 EVs para distribuir: até 252 por atributo e 510 no total. A mesma recompensa registrada não entrega XP nem EVs duas vezes."
                ]
            }
        ]
    },
    {
        "id": "combate",
        "number": 3,
        "title": "Combate e movimentos",
        "summary": "Iniciativa, precisão, dano e liberdade de movimento na cena.",
        "rules": [
            {
                "id": "3.1",
                "title": "Ordem dos turnos",
                "plain": "Cada rodada começa com escolhas, depois a iniciativa fixa a ordem até todos agirem e a rodada terminar.",
                "body": "Antes da iniciativa, escolha o movimento ou declare Trocar, Improvisar, Fugir ou Outra ação com objetivo nas notas. Declarar não usa PP. Pode mudar até a iniciativa; depois dela, a escolha fica travada. Se o plano ficar impossível, pode aguardar ou cumprir uma alternativa já combinada, sem escolher outro ataque de graça.",
                "bullets": [
                    "Prioridade maior age primeiro: Protect (+4), Quick Attack (+1), Tackle (0). Valores negativos vêm depois de 0. Outra ação usa 0. Prioridade não aumenta a Velocidade nem dá outra ação.",
                    "Entre escolhas de mesma prioridade, o jogo rola 2d6 e usa a Velocidade atual, com seus modificadores. Se houver empate real, rola 1d6 só entre os empatados, repetindo até decidir.",
                    "Habilidades ativas também contam: Prankster dá +1 a movimentos de status; Gale Wings dá +1 a Flying com HP cheio; Triage dá +3 aos movimentos de cura que sua regra permite. A prioridade aparece antes de rolar.",
                    "Depois de rolar, a escolha e a ordem ficam firmes. Mudar a seleção não permite agir antes ou refazer a iniciativa. Mudanças de Velocidade entram na próxima rodada; efeitos que mudam a ordem de propósito seguem suas próprias regras.",
                    "Próximo turno passa a vez. Depois do último, Encerrar rodada aplica os efeitos finais e libera novas escolhas. Escolha de novo e role a iniciativa da próxima rodada."
                ]
            },
            {
                "id": "3.2",
                "title": "Precisão",
                "plain": "Precisão decide se um movimento alcança o alvo; o jogo aplica as alterações de Precisão e Evasão.",
                "body": "A precisão responde: o movimento alcançou o alvo? Se a regra do movimento dispensa esse teste, não há rolagem. Se há uma chance numérica, até 100% pode mudar com Precisão e Evasão. No d100, igual ou menor que a chance ajustada é acerto.\n\nAo vencer a disputa com pelo menos 2 a mais na soma dos dados mantidos, o ataque ganha a segunda tentativa da regra 1.4."
            },
            {
                "id": "3.3",
                "title": "Resolução de movimentos",
                "plain": "Cada movimento usa o atributo, alvo e efeito que realmente possui; o jogo não inventa uma disputa onde ela não existe.",
                "body": "Movimentos Físicos disputam Ataque contra Defesa. Especiais usam Ataque Especial contra Defesa Especial. Movimentos de status não fazem uma disputa de dano inventada: usam seus alvos, precisão, imunidades e efeitos próprios.\n\nRecover e Swords Dance agem sobre o usuário; não sobre o adversário. Eles também esperam sua vez e precisam ser resolvidos. Declarar ainda não aplica o efeito.",
                "bullets": [
                    "O atacante precisa superar a defesa para causar dano. Empate ou resultado menor impedem o dano. Se o movimento alcançou o alvo, seus efeitos secundários ainda podem funcionar.",
                    "Cada efeito vai para o alvo que sua regra determina: usuário, Pokémon escolhido, grupo ou campo.",
                    "O jogo combina poder, STAB, tipos e demais multiplicadores antes de arredondar uma vez. Depois aplica a variação inteira da regra 1.5 e o teto comum.",
                    "O limite comum de dano por hit é o nível do atacante. No nível 10, o limite-base é 10. Superefetividade e estágios positivos do atributo ofensivo elevam esse teto proporcionalmente; críticos e movimentos de regra própria usam suas exceções. Resistência reduz o dano, mas não aumenta o teto."
                ]
            },
            {
                "id": "3.4",
                "title": "Proteção contra hit kill",
                "plain": "Uma vez por batalha, um Pokémon em condições adequadas pode sobreviver a um dano que o derrubaria, mas essa proteção tem limites claros.",
                "body": "Uma vez por batalha, começando a ação com HP cheio e proteção disponível, some os impactos diretos do mesmo movimento que alcançam o Pokémon depois de precisão, bloqueios e teto. Se o total o derrotaria, mas for menor que três vezes seu HP máximo, ele termina o dano direto dessa ação com 1 HP. A proteção fica usada: os outros impactos da mesma ação não retiram esse último HP.\n\nShedinja não recebe essa proteção geral. Nocaute direto e total de pelo menos três vezes o máximo seguem suas exceções. Crítico não remove a proteção sozinho. Ações diferentes e efeitos de contato/residuais continuam separados. Sturdy, Focus Sash e a reserva de sobrevivência seguem suas próprias regras; a proteção geral não consome o item no mesmo movimento. Cura, troca e mudança de fase não renovam a proteção. Tirar o próprio HP a encerra nessa batalha."
            },
            {
                "id": "3.5",
                "title": "Regras herdadas dos jogos",
                "plain": "Quando este Guia não adapta algo, valem as regras Pokémon dos jogos e as exceções próprias de cada movimento, item ou habilidade.",
                "body": "Os jogos Pokémon são a base. Tipos, STAB, imunidades, condições, recuo e drenagem seguem suas regras, com as adaptações deste Guia.\n\nNos movimentos comuns de 2 a 5 acertos, o RPG usa 35% para 2, 35% para 3, 15% para 4 e 15% para 5. Skill Link garante o máximo; Loaded Dice dá 4 ou 5 com chances iguais. Contagens fixas e movimentos especiais seguem sua própria regra. Sequências com precisão ou poder próprios e combinações com reações entre impactos exigem resolução guiada quando sinalizadas pelo painel. O cálculo automático é interrompido antes do gasto: o Narrador resolve a sequência e registra PP, dano, proteção e ação uma vez. Escolher um jogo para o repertório não muda silenciosamente as regras do RPG."
            },
            {
                "id": "3.6",
                "title": "Posicionamento e espaço",
                "plain": "A cena usa faixas simples de distância; posicionar o sprite organiza o campo, mas não cria movimento ou ações extras.",
                "body": "Imagine a cena: Perto, Longe ou Muito Longe. Não é preciso contar quadradinhos. Alcance, obstáculos, área e Velocidade ajudam o grupo a decidir o que é possível.\n\nArrastar um sprite apenas organiza o campo: não dá movimento grátis, alcance maior ou outra ação. A equipe entra com o Pokémon escolhido; os outros ficam no banco. Trocar preserva HP, PP, condições, itens gastos e a proteção já usada ou perdida."
            },
            {
                "id": "3.7",
                "title": "Ações, trocas e reações",
                "plain": "Cada Pokémon tem uma ação principal por rodada; trocas, improvisos e reações respeitam a vez e suas permissões.",
                "body": "Cada Pokémon tem sua vez, e a mesma ação não pode ser usada duas vezes.",
                "bullets": [
                    "Cada Pokémon ativo tem uma ação principal por rodada: usar um movimento, fazer um improviso importante ou cedê-la para trocar. Em batalha, espere aparecer Agora e ainda não ter gasto sua ação. Prioridade só define a vez. O Campo dos Dados começa como Treino livre; Rolar iniciativa inicia a batalha. Encerrar a rodada não devolve o treino nem libera ataques antes da próxima iniciativa.",
                    "Uma tentativa válida gasta a ação mesmo se uma condição impedir o movimento, ele errar ou seu efeito for bloqueado. Se uma condição impede a ação, não se gasta PP. Uma escolha inválida, como um movimento sem PP, pode ser corrigida antes da tentativa e não gasta a ação.",
                    "Para trocar por vontade própria, declare Trocar Pokémon antes da iniciativa. A troca usa a ação do Pokémon que sai. Quem entra ocupa esse lugar e não ganha outra ação na rodada. Substituir um Pokémon derrotado não gasta a ação da rodada seguinte. Os recursos de cada Pokémon continuam com ele.",
                    "Mover-se dentro da mesma faixa pode acompanhar a ação. Cruzar uma faixa sob oposição ou conquistar uma posição decisiva pode exigir a ação e um teste. Combine alcance, terreno e Velocidade antes de rolar.",
                    "Uma reação precisa ser permitida por movimento, habilidade, item ou situação. A defesa normal já faz parte da disputa: não é cobrada como outra ação.",
                    "Aguardar, improvisar, fugir e trocar usam prioridade 0. Aguardar não produz efeito; improvisar exige objetivo e risco combinados antes da iniciativa. Nenhuma dessas escolhas guarda um ataque para decidir depois. Resolva e avance. Efeitos que dão outra ação ou mudam a ordem precisam de uma permissão própria; o Narrador registra a exceção no Diário da aventura."
                ]
            }
        ]
    },
    {
        "id": "treinador",
        "number": 4,
        "title": "Treinador e jornada",
        "summary": "Intervenções, captura, PP, cura e recursos.",
        "rules": [
            {
                "id": "4.1",
                "title": "Intervenções em combate",
                "plain": "O Treinador pode intervir com item ou captura sem gastar a ação do Pokémon, mas só uma vez por rodada em batalha.",
                "body": "Cada Treinador tem uma intervenção por rodada para item ou captura, sem gastar a ação do Pokémon. Use no começo do turno de um Pokémon sob seu controle, antes de verificar condições e executar a ação. Não interrompa dados ou dano já resolvidos para desfazê-los. Se controlar mais de um Pokémon, escolha uma dessas oportunidades; não ganha uma intervenção por parceiro. O gasto vale mesmo se a tentativa falhar. Aliados e oponentes seguem a mesma janela. Fora de batalha, valem o tempo e o risco da cena."
            },
            {
                "id": "4.2",
                "title": "Capturas",
                "plain": "Captura usa a taxa da espécie, HP, condição e Poké Ball; o MyOwnDex calcula a chance e registra o resultado.",
                "body": "Ao terminar um confronto, o Narrador usa Encerrar batalha, depois de concluir a rodada. Isso termina transformações e efeitos temporários; não cura HP, não repõe PP, itens, proteção ou usos de técnicas. Trocar de fase sozinho não encerra o confronto. Nova batalha inicia outro confronto.\n\nSó capture um Pokémon selvagem, consciente e permitido na cena. Uma tentativa gasta a Poké Ball e a intervenção do Treinador em batalha, mesmo se falhar; não gasta a ação do Pokémon. O jogo calcula a chance adaptada do RPG.",
                "bullets": [
                    "Chance = 100 × taxa da espécie ÷ 255 × (3 × HP máximo − 2 × HP atual) ÷ (3 × HP máximo) × bônus da Ball × bônus da condição. O jogo arredonda para baixo e mantém de 1% a 100% quando a taxa é positiva. Taxa 0 não permite captura comum.",
                    "Poké Ball, Premier, Luxury e Heal usam bônus 1. Great multiplica por 3 e divide por 2; Ultra dobra. Sono e congelamento multiplicam por 5 e dividem por 2; queimadura, paralisia e veneno multiplicam por 3 e dividem por 2. A conta só arredonda a chance final para baixo. Master Ball dispensa o teste, mas não permite capturar o parceiro de outro Treinador.",
                    "No d100, igual ou menor que a chance é captura. A taxa vem da Pokédex; HP e condição vêm da cena. A vantagem de um ataque não passa para a captura.",
                    "Registre as Balls na bolsa do Treinador. A tentativa retira uma junto com o resultado e a intervenção, mesmo se falhar; reenviar a mesma tentativa não gasta de novo. Uma Ball especial exige sua descrição própria. Encerre Dynamax, Gigantamax ou Eternamax antes de capturar; uma captura pós-raid precisa de um formato previamente definido. Registre o novo parceiro no PC."
                ]
            },
            {
                "id": "4.3",
                "title": "PP e Cura",
                "plain": "HP, PP e condições continuam entre cenas até que alguma regra, descanso ou recurso realmente os recupere.",
                "bullets": [
                    "HP, PP, condições e itens consumidos acompanham a jornada. Cena, sessão, troca e mudança de fase não restauram recursos.",
                    "Descanso curto: dez minutos seguros, uma vez por Pokémon entre descansos completos. Recupera um quarto do HP máximo, arredondado para baixo, mínimo 1, até o máximo. Exige estar consciente; não recupera PP, não cura condições e não renova proteções. O aplicativo registra o uso; mudar de fase ou trocar não o apaga.",
                    "Descanso completo: oito horas seguras, ou atendimento completo em Centro Pokémon. Restaura HP e PP, trata condições comuns e libera outro descanso curto. Não repõe item consumido, dinheiro, Ball, amizade nem proteção da mesma batalha. Use Encerrar batalha depois de concluir a rodada; mudar só a fase não libera descanso. Transformações, inclusive Transform, e cópias temporárias de movimentos terminam antes do descanso; ferimentos narrativos exigem os cuidados combinados."
                ]
            },
            {
                "id": "4.4",
                "title": "Recursos e dinheiro",
                "plain": "Itens e dinheiro só mudam quando algo é ganho, gasto, recuperado ou corrigido de forma explícita.",
                "body": "Guarde os itens e Pokédólares que ganhar e retire o que gastar. Um recurso consumido não pode ser usado de novo sem ser recuperado por uma regra que permita isso. O inventário acompanha a jornada; uma correção do Narrador serve para acertar o registro, não para criar recompensas repetidas."
            }
        ]
    },
    {
        "id": "criacao",
        "number": 5,
        "title": "Fichas e criação",
        "summary": "Do conceito do Treinador aos dados completos de cada parceiro.",
        "rules": [
            {
                "id": "5.1",
                "title": "Começando um Treinador",
                "plain": "O Treinador começa por conceito e história; essas escolhas orientam especialidades e decisões durante a aventura.",
                "body": "Quem é seu Treinador? Escolha nome, aparência, origem, objetivo e pessoas importantes para ele. Essas ideias ajudam a decidir suas escolhas e especialidades. Seu personagem pode descobrir novos caminhos durante a aventura."
            },
            {
                "id": "5.2",
                "title": "Criando um Pokémon",
                "plain": "Um Pokémon pode ser montado manualmente ou pelo Gerador, sempre com uma ficha que continue editável.",
                "body": "Monte a ficha ou use o Gerador para começar.",
                "bullets": [
                    "Escolha espécie e forma, nível, natureza, habilidade, gênero, tipos, IVs, EVs e até quatro movimentos. Em Jogos, use as opções daquela edição. No RPG, o jogo escolhido define os movimentos; atributos, tipos e habilidades seguem a referência atual. Livre permite criar exceções de propósito.",
                    "Anote o que acompanha o Pokémon: item, Poké Ball, Treinador original, amizade e notas da jornada.",
                    "O MyOwnDex calcula os atributos. Se o grupo combinar um valor personalizado, registre essa escolha claramente. Uma transformação de batalha não deve apagar a ficha de origem."
                ]
            },
            {
                "id": "5.3",
                "title": "Movimentos e repertório",
                "plain": "O repertório respeita movimentos que o Pokémon pode conhecer no jogo escolhido, sem esconder as escolhas do jogador.",
                "body": "Um Pokémon leva até quatro movimentos para a batalha. Ao aprender outro, escolha o que sai; trocar o repertório não dá uma ação nem recupera PP no meio do combate.\n\nConsulte o repertório do jogo escolhido. O mais recente disponível é o padrão; jogos anteriores continuam acessíveis. O movimento conserva seu nome original, alvos, precisão, PP, tipo e efeitos. Exceções combinadas ficam registradas."
            },
            {
                "id": "5.4",
                "title": "Progressão e evolução",
                "plain": "Nível, evolução e Amizade mudam por acontecimentos definidos; progresso nunca apaga a identidade nem o histórico do Pokémon.",
                "bullets": [
                    "Subir de nível desconta a meta, conserva a sobra e pode atravessar mais de um nível no mesmo prêmio. Os EVs consideram toda a XP recebida, uma vez. Nível 100 é o teto padrão; exceções livres precisam declarar seu próprio teto, até 200. No teto, conserve o saldo sem criar níveis extras. Subir não revive quem está com HP 0.",
                    "Evoluir pode depender de nível, item, amizade, troca, lugar, horário ou outra condição. Preserve a ideia dos jogos; o grupo pode transformá-la em um momento equivalente da história.",
                    "Evoluir não apaga apelido, vínculo, histórico, PP, condição ou escolhas registradas.",
                    "Amizade segue acontecimentos e a regra 5.5; não sobe automaticamente por XP, nível ou fim de sessão."
                ]
            },
            {
                "id": "5.5",
                "title": "Amizade e confiança",
                "plain": "O vínculo cresce por acontecimentos significativos, com mudanças inteiras e sem recompensar repetição vazia.",
                "body": "O Narrador pode conceder +5 por um cuidado significativo, +10 por um marco, +20 por uma virada importante; +50 fica para um acontecimento excepcional. Cuidados rotineiros somam no máximo +10 na sessão, sem limitar grandes marcos distintos. Conte cada acontecimento uma vez. Desmaiar, perder ou falhar não reduz amizade automaticamente; uma perda de confiança exige causa narrativa e conversa. Evoluções continuam consultando o valor original, de 0 a 255. Não se concedem salvamentos, críticos ou ações extras pelo vínculo sem regra própria."
            }
        ]
    },
    {
        "id": "condicoes",
        "number": 6,
        "title": "Condições, cura e efeitos",
        "summary": "Como registrar consequências sem misturar dano direto e efeitos contínuos.",
        "rules": [
            {
                "id": "6.1",
                "title": "Condições principais",
                "plain": "Só uma condição principal fica ativa por vez, e cada uma tem efeito, duração e chance próprios.",
                "body": "Uma condição principal por vez. O jogo verifica seu efeito antes da ação, uma vez por tentativa — não uma vez por alvo ou hit. Se impedir a ação, a vez é usada, mas não se gasta PP. Estas são as durações e chances adotadas pelo RPG.",
                "bullets": [
                    "Queimadura: metade do dano físico, salvo Guts ou Facade; perde uma parte em 16 do HP máximo no fim da rodada.",
                    "Paralisia: metade da Velocidade, salvo Quick Feet; antes de agir, há 1 em 8 de chance de perder a ação. Não se cura sozinha.",
                    "Sono: impede 1 ou 2 oportunidades de agir. Há 1 em 3 de chance de acordar antes da segunda; se não acordar, desperta antes da terceira. Trocar guarda a contagem. Rest tem sua duração própria; Early Bird reduz a duração; Snore e Sleep Talk permitem agir dormindo.",
                    "Congelamento: antes de agir, há 25% de chance de descongelar. Se não acontecer nas duas primeiras oportunidades, descongela antes da terceira. Um movimento que descongela o usuário dispensa o teste. Dano de Fire e efeitos próprios de descongelar também removem a condição.",
                    "Veneno: perde uma parte em 8 do HP máximo ao fim da rodada. Envenenamento grave: começa em uma parte em 16 e aumenta mais uma parte em 16 por rodada, até 15 partes em 16. Trocar reinicia esse aumento; não cura o veneno."
                ]
            },
            {
                "id": "6.2",
                "title": "Dano contínuo e indireto",
                "plain": "Dano de condição, clima, terreno e outros efeitos é resolvido fonte por fonte no momento correto da rodada.",
                "body": "Resolva cada fonte no momento correto, sem piso universal de 1 HP. Separe a parte inteira da conta e sorteie o resto como chance de mais 1: 3 HP divididos por 16 significam 3 chances em 16 de perder 1 HP; nos demais resultados, perde 0 naquela ocorrência. Para 19 dividido por 16, perde 1, com 3 chances em 16 de perder mais 1. Nunca há HP fracionário, saldo oculto ou dívida entre rodadas.\n\nO sorteio acontece uma vez por fonte no resolvedor, com registro auditável; prévia e repetição da requisição não rerrolam. Fontes, imunidades, consumo e gatilhos continuam separados. Dano 0 não consome proteção; efeito ativo não se cura por ter resultado 0. Em Dynamax e Gigantamax, efeitos proporcionais comuns usam o HP máximo sem Max, salvo descrição específica. É uma adaptação inteira do RPG, não o piso de 1 do cartucho aplicado à escala reduzida."
            },
            {
                "id": "6.3",
                "title": "Cura e recuperação",
                "plain": "Cura respeita o HP máximo, e drenagem só recupera a partir do dano que realmente chegou ao alvo.",
                "body": "Cura respeita o máximo e não revive sem permissão própria. Drenagem e recuo usam o dano realmente aplicado; recuo, drenagem e curas percentuais usam a resolução inteira de 6.2. Custos voluntários, como Substitute, conservam mínimo 1 e suas condições de pagamento: resultado 0 não compra um benefício gratuito. Cura não devolve PP, item ou proteção por conta própria."
            },
            {
                "id": "6.4",
                "title": "Empoderamentos e enfraquecimentos",
                "plain": "Mudanças de atributos usam estágios e são recalculadas a partir do valor original, inclusive Precisão e Evasão.",
                "body": "Fortalecer ou enfraquecer usa estágios de −6 a +6 em Ataque, Defesa, Ataque Especial, Defesa Especial, Velocidade, Precisão e Evasão. O jogo recalcula os atributos a partir do original antes da escala por 10. Precisão e Evasão mudam a chance de acerto. Unaware e outras habilidades ignoram somente os estágios que sua descrição determina."
            },
            {
                "id": "6.5",
                "title": "Efeitos voláteis",
                "plain": "Efeitos voláteis, como confusão e hesitação, podem coexistir com a condição principal e seguem sua própria duração.",
                "body": "Confusão e hesitação são efeitos voláteis: separados da condição principal e podem existir junto dela.",
                "bullets": [
                    "Confusão: Dura de 2 a 5 oportunidades próprias; antes da última, o Pokémon se recupera. Enquanto estiver ativa, há 1 em 3 de chance de perder a ação e atingir a si mesmo com um ataque físico sem tipo de poder 40. Usa seu próprio Ataque, Defesa, nível e estágios, sem STAB, efetividade, crítico ou disputa adicional. Esse dano encerra a proteção geral contra hit kill; Sturdy, Focus Sash e outras proteções só agem quando suas próprias regras permitem. Trocar encerra a confusão.",
                    "Hesitação: impede apenas a próxima ação da mesma rodada, se o alvo ainda não agiu. Trocar encerra o efeito."
                ]
            }
        ]
    },
    {
        "id": "recursos-pokemon",
        "number": 7,
        "title": "Habilidades, itens e formas",
        "summary": "Elementos canônicos preservados com liberdade para exceções registradas.",
        "rules": [
            {
                "id": "7.1",
                "title": "Habilidades",
                "plain": "Uma habilidade só age quando está ativa e seu gatilho acontece; escolhas continuam nas mãos de quem joga.",
                "body": "Uma habilidade pode agir ao entrar em campo, receber contato, causar dano, mudar o clima ou chegar ao fim da rodada. Ela precisa estar ativa e cumprir seu gatilho; não basta estar escrita na ficha.\n\nIntimidate, Download, habilidades de clima e terreno, Sturdy, Adaptability, Technician, absorções, recuperação e mudanças de Velocidade entram nos cálculos. Imposter e Illusion mantêm suas regras próprias. O painel explica o efeito e deixa a descrição oficial disponível. Quando a habilidade oferece uma escolha de alvo, troca ou ordem, quem joga faz essa escolha."
            },
            {
                "id": "7.2",
                "title": "Itens",
                "plain": "Itens mantêm estado e origem: consumir, remover, trocar ou recuperar um item tem consequências persistentes.",
                "body": "Um item pode estar ativo, consumido, removido, trocado ou restaurado. Se já foi consumido ou removido, não funciona de novo sem uma regra que o recupere.\n\nBerries, itens de escolha, Life Orb, Leftovers, Focus Sash, Weakness Policy, Air Balloon, sementes, orbes e modificadores entram no mesmo cálculo. Trick, Switcheroo, Knock Off, Thief, Covet, Fling, Recycle, Bug Bite, Pluck e Incinerate atualizam esse estado.\n\nA Box guarda qual era o equipamento de origem. Ao registrar o progresso, um item original consumido continua consumido: encerrar a cena não o repõe. Trocas temporárias não reescrevem esse equipamento; o consumo acompanha a origem do item. Uma regra como Recycle ou uma reposição registrada pode devolvê-lo."
            },
            {
                "id": "7.3",
                "title": "Variantes, formas e transformações",
                "plain": "Uma variante identifica qual Pokémon está na ficha. Mudar a forma do mesmo Pokémon não apaga seu progresso.",
                "body": "Variantes regionais e outras variantes separadas são identidades diferentes: o mesmo Pokémon não troca livremente entre elas. Diferenças só de aparência continuam agrupadas na Pokédex. Formas do mesmo Pokémon, Mega Evolution, Dynamax, Gigantamax e Terastallization mudam apenas o que suas regras permitem. Transformar não dá outra ação nem recupera recursos por conta própria.\n\nTransform copia aparência, tipos atuais, habilidade, atributos que não são HP, estágios e movimentos com 5 PP. Mantém HP, nível, item e progresso do usuário. Reverter não apaga sua ficha original.\n\nStance Change, Schooling, Shields Down, Zero to Hero, Hunger Switch, Gulp Missile, Zen Mode, Power Construct e Forecast têm gatilhos próprios. O painel mostra o que muda e o que permanece."
            },
            {
                "id": "7.4",
                "title": "Movimentos que copiam ou chamam outros",
                "plain": "Movimentos que copiam ou chamam outros executam a regra do movimento obtido sem transformar essa cópia em repertório permanente.",
                "body": "Sketch aprende permanentemente o último movimento observado que seja válido, no lugar de Sketch, inclusive na ficha vinculada. Mimic copia temporariamente com 5 PP; ao desfazer a cópia ou encerrar a cena, restaura o movimento e PP anteriores.\n\nMetronome, Copycat, Assist, Sleep Talk, Nature Power, Mirror Move, Me First e Instruct pedem o movimento que será chamado. Só a escolha original gasta PP. O movimento chamado usa essa mesma ação e vez: sua prioridade não cria outro turno nem refaz a iniciativa."
            },
            {
                "id": "7.5",
                "title": "Tipos, STAB e Terastallization",
                "plain": "Tipos determinam imunidade, resistência, neutralidade e superefetividade; STAB e Terastallization são bônus separados.",
                "body": "Tipos mostram a efetividade do movimento contra o alvo: imune causa 0; uma resistência aplica 50%; duas resistências, 25%; neutro vale ×1; superefetivo contra um tipo vale ×2; superefetivo contra os dois tipos vale ×4. Uma fraqueza e uma resistência juntas dão ×1. Use os tipos atuais do alvo. Uma imunidade continua em 0, salvo um efeito que a remova.\n\nSTAB é o bônus de usar um movimento do próprio tipo: normalmente multiplica o dano por 3 e divide por 2. Com Terastallization ativa, vale para um tipo original ou o Tera Type; se corresponder aos dois, é 2×. Adaptability ajusta esse bônus quando ativa. Sol, chuva e terrenos têm seus próprios efeitos, mostrados separadamente no resultado."
            },
            {
                "id": "7.6",
                "title": "Ordem de resolução conectada",
                "plain": "O jogo resolve cada ação numa ordem única para que dano, efeitos, custos, cura e nocaute não sejam aplicados duas vezes.",
                "body": "Escolha o movimento e seu alvo; o jogo resolve uma vez, em ordem: permissões e condições, disputa quando houver, precisão e imunidades, cálculo e proteções, dano, efeitos secundários, contato, custos, cura e nocaute. O Diário da aventura guarda o resultado.\n\nAlvo, troca ou movimento chamado continuam sendo escolhas quando a própria regra permite. Um crítico só vale depois de acertar. Shield Dust, Covert Cloak e Sheer Force mexem nos efeitos secundários, não apagam efeitos principais nem custos do usuário."
            },
            {
                "id": "7.7",
                "title": "Dynamax e Gigantamax",
                "plain": "Max aumenta temporariamente o HP, transforma movimentos e dura três rodadas; não dá outra ação.",
                "body": "A permissão de usar Dynamax é separada do nível Dynamax. Nível 0 já é válido: multiplique o HP por 30 e divida por 20; cada nível acrescenta 1 ao numerador, até 40 no nível 10, que dobra o HP. Arredonde o máximo para baixo; aumente o atual na mesma proporção inteira, sem curar a ferida anterior. A ficha mostra HP-base e HP Max. Ao terminar, a referência de entrada e a mudança efetiva determinam o HP de volta: entrar e sair sem eventos conserva exatamente o HP. Com dano/cura, arredonde a conversão para baixo; consciente conserva mínimo 1, desmaiado continua 0.\n\nGigantamax usa o mesmo aumento de HP e exige fator e espécie compatíveis. Shedinja fica com 1. Zacian, Zamazenta e Eternatus não usam Dynamax comum. Eternamax tem atributos próprios de forma especial, não é um dobro universal.\n\nPrepare a transformação antes da iniciativa: mudar a forma não refaz uma ordem já rolada. Dynamax e Gigantamax compartilham um uso por Treinador por batalha. Duram três rodadas e terminam na troca. Ataques viram Max Moves de prioridade 0; status vira Max Guard de prioridade 4. Gastam PP do original e usam efeitos próprios, sem copiar recuo, multi-hit e efeitos secundários do original. Não sofrem hesitação, KO direto nem Low Kick, Grass Knot, Heavy Slam ou Heat Crash; Roar e Whirlwind falham. Efeitos percentuais comuns usam HP-base."
            }
        ]
    },
    {
        "id": "mesa",
        "number": 8,
        "title": "Condução da aventura",
        "summary": "Papéis, decisões manuais, transparência e exceções.",
        "rules": [
            {
                "id": "8.1",
                "title": "Narrador e jogadores",
                "plain": "Narrador e jogadores têm papéis diferentes, mas todos usam o mesmo estado e as mesmas regras da aventura.",
                "body": "O Narrador apresenta o mundo, acompanha a cena e ajuda a resolver dúvidas. Cada Jogador escolhe as ações e cuida dos seus Pokémon. Todos veem o mesmo estado da aventura. O Narrador confirma mudanças coletivas e registra exceções para ninguém jogar com uma regra diferente sem saber."
            },
            {
                "id": "8.2",
                "title": "Ajuda sem tirar a liberdade",
                "plain": "O MyOwnDex automatiza respostas definidas sem escolher pelo jogador nem decidir consequências narrativas no lugar do grupo.",
                "body": "O jogo faz as contas e resolve o que tem resposta definida. Você continua escolhendo o que seu personagem tenta fazer. Ideias criativas e consequências da história ficam com o grupo. Combine antes de rolar e registre uma exceção no Diário da aventura para aplicá-la do mesmo jeito depois."
            },
            {
                "id": "8.3",
                "title": "Como resolver uma exceção",
                "plain": "Quando surgir uma exceção, primeiro use este Guia, depois a regra oficial aplicável e, por último, uma decisão clara do grupo.",
                "body": "Quando duas explicações parecem diferentes, siga esta ordem:",
                "bullets": [
                    "Primeiro, use a adaptação explícita deste Guia para o modo RPG. Ela vale para todos os lados e não muda ao escolher um jogo antigo no catálogo.",
                    "Onde o Guia não adapta a mecânica, use a regra oficial mais recente e corrigida disponível. Uma correção posterior vale mais que uma descrição antiga. Escolher uma referência histórica não troca as regras do RPG sem avisar o grupo.",
                    "Tiers, banlists, cláusulas e regras de torneio não entram automaticamente no RPG. Aqui, a base é a mecânica Pokémon com aventura e narrativa, sem restrições competitivas importadas em silêncio.",
                    "Resolva cada ação uma vez, na ordem da regra 7.6. Uma exceção não devolve PP, HP, item ou turno sem dizer claramente que devolve.",
                    "Se a dúvida continuar, o Narrador combina uma solução clara antes da rolagem e a registra. A decisão vale igualmente para aliados e oponentes na mesma situação; não muda depois de ver os dados."
                ]
            },
            {
                "id": "8.4",
                "title": "A regra de ouro",
                "plain": "Criatividade pode abrir novas soluções, mas não cria recursos ou ações extras sem uma regra ou decisão combinada.",
                "body": "Jogue uma aventura Pokémon: explore, imagine, cuide e descubra. Use o cenário, defesas criativas e combinações inesperadas. Combine o que a ideia tenta fazer antes de rolar. Criatividade abre caminhos; não dá recursos ou ações extras sem uma regra ou exceção combinada. As mesmas escolhas e limites valem para todos."
            },
            {
                "id": "8.5",
                "title": "Testes do Treinador",
                "plain": "Treinadores rolam 2d6 só quando existe dúvida e consequência; preparação e obstáculos podem dar Vantagem ou Desvantagem.",
                "body": "Só role quando houver uma dúvida importante e algo em jogo. Diga o que quer fazer, o que atrapalha e o que pode acontecer. Um Treinador usa 2d6; não recebe atributos inventados de Pokémon.\n\nUma especialidade da sua história, boa preparação ou ajuda útil pode dar vantagem. Um obstáculo importante pode dar desvantagem. Várias ajudas não acrescentam dados; vantagem e desvantagem juntas usam Normal.\n\nComo referência de dificuldade, use 5 para favorável, 7 para exigente e 9 para muito difícil. O total precisa superar a dificuldade: empate não basta. O jogo calcula e mostra o resultado. Uma ação tranquila não pede dados; uma impossível pede outro plano."
            },
            {
                "id": "8.6",
                "title": "Improvisação",
                "plain": "Declare objetivo, benefício e risco antes dos dados; improvisar usa a ação.",
                "body": "Uma ideia não prevista pode criar vantagem, desvantagem ou mudar posição/objetivo. Combine qual teste, custo, risco e alvo. Em batalha, usa a ação principal e PP se empregar um movimento. No sucesso, escolha um benefício coerente: Vantagem ou Desvantagem em um teste pertinente, consumida no uso e expirada até o fim da rodada seguinte; ou uma mudança concreta de posição/objetivo. Não soma dano completo e bônus gratuito, não acumula Vantagem, não substitui status ou estágios permanentes sem a regra correspondente. Ideia tranquila não exige teste; ideia impossível pede outro plano. Exemplo: Bulbasaur usa Vine Whip para firmar uma corda num galho. O Narrador confirma se o galho suporta o peso, combina o teste e o risco de cair; se houver dúvida, gasta a ação e o PP. Um sucesso pode dar Vantagem à travessia seguinte. Esse uso não causa também o dano de um ataque nem ignora a condição do galho."
            },
            {
                "id": "8.7",
                "title": "Ajuda e testes coletivos",
                "plain": "Agir em grupo pode ampliar o resultado, mas todos se expõem ao risco combinado.",
                "body": "Para ajudar numa única tarefa, uma pessoa rola com Vantagem se a contribuição for útil; ajudantes compartilham o risco e usam sua ação em batalha. Para ação conjunta, cada participante cumpre seu papel e testa o atributo adequado. Um sucesso capaz resolve o objetivo compartilhado, mas papéis indispensáveis também precisam dar certo. Antes de qualquer dado, fixe quem participa, o papel pertinente de cada um, quais papéis são indispensáveis, o ganho coletivo e uma consequência agregada. Não acrescente participantes depois de conhecer os resultados nem aceite papéis sem contribuição para diluir as falhas. Se todos passam, não há custo por falha; se alguém falha, avance 1 passo do risco; se pelo menos metade falha, avance 2, nunca uma punição por pessoa. Uma única resolução por objetivo, sem várias tentativas grátis disfarçadas. Exemplo: três parceiros estabilizam uma ponte, sustentam a corda e guiam a passagem; sustentar é indispensável. Se esse papel passa e outro falha, o objetivo pode avançar com 1 passo de risco. Se o papel indispensável falha, a passagem não se completa, mesmo com os outros dois sucessos; o risco avança 1. Nova tentativa exige o custo ou a mudança de abordagem de 8.8."
            },
            {
                "id": "8.8",
                "title": "Repetição de tentativas",
                "plain": "É possível tentar de novo, pagando tempo, recursos ou exposição.",
                "body": "Uma falha muda a situação. Diga o novo custo antes de outra tentativa. Repetir imediatamente o mesmo plano, sem mudança relevante, sofre Desvantagem quando o risco permitir continuar; ela não se acumula. Preparação ou abordagem diferente remove essa penalidade, não o perigo já avançado. Se nada custa tempo ou risco e há chance real de sucesso, resolva o esforço sem uma sequência vazia de testes. Esta regra não penaliza ataques nem capturas comuns: eles já têm ação, PP, Balls e risco próprios."
            },
            {
                "id": "8.9",
                "title": "Fuga e perseguição",
                "plain": "Retirada é uma escolha real e usa a ação, com riscos definidos antes dos dados.",
                "body": "Declare Fugir com prioridade 0. Em batalha, dispute Velocidade com quem impede a saída; empate favorece quem bloqueia. No sucesso, saia da cena de confronto e não continue atacando de fora. Na falha, a ação foi usada e a oposição continua podendo agir. Efeitos que impedem fuga conservam suas exceções.\n\nPara perseguição longa, use dois contadores inteiros de 0 a 3: Fuga e Perigo. Resolva uma disputa principal por rodada; sucesso avança Fuga, falha avança Perigo. Outros personagens podem ajudar ou remover obstáculos com suas ações, sem várias disputas principais. Ao chegar a 3, conclua a saída ou a consequência combinada. Repetir não zera os contadores."
            },
            {
                "id": "8.10",
                "title": "Chefes e protagonismo",
                "plain": "Chefes usam o MyOwnDex; terreno, composição e objetivos criam o desafio.",
                "body": "Não dobre atributos, ações ou barras só porque é chefe. Use repertório físico/especial, aliados, terreno, sinais de ataques importantes e objetivos de resgate, proteção ou retirada. Distribua pressão e oportunidades de contribuir; não torne uma defesa praticamente invencível a única tarefa. Fase não cura, devolve proteção ou concede turno. Antes da sessão, compare as duas defesas com os ataques disponíveis: Ataque original 10 contra Defesa original 60 nunca supera a disputa, nem com Vantagem; fraqueza de tipo só modifica o dano depois do acerto. Conserve a defesa e ofereça rotas compreensíveis por ataque especial, estágios, apoio, objetivos ou retirada. Não exija repetir um ataque sem chance real.\n\nUma raid é um formato declarado à parte: qualquer regra especial precisa de origem, limites e formas de resposta anunciados; não vira padrão do sistema. Não há multiplicador universal de chefe validado. Observe em mesa tempo por turno, escolhas, reviravoltas e participação. Simulações medem funcionamento e consequências mecânicas; diversão, emoção e protagonismo exigem pessoas jogando."
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
