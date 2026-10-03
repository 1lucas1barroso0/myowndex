# Estado do refino 11.6

A versão 11.6 foi concluída sobre o checkpoint 11.5, com 40 regras reais, referências EN/PT naturais e remoção segura de todo conteúdo criado pelo usuário. O fechamento técnico está em [FINAL-11.6.md](FINAL-11.6.md). Antes de publicar, conferir o PR, CI, Preview e a confirmação da produção; não reutilizar os avisos históricos abaixo como estado atual.

O pacote `../entrega/myowndex-v11.6-linux.sh` foi gerado e verificado. A fonte ainda deve ser publicada somente depois da criação do commit imutável sobre `83462f453e0f67317aa40a20f71c7d4b827bf005`.

## Registro histórico

A versão11.4 foi publicada pelo PR#29 e conferida em produção. A entrega11.5 parte de `4f1be7ad640e93831b38045cc7a7057be2fd7e16`, com aprimoramentos de apresentação e organização. Os motores, APIs, dados e regras permanecem preservados. Não substituir o trabalho local nem mexer no HEAD/índice original.

Alterações e validação desta rodada em [REFINO-11.5.md](REFINO-11.5.md). O checkpoint final previsto é `codex/myowndex-v11.5-checkpoint-20261003`. O registro após a publicação fica em `/workspace/entrega/STATUS-V11.5.txt`; conferir esse arquivo antes de repetir publicação ou integração.

## Registro da integração anterior

O texto abaixo registra o estado da11.4 antes de seu envio. A publicação foi concluída: PR#29 integrado, CI aprovado e Vercel READY, conforme `STATUS-V11.4.txt` na entrega externa. Os avisos de publicação pendente dessa etapa são históricos.

# Continuidade da edição 11.4

Estado auditado em **3 de outubro de 2026**. A fonte passou nos testes, lint, tipos, build e verificações de navegador descritos em [VALIDACAO.md](VALIDACAO.md). A publicação da 11.4 ainda depende do PR, CI, Preview e confirmação em produção; o endereço público permanece na 11.3 até essa confirmação.

## Preservação do trabalho

Não executar `reset`, checkout destrutivo ou substituição do diretório pela fonte remota. O HEAD exportado `9f3450c71012c07f72e33d13bf4c72c79cbffbee` é anterior ao trabalho atual. Há alterações válidas e arquivos novos; `git diff` sozinho não mostra os arquivos ainda não rastreados. Auditar também `git status --short` e os arquivos de continuação.

| Referência | Estado |
| --- | --- |
| Base remota da entrega | `f76dec47303e394e81d18186742f664eee33663d` |
| Merge do PR #28 | `b4a782ba0b5192d37b748d2c7357ad82cbc8ea68` |
| Árvore comum aos dois commits | `37a8cd1d8658546384a8fb1878cd620ef05a9b4d` |
| Checkpoint anterior à integração das regras | `edd78f9d00273ab7f35228e28e63a45a4004b4ec` |
| Referência desse checkpoint | `codex/myowndex-v11.4-pre-rules-20261003` |

O commit adicional de main não altera arquivos em relação ao merge #28. A integração foi feita por comparação de três versões, sem substituir o HEAD ou o índice original. Para o checkpoint final, usar um índice temporário e incluir os arquivos novos. A referência prevista é `codex/myowndex-v11.4-checkpoint-20261003`; confirmar sua existência e SHA antes de usá-la como fonte de recuperação.

## Implementação concluída

- **Interface:** navegação, modos e aparência preservados; áreas e campos adaptados a telas estreitas; fauna decorativa com sprites locais distintos por módulo e versão estática para redução de movimento. Dados locais usam o rótulo **Teste**, sem o parágrafo introdutório sempre exposto. Vibração foi removida. Explicações complementares ficam nas seções recolhíveis.
- **Contas:** cadastro, login, recuperação por códigos e sincronização no mesmo Turso, com migração aditiva. Boxes, favoritos, preferências, aventura local, dados locais e prévia do gerador são separados por identidade. Receber mudanças da mesma conta preserva a tela, os diálogos e as edições em andamento. Ver [CONTAS-E-SINCRONIZACAO.md](CONTAS-E-SINCRONIZACAO.md).
- **Dados e regras:** PRs #20–#28 integrados, combate e iniciativa automáticos, proteção e condições recentes, migrações idempotentes e XP inteira arredondada para baixo. Dados locais com Pokémon usam os motores das aventuras, preservam recibos e não modificam a Box sem uma ação explícita. Ver [PR-20-28.md](PR-20-28.md).
- **Referência atual e histórica:** EN/PT, registros por jogo, movimentos por jogo, habilidades e itens com nomes originais. O catálogo contém 14 arquivos e 20.738 textos únicos. As 45 diferenças verificadas de movimentos Champions são compartilhadas pela interface, dados locais e servidor; consultar um jogo histórico não altera a referência atual do combate. Ver [POKEDEX-IDIOMAS.md](POKEDEX-IDIOMAS.md).
- **Gerador:** até seis Pokémon, movimentos por nível e jogo, IVs, EVs, Nature, gênero e habilidades; exportação individual, envio a uma Box existente ou criação de outra Box. Prévia limitada e sincronizada sem inserção automática no PC. Ver [GENERATOR-SOURCES.md](GENERATOR-SOURCES.md).
- **Armazenamento:** IndexedDB durável, espelho local, filas de gravação, orçamento de caches e compactação das Boxes fechadas. Dados do usuário não são apagados para liberar cache. As falhas de quota mantêm a cópia existente e permitem exportação; não há promessa de armazenamento infinito.

Não há GPT ou tradutor externo no runtime, build ou instalador. Não recriar banco, alterar plano ou substituir segredos para publicar essa atualização. O texto do chat “Análise das regras MyOwnDex no ChatGPT” não é acessível pelo repositório; os PRs e suas fontes verificáveis foram auditados.

## Fechamento da entrega

1. Preservar este estado e conferir qualquer alteração feita após os logs finais em `/tmp/myowndex-final-*.log`. Repetir somente os checks afetados por mudanças posteriores.
2. Gerar os arquivos com `python3 scripts/empacotar-linux.py` e verificar a distribuição com `python3 scripts/verificar-entrega-linux.py ../entrega`. Manter os artefatos anteriores preservados. Registrar o resultado real da verificação, o SHA final e a publicação em `../entrega/STATUS-V11.4.txt`.
3. Criar ou reaproveitar o PR da 11.4 com a fonte final. Confirmar CI e Preview do SHA correspondente antes do merge. Conferir a interface, a versão e as APIs de conta/salas no Preview, mantendo ensaios completos de contas e migração no banco de teste.
4. Depois do merge, confirmar a versão 11.4 no endereço de produção e os endpoints de sessão/salas. Um Preview pronto ou um build local aprovado não confirma publicação em produção.

O instalador 11.4 usa a base `f76dec47303e394e81d18186742f664eee33663d`, valida a fonte antes de enviar, preserva o diretório de retomada e aguarda CI/Preview. Se houver bloqueio de deploy, manter código, PR, logs e arquivos de entrega; registrar o erro real, sem ignorar checks ou declarar publicação concluída.
