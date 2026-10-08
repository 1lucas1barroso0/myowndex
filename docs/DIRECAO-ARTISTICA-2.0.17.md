# Direção artística — revisão 2.0.17

Esta revisão conserva a direção mais recente: um jogo Pokémon alegre para crianças e fãs, com superfícies foscas, cores vivas, espaço confortável e profundidade curta. A identidade vem dos Pokémon e das interações. Não há pisos cinza, halos, réguas ou balanços artificiais nos sprites.

## Uma RotomDex própria

A RotomDex v101 mais recente é o mestre único. Cabeçalho, abertura e favicon usam esse desenho; instalação, atalhos e compartilhamento recebem PNGs derivados dele. O manifesto e as referências são versionados para renovar imagens antigas em cache. A imagem de compartilhamento é opaca, e o ícone recortável mantém a arte dentro da área segura.

Os arquivos raster são reproduzíveis com `node scripts/atualizar-icones.mjs`. Não redesenhar cada superfície separadamente.

## Pokémon vivos e reconhecíveis

Cada espécie decorativa tem um único lar: Pikachu na Pokédex, Psyduck no estado vazio, Porygon no PC, Noctowl no Guia, Mudkip na Aventura, Victini em Dados, Ditto no Gerador e Eevee na Conta. A abertura pode mostrar o mesmo Pikachu antes de a Pokédex aparecer, sem duplicar decoração no mesmo estado.

GIFs transparentes oferecem movimento natural. Quem prefere menos movimento vê o PNG estático; falhas de imagem têm recuperação. Nos sprites de jogo, um índice local de disponibilidade permite escolher animações verificadas da forma e do Shiny corretos, sem novas consultas ao catálogo. O índice registra o commit verificado do repositório PokeAPI/sprites e a data da verificação; ele descreve disponibilidade de arte e não altera as regras. O índice é reproduzível com `python3 scripts/atualizar-indice-animacoes.py --check src/data/animated-sprites.json`. Imagens comunitárias de gerações posteriores não são apresentadas como sprites oficiais de Black/White.

As alturas oficiais usam uma escala visual comprimida e crescente de 0,72 a 1. Ela preserva a diferença entre espécies sem transformar as menores em detalhes invisíveis. O palco é transparente e a base do Pokémon permanece ancorada; animação não altera a posição da ficha ou do campo.

## Clareza sem ruído

Os rótulos continuam diretos e em português, com nomes próprios originais do catálogo. Ajuda secundária aparece quando a pessoa abre seus detalhes. O Gerador mantém a explicação do sorteio justo disponível, sem expor um parágrafo permanente. Dados apresenta Rolagens e Campo juntos e três escolhas distintas de rolagem, com nome e dado separados.

Os filtros são aplicados antes de agrupar a mesma entrada nacional. Assim, buscar uma geração, tipo ou região pode revelar a variante correspondente, e alternar a visualização preserva a busca. A classificação conservadora e os favoritos próprios permanecem. A forma original nomeada ocupa um único lugar no catálogo, sem duplicar sua chance de sorteio. Uma variante distinta usa sua própria linhagem e não recebe movimentos de outra forma quando o catálogo está vazio. Formas que determinam o gênero mantêm esse gênero na geração, edição, recuperação e compartilhamento, sem apagar progresso. Na ficha do PC, o controle de formas oferece apenas mudanças do mesmo indivíduo; região, sexo, tamanho e estilo permanentes não são transformações livres.

## Continuidade

Contas, Boxes, aventuras, regras e cálculos permanecem compatíveis. Áudio e chamadas seguem externos ao MyOwnDex, como decidido anteriormente. A matriz de navegador verifica animação, redução de movimento, identidade, recorte ancestral, telas estreitas, zoom, modais e rolagens. Referências externas são verificadas por conteúdo antes da entrega.
