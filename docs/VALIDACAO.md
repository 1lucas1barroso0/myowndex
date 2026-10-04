# Validação atual do MyOwnDex

A validação vigente é a executada sobre o commit que será publicado. Contagens e resultados de rodadas antigas não devem ser apresentados como prova do estado atual.

## Checks obrigatórios

Na fonte final:

```bash
npm ci
npm audit --omit=dev --audit-level=moderate
npm test
npm run lint
npm run typecheck
npm run build
```

A suíte cobre regras, persistência, contas, migrações, importação/exportação, Dados, gerador, referências por jogo, aventuras locais e compartilhadas, segurança das APIs e contratos de interface. Alterações que afetem um fluxo de navegador devem executar também o roteiro correspondente em `tests/browser-*.mjs`.

Para Dados, `browser-shared-dice.mjs` verifica a apresentação da resposta real do servidor e a ausência de histórico duplicado; usa exclusivamente servidor e banco locais. `browser-local-pokemon-dice.mjs` cobre Campo livre, iniciativa, disputa, combate, captura e sincronização entre abas. `browser-personal-deletions.mjs` verifica remoções e cancelamentos sem apagar Boxes.

## Dependências

O CI impede publicar dependências de produção com alertas moderados ou mais graves. Revise também `npm audit` completo: ferramentas de desenvolvimento podem ter alertas que não chegam ao aplicativo publicado. A cadeia `eslint-config-next → fast-glob → micromatch → braces` possui um alerta de negação de serviço em padrões profundamente aninhados, sem versão corrigida de `braces` disponível nesta revisão. Ela recebe os padrões fixos do lint do repositório, não conteúdo dos jogadores. Não rebaixe Next.js nem desative o lint para ocultar o alerta; revise novamente quando houver correção upstream.

## Interface

As verificações responsivas devem incluir, no mínimo, 320, 390, 768, 1280 e 1440 px quando o fluxo possuir layout relevante nessas larguras, além dos dois temas. O objetivo não é apenas evitar rolagem horizontal: controles, nomes, palavras, foco, diálogos e ações precisam continuar utilizáveis.

A interface não usa placeholders como instrução ou decoração. Rótulos e ajuda necessária permanecem visíveis e com linguagem do jogo.

`tests/browser-accessibility.mjs` verifica os estados das quatro áreas, fichas, gerador, contas e Dados com axe-core (WCAG 2 e 2.1 AA), nos dois temas. Também verifica reflow, tamanho de controles, nomes de campos, foco, teclado, zoom e movimento reduzido. Instale Playwright e axe-core em uma pasta de ferramentas, fora das dependências do aplicativo. Execute com `MYOWNDEX_PLAYWRIGHT_MODULE` apontando para o módulo Playwright, `MYOWNDEX_AXE_PATH` para `axe-core/axe.min.js`, `MYOWNDEX_BROWSER_EXECUTABLE` para Chromium e `MYOWNDEX_SMOKE_URL` para o servidor testado. Cadastros de teste só são executados em localhost com o banco de teste; o roteiro não modifica contas reais.

Auditorias automáticas não substituem a inspeção visual nem o uso pelo teclado. Aguarde o fim das animações de entrada antes de medir contraste; verifique separadamente a preferência por movimento reduzido. Ajuda, metadados e rótulos devem ter pelo menos 14 px na escala normal; os campos de texto usam 16 px. Aumentar texto não pode esconder nomes, cortar controles ou mudar as regras do jogo.

## Dados e regras

- Regras do RPG são verificadas pelos testes do motor e pelos testes de integração que compartilham a mesma resolução entre cliente e servidor.
- Referências históricas permanecem associadas ao jogo consultado; entrar no RPG usa a referência atual prevista pelo sistema sem alterar a ficha histórica.
- Dados do usuário não são removidos para liberar cache.
- Recibos já concluídos não são rolados novamente por renderização, sincronização ou retry.
- Mudanças de versão não podem deixar documentação operacional, cache offline ou instalador apontando para uma versão anterior.

## Contas e aventuras

Ensaios destrutivos de cadastro, recuperação, migração, privacidade ou armazenamento devem usar infraestrutura de teste. Produção não é ambiente de teste. Preview e Production devem usar bancos separados quando houver ensaio que possa modificar dados.

## Fontes e proveniência

A ausência de uma descrição verificada não é suprida por texto inventado. Proveniência e cobertura de registros estão em [POKEDEX-IDIOMAS.md](POKEDEX-IDIOMAS.md), [pokedex-entries-provenance.json](pokedex-entries-provenance.json) e [catalog-text-provenance.json](catalog-text-provenance.json).

## Publicação

Publicar exige que CI e Preview correspondam ao mesmo commit final, o merge esteja confirmado e o deployment de produção desse commit fique pronto. A versão exibida/documentada deve coincidir com `package.json`.
