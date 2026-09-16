# MyOwnDex 9.16.1 — dados locais

Atualização restrita às rolagens neste aparelho, sobre o commit 4053e539ab1a425ef77825d0376270984d4999a0.

- Correção do reabastecimento do Web Crypto: um lote só fica disponível depois de uma chamada bem-sucedida. Falhas repetidas nunca liberam valores vazios, parciais ou reaproveitados da tentativa que falhou. Sem fonte segura, a rolagem falha sem produzir um resultado.
- Painel local comum ao Guia e às aventuras neste aparelho: 2d6, 3d6 com vantagem/desvantagem, d100 e dados livres d4/d6/d8/d10/d12/d20/d100, até 20 dados, com modificador.
- Dificuldade opcional, chances exatas, críticos e erros críticos conforme as regras existentes; empatar não supera a oposição. Os cálculos de chance não usam aleatoriedade.
- Dados mantidos e descartados identificados por texto, resultado e parâmetros originais preservados, proteção contra duplo toque e repetição de Enter, cópia e vibração opcional. Animação curta sem novos sorteios e respeito ao movimento reduzido.
- Histórico das últimas 100 rolagens, persistência por registro para impedir sobrescrita entre abas, importação do histórico anterior do Guia e exportação em texto. Falhas de armazenamento preservam o resultado na sessão e são informadas. O histórico pertence ao aparelho e não é uma prova de autoridade do servidor.
- Preferências salvas, campos e áreas de toque adaptáveis a telas pequenas, estilos restritos ao painel local usando os temas existentes.

## Validação executada

- 168/168 testes unitários aprovados, incluindo 12 testes novos determinísticos sobre resultados, probabilidades, histórico, armazenamento e falhas do Web Crypto.
- ESLint e TypeScript aprovados.
- Build completo Sites/Cloudflare aprovado, com manifesto de hospedagem e Worker validados.
- 1/1 teste de HTML renderizado aprovado.
- Contratos existentes de autoridade remota e regras de combate aprovados na suíte. Endpoints, protocolo, banco de dados, distribuições de combate e permissões não foram alterados. O endurecimento do utilitário Web Crypto também beneficia chamadas que usam esse utilitário no servidor.

Não foi feita uma nova auditoria geral nem uma matriz de testes em aparelhos físicos. Os testes desta versão cobrem o foco solicitado. O lockfile e as versões de dependências foram preservados.

## Instalação Linux

O instalador contém a fonte e o histórico Git completos. Cria `~/MyOwnDex-9.16.1`, sem substituir a pasta anterior, e verifica a integridade do pacote. Executa dependências exatas, testes, lint, TypeScript, build e renderização antes de publicar a branch `codex/local-dice-9.16.1` e `main` no GitHub por fast-forward. Precisa de Node.js 22.13 ou superior, npm, Git, curl e autenticação GitHub já configurada.

Com o arquivo salvo em Downloads:

```sh
bash "$HOME/Downloads/MyOwnDex-9.16.1-instalar.sh"
```

Somente validar: acrescente `--validate-only`. Somente extrair: `--extract-only`. Dentro do checkout, repita com `bash scripts/validate-and-publish.sh`.

O domínio https://myowndex.vercel.app mantém o encaminhamento ao mesmo runtime existente. O instalador verifica a versão da PWA no domínio de produção e executa o smoke test existente da API. Histórico remoto mais novo ou divergente é preservado, sem force-push.
