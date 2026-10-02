# Atualização do MyOwnDex no Linux

## Um arquivo, um comando

Baixe `myowndex-v11.1-linux.sh` e execute no terminal, dentro da pasta do download:

```bash
bash myowndex-v11.1-linux.sh
```

O atualizador inclui o projeto e verifica a integridade do pacote. Aproveita os seus logins do GitHub e da Vercel e as variáveis dos bancos já configuradas no projeto `myowndex`. Não há cadastro Turso ou migração de salas nesta atualização.

Esta entrega atualiza a versão 11 publicada, usando como base o commit `f428b70ea9a3f948d1c9c0eda17e5d2deaf165f8` de `main`. O patch é aplicado em um checkout separado e preserva mudanças posteriores compatíveis. A versão 11.1 melhora espaçamento, seleção de modos, leitura do Guia, registros de Pokémon, Boxes e editores; limita os caches regeneráveis.

A preparação do código executa testes, lint, verificação de tipos e build antes de publicar. O processo confere o repositório e o projeto Vercel para evitar enviar a atualização ao destino errado. Se uma etapa falhar, interrompe a execução e informa a pasta preservada para investigação.

Execute novamente o mesmo arquivo para retomar. O pacote tem uma pasta de estado própria identificada pelo SHA-256; execuções de versões diferentes ficam separadas. Os branches continuam com o prefixo `codex/myowndex-v11-`, e a opção `MYOWNDEX_V11_STATE_DIR` continua disponível para quem já personalizou o local de trabalho. Se esse diretório já contiver outra entrega, o atualizador cria uma subpasta identificada pelo digest e preserva o trabalho anterior.

As opções `bash myowndex-v11.1-linux.sh verificar` e `bash myowndex-v11.1-linux.sh extrair` validam o checkout ou extraem os arquivos sem publicar. `COMANDO-V11.1.txt` encontra o instalador baixado; `SHA256-V11.1.txt` contém os hashes dos arquivos de entrega. O pacote também é disponibilizado como `myowndex-v11.1-linux.tar.gz` e `myowndex-v11.1.zip`.

Validação desta atualização: 209 testes, ESLint, verificação de tipos e build aprovados. O atualizador repete os checks no Linux e aguarda o CI antes de integrar o PR.

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
