# Atualização dos dados Pokémon

O aplicativo consulta a PokéAPI com cache de seis horas e reaproveitamento offline em caso de falha. Isso atualiza os recursos consultados, mas não recompila os catálogos locais, traduções ou regras executadas pelo aplicativo. O catálogo servido no mesmo endereço usa rede primeiro no service worker; o código compilado acompanha a versão do aplicativo.

## Atualização e publicação

O workflow `freshness.yml` executa a regeneração diariamente às 10h17 UTC (7h17 em Belém). `scripts/atualizar-dados.py` resolve revisões exatas de PokeAPI, Pokémon Showdown e PokeMiners, atualiza os consumidores e hashes juntos e executa os seis geradores na ordem de dependência. As fontes e saídas têm comprovação em `docs/*provenance.json` e `docs/data-refresh-sources.json`.

Se há mudanças, o workflow incrementa o patch, atualiza o cache do PWA e executa testes, verificação de tipos e build antes de enviar a main. Um push concorrente interrompe a publicação; não há force push. A integração existente da Vercel recebe a main. O workflow dispara também `quality.yml`, porque pushes com GITHUB_TOKEN não disparam outros workflows automaticamente. Publicação precisa ser conferida na Vercel; passar no build não comprova deploy.

Alterações de callbacks, esquemas ou textos sem tradução interrompem a atualização e preservam produção. Elas são atendidas pela revisão diária do MyOwnDex, que já acompanha também a megafauna e passou a abranger dados, regras, novidades oficiais e falhas de sincronização. A conta atingiu o limite de cinco tarefas; o acompanhamento existente do mesmo projeto foi ampliado, conservando os critérios de megafauna. Nenhum monitor de outro assunto foi removido.

O atualizador não executa código baixado de fontes externas e não traduz durante uso, instalação ou build. A opção de desenvolvimento `--review-mechanics` só deve ser usada depois de comparar mudanças da fonte com a implementação e testar as interações afetadas. Novas descrições precisam de pares EN/PT preparados e persistidos. Não alterar expectativas de teste apenas para aceitar uma fonte nova.

## Mudanças anunciadas e jogos históricos

`pending-game-updates.json` mantém anúncios com fonte, data prevista, valores anteriores e posteriores e validações necessárias. O patch de Champions de 2 de dezembro de 2026 está **anunciado**, sem confirmação de entrada em vigor. Não deve alterar os valores atuais em 20 de novembro. A revisão agendada confirma a manutenção antes de implementar/ativar os efeitos, os aprendizados e os textos.

Jogos históricos continuam com seus valores e aprendizados próprios. Novos movimentos de Champions são treinamento, sem inventar níveis. RPG, Jogos e Livre mantêm suas regras de seleção de referência. Atualizar dados não migra automaticamente um indivíduo salvo, apaga sua história ou renova HP/PP gastos.

## Limites verificáveis

Uma fonte comunitária pode demorar a incorporar uma notícia oficial; a revisão de anúncios cobre essa diferença. Uma nova geração pode exigir novos índices, limites, sprites e regras: o workflow interrompe ao encontrar estrutura desconhecida, e a revisão trata a adaptação. Não há garantia de disponibilidade ininterrupta de GitHub, fontes, automações ou Vercel; falhas devem ser identificadas e corrigidas, sem afirmar atualização concluída antes de conferir a produção.
