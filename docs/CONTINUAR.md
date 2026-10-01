# Estado da atualização 11

Retomada em 1 de outubro de 2026, após auditar git status, os diffs, as alterações parciais e os componentes existentes. Trabalho válido anterior preservado; não houve reset, reversão ou recomeço. As alterações continuam no diretório de trabalho, sem commit.

## Bases e produção

- Base real no GitHub: da34b383019aa46aa6a4e73d187ede1daf620bbe.
- Base local exportada: commit 9f3450c; não confundir com o SHA remoto.
- Produção existente: https://myowndex.vercel.app, versão 10. Esta sessão não publicou a versão 11.
- Turso Production e Preview já estão configurados. Não criar bancos novamente nem migrar salas antigas. Protocolos de sala e chaves de armazenamento local preservados.

## Implementação concluída

- Macrodesign inspirado no print de Sword/Shield, microdesign inspirado em HGSS/BW/B2W2: navegação por ícones com seleção escura, grandes áreas de cor, texto moderno e detalhes 2D.
- Apresentação consolidada em src/journey.css. Removidos game-edition.css e handheld.css concorrentes; index.css mantém geometria do campo e recebeu limpeza de 64 regras mortas. PC/record/local-dice mantêm seus layouts específicos com tokens comuns.
- Sprites nas listas, Boxes e campo; artwork oficial no foco individual. Temas claro/escuro, contraste, redução de movimento e foco preservados.
- Campos e ajudas no fluxo, fichas com quebra de linha, modais com rolagem, teclado e foco. Corrigidas respostas assíncronas tardias de edição/importação para preservar dados recentes.
- Retirados instalação guiada, prontidão permanente, slogans, repetições, entradas Vite, imagens sem referências, schemas Drizzle não usados e 87 dependências. Runtime Turso permanece em server/rooms.ts e server/runtime.ts.
- Versão 11.0.0 e cache do service worker atualizado. Manifest e metadados alinhados à nova paleta; instalação pelos recursos do navegador preservada.
- Novo empacotador determinístico e instalador independente e retomável em scripts/atualizar-v11.template.sh. Scripts antigos preparar/publicar removidos. O instalador valida código e CI antes de integrar e publicar, reutilizando bancos e logins existentes.

## Verificação observada

- npm test: 21 arquivos passaram. Execução detalhada: 194 testes individuais, sem falhas, incluindo gzip real de importação/exportação.
- Fontes oficiais já presentes de fflate 0.8.3 compiladas temporariamente em node_modules para os testes; nenhum mock e nenhuma alteração de dependências/lockfile. npm ci no ambiente completo substitui essa instalação temporária.
- Parser Babel: 85 arquivos de código sem erro de sintaxe. Referências relativas de módulos conferidas, sem alvos ausentes; chaves CSS balanceadas.
- Contraste WCAG AA dos pares reais claro/escuro e botões principais aprovado. git diff --check limpo.
- Instalador: 29 verificações offline com Git real e CLIs simuladas, incluindo falhas, conflitos, retomada, concorrência, mudanças em main e limpeza da sala de teste. bash -n e extração do arquivo final aprovados.

## Pendências concretas

Next.js, ESLint e TypeScript não foram instalados: npm ci offline encontrou pacote sem cache; pedidos de rede foram interrompidos. npm run build, lint e typecheck foram tentados e retornaram ferramenta ausente. O parser não substitui esses checks. Chromium também não iniciou dentro do sandbox; não houve validação visual real no navegador. O instalador exige checks completos no Linux antes da publicação, e o CI os repete.

Próxima execução com dependências: npm ci; npm test; npm run lint; npm run typecheck; npm run build. Corrigir qualquer regressão e verificar as quatro áreas, fichas, Boxes/import-export, aventura local e compartilhada, ambos os temas, 320/390/768/1280 px e zoom de 200%. Não declarar a inspeção visual concluída antes de fazê-la.

A integração Netlify externa via GitHub App ainda exige retirar apenas myowndex em https://github.com/settings/installations (Netlify > Configure > Repository access). Este ambiente não tem permissão administrativa para alterá-la; não remover/suspender a instalação global nem afetar outros repositórios. Código atual não depende de Netlify ou GPT.

## Entrega

/workspace/entrega/myowndex-v11-linux.sh inclui todo o projeto; COMANDO-V11.txt encontra o arquivo baixado e executa. Arquivos alternativos: myowndex-v11.zip, myowndex-v11-linux.tar.gz e SHA256-V11.txt. Para regenerar: python scripts/empacotar-linux.py. Não usar os instaladores v10 antigos. Logs locais: /tmp/myowndex-v11-final-tests.log, /tmp/myowndex-v11-all-tests.log e /tmp/myowndex-v11-syntax-check.log.
