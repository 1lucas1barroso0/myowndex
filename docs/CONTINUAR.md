# Estado da atualização 11.2

Retomada em 2 de outubro de 2026 após auditar status, diffs, componentes e decisões. Toda implementação válida da 11.1 foi preservada, inclusive alterações ainda sem commit no Git exportado. Não executar reset, checkout destrutivo ou substituir o diretório por uma versão anterior.

## Base e publicação

- Base remota: `d10c9482cb562a84b09c9cc6a1df2168426f72d4`, atualização 11.1 publicada em `1lucas1barroso0/myowndex` pelo usuário. Árvore: `4e6926c28c1ae946ae7ab7e51b98b4a39f3b624a`.
- O HEAD local exportado é `9f3450c`, anterior ao remoto. Para comparar, use índice Git temporário baseado no commit remoto e inclua arquivos novos; o diff comum não inclui arquivos ainda não rastreados.
- Destino: https://myowndex.vercel.app. O HTML público conferido nesta execução contém 11.1.0. A 11.2 foi construída/verificada localmente; sua publicação ainda precisa ocorrer pelo instalador.
- Na execução anterior, conexão GitHub e CLI autenticado recusaram escrita com HTTP 403, “Resource not accessible by integration”. O instalador usa os logins do usuário. Conferir `main`, deployment READY e rodapé 11.2.0 antes de declarar publicação concluída.
- Turso Production/Preview já configurados. Reutilizar bancos e variáveis; não criar banco, trocar tokens ou migrar salas antigas. Protocolo das salas 3 e armazenamento das Boxes 4 preservados.

## Implementação preservada

- Macrodesign Sword/Shield e detalhes HGSS/BW/B2W2: navegação forte, contraste, sprites nas listas/campo e artwork no foco individual.
- Tokens comuns em `journey.css`, geometria funcional do campo, modos RPG/Jogos/Livre separados da aparência.
- Ficha com rolagem única; Boxes com lista limitada por altura; editor, Link Cable e importação responsivos.
- 39 regras pesquisáveis/expansíveis; referência Fate registrada em `docs/CLEAN-REFERENCIAS.md`.
- Aventura com Equipe/Campo/Ações no celular, notas privadas e sincronização preservadas.
- Sem placeholders, instalação guiada, aviso permanente de prontidão ou dependência de GPT/IA. Runtime Next.js/React/Turso; Netlify fora da fonte.
- Cache público LRU de 256 respostas, assets regeneráveis limitados a 500, shell offline separado e hidratação limitada a quatro tarefas. Salvamento agrupado com flush ao sair; Boxes não expiram.
- Catálogo conserva sprites usados, artwork, animação Black/White e atributos offline. Hidratação tardia verifica ID, forma e edição recente antes de atualizar.

## Ajustes da 11.2

- Apenas Claro/Escuro. Preferência antiga `system` é resolvida pela aparência atual do dispositivo uma vez e torna-se escolha explícita persistida. Tema não altera modo de jogo.
- Entrada e PC com texto revisado; títulos/rótulos mantêm palavras inteiras. Conteúdo livre e nomes longos quebram linha sem ocultar letras.
- Registro com cor do tipo, descrição destacada, idioma e fatos sem duplicar altura/peso. Evoluções conectadas, com ramos e estágio atual. Ícones distintos para Tipos/Movimentos.
- Movimentos com método de aprendizado, tipo, categoria e dados de batalha separados. Detalhes completos carregados ao abrir, com deduplicação.
- Treinamento separa título, IVs/EVs e orçamento. Seis atributos reorganizam Base, IVs, EVs e slider pela largura disponível; limites, balanceamento e salvamento preservados.
- dX mostra Livre. Removidos Copiar e a redundância nas probabilidades. Histórico com resultado, contexto e data; exportação e limite de 100 preservados.
- Proteção contra hit kill com escudo, três etapas coloridas, 1 HP e exemplo. Regras, exceções, Sturdy e Focus Sash completas.
- `src/core/names.js` centraliza nomes ingleses, pontuação, siglas e formas regionais/Mega. Tipos, habilidades, itens, naturezas, movimentos e demais nomes próprios não são traduzidos; explicações/controles seguem em português.
- Proporções como porcentagem/multiplicador, contagens com “de”, sem notação de fração. Cálculos preservados: HP positivo usa piso/mínimo 1, imunidade é zero, conversão RPG sobe a partir de 0,56 e modificadores direcionais usam teto/piso conforme a regra. XP segue em passos de 0,5; medidas oficiais conservam precisão.
- Versão 11.2.0 em package, rodapé e service worker; dependências iguais.

## Verificação e retomada

Passaram 212 testes, lint, tipos, build, HTML servido e 99 checkpoints de responsividade contra a build de produção, incluindo zoom de 200%, 80 Boxes e 480 Pokémon. Mais 51 checkpoints de `tests/browser-polish.mjs` cobriram os novos painéis abertos em Claro/Escuro, quatro larguras, geometria de palavras, migração da aparência e edição/persistência dos 12 valores IV/EV. Nenhum erro JavaScript. Comandos e limites em `docs/VALIDACAO.md`.

Na 11.1, smoke das salas passou em QA com HTTP Hrana/SQLite real: criação, entrada, autorização, nota privada, revisão, concorrência, combate, eventos, RNG e chamadas. Duas páginas também verificaram sincronização/privacidade. Esse smoke de API não foi repetido na 11.2; não houve alteração funcional do servidor/protocolo em relação à base publicada. Produção não usada para ensaios.

Logs/screenshots em `/tmp/myowndex-polish-*` e `/tmp/myowndex-clean-*` não fazem parte da entrega e podem não sobreviver ao reinício. Reproduza usando os scripts do projeto. O checkpoint local usa `codex/myowndex-v11-polish-checkpoint-20261002`, sem substituir HEAD/index original; o status externo da entrega registra seu commit.

Se a publicação for interrompida, consulte PR/deployment antes de reenviar. Instalador usa estado por digest, preserva alterações, valida SHA antes da integração e mantém checkout/log em falha. Fonte já aplicada não gera PR vazio. As 34 verificações offline da automação realizadas na 11.1 não são contadas como repetidas nesta execução.

## Entrega

Gerar com `python3 scripts/empacotar-linux.py`: `../entrega/myowndex-v11.2-linux.sh`, ZIP, TAR.GZ, comando, instruções e SHA-256. Script inclui projeto inteiro, reaproveita logins/bancos e repete checks antes de publicar. Exclui .env, .vercel, .git, builds e dependências instaladas.

Netlify GitHub App é configuração externa: se ainda vinculada, retirar somente este repositório conforme `docs/AUTOMACAO.md`, sem afetar outros projetos.
