# Revisão 2.3.0 — acesso à profundidade

Atualização preparada para revisão, sem promoção automática para produção.

## Mudanças verificáveis

- Pokédex: o tamanho da janela resulta das colunas reais, altura do cartão e altura útil. ResizeObserver acompanha a grade e a área de rolagem; visualViewport acompanha mudanças de visualização. A janela nunca diminui ao redimensionar. IntersectionObserver carrega uma tela adicional quando o controle se aproxima. O botão continua disponível ao teclado. Cada lote termina numa linha completa, exceto quando os resultados legítimos acabam. Não há cartões de preenchimento. Resultados curtos mantêm a largura dos cartões, sem esticar para ocupar colunas vazias. Busca e filtros reiniciam uma janela pequena; favoritos, ordem e navegação continuam nas mesmas estruturas existentes.
- Descoberta: atalhos opcionais abrem fichas reais sem apagar a busca ou os filtros. O propósito da Pokédex aparece antes dos controles.
- Idioma: a descrição abre em português quando existe tradução editorial. O texto original, idioma, créditos e histórico continuam consultáveis, inclusive offline.
- Fichas: Pokédex e PC compartilham a explicação de atributos; exemplos de categoria usam movimentos oficiais. Treinamento esclarece os limites e dispensa alterações para começar.
- PC, Aventura, gerador, Dados e conta: propósito e próxima ação mais concretos. Conta explicitamente opcional. Nenhuma mudança nas permissões, sincronização ou mecânicas.
- Carregamento: ferramentas reconhecem a ação enquanto seus módulos chegam; falhas oferecem nova tentativa. Pré-carregamentos repetidos são compartilhados e uma falha permite tentar de novo.
- Guia: saída explícita de busca e filtro recupera as 50 regras. Mantidos o livro independente, procedimentos completos, condições, casos reproduzidos, cálculos e exceções.

## Validação

A suíte existente cobre regras e motor, procedência dos casos, aprendizagem e jogos de referência, evolução, transformações, condições, PP, treinamento, captura, dados, persistência, sincronização, acessibilidade, teclado, temas, responsividade e desempenho com CPU reduzida. Os testes novos exercitam a janela da coleção no Chromium e Firefox, telas largas, redimensionamento, rolagem progressiva, fim legítimo de filtro, idioma e preservação da busca. A matriz ampla existente continua obrigatória.

Uma janela de 3200 × 1800 representa espaço CSS comparável ao de uma tela 1920 × 1080 a 60%; isso não constitui teste manual do comando de zoom do Firefox. Conferir também esse comando em um Firefox interativo antes de certificar especificamente essa combinação.

Testes não comprovam interesse, compreensão, autonomia ou diversão infantil. A avaliação com pessoas ainda precisa observar, sem instrução prévia: encontrar um Pokémon, explicar uma diferença entre tipos, preparar um parceiro, resolver uma ação e reencontrar uma regra. Registrar onde a pessoa hesita, pede ajuda ou interpreta algo diferente do esperado. Repetir com leitores iniciantes e fãs experientes, sem usar tempo de permanência como medida isolada de qualidade.
