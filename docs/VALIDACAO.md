## Referência de regras

Metagame e formatos competitivos não fazem parte do escopo do modo RPG: banlists, tiers, cláusulas e normas de torneio não alteram a adaptação. O MyOwnDex usa mecânicas centrais dos jogos, anime e narrativa, sempre pela implementação oficial mais recente disponível.


O modo RPG usa como base principal a implementação oficial mais recente e corrigida disponível para cada mecânica. Atualizações, patches e correções posteriores prevalecem sobre versões antigas; o catálogo automático de movimentos prioriza a versão mais recente disponível. Em outubro de 2026, a referência de batalha mais recente é Pokémon Champions, incluindo seus ajustes de condições, movimentos e Habilidades.

# Validação da atualização 11.3

Verificação em 2 de outubro de 2026, Node.js 24.19.0, Next.js 16.2.12 e Chromium. Build de produção, TypeScript, ESLint, HTML servido e 215 testes aprovados. A publicação 11.3 está pendente pelo instalador; produção pública conferida em 11.2.0.

```bash
npm ci
npm test
npm run lint
npm run build
npm run typecheck
```

Build/tipos são sequenciais, pois Next.js gera tipos durante a build.

## Navegador

- `tests/browser-responsive.mjs`: 99 checkpoints, quatro módulos em 320/390/768/1280/1440 px, Claro/Escuro, fichas/abas, editor aberto, Link Cable/importação/salvamento, Guia, aventura móvel, 200% zoom, redução de movimento e 80 Boxes/480 Pokémon persistidos.
- `tests/browser-polish.mjs`: 51 checkpoints, Bulbasaur/Growl/Eevee, evoluções ramificadas, IVs/EVs com reload, proteção 3.4, dados/histórico e migração da preferência antiga.
- `tests/browser-space.mjs`: 140 checkpoints. Aparência compacta e modos íntegros; original/PT e troca offline sem requisição; medidas oficiais; editor com 12 IV/EV persistidos; aventura vazia/povoada, reservas e nomes longos, escolhas reais de movimentos/situação/Poké Ball; formulários abertos e zoom de 200%. Mede glifos do valor selecionado dentro do campo, reserva da seta, igualdade com selectedOptions e toque/contraste. Não considera conteúdo de details fechado como visível.
- Todos sem erros JavaScript, vazamento horizontal ou clipping nos cenários cobertos. Contextos isolados, sem dados locais do usuário.

Reprodução com Playwright opcional, fora do runtime:

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
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/browser-space.mjs
```

`MYOWNDEX_BROWSER_EXECUTABLE=/usr/bin/chromium` usa Chromium instalado; `MYOWNDEX_PLAYWRIGHT_MODULE` aceita instalação separada de Playwright. Cada script documenta os relatórios/screenshots em /tmp. Na sessão, a verificação final usa a build de produção em 3001.

## Idiomas e catálogo

Os três testes novos verificam cobertura exata de 1.025 espécies, pares reais e diferentes EN/PT, proveniência/hash, nomes ingleses, ausência de mutação e frações, forma correta de Gimmighoul e fallback honesto para futuras espécies sem tradução. Corpus local: 1.007 pares oficiais de Pokémon GO e 18 de Scarlet com tradução editorial MyOwnDex; Gimmighoul Roaming adiciona um par oficial de forma. Fonte e direitos originais documentados em `POKEDEX-IDIOMAS.md` e JSON de proveniência. Regeração a partir dos commits fixados foi executada; não depende de tradução por IA.

Os textos ingleses/portugueses de cada par são da mesma entrada. Mudança de idioma só altera descrição; nomes próprios, fatos, IDs e dados do jogador são preservados. Títulos explicam a origem, inclusive traduções editoriais. O dataset só é importado pelo módulo da ficha carregado sob demanda.

Escala RPG usa divisão por 10 e arredondamento ao inteiro mais próximo: empates exatos em 0,5 descem por padrão e sobem apenas para HP escalado. Frações canônicas de HP preservam o arredondamento próprio dos jogos, normalmente para baixo com mínimo de 1 quando o efeito é positivo. Dano/cura continuam inteiros e imunidade continua zero. Modificadores direcionais preservam mudanças legítimas de estágio. XP em passos de 0,5 e medidas oficiais como 0,7 m continuam precisos.

## Salas, armazenamento e entrega

HTML servido aprovado. Smoke HTTP/Hrana/SQLite real completo de salas e sincronização/privacidade em duas páginas foi aprovado na 11.1; não repetido agora. Alterações atuais preservam servidor/protocolo/banco; autorização e ações seguem cobertas pelos testes unitários. Com servidor e banco de QA:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/room-api.smoke.mjs
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/rendered-html.test.mjs
```

Cache, quota, hidratação, salvamento agrupado/flush e Boxes permanecem testados. Chaves/esquemas iguais, sem expiração das Boxes. Edição simultânea em abas conserva última escrita; volume verificado de 480 parceiros não significa capacidade ilimitada. Áudio/chamadas reais dependem de permissões, CORS e TURN.

Instalador operacional igual à 11.2, com base d8bb4096. Runner executa 12 verificações atuais: SHA/payload, sintaxe/base, caminhos/exclusões, equivalência ZIP/TAR, extração, reexecução, estados antigos, trava, corrupção/recuperação e determinismo. Os 34 testes de automação antigos não são contados como repetidos.

```bash
python3 scripts/empacotar-linux.py
python3 scripts/verificar-entrega-linux.py ../entrega
```

A matemática proporcional de disputas e iniciativa é interna: a interface mostra dados, ordem, sucesso/falha e consequências, nunca exige que o jogador multiplique atributos ou compare totais ponderados. Quando a Central conhece os dois lados de uma disputa, ela rola usuário e oposição no mesmo comando.

