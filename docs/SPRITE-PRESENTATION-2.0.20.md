# Sprites: corpo, enquadramento e atividade

A altura da Pokédex é uma medida física em decímetros. `getPokemonDisplayHeight` consulta primeiro a identidade realmente mostrada, incluindo formas, Transform e Illusion; o número original guardado no token não diminui uma forma maior. A tabela local de alturas conserva a procedência PokéAPI e não provoca consultas à API durante a apresentação.

Um campo compartilhado usa uma única referência: `altura / altura de referência`, sem teto mínimo, limite máximo ou curva que comprima as diferenças. Um retrato enquadra um Pokémon por vez. O campo oferece retratos selecionáveis para conhecer cada corpo, inclusive quando a diferença física entre dois Pokémon é enorme. Ampliar esse retrato não altera a medida do corpo no campo.

`src/data/sprite-framing.json` registra a união dos pixels opacos de **todos os quadros** de cada animação e os limites reais dos PNGs de recuperação. O recorte elimina somente margens transparentes; o fator uniforme preserva anatomia, proporções e todo o movimento publicado. O arquivo original permanece intacto. Uma fonte personalizada sem metadados usa a imagem completa com `object-fit: contain`, sem inventar proporções. Navegadores sem unidades de contêiner conservam a imagem completa e a mesma identidade.

O script `scripts/update-sprite-framing.py` reproduz a medição com Pillow. As fontes BW usam o commit do catálogo de sprites; cada original remoto é obtido com verificação TLS, reutilizado pelo hash da URL e analisado localmente. O índice exclui renderizações Showdown, Home e Smogon `src/models`. As fontes nativas têm também hashes, autores, tempos e sequências nas proveniências já publicadas em `/sprites/native/`. A medição de enquadramento não cria quadros nem substitui a atribuição original.

```sh
python3 scripts/update-sprite-framing.py \
  --cache /caminho/para/cache \
  --include-static \
  --fetch
```

Sem `--fetch`, a reprodução usa somente o cache e os arquivos locais. Recuperações PNG inexistentes são omitidas do índice; não se publicam limites inventados para esconder uma ausência. Depois de importar novas fontes nativas, a mesma execução mede os arquivos novos sem baixar novamente os originais já preservados.

A atualização final mede 16.123 imagens, incluindo os 3.375 caminhos nativos usados pelo catálogo. O índice ocupa 1.173.867 bytes em JSON e 168.605 bytes em gzip. Esses metadados são compartilhados; não existe análise de pixels, consulta de catálogo ou medição por Pokémon durante a navegação. O teste de cobertura exige enquadramento tanto para cada animação nativa quanto para sua recuperação estática.

Uma coleção inteira compartilha um observador de interseção, uma assinatura de movimento reduzido, um evento de visibilidade e um observador dos modais. Animações visíveis usam seus quadros autênticos. Fora da tela, atrás de um modal ou em uma aba oculta, o recurso animado é retirado, mantendo o espaço reservado. A volta restaura a mesma aparência. Movimento reduzido escolhe a recuperação estática exata. Eventos que não alteram o estado de um Pokémon não provocam uma nova atualização dele.

Os testes verificam a relação física de 145:1 entre Wailord e Flabébé, formas com alturas próprias, limites de recorte válidos, cobertura completa dos arquivos nativos, mil assinantes usando um só observador, atualização apenas dos elementos afetados, modais, aba oculta e movimento reduzido. A revisão de navegador verifica pixels em movimento, enquadramento, seleção de corpos pequenos, acessibilidade e desempenho com CPU desacelerada.
