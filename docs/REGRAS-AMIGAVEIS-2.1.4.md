# Regras com linguagem acolhedora — 2.1.4

A leitura deve ajudar crianças e fãs experientes a viver uma aventura Pokémon. Esta revisão editorial preserva as 48 regras e seus IDs nos oito capítulos. Não muda dados de espécies, efeitos, sorteios, balanceamento ou fichas salvas.

## O que muda

- Cada regra começa com uma explicação curta e traz um exemplo concreto antes dos detalhes. Os textos usam frases mais curtas, parágrafos separados e listas quando ajudam a acompanhar escolhas.
- Os títulos descrevem a situação de jogo: “Sua vez de agir”, “Hora de descansar”, “Posso tentar de novo?” e “Aguentar um golpe decisivo”. Termos necessários, como HP, PP, XP, IVs, EVs e STAB, recebem explicações. Nomes próprios dos jogos permanecem reconhecíveis.
- Regras extensas conservam seus números e exceções. Captura distingue parceiro selvagem consciente de desmaiado; Max explica a soma antes da multiplicação; Amizade valoriza acontecimentos; coletivos explicam tarefas indispensáveis e o risco compartilhado.
- A busca encontra títulos, resumos, exemplos e detalhes, com acentos e consultas anteriores preservados.
- A proteção de sobrevivência usa o mesmo texto e exemplo no Guia e nos painéis de batalha. A regra completa fica dividida em parágrafos. As ajudas de captura, XP, Amizade e início/fim de batalha acompanham a redação.
- A versão do aplicativo e do cache offline passa para 2.1.4, para o texto atualizado chegar aos dispositivos conectados.

## Coerência

Os IDs, a ordem e as funções de cálculo de `rpgRules.js` são comparados com a 2.1.3. O código das funções a partir de `rollAttributeTest` permanece idêntico (SHA-256: `dd2486e8de4d6624df2031ea397917d765ca9a9a373552da3666ce73b75eade2`). As quatro sugestões de erro crítico usam a mesma redação do Guia. Explicações de adaptação do RPG continuam explícitas; uma linguagem acolhedora não transforma essas adaptações em regras oficiais.

As verificações de conteúdo acompanham a nova redação mantendo os mesmos requisitos mecânicos. A consulta por um trecho exclusivo de exemplo também precisa encontrar a regra correta.

## Verificação e limites

A verificação local passou com 696 testes unitários, lint, tipos e compilação completa com preparo offline. Na cópia de QA, o navegador mostrou os 48 exemplos e as 48 regras abertas, sem transbordamento horizontal em 320 e 1280 px. Foram inspecionados os temas Claro e Escuro, captura, XP, Dynamax, testes coletivos e proteção de sobrevivência. A busca por um trecho exclusivo de exemplo encontrou a regra correta; o salto da calculadora abriu a proteção e seu detalhamento, preservando o foco. A conversão de valor original 20 mostrou atributo 2 e HP 3.

O CI completo do commit deve passar antes da publicação; o histórico do repositório registra os resultados vinculados ao commit.

Compreensão por crianças e diversão exigem pessoas usando o jogo. Esta revisão não declara uma avaliação humana que não ocorreu. O roteiro de observação está em [VALIDACAO-2.1.0.md](VALIDACAO-2.1.0.md).
