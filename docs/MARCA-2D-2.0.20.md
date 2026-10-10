# Marca 2D do MyOwnDex — 2.0.20

A marca v105 usa uma ilustração humana de Pokédex aberta e sem rosto: aparelho vermelho, lente azul e tela ciano. Todos os caminhos do aparelho são os mesmos da obra original. Só cores, fundo e enquadramento foram adaptados. A marca pintada v104 e o desenho procedural inicialmente ensaiado não são usados.

## Autoria, fonte e condições

**Carol Liao / toicon.com**, coleção Fandom, ícone “to identify”, publicado antes do registro de 10 de julho de 2017. Licença **Creative Commons Attribution 4.0 International (CC BY 4.0)**. Wikimedia Commons revisou a disponibilidade da licença em 23 de dezembro de 2024. O registro de autoria e a data anteriores à atual geração de imagens, o SVG original e os caminhos intactos fornecem procedência verificável, sem atribuir trabalho artístico ao MyOwnDex ou a uma IA.

- [Obra original e registro de licença](https://commons.wikimedia.org/wiki/File:Toicon-icon-fandom-identify.svg).
- [SVG original](https://upload.wikimedia.org/wikipedia/commons/a/a1/Toicon-icon-fandom-identify.svg).
- [Licença CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- [Coleção original arquivada](https://web.archive.org/web/20170103230635/http://www.toicon.com:80/collections/game-on).

A licença permite copiar, compartilhar e adaptar a ilustração com crédito ao autor, link da licença e indicação das mudanças. Essa atribuição aparece nos Créditos recolhidos do jogo, neste documento e no próprio SVG. Não se sugere endosso do autor. A licença da fan art não transfere marcas ou direitos sobre a franquia Pokémon; seus titulares continuam os mesmos. O MyOwnDex permanece um projeto de fãs pessoal, recreativo e não comercial, sem vínculo oficial.

Fonte original preservada sem alterações: `public/icons/myowndex-dex-v105-original.svg`.

SHA-256: `337e0187c6fbadf7700a643354a1cd9f03a3670564e590d869de49c95025d1b0`.

O script verifica esse hash antes de reproduzir os derivados. `public/icons/myowndex-dex-v105-source.svg` é a adaptação; seus caminhos são testados contra a fonte original. O círculo decorativo de fundo foi retirado e a paleta ganhou vermelho, azul e ciano vivos. O enquadramento preserva a anatomia do aparelho e sua proporção. Não há nova ilustração gerada, perspectiva tridimensional ou filtros de volume.

## Pesquisa

Consulta em 9 de outubro de 2026: Bulbapedia e Serebii para os modelos clássicos da Pokédex; catálogos PokeAPI, Wikimedia Commons, SVG Repo, Rive, Roundicons e Icon-Icons para obras oficiais/comunitárias e autoria/licenças. As alternativas Roundicons pesquisadas usam aparelhos cinzentos que não atendem tão bem à direção desejada. A ilustração de Carol Liao oferece desenho humano, cores adaptáveis, identificação da autoria e licença explícita. Não se presumiu que finalidade não comercial dispense autorização ou atribuição.

## Reprodução e apresentação

`node scripts/atualizar-icones.mjs` reproduz a adaptação SVG e os oito PNGs, incluindo o mestre de 1024 pixels. Usa o Sharp já instalado, sem novas dependências. Cada tamanho é rasterizado diretamente dos caminhos vetoriais, evitando ampliar uma imagem pequena. Favicon e cabeçalho são transparentes, sem borda branca. Ícones opacos e compartilhamento usam azul profundo `#0b3152`; o recortável preserva o aparelho inteiro dentro do círculo seguro de 80%, verificado pixel a pixel.

Os sete ícones necessários às superfícies do jogo somam menos de 80 KiB. O mestre e os dois SVGs ficam fora da lista de cache inicial. A abertura permanece breve: uma marca e três pontos, sem repetir um Pokémon decorativo. Movimento reduzido continua respeitado.

## Histórico

v101, v103 e v104 são revisões históricas. Seus arquivos e registros de procedência permanecem preservados; não são apresentados como marca vigente. A orientação de 2.0.19 sobre pintura, mestre v104 e fundo creme foi substituída por esta direção 2D com autoria humana.
