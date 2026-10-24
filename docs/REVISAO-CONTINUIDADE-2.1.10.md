# Continuidade da revisão — 2.1.10

A base é a produção 2.1.9, commit `e59b3b2dba222f2ff43f319450d243e31ab8d647`. Esta revisão não altera fórmulas, Pokémon, atributos, gastos ou fichas salvas.

## Falha encontrada depois da publicação

O CI do PR 119 passou. A execução disparada em `main` depois da publicação falhou somente na conferência pública: `tests/browser-production.mjs` ainda esperava 40 regras, mas encontrou as 48 atuais. Evidência: [execução 40066302635, trabalho 120790505217](https://github.com/1lucas1barroso0/myowndex/actions/runs/40066302635/job/120790505217). A asserção antiga interrompia o restante dessa conferência, apesar das verificações anteriores do artefato terem passado.

O teste agora compara os identificadores publicados com todos os identificadores da fonte canônica. Isso verifica quais regras estão presentes, além da quantidade. O mesmo fluxo completo passa a rodar contra o artefato local no CI antes de publicar; a conferência pública depois da publicação permanece. Ambos bloqueiam escritas remotas e usam um contexto descartável de visitante.

A primeira execução dessa conferência local também identificou um pressuposto do teste: metadados de compartilhamento apontam para a origem pública canônica mesmo em um artefato local. O teste exige essa origem canônica somente para a imagem compartilhada, mantém os ícones na origem testada e confere os bytes de todas as imagens no próprio artefato. Não aceita uma origem externa arbitrária nem busca a imagem da produção para aprovar a cópia local. A conferência completa agora roda logo após iniciar o servidor de QA.

## Casos que ensinam a acompanhar os acontecimentos

Veneno e variação de dano mostram resultados alternativos, partindo do mesmo estado. Sono e Dynamax mostram acontecimentos em sequência. Essa diferença agora aparece antes dos valores, sem exigir abrir a ficha técnica. A busca inclui essas novas explicações e abre o caso correspondente.

O caso de Poison Sting continua usando as fichas e a execução da 2.1.9. A condição é mostrada nos dois resultados alternativos do encerramento da rodada. Ambos continuam deixando Pikachu envenenado. Não são dois descontos de HP aplicados na mesma rodada.

O controle para conferir a preparação do caso usa o padrão compartilhado de espaço, foco e alvo de toque dos demais controles do Guia. Nenhuma cor ou sistema visual foi acrescentado.

## Pendências que exigem outra forma de validação

A observação de crianças e de grupos reais em mesa continua pendente. A reprodução mecânica não mede compreensão, entusiasmo, diversão ou protagonismo. O roteiro existente em `VALIDACAO-2.1.0.md` continua sendo a referência para registrar essas observações.

A integração antiga da Netlify continua enviando checks com falha. O status do commit base aponta para o deploy `6adc3f7174ae43c1bbd4856d`; Vercel publicou a mesma revisão com sucesso. Não foi demonstrada a causa interna da falha da Netlify. A conexão disponível com o repositório não permite administrar o acesso de outros GitHub Apps. A retirada apenas do MyOwnDex dessa instalação depende da conta proprietária, conforme `AUTOMACAO.md`. Checks não foram ocultados nem substituídos por sucesso artificial.

## Validação da entrega

Reproduzir os casos do Guia; executar testes unitários, lint, tipos e build; conferir a nova explicação, a busca e o controle de preparação no navegador. A publicação depende do CI completo, agora incluindo o fluxo antes restrito à produção. Confirmar versão e revisão no endereço público após publicar. Registrar os resultados efetivos no PR da entrega, sem confundi-los com observação humana em mesa.
