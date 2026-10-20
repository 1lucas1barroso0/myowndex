# Direção de interface do MyOwnDex

O MyOwnDex é um jogo para fãs de Pokémon, incluindo crianças. Cada tela precisa ter identidade, uma finalidade evidente e uma próxima ação convidativa. A presença dos Pokémon, a curiosidade e o retorno das ações sustentam o interesse. A beleza deve ajudar a entender e a jogar. Esta direção vale para todo o aplicativo e toda mudança futura.

## Práticas positivas — aplique sempre

- **Uma hierarquia:** título, conteúdo principal, ação principal e ações secundárias reconhecíveis. O vermelho identifica o aplicativo; as cores de tipos identificam os Pokémon; alerta visual comunica um problema real.
- **Grupos coerentes:** botões juntos usam a mesma superfície, cor de texto e família de bordas, inclusive em seleção e toque. Indicar seleção por traço, espessura e estado acessível. Ações principais fora de um grupo usam o mesmo destaque do aplicativo. Ação perigosa tem confirmação contextual; não vira uma cor avulsa no meio do grupo.
- **Um sistema:** mesmas medidas, fontes, espaçamentos, curvas, estados de seleção, foco, fechar e comportamento para funções equivalentes. Definir o padrão compartilhado antes de criar uma exceção.
- **Espaço proporcional:** painéis crescem com seu conteúdo até o limite da tela. Apenas a região necessária rola; cabeçalho e fechar continuam acessíveis. Seções fechadas ocupam só o espaço do seu resumo.
- **Cortina e ficha:** cada marco da cortina mostra fileiras completas, com alça opaca de pelo menos 44 px e controles recolhidos invisíveis e fora do foco. Medir novamente ao mudar de largura. O cartão do Pokémon prioriza leitura; os campos ficam na edição recolhida. A amizade mostra a escala do modo atual junto do rótulo, como os demais atributos, sem empilhar escalas concorrentes nem repetir o indicador na edição. A marca reserva seu tamanho real antes da navegação; nunca pode ser coberta por controles. Todas as aparições da marca derivam da mesma fonte vigente, com movimento reduzido respeitado.
- **Shiny e HP:** Shiny tem símbolo, nome e seleção integrados em um alvo confortável, com estado acessível e foco de teclado. O HP mostra valor atual, máximo e barra proporcional; verde, amarelo e vermelho comunicam a condição junto dos números. Ficha e painéis de batalha usam a mesma leitura, sem alterar regras ou revelar HP oculto.
- **Gestos controlados:** a cortina pode recolher até restar só o puxador. Arraste apenas nos controles próprios; imagens não iniciam arraste nativo. Cancelamento, perda de captura, saída da janela e mudança de largura desfazem a prévia sem salvar. Arrastar não dispara um clique. No campo, mover e redimensionar são gestos separados e respeitam as permissões; o tamanho visual é ajustado pelo Narrador. Cancelar um toque não impede a próxima seleção. Texto editável continua selecionável.
- **Toque confortável:** alvos usuais de pelo menos 44 px, campos legíveis, rótulos persistentes, foco visível para teclado e nomes acessíveis. Cada controle responde sem deslocar o alvo nem reiniciar a escrita.
- **Feedback com propósito:** apresentar resultado, progresso, ação concluída ou erro junto da ação. Respeitar movimento reduzido e manter o controle com o jogador.
- **Pokémon reconhecíveis:** arte 2D, proporção preservada, animação autoral e enquadramento que não corte partes. Parceiros decorativos apoiam o conteúdo, têm tamanho legível e contraste com o fundo. Arte praticamente invisível é falha, não decoração concluída.
- **Opções justificadas:** toda seleção precisa mudar algo relevante e compreensível. Oferecer a mecânica compatível com espécie, forma, modo e jogo de referência; preservar dados antigos e escolhas livres explícitas.
- **Vocabulário familiar:** termos de Pokémon e português direto, adequado a crianças. Usar “dispositivo”; no tema, apenas “Claro” e “Escuro”. Tradução e texto original compartilham o mesmo bloco, com troca de idioma secundária.
- **Moldura estável:** somente o conteúdo ou diálogo ativo rola; documento e moldura não podem ser arrastados por foco ou rolagem programática. Usar a altura visível ao abrir teclado e retornar de outra janela. Recolher fileiras completas quando faltar altura, preservando a preferência. Testar abrir e fechar fichas com Box cheia, foco em campos, altura reduzida, zoom e retorno à janela.
- **Continuidade de aplicativo:** conservar posição, edição, dados e contexto ao abrir ferramentas, fechar painéis e navegar. Distinguir ações destrutivas e exigir confirmação contextual quando necessária.
- **Convite para jogar:** apresentar primeiro a ação de jogo e as escolhas compreensíveis; abrir campos apenas quando o jogador escolhe uma tarefa. O interesse e a vontade de continuar vêm de Pokémon reconhecíveis, exploração, criação, resultado e continuidade.
- **Revisão completa:** testar estado vazio, carregamento, erro, resultado, menus abertos, temas, teclado e telas estreitas/baixas. Auditar Aventura, Pokédex, PC/ficha, Guia, Dados/Campo, gerador e conta, incluindo os componentes compartilhados.

## Práticas negativas — proibidas

- Vazios causados por altura fixa sem necessidade; grandes intervalos entre campos ou seções fechadas; topo que rouba espaço do jogo sem função.
- Cor diferente em botões do mesmo grupo, texto de outra cor sem função, destaque ausente no conteúdo principal, decoração ilegível, espaços e palavras se obstruindo, telas dominadas por formulários.
- Controles desalinhados, título e Pokémon em linhas arbitrárias, botões de fechar em posições diferentes, arte distorcida e conteúdo cortado.
- Categorias artificiais, variantes misturadas a fenômenos de batalha, opções duplicadas, nomes de mecânicas que a espécie não possui e configurações sem efeito.
- Placeholders como orientação de preenchimento; instruções repetidas; documentação técnica em fluxos de jogo; alertas vermelhos para dicas rotineiras.
- Sombras, bordas, efeitos de elevação, cores ou animações concorrendo por atenção; movimento de layout ao tocar; moldura de foco de teclado presa após toque.
- Rolagem da página e de várias camadas competindo; perda de contexto; fechamento do teclado durante a digitação; perda silenciosa de dados.
- Obstáculos artificiais, urgência falsa, punição por sair ou recompensas manipulativas para prolongar uso. O interesse vem de explorar, criar e jogar.
- Acrescentar remendos CSS contraditórios sem revisar o padrão comum; declarar harmonia apenas porque os testes funcionais passaram.

## Critério de entrega

Uma tela está pronta quando a tarefa principal é evidente, o jogador consegue realizá-la com conforto e o resultado convida a continuar explorando. Verificar o produto renderizado e o efeito da mudança em todas as áreas que compartilham o componente. Nenhum teste garante que todas as pessoas vão gostar: a direção exige julgamento visual e revisão contínua.
