# Validação da atualização 11.1 CLEAN

Verificação em 1 de outubro de 2026 com dependências reais instaladas por `npm ci`, Node.js 24.19.0, Next.js 16.2.12 e Chromium. Passaram 209 testes unitários, ESLint, TypeScript e build de produção. O navegador passou 99 verificações de responsividade, sem erros JavaScript. O workflow `.github/workflows/quality.yml` e o instalador repetem os checks antes da publicação.

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

## Navegador

`tests/browser-responsive.mjs` verifica as quatro áreas nas larguras 320, 390, 768, 1280 e 1440 px, em Claro e Escuro; ficha de Venusaur nas três abas; edição com nomes longos e painéis opcionais abertos; compartilhamento, prévia, importação e salvamento após recarregar; busca e dados do Guia; aventura local com navegação dos três painéis; zoom de 200%; aparência do dispositivo e redução de movimento.

O teste também exercita 80 Boxes com 480 Pokémon, persistência após recarregar e lista de Boxes com rolagem própria. Ele exige ausência de erros JavaScript, placeholders e controles fora da largura disponível, verifica ausência de rolagem horizontal da página e dos diálogos e confirma que somente o painel selecionado aparece na aventura móvel. A execução usa um contexto novo de navegador, sem acesso aos seus dados locais.

Para reproduzir, instale Playwright apenas como ferramenta de verificação e inicie a aplicação:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run build
npm run start
```

Em outro terminal:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/browser-responsive.mjs
```

Se houver Chromium instalado no sistema, `MYOWNDEX_BROWSER_EXECUTABLE=/usr/bin/chromium` pode ser usado. `MYOWNDEX_PLAYWRIGHT_MODULE` aceita o caminho de uma instalação separada de Playwright. O relatório vai para `/tmp/myowndex-browser-report.json`, ou para o caminho indicado por `MYOWNDEX_BROWSER_REPORT`. Playwright não é uma dependência do runtime.

## Salas e HTML

O smoke completo das salas passou em um banco de QA separado: criação, entrada, permissões, notas privadas, revisão, concorrência e idempotência, combate, RNG autoritativo, eventos e sinalização de chamadas. Os testes usam SQLite real. Duas páginas reais confirmaram a sincronização da descrição e a restrição da nota privada ao narrador. A aventura de QA foi encerrada e removida. O teste de HTML servido também passou.

Com o servidor e um banco de testes configurados:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/room-api.smoke.mjs
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/rendered-html.test.mjs
```

Não usar um banco de produção para ensaios de carga. O teste de salas cria e remove uma aventura temporária.

## Armazenamento e instalador

Os testes verificam cache com recência, limite, concorrência, falha de quota e preservação de Boxes; flush do salvamento ao sair e recuperação de edição pendente; cache offline sem respostas privadas; hidratação com limite de tarefas e preservação de edições. Boxes mantêm sua chave e esquema e não recebem prazo de validade. A redução do catálogo redundante preserva sprites usados, stats offline, movimentos, EVs, notas e demais campos do jogador; 480 parceiros com catálogo real ocuparam 3,85 MiB UTF-16 no teste unitário.

O instalador recebeu 34 verificações offline, incluindo Git real, retomada, falha de CLI, conflitos, mudanças concorrentes em `main`, isolamento de versões por digest e limpeza da sala temporária e atualização já presente em main. Sintaxe Bash, integridade e extração do pacote são conferidas na geração da entrega.

Os ensaios confirmam os cenários e volumes descritos, sem prometer capacidade ilimitada do armazenamento do navegador. Edição simultânea das Boxes em duas abas conserva a política anterior de última escrita. Upload de áudio e chamadas com dispositivos reais dependem das permissões, CORS e TURN do ambiente; sinalização das chamadas foi coberta pelo smoke da API.
