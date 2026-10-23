# MyOwnDex 2.1.0 — validação de continuidade e mesa

23/10/2026. Candidata local; nenhuma publicação autorizada. Resultados técnicos e limites completos em [POLIMENTO-REGRAS-INTEIRAS.md](POLIMENTO-REGRAS-INTEIRAS.md).

## O que já foi observado

Prévia desktop e viewports estreitos, usando apenas personagens descartáveis: Pokédex, PC/ficha, gerador, Guia, Dados, aventura, Max, XP, atualização de ficha, encerramento de confronto e captura. A matriz do relatório distingue interação visual, teste automatizado e etapas ainda abertas. A suíte cruza persistência e regras; o worker real é exercitado com rede/cache controlados.

**Não há resultado de sessão com pessoas nem de instalação física Android/iOS.** O roteiro abaixo está preparado, não executado. O servidor de prévia HTTP não substitui uma origem HTTPS para instalação e cookie Secure. Não reduzir essas proteções para aprovar o teste.

## Ensaio técnico ampliado executado

O anexo [ENSAIOS-E-REFERENCIAS-2.1.0.md](ENSAIOS-E-REFERENCIAS-2.1.0.md) registra 96 confrontos com quatro treinadores fictícios, 2515 ações, 50420 verificações, distribuições exatas e pareceres críticos de IA reproduzidos. Usa o motor real e decisões roteirizadas. Esses resultados não alteram o estado pendente da observação humana abaixo.

## Polimento de práticas

A revisão [POLIMENTO-PRATICAS-2.1.0.md](POLIMENTO-PRATICAS-2.1.0.md) cruza cada prática positiva e negativa com alterações, verificações e limites. Inclui ensaio do painel de XP com contexto tardio e falha de confirmação controlada, controles de HP, gerador, temas, viewport estreito e recuperação. A simulação offline adicional usa arquivos reais do build, sem ser marcada como instalação física.

## Roteiro para observar em mesa

Usar de três a cinco participantes, um Narrador, fichas exportadas de teste e cópia das regras. Registrar a versão. Alternar quem lidera cada cena. Explicar objetivo e consequências antes dos dados. Não ajustar atributos secretamente para fabricar duração ou vitória.

| Cena | Situação | Observar e anotar |
| --- | --- | --- |
| Exploração e improvisação | Atravessar uma passagem instável usando Pokémon e ambiente; cada participante propõe contribuição | Clareza de objetivo, teste, benefício e risco; se o efeito exige arbitrar demais; quem decide e quem fica sem ação útil |
| Coletivo e repetição | Três papéis pertinentes, um indispensável; após uma falha oferecer outra abordagem com custo anunciado | Se a recompensa compensa a exposição; compreensão dos 0/1/2 passos de risco; se repetir exige mudança real sem bloquear criatividade |
| Perseguição | Disputa por rodada, apoio com ações; Fuga e Perigo de 0 a 3 | Se progresso preservado incentiva decisões; se apoio compete de forma interessante com outra ação; se o empate é entendido |
| Duelo inicial | Níveis 5 a 10, oponente comparável, uma fraqueza explorável e opção de recuar | Rodadas e minutos; KOs antes da primeira ação; decisão após sobreviver em 1 HP; importância da defesa e clareza do d6 de dano |
| Residual e multi-hit | Queimadura ou veneno em HP baixo; sequência comum de hits e uma combinação guiada | Leitura de efeito ativo com 0 HP; frequência de consultas; proteção por ação, Sash e PP registrados uma vez; fluidez da orientação manual |
| Max e captura | Parceiro ferido, Dynamax nível 10 por três rodadas; depois tentativa com Ball comum | HP antes/entrada/saída, base de residual, momento da intervenção, consumo na falha; forma terminar antes de capturar; risco de a transformação dominar o protagonismo |
| Chefe com objetivo | Adversário regular com repertório, sinais e terreno; resgate ou interrupção além de vencer | Se o grupo usa o cenário; clareza dos sinais; participação, reviravoltas e retirada; nenhuma proteção renovada por mera fase |
| Intervalo | Encerrar confronto, XP com sobra, descanso curto e completo; editar um nome no PC enquanto há ficha na cena | Se gastos persistem, HP 0 não revive por XP/descanso curto, sobra/EVs entendidos; nenhum reset por fase, atualização ou clique; descanso e XP permanecem bloqueados até encerrar a batalha; Transform e cópias temporárias terminam antes do descanso |

Não introduzir todas as regras novas de uma vez numa primeira sessão. Realizar pelo menos uma cena curta de aprendizado e outra usando o mesmo procedimento sem nova explicação. Uma sessão curta identifica problemas; não comprova equilíbrio de campanha.

## Folha de registro por cena

- Observar tanto quem está aprendendo quanto fãs experientes. Verificar se cada pessoa consegue explicar sua escolha e o resultado, reconhece a função do próprio Pokémon e encontra detalhes quando quer conferir uma interação. Registrar separadamente compreensão inicial e satisfação com a profundidade, sem presumir que idade determina conhecimento.
- Perguntar qual característica do parceiro ajudou a resolver a cena e qual momento despertou curiosidade ou vontade de continuar. Conferir se a experiência sustentou descoberta, vínculo e aventura, além do combate. Seguir [IDENTIDADE-E-JOGABILIDADE.md](IDENTIDADE-E-JOGABILIDADE.md).
- Participantes e Pokémon usados, nível, HP, movimentos, itens, amizade e objetivo.
- Horário de início/fim; rodadas; minutos por turno e por consulta ao Guia.
- Por participante: decisões relevantes, oportunidades recusadas, turnos sem contribuição e motivo.
- KOs antes de agir; usos da proteção; sobrevivências em 1 HP; fugas tentadas/concluídas; custos da repetição.
- Resultados 0/1 dos efeitos pequenos; momentos de surpresa, dúvida, tensão ou frustração, com a fala exata se a pessoa concordar.
- Ao fim, cada pessoa descreve uma escolha que mudou a cena e uma regra que a atrapalhou. Registrar divergências sem transformá-las em consenso.
- Separar falha de cálculo, texto ambíguo, interface difícil e preferência de ritmo. Corrigir cada causa em sua camada e repetir a cena afetada.

Se um participante passa vários turnos sem decisão útil, o chefe exige exceções escondidas, ou os efeitos de 0/1 HP geram consultas repetidas, considerar o ponto reaberto. Não mudar o divisor de HP ou a defesa com base apenas numa cena atípica: comparar fichas e repetir com outro repertório.

## Validação física e autenticada pendente

Em cópia de teste HTTPS, sem publicar esta candidata em produção e usando dados descartáveis:

1. Exportar/restaurar uma Box de versão anterior, incluindo ferida, HP 0, PP gastos, item consumido e XP. Conferir a conversão uma única vez e manter a cópia original.
2. Abrir apenas o início, aguardar o preparo offline, desconectar e abrir PC, Guia, gerador e aventura pela primeira vez. Conferir mensagens e assets já preparados; catálogos externos ainda não vistos podem depender de rede.
3. Instalar em Android e iOS compatíveis; reabrir pelo ícone, digitar com teclado do sistema, alternar orientação/tema e recolher a cortina. Inspecionar 320 px, tela baixa, zoom, foco, alvos de toque e retorno à janela.
4. Interromper dois downloads de atualizações consecutivas, reabrir offline e conferir o shell anterior; reconectar e concluir. Nenhuma Box, aventura ou diário deve desaparecer. Simular quota apertada sem apagar a única cópia dos dados.
5. Com duas contas de teste, verificar Cartão, fusão de documentos, vínculo da aventura e exportação em outro dispositivo. Desconexão/reenvio não pode repetir Ball, XP ou encerramento. Jogador não pode encerrar/reiniciar a batalha do Narrador.
6. Registrar sistema, navegador, versão instalada, resultado e evidência de cada etapa; não marcar aprovação com base só em ausência de erro no console.

Qualquer execução futura deve registrar resultados reais neste documento ou em anexo datado. A autorização para polir localmente não autoriza deploy.
