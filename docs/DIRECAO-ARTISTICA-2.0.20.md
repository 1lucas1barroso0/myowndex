# MyOwnDex 2.0.20 — mundo Pokémon em 2D

Esta é a direção vigente. Registros de versões anteriores permanecem históricos; pintura gerada, renderizações 3D e escala física comprimida foram substituídas.

O jogo compartilha cores vivas, contornos nítidos, superfícies planas e estados legíveis. Vermelho identifica ações, azul e verde organizam áreas, amarelo destaca escolhas. Texto tem contraste verificável nos dois temas. As áreas de leitura permanecem tranquilas para que Pokémon, ações e resultados tenham protagonismo.

## Pokémon, escala e movimento

Sprites mantêm identidade, forma, gênero, paleta, ângulo e todos os pixels dos quadros originais. Fontes animadas 2D têm preferência; uma animação de modelo 3D não conta como substituta. A falta de uma fonte não permite inventar quadros, recolorir outra forma ou declarar cobertura inexistente.

O enquadramento usa a união dos pixels visíveis de todos os quadros. Remove apenas margens transparentes e preserva proporções, caudas e asas. Retratos possuem enquadramento próprio. No campo, uma escala linear comum respeita a altura documentada da forma exibida, incluindo transformações e ilusões. Retratos acessíveis separados permitem reconhecer um Pokémon pequeno mesmo junto de um gigante.

Um observador de visibilidade atende a coleção inteira. Sprites visíveis animam por seus próprios quadros; fora da tela, em aba oculta ou atrás de um diálogo, liberam a fonte animada. Não há temporizador ou animação artificial por Pokémon. Movimento reduzido usa uma imagem 2D da mesma identidade. Falhas de rede preservam a ordem de recuperação e não trocam silenciosamente o Pokémon.

## Dispositivos e interação

Navegação, filtros, fichas, gerador, Boxes, conta, Dados e aventura preservam suas funções. Campos e ações têm espaço próprio e alvos de toque legíveis. Cabeçalhos estreitos reorganizam título, fechamento e Pokémon sem sobrepor ou partir palavras. Os menus móveis ocupam menos altura para dar espaço ao jogo.

Detalhes continuam consultáveis sob demanda. Foco de teclado, seleção, erro e estado desabilitado não dependem apenas de cor. As 40 regras, rolagens, XP, EVs, amizade, prioridades, armazenamento e sincronização não são alterados por esta reformulação visual.

## Autoria e reprodução

- [Marca humana e atribuição CC BY 4.0](MARCA-2D-2.0.20.md).
- [Fontes de animação, procedência e cobertura real](SPRITES-2.0.20.md).
- [Cenários 2D e fontes licenciadas](CENARIOS-2D-2.0.20.md).
- [Enquadramento, escala e suspensão de animações](SPRITE-PRESENTATION-2.0.20.md).

Os scripts de reprodução usam recursos existentes, sem dependências novas de produção. Fontes originais, licenças e identificadores verificáveis acompanham os derivados. Arquivos e pacotes históricos permanecem preservados, sem referências ativas às marcas anteriores.

## Validação

Testes de regras e integração, lint, tipos e build acompanham verificações reais de navegador: telas estreitas, celular, tablet, desktop, zoom, dois temas, teclado, movimento reduzido, quadros animados, escala entre espécies e CPU reduzida. O CI incorpora a auditoria de mundo 2D, acessibilidade e desempenho. Os relatórios da entrega registram os resultados efetivos e eventuais lacunas de fontes; a existência de um teste não substitui sua execução.
