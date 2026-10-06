# Gerador justo e intuitivo — MyOwnDex 2.0.8

A 2.0.8 reorganiza o Gerador sem mudar as regras centrais do MyOwnDex.

## Sorteio justo

O sorteio aleatório acontece em duas etapas:

1. o MyOwnDex sorteia uma entrada da Pokédex entre as entradas que passaram pelos filtros;
2. se essa entrada tiver mais de uma forma elegível e excludente, a forma é sorteada somente depois.

Ter duas, cinco ou vinte formas na mesma entrada não dá bilhetes extras para aquela entrada. A chance de chegar à entrada é definida antes da escolha da forma.

O filtro regional continua podendo reduzir o conjunto para variantes de Alola, Galar, Hisui ou Paldea. Isso não muda o princípio de igualdade entre as entradas que restarem.

## Três grupos de escolhas

### Encontro

Quantidade e nível dizem quantos Pokémon serão criados e em qual nível.

### Quem pode aparecer

Há dois caminhos que não se misturam:

- **Escolha direta:** define um Pokémon ou uma forma específicos. Ao escolher diretamente, tipo, geração, região e lendários/míticos voltam aos valores neutros.
- **Sortear pela Pokédex:** permite combinar filtros de tipo, geração de estreia, variante regional e lendários/míticos.

“Geração de estreia” não escolhe um jogo. Ela só limita a geração em que a entrada ou variante apareceu pela primeira vez.

“Variante regional” não transforma uma espécie comum. Ela limita o sorteio às variantes daquela região.

### Como vem a ficha

Natureza, Shiny e Hidden Ability são aplicados depois que a entrada foi escolhida. Essas opções não mudam o peso de uma entrada no sorteio.

O **Jogo de referência** define os golpes disponíveis. No modo Jogos, também limita a geração aos dados existentes naquela época.

## Linguagem e segurança do encontro

A interface deixa de chamar o resultado atual de “prévia”. O jogador vê um **encontro** que pode guardar no PC, exportar, limpar ou substituir.

Ao pedir um novo encontro enquanto ainda existem Pokémon não guardados nem exportados, a confirmação explica diretamente o que será substituído e oferece **Continuar neste encontro** ou **Criar novo encontro**.

## Pokédex

Os controles de variantes também ficam mais distintos:

- **Uma entrada** mantém a lista compacta;
- **Mostrar variantes** abre separadamente apenas as variantes que o MyOwnDex trata como Pokémon diferentes.

Formas intercambiáveis e diferenças apenas de aparência continuam sempre dentro da mesma ficha.
