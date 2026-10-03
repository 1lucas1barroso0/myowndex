# Estado atual do MyOwnDex

**Versão atual: 11.6.2.**

Este arquivo descreve como retomar trabalho sem carregar estado antigo como se ainda fosse atual. A fonte de verdade é, nesta ordem:

1. `main` no repositório;
2. a versão de `package.json`;
3. a suíte de testes e o CI do commit que será publicado;
4. o Preview correspondente ao mesmo commit;
5. a produção depois do merge.

SHAs, números de PR, contagens de testes e estados de deploy de rodadas anteriores são evidência histórica, não estado atual.

## Regras de continuidade

- Nunca substituir a `main` atual por um checkpoint antigo.
- Nunca reutilizar como instrução vigente um documento de release anterior.
- Antes de publicar, executar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`.
- Preview e produção devem corresponder ao commit realmente validado.
- Dados do usuário, Boxes, contas e aventuras não são descartados para simplificar uma atualização.
- Dados históricos podem permanecer preservados, mas devem ser identificados como históricos.
- Rótulos, textos e documentação operacional devem acompanhar a interface atual.
- A versão do shell offline deve acompanhar exatamente `package.json`.
- O instalador Linux documentado deve acompanhar a linha de versão atual.

## Estado funcional vigente

O MyOwnDex reúne Pokédex, PC do Bill, Guia do Treinador, Gerador, Dados, contas e Central da Aventura. Dados usa o mesmo núcleo de regras da aventura quando há contexto Pokémon, preserva recibos e não altera Boxes sem ação explícita. Cálculos internos que não precisam ser manipulados pelo jogador permanecem automatizados.

A interface deve continuar responsiva, utilizável por teclado, legível em telas estreitas e reconhecível como jogo. Placeholders não são usados como instrução ou decoração.

## Documentos históricos

Arquivos com versão ou intervalo de PR no próprio nome, como `REFINO-11.5.md`, `FINAL-11.6.md` e `PR-20-28.md`, registram decisões e auditorias daquele momento. Eles não substituem este arquivo, o README, `package.json` ou o código atual.

## Publicação

O estado só é considerado publicado depois que o CI do commit final passa e o deployment de produção correspondente fica pronto no domínio principal. Um build local ou Preview aprovado, isoladamente, não prova que produção está atualizada.
