# Pokédex clara e filtrável — MyOwnDex 2.0.5

A 2.0.5 conclui a atualização de identificação, listagem, busca e leitura que havia ficado interrompida. O objetivo é facilitar encontrar o Pokémon certo sem transformar a Pokédex em uma lista repetitiva.

## Pokédex

A visualização normal continua com uma entrada principal por número da National Dex. Variantes que compartilham esse número não precisam ficar permanentemente abertas ao lado dela.

Em **Refinar Pokédex**, o jogador pode:

- filtrar pela geração de estreia;
- escolher um ou dois tipos;
- limitar a National Dex com **A partir de** e **Até**, usando os dois campos ou somente um;
- separar variantes quando quiser compará-las;
- filtrar diretamente variantes de Alola, Galar, Hisui ou Paldea;
- combinar esses filtros com busca, favoritos e ordenação.

A busca também entende intervalos fechados, como `310-560`, e expressões abertas, como `a partir de 700` e `até 940`.

A lista fica agrupada por padrão. Uma busca textual por uma variante, um filtro regional ou a opção **Separadas** revela as entradas específicas somente quando isso ajuda a responder à procura. Variantes favoritas continuam acessíveis sem invalidar favoritos antigos salvos apenas pelo número nacional.

Essa organização é uma regra de navegação do próprio MyOwnDex. Ela não cria categorias externas nem importa classificações de outros projetos.

## Tipos e variantes

Cada entrada usa os tipos atuais conhecidos do Pokémon ou da variante mostrada. Selecionar dois tipos exige que ambos estejam presentes.

Variantes regionais são identificadas pela região quando aparecem separadamente. Uma forma regional continua compartilhando o número nacional da espécie, mas pode ser localizada, filtrada e aberta sem ser confundida com a forma comum.

## Gerador

O Gerador recebe o mesmo filtro de região. Tipo, geração, região e forma explícita podem trabalhar juntos. O sorteio aleatório continua equilibrado por espécie para que uma espécie com muitas variantes não domine os encontros.

## Guia do Treinador

As 40 regras, de 1.1 a 8.5, agora começam com uma explicação curta em linguagem direta. O texto detalhado continua logo abaixo, com os mesmos cálculos e IDs.

**Vantagem** e **Desvantagem** permanecem nomes do mecanismo de dados. Efetividade de tipos usa os termos imunidade, resistência, neutralidade, fraqueza e superefetividade.

As referências ao registro compartilhado usam o nome atual **Diário da aventura**.

## Amizade

A Amizade continua manual. Os controles de ±5 e ±50 já existentes agora explicam a intenção de cada escala:

- 5 para uma mudança pequena;
- 50 para uma mudança grande.

O Narrador continua decidindo quando a história justifica aumentar, diminuir ou manter o valor.

## Ícone

Os SVGs principais agora possuem fundo completo até as bordas do arquivo. Isso remove cantos transparentes que podiam aparecer como bordas brancas em superfícies que não aplicavam uma máscara própria.

## Compatibilidade

A atualização não apaga nem migra Boxes, contas, aventuras, favoritos antigos ou códigos existentes. Os filtros da Pokédex são estado de interface e não alteram os dados salvos dos Pokémon.
