# Variantes e formas — MyOwnDex 2.0.6

A 2.0.6 fixa a fronteira da atualização de variantes sem alterar o comportamento histórico das formas puramente estéticas.

## Regra principal

O novo meio de segregação da Pokédex existe somente quando **as duas condições abaixo são verdadeiras ao mesmo tempo**:

1. a forma é **não intercambiável**: o mesmo indivíduo não pode simplesmente trocar para a outra forma;
2. a forma representa, para o uso do MyOwnDex, um Pokémon realmente distinto em identidade e funcionamento, com diferença mecânica própria relevante e identidade narrativa que faça sentido preservar separadamente.

Se qualquer uma das duas condições falhar, não há nova segregação.

## O que continua agrupado

Formas puramente estéticas continuam como antes desta atualização. Elas não recebem uma linha nova na Pokédex, um filtro próprio de segregação nem peso extra no Gerador.

Isso vale mesmo quando a aparência:

- não pode ser trocada livremente;
- depende de sexo, padrão, cor, decoração ou acabamento;
- é rara ou vinculada a uma condição de obtenção;
- possui um nome próprio na fonte de dados.

**Formas intercambiáveis também nunca recebem essa segregação.** Se o mesmo Pokémon pode mudar de uma forma para outra, continua sendo o mesmo indivíduo para essa organização, ainda que a mudança altere tipo, habilidade, atributos, golpes ou outra mecânica.

Estados temporários, transformações e modos do mesmo indivíduo também continuam dentro da ficha da espécie.

O catálogo técnico de formas permanece disponível internamente para sprites, referências e compatibilidade. Estar nesse catálogo não significa que a forma deva aparecer como entrada separada na Pokédex.

## O que pode ser separado

Variantes regionais continuam separáveis. Outras variantes só entram quando são **não intercambiáveis** e quando a diferença não é meramente visual, com uma identidade mecânica estável própria, por exemplo mudanças próprias de atributos, tipos, habilidades, repertório, evolução ou outra regra que faça aquela variante funcionar como um Pokémon diferente.

A classificação é conservadora: na dúvida, a forma permanece agrupada.

## Compatibilidade

Nenhuma migração é necessária.

Boxes, contas, aventuras, favoritos antigos e códigos do Link Cable continuam válidos. Campos opcionais de forma já gravados por versões anteriores continuam sendo lidos e compartilhados; a 2.0.6 apenas impede que formas puramente estéticas ganhem novos caminhos de segregação na Pokédex e no Gerador.

Assim, uma Box criada durante a 2.0.4 ou 2.0.5 não perde aparência, progresso ou identidade salva ao abrir na 2.0.6.

## Busca e filtros

A Pokédex mantém os recursos introduzidos na atualização anterior:

- geração;
- um ou dois tipos;
- intervalos fechados, como `310-560`;
- intervalos abertos, como `a partir de 700` e `até 940`;
- início e fim da National Dex em campos próprios;
- variantes regionais;
- favoritos e ordenação.

Esses filtros não mudam a regra acima. Uma forma estética continua agrupada mesmo quando poderia ser encontrada no catálogo técnico de formas.

## Gerador

O Gerador usa a mesma fronteira da Pokédex. Uma espécie não ganha mais chances de sorteio por possuir muitas aparências. Formas estéticas não aparecem como escolhas segregadas novas. Variantes realmente distintas podem ser escolhidas quando a fonte e as regras do jogo as tratam como identidades próprias.

A seleção continua compatível com dados antigos e com a lógica de geração já validada.
