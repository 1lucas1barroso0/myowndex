/** Cenas completas e verificáveis: capítulos 1 e 2. Cada cena explica o gatilho, as ações e o resultado sem depender da interface. */
export const GUIDE_WORKED_SCENES_1_2 = Object.freeze({
  "1.1": {
    "quando": "Quando Pikachu quer alcançar um Pidgey que está fugindo e ambos podem disputar o resultado. Se nada impede a perseguição e não há risco real, o Narrador pode simplesmente narrá-la, sem rolar.",
    "cena": "Pikachu corre atrás de Pidgey na trilha. Pikachu tenta diminuir a distância; Pidgey se defende tentando continuar à frente. Esta é uma disputa de Velocidade, não um ataque e não gasta PP.",
    "como": [
      "Antes de qualquer dado, o Narrador confirma quem está tentando alcançar quem e se existe alguma vantagem ou obstáculo relevante.",
      "Consulte a Velocidade original de cada Pokémon, com estágios e modificadores válidos. Cada lado rola dois dados de seis faces; multiplique sua soma pela Velocidade usada na disputa.",
      "Compare os dois resultados. Só uma vitória de Pikachu encerra a perseguição imediatamente; um empate deixa Pidgey à frente, pois ele está resistindo à tentativa."
    ],
    "resultado": "Registre se Pikachu conseguiu alcançar Pidgey ou se a perseguição prossegue. Se não conseguiu, não invente um segundo teste gratuito: combine o que mudou antes de tentar outra vez.",
    "porQue": "A regra não recompensa somente quem age. Quem está impedindo a ação também tem uma chance real de vencer, e o empate não muda uma situação que o atacante tentou alterar."
  },
  "1.2": {
    "quando": "Antes de uma tentativa incerta, quando há ajuda concreta ou um obstáculo capaz de mudar as chances. Vantagem e desvantagem são decididas antes de conhecer os dados.",
    "cena": "O Treinador de Eevee procura suas pegadas na lama. Um mapa preparado pode ajudar; uma chuva forte pode atrapalhar. O mapa não é um bônus automático se não for útil naquela trilha.",
    "como": [
      "O Narrador ouve como o mapa foi obtido, que pistas contém e o que a chuva está apagando. Se o mapa ajudar de verdade, concede vantagem; se a chuva atrapalhar de verdade, concede desvantagem.",
      "Com vantagem, role três dados de seis faces e some os dois maiores. Com desvantagem, some os dois menores. Com ambas as condições, use somente dois dados normais.",
      "Compare o total à dificuldade de uma tentativa do Treinador, conforme a regra 8.5. Se não houver dificuldade nem perigo, apenas narre o encontro das pegadas."
    ],
    "resultado": "Anote a pista encontrada ou o risco que avançou. Duas ajudas diferentes ainda dão apenas uma vantagem; não acrescente dados por reunir mais equipamentos.",
    "porQue": "Uma ajuda precisa mudar a ação narrada, não produzir uma cadeia de bônus matemáticos sem relação com o cenário."
  },
  "1.3": {
    "quando": "Depois de uma disputa ou teste em que os dois dados mantidos mostram ambos 6 ou ambos 1. O possível crítico não substitui a precisão, a efetividade nem as proteções.",
    "cena": "Bulbasaur estende Vine Whip para puxar uma corda pendurada na ponte quebrada. Seu Treinador quer atravessar em segurança, não causar dano em outro Pokémon. A aplicação na corda é um improviso combinado, não um efeito oficial novo de Vine Whip.",
    "como": [
      "Defina antes da rolagem se a corda está ao alcance, que teste será usado e o que acontece se Bulbasaur falhar.",
      "Role os dados previstos. Com vantagem ou desvantagem, observe somente os dois resultados conservados. Dois resultados 1 podem significar que a vinha se prende ao galho errado, se o Narrador e o grupo considerarem coerente.",
      "Num ataque verdadeiro, dois resultados 6 indicam crítico apenas se o movimento acertar e vencer as verificações. Aumente então o dano conforme a regra completa, sem ignorar imunidade."
    ],
    "resultado": "Registre a consequência concreta da cena ou o dano realmente causado. A corda não se transforma em alvo de um golpe completo que também dá dano gratuito.",
    "porQue": "Os dados tornam uma ação mais dramática, mas não concedem poderes que Bulbasaur não tem nem anulam restrições de batalha."
  },
  "1.4": {
    "quando": "Quando um movimento tem uma chance de acertar ou uma chance separada de aplicar uma condição ou outro efeito secundário.",
    "cena": "Pikachu tenta usar Thunder Shock em Eevee. Esse movimento é especial, do tipo Electric, tem precisão comum de 100%, 30 PP e pode paralisar o alvo com uma chance própria de 10%. Ele não paralisa Eevee sempre que causa dano.",
    "como": [
      "Confira se Pikachu pode agir e se Thunder Shock tem PP. Resolva a disputa especial contra a Defesa Especial de Eevee, quando aplicável, e a precisão ajustada; 100% original não impede que reduções de Precisão o façam errar.",
      "Se o golpe alcançou Eevee e há dano válido, resolva o impacto. Para a paralisia, role separadamente de 1 a 100: o efeito comum ocorre com 1 a 10, salvo uma vantagem, imunidade ou modificação expressa da regra.",
      "Registre a paralisia apenas se esse segundo teste passar e Eevee puder recebê-la. Se o ataque foi bloqueado ou o efeito não pôde acontecer, não anote uma condição inventada."
    ],
    "resultado": "Eevee pode sofrer dano sem ficar paralisado. Uma nova consulta ao resultado não faz uma segunda tentativa de efeito.",
    "porQue": "Precisão, disputa de dano e chance de condição são decisões distintas, ainda que pertençam ao mesmo movimento."
  },
  "1.5": {
    "quando": "Depois que um ataque válido causaria dano direto e antes de aplicar o limite por impacto. Não se usa esta variação para perdas contínuas, cura, recuo ou dano fixo.",
    "cena": "Pikachu usa Thunder Shock em Eevee. Se Pikachu vencer a disputa, o golpe for válido e não houver imunidade, calcule primeiro o dano segundo o Poder do movimento e os modificadores do RPG.",
    "como": [
      "Encontre o dano-base inteiro de Thunder Shock seguindo a regra 3.3. Determine o passo de variação como a parte inteira de um décimo desse dano-base, com mínimo de um passo; se o dano-base for 1, mantenha 1.",
      "Role um dado de seis faces uma vez para este impacto: com 1 reduza um passo, com 6 aumente um passo e de 2 a 5 mantenha. Aplique depois o limite de dano, salvo exceção válida.",
      "Anote o HP que Eevee realmente perdeu. Se comparar duas possibilidades do mesmo combate, comece do mesmo HP inicial em cada uma: não some os resultados como se fossem ataques consecutivos."
    ],
    "resultado": "O golpe pode ficar um pouco mais fraco ou forte; uma variação maior pode ser cortada pelo limite. O veneno que surgir depois não recebe esta rolagem.",
    "porQue": "A incerteza representa a força de cada impacto, sem transformar cada acesso ao Diário em outro ataque."
  },
  "2.1": {
    "quando": "Antes do início de uma aventura, ao preparar a ficha ou quando dois Pokémon precisam comparar suas capacidades. Os números de espécies iguais podem ser diferentes.",
    "cena": "Dois Pikachu do mesmo nível disputam uma corrida. Ambos são Pikachu, mas suas naturezas, IVs, EVs e treinamento podem produzir Velocidades distintas. Nenhum precisa ter a mesma Velocidade só por compartilhar espécie.",
    "como": [
      "Anote o nível, natureza, IVs, EVs, habilidade e condição atual de cada Pikachu, usando uma ficha legítima da edição escolhida.",
      "Compare Velocidade usando os números da ficha e os modificadores que realmente estiverem ativos. Não use HP, Ataque ou PP como se fossem Velocidade.",
      "Na disputa, role os dados conforme a regra 1.1; se for apenas uma corrida tranquila, o Narrador pode resolver pela história."
    ],
    "resultado": "Registre quem ganhou e quaisquer recursos gastos. HP mostra o quanto o Pokémon ainda resiste; PP pertence a cada movimento e não é uma reserva geral de energia.",
    "porQue": "Identidade, treinamento e situação importam tanto quanto a espécie: a ficha descreve este indivíduo."
  },
  "2.2": {
    "quando": "Ao trazer atributos, HP ou Poder dos movimentos de uma ficha oficial para a escala menor do RPG. Faça a conversão antes de começar uma disputa e use essa escala até o fim.",
    "cena": "Bulbasaur conhece Tackle, movimento físico Normal. O fato de sua ficha de mesa usar números menores não transforma Tackle num golpe Grass nem muda o tipo Grass/Poison de Bulbasaur.",
    "como": [
      "Pegue da ficha original o HP máximo de Bulbasaur e o Poder do Tackle. Divida o HP por 8 e o Poder por 10, arredondando ao inteiro mais próximo: em metade exata, HP sobe e outros valores descem.",
      "Converta Ataque, Defesa e demais atributos também por 10. Anote os valores convertidos sem apagar os originais, que continuam necessários para disputas e modificadores.",
      "Ao sofrer dano, desconte apenas da reserva de HP convertida. Nunca tire dano em escala oficial de um HP que já está na escala RPG."
    ],
    "resultado": "A ficha mantém os tipos, a identidade e os movimentos originais, mas apresenta números inteiros menores para acompanhar à mesa.",
    "porQue": "A conversão diminui a contagem, não a personalidade nem a efetividade do Pokémon. Shedinja continua sendo uma exceção de 1 HP."
  },
  "2.3": {
    "quando": "Quando um movimento, habilidade ou outra condição realmente aumenta ou reduz um atributo, e na próxima vez que esse atributo for usado.",
    "cena": "Bulbasaur usa Growl em Pikachu. Growl é um movimento da categoria Status que diminui o Ataque do alvo, se ele puder ser afetado; não diminui seu Ataque Especial. Depois Pikachu tenta Quick Attack, movimento físico.",
    "como": [
      "Na vez de Bulbasaur, confirme que Growl foi permitido e aplicado. Anote um estágio a menos no Ataque de Pikachu; não retire HP de Pikachu por causa de Growl.",
      "Antes de Quick Attack, calcule o Ataque ajustado pelo estágio e compare-o com a Defesa do alvo numa disputa física. Se Pikachu escolhesse Thunder Shock, usaria Ataque Especial e não receberia a mesma redução de Growl.",
      "Anote o estágio separadamente do atributo original, respeitando os limites de −6 a +6. Ao terminar a batalha, siga as regras para remover modificações temporárias."
    ],
    "resultado": "Quick Attack pode ficar mais difícil de impor ou causar dano; Thunder Shock não tem seu Ataque Especial reduzido por Growl.",
    "porQue": "Um efeito muda exatamente o atributo indicado em sua descrição, não todos os ataques do Pokémon."
  },
  "2.4": {
    "quando": "Quando uma conta produziria dano mínimo, quando uma imunidade anula o golpe ou quando HP chega a zero.",
    "cena": "Pikachu usa Thunder Shock contra Geodude de Kanto, que é Rock/Ground. Thunder Shock é Electric e não causa dano em Pokémon Ground, a menos que algum efeito válido remova essa imunidade.",
    "como": [
      "Pikachu pode fazer a tentativa e gastar os PP correspondentes. Confira a precisão e, em seguida, os tipos atuais de Geodude.",
      "A imunidade Ground a Electric fixa o dano em zero. Não imponha o dano mínimo de 1 ponto. Se houver acerto válido e sem imunidade, um dano direto positivo arredondado não desaparece abaixo de 1.",
      "Se algum Pokémon alcançar 0 HP, marque que desmaiou e interrompa as ações que não poderia mais realizar."
    ],
    "resultado": "Geodude mantém o HP; Pikachu não recebe seus PP de volta por ter encontrado uma imunidade depois da tentativa válida.",
    "porQue": "Dano mínimo serve para um golpe que realmente causa dano, não para atravessar uma proteção de tipo."
  },
  "2.5": {
    "quando": "Quando Eevee conclui um desafio de verdade, em batalha ou fora dela, e o Narrador decide recompensar quem participou.",
    "cena": "Um Eevee de teste no nível 10 está com 4 XP guardadas. Ele ajudou seu Treinador a voltar à trilha depois de uma tempestade. O Narrador considera o desafio comum e lhe concede 1 XP; esta é uma situação reproduzida no teste do Guia.",
    "como": [
      "Antes de conceder, confirme que o desafio terminou e ainda não foi premiado. Se foi combate, finalize a rodada e encerre a batalha. Decida quem contribuiu de verdade; não recompense só quem ficou na Box.",
      "Some a recompensa ao saldo de Eevee. Para ir do nível 10 ao 11, a meta é a parte inteira de metade de 11, ou 5 XP. Assim, as 4 guardadas mais 1 recebida alcançam a meta.",
      "Desconte 5 e aumente Eevee para o nível 11, com 0 XP restante. A recompensa também oferece 2 EVs para distribuir conforme os limites de treinamento do RPG."
    ],
    "resultado": "Eevee chega ao nível 11 com 0 XP guardada e 2 EVs disponíveis; não some o mesmo desafio outra vez.",
    "porQue": "A recompensa reconhece o desafio concluído, preserva a sobra de XP e evita crescimento artificial por repetir ações sem risco."
  }
});
