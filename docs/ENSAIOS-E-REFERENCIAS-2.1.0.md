# MyOwnDex 2.1.0 — ensaios ampliados e revisão crítica

23/10/2026. Trabalho local sobre a base pública 2.0.52. Nenhum deploy, push, promoção, publicação, compra, mensagem a terceiros ou alteração de dados reais de jogadores. O acesso direto ao site público confirmou o rodapé 2.0.52; os resultados da candidata 2.1.0 pertencem ao código local e à prévia de QA.

## O que foi realmente executado

- Duas revisões críticas de IA, separadas da implementação, com tarefas delimitadas e acesso de leitura ao código. São pareceres auxiliares do mesmo ambiente de IA, não avaliações humanas, serviços externos ou certificações de imparcialidade. Cada alegação aceita foi reproduzida pelo responsável pela implementação.
- Cinco reproduções iniciais falharam antes da correção e passaram depois. O arquivo `repro-revisao-ia.mjs` e os logs antes/depois acompanham o pacote. Os casos ampliados entraram na suíte do produto.
- **96 confrontos roteirizados**, quatro treinadores aliados com um Pokémon cada, contra Onix e Rhyhorn: níveis 10, 30 e 80; duas políticas; 16 sementes por combinação. Foram **2515 ações de combate**, **546 recusas de alteração tardia de declaração** e **50420 verificações** no ensaio completo.
- Em cada percurso: declaração antes da iniciativa, ordem real, combate autoritativo, PP, efeitos de fim de rodada, encerramento explícito, sincronização, recompensa narrativa com recibo sem duplicação, descanso, evento de amizade autorizado no roteiro, atualização da ficha, exportação/importação e persistência do documento de conta. As recompensas narrativas são separadas de vitória; um confronto abortado não é registrado como vitória.
- Distribuições exatas dos dados para Normal, Vantagem e Desvantagem; **10000 pares de atributos originais**, de 1 a 100, com comparação ponderada de todas as somas. **6500 estados de exibição de estágio**, todos os 16 padrões de sucesso/falha de quatro papéis e 32 sequências de perseguição.
- O estresse integrado anterior foi executado novamente após as correções: **920024 verificações**, incluindo captura, Max, dano sequencial e resíduos. Os 144000 duelos experimentais anteriores continuam evidência comparativa separada; não foram recontados como testes novos.

As decisões das pessoas fictícias são políticas escritas no script. Não ocorreram sessão humana, entrevistas, teste com crianças, observação de entusiasmo, instalação física Android/iOS ou execução de cartucho oficial. O roteiro não simula minutos reais, diversão ou compreensão. Dados de catálogo são referências, não prova de que jogamos o título oficial.

## Falhas reproduzidas e correções

| Caso | Antes | Comportamento local corrigido |
| --- | --- | --- |
| Box importada mais recente com revisão igual | Cena antiga podia regravar nível 30 como 20, XP 7 como 0, EVs pendentes 14 como 0 e HP 1 como 4 | Importação aceita cria uma nova revisão local da ficha; a cena precisa reconhecê-la antes de sincronizar. A importação inteira fornece os recursos explicitamente, sem herdar a comparação parcial de uma edição anterior. |
| Mimic e PP de outro slot | Copiar Surf no primeiro slot impedia registrar Tackle de 30 para 29 PP | A sincronização reverte somente as cópias temporárias numa cópia do token; gastos dos outros movimentos acompanham a ficha. |
| Mimic e Sketch juntos | Surf temporário podia se tornar permanente junto de Flamethrower aprendido | Só o override permanente de Sketch permanece. Mimic retorna ao próprio slot e aos próprios PP registrados. |
| Cópias seguidas de Transform | A identidade copiada apagava o registro de quais cópias anteriores eram temporárias | Transform guarda os overrides anteriores e os restaura na saída, inclusive após serialização. Cópias temporárias continuam temporárias; Sketch continua permanente. |
| XP durante Tera Shift | Terapagos subia ao nível 11, mas voltava ao HP original bruto 41 do nível 10, em vez de 44 | A subida atualiza a identidade-base e reaplica Tera Shift com os novos atributos. As duas formas permanecem coerentes; a sincronização usa o HP da identidade própria. Atualizar a ficha também refaz a base e a forma automática. |
| Código de Box e vínculo de parceiro | Exportar/decodificar recriava a identidade interna de cada parceiro, rompendo o vínculo com a cena | Novos códigos conservam o ID do parceiro. Ao inserir um Pokémon como novo parceiro em outra Box, a inserção continua criando uma identidade local nova. Códigos antigos sem ID continuam legíveis; não se adivinha identidade por posição ou nome. |
| Duas atualizações offline interrompidas | Um cache parcial recente substituía o último completo; abertura offline respondia 503 | A ativação procura o último shell utilizável. Versões com marcador de conclusão têm preferência pela ordem de criação; versões antigas sem marcador precisam ter raiz e os scripts/estilos referenciados. Caches parciais não expulsam a última abertura completa. |

Também foram corrigidas ambiguidades do Guia: estágios vizinhos podem mostrar o mesmo inteiro; participantes e papéis coletivos são definidos antes dos dados; o piso de 1 XP é individual, exige contribuição pertinente e exposição, e pode ultrapassar o total nominal de uma recompensa dividida. Exemplos de improvisação e teste coletivo tornam custo, ganho e risco verificáveis sem acrescentar subsistemas.

## Resultado do ensaio de combate

“Repetir” usa Thunderbolt de Pikachu contra Ground e ataques físicos comuns dos demais aliados. “Adaptar” muda Pikachu para Swift, usa Energy Ball/Water Pulse e começa Eevee com Tail Whip. Os atributos-base e os tipos são próprios das espécies; conjuntos de movimentos são fixtures explícitas com opções de TM, não resultados de geração de learnset. Não há bônus de chefe. Os adversários têm uma ação por rodada e alternam alvos por uma política fixa.

| Nível | Política | Vitórias aliadas / 16 | Vitórias adversárias | Sem fim em 30 rodadas | Mediana de rodadas concluídas |
| --- | --- | --- | --- | --- | --- |
| 10 | Repetir | 2 | 14 | 0 | 6 |
| 10 | Adaptar | 16 | 0 | 0 | 2 |
| 30 | Repetir | 0 | 16 | 0 | 7 |
| 30 | Adaptar | 16 | 0 | 0 | 1 |
| 80 | Repetir | 0 | 14 | 2 | 14 |
| 80 | Adaptar | 16 | 0 | 0 | 1 |

Esses resultados pertencem a **uma composição deliberadamente extrema, quatro contra dois**, com fraquezas quádruplas dos oponentes e políticas de escolha distintas. Não estimam a taxa geral de vitória, a duração típica nem o equilíbrio de todos os chefes. Uma luta longa pode ser insistência sem solução; uma curta pode recompensar conhecimento de tipos. A divisão do HP por 8 reduz fragilidade em relação ao modelo anterior, mas não promete um mínimo universal de rodadas.

A decisão é preservar fraquezas, defesas e diferenças de espécie. Preparar chefes exige conferir repertório dos dois lados, quantidade de ações, alternativas, sinais, terreno e objetivos. Se a única decisão de uma criança for repetir uma opção sem chance, o problema do encontro permanece. Se os jogadores montam uma boa resposta a uma fraqueza conhecida, a cena deve reconhecer a conquista. Não aumentar HP secretamente para impedir a solução.

## Defesa, estágios e apoio

A disputa usa atributos **originais com estágios**, não simplesmente o número dividido por 10 mostrado no cartão. Uma igualdade entre inteiros exibidos não prova igualdade na disputa. Por isso o Guia não promete que todo estágio adjacente altera o inteiro da ficha.

Com Ataque original 10 contra Defesa original 60, o maior ataque possível empata com a menor defesa; como empate favorece a defesa, o acerto por dano é impossível mesmo com Vantagem. No caso controlado inverso de ataque especial 60 contra defesa especial 10, **1295 das 1296** combinações normais de quatro dados superaram a disputa. Não são probabilidades universais de um encontro nem atravessam imunidade, precisão ou outras proteções. O núcleo real confirmou os limites; Vantagem não torna qualquer ação possível.

Nos 6500 estados de exibição observados, houve 467 pares adjacentes com o mesmo inteiro. Nenhum caminhou contra o estágio. Conservamos os estágios e a disputa mais precisa em vez de fabricar bônus de +1 para cada degrau.

Em um teste de Treinador com dificuldade 7 e exigência de superar: Normal tem 15 sucessos em 36; repetição imediata sem mudança, em Desvantagem, tem 42 em 216; ajuda/preparação com Vantagem tem 147 em 216. São contagens exatas, não saldo de jogo fracionário. Nova tentativa mantém custos e perigo; uma abordagem nova remove a penalidade de repetição, sem apagar consequências anteriores.

O procedimento coletivo continua exigindo papéis indispensáveis e risco agregado de no máximo dois passos. A lista de participantes deve ser fechada antes do primeiro dado: acrescentar sucessos conhecidos depois das falhas diluiria artificialmente a consequência. Perseguições preservam ambos os contadores e terminam em até cinco decisões principais, com um deles chegando a três; ajuda não abre várias disputas principais na mesma rodada.

## Referências e opiniões: como foram usadas

Consulta em 23/10/2026. Não publicamos pedidos de opinião, não contatamos comentaristas e não enviamos código/dados a serviços externos de IA. Foram lidos materiais públicos e relatos já publicados. Sistemas e versões não foram misturados como se fossem uma única regra.

| Fonte | Evidência consultada | Consequência para a revisão |
| --- | --- | --- |
| [Pokémon Sword/Shield — Dynamax, página oficial](https://swordshield.pokemon.com/en-gb/gameplay/pokemon-become-huge-dynamax/) | Três turnos, um uso por batalha, condições do fenômeno e movimentos Max derivados do tipo/categoria original | Preservar janela, limite e identidade dos movimentos. O HP por nível Dynamax usa a implementação de referência já fixada no estudo anterior; esta página não documenta sozinha toda a fórmula. |
| [Pokémon Tabletop — recursos dos próprios desenvolvedores](https://pokemontabletop.com/downloads-and-resources/) | PTU 1.05 é tratado como antigo; Odyssey aparece como playtest com menos registro manual e atenção aos favoritos | A profundidade não justifica burocracia ilimitada. Usamos a direção declarada; não alegamos auditoria integral dos manuais ou compatibilidade entre seus números e MyOwnDex. |
| [PokéRole v3 — tela do Narrador, repositório dos mantenedores](https://github.com/Pokerole-Software-Development/Pokerole-Obsidian-SRD/blob/master/PokeRole%20v3.0%20GM%20Screen.md) | Ordem, ações/reação e momento de ações dos Treinadores são explicitados; até cinco ações por rodada nessa estrutura própria | Comparação de clareza e carga de decisões. Não importamos a economia de ações, reservas de dados ou regras opcionais de dano letal; MyOwnDex mantém sua estrutura e HP 0 como desmaio. |
| [Diário dos desenvolvedores de Pokémon Journeys — playtesting](https://pokemontabletop.com/dev-diary-2/) | Relatos de testes focados em diferentes níveis, cenas sem combate e escolhas de cura que dominam outras opções | Separar estudo matemático de experiência de mesa; incluir cuidados, suporte e alternativas no roteiro. É um texto histórico sobre Journeys, não o manual atual de Odyssey. |
| [Relatos públicos — escolher sistema para jogar com crianças](https://www.reddit.com/r/PokemonTabletop/comments/y0astz/which_system_is_widely_considered_to_be_the_best/) | Opiniões divergentes sobre sistemas, favoritos e demora de desafios feitos um jogador por vez | Hipótese para observar: objetivos conjuntos e oportunidades para parceiros favoritos, sem impor equipe menor como regra universal. Relato anedótico, sem amostra representativa. |
| [Relato público — dificuldade para narrar PTU 1.05](https://www.reddit.com/r/PokemonTabletop/comments/8m8bqz/trying_to_gm_for_a_game_but_having_a_lot_of/) | Um Narrador descreve sobrecarga de fichas, preparação e receio de combate demorado com quatro jogadores | Reduzir trabalho de registro e oferecer exemplos. Não é evidência de que MyOwnDex tenha o mesmo resultado nem consulta direta com essa pessoa. |

Os pareceres de IA sobre defesa, piso individual de XP e degraus não foram aceitos como ordem para mudar o equilíbrio. A defesa foi conservada; a consequência foi explicada e testada. O piso de XP já era uma escolha explícita e recebeu exemplo para evitar confusão contábil. O caso de etapas exibidas levou à correção da promessa textual. A proposta de grupos levou a uma declaração prévia de participantes, sem acrescentar dados ou ações extras.

## Continuidade visual conferida na candidata

A cópia de QA da compilação de produção 2.1.0 foi aberta no navegador. Uma Box descartável com Eevee apelidado Brisa foi importada e adicionada à Aventura, no nível 10 e com HP 2/4. A segunda importação do mesmo parceiro, mais recente, trouxe nível 11, HP 1, XP 2 e 4 EVs pendentes. A cena mostrou atualização pendente; atualizar a ficha manteve dois tokens no total, sem duplicar Brisa, e passou a mostrar nível 11, HP 1/5, XP 2 e os 4 EVs.

Recarregar e reabrir a cena conservou esses valores. Voltar ao PC e abrir a ficha mostrou Brisa no nível 11, HP 1/5, tipo Normal, Run Away e 4 EVs disponíveis. As seções 8.6, 8.7 e 8.10 do Guia foram expandidas e os exemplos/orientações novos foram conferidos renderizados. A aparência escura conservou marca vermelha, sprites 2D reconhecíveis e superfícies compartilhadas. O registro de QA separa mensagens da extensão de navegador de erros do aplicativo; ausência de erro no console não foi tomada como prova suficiente.

## O que continua exigindo observação real

O navegador verifica conteúdo e interação; os scripts verificam o motor, a persistência e consequências. Nenhum deles demonstra entusiasmo, compreensão infantil, conforto de uma mesa inteira ou protagonismo sentido. A origem HTTP da prévia também não permite certificar a candidata instalada como PWA com cookie Secure em aparelhos físicos. Esses pontos seguem delimitados em [VALIDACAO-2.1.0.md](VALIDACAO-2.1.0.md), sem serem marcados como realizados. A autorização para testar não transforma simulação em acontecimento humano nem autoriza publicação.
