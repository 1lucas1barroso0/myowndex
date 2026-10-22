# Otimização do MyOwnDex 2.0.50

A atualização preserva a interface, as funcionalidades, as 40 regras, o sorteio de dados, as chaves de armazenamento, as contas, as Boxes e as aventuras. Não há nova dependência do aplicativo nem alteração de schema.

## Alterações

- A cortina mantém suas prévias no próprio cabeçalho, sem renderizar toda a tela a cada movimento. Sua preferência é restaurada antes da primeira pintura.
- Cortina, movimento e redimensionamento de Pokémon agrupam as prévias por quadro. Finalizar, cancelar ou desmontar cancela a prévia pendente; os dados finais continuam sendo confirmados pela ação original.
- Cartões da Pokédex recebem callbacks estáveis. Sprites e parceiros decorativos reutilizam a renderização enquanto suas propriedades não mudam.
- A observação de sprites ignora edições comuns de texto e listas. Abertura/fechamento de diálogos e mudanças de visibilidade continuam suspendendo ou retomando os sprites pertinentes.
- A ordenação reutiliza o comparador de idioma. A busca reaproveita os nomes normalizados, libera catálogos substituídos por referências fracas e invalida os dados quando qualquer nome ou alias muda.
- A ficha reutiliza opções de itens, habilidades e Mega Evolução. Sugestões interrompem a busca após os mesmos cinco resultados e preservam a navegação por toque e teclado.
- O campo reutiliza a escala física enquanto os Pokémon não mudam e usa a medição inicial do gesto para calcular a prévia, evitando leituras repetidas de layout.
- Telas, ferramentas e fichas começam a carregar quando recebem intenção por ponteiro ou foco. Os demais módulos continuam sendo carregados sob demanda.

## Medidas locais

Comparação do seletor anterior (`721ebe1`, versão 2.0.49) com o seletor atualizado, no mesmo catálogo. Cinco rodadas alternadas por implementação, com 500 chamadas por rodada e ordenação por nome; valores abaixo são medianas.

| Consulta | Antes | Depois | Redução do custo |
| --- | ---: | ---: | ---: |
| Sem termo de busca | 1.627 ms | 694 ms | 57% |
| `char` | 639 ms | 241 ms | 62% |

Esses números medem o processamento do catálogo. Não representam o tempo de carregamento completo nem uma garantia de FPS em qualquer dispositivo.

O roteiro `browser-performance.mjs` mantém os 1.025 Pokémon disponíveis, testa busca e favoritos e percorre as quatro áreas e as três ferramentas em cinco tamanhos, incluindo paisagem, com CPU desacelerada em 4×. Na execução final, as 37 ações medidas terminaram entre 148 e 930 ms, sem erros de JavaScript. As medições incluem a automação e a espera por dois quadros, não apenas o tempo interno do evento.

## Validação

- 640 testes unitários e de integração aprovados, incluindo a matriz de filtros e a invalidação dos nomes de busca.
- ESLint, TypeScript, build de produção e auditoria de artefatos aprovados.
- Auditoria das dependências de produção: nenhuma vulnerabilidade encontrada.
- Navegação, cortina, gestos, painéis e foco: cinco larguras e dois temas.
- Estabilidade da moldura: 21 verificações de foco, teclado, zoom e Box cheia.
- Sugestões, Créditos e continuidade: toque, teclado e oito layouts de Créditos.
- Ficha: Shiny, identidade do sprite, persistência, HP e recuperação em quatro larguras e dois temas.
- Campo: fases e transformações, incluindo Eternamax, Rayquaza, Reversão Primitiva e Ultra Burst.
- Matriz responsiva: 200 verificações, incluindo 80 Boxes com 480 Pokémon; nenhum erro de página.
- Mundo 2D: 68 verificações e duas medições de desempenho; nenhuma violação de acessibilidade nos estados auditados, sprite visível ausente ou sprite animado fora da tela.
- Revisão visual de Pokédex, Aventura, PC e Guia em 390 px/Claro e 1440 px/Escuro, além da ficha e da edição de Shiny.

Os ensaios de navegador usaram Chromium local em perfis descartáveis. A cobertura de conta foi da interface sem autenticação; não houve criação ou alteração de contas ou aventuras reais. Desaceleração de CPU e mudanças de viewport simulam condições limitadas e não substituem testes físicos em todos os dispositivos.

## Publicação

Publicação autorizada pelo usuário. A entrega segue pela branch `codex/performance-2-0-50`, com PR, CI, preview correspondente e publicação do código validado na Vercel. A numeração do pacote e o cache do aplicativo acompanham a versão 2.0.50.
