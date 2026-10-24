/** Cenas completas: combate e intervenções. */
export const GUIDE_WORKED_SCENES_3_4 = Object.freeze({
  "3.1": {
    "quando": "Antes de cada rodada de batalha, quando os Pokémon precisam decidir ações e a ordem para executá-las. A iniciativa não é uma segunda ação nem consome PP.",
    "cena": "Pikachu declara Quick Attack contra Bulbasaur; Bulbasaur declara Tackle contra Pikachu. Quick Attack tem prioridade +1, Tackle tem prioridade 0. As declarações foram feitas antes de saber quem começa.",
    "como": [
      "Todos anunciam movimento, troca, improviso, fuga ou espera. Confira se existem PP e condições de uso; declarar sozinho não gasta PP.",
      "Compare primeiro as prioridades: Quick Attack age antes de Tackle, mesmo que Bulbasaur seja mais veloz. Entre ações de mesma prioridade, compare os resultados de Velocidade atual com 2d6, conforme a regra 1.1. Se os resultados persistirem iguais, desempatam com d6.",
      "Execute a primeira ação, depois a seguinte, sem refazer a ordem no meio da rodada por uma mudança comum de Velocidade. Quando todos terminarem, aplique efeitos de fim de rodada e só depois anunciem os próximos movimentos."
    ],
    "resultado": "Pikachu tem a primeira vez por causa da prioridade; Bulbasaur só tenta Tackle quando sua vez chegar e se ainda puder agir.",
    "porQue": "Prioridade define quem age antes, não aumenta a Velocidade, não cria uma ação extra e não garante que o movimento acertará."
  },
  "3.2": {
    "quando": "Quando um movimento com precisão verificável é tentado. A precisão é uma etapa diferente da disputa de ataque e da efetividade dos tipos.",
    "cena": "Eevee usa Sand Attack em Pikachu e consegue reduzir sua Precisão. Mais tarde, Pikachu tenta usar Thunder Shock em Eevee, que normalmente apresenta precisão de 100%.",
    "como": [
      "Na vez de Eevee, aplique Sand Attack e anote o estágio de Precisão reduzido de Pikachu. Sand Attack não causa dano direto.",
      "Quando chegar a vez de Pikachu, verifique sua condição e PP. Use a precisão de Thunder Shock ajustada pelos estágios de Precisão e Evasão. Role de 1 a 100 quando o movimento exigir essa verificação.",
      "Se o resultado superar a chance, Thunder Shock errou e não causa dano; uma tentativa válida ainda gastou a ação e os PP. Se acertar, continue com disputa, tipos e consequências cabíveis."
    ],
    "resultado": "Mesmo um movimento que normalmente tem precisão completa pode falhar por efeito de Sand Attack. Uma imunidade é outra causa de dano zero.",
    "porQue": "Primeiro é preciso que um golpe possa alcançar o alvo; depois se decide se ele pode causar dano ou condições."
  },
  "3.3": {
    "quando": "Na vez do Pokémon que declarou um movimento e depois de verificar que sua ação é válida. O movimento dita a categoria, o alvo e o efeito.",
    "cena": "Scyther usa Swords Dance. É um movimento da categoria Status que aumenta o Ataque do próprio Scyther em dois estágios, não uma tentativa de cortar o adversário. Mais tarde, Scyther usa Quick Attack, físico.",
    "como": [
      "Na vez de Scyther, confirme que Swords Dance tem PP e não está bloqueado. Gaste seu uso válido e aumente apenas seu próprio Ataque; não role disputa física nem retire HP de Eevee por Swords Dance.",
      "Ao chegar a nova vez de Scyther, se escolher Quick Attack, confira a prioridade e faça a disputa de Ataque de Scyther contra Defesa do alvo. O aumento de Ataque de Swords Dance é aplicado aqui.",
      "Se Quick Attack vencer e o ataque for permitido, calcule seu Poder, bônus legítimos, tipos, variação e limite do RPG. Se fosse um movimento especial, usaria Ataque Especial em vez de aproveitar Swords Dance."
    ],
    "resultado": "Swords Dance fortalece Scyther sem causar dano no próprio turno; Quick Attack poderá se beneficiar depois, se Scyther conseguir atacar.",
    "porQue": "Movimentos de apoio, físicos e especiais seguem suas descrições. Um fortalecimento não é um segundo ataque disfarçado."
  },
  "3.4": {
    "quando": "Quando o dano direto de um único movimento derrubaria um Pokémon que tinha HP cheio no começo daquela ação e ainda dispõe da proteção geral do RPG.",
    "cena": "Um Eevee de teste no nível 20 usa Tackle em Pikachu, também de nível 20. O Pikachu começou com 6 de 6 HP, não tinha item e ainda possuía a proteção. Nesta execução auditada, Eevee venceu a disputa e seu Tackle foi crítico.",
    "como": [
      "Antes de Eevee agir, registre que Pikachu está com HP completo e não gastou a proteção nesta batalha.",
      "Resolva Tackle, considerando o acerto, os dados, a defesa, o dano permitido e o limite. Some os impactos diretos do mesmo movimento antes de decidir se derrubariam Pikachu.",
      "Se o total for suficiente para derrubá-lo, mas inferior a três vezes o HP máximo, a proteção geral deixa Pikachu com 1 HP e fica marcada como usada. Este foi o resultado reproduzido no caso de teste."
    ],
    "resultado": "Nesse caso específico Pikachu termina em 1 de 6 HP. Veneno, dano de contato ou outra ação posterior são acontecimentos diferentes e podem afetá-lo.",
    "porQue": "A proteção foi criada para uma oportunidade dramática de continuar; não é invencibilidade, não vale para Shedinja e não reaparece ao trocar ou curar."
  },
  "3.5": {
    "quando": "Quando a descrição de um movimento determina múltiplos acertos ou uma sequência com condições próprias. Não transforme um golpe com quantidade fixa em um sorteio.",
    "cena": "Na referência Scarlet/Violet, Combusken que evoluiu de Torchic pode conhecer Double Kick. Contra Geodude de Kanto, Double Kick é um movimento físico Fighting que prevê dois chutes, desde que a ação seja válida.",
    "como": [
      "Confira primeiro que o Combusken realmente aprendeu Double Kick no jogo escolhido e que dispõe de PP. Declare o alvo e tente a ação na sua vez.",
      "Para Double Kick, use a quantidade fixa de dois impactos prevista pelo golpe, calculando o resultado de cada chute e as proteções cabíveis. Não sorteie 2 a 5 impactos como se fosse Fury Swipes.",
      "Para outro movimento cuja descrição prevê 2 a 5 impactos variáveis, use a distribuição da regra completa: resultados de 2 ou 3 são mais prováveis que 4 ou 5. Skill Link e Loaded Dice mudam o sorteio quando ativos."
    ],
    "resultado": "Double Kick pode acertar duas vezes sem gastar duas ações; se uma sequência exigir condução do Narrador, anote custo e efeitos uma única vez.",
    "porQue": "Quantidade fixa e variável são características distintas da identidade de cada movimento, e precisam respeitar suas exceções e custos."
  },
  "3.6": {
    "quando": "Quando alguém quer mudar de faixa de distância ou atingir algo que pode estar fora do alcance. Isso também vale quando um Pokémon recebe uma ameaça de longe.",
    "cena": "Pikachu avista uma saída na outra margem de um rio. Está Longe da saída e a água é um obstáculo real. Desenhar Pikachu na outra margem não significa que atravessou.",
    "como": [
      "O Narrador descreve onde Pikachu está, a margem de destino, correnteza, terreno e três faixas possíveis: Perto, Longe e Muito Longe.",
      "O jogador diz como Pikachu pretende atravessar. Se houver risco e resistência, combinem antes dos dados um teste e se a mudança consome a ação. Se for impossível atravessar daquele modo, proponham outra ideia.",
      "Somente depois de resolver a tentativa mude a anotação de distância. Um Pokémon que tenta um movimento à distância também precisa ter alcance e linha de efeito permitidos."
    ],
    "resultado": "Se a travessia funcionar, Pikachu passa à nova faixa; se falhar, permanece onde está e enfrenta o risco previamente explicado.",
    "porQue": "A posição registra o que aconteceu na história. Não cria distância percorrida, alcance ou turnos gratuitos."
  },
  "3.7": {
    "quando": "Quando a fila de iniciativa indica de quem é a vez. Também importa ao ser alvo: defender-se normalmente não rouba sua futura ação.",
    "cena": "Pikachu declarou Thunder Shock contra Eevee. Quando chega sua vez, Eevee ainda pode se defender na disputa sem perder a própria vez depois. Pikachu precisa ter PP e não estar impedido por uma condição.",
    "como": [
      "Verifique se Pikachu pode agir e se Thunder Shock tem PP. Se não houver PP, corrija a escolha inválida antes da tentativa; isso não deve gastar a vez.",
      "Se a tentativa for válida, resolva ataque, precisão e consequência. Se errar, a ação de Pikachu foi usada. Se uma condição como sono impedir que ele aja, passe sua vez sem gastar os PP do movimento impedido.",
      "Passe ao próximo participante. Só depois que todos concluírem as oportunidades encerre a rodada e aplique efeitos como veneno."
    ],
    "resultado": "Pikachu não pode trocar de golpe depois de ver que Thunder Shock errou. A defesa que Eevee realizou não era sua ação principal.",
    "porQue": "Cada lado tem uma oportunidade compreensível de agir; erros ou bloqueios legítimos não criam ações de compensação."
  },
  "4.1": {
    "quando": "No início da vez de um Pokémon sob controle do Treinador, antes de resolver condições e ataque. Cada Treinador tem apenas uma intervenção por rodada, mesmo com mais de um parceiro.",
    "cena": "No começo da vez de Pikachu, seu Treinador quer usar uma Potion para recuperar HP dele. Potion é um item de cura usado pelo Treinador, não um movimento de Pikachu.",
    "como": [
      "Confirme que o Treinador ainda tem sua intervenção e uma Potion na bolsa. Diga quem receberá o item e o que ele faz conforme a edição ou regra combinada.",
      "Gaste a intervenção e uma Potion, depois aplique manualmente a cura legítima, sem ultrapassar o HP máximo. No registro digital da intervenção, apenas marcar Item do Treinador não cura nem consome automaticamente a Potion.",
      "Se Pikachu ainda puder agir, ele conserva sua própria ação. Se a tentativa do Treinador falhou ou não produziu o efeito pretendido, não ganhe outra intervenção na mesma rodada."
    ],
    "resultado": "A intervenção do Treinador fica usada, o item é contabilizado e o HP de Pikachu muda apenas pela cura realmente aplicada.",
    "porQue": "O Treinador pode ajudar durante a batalha sem substituir a ação do Pokémon ou voltar no tempo para desfazer um golpe já resolvido."
  },
  "4.2": {
    "quando": "Quando um Treinador decide tentar capturar um Pokémon selvagem consciente que pode ser capturado naquela cena. Em combate, só no momento de sua intervenção.",
    "cena": "Eevee acompanha seu Treinador diante de um Pidgey selvagem de Kanto. O Pidgey de teste está com 1 de 3 HP, sem condição, e o Treinador tem uma Poké Ball. No caso auditado, a chance foi de 77% e saiu 51 no d100.",
    "como": [
      "Antes do lançamento, confirme espécie, taxa de captura, HP atual e máximo, condições, tipo de Ball e a intervenção disponível. Pidgey não é Pokémon de outro Treinador.",
      "Calcule a chance pela fórmula da regra completa. No caso auditado, 51 é menor que 77 e Pidgey é capturado. Se o resultado tivesse superado a chance, teria escapado.",
      "Anote uma Poké Ball gasta e a intervenção usada em qualquer resultado, sem gastar a ação do Eevee. Registre o Pidgey capturado como novo indivíduo e guarde-o na equipe ou PC."
    ],
    "resultado": "A captura só funciona porque todos os pré-requisitos e o sorteio foram atendidos. Formas Max e situações de raid exigem concluir ou combinar o formato antes.",
    "porQue": "Enfraquecer um selvagem e escolher uma Ball correta mudam a chance, mas não garantem uma captura comum."
  },
  "4.3": {
    "quando": "Depois de um confronto realmente encerrado, quando os parceiros encontram um lugar seguro para parar. Mudar de fase ou fechar o aplicativo não recupera recursos.",
    "cena": "Depois de lutar contra Pidgey, Eevee está consciente e ferido. O grupo encontra um local seguro e decide descansar dez minutos; não está mais em combate.",
    "como": [
      "Confirme que a batalha terminou e que não há ameaça interrompendo a pausa. Para descanso curto, recupere a parte inteira de um quarto do HP máximo de Eevee, pelo menos 1 HP, sem passar do máximo.",
      "Marque que Eevee já usou a pausa curta desde o último descanso completo. Não recupere PP, não apague uma condição e não devolva Berry ou Potion consumida.",
      "Para recuperar HP e PP e tratar condições comuns, faça um descanso completo de oito horas em segurança ou receba atendimento completo num Centro Pokémon. Preserve itens já gastos."
    ],
    "resultado": "Eevee consegue se recuperar no ritmo previsto, sem reviver automaticamente pela pausa curta e sem multiplicar descansos mudando de tela.",
    "porQue": "O tempo e a segurança fazem parte do custo da recuperação. HP, PP, condições e itens não são todos a mesma coisa."
  },
  "4.4": {
    "quando": "Sempre que um Treinador ganha, gasta, compra, vende ou troca itens ou Pokédólares. Também vale quando um adversário usa um efeito que remove ou consome um item.",
    "cena": "Seu Treinador usa sua última Potion para tratar Pikachu. A Potion estava na bolsa, não era um PP do Pikachu; depois de utilizada, não há outra disponível.",
    "como": [
      "Antes da utilização, confira a quantidade disponível, quem pode receber o item e a descrição de seu efeito.",
      "Se a utilização for válida, risque uma unidade e aplique somente o efeito legítimo da Potion, sem inventar cura adicional. Em combate, siga a intervenção da regra 4.1.",
      "Se o Treinador comprar outra Potion, registre a saída de Pokédólares e a entrada do item. Não devolva o item antigo ao encerrar a rodada ou descansar."
    ],
    "resultado": "A bolsa mostra uma Potion a menos depois da cura de Pikachu e impede reutilizar a mesma unidade em outra rodada sem reposição.",
    "porQue": "Itens e dinheiro representam recursos reais da jornada; registrar seu consumo evita repetições e ganhos sem origem."
  }
});
