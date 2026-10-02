# Estado da atualização 11.1 CLEAN

Retomada em 1 de outubro de 2026 após auditar status, diffs, componentes, decisões e implementação parcial. Trabalho válido preservado, inclusive alterações ainda não commitadas. Não executar reset, checkout destrutivo ou substituir o diretório por uma versão anterior.

## Base e destino

- Base desta atualização no GitHub: `f428b70ea9a3f948d1c9c0eda17e5d2deaf165f8`, versão 11 publicada em `1lucas1barroso0/myowndex`.
- A base exportada do Git local é `9f3450c`; ela é anterior ao estado remoto e não é a base de publicação.
- Destino: https://myowndex.vercel.app. Produção verificada antes do envio em 11.0.0, deployment READY ligado ao commit `f428b70`. A conexão MCP GitHub e a alternativa autenticada do GitHub CLI recusaram escrita com HTTP 403 (“Resource not accessible by integration”). A versão 11.1 não foi publicada nesta execução. O instalador Linux conclui o envio usando o login do usuário no dispositivo. Conferir o commit de `main`, o deployment READY e o rodapé 11.1.0 antes de declarar publicação concluída.
- Turso Production e Preview já configurados. Reutilizar as variáveis existentes; não criar bancos, substituir tokens ou migrar salas antigas. Protocolo das salas 3 e armazenamento das Boxes 4 preservados.

## Implementação

- Macrodesign Sword/Shield e detalhes HGSS/BW/B2W2: navegação forte, seleção contrastante, sprite nas listas/campo e artwork no foco individual.
- `src/journey.css`: tokens comuns, navegação, Pokédex e aventura. Removidas centenas de regras legadas ou concorrentes de `src/index.css`, preservando a geometria funcional do campo.
- Modos RPG/Jogos/Livre e aparência Claro/Escuro/Dispositivo em grupos independentes, visíveis e capazes de quebrar linha.
- `src/pokedex-record.css`: ficha com rolagem única, fechamento no fluxo, abas claras e conteúdo em uma coluna no celular.
- `src/pc-retro.css`: lista de Boxes limitada por altura, parceiros reais, editor com campos essenciais e detalhes opcionais, Link Cable e prévia de importação responsivos.
- `src/guide.css`: 39 regras preservadas em detalhes individuais pesquisáveis; coluna de leitura confortável. Referência Fate consultada no código e navegador: `docs/CLEAN-REFERENCIAS.md`.
- Aventura com painéis Equipe/Campo/Ações no celular, campo e ferramentas reorganizados por espaço disponível. Notas privadas e sincronização preservadas.
- Sem placeholders, instalação guiada, aviso permanente de prontidão ou novos serviços de IA. O runtime continua Next.js/React/Turso; Netlify não faz parte do código.
- Cache público com LRU de 256 respostas, assets regeneráveis limitados a 500 e shell offline separado. Hidratação compartilha quatro tarefas simultâneas. Salvamento agrupado com flush ao sair; Boxes não expiram.
- Catálogo salvo junto ao parceiro mantém os sprites usados, artwork, animação Black/White e atributos offline; remove URLs redundantes de gerações não utilizadas, preservando os campos do jogador.
- Hidratação tardia só atualiza o mesmo ID e a mesma forma; não substitui parceiros novos, formas alteradas ou edições locais recentes.
- Versão 11.1.0 em package, interface e service worker. Sem alteração de dependências da versão 11.

## Verificação e retomada

Dependências reais instaladas por `npm ci`; Next.js, ESLint, TypeScript e Chromium disponíveis nesta sessão. Passaram 209 testes, lint, tipos, build e 99 verificações de responsividade, incluindo 80 Boxes e 480 Pokémon. A inspeção automatizada em navegador está em `tests/browser-responsive.mjs`; os resultados finais são descritos em `docs/VALIDACAO.md`.

O smoke completo das salas passou contra um transporte HTTP Hrana de QA com SQLite real em memória: criação, entrada, autorização, nota privada, revisão, ações concorrentes, combate, eventos, RNG e chamadas. A sala foi apagada ao terminar. Duas páginas reais também confirmaram sincronização da descrição e privacidade da nota; a sala foi encerrada pelo narrador. Nenhum desses testes usou ou alterou o banco de produção.

Os logs e screenshots temporários da sessão estão em `/tmp/myowndex-clean-*.log` e `/tmp/myowndex-clean-*.png`; não fazem parte da entrega. Não depender desses arquivos em outra máquina. Os comandos reproduzíveis e as limitações estão em `docs/VALIDACAO.md`.

Se houver interrupção durante publicação, consultar o PR e o deployment antes de enviar novamente. O instalador usa pasta própria por digest, protege alterações em `main`, valida o SHA antes de integrar e preserva a pasta de trabalho quando falha. Se a fonte já estiver em main, confirma o CI e segue sem criar PR vazio. Passou 34 verificações offline de automação.

## Entrega

Gerar com `python3 scripts/empacotar-linux.py`. Saídas em `../entrega`: `myowndex-v11.1-linux.sh`, ZIP, TAR.GZ, comando, instruções e SHA-256. O script inclui o projeto inteiro, reaproveita logins/bancos existentes e repete os checks antes de publicar. Não inclui `.env`, `.vercel`, `.git`, builds ou dependências instaladas.

A GitHub App Netlify é uma configuração externa da conta. Retirar somente o acesso a este repositório quando houver permissão administrativa, conforme `docs/AUTOMACAO.md`; não suspender a integração global nem afetar outros projetos.
