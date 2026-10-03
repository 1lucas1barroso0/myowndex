# As 40 regras do Guia do Treinador

O Guia contém **40 regras distintas**, em oito capítulos. A contagem é calculada a partir do conteúdo, sem um número fixo usado apenas na interface. A busca e os detalhes recolhíveis apresentam as mesmas regras.

## Origem da diferença

A auditoria encontrou 39 entradas na base `9f3450c71012c07f72e33d13bf4c72c79cbffbee`, nas versões dos PRs #20 a #28 e no checkpoint 11.5 `6b8d8dad6238c91a8606c45f3b80e736b15b6f8a`. Nenhuma dessas versões continha uma quadragésima entrada que pudesse ser restaurada.

Confusão e hesitação já estavam descritas dentro da regra 6.1, intitulada **Condições principais**, apesar de serem efeitos voláteis. Esses dois textos agora formam a regra **6.5 — Efeitos voláteis**. As cinco condições principais permanecem na 6.1. Todos os identificadores anteriores continuam iguais; o conteúdo mecânico de ambos os efeitos foi preservado integralmente. A organização separa assuntos que já tinham estados e durações diferentes no motor.

A distribuição passa a ser: 4 regras de rolagens; 5 de cálculos; 7 de combate; 4 do Treinador; 4 de criação; 5 de condições e efeitos; 6 de habilidades, itens e formas; 5 de condução da aventura.

## Preservação e validação

Não foram alterados cálculos, probabilidades, duração de condições, arredondamentos, ações, salvamento ou APIs. A referência a Nature no texto geral de construção de atributos usa **natureza** como termo de interface em português; nomes individuais como Hardy e Adamant continuam no original.

O teste do catálogo exige 40 identificadores únicos, 40 títulos distintos, sequência de capítulos preservada e conteúdo para cada entrada. A cobertura da regra 6.5 verifica as durações, o poder 40, a chance e as exceções já vigentes. O teste de navegador confere as 40 entradas reais e o total exibido.

Validação local deste recorte: **38 testes passaram**, incluindo as regras atualizadas, migrações, condições e referência Champions. A rodada completa e a verificação no navegador são registradas na entrega principal.
