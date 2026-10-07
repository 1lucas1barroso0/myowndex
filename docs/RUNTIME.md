# MyOwnDex na Vercel ou no seu Linux

O projeto usa Next.js 16 com React 19, com página, APIs, manifesto e arquivos públicos no próprio deploy. Não há proxy para outro site nem autenticação externa obrigatória. As chaves privadas das aventuras continuam autenticando narradores e jogadores; só hashes dessas chaves ficam no banco.

## Executar

Use Node.js 24 LTS e npm. Na raiz do projeto:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Para desenvolvimento, use `npm run dev`. Para trocar a porta, use `npm run dev -- --port 3001`. Na Vercel, selecione **Next.js**, mantenha a pasta raiz do projeto e use o `vercel.json` incluído. Remova configurações antigas de Output Directory ou Build Command que substituam esse arquivo.

A Pokédex, as Boxes, os times, as fichas e a aventura local funcionam sem variáveis de ambiente. Os dados do navegador continuam no armazenamento do próprio dispositivo; a exportação JSON permite fazer backup e importar em outro dispositivo.

## Aventuras compartilhadas

Crie um banco SQLite persistente na sua conta [Turso](https://turso.tech/) e um token de acesso desse banco. Configure estas variáveis em **Vercel → Project → Settings → Environment Variables**, nos ambientes onde usará as salas:

| Variável | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | URL `libsql://nome-org.turso.io` ou HTTPS fornecida pelo Turso |
| `TURSO_AUTH_TOKEN` | Token com leitura e escrita no banco |

Faça um novo deploy após configurar as variáveis. O servidor cria as tabelas e os índices necessários no primeiro acesso; uma base antiga recebe a coluna necessária para as ações autoritativas. As alterações em lote usam transações SQLite: as ações dependem da revisão atual, e falhas desfazem o lote. Não há fallback para banco em memória ou gravação em disco efêmero na Vercel.

Sem essas duas variáveis, as APIs de salas retornam HTTP 503 com uma mensagem indicando a configuração necessária. O restante do aplicativo permanece acessível. Banco e tokens ficam no servidor; não use o prefixo `NEXT_PUBLIC_` nesses segredos.

Para o desenvolvimento local, copie `.env.example` para `.env.local` e preencha os valores. Use um banco Turso separado para testes, para evitar alterar suas aventuras reais. Não envie `.env.local` ao GitHub.

## Dados locais e do servidor

Os dados locais do navegador permanecem no domínio onde foram salvos. Antes de mudar o endereço do app, exporte seu backup e importe no novo endereço. Quem mantém `myowndex.vercel.app` mantém a mesma origem para esses dados.

As aventuras compartilhadas ficam no banco Turso configurado para cada ambiente. Atualizações de código mantêm esses dados quando usam as mesmas variáveis. Production e Preview devem usar bancos separados para que testes não alterem suas aventuras reais. As salas da hospedagem anterior foram deixadas fora desta instalação por escolha do proprietário; não há migração pendente para publicar atualizações.

## Verificar salas após configurar o banco

Com o servidor em execução e um banco separado para testes:

```bash
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/room-api.smoke.mjs
MYOWNDEX_SMOKE_URL=http://localhost:3000 node tests/rendered-html.test.mjs
```

O teste abre uma aventura temporária e verifica autorização, convidados, revisão, ações do servidor e eventos. Ele remove a aventura ao terminar. Os testes unitários do driver exercitam parâmetros, rollback, IDs de inserção e exclusão em cascata usando SQLite real. Uma execução contra seu Turso valida o caminho compartilhado.

## Contas

Cadastro, login, recuperação por códigos e sincronização usam o mesmo Turso das aventuras. As tabelas são criadas de forma aditiva na primeira chamada da API; não é necessário contratar outro serviço nem configurar uma chave de IA. O instalador confere `GET /api/account/session` no Preview e em produção sem cadastrar uma conta de ensaio. Veja [CONTAS-E-SINCRONIZACAO.md](CONTAS-E-SINCRONIZACAO.md) para segurança, recuperação e orçamento de armazenamento.

Dados de visitante pertencem à origem e ao dispositivo. Dados de conta sincronizam entre dispositivos no mesmo domínio; Preview e produção continuam sendo ambientes separados. Importar os dados de visitante é uma escolha explícita, preservando a cópia original.
