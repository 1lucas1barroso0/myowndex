# MyOwnDex 2.0.20 — mundo Pokémon 2D

A atualização reúne a mesma direção visual na Pokédex, PC, Gerador, Dados, fichas, Guia e aventuras: cores vivas, painéis planos, controles legíveis e Pokémon com movimento próprio. A marca é uma Pokédex sem rosto, adaptada de desenho humano com atribuição. Os nove cenários usam mapas 2D reproduzíveis e licenciados. O carregamento mostra somente a marca e três pontos.

O enquadramento preserva os pixels e a proporção dos sprites. No campo, uma escala linear comum respeita a altura da aparência exibida; retratos individuais dão espaço a pequenos e gigantes. Uma assinatura de visibilidade compartilhada suspende animações fora da tela, em aba oculta ou atrás de um diálogo. Movimento reduzido conserva a identidade em arte 2D estática.

## Preservação

A base publicada é o merge do PR #67, `493d945d2b74bc1a06b999077b6dd5d069dea71d`. As 40 regras, motor de batalha, XP, EVs, amizade, prioridades, catálogo, contas, armazenamento e sincronização permanecem preservados. O arquivo `src/core/rpgRules.js` mantém o SHA-256 `2ff25b7a7f45051d54aef2fe7d41be12eeee817778549a0acfa3934db8df8485`.

Nenhuma dependência de produção foi adicionada. Os 2.609 arquivos novos são distribuídos em 113 pacotes sem perda e verificados antes de desenvolver, testar ou compilar. O navegador recebe imagens individuais; não baixa os pacotes. A divisão resolve o limite de envio da integração sem alterar pixels, quadros, transparência ou duração.

Na retomada, a fonte e os três pacotes anteriores foram preservados na árvore `7355027b7016e2efd2540c303f977b188fe8fff5`. A candidata final inclui o preparador dos sprites no envio à Vercel e atualiza a referência do Pokémon Showdown para uma correção posterior de callback histórico. A comparação pelo extrator confirma os mesmos 40 movimentos e 54 valores literais consumidos; nenhum catálogo, regra ou arquivo de arte foi regenerado. Os pacotes corrigidos são separados dos anteriores e conferidos contra a árvore final.

## Verificações executadas

- 556 testes unitários: regras, integrações, procedência, identidade, enquadramento, cache offline e reconstrução dos sprites. Lint, tipos e compilação de produção aprovados.
- 200 verificações responsivas e 36 capturas: 16 dispositivos, dois temas, zoom de 200%, 80 Boxes com 480 Pokémon e alternância de filtros, formas e movimento.
- 68 verificações de mundo 2D: telas, toque, orientação, enquadramento, escala de 145:1, fontes autenticadas e quadros reais de Toedscool, Scovillain e Cinderace.
- 170 estados de acessibilidade: WCAG 2/2.1 AA automatizada, teclado, foco, leitura, controles, Gerador, Dados, ficha, conta e aventura compartilhada em banco isolado. Zero violações, transbordamentos, alvos de toque abaixo de 44 px, textos auxiliares abaixo de 14 px ou erros de página.
- 108 estados dos cenários e 14 verificações de aventura: nove mapas, clima, terreno, fases, seleção, iniciativa, HP, PP e proteção preservados. 72 capturas e seis galerias revisadas.
- CPU reduzida em 4×: abertura em 3.301 ms e atualização após rolagem em 815 ms, sem animações fora da tela. São medições locais, sem afirmação de desempenho em todo aparelho ou comparação com a versão anterior.
- 44 referências externas confrontadas com seus pins atuais. Auditoria das dependências de produção: zero alertas.

As repetições de um roteiro não são somadas como cenários diferentes. As capturas também foram inspecionadas; testes automáticos não substituem essa revisão.

## Limites reais

Todas as 1.025 espécies nacionais e 1.112 escolhas exibidas da Dex têm animação 2D frontal verificada nas duas paletas. O catálogo técnico tem 5.372 de 5.404 combinações de ângulo/paleta: faltam 28 vistas dos sete modos de transporte de Koraidon/Miraidon, duas vistas traseiras de Eternamax e duas vistas frontais de Corviknight Gigantamax. A pesquisa encontrou material ausente, estático ou malformado para essas combinações.

O índice de formas tem 3.134 de 3.158 combinações frontais. Repete parte das lacunas técnicas e acrescenta oito combinações das formas Antique de Sinistea/Polteageist, Artisan de Poltchageist e Masterpiece de Sinistcha, nas duas paletas. Seus identificadores e informações são preservados. Outra identidade, render 3D ou arte inventada não é apresentada como cobertura exata.

A auditoria completa ainda registra cinco nós da cadeia de desenvolvimento afetada por `braces`, sem versão corrigida publicada. A sugestão automática rebaixa a configuração do Next de 16 para 14 e não foi aplicada. Essa cadeia não faz parte das dependências de produção; o resultado de produção permanece zero.

Procedência, autores, condições e reprodução: [sprites](SPRITES-2.0.20.md), [marca](MARCA-2D-2.0.20.md), [cenários](CENARIOS-2D-2.0.20.md) e [apresentação](SPRITE-PRESENTATION-2.0.20.md). Os identificadores finais de Git, CI, produção e pacotes acompanham o relatório externo da entrega; este documento não declara uma publicação antes de ela ocorrer.
