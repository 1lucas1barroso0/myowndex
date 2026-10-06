# Identidade da Pokédex e contrato dos Dados — MyOwnDex 2.0.9

A 2.0.9 fixa duas regras transversais: o MyOwnDex usa o mesmo vocabulário para a mesma coisa em todas as telas, e nenhuma rolagem pode ganhar uma distribuição diferente só por acontecer em outro modo.

## Identidade da Pokédex

### Entrada da Pokédex

Uma **entrada da Pokédex** é uma entrada numerada da Pokédex Nacional. O número continua sendo o mesmo quando essa entrada possui variantes.

A **geração de estreia** da entrada é a geração em que aquela entrada numerada surgiu.

### Variante

Uma **variante** é uma alternativa que o MyOwnDex trata como um Pokémon diferente segundo a regra vigente de variantes. Ela pode compartilhar o número de uma entrada mais antiga e ainda assim ter sua própria geração de estreia.

Exemplo estrutural: uma entrada pode ter estreado na Geração V e uma variante válida dessa mesma entrada ter estreado na Geração VIII. Filtrar pela Geração V encontra a entrada original; filtrar pela Geração VIII pode encontrar a variante posterior.

O filtro é aplicado à identidade que realmente está sendo mostrada, não apenas ao número da Pokédex Nacional.

### Variante regional e região da variante

Uma **variante regional** é uma variante canônica de Alola, Galar, Hisui ou Paldea.

**Região da variante** significa somente a região dessa variante. O filtro não quer dizer “Pokémon que vive nessa região”, “Pokémon que estreou nessa geração” ou “Pokémon cujo nome contém a região”.

Trajes, chapéus, estados Totem e outras formas que apenas contenham um nome regional não passam a ser variantes regionais.

### Forma

**Forma** é reservada às formas do mesmo Pokémon que continuam na mesma ficha conforme a regra vigente. Formas intercambiáveis e diferenças apenas visuais não aparecem como Pokémon separados só porque possuem aparência, tipo, habilidade, atributos ou outro comportamento diferente.

Pokédex e PC usam a mesma função para decidir quais formas podem aparecer no seletor de formas. Uma variante separada nunca aparece ali como se fosse uma transformação livre.

## Filtro e exibição são coisas diferentes

Filtros decidem **quem pode aparecer**. O modo de exibição decide **como os resultados válidos são mostrados**.

Por isso:

- escolher uma geração de estreia não liga nem desliga “Mostrar variantes”;
- escolher uma região da variante não muda o modo de exibição;
- trocar entre “Uma entrada” e “Mostrar variantes” não apaga filtros;
- primeiro todos os filtros são aplicados;
- depois “Uma entrada” mantém no máximo um resultado por número da Pokédex Nacional;
- se somente uma variante posterior corresponde aos filtros, ela representa aquela entrada na lista compacta em vez de desaparecer;
- “Mostrar variantes” mostra todas as variantes válidas que passaram pelos mesmos filtros.

## Vocabulário fixo

A interface atual usa estes termos com estes significados:

- entrada da Pokédex;
- variante;
- variante regional;
- forma;
- geração de estreia;
- região da variante;
- jogo de referência;
- encontro.

`docs/voice-and-terminology.md` é a referência editorial para novas telas.

## Sorteio do Gerador

O sorteio aleatório continua em duas etapas:

1. sorteia-se uma entrada da Pokédex entre as entradas que passaram pelos filtros;
2. depois é escolhida uma variante elegível daquela entrada, quando houver mais de uma possibilidade.

Quantidade de variantes nunca dá bilhetes extras para a entrada.

Geração de estreia e região da variante são avaliadas antes desse sorteio. Assim, uma variante posterior pode entrar na geração em que ela própria estreou sem puxar junto a identidade antiga, e um filtro regional não inclui Pokémon comuns da região.

## Contrato dos Dados

Todas as rolagens usam o mesmo núcleo de aleatoriedade.

### Fonte

Em produção, o MyOwnDex usa Web Crypto. Não existe fallback para `Math.random`. Se a fonte segura não estiver disponível ou entregar algo inválido, a rolagem falha sem inventar um resultado.

### Distribuição

Inteiros limitados usam rejection sampling. Isso remove o viés que apareceria ao aplicar módulo diretamente quando o tamanho do espaço aleatório não fosse divisível pelo número de resultados.

A suíte verifica:

- cada face de d4, d6, d8, d10, d12, d20 e d100;
- 2d6 Normal;
- 3d6 com Vantagem mantendo os dois maiores;
- 3d6 com Desvantagem mantendo os dois menores;
- chances percentuais Normais;
- chances percentuais com Vantagem, usando o menor de dois d100;
- chances percentuais com Desvantagem, usando o maior de dois d100;
- extremos de 0% e 100%;
- paridade entre Dados local e Dados da Aventura;
- recibos alterados, faces impossíveis, quantidades erradas e resultados forjados.

### Aventura

Rolagens compartilhadas são resolvidas pelo servidor. O dispositivo envia escolhas, não resultados. Um resultado enviado pelo cliente é rejeitado.

O mesmo identificador de solicitação não pode gerar duas respostas diferentes: repetir a mesma solicitação devolve o resultado já confirmado, enquanto tentar reutilizar o identificador com outra escolha é rejeitado.

### Histórico

Um recibo salvo é conferido de novo antes de ser aceito. Faces, quantidade de dados, dados mantidos, total, sucesso, crítico e erro crítico precisam concordar com as regras da rolagem. Um recibo impossível é descartado em vez de ser mostrado como válido.
