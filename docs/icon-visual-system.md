# Sistema visual do MyOwnDex

O MyOwnDex combina a organização ampla dos menus de Pokémon Sword/Shield com os sprites e o acabamento dos jogos 2D HeartGold/SoulSilver e Black/White. Pokédex, PC, Guia e Aventura devem compartilhar tipografia, molduras, espaçamento e estados dos controles.

## Princípios

- Navegação principal estável, área de jogo clara e ações situadas junto ao conteúdo que alteram.
- Sprites com pixels nítidos, sem suavização; escala proporcional, com espaço para cada Pokémon.
- Cores de tipos e estados preservadas sem criar uma paleta de interface diferente em cada tela.
- Títulos, rótulos e textos de ajuda com uma hierarquia comum. Frases curtas explicam ações e resultados.
- Movimento discreto para Pokémon e interações. Animações respeitam `prefers-reduced-motion`.
- Toda superfície continua reconhecível como parte de um jogo Pokémon, inclusive contas, Dados, importação, configurações, erros e estados vazios. Nenhuma função vira dashboard, formulário genérico ou painel administrativo para economizar espaço.
- Não há placeholders. Rótulos, ajuda e exemplos necessários pertencem à composição da tela, não desaparecem quando a pessoa começa a digitar.
- Conteúdo atual não convive com cópias ou referências obsoletas apresentadas como vigentes; histórico deve ser claramente histórico.
- Uma função principal tem um único lar visível. Dados permanece no acesso global e se adapta ao contexto; a Aventura não repete rolagens, histórico ou ferramentas Pokémon que já existem em outro lugar.

## Identidade e parceiros

O ícone atual representa um diário de treinador/Pokédex aberto: lente de consulta, rota de aventura e marcador dourado. A mesma identidade deve aparecer no cabeçalho, abertura, favicon e manifesto. Não manter uma segunda “cara” do app em paralelo.

Parceiros decorativos são Pokémon em GIF local quando movimento é permitido e PNG quando `prefers-reduced-motion` está ativo. Cada módulo principal tem ao menos um parceiro reconhecível. O sprite fica transparente e solto: não usar círculo, disco, cápsula ou halo atrás dele. A decoração nunca cobre controles nem altera a geometria necessária do conteúdo.

A direção é alegre, fosca e acolhedora. Priorize cor, ritmo, sprites e pequenos acentos gráficos em vez de brilho plástico, vidro, reflexos, bevels pesados ou sombras de produto SaaS.

## Conteúdo e tamanho

Texto legível pode quebrar linha; não deve desaparecer para caber em um botão, cartão ou campo. Grades precisam usar colunas que encolhem com a janela. Modais respeitam a altura disponível, as áreas seguras do dispositivo e o zoom, com rolagem interna que alcance todas as ações.

Foco de teclado, seleção e erro precisam permanecer visíveis. Cor vem acompanhada de texto, ícone, posição ou atributo acessível. Os temas claro e noturno preservam a mesma hierarquia.

## Menu da fase 2.0

O menu usa emblemas legíveis e uma seleção escura com acento dourado. Cada destino mantém seu nome e seu símbolo, sem depender apenas da cor. As grandes áreas diagonais pertencem ao cabeçalho; os módulos continuam com superfícies tranquilas para jogar e ler. A aparência e o estilo de jogo permanecem controles separados.

Os créditos ficam disponíveis sob demanda, sem disputar espaço com as ações. A versão visível é sempre a versão completa atual de `package.json`; abertura, rodapé, documentação vigente e shell offline devem acompanhar a mesma entrega.

O Gerador apresenta um encontro, sem presumir que os Pokémon são aliados. Os próprios resultados indicam que a geração terminou; somente situações que exigem atenção, salvamento e exportação precisam de mensagens adicionais. A personalidade vem dos sprites, dos símbolos e das interações existentes, sem inventar missões, recompensas ou regras.

## Referências e fontes

- [Pokémon Sword/Shield](https://swordshield.pokemon.com/): referência para a organização das áreas e a hierarquia dos menus.
- [Sprites de HeartGold/SoulSilver](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver) e [Black/White](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-v/black-white): referência para contornos e escala dos Pokémon.
- Os iniciais [Snivy](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-v/black-white/495.png), [Tepig](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-v/black-white/498.png) e [Oshawott](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-v/black-white/501.png) mostram contorno nítido, poucos tons por região e poses reconhecíveis em imagens transparentes de 96 × 96 pixels.
- [VT323](https://github.com/google/fonts/tree/main/ofl/vt323): fonte local para números e pequenos detalhes de interface; a licença está em `public/fonts/OFL.txt`.

O repositório de sprites também contém imagens comunitárias para espécies de gerações posteriores; não trate esses arquivos como sprites oficiais de Black/White. O catálogo nacional do MyOwnDex inclui gerações que não existiam nesses cartuchos.

A referência visual não altera as regras próprias do RPG nem transforma a aplicação em um jogo oficial. Sprites e personagens pertencem aos respectivos titulares.
