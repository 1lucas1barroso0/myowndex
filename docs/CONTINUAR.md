# Estado da atualização 11.3

Retomada em 2 de outubro de 2026, preservando a 11.2 inteira e os ajustes parciais da 11.3. Não executar reset, checkout destrutivo ou substituir a fonte por uma versão anterior. O HEAD/index exportados continuam na base antiga; alterações válidas permanecem no diretório de trabalho.

## Base e destino

- Base remota publicada: `d8bb4096702786625f8acdb20ac63d26186d71ba`, MyOwnDex 11.2 (#18), repositório `1lucas1barroso0/myowndex`. A árvore coincide com o checkpoint local anterior `711b6d1e30ccc4bcf558667e6819beb478ef99cf`.
- HEAD exportado local: `9f3450c`, anterior ao remoto. Compare usando índice temporário baseado no commit remoto e incluindo arquivos novos; não use reset para “alinhar” este diretório.
- Produção: https://myowndex.vercel.app, HTML público conferido em 11.2.0. A 11.3 está preparada localmente; publicação pendente pelo instalador. A conexão GitHub recusou escrita com HTTP 403 nas execuções anteriores; o instalador usa os logins do usuário.
- Reutilizar Turso Production/Preview já configurados. Não criar banco, substituir tokens ou migrar salas antigas. Salas protocolo 3, Boxes esquema 4 e demais chaves de armazenamento preservados.

## Trabalho concluído

- Campos com `Shared/RoomSelect.jsx`: mantém o select nativo, teclado, toque, validação e callbacks; o valor selecionado aparece inteiro e quebra linha dentro do campo. Fragment e optgroup são percorridos. Labels visíveis e nomes acessíveis explícitos, sem duplicar texto visível.
- `src/room-controls.css`, importado globalmente após journey.css: formulários respondem à largura do painel. Combate/captura ficam em uma coluna na lateral estreita; duas só com espaço. Estados vazios informam ausência de Pokémon/movimento/alvo. Iniciativa, ficha rápida, HP, XP, trocas e modificadores têm linhas/controles confortáveis; botões desabilitados mantêm texto legível.
- Claro/Escuro no canto, duas colunas intrínsecas; modos RPG/Jogos/Livre continuam independentes. Removidos títulos visuais redundantes, mantendo nomes acessíveis, teclado e toque mínimo de 44 px.
- PC/editor preservam todas as ações e ganham margens internas e espaçamento; escolhas longas de forma/natureza/condição/tipos/destino usam o mesmo controle.
- Registro da Pokédex: EN/PT alterna original/português localmente. 1.025 espécies cobertas; nomes próprios ingleses conservados. O idioma volta ao original ao abrir outra espécie; alternar forma conserva o idioma escolhido.
- Corpus `src/data/pokedex-entries.json`: 1.007 pares oficiais Pokémon GO + 18 pares de Pokémon Scarlet com tradução editorial local; um par oficial adicional para Gimmighoul Roaming Form. Chest Form usa seu próprio original/português de Scarlet. Nunca parear inglês Red/Blue com português de outro texto.
- Fonte identificada discretamente na descrição; traduções editoriais identificadas como MyOwnDex. Proveniência/hash/fontes fixadas em `docs/pokedex-entries-provenance.json`, explicação em `docs/POKEDEX-IDIOMAS.md`. Regeração opcional por `scripts/atualizar-descricoes-pokedex.py`; runtime não chama tradutor, GPT ou IA.
- Categoria, habitat/crescimento e medidas agrupados; captura/amizade em referências próprias, com interpretação expansível completa. Habilidades, formas, evoluções e movimentos preservados.
- Todas as funcionalidades da 11.2 mantidas: salvamento/import-export/Link Cable, sincronização/notas privadas, 39 regras, cache LRU e offline limitado, hidratação com quatro tarefas e proteção de edições recentes. Boxes não expiram.
- Versão 11.3.0 em package, rodapé e service worker. Dependências inalteradas.

## Verificação e entrega

Build, tipos, lint, HTML servido e 215 testes passaram. Navegador: 99 checkpoints gerais, 51 de acabamento e 140 de campos/espaçamento, nos dois temas, cinco larguras, zoom 200%, 80 Boxes/480 Pokémon, persistência de IVs/EVs e alternância de idioma offline sem requisição. O teste novo mede o texto selecionado contra a opção nativa e seus retângulos dentro do campo. Detalhes/comandos em `docs/VALIDACAO.md`.

Smoke completo de salas em banco SQLite/Hrana de QA foi aprovado na 11.1; não repetido nesta atualização visual. Servidor/protocolo e funcionamento do banco preservados; testes unitários de autorização/ações continuam aprovados. Não usar produção para ensaios.

Logs/screenshots em /tmp são temporários e não fazem parte da entrega. Scripts e decisões estão na fonte. Checkpoint final: `codex/myowndex-v11-space-checkpoint-20261002`, sem trocar HEAD/index original; commit registrado no STATUS externo.

Gerar `python3 scripts/empacotar-linux.py` e verificar `python3 scripts/verificar-entrega-linux.py ../entrega`. Saídas: myowndex-v11.3-linux.sh, ZIP, TAR.GZ, COMANDO/LEIA/SHA256-V11.3.txt. Entregas anteriores preservadas; exclusão de segredos, .git, .vercel, builds e dependências instaladas.

Instalador conserva a lógica validada da 11.2 e os estados por digest. Repete checks e usa CI/Preview antes da integração e produção; preserva checkout/log em falha. Se interrompido, consultar PR/deployment antes de reenviar. 12 verificações atuais de pacote/extração/retomada/determinismo; 34 verificações antigas da automação não são contadas como repetidas.
