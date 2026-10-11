# MyOwnDex 2.0.27: Z-A, Mega Dimension, Terapagos e clima especial

## Identidades e elegibilidade
As 49 identidades técnicas de Mega Evolution (48 novas aparências contabilizadas nos jogos com suas variações) foram cruzadas com os registros de Pokémon e sprites da PokéAPI. A fonte de dados está fixada em PokeAPI/pokeapi@c80757193bd0889054e36f4209762360bdaa4b95, e a de sprites 2D em PokeAPI/sprites@d72f64eb74912747cb5c5579061ced4842ba0a98. A lista está em src/data/mega-za-forms.json.

Cada Mega exige sua Mega Stone; a correspondência por ID impede confundir Floette de Flor Eterna com outras Floette, Zygarde Completo com as demais formas, Meowstic macho/fêmea, Tatsugiri Curly/Droopy/Stretchy e Magearna de cor original. Mega Raichu X/Y, Mega Absol Z, Mega Garchomp Z e Mega Lucario Z usam pedras distintas. O catálogo conserva 2D real já materializado; não utiliza o sprite da forma base como se fosse o da transformação.

A versão de mesa utiliza os atributos, tipos e habilidades registrados nas fontes. Os casos em que a PokéAPI não apresenta habilidade oficial não recebem uma habilidade inventada. Os detalhes do consumo de Mega Power em combate de tempo real de Legends: Z-A, a transformação Rogue espontânea e os efeitos específicos de habilidades sem regras de Fate/Pokémon correspondentes não são convertidos artificialmente para o sistema de turnos.

## Terapagos
- Tera Shift: normal (1024) assume automaticamente Terastal (10276) quando entra em combate; Tera Shell impede dano normalmente eficaz ou superefetivo em HP cheio de ser tratado como tal.
- Terastalização do Terapagos Terastal causa a forma Stellar (10277), atributos e habilidade Teraform Zero.
- Teraform Zero limpa clima e terreno existentes uma vez quando a forma Stellar aparece. Alterações posteriores em campo podem criar novos efeitos. Sair do campo reverte o Pokémon para sua identidade normal sem curar dano.
- Tipagem defensiva Stellar preserva o tipo original. O bônus ofensivo simplificado para Stellar é aplicado no motor do RPG; o controle detalhado de bônus por primeiro uso de cada tipo ainda não está automatizado e não deve ser anunciado como tal.

## Clima extraordinário
- Primal Kyogre: Primordial Sea gera chuva intensa, impulsiona Water como chuva e anula golpes Fire que causariam dano.
- Primal Groudon: Desolate Land gera sol extremo, impulsiona Fire como sol e anula golpes Water que causariam dano.
- Mega Rayquaza: Delta Stream mantém ventos fortes e reduz fraquezas associadas à tipagem Flying.
- O clima depende de portador ativo e consciente, cessa quando a última fonte deixa o campo e pode ser substituído por outra das três habilidades extraordinárias. Air Lock/Cloud Nine neutralizam efeitos, sem apagar a representação visual.
- Teraform Zero pode limpar as condições, e a interface permite ao Narrador atualizar o cenário. Movimentos de clima não são capazes de sobrepor o clima primordial enquanto a fonte continua ativa.

## Validação e preservação
Scripts de testes incluem todos os registros Megas, restrições de Stone e forma, Tera Shift/Stellar/reversão, condições climáticas e Playwright no navegador. A atualização não altera arquivos de conta, Boxes, dados locais anteriores ou os pacotes de sprites 2D históricos.

## Referências
- https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution
- https://legends.pokemon.com/en-us/dlc
- https://www.pokebeach.com/2026/01/official-artwork-of-all-legends-z-a-mega-evolutions-revealed
- https://www.pokemon.com/br/pokedex/terapagos
- https://bulbapedia.bulbagarden.net/wiki/Primordial_Sea
- https://bulbapedia.bulbagarden.net/wiki/Desolate_Land_(Ability)
- https://bulbapedia.bulbagarden.net/wiki/Delta_Stream_(Ability)
- https://github.com/PokeAPI/pokeapi
- https://github.com/PokeAPI/sprites

