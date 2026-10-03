# Validação da edição 11.4

Em **3 de outubro de 2026**, a fonte final passou em **331 testes, sem falhas, cancelamentos ou testes ignorados**, além de lint, verificação de tipos e build de produção. Ambiente: Node.js 24.19, Next.js 16.2.12 e Chromium. Esses resultados validam a fonte; a publicação da 11.4 ainda precisa ser confirmada separadamente.

| Check | Resultado | Log da execução |
| --- | --- | --- |
| `npm test` | 331 de 331 passaram | `/tmp/myowndex-final-unit.log` |
| `npm run lint` | Passou | `/tmp/myowndex-final-lint.log` |
| `npm run typecheck` | Passou | `/tmp/myowndex-final-types.log` |
| `npm run build` | Passou, incluindo rotas de contas e aventuras | `/tmp/myowndex-final-build.log` |

O build foi executado com o transporte Turso/Hrana de teste em `http://127.0.0.1:8097`, sem usar credenciais ou alterar dados de produção. Os logs de `/tmp` são evidências locais temporárias; os testes e os comandos permanecem no repositório.

## Cobertura das regras e dos dados

Os testes verificam a escala e os arredondamentos dos PRs #20–#28, migração proporcional de HP, Shedinja, proteção contra hit kill, Confusion, Sleep, Freeze, paralisia, disputas proporcionais e iniciativa automática. Também cobrem importação/exportação, isolamento do campo de dados locais, recibos persistidos, limpeza do histórico sem retorno de resultados apagados, sincronização e limites de armazenamento.

Cinco testes de `tests/champions-runtime.unit.test.mjs`, incluídos no total de 331, confirmam as 45 diferenças verificadas do catálogo de movimentos, preservação dos dados históricos e dos objetos originais, PP atual de Protect, queda de Sp. Atk. de Make It Rain e elegibilidade de First Impression pela quantidade de tentativas após a entrada em campo. Uma tentativa bloqueada por Sleep conta para essa elegibilidade. A referência é aplicada tanto no cliente quanto no motor autoritativo.

Os testes de referência por jogo confirmam que os dados canônicos compactos permanecem disponíveis offline. Uma Box consultada em um jogo antigo continua histórica na consulta; ao levar seu Pokémon para o campo RPG, o token recupera tipos e atributos atuais sem modificar a ficha original.

## Navegador

As verificações abaixo foram executadas durante a integração em Chromium, contra um build de produção local e SQLite real pelo transporte Hrana. Cada número corresponde aos checkpoints do respectivo roteiro, não ao total de testes unitários.

| Roteiro | Checkpoints aprovados | Principais fluxos |
| --- | --- | --- |
| `tests/browser-responsive.mjs` | 99 | Navegação, campos, limites da tela e temas |
| `tests/browser-space.mjs` | 140 | Espaçamento, ficha, Boxes e conteúdo longo |
| `tests/browser-polish.mjs` | 52 | Acabamento da interface, controles e edição |
| `tests/browser-xp-dice.mjs` | 38 | XP inteira, guia, dados e progressão |
| `tests/browser-generator.mjs` | 26 | Geração, prévia, exportação e envio ao PC |
| `tests/browser-reference.mjs` | 25 | EN/PT, registros históricos, movimentos, habilidades e itens |
| `tests/browser-accounts.mjs` | 62 | Contas, recuperação, privacidade e sincronização entre dispositivos |
| `tests/browser-local-pokemon-dice.mjs` | 12 | Combate, iniciativa, captura e persistência de dados locais |

As telas foram conferidas em **320, 390, 768 e 1280 pixels**, nos dois temas, além de zoom de 200%. A conferência inclui limites das palavras e controles, não apenas ausência de rolagem horizontal da página. O cabeçalho em 390 pixels mantém modos e aparência na mesma linha; em 320 pixels, os grupos quebram em linhas próprias, com alvos de toque de pelo menos 44 pixels. A navegação móvel da aventura não cobre os campos.

Foram exercitadas 80 Boxes com 480 Pokémon, acesso à última Box, restauração e persistência. Outra prova de quota confirmou a restauração de 120 Boxes a partir da gravação durável. Esses volumes demonstram os fluxos testados e não representam garantia de capacidade ilimitada.

Os fluxos de contas confirmaram cadastro, login, recuperação, troca de senha, exclusão, 12 valores de treinamento no outro dispositivo, recibos idênticos, conflito de edição com cópia recuperável e retomada de aventuras compartilhadas sem sincronizar segredos. Notas do Narrador permaneceram privadas. Receber uma atualização remota manteve o diálogo de dados e a ficha abertos, sem fechar a tela ou rolar novamente. A prévia do gerador sincronizou sem inserir Pokémon automaticamente nas Boxes.

Os dados locais resolveram combate com PP, iniciativa, fim de rodada, disputa e captura; o campo de prática permaneceu separado das Boxes. Duas abas conservaram seus recibos e apagar o histórico não o fez reaparecer. Ao abrir os dados globais numa aventura, os controles usaram seu contexto real sem substituir o campo de prática privado. Os roteiros de conta, gerador, referências e dados locais não registraram erros de JavaScript não tratados.

Depois das últimas alterações, foram repetidos e aprovados os roteiros de dados locais com Pokémon (**12**), referências (**25**) e XP/dados globais (**38**), além da conferência do cabeçalho em 320 e 390 pixels nos dois temas. A verificação direta confirmou **Teste**, ausência do parágrafo introdutório fixo e de Vibração, e explicações opcionais recolhidas.

## Reproduzir e publicar

Executar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build` na fonte final. Para os roteiros de navegador, iniciar `tests/helpers/hrana-server.mjs` e o servidor de produção local; informar `MYOWNDEX_SMOKE_URL`, `MYOWNDEX_PLAYWRIGHT_MODULE` e `MYOWNDEX_BROWSER_EXECUTABLE` conforme o ambiente. Não usar o banco de produção para ensaios de cadastro, privacidade, recuperação ou migração.

A distribuição Linux deve ser gerada por `scripts/empacotar-linux.py` e conferida por `scripts/verificar-entrega-linux.py`. Sua aprovação será registrada quando a execução ocorrer. Publicação exige CI e Preview aprovados no SHA final, merge confirmado e verificação do endereço de produção. Na elaboração deste documento, a produção ainda está na **11.3**.

Fontes e limites de cobertura: [POKEDEX-IDIOMAS.md](POKEDEX-IDIOMAS.md), [PR-20-28.md](PR-20-28.md), [CONTAS-E-SINCRONIZACAO.md](CONTAS-E-SINCRONIZACAO.md) e [GENERATOR-SOURCES.md](GENERATOR-SOURCES.md). A ausência de uma descrição verificada não é suprida por texto inventado.
