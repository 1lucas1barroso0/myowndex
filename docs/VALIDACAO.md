# Validação desta entrega

Data: 1 de outubro de 2026. Base: commit `b74ed69540cafa7978356957212c7dda073d22de` do repositório `1lucas1barroso0/myowndex`, correspondente à versão 9.17.0. Entrega: versão 10.0.0.

## Executado com sucesso

- Todas as 21 suítes `*.unit.test.mjs`, incluindo regras, importação/exportação, coleção, salas, chamadas e configuração de publicação.
- Integração dos handlers de sala com SQLite real: criação, entrada, segredos ocultos, autorização, conflito de revisão, eventos, sinalização e remoção com cascata.
- Novas fronteiras de gerações, busca combinada com filtros e contraste AA dos temas normal/noturno.
- Parser JavaScript/TypeScript/JSX nos arquivos de aplicação, servidor e schema.
- Sintaxe do script Linux e do service worker.
- Automação Linux executada com ferramentas simuladas: envio para branch/PR em rascunho, Preview, publicação explícita e interrupção diante de nova versão remota, projeto Vercel incorreto ou falha de lint. Esses testes não fizeram chamadas externas.
- Instalador com pacote embutido: sintaxe Bash, extração real, SHA256 e arquivos essenciais verificados; também executado fora da pasta do download e em destino com espaços e acentos.
- Catálogo de 1.025 espécies e 152 PNGs locais, incluindo identificação e dimensões de imagem.

O pacote usa a dependência oficial `fflate` 0.8.3 no lockfile. Para executar os testes nesta sessão sem acesso ao registro npm, a mesma versão foi recuperada do código oficial e transpilada temporariamente fora dos arquivos entregues.

## Verificações ainda pendentes

O sandbox desta sessão bloqueou a instalação das dependências pela rede. Portanto, não foi possível executar o build Next.js, ESLint, typecheck completo ou verificação visual/funcional no navegador. A conexão GitHub permitiu leitura, mas recusou a criação de arquivos com `403 Resource not accessible by integration`; a ferramenta nativa de deploy Vercel respondeu `Tool deploy_to_vercel not found`. Nenhum branch, PR ou deploy foi criado nesta sessão.

O comando `bash preparar-linux.sh enviar` instala/prepara as ferramentas e executa os checks antes de enviar um branch e criar o Preview. Interrompe o envio se qualquer verificação falhar. Depois de abrir o PR, o workflow existente também executa testes, lint, tipos e build no GitHub Actions.

Turso e S3/R2 foram verificados com testes locais, sem credenciais reais. É necessário conferir sua configuração, CORS e permissões com os serviços da sua conta. O teste `tests/room-api.smoke.mjs` pode validar um banco de testes com o servidor em execução.

## Dados anteriores

O serviço anterior não foi alterado nem substituído por esta sessão. A consulta somente de leitura identificou 7 salas, 180 eventos, 3 jogadores e 1 rolagem. O `state_json` de duas salas continua truncado mesmo com leitura de uma linha por vez. A ferramenta disponível não exporta SQLite nem permite produzir um backup fiel, por isso nenhum SQL incompleto foi entregue como migração.

A tabela `room_media` tem zero registros: não há áudio cadastrado nesse banco. Isso não confirma a ausência de objetos órfãos no bucket. Obtenha a exportação integral do banco antes de substituir o serviço. Os dados privados não estão no pacote nem devem ser enviados ao GitHub.
