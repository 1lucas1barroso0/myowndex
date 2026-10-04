# Regras e rodadas — 2.0.1

A revisão mantém as 40 regras, seus IDs e a apresentação 2.0. A referência vigente está no Guia e em `src/core/rpgRules.js`.

Antes de rolar iniciativa, cada Pokémon escolhe um movimento ou Outra ação na seção Iniciativa. Essa preparação não gasta PP nem executa efeitos. Os Dados e as Aventuras compartilham o componente de escolhas e a validação do motor. Escolhas de outros jogadores ficam visíveis; cada jogador declara os Pokémon sob seu controle.

O motor confirma a referência do movimento e calcula a prioridade efetiva, incluindo Prankster, Gale Wings e Triage quando ativos. Prioridade maior precede prioridade menor. Dentro da mesma prioridade, permanece a iniciativa proporcional por Velocidade efetiva e 2d6, com desempate de 1d6 somente entre os empatados. Outra ação ocupa prioridade 0.

As escolhas e prioridades ficam fixas durante a rodada. Cada movimento espera o turno do usuário, e uma ação já usada não pode ser repetida. Próximo turno avança a fila; Encerrar rodada aplica os efeitos finais e libera novas escolhas. A prática sem uma ordem formada permanece livre. A intervenção do Treinador continua separada. Simulações de jogadores continuam sem aplicar mudanças à cena.

O servidor rejeita declarações atrasadas, nova iniciativa durante a rodada e ações fora do turno. Os PATCHs de HP, notas e posições permanecem disponíveis; clientes anteriores que não conhecem a categoria derivada da declaração não a apagam. Não houve mudança de chaves persistentes ou de protocolo.

As regras 1.2, 1.4, 3.1, 3.2, 3.3, 3.7 e 7.4 esclarecem vantagem, preparação, resolução, ações e movimentos chamados. Precisão e efeitos secundários usam o mesmo critério de vantagem: vitória proporcional quando exigida e margem mínima de 2 na soma dos dados mantidos. Diferenças entre atributos não criam essa vantagem.

Recompensas usam XP-base inteiro de 1 a 3. Adversários com pelo menos o dobro do maior nível dos vencedores ou o dobro dos participantes dão ×2 por desvantagem, chegando a ×4. Cada vantagem equivalente do vencedor reduz a base em 1. Em casos mistos, a redução vem antes do multiplicador; o mínimo de 1 vale ao final. Cada aquisição integral oferece 2 EVs por XP recebido, guardados para distribuir nos atributos, respeitando 252 por atributo e 510 no total. Subir nível mantém a política existente de um nível por aquisição e XP zerado, sem reduzir a quantidade de EVs recebida nem reviver Pokémon com HP 0.

Os participantes e seus níveis de entrada acompanham as trocas, para que a ordem de distribuir XP não mude a recompensa. Recibos únicos impedem repetição da aquisição; um histórico limitado e seu marco de fechamento evitam crescimento indefinido. A fusão de recompensas entre dispositivos, importação/exportação e registro de progresso preservam XP e EVs disponíveis.

Amizade muda somente por decisão do Narrador, com ajustes de 5 ou 50 na escala original de 0 a 255. A apresentação RPG divide por 10 e arredonda para baixo, até 25. Recompensas, níveis e condições não mudam Amizade automaticamente; o encerramento lembra o Narrador de avaliar o vínculo pela história da sessão.

O Guia contém uma única regra 3.4 completa, com as 13 cláusulas canônicas. O conversor abre e foca esse ponto. O estado da proteção na ficha rápida abre o mesmo componente, sem versões incompletas divergentes. A conversão apresenta atributo, HP, XP necessário e efetividade com seus arredondamentos próprios.

As fases recolhem controles que não lhes pertencem. Uma ordem ativa permanece intacta ao alternar fases; a prática dos Dados continua com um campo de batalha completo, incluindo os efeitos finais. O HUD fica abaixo dos sprites, sem obstruir vizinhos; um índice local de 1.351 alturas oficiais dimensiona os sprites sem novas consultas. Movimento decorativo respeita a preferência por movimento reduzido.

A trilha local usa um arquivo de até 24 MB por sessão, em memória, com reprodução, pausa, substituição e remoção. As trilhas compartilhadas continuam persistentes; downloads obsoletos podem ser cancelados. Som e volume respeitam as preferências; os efeitos dos Dados privados usam o mesmo controle de silêncio.

As verificações de regressão cobrem prioridades, regras, crescimento, preservação das cenas, áudio, contas, códigos de importação e API, além das suítes de navegador. O registro final da entrega informa os resultados da execução completa.
