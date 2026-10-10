# Sprites 2D — MyOwnDex 2.0.20

A animação precisa vir dos quadros desenhados do Pokémon. Um GIF feito a partir de um modelo 3D não atende à direção artística desta atualização. O catálogo passa a escolher somente arte 2D com procedência positiva, tanto para a animação quanto para a imagem usada ao reduzir movimento. Não há recoloração automática, espelhamento para inventar uma vista traseira nem movimento criado por CSS.

## Fontes e autoria

| Fonte | Identificador imutável | Arte utilizada e condições |
| --- | --- | --- |
| [PokeAPI/sprites](https://github.com/PokeAPI/sprites) | `d72f64eb74912747cb5c5579061ced4842ba0a98` | Animações 2D de Black/White, com suas paletas, diferenças visíveis de gênero e ângulos disponíveis. A arte oficial é de Game Freak; Pokémon continua pertencendo a seus titulares. A licença do código ou de um catálogo não transfere os direitos dos personagens ou da arte oficial. |
| [Open-Source EBDX Renovation Project](https://eeveeexpo.com/resources/1831/) / [ChromeValiant](https://github.com/ChromeValiant/Pokemon-Essentials-21-With-Unofficial-EBDX) | `836bb026ba8f6c3b3ee3bb6d461c510263953a02` | Folhas comunitárias em estilo de batalha 2D, incluindo trabalhos dos projetos Smogon e Sprites Animados. Autores, animadores e compiladores estão na [lista original integral](../public/sprites/native/credits-ebdx.md). O recurso foi publicado para projetos de fãs; não declara uma licença SPDX específica. Os créditos e as condições da origem são preservados, sem apresentá-lo como MIT ou CC0. |
| [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab) | `27c65cc0164c3f0dc91ad42989ee4d50267e66a5` | Animações 2D de Emmuffin, Spikey-Valentine, baronessfaron, ◥θ┴θ◤ e Top_Kec para aparências documentadas. [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): uso não comercial e atribuição. [Créditos por aparência](../public/sprites/native/credits-pmd.txt) e [política original](../public/sprites/native/policy-pmd.md) acompanham os arquivos. |

O MyOwnDex é pessoal, recreativo e não comercial. Isso não elimina autoria nem condições de uso. Os Créditos recolhidos do jogo dão acesso à [lista consolidada](../public/sprites/native/credits.txt), aos autores e às provas de cada importação.

A consulta reaproveitou os catálogos e arquivos já auditados de PokeAPI, Smogon, EBDX e SpriteCollab. Também confrontou o EBDX com o commit posterior `0512c9f785f192927e9b552e8948270517d31081`: os blobs dos sprites coincidem com o pin utilizado. Não se confundiu falta em um fornecedor com inexistência geral, nem se trocou uma aparência por outra para obter uma contagem maior.

## Importação e reprodução

O lote desta atualização contém **1.329 combinações de aparência/ângulo/paleta**, convertidas de folhas nativas e deduplicadas em **2.609 arquivos imutáveis**: 1.305 animações e 1.304 imagens de recuperação. Os nomes incorporam o SHA-256 do conteúdo. São 71.284.820 bytes no lote completo; a interface carrega apenas os Pokémon visíveis, e não o acervo inteiro.

As margens transparentes são removidas com uma única caixa que contém todos os quadros. Pixels visíveis, proporções, sequência, transparência e duração são comparados após a conversão. GIF é usado quando conserva exatamente o RGBA original e reduz o arquivo. APNG preserva transparência parcial, cores e quadros quando a conversão em GIF não é fiel. A seleção não inventa um Shiny nem utiliza a vista frontal como vista traseira.

O código-fonte distribui o lote em 113 ZIPs determinísticos em `assets/sprites-2d/`, com hashes por pacote e por imagem. `npm run dev`, `npm test` e `npm run build` materializam e verificam cada arquivo antes de começar, usando `fflate`, que já era uma dependência do projeto. O navegador recebe as mesmas imagens individuais em `/sprites/native/`; não baixa nem descompacta os pacotes. Nenhum pixel, quadro ou tempo é alterado nesse empacotamento. Para preparar os arquivos em outro fluxo, execute `npm run sprites:prepare`; `node scripts/materializar-sprites-2d.mjs --check` verifica a saída. O script `scripts/empacotar-sprites-2d.py` reproduz os pacotes a partir do lote importado.

- [Prova do lote 2D](../public/sprites/native/provenance-2d.json): URL original, commit, blob Git, hashes, recorte, quadros, duração, escolha de codificação e rejeições.
- [Importações anteriores EBDX](../public/sprites/native/provenance-ebdx.json), [SpriteCollab](../public/sprites/native/provenance-pmd.json) e [ícone nativo de menu](../public/sprites/native/provenance-menu-icon.json).
- [Oito Pokémon decorativos](../public/sprites/native/provenance-companions.json): masters Black/White locais, hashes e duração real.
- [Reprodutor sem rede](../scripts/reproduzir-animacoes-nativas.py), com Pillow 12.3.0 como ferramenta de desenvolvimento. Não é uma dependência de produção.

Para reproduzir o lote novo a partir do repositório original no commit documentado:

```sh
python3 scripts/reproduzir-animacoes-nativas.py \
  --ebdx-2d /caminho/para/ebdx-original \
  --output /tmp/myowndex-2d-reproduzido
```

Pikachu Libre agora usa `PIKACHU_7`, incluindo ambas as vistas e paletas. O antigo import traseiro `PIKACHU_6` era Pop Star e foi retirado da seleção. Tokens históricos preservam a identidade do Pokémon guardado e passam a resolver a arte 2D atual. Os tokens Showdown/Smogon de modelos continuam legíveis para essa migração, mas seus renders não são candidatos de exibição.

## Cobertura e limites reais

O [auditor](../scripts/verificar-cobertura-animacoes.mjs) confronta todo o índice técnico fixado no catálogo `2ee1c422ad9f3831245dab0ac2a5cd1aae61cd72`. O [relatório verificável](../src/data/native-sprite-coverage.json) distingue espécies, escolhas da Dex e recursos técnicos.

| Conjunto | Combinações verificadas com animação 2D |
| --- | --- |
| 1.025 espécies nacionais, frente nas duas paletas | 2.050 de 2.050 |
| 1.112 escolhas expostas da Dex, frente nas duas paletas | 2.224 de 2.224 |
| 1.351 recursos técnicos, frente/trás nas duas paletas | 5.372 de 5.404 |
| 1.579 identificadores de formas, frente nas duas paletas | 3.134 de 3.158 |

**Há impedimentos reais; não se declara cobertura integral inexistente.** Permanecem 32 combinações técnicas sem animação 2D autenticada: sete modos de transporte de Koraidon/Miraidon × quatro vistas/paletas; traseira de Eternamax nas duas paletas; frente de Corviknight Gigantamax nas duas paletas. O material encontrado para a traseira de Eternamax tem uma única pose. A folha frontal de Corviknight Gigantamax está malformada, com bandas opacas e quadro final incompleto; não foi fatiada por adivinhação nem teve fundo redesenhado.

O relatório de formas repete 16 dessas lacunas e registra **oito combinações adicionais**: Antique de Sinistea e Polteageist, Artisan de Poltchageist e Masterpiece de Sinistcha, frente nas duas paletas. Um sprite da forma comum não foi rotulado como uma forma com selo. As entradas, identificadores e informações dessas aparências são preservados; nenhuma é apagada do catálogo para esconder a falta de arte. O relatório também registra as imagens 2D de recuperação ausentes, sem preencher a lacuna com PNGs de modelos 3D.

Os testes verificam a procedência de toda seleção, rejeição de modelos, migração de tokens, distinção de IDs de formas, paletas/gêneros/ângulos, hashes de todos os arquivos novos, duração real e recuperação sem animação. Enquadramento, escala física, teclado, movimento reduzido e telas responsivas são verificados pelos testes de apresentação e navegador descritos na [direção artística atual](DIRECAO-ARTISTICA-2.0.20.md).
