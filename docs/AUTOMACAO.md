# Atualização do MyOwnDex no Linux

## Um arquivo, um comando

Baixe `myowndex-v2.0-linux.sh` e execute no terminal, dentro da pasta do download:

```bash
bash myowndex-v2.0-linux.sh
```

O atualizador inclui o projeto e verifica a integridade do pacote. Aproveita os seus logins do GitHub e da Vercel e as variáveis dos bancos já configuradas no projeto `myowndex`. Não há cadastro Turso ou migração de salas nesta atualização.

A entrega sempre parte da `main` vigente e da versão declarada em `package.json`; o atualizador usa a base publicada auditada somente para calcular o patch, sem tratar essa base como estado atual. A linha 2.0 inicia uma nova leva depois da 11.6.6 e preserva as 40 regras, contas com sincronização, gerador de Pokémon, referências EN/PT por jogo e Dados acessíveis em todos os módulos. A versão da entrega não altera as chaves ou esquemas do armazenamento. XP recebida já é inteira; metas e divisões arredondam para baixo. O mobile reorganiza os painéis sem reduzir tudo ao desenho do desktop. As opções Claro/Escuro continuam separadas dos modos RPG/Jogos/Livre.

O registro oferece alternância EN/PT com textos locais, sem depender de GPT ou outro serviço de tradução. Fontes e limites da cobertura em português são registrados em [VALIDACAO.md](VALIDACAO.md). Nomes de Pokémon, itens, movimentos e habilidades permanecem no original em inglês. A atualização preserva importação, exportação, salvamento e sincronização.

A preparação do código executa testes, lint, verificação de tipos e build antes de publicar. O processo confere o repositório e o projeto Vercel para evitar enviar a atualização ao destino errado. Se uma etapa falhar, interrompe a execução e informa a pasta preservada para investigação.

Execute novamente o mesmo arquivo para retomar. O pacote tem uma pasta de estado própria identificada pela linha de versão e pelo SHA-256; execuções de versões diferentes ficam separadas. Os branches usam o prefixo da linha atual, `codex/myowndex-v2.0-`. A opção `MYOWNDEX_STATE_DIR` permite personalizar o local de trabalho; o nome antigo `MYOWNDEX_V11_STATE_DIR` continua aceito como alternativa. Se esse diretório já contiver outra entrega, o atualizador cria uma subpasta identificada pela linha e pelo digest, preservando o trabalho anterior.

As opções `bash myowndex-v2.0-linux.sh verificar` e `bash myowndex-v2.0-linux.sh extrair` validam o checkout ou extraem os arquivos sem publicar. `COMANDO-V2.0.txt` encontra o instalador baixado; `SHA256-V2.0.txt` contém os hashes dos arquivos de entrega. O pacote também é disponibilizado como `myowndex-v2.0-linux.tar.gz` e `myowndex-v2.0.zip`.

O empacotador deriva nomes, títulos e metadados da versão estável de `package.json` e exige que ela coincida com o lockfile e o shell offline. O nome interno `scripts/atualizar-v11.template.sh` permanece por compatibilidade; ele não define a numeração da entrega. A confirmação de Preview e produção verifica a versão completa nos metadados do HTML e no service worker, sem acrescentar o número de patch à interface.

O atualizador executa testes, ESLint, verificação de tipos e build no Linux e aguarda o CI antes de integrar o PR. A validação da entrega está registrada em [VALIDACAO.md](VALIDACAO.md).

As credenciais e as pastas `.env` e `.vercel` não são enviadas ao GitHub. Não copie tokens para mensagens, issues ou commits. Quando o GitHub estiver conectado à Vercel, integrar o PR em `main` também pode disparar a publicação automaticamente.

## Banco e dados locais

A atualização reaproveita as configurações de Production e Preview; não substitui o banco nem apaga suas aventuras atuais. Confira [RUNTIME.md](RUNTIME.md) se precisar configurar uma instalação nova ou habilitar o armazenamento de áudio.

O Preview tem um endereço diferente de produção. Boxes, equipes e preferências salvas no navegador pertencem ao domínio onde foram criadas. Para testar o PC no Preview, importe uma Box exportada pelo Link Cable. No endereço de produção `myowndex.vercel.app`, os dados locais continuam na mesma origem.

## Remover a integração de hospedagem antiga

A hospedagem usada por este projeto é a Vercel. Configurações do repositório não removem integrações instaladas na conta GitHub: checks antigos podem continuar aparecendo até revogar o acesso ao repositório.

Para retirar apenas o MyOwnDex da integração Netlify, abra **GitHub → Settings → Applications → Installed GitHub Apps → Netlify → Configure**. Em **Repository access**, use **Only select repositories**, retire `myowndex` da seleção e salve. Mantenha selecionados os demais repositórios que ainda usam essa integração.

Abra diretamente a [lista de integrações instaladas](https://github.com/settings/installations). A remoção de um repositório não exige desinstalar ou suspender a integração inteira.

A conexão via GitHub App pertence à conta e não pode ser retirada apagando arquivos do projeto. Se o GitHub recusar uma alteração por falta de permissão, o acesso continua ativo. Checks de commits anteriores permanecem no histórico mesmo depois da desconexão.

Consulte as [instruções do GitHub para gerenciar GitHub Apps](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps). A atualização do código usa Vercel e Turso.
