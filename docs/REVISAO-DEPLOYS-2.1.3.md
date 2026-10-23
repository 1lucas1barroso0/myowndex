# Revisão dos deploys — 2.1.3

Base examinada: produção 2.1.2, commit 4b16b4d30f9eb88c59d81ce04c5dffdcef4414f8. Também examinados os resultados de 2.1.1 e da proposta de proteção de aprendizado (PR 112). Compilação READY na Vercel não foi tratada como equivalente a CI completo aprovado.

## Achados e correções

- As versões examinadas passaram em regras, lint, tipos, build e fontes. O navegador da 2.1.1 e do PR 112 parou procurando os antigos botões de Amizade em 50; o da produção 2.1.2 parou lendo a lista de iniciativa enquanto o painel mobile ainda estava oculto. Os ensaios agora usam +5, +10, +20 e −5, verificam o ajuste excepcional manual e aguardam a linha visível no retorno ao Campo. Não se adicionou espera artificial nem se removeu a asserção sobre ação/PP.
- A proteção do PR 112 é incorporada: aprender ao evoluir (nível 0) não é aprender automaticamente no nível 1. Espécie, jogo, método e nível continuam obrigatórios; Máquina/Tutor/Ovo não são concedidos como movimentos naturais. Dados existentes e registros da Pokédex permanecem preservados.
- Adicionar à Box e Gerar Pokémon usavam seleções diferentes. Agora chamam o mesmo núcleo de repertório natural. Em automático, títulos sem aprendizado comum positivo não apagam um repertório natural disponível. Escolha explícita de jogo não recua silenciosamente para outro. A ordenação dos quatro movimentos também fica consistente. O helper está no módulo pequeno de aquisição, sem carregar todo o gerador na entrada principal.
- Na interface pública, conferidos Petal Blizzard de Vileplume em XY (Nv. 50), ORAS (Nv. 49) e Scarlet/Violet (Ao evoluir), sem modificar os registros. Em Champions, o método aparecia como Train; passa a Treinamento no rótulo compartilhado, sem inventar um nível ou alterar a disponibilidade.
- O ensaio auxiliar de ciclo de batalha ainda procurava rótulos antigos; foi alinhado a Escolha e Batalha.
- O CI executava os demais ensaios de navegador apenas se o anterior passasse, ocultando outras pendências. Os ensaios independentes agora continuam após falha, desde que o servidor tenha iniciado e a execução não tenha sido cancelada. Falhas continuam reprovando o job. Scripts independentes agrupados preservam o código de erro e executam todos, reduzindo novas rodadas só para descobrir o próximo problema.

A primeira rodada completa mostrou seis expectativas antigas adicionais: contagem fixa de 40 regras em três ensaios (o Guia tem 48), HP ainda esperado na escala por 10 em dois ensaios e concessão de XP/descanso durante confronto aberto no ensaio de fases. As verificações passaram a conferir todos os IDs das regras atuais, HP por 8 com migração de estado cheio e o encerramento explícito antes de XP/descanso, seguido de nova batalha antes de Mega. Não se retiraram as verificações nem se restauraram regras antigas para acomodá-las.

## Verificação e limites

A validação local e a execução remota são registradas por commit. A revisão local inicial passou em 696 testes, sem falhas/ignorados, lint, tipos e build; a validação do CI deve incluir todos os fluxos de navegador antes da publicação. Relatórios históricos não são reescritos como se certificassem esta versão. Instalação física Android/iOS e observação humana de mesa continuam pendentes conforme o roteiro da 2.1.0. Nenhum dado real de jogador foi editado nos ensaios.
