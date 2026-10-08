# Animações exatas — revisão 2.0.18

Os Pokémon usam quadros de animação publicados para a aparência que está em jogo. Toedscool e Scovillain, por exemplo, usam GIFs reais do catálogo Showdown do PokéAPI, também em Shiny e nas costas. Não há balanço de CSS, troca de espécie, recoloração ou interpolação para simular vida.

A seleção preserva a identidade, a máscara, a decoração, a paleta Shiny, o ângulo e as diferenças visíveis de gênero. Um `pokemon-form` tem seu próprio identificador: ele é resolvido pela tabela `formKeys`, nunca tratado como se fosse um `pokemon` de outro número. Formas cosméticas continuam agrupadas na Pokédex; ampliar a cobertura de sprites não muda a política de separar variantes nem os resultados do sorteio.

## Fontes fixadas

| Fonte | Commit | Uso |
| --- | --- | --- |
| PokéAPI/sprites | `d72f64eb74912747cb5c5579061ced4842ba0a98` | GIFs de Black/White e modelos Showdown; disponibilidade por paleta, gênero e ângulo. |
| smogon/sprites | `bad55c7b7e7292f459366505460d41dcab08d4cd` | Identidades exatas ausentes no índice anterior, sem alterar a aparência. |
| ChromeValiant/Pokemon-Essentials-21-With-Unofficial-EBDX | `836bb026ba8f6c3b3ee3bb6d461c510263953a02` | Folhas de quadros publicadas para espécies recentes, máscaras de Ogerpon e Megaevoluções de Pokémon Legends: Z-A. |
| PMDCollab/SpriteCollab | `27c65cc0164c3f0dc91ad42989ee4d50267e66a5` | Pichu de orelha espetada, Arceus de tipo desconhecido, as 63 aparências de Alcremie e Miraidon em modo de baixa potência. |
| PokéAPI/pokeapi | `2ee1c422ad9f3831245dab0ac2a5cd1aae61cd72` | Catálogo de 1.351 recursos de Pokémon e 1.579 identificadores de formas. |

O índice é local e determinístico. Cada cartão faz consultas a conjuntos em memória, sem buscar metadados nem sondar URLs em tempo de execução. Fontes animadas desconhecidas não são inventadas. Cores Shiny nunca são recuperadas usando a cor normal. Quando duas aparências têm o mesmo desenho oficial, uma imagem pode ser compartilhada; isso não transforma os dois identificadores em uma só escolha de jogo.

## Fidelidade e acessibilidade

As folhas de batalha EBDX conservam todos os quadros, os pixels visíveis, a transparência e os 100 ms por quadro da origem. Quadros idênticos podem ser reunidos pelo codificador GIF, conservando sua duração. Mega Barbaracle Shiny usa seu ícone original de menu, com duas poses e o ciclo nativo de 250 ms: são 125 ms por quadro, preservados exatamente em APNG. A proveniência identifica essa fonte como `native-menu-icon`, sem atribuir a ela movimento corporal de batalha. As folhas SpriteCollab conservam os canais RGBA em APNG, incluindo transparência parcial; seus tempos nativos de 60 quadros por segundo são convertidos com erro total máximo de 0,5 ms. A sequência e os quadros não são redesenhados.

Cada animação importada tem uma imagem PNG do primeiro quadro. A preferência por movimento reduzido usa essa imagem estática. Se uma fonte animada falhar, o componente tenta outra fonte da mesma identidade e depois a recuperação estática. Se nenhuma imagem exata estiver disponível, mostra o estado de ausência; nunca mostra outro Pokémon para esconder a falha. O listener de movimento é compartilhado e suas atualizações são agrupadas, preservando o comportamento da Pokédex com centenas de sprites.

As fontes nativas ficam fora do precache do shell. São obtidas sob demanda; o cache de imagens continua limitado por quantidade e tamanho. Não é necessário outro domínio na CSP nem uma nova dependência da aplicação.

## Cobertura e limites verificáveis

As 1.025 espécies da Pokédex Nacional, as 1.112 escolhas expostas pela política atual da Pokédex e as 431 aparências do catálogo persistente têm animação exata de frente em normal e Shiny. A auditoria também percorre todos os 1.351 recursos técnicos e os 1.579 identificadores de formas, incluindo Megaevoluções, formas temporárias e cosméticas. O arquivo `src/data/native-sprite-coverage.json` registra nominalmente qualquer ângulo ou paleta sem animação exata nas fontes fixadas; os testes impedem perdas silenciosas de cobertura.

Uma fonte externa pode estar incompleta ou errada. Os dois battlers Shiny de Mega Barbaracle no EBDX foram rejeitados porque repetiam a paleta normal. A proveniência guarda os hashes e o motivo; esses arquivos não são publicados como se fossem Shiny. Modos de transporte de Koraidon e Miraidon são identidades próprias e não são substituídos por suas formas de combate. Ausências técnicas registradas na auditoria não são anunciadas como cobertura completa.

No snapshot desta revisão, há 29 combinações técnicas de ângulo e paleta sem animação exata: sete modos de transporte de Koraidon/Miraidon nas quatro vistas e as costas de Mega Barbaracle Shiny. São 5.375 combinações disponíveis entre as 5.404 verificadas. Todas as demais identidades técnicas têm animação de frente em normal e Shiny. Miraidon em modo de baixa potência tem fonte própria, incluindo suas costas. Os 1.579 identificadores de forma também são percorridos; 14 combinações de forma e paleta correspondem aos sete transportes ainda sem arte. Esses casos permanecem registrados para atualização, sem confundi-los com as escolhas expostas e já cobertas da Pokédex.

## Créditos

O rodapé recolhido aponta para `/sprites/native/credits.txt`. Esse texto consolida autores, fontes e links reais. A lista integral dos colaboradores EBDX está em `/sprites/native/credits-ebdx.md`; o projeto foi publicado para a comunidade de fãs e não declara licença SPDX específica. Não o rotular como MIT ou CC0. SpriteCollab usa CC BY-NC 4.0: atribuição, autores e política original estão preservados em `/sprites/native/credits-pmd.txt` e `/sprites/native/policy-pmd.md`. A arte de Pokémon conserva seus titulares originais.

## Reprodução e validação

As proveniências públicas `provenance-ebdx.json`, `provenance-pmd.json` e `provenance-menu-icon.json` incluem origem, commits, hashes, dimensões, quadros e tempos. Para reproduzir as importações, obtenha cópias sem alterações dos repositórios nos commits acima. O script trabalha somente sobre arquivos locais e escreve em uma pasta de revisão. Ele compara os hashes da origem, todos os pixels e a sequência temporal, e exige que os arquivos regenerados coincidam com os hashes publicados. Pillow 12.3.0 é ferramenta de manutenção, sem dependência nova no jogo.

```sh
python3 scripts/reproduzir-animacoes-nativas.py \
  --ebdx /tmp/ebdx-source \
  --pmd /tmp/pmd-source \
  --output /tmp/myowndex-native-rebuilt
```

O catálogo de identidades pode ser verificado contra `pokemon.csv` e `pokemon_forms.csv` do commit PokéAPI registrado:

```sh
python3 scripts/atualizar-identidades-animacoes.py \
  --pokemon-csv /tmp/catalogue/pokemon.csv \
  --forms-csv /tmp/catalogue/pokemon_forms.csv \
  --check
```

`scripts/atualizar-indice-animacoes.py` verifica a disponibilidade dos oito ângulos/paletas de cada árvore de animação. Subárvores truncadas são rejeitadas. Os testes de sprites verificam identidade, todas as escolhas da Pokédex, reaproveitamento em salas, preferência por movimento reduzido, hashes dos arquivos, quadros e tempos reais. O QA de navegador confirma múltiplas poses visíveis para Toedscool e Scovillain sem transformação artificial.

`node scripts/verificar-cobertura-animacoes.mjs` verifica o snapshot de cobertura integral. Depois de revisar uma fonte nova, `--write` atualiza a lista de ausências; isso não adiciona arte nem altera a política da Pokédex. A reprodução local desta revisão comprovou 497 linhas do tempo nativas, incluindo combinações que compartilham o mesmo arquivo Shiny de Alcremie.
