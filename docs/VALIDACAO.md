# Validação da atualização 11

Na preparação desta entrega passaram 194 testes individuais, incluindo importação/exportação gzip com as fontes oficiais do fflate 0.8.3 compiladas temporariamente em node_modules. O parser Babel analisou 85 arquivos de código sem erros de sintaxe. As dependências completas de Next.js, ESLint e TypeScript não estavam instaladas nesta sessão, e os pedidos de download de dependências foram interrompidos nesta sessão. A inicialização do Chromium também foi impedida pelo sandbox; a inspeção visual no navegador está pendente. Por isso, build, lint e verificação completa de tipos continuam pendentes de execução com essas dependências; não foram declarados aprovados.

O arquivo `myowndex-v11-linux.sh` executa esses checks no seu Linux antes de publicar. A validação do GitHub também repete testes, lint, tipos e build.

## Verificação manual do projeto

Execute na raiz do projeto com Node.js 24 LTS:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

O workflow `.github/workflows/quality.yml` repete os checks no GitHub. Esses comandos precisam passar antes da publicação; este documento descreve o procedimento e não substitui o resultado de cada execução.

## Interface

Abra as quatro áreas, a ficha de um Pokémon, o editor do PC e os diálogos de importação. Confira tema claro e noturno, navegação por teclado e largura de 320 px. Repita com zoom de 200% e texto longo nos campos editáveis. Títulos, botões, campos e avisos devem quebrar linha dentro de suas áreas; modais devem caber na janela e permitir rolar todo o conteúdo.

Confira os estados de foco, seleção, erro e carregamento. Cor sozinha não deve comunicar uma ação ou estado. Prefira reduzir movimento quando essa opção estiver ativa no sistema.

## Salas

Com o servidor em execução e um banco de testes separado de Production:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/room-api.smoke.mjs
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/rendered-html.test.mjs
```

O teste de salas cria uma aventura temporária e verifica criação, entrada, autorização, notas privadas, revisão, ações autoritativas, eventos e chamadas. Remove a aventura ao terminar. O teste de HTML confere a aplicação Next.js servida pelo endereço informado.

Os testes unitários do driver usam SQLite real para verificar parâmetros, transações, IDs de inserção e cascata. Upload de trilhas depende também das permissões e do CORS do bucket S3/R2; confira esse fluxo em um ambiente de testes se o armazenamento estiver habilitado.
