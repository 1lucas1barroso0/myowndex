/** Procedimentos para jogar na mesa, independentes de botões ou telas.
 * Complementam a regra completa em rpgRules.js; não substituem as exceções.
 * Cada uma das 48 entradas corresponde a uma regra canônica do RPG.
 */
export const GUIDE_PAPER_STEPS = Object.freeze({
  "1.1": [
    "Escolha quem age, quem se opõe e o atributo usado por cada Pokémon. Consulte o valor original, com os ajustes válidos, em suas fichas.",
    "Cada lado rola dois dados de seis faces e multiplica a soma pelo próprio atributo. O maior resultado vence; no empate, vence quem se defende."
  ],
  "1.2": [
    "Antes dos dados, decida se a situação ajuda ou atrapalha a tentativa. Com vantagem, role três d6 e guarde os dois maiores; com desvantagem, os dois menores.",
    "Se houver vantagem e desvantagem juntas, role dois d6 normalmente. Não acumule dados adicionais por várias ajudas."
  ],
  "1.3": [
    "Confira os dois dados mantidos: dois 6 indicam possível crítico; dois 1, possível complicação. Confirme primeiro acerto, precisão e imunidades.",
    "Se houver dano crítico válido, multiplique-o por três e divida por dois, seguindo o arredondamento geral. A complicação é combinada pelo Narrador e não inventa efeitos de movimentos."
  ],
  "1.4": [
    "Para uma chance inteira, role de 1 a 100; funciona quando o resultado for igual ou menor que a chance. Vantagem faz duas tentativas e conserva a melhor; desvantagem conserva a pior.",
    "Se a chance for uma fração que não cabe em 100 resultados iguais, sorteie uniformemente entre as partes do denominador; não arredonde a probabilidade sem avisar. Verifique acerto e efeito secundário separadamente."
  ],
  "1.5": [
    "Após determinar o dano-base e os modificadores, role um d6 por impacto e alvo. De 2 a 5, mantenha o dano; com 1, diminua um passo; com 6, aumente um passo.",
    "O passo é a parte inteira de um décimo do dano-base, com mínimo de 1, e dano-base 1 permanece 1. Aplique o limite comum depois da variação. Não varie cura, veneno, recuo ou custos."
  ],
  "2.1": [
    "Registre espécie, forma, nível, natureza, IVs, EVs, habilidade e item. Use os atributos originais dessa ficha, incluindo seus ajustes, antes de qualquer conversão.",
    "Anote HP atual/máximo e PP restante de cada movimento; reduzir HP não reduz PP e gastar PP não altera HP."
  ],
  "2.2": [
    "Pegue os valores originais da ficha. Divida HP por 8, atributos e poder dos golpes por 10 e arredonde para o inteiro mais próximo; na metade exata, HP sobe e os demais descem.",
    "Anote na ficha que os valores foram convertidos. Não misture HP e danos da escala dos jogos com os do RPG; Shedinja mantém 1 HP."
  ],
  "2.3": [
    "Anote separadamente os estágios de cada atributo, de −6 a +6. Altere primeiro o atributo original e só depois converta o resultado para o RPG.",
    "Mantenha o estágio mesmo se o número pequeno da ficha não mudar imediatamente. Precisão e Evasão também têm estágios."
  ],
  "2.4": [
    "Se um ataque for imune, errar ou for inteiramente bloqueado, marque 0 de dano. Se acertar e tiver dano direto válido, aplique ao menos 1 ponto.",
    "Nunca reduza o HP máximo abaixo de 1. Perdas fracionárias e custos de HP seguem suas próprias regras, sem criar dano extra."
  ],
  "2.5": [
    "Defina uma única recompensa por desafio concluído: 1 XP comum, 2 importante ou 3 grande conquista. Em batalha, encerre o confronto e confira os modificadores de dificuldade.",
    "Para cada Pokémon que receber XP, some a recompensa ao saldo. A meta para o próximo nível é a parte inteira da metade desse próximo nível; desconte-a, suba e preserve a sobra, repetindo se necessário."
  ],
  "3.1": [
    "Antes da rodada, cada participante declara movimento, troca, improviso, fuga ou espera. Ordene por prioridade de movimento, começando pela maior.",
    "Entre declarações com a mesma prioridade, cada lado rola 2d6 multiplicado pela Velocidade atual. Se houver empate, desempate com d6 até separar. A ordem fica fixa nesta rodada."
  ],
  "3.2": [
    "Depois de decidir se o movimento pode atingir o alvo, consulte sua precisão e os ajustes de Precisão e Evasão. Se houver chance numérica, role de 1 a 100.",
    "Se o resultado superar a chance, o movimento erra. Movimentos que dispensam o teste respeitam sua exceção; efeitos extras têm verificação própria."
  ],
  "3.3": [
    "Na vez do Pokémon, consulte o movimento e seu alvo. Físicos comparam Ataque com Defesa; especiais comparam Ataque Especial com Defesa Especial. Efeitos de status seguem sua descrição.",
    "Resolva disputa e precisão, depois tipos, poder, bônus, variação e limite de dano nessa ordem. Um ataque que não vence a defesa não causa dano direto; marque PP apenas para uma tentativa válida."
  ],
  "3.4": [
    "No início da ação, marque se o alvo está com HP cheio e ainda dispõe da proteção nesta batalha. Calcule o dano direto total recebido desse movimento, depois dos limites.",
    "Se esse dano o derrubaria, mas for inferior a três vezes o HP máximo, deixe-o com 1 HP e marque a proteção como usada. Confira as exceções de Shedinja, nocaute direto e danos separados."
  ],
  "3.5": [
    "Leia na ficha do movimento quantos impactos ele produz. Para 2 a 5 acertos variáveis, sorteie 2 ou 3 com 35% cada; 4 ou 5 com 15% cada, salvo habilidades e itens.",
    "Resolva cada impacto sem duplicar ação ou gasto inicial. Se uma sequência exigir escolhas ou verificações especiais, pare e decida com o Narrador antes de aplicar seus custos."
  ],
  "3.6": [
    "Antes da ação, marque a distância como Perto, Longe ou Muito Longe e descreva os obstáculos reais.",
    "Movimentar uma miniatura não é uma ação gratuita nem prova alcance. Combine se a travessia exige ação e teste; só depois mude a posição registrada."
  ],
  "3.7": [
    "Siga a ordem da iniciativa. Na vez do participante, resolva sua declaração válida uma única vez; mesmo uma tentativa que erra ocupa a ação.",
    "Depois, passe para o próximo. Quando todos agirem, encerre a rodada, aplique efeitos de fim de rodada e só então prepare a próxima iniciativa."
  ],
  "4.1": [
    "Cada Treinador pode intervir uma vez por rodada, no início da vez de um Pokémon que controla, antes de verificar condição e movimento.",
    "Se usar uma Potion, anote o item gasto e aplique a cura conforme a descrição da Potion; a intervenção é consumida mesmo se falhar e não gasta a ação do Pokémon."
  ],
  "4.2": [
    "Antes da captura, confirme que o alvo é selvagem, consciente e capturável. Anote HP, condição, taxa da espécie e Ball disponível.",
    "Calcule a chance pela fórmula desta regra, arredonde ao fim e role de 1 a 100. Registre a Ball e a intervenção gastas mesmo na falha; a ação do Pokémon permanece disponível."
  ],
  "4.3": [
    "Depois de encerrar a batalha, marque dez minutos de segurança para descanso curto: um Pokémon consciente recupera a parte inteira de um quarto do HP máximo, no mínimo 1; use uma vez até descanso completo.",
    "Para descanso completo, marque oito horas de segurança ou atendimento completo em Centro Pokémon: recupere HP e PP e trate condições comuns. Não devolva itens ou recursos que a regra não restaura."
  ],
  "4.4": [
    "Anote cada entrada e saída de item ou Pokédólar na bolsa. Se um item for consumido, risque uma unidade; não o devolva no fim da cena.",
    "Combine antes de usar o item em quem ele pode agir e qual efeito sua descrição permite. Registre compras, trocas e recompensas uma vez."
  ],
  "5.1": [
    "Escreva nome, aparência, origem, objetivo e pessoas importantes do Treinador. Escolha uma especialidade coerente com sua história.",
    "Quando surgir uma ação do Treinador, explique o objetivo e o risco; use o teste próprio da regra 8.5, não atributos emprestados de um Pokémon."
  ],
  "5.2": [
    "Prepare uma ficha para cada parceiro com espécie, forma, nível, natureza, habilidade, tipos, valores originais, HP, item e no máximo quatro movimentos com PP.",
    "Acrescente Treinador original, Poké Ball, Amizade e anotações de viagem. Se ocorrer evolução ou transformação, preserve a identidade e o histórico."
  ],
  "5.3": [
    "Escolha qual edição de Pokémon serve de referência para aprender o movimento. Registre se veio de nível, evolução, máquina, tutor, ovo ou outro método legítimo.",
    "Ao aprender um quinto movimento, escolha qual dos quatro sai. Não recupere PP nem ofereça uma ação extra por trocar a lista."
  ],
  "5.4": [
    "Se a XP alcançar a meta, desconte a meta, aumente o nível e guarde a sobra. Confira separadamente a condição de evolução própria daquela espécie.",
    "Na evolução, preserve apelido, vínculo, condições, PP, treinamento e história. Ganhar nível não cura um Pokémon com 0 HP nem aumenta a Amizade por si só."
  ],
  "5.5": [
    "Após um cuidado ou marco real da história, o Narrador decide uma mudança de Amizade conforme os valores da regra. Registre o acontecimento uma vez.",
    "Some os cuidados cotidianos da sessão até seu limite; marcos distintos continuam separados. Perder uma disputa não tira Amizade automaticamente."
  ],
  "6.1": [
    "Anote uma condição principal por Pokémon. Antes de cada oportunidade de agir, aplique apenas a verificação correspondente à condição daquela ficha.",
    "Se o efeito impedir a ação, passe a vez sem gastar PP do movimento. No fim da rodada, aplique apenas os efeitos que atuam nesse momento; mudar de parceiro não cura automaticamente."
  ],
  "6.2": [
    "Ache a fração de HP indicada pelo veneno, clima ou outro efeito. Aplique a parte inteira; para a parte restante, faça um único sorteio exato com a mesma proporção.",
    "Registre a perda naquele fim de rodada e não repita o sorteio por consultar a ficha. Se perder 0, a condição continua. Respeite imunidades e o HP anterior a formas Max."
  ],
  "6.3": [
    "Antes de curar, confira se o Pokémon está consciente, o limite de HP e a descrição da cura. Para drenagem, use o dano que o alvo realmente sofreu.",
    "Para recuo, aplique o custo previsto ao usuário; para Substitute, confirme que ele pode pagar pelo menos 1 HP. Cura não repõe automaticamente PP ou itens."
  ],
  "6.4": [
    "Após Growl, Swords Dance ou outro efeito, altere somente o estágio do atributo indicado, dentro de −6 a +6.",
    "Na próxima disputa, calcule o atributo original já ajustado e só depois faça a conversão para o RPG. Não use Defesa em lugar de Defesa Especial."
  ],
  "6.5": [
    "Anote confusão e hesitação à parte da condição principal. Na confusão, conte oportunidades próprias de agir e sorteie o risco de se atingir conforme a regra.",
    "Na hesitação, perca somente a próxima ação possível da mesma rodada. Ao trocar, elimine esses dois efeitos quando suas regras mandarem."
  ],
  "7.1": [
    "Anote a habilidade e verifique seu momento de ativação: entrada, contato, dano, clima ou fim de rodada. Uma habilidade só atua se suas condições forem atendidas.",
    "Registre mudanças de atributos, estado e campo imediatamente no momento permitido. Uma habilidade não se ativa repetidamente só por estar na ficha."
  ],
  "7.2": [
    "Registre qual Pokémon segura o item e se ele está disponível, consumido ou removido. Confira seu gatilho antes de aplicá-lo.",
    "Se uma Berry for consumida, risque o item; se houver Recycle ou reposição válida, marque sua volta. Não reponha um item automaticamente após a batalha."
  ],
  "7.3": [
    "Distinga variante regional de forma temporária. Antes de transformar, confira a condição específica, o item ou habilidade exigidos e o momento permitido.",
    "Anote separadamente dados temporários e originais. Ao desfazer, restaure somente o que a regra de transformação manda; não invente cura ou ação extra."
  ],
  "7.4": [
    "Para Mimic, anote qual movimento válido do alvo foi copiado e marque a cópia com 5 PP. Para Sketch, siga a alteração permanente autorizada.",
    "Movimentos chamados resolvem dentro da mesma ação; gaste apenas os PP que a regra exige e preserve a iniciativa já definida."
  ],
  "7.5": [
    "Confira os tipos atuais do alvo e do golpe. Uma imunidade impede dano; cada resistência reduz e cada fraqueza aumenta na proporção indicada.",
    "Aplique STAB quando o tipo do movimento combinar com o Pokémon e verifique bônus específicos de Tera, habilidades, clima ou terreno; só depois arredonde."
  ],
  "7.6": [
    "Resolva na ordem: permissão para agir, condição, disputa, precisão, imunidade, dano e proteção, efeitos extras, contato, custos e nocaute.",
    "Anote cada consequência uma única vez, incluindo HP, PP, item e condição. Um crítico inválido não atravessa uma imunidade."
  ],
  "7.7": [
    "Antes da iniciativa, confirme a permissão para Dynamax ou Gigantamax e o nível Dynamax da ficha. Marque o uso único compartilhado pelo Treinador.",
    "Calcule o HP temporário pela fórmula desta regra e guarde o HP de entrada. Ao sair, converta de volta, sem curar ferimentos ou recuperar o uso."
  ],
  "8.1": [
    "Antes da cena, o Narrador descreve o mundo e o objetivo; cada jogador decide a ação de seu próprio Treinador e Pokémon.",
    "Quando houver uma decisão especial ou exceção, combinem antes do teste e anotem de forma que todos possam aplicar a mesma regra."
  ],
  "8.2": [
    "Explique primeiro o que o personagem quer conseguir e quais riscos existem. Se não houver dúvida relevante, resolva pela história sem dados.",
    "Quando a regra exigir número, dados ou recurso, use a própria regra e anote o resultado. A ferramenta digital apenas pode acelerar isso."
  ],
  "8.3": [
    "Procure primeiro uma adaptação expressa neste Guia. Se faltar orientação, use a regra oficial aplicável e sua correção mais recente.",
    "Persistindo uma dúvida, o Narrador decide antes dos dados, registra a exceção e usa o mesmo critério para todos os participantes."
  ],
  "8.4": [
    "Descreva a intenção e os limites reais do cenário. Sem risco e com possibilidade clara, deixe a ideia acontecer.",
    "Com risco, combine teste, custo e consequência antes de rolar. Criatividade não concede recurso ou ataque extra sem uma regra."
  ],
  "8.5": [
    "O Treinador diz o objetivo e o Narrador define a dificuldade antes da tentativa: 5 favorável, 7 exigente, 9 muito difícil.",
    "Role 2d6, ou 3d6 mantendo dois conforme vantagem e desvantagem. O total precisa superar a dificuldade; empate falha."
  ],
  "8.6": [
    "Antes de improvisar com Vine Whip, diga o que Bulbasaur tenta alcançar, o que pode acontecer e quem é afetado.",
    "Em batalha, use sua ação e os PP do movimento empregado. No sucesso, conceda apenas o benefício combinado, sem acoplar dano ou outra ação grátis."
  ],
  "8.7": [
    "Definam antes dos dados as tarefas individuais, quais são indispensáveis e qual perigo o grupo enfrenta.",
    "Cada pessoa faz seu teste. Uma falha indispensável impede o plano; o grupo sofre o avanço de risco indicado, sem cobrar a mesma consequência de cada jogador."
  ],
  "8.8": [
    "Após falhar, diga o que mudou e o novo risco. Insistir imediatamente sem nova abordagem dá desvantagem quando a tentativa ainda é possível.",
    "Uma boa preparação ou um plano diferente permite outro teste sem essa desvantagem, mas não apaga consequências já ocorridas."
  ],
  "8.9": [
    "Para fugir numa batalha, declare a intenção antes da iniciativa e dispute Velocidade com quem bloqueia. O empate favorece quem impede a saída.",
    "Numa perseguição longa, desenhe marcadores Fuga e Perigo de 0 a 3; aumente um por rodada conforme o resultado e encerre ao chegar a 3."
  ],
  "8.10": [
    "Prepare o chefe com atributos, movimentos e recursos legítimos, sem dobrar HP ou ações gratuitamente. Dê ao grupo objetivos claros além de atacar.",
    "Durante a cena, mostre consequências e oportunidades reais de apoio, proteção ou retirada. Só use regras extras de raid se forem conhecidas e combinadas antes."
  ]
});
