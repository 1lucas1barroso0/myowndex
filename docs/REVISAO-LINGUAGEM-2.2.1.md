# Linguagem, condições e leitura inicial — 2.2.1

As 50 regras permanecem completas, com os mesmos IDs, números de leitura, exemplos e procedimentos independentes do aplicativo. A primeira leitura passa a mostrar decisões curtas antes das contas. Fórmulas, procedimentos com papel e dados, cenas completas e exceções continuam nos detalhes. O livro acompanha a organização e preserva os procedimentos canônicos.

## Nomenclatura e explicações

Os nomes oficiais do catálogo são mantidos. Não foi publicada a proposta de renomear Poison ou Badly Poisoned para nomes inventados em português. Tipos, movimentos, habilidades, itens e formas continuam com os nomes oficiais de referência. As explicações em português descrevem o efeito sem substituir seu nome.

`conditionHelp.js` é a fonte comum dos nomes e da ajuda de condições na ficha, Aventura, Dados e Guia. Cada explicação informa o efeito, o momento e como termina. A ajuda de Confusion e Flinch distingue os efeitos temporários da condição persistente. Status continua sendo uma categoria de movimento, com significado explicado; tipo Poison e condição Poison são distinguidos.

A ação de preparar a iniciativa aparece como “Definir a ordem”; o painel usa “Ordem da rodada”. As escolhas de ação usam “Passar a vez” e “Improvisar”. São instruções do aplicativo, não novos nomes de mecânicas oficiais de Pokémon. Os códigos internos permanecem compatíveis com dados anteriores.

## Coerência mecânica

Badly Poisoned aumenta sua força no fim da rodada mesmo quando Magic Guard ou Poison Heal impede a perda de HP. O aumento respeita o limite existente. Trocar reinicia a força, mas não cura por si só; habilidades que curam ao sair mantêm sua exceção. Pokémon no banco não recebem a aplicação do fim de rodada. Uma perda arredondada para 0 não cura, não cria dívida e não congela o aumento.

O novo caso reproduzido compara três fins de rodada de um Pikachu identificado, começando com HP cheio, em duas sequências independentes. Na segunda, Umbreon aplica Toxic, aprendido por TM06 em HeartGold/SoulSilver, com dados de movimento dessa edição. A ficha, a escala RPG, o HP, os sorteios e os resultados são explícitos. O caso anterior de Ekans com Poison Sting continua separado. Ambos são casos de teste, não registros de uma aventura de usuário.

Lum Berry passa a curar Confusion junto da condição; Persim Berry cura somente Confusion. A aplicação é conferida tanto ao resolver o movimento quanto ao encerrar uma rodada. Itens inativos não curam. Os perfis de consulta acompanham o comportamento, com regressões de Supersonic, veneno simultâneo e Klutz.

## Apresentação

O Noctowl do cabeçalho do Guia usa uma área de 96 px, com proporção original e sprite inteiro. O cabeçalho permanece compacto, alinhado ao conteúdo e sem decoração que crie espaço vazio artificial. Comparações ficam em duas colunas quando há largura e em uma no celular. Controles de ajuda têm alvo de pelo menos 44 px e foco de teclado. A ajuda só aparece junto da ficha quando há uma condição selecionada.

## Referências conferidas em 24/10/2026

- [Guia oficial de Brilliant Diamond/Shining Pearl — condições e tipos](https://diamondpearl.pokemon.com/en-us/trainersguide/fundamentals/battling/): nomes oficiais e distinção entre envenenamento e envenenamento que se intensifica. As chances e durações do RPG são adaptações expressas, não uma transcrição desse guia.
- [Pokémon Showdown — conditions.ts](https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts): referência técnica comunitária para o contador de Toxic, incremento anterior à aplicação de dano e reinício ao entrar. Não é uma fonte oficial de Pokémon.
- [Serebii — Umbreon em Diamond/Pearl/Platinum/HeartGold/SoulSilver](https://www.serebii.net/pokedex-dp/197.shtml): referência comunitária de aquisição por TM06 e dados históricos de Toxic: precisão 85 e 10 PP.
- Fontes locais: `guidePlaySteps.js`, `guidePaperSteps.js`, `rpgRules.js`, `guideAuditFixtures.js`, `conditionHelp.js`, `room.js` e `battleConditions.js`.

## Validação e limite

721 testes unitários passaram, incluindo a reprodução dos casos e regressões de força de Badly Poisoned sem dano, prevenção por habilidade, troca, banco e cura. Lint e tipos passaram. A validação de compilação e navegador acompanha a publicação. Testes técnicos e leitura editorial não comprovam que toda criança de 6 anos compreenderá todo o produto; essa confirmação exige observação com pessoas.
