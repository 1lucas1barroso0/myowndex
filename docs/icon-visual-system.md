# Sistema visual do MyOwnDex

O MyOwnDex combina a organização ampla dos menus de Pokémon Sword/Shield com os sprites e o acabamento dos jogos 2D HeartGold/SoulSilver e Black/White. Pokédex, PC, Guia e Aventura devem compartilhar tipografia, molduras, espaçamento e estados dos controles.

## Princípios

- Navegação principal estável, área de trabalho clara e ações situadas junto ao conteúdo que alteram.
- Sprites com pixels nítidos, sem suavização; escala proporcional, com espaço para cada Pokémon.
- Cores de tipos e estados preservadas sem criar uma paleta de interface diferente em cada tela.
- Títulos, rótulos e textos de ajuda com uma hierarquia comum. Frases curtas explicam ações e resultados.
- Movimento discreto para Pokémon e interações. Animações respeitam `prefers-reduced-motion`.

## Conteúdo e tamanho

Texto legível pode quebrar linha; não deve desaparecer para caber em um botão, cartão ou campo. Grades precisam usar colunas que encolhem com a janela. Modais respeitam a altura disponível, as áreas seguras do dispositivo e o zoom, com rolagem interna que alcance todas as ações.

Foco de teclado, seleção e erro precisam permanecer visíveis. Cor vem acompanhada de texto, ícone, posição ou atributo acessível. Os temas claro e noturno preservam a mesma hierarquia.

## Referências e fontes

- [Pokémon Sword/Shield](https://swordshield.pokemon.com/): referência para a organização das áreas e a hierarquia dos menus.
- [Sprites de HeartGold/SoulSilver](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver) e [Black/White](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-v/black-white): referência para contornos e escala dos Pokémon.
- Os iniciais [Snivy](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-v/black-white/495.png), [Tepig](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-v/black-white/498.png) e [Oshawott](https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/versions/generation-v/black-white/501.png) mostram contorno nítido, poucos tons por região e poses reconhecíveis em imagens transparentes de 96 × 96 pixels.
- [VT323](https://github.com/google/fonts/tree/main/ofl/vt323): fonte local para títulos e detalhes de interface; a licença está em `public/fonts/OFL.txt`.

O repositório de sprites também contém imagens comunitárias para espécies de gerações posteriores; não trate esses arquivos como sprites oficiais de Black/White. O catálogo nacional do MyOwnDex inclui gerações que não existiam nesses cartuchos.

A referência visual não altera as regras próprias do RPG nem transforma a aplicação em um jogo oficial. Sprites e personagens pertencem aos respectivos titulares.
