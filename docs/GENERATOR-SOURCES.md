# Fontes do gerador de Pokémon

O índice local contém as 1.025 espécies nacionais, sem consultas externas para filtrar geração, Legendary, Mythical ou tipos. Os valores vêm integralmente dos campos `id`, `generation_id`, `is_legendary`, `is_mythical` e dos tipos atuais/históricos do catálogo PokeAPI. Os tipos pertencem à forma padrão de cada espécie. Não há classificações inferidas.

- Fonte: https://raw.githubusercontent.com/PokeAPI/pokeapi/bc92d3b6029ef1abe9e7ad424c400b338f3c11fe/data/v2/csv/pokemon_species.csv
- Commit fixado: `bc92d3b6029ef1abe9e7ad424c400b338f3c11fe`.
- SHA-256 do CSV: `e66e2eeb25fd3836b0ebab6bf87bbf01960aa3c0555e2bac495fa8393c5e0c45`.
- Arquivo local: `src/data/generator-species.json`.
- SHA-256 do índice: `08422c3def7c5d37ab472f6f8fce2d8d964ee56f1af9a48942a6823955c25872`.
- Espécies: 1.025; Legendary: 71; Mythical: 23.
- Tamanho do índice: 83750 bytes.

No modo Jogos, os tipos históricos evitam usar Fairy para Clefairy em Red/Blue ou Steel para Magnemite na primeira geração. A ficha é confirmada no learnset e nos dados reais da edição. Em RPG/Livre, conforme o PR #23, o jogo escolhe somente o repertório: tipos, atributos, habilidades, efeitos e PP seguem as regras atuais. HP usa o mesmo cálculo e a mesma conversão por 10 do restante do MyOwnDex. A referência local de movimentos é carregada desde a primeira geração, mesmo sem abrir uma ficha antes; a consulta nunca depende da ordem de navegação.

A regeneração opcional é `python3 scripts/atualizar-indice-gerador.py`. O script valida o SHA-256 dos cinco CSVs fixados: `pokemon_species`, `pokemon`, `types`, `pokemon_types` e `pokemon_types_past`. Não participa do build, da instalação nem do uso do site. As provas dos cinco arquivos estão no próprio script.

A prévia mantém no máximo seis Pokémon e é isolada por conta, com cópia durável em IndexedDB. A sincronização atualiza o gerador aberto sem fechar a janela; uma geração, salvamento ou edição em andamento não é substituída pelo recebimento de outra prévia. Nessa situação, a troca é explícita e exporta os parceiros ainda não guardados nem exportados antes de abri-la. O merge da conta mantém cópias de recuperação de prévias concorrentes. A ficha do PC também respeita a mesma seleção de regras e PP, sem misturar texto de uma edição antiga com valores atuais.

## Referência funcional

Consultamos https://pokeroledex.nl/home e o gerador em https://pokeroledex.nl/generators/pokemon, por seu JavaScript público `/assets/index-C5TRZdgt.js`. A referência oferece quantidade, espécie fixa ou aleatória, filtros por habitat e Legendary, seed e prévias individuais que podem ser adicionadas ou preservadas entre gerações. A inspiração é o fluxo de preparação rápida, seguido de inspeção e armazenamento; as regras próprias de Pokérole, ranks e estatísticas não são importadas. O MyOwnDex conserva seu próprio modelo de Pokémon, suas regras e dados de jogos oficiais.

O catálogo PokeAPI é uma fonte comunitária de dados dos jogos. Os direitos dos nomes, personagens e propriedades Pokémon permanecem com seus respectivos titulares.
