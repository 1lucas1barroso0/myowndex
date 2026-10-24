/** Cenas completas: habilidades, itens, tipos e formas. */
export const GUIDE_WORKED_SCENES_7 = Object.freeze({
  "7.1": {
    "quando": "Quando o evento descrito por uma habilidade acontece, como entrada em campo, contato físico, alteração de clima ou fim de rodada. A habilidade não funciona continuamente por estar escrita na ficha.",
    "cena": "Gyarados entra em campo diante de Eevee. Se tem Intimidate ativa e Eevee não está protegido contra essa redução, Intimidate diminui o Ataque de Eevee em um estágio.",
    "como": [
      "Confirme que este Gyarados possui Intimidate, que ela não foi anulada e que a entrada em campo ocorreu de verdade.",
      "Verifique se Eevee é um alvo afetável. Se for, anote um estágio a menos no Ataque de Eevee, dentro do limite permitido. Intimidate não aplica dano nem reduz o Ataque Especial.",
      "Quando Eevee tentar um movimento físico, como Tackle, use o Ataque reduzido. Se escolher um movimento especial, não reduza seu Ataque Especial por causa desta habilidade."
    ],
    "resultado": "Eevee continua podendo agir, mas seus golpes físicos podem ficar menos eficazes. Gyarados não ativa Intimidate novamente só porque alguém reabriu a ficha.",
    "porQue": "Uma habilidade tem condições, alvo e momento precisos: não é um bônus universal independente da situação."
  },
  "7.2": {
    "quando": "No momento descrito no item que o Pokémon segura, como perder HP, acertar um golpe ou sofrer um efeito. Um item consumido não reaparece por começar outra rodada.",
    "cena": "Eevee segura uma Oran Berry e sofre um Tackle válido de Pidgey. Se o HP de Eevee alcançar a condição de ativação da Berry, ela pode recuperar HP. A Berry não causa dano no Pidgey.",
    "como": [
      "Antes de Tackle, confirme que Eevee realmente está segurando a Oran Berry, que ela não foi usada ou removida, e que nenhum efeito bloqueia o item.",
      "Depois do impacto de Pidgey, confira o HP restante de Eevee e a condição de ativação. Se a Berry funcionar, aplique a recuperação prevista, sem superar o HP máximo.",
      "Marque a Berry como consumida. Se Eevee ainda estiver ferido na rodada seguinte, não ative outra vez o mesmo item. Apenas uma reposição ou recuperação válida o devolve."
    ],
    "resultado": "Eevee pode recuperar parte do HP e deixa de segurar aquela Oran Berry. A ação de Pidgey e o gasto de PP não são desfeitos pela cura posterior.",
    "porQue": "O item pertence a um indivíduo, tem um gatilho e um consumo. Isso permite registrar efeitos sem curas duplicadas."
  },
  "7.3": {
    "quando": "Quando uma forma tem uma condição própria, como item, habilidade, estado ou ocasião permitida. Uma variante regional não é uma transformação livre entre espécies ou lugares.",
    "cena": "Venusaur segura Venusaurite e seu Treinador possui Key Stone. Numa batalha em que Mega Evolução é permitida, ele pode transformar Venusaur em Mega Venusaur diante de Blastoise.",
    "como": [
      "Antes da transformação, confirme que Venusaur é elegível, que tem Venusaurite, que o Treinador dispõe da Key Stone e que o formato de batalha permite essa mecânica.",
      "No momento autorizado, registre a forma Mega e aplique os atributos e a habilidade corretos. A transformação não gasta automaticamente uma nova vez nem oferece um golpe gratuito.",
      "Quando a forma terminar, volte aos dados originais sem apagar HP perdido, histórico, item ou condição que a transformação não recupera."
    ],
    "resultado": "Mega Venusaur continua sendo o Venusaur daquele Treinador, temporariamente transformado. Um Venusaur sem Venusaurite não ganha essa forma porque o jogador a descreveu.",
    "porQue": "Formas e variantes são partes reais da identidade de Pokémon; suas condições não podem ser trocadas por bônus narrativos arbitrários."
  },
  "7.4": {
    "quando": "Quando um movimento pode copiar, aprender ou chamar outro golpe válido. Cada técnica tem critérios de alvo e duração próprios.",
    "cena": "Eevee usa Tackle. Mais tarde, Bonsly usa Mimic tendo Eevee como alvo válido. Mimic copia temporariamente o movimento observado; não transforma Bonsly em Eevee e não ensina Tackle permanentemente.",
    "como": [
      "Confira que o Eevee realmente usou Tackle e que ele é um movimento que Mimic pode copiar naquela situação. Bonsly precisa saber Mimic e ter PP para usá-lo.",
      "Na vez de Bonsly, resolva Mimic e substitua temporariamente sua opção pelo Tackle copiado com 5 PP, conforme a regra do RPG. Não obtenha novo turno nem copie todos os movimentos de Eevee.",
      "Ao encerrar o efeito, recoloque Mimic e os PP que estavam guardados. Sketch é diferente: permite aprender permanentemente um movimento válido e substitui Sketch."
    ],
    "resultado": "Bonsly pode usar temporariamente Tackle nas condições previstas, mas não o mantém depois que Mimic termina.",
    "porQue": "Copiar por uma cena, aprender para sempre e chamar um movimento dentro de outra ação são três resultados distintos."
  },
  "7.5": {
    "quando": "Depois que um golpe alcança um alvo, quando se precisa saber se o tipo causa dano, se é resistido ou se ganha bônus pelo tipo do atacante.",
    "cena": "Bulbasaur usa Vine Whip, movimento Grass, contra Geodude de Kanto, do tipo Rock/Ground. Os dois tipos são fracos contra Grass, então o golpe é quatro vezes superefetivo se for válido e acertar. Pikachu usa Thunder Shock contra esse mesmo Geodude, mas Ground concede imunidade a Electric.",
    "como": [
      "Confira qual forma de Geodude está no campo. O de Kanto é Rock/Ground; o de Alola é Rock/Electric. Não altere os tipos por causa de um retrato ou sprite diferente.",
      "Para Vine Whip, se o golpe vencer a disputa e a precisão, aplique a vantagem de tipo apropriada. Bulbasaur também recebe STAB porque Grass é um de seus tipos. Limites e proteções continuam contando.",
      "Para Thunder Shock contra Geodude de Kanto, aplique dano 0 por imunidade, mesmo que o golpe tivesse acertado. Contra Geodude de Alola, Electric não tem a mesma imunidade, mas sua combinação de tipos resiste ao golpe."
    ],
    "resultado": "Vine Whip pode atingir com superefetividade o Geodude de Kanto; Thunder Shock não remove HP desse alvo. Contra a forma de Alola, o cálculo é outro.",
    "porQue": "Tipo, espécie e forma são verificações obrigatórias; fraqueza não corrige um ataque errado e imunidade não pode ser ignorada por um dano mínimo."
  },
  "7.6": {
    "quando": "Sempre que uma ação válida será resolvida. Também importa ao consultar um resultado já registrado: consultar não executa a ação outra vez.",
    "cena": "Pikachu escolhe Thunder Shock contra Eevee. A tentativa tem um começo, uma sequência de verificações e um registro final; abrir o Diário depois não é usar Thunder Shock outra vez.",
    "como": [
      "Primeiro confira a ação, a condição de Pikachu, PP e validade do alvo. Depois resolva disputa física ou especial quando houver, precisão e imunidades.",
      "Se o movimento atingir, calcule o dano, as proteções e os efeitos próprios. Aplique condição extra, contato, custos, cura e nocaute na ordem correta e somente quando cada condição for satisfeita.",
      "Registre PP gasto, HP alterado, efeitos e quem recebeu cada consequência. Não refaça sorteios já resolvidos ao examinar os detalhes no Diário."
    ],
    "resultado": "A ficha de Eevee e a de Pikachu mostram apenas os efeitos daquele Thunder Shock; um novo ataque exige outra oportunidade de agir.",
    "porQue": "Ter uma ordem única evita recuperar HP indevidamente, aplicar uma condição antes do acerto ou cobrar PP duas vezes."
  },
  "7.7": {
    "quando": "Antes da iniciativa de uma batalha que permite Dynamax ou Gigantamax, quando o Treinador tem seu uso disponível. O nível Dynamax do Pokémon não equivale à autorização de transformar.",
    "cena": "No caso auditado, um Pikachu de nível 20, com nível Dynamax 10, está com 4 de 6 HP. Numa batalha autorizada nos moldes de Sword/Shield, seu Treinador escolhe Dynamax antes da iniciativa.",
    "como": [
      "Confirme que o formato permite a transformação, que o Treinador ainda tem o uso e que Pikachu é elegível. Guarde o HP original, o HP atual e o nível Dynamax.",
      "No nível Dynamax 10, o HP máximo dobra: nesta ficha Pikachu passa de 4/6 para 8/12 HP. Os ferimentos anteriores continuam proporcionalmente presentes. Os ataques transformados passam a obedecer aos movimentos Max previstos.",
      "Ao terminar sem sofrer outra cura ou dano, a ficha volta exatamente para 4/6 HP. Se o HP mudou durante a transformação, faça a conversão inversa com as regras de arredondamento. Não devolva PP, ação ou uso de transformação."
    ],
    "resultado": "Pikachu cresce temporariamente e retorna sem uma cura escondida. Gigantamax usa o mesmo mecanismo de HP, mas exige espécie e fator Gigantamax compatíveis.",
    "porQue": "A transformação concede benefícios específicos por tempo limitado, preservando as consequências anteriores da batalha."
  }
});
