# Continuidade auditada: MyOwnDex 2.0.22 a 2.0.24

## Evidência e limites

A versão 2.0.22 foi incorporada pelo PR #80 no commit 19f5384ea26d6dd4c27e6fadaef948a5c8b5fe86. A recuperação fiel da 2.0.23 veio pelo PR #82, e o PR #83 corrigiu a execução do teste de navegador, sem modificar a aplicação.

Nas 22 capturas originais, 21 mostram blobs Git identificáveis e recuperados por SHA. A 22ª documenta apenas a falha de aprovação por limite de uso, não um novo blob. Os 21 blobs originais foram comparados com os arquivos da main e coincidiram exatamente. O arquivo permanente está na branch recovery/codex-2.0.23-originals-20261010, commit 7ce75e3430392a6d0876cc64c8f44c904bbef80d.

A árvore da 2.0.22 possuía 1.499 entradas, contando diretórios; nenhuma foi removida pela 2.0.23. Os 113 ZIPs anteriores mantiveram os mesmos Git blob SHAs. Os 113 registros históricos do manifesto são byte-equivalentes em seus campos e na ordem, com 2.609 sprites e 71.284.820 bytes. A assinatura SHA-256 do JSON serializado dessas entradas é 7a0dda14804a7a90fe163026c9514dcce86e306ec358c0980431418bad2532cb.

A 2.0.23 acrescentou exclusivamente um pacote com oito sprites da Silicobra, preservando os anteriores. Seus oito SHA-256 são idênticos aos registrados no arquivo de proveniência e também aos bytes servidos em produção. Total resultante: 114 pacotes, 2.617 sprites, 71.628.959 bytes. O ZIP adicional tem SHA-256 37ffdf6dc367875a2a0835eef033d938bfc99cab9633481fc2d54193427ee96a.

O PR #70 foi substituído pelo #69; o PR #81 foi substituído pelo #82. Os dois foram encerrados sem merge intencional, não perdidos. A execução que atingiu o limite de uso não fornece evidência de artefatos posteriores aos 21 blobs. Não é possível provar a inexistência de arquivos locais não registrados, nem antecipar decisões que o Codex ainda não havia tomado.

## Extensão funcional conservadora

O PR #80 registrava efeitos G-Max que ainda dependiam do Narrador. A 2.0.24 automatiza apenas os que o motor de estados existente representa sem inventar regras: Befuddle e Stun Shock (status aleatório com imunidades), Smite e Gold Rush (confusão, inclusive Own Tempo) e Snooze (50% de sonolência com transição por turno). Gold Rush mantém explícita a recompensa de moedas a cargo do Narrador.

Continuam guiados outros efeitos especiais G-Max que exigem implementação própria e validação adicional (trocas bloqueadas, barreiras, armadilhas, PP, recursos consumidos, dinheiro e condições de duração). Não afirmar que estão automatizados. Essa limitação já era declarada na 2.0.22, portanto não é código perdido da 2.0.23.

## Controles de não regressão

O teste sprite-history-2-0-22.unit.test.mjs impede alterações silenciosas no índice histórico dos 113 primeiros pacotes. O teste gmax-secondary-recovery.unit.test.mjs confere imunidades, probabilidade, efeito por oponente, falha de ataque e ausência de efeitos indevidos nos aliados. Preservar a identidade visual 2D, versões e registros persistentes dos jogadores. Executar testes, lint, tipos, build, navegador e deploy e conferir o endpoint público após qualquer publicação.

## Referências rastreáveis

- PR #80: https://github.com/1lucas1barroso0/myowndex/pull/80
- PR #82: https://github.com/1lucas1barroso0/myowndex/pull/82
- PR #83: https://github.com/1lucas1barroso0/myowndex/pull/83
- Arquivo permanente: https://github.com/1lucas1barroso0/myowndex/tree/recovery/codex-2.0.23-originals-20261010
- Registro anterior: docs/RECUPERACAO-2.0.23.md
