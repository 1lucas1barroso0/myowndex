# Revisão integrada 2.1.13

Base exata: produção 2.1.12, commit 559cbdecaf15086e3d3284f76c0e01cfac7459f4. Arquivos e trabalho antigos preservados em outra pasta; nenhuma arte ou pacote foi reconstruído. As direções de identidade/jogabilidade e interface continuam obrigatórias.

## Decisões e causas

- As 48 regras mantêm IDs, cenas, procedimentos de mesa e exemplos auditados. Uma verificação percorre todas e detecta ausência ou duplicação de qualquer regra, passo ou parte da cena. Não foi acrescentada outra modalidade de jogo nem bônus para igualar espécies.
- A regra 2.1 agora explica integralmente como obter atributos originais a partir da espécie/forma, nível, IV, EV e natureza, antes da conversão RPG. A mesma explicação integra a busca e o livro impresso. O cálculo distingue atributo-base de atributo final e conserva a exceção de Shedinja.
- Erro crítico: removidas as sugestões de cobrar PP/itens extras depois de conhecer o resultado e de conceder uma ação inimiga indefinida. A orientação compartilhada e a regra 1.3 passam a respeitar o risco combinado e a economia de ações de 3.7/8.3/8.6. O motor não ganhou cobranças, curas ou punições automáticas.
- A calculadora do Guia usava o limite 200 para todos os modos. Agora mostra o limite 100 em RPG/Jogos e 200 em Livre. Não oferece XP para um nível inexistente e não altera a ficha de nenhum Pokémon.
- O Guia e o livro usam o mesmo complemento de cálculo: chances exatas de 2d6, empate como falha e sorteio manual de razões inteiras. Dificuldades 5/7/9 têm 26/15/6 sucessos entre 36 pares. A ajuda fica recolhida no aplicativo e legível na edição de mesa, sem outra faixa permanente de instruções.
- A escrita de movimentos ainda chamava o manipulador que desfocava o campo ao pressionar Enter. Esse campo agora mantém o foco e respeita composição do teclado. Outros campos mantêm seu comportamento próprio.
- A base atual já contém PP e referências históricas por modo/jogo, consulta local de movimentos, escolhas de habilidade/item e troca de idioma com nomes legíveis. Essas soluções foram preservadas; os testes correspondentes continuam no conjunto de validação.
- Corrigidos separadores literais de linha nas instruções atuais e uma frase quebrada no README. Sem dependências novas, migração de armazenamento ou mudanças de espécies e recursos salvos.

## Cobertura por tema

| Tema | Revisão e verificações |
| --- | --- |
| 1 — Dados | Vitória estrita, críticos, risco combinado, chance exata, variação por impacto. |
| 2 — Ficha e crescimento | Fórmula oficial de atributos, conversão, estágios, zero, XP, limites e sobras. |
| 3 — Batalha | Declaração, prioridade, ação única, múltiplos acertos, proteções e posição. |
| 4 — Recursos | Intervenção, captura, repouso e consumo sem duplicação. |
| 5 — Criação | Repertório, evolução, EV e amizade sem apagar a continuidade do parceiro. |
| 6 — Condições | Momentos de aplicação, HP inteiro, sorteio sem dívida oculta, cura e condições voláteis. |
| 7 — Mecânicas Pokémon | Habilidades, itens, formas, cópias, tipos e transformações; fontes fixadas verificadas. |
| 8 — Condução | Participação, exceções, testes, improviso, cooperação, repetição, fuga e desafios com respostas possíveis. |

O código de batalha, os casos auditados e o texto existente são as referências reproduzíveis para a regressão. A aritmética de atributos segue `calculateStat`; probabilidades são enumeradas, não estimadas. Os catálogos oficiais/comunitários seguem os pins documentados no projeto e a verificação de fontes obrigatória.

## Critérios de publicação

Executar testes unitários e integrações, lint, tipos, build com integridade das artes, testes de Guia em celular com CPU reduzida, livro completo e impressão, digitação/PP, consulta de habilidade/item e interfaces compartilhadas. Conferir visualmente as novas áreas abertas em largura pequena. O CI completo precisa estar aprovado antes de integrar; a publicação precisa responder com versão e commit correspondentes.

Entendimento por crianças, diversão e equilíbrio vivido exigem sessões com pessoas. As verificações técnicas não substituem essa observação, conforme `IDENTIDADE-E-JOGABILIDADE.md` e `VALIDACAO-2.1.0.md`. Esta revisão não certifica ausência universal de falhas nem que todas as combinações possíveis de Pokémon foram jogadas.
