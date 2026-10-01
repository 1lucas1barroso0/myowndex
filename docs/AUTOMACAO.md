# Preparação e publicação automatizadas no Linux

Use os scripts na raiz do projeto. Eles não criam serviços Turso/R2, não migram aventuras antigas e não gravam credenciais em arquivos do projeto.

## Enviar a atualização e conferir online

Se baixou `myowndex-corrigido-linux.sh`, o pacote está incluído nesse arquivo:

```bash
bash myowndex-corrigido-linux.sh
```

Execute na pasta do download. O instalador cria uma pasta nova, confere o SHA256 do pacote e inicia o modo `enviar`. Para apenas extrair e revisar o projeto, use `bash myowndex-corrigido-linux.sh extrair`. O destino padrão é sua pasta pessoal; `MYOWNDEX_INSTALL_ROOT` permite escolher uma pasta de instalação existente e com permissão de escrita.

Se você já está na pasta do projeto extraído:

```bash
bash preparar-linux.sh enviar
```

Esse comando instala as ferramentas ausentes em Ubuntu, Debian ou Linux Mint, prepara Node.js 24 caso a versão atual não atenda ao projeto e executa testes, lint, verificação de tipos e build. Autentica no GitHub e na Vercel, vincula e confere o projeto `myowndex`, envia um branch, abre um PR em rascunho e cria um Preview. A instalação pode pedir sua senha do Linux; os logins precisam da sua autorização no navegador. Se as ferramentas ou a autenticação já existem, elas são aproveitadas. Em outras distribuições, instale as ferramentas indicadas pelo script e execute o comando novamente.

Os scripts identificam a etapa de uma falha e preservam o checkout. O NVM só é carregado se for necessário preparar o Node.js, e a vinculação Vercel usa o projeto e a equipe já identificados. Se um token GitHub herdado do terminal não permitir a autenticação, o script informa isso e tenta login pelo navegador apenas nessa execução; o ambiente original do seu terminal permanece intacto.

O modo `enviar` mantém `main` e produção. A integração existente entre GitHub e Vercel também pode gerar um Preview para o branch. O link do PR e o endereço do Preview aparecem no terminal. Só integre o PR quando a configuração independente e a migração das aventuras estiverem completas: integrar em `main` pode disparar publicação automática.

O Preview usa as variáveis configuradas em **Vercel → myowndex → Settings → Environment Variables → Preview**. Pokédex, PC, Guia e aventura local funcionam sem banco; salas precisam de Turso e trilhas precisam também de S3/R2. O Preview tem outro domínio, portanto os dados locais do navegador não aparecem automaticamente nele. Para testar o PC, importe uma Box exportada do site atual.

Os modos disponíveis são:

| Comando | Resultado |
| --- | --- |
| `bash preparar-linux.sh` | Prepara as ferramentas; não envia código |
| `bash preparar-linux.sh verificar` | Prepara e valida o aplicativo |
| `bash preparar-linux.sh preview` | Prepara, valida e cria um Preview na Vercel |
| `bash preparar-linux.sh enviar` | Prepara, valida, envia um branch, abre PR em rascunho e cria Preview |
| `bash preparar-linux.sh publicar` | Prepara, valida, envia ao GitHub e publica em produção |

Se Node.js e as ferramentas já estão disponíveis, use diretamente `bash publicar-linux.sh verificar`, `preview`, `enviar` ou `publicar`.

## Publicar a versão final

Configure os serviços das salas e migre as aventuras antigas antes de substituir a produção. Consulte [RUNTIME.md](RUNTIME.md). Depois:

```bash
bash preparar-linux.sh publicar
```

O script autentica no GitHub pelo navegador quando necessário e aproveita sua identidade Git. Se ela não foi configurada, usa seu nome público e o e-mail privado `noreply` da conta autenticada apenas no checkout temporário. Não altera seu nome ou e-mail global do Git.

A publicação clona `main`, compara a versão remota com a base da entrega e exige os mesmos arquivos caso `main` já tenha evoluído. Se o PR desta entrega já foi integrado e os arquivos são iguais, não cria outro commit nem outro push. Se houver diferenças em uma versão remota mais recente, encerra sem enviar código ou publicar na Vercel; atualize o checkout a partir do GitHub. Não faz force-push. O envio por branch usa a mesma proteção contra mudanças remotas mais recentes. Arquivos `.env`, credenciais e a pasta `.vercel` não são enviados ao repositório.

Quando o GitHub está conectado à Vercel, um push em `main` também pode disparar produção automaticamente. Por isso, use `enviar` ou `preview` enquanto a configuração e a migração das aventuras estiverem pendentes.

## O que foi possível fazer nesta sessão

O código, os scripts e os testes foram preparados localmente. O acesso GitHub conectado recusou escrita com `403 Resource not accessible by integration`, e a ferramenta nativa Vercel de deploy estava indisponível. Nenhum PR ou deploy foi criado remotamente. O comando Linux acima usa seus próprios logins para concluir essas etapas.

Há 7 salas no banco antigo. A ferramenta de consulta trunca o estado de duas delas e não fornece exportação integral. Obter esse backup e as credenciais do Turso sob seu controle continua necessário para manter as mesmas salas depois da mudança. Não envie tokens nem backups privados ao GitHub.

## Usar o código que já está no GitHub

Após a integração do PR, basta clonar a versão atual em uma pasta nova:

```bash
git clone https://github.com/1lucas1barroso0/myowndex.git myowndex
cd myowndex
bash preparar-linux.sh preview
```

Para acompanhar uma versão em revisão antes da integração, use o nome do branch indicado no PR:

```bash
git clone --branch NOME_DO_BRANCH --single-branch https://github.com/1lucas1barroso0/myowndex.git myowndex
cd myowndex
bash preparar-linux.sh preview
```

Nenhum dos scripts exige GPT ou chave de API de IA.
