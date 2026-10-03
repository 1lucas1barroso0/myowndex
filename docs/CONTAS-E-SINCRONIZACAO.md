# Contas e sincronização

O MyOwnDex usa o mesmo banco Turso das aventuras, com tabelas novas e migração aditiva. O cadastro funciona com nome de usuário e senha, sem provedor externo ou serviço de IA. Não há promessa de verificação ou recuperação por e-mail: a recuperação usa os códigos privados fornecidos no cadastro e na troca de senha.

## Dados e limites

- Cada conta tem um documento JSON atual de até **4 MiB** e uma cópia anterior, também limitada a 4 MiB. A cópia anterior pode ser consultada em `GET /api/account/data?previous=1`.
- O documento contém Boxes, favoritos da Pokédex, preferências, aventura local, ferramentas dos dados locais e prévia do gerador. Os dados locais incluem ajustes, até 100 recibos e um campo de até 24 Pokémon; o gerador mantém até seis parceiros na prévia. Cache do PokéAPI, senha e credenciais de salas não são enviados.
- Cada envio usa a revisão recebida do servidor. Uma disputa devolve HTTP 409 e o documento atual, sem substituir o envio que chegou primeiro. O cliente reúne as mudanças e preserva uma cópia de recuperação quando duas versões da mesma Box divergem.
- Receber mudanças na mesma conta mantém a tela e os diálogos abertos. Ajustes e campo dos dados locais são atualizados depois que a cópia durável termina; comandos ficam suspensos somente durante essa aplicação. O cliente conclui resoluções e gravações pendentes antes de capturar o documento. Alterações em controles ainda em edição são reunidas com a cópia recebida; atualizações somente dos metadados de sincronização não reaplicam a interface.
- Recibos de rolagens em dispositivos diferentes são reunidos pelo identificador, sem rolar novamente. Apagar o histórico registra remoções para impedir que uma cópia antiga traga os resultados apagados de volta; rolagens novas continuam preservadas. Os metadados de inclusão e remoção ficam limitados a 300 identificadores por coleção. O histórico sincronizado continua identificado como local, sem virar comprovante de rolagem do servidor.
- Edições concorrentes da aventura, campo local ou prévia do gerador preservam a versão inativa no download de recuperação, com até cinco cópias. Um campo de dados locais nunca modifica a Box; aplicar seu progresso ao PC é uma ação explícita.
- Cada conta pode vincular até 200 aventuras. O vínculo armazena apenas o hash da credencial previamente validada. Em outro dispositivo, o acesso usa a sessão da conta e uma referência pública, não uma cópia do segredo do Narrador ou do Jogador.
- O orçamento conservador de escrita do projeto é **256 MiB**, com **8 MiB de reserva**. O banco é medido pelas páginas SQLite ocupadas, descontando páginas livres. Cadastro e salvamento têm verificação prévia e condição SQL no próprio envio. Ao atingir a reserva, HTTP 507 preserva o backup anterior. Isso é um limite da aplicação, não uma alegação sobre o plano contratado no Turso.
- `MYOWNDEX_DATABASE_LIMIT_BYTES` pode ajustar esse orçamento para um valor inteiro de pelo menos 32 MiB, depois de conferir a capacidade real do banco. A variável é opcional; o instalador não cria outro banco nem altera o plano.
- Limites e falhas não removem Boxes do dispositivo. A interface permite exportar dados para arquivo antes de arquivar conteúdo. Nenhum armazenamento finito pode oferecer crescimento ilimitado.

## Segurança

As senhas usam `scrypt` assíncrono com N=32768, r=8, p=3, salt aleatório de 128 bits e chave de 512 bits. A execução por instância limita a duas operações simultâneas e oito em espera. As sessões usam 256 bits aleatórios; somente o SHA-256 do token fica no banco. O cookie tem `HttpOnly`, `SameSite=Strict`, escopo `/` e `Secure` em HTTPS/produção; expira após 30 dias. No máximo 20 sessões permanecem por conta, preservando a sessão que acabou de ser criada.

Oito códigos de recuperação têm 80 bits aleatórios cada, no formato `XXXX-XXXX-XXXX-XXXX` com alfabeto Base32 sem caracteres ambíguos. Somente hashes vinculados à conta ficam no banco. Recuperar a conta ou trocar a senha invalida todas as sessões e todos os códigos anteriores, cria uma nova sessão e fornece oito códigos novos. Uma disputa pelo mesmo código só admite um vencedor.

Todas as mutações de conta exigem `Origin` exatamente igual à origem da requisição, `Sec-Fetch-Site` compatível e JSON. Leituras/escritas autenticadas, troca de senha, exclusão, saída e vínculos de aventuras exigem `x-myowndex-account` igual ao dono do cookie. Uma aba desatualizada não pode ler, salvar ou sair da conta recém-aberta em outra aba. `GET /api/account/session` é a exceção intencional para descobrir a sessão atual. As APIs não expõem hashes, senha, token de sessão ou códigos já usados.

As tentativas usam contadores atômicos persistentes no Turso, por ação/IP/conta. Em Vercel, o IP vem do cabeçalho que a plataforma sobrescreve, `x-vercel-forwarded-for`; fora dela, o grupo conservador `unknown` é compartilhado. Sessões e contadores expirados são removidos em lotes limitados. Banco indisponível nunca transforma uma escrita não confirmada em sucesso.

## Contrato HTTP

Todas as respostas de conta usam `Cache-Control: no-store, private`. Erros retornam `{error, code}`; HTTP 429 inclui `Retry-After`.

| Endpoint | Entrada | Resultado |
| --- | --- | --- |
| `GET /api/account/session` | Cookie opcional | `{account: {id,username,displayName} ou null, limitBytes}` |
| `POST /api/account/signup` | `{username,password,displayName?}` | HTTP 201, `{account,recoveryCodes}`, cookie |
| `POST /api/account/login` | `{username,password}` | `{account}`, cookie |
| `POST /api/account/logout` | `{}` e identificação da conta | Revoga apenas essa sessão, limpa cookie |
| `POST /api/account/password` | `{password,newPassword}` | Revoga sessões/códigos, `{account,recoveryCodes}`, novo cookie |
| `POST /api/account/recover` | `{username,recoveryCode,newPassword}` | Revoga sessões/códigos, `{account,recoveryCodes}`, novo cookie |
| `POST /api/account/delete` | `{password}` e identificação da conta | `{deleted:true,account:null}`, exclusão atômica por cascata |
| `GET /api/account/data` | Identificação da conta | `{document,revision,updatedAt,previousRevision,limitBytes}` |
| `PUT /api/account/data` | `{document,expectedRevision}` | Nova revisão ou HTTP 409 com documento atual |
| `GET /api/account/rooms` | Identificação da conta | `{rooms:[{code,title,key,role,playerId,displayName,local:false}]}` |
| `POST /api/account/rooms` | `{code,key,displayName?}` com credencial original | Valida participação e retorna `{room}` sem segredo |
| `DELETE /api/account/rooms` | `{code}` | Retira somente o vínculo da conta |
| `POST /api/account/rooms/invite` | `{code}`, participação de Narrador | `{inviteCode}`, somente a pedido explícito |

Nomes de usuário têm 3 a 32 letras ASCII, números, `_` ou `-`; comparação sem diferença entre maiúsculas/minúsculas. Senhas têm 10 a 128 caracteres Unicode, com máximo de 512 bytes UTF-8. Nomes de Treinador podem ter até 48 caracteres.

O documento usa `{schema:1,boxes:[],dex:{},preferences:{},localAdventure:null,localTools:{dicePreferences:null,diceRoom:null,generatorDraft:null,rollHistory:[]},roomSession:null,clocks:{},tombstones:{},favoriteClocks:{},rollClocks:{}}`. As ferramentas e os metadados finais são opcionais para cópias antigas; `roomSession` só admite `null`. O servidor limita tamanho, profundidade e quantidade de elementos e rejeita campos de poluição de protótipo. Preferências e dados de jogo são validados/normalizados também no cliente. A migração de HP preserva a proporção e o marcador de versão; sono, freeze, PP e XP acompanham a ficha, sem migrar o HP novamente ao baixar outra cópia.

Uma referência de sala usa `key: account_<id-da-conta>` e não é um segredo. As APIs existentes de aventura verificam cookie, identificação e vínculo no servidor; um Jogador continua sem acesso às notas do Narrador. Mutações de sala com referência de conta também exigem a origem correta. A credencial de cada participação só pode ser vinculada a uma conta; mudanças/invalidação da credencial original encerram a autorização do vínculo. A exclusão de conta apaga vínculos, documentos, sessões e códigos, preservando a sala compartilhada. A exclusão da sala elimina seus vínculos por cascata.

Gerar outro convite invalida os convites anteriores, sem remover Jogadores que já entraram. Abrir a sala em outro dispositivo não gera nem troca convites automaticamente.

## Validação

`tests/accounts.unit.test.mjs` executa os handlers reais contra SQLite pelo transporte Hrana: cadastro, autenticação, cookie, isolamento entre contas/abas, limites, escrita concorrente, cópia anterior, troca de senha, disputa de recuperação, exclusão, vínculo/resumo de sala em outro dispositivo, privacidade das notas e geração explícita de convite. `tests/runtime.unit.test.mjs` mantém a cobertura das aventuras e arquivos de áudio existentes. A verificação no navegador acrescenta o fluxo completo de conta e sincronização em dispositivos separados.

A validação atual de contas é feita pela suíte de testes e pelos roteiros de navegador do commit em publicação. Eles cobrem login, cadastro, códigos, conta aberta, recuperação, sincronização entre dispositivos, recibos idênticos, limpeza sem ressurreição, isolamento das Boxes e recebimento de mudanças com Dados abertos sem gerar outra rolagem. Contagens de uma execução específica ficam no CI daquela execução e não são repetidas aqui como se fossem permanentes. Ensaios não devem criar contas nem modificar salas de produção.
