# Validação da atualização 11.2

Verificação em 2 de outubro de 2026 com Node.js 24.19.0, Next.js 16.2.12 e Chromium. Passaram 212 testes unitários, ESLint, TypeScript, build de produção e HTML servido. O navegador passou 99 checkpoints principais e 51 suplementares, sem erros JavaScript. A 11.2 ainda não foi publicada nesta execução; workflow e instalador repetem checks antes da publicação.

```bash
npm ci
npm test
npm run lint
npm run build
npm run typecheck
```

Execute build e tipos sequencialmente: Next.js gera tipos durante a build.

## Navegador

`tests/browser-responsive.mjs` verifica as quatro áreas em 320, 390, 768, 1280 e 1440 px, Claro/Escuro; ficha de Venusaur nas três abas; editor com nomes longos e painéis opcionais; Link Cable, prévia, importação, salvamento/reload; busca/dados do Guia; aventura local com três painéis; zoom de 200% e redução de movimento.

Exercita 80 Boxes/480 Pokémon, persistência após reload e rolagem limitada da lista. Exige ausência de erros, placeholders, controles fora da largura e rolagem horizontal da página/diálogos; somente o painel selecionado aparece na aventura móvel.

`tests/browser-polish.mjs` adiciona 51 checkpoints em 320, 390, 768 e 1280 px, Claro/Escuro: registro/evolução de Bulbasaur, oito ramos de Eevee, Growl e regras abertas, seis atributos de treinamento, alteração dos 12 campos IV/EV e persistência, proteção 3.4 completa, dX Livre e oito rolagens com histórico. Range verifica palavras estáticas sem quebra no meio e títulos/rótulos sem clipping. Preferência antiga system migra para Escuro com SO escuro; Claro escolhido permanece após reload. Contextos isolados, sem acesso aos dados do usuário.

Para reproduzir com Playwright usado apenas como ferramenta:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run build
npm run start
```

Em outro terminal:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/browser-responsive.mjs
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/browser-polish.mjs
```

Com Chromium do sistema, defina `MYOWNDEX_BROWSER_EXECUTABLE=/usr/bin/chromium`. `MYOWNDEX_PLAYWRIGHT_MODULE` aceita instalação separada, evitando alterar dependências. Scripts documentam caminhos de relatórios/screenshots. Playwright não faz parte do runtime.

## Catálogo e regras

Novos testes verificam nomes ingleses com pontuação/siglas/formas, tipos originais e IDs mecânicos preservados; proporções como porcentagens e aproximação quando necessária; multiplicadores decimais; objeto original do catálogo sem mutação; categoria/medidas oficiais com idioma/precisão apropriados.

Regras preservadas: dano/cura positivos inteiros com mínimo 1, imunidade zero, conversão de atributos e modificadores direcionais com seus critérios. XP em passos de 0,5 e medidas oficiais como 0,7 m não são truncados. Apresentação não altera fórmulas/probabilidades.

## Salas e HTML

HTML servido passou nesta build. Na 11.1, o smoke completo de salas passou em QA separado com SQLite real: criação, entrada, permissões, notas privadas, revisão, concorrência, idempotência, combate, RNG, eventos e sinalização. Duas páginas confirmaram sincronização/privacidade e a aventura foi removida. Esse smoke de API não foi repetido na 11.2, que preserva o funcionamento de servidor/banco/protocolo. Testes unitários de autorização/protocolo seguem passando.

Com servidor e banco de QA configurados:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/room-api.smoke.mjs
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/rendered-html.test.mjs
```

O smoke cria/remove aventura temporária; use banco de QA.

## Armazenamento e instalador

Testes verificam cache com recência/limites/concorrência/quota, preservação de Boxes, flush ao sair, recuperação de edição, offline sem respostas privadas e hidratação limitada sem perder edições. Chaves/esquemas e ausência de expiração iguais. 480 parceiros com catálogo real ocuparam 3,85 MiB UTF-16 no teste unitário, conservando movimentos, EVs, notas, sprites e stats.

Na 11.1 a automação recebeu 34 verificações offline de Git, retomada, conflitos, concorrência em main, isolamento por digest e fonte já aplicada. Não são contabilizadas como repetidas agora. A 11.2 conserva esse fluxo e atualiza a base para d10c9482. A entrega atual passa 12 verificações de SHA-256, payload embutido, sintaxe/base, caminhos seguros, ausência de credenciais, equivalência ZIP/TAR, extração, idempotência, estados antigos, trava concorrente, corrupção/recuperação e determinismo. Reproduza sem autenticar ou publicar:

```bash
python3 scripts/empacotar-linux.py
python3 scripts/verificar-entrega-linux.py ../entrega
```

Verificações cobrem cenários/volumes descritos, sem afirmar capacidade ilimitada do navegador. Edição simultânea das Boxes em duas abas conserva última escrita. Áudio/chamadas reais dependem de permissões, CORS e TURN; sinalização coberta pelo smoke anterior.
