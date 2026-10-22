# Otimização de recursos e pesquisa — 2.0.52

Esta revisão continua a partir da 2.0.51 e mantém as funções, as regras, as 40 regras do Guia, os dados do jogador e os limites de armazenamento.

## Melhorias aplicadas

- **CPU e memória:** uma leitura já atendida pela memória muda somente a ordem de uso. O tamanho do snapshot é reaproveitado, sem serializar novamente o repertório de golpes ou outros detalhes de catálogo. Uma entrada substituída é medida novamente. Cada resposta nova é serializada uma única vez; o mesmo texto fornece o peso em UTF-8 e o conteúdo persistido.
- **Disco:** leituras consecutivas da mesma URL compartilham a manutenção que ainda está pendente. Uma operação de outra URL interrompe o agrupamento, preservando a ordem de uso. As verificações de contagem, bytes e espaço reservado continuam ativas. A geração da limpeza impede que tarefas antigas recriem o cache apagado.
- **Consultas locais:** a primeira busca numérica cria um índice para aquele catálogo. As seguintes deixam de percorrer todas as entradas. O índice é associado por referência fraca e pode ser liberado junto do catálogo removido; limites e textos históricos continuam iguais.
- **Guia e resposta dos controles:** o índice de pesquisa normaliza o conteúdo estático uma vez. As buscas mantêm acentos equivalentes, títulos, seções, palavras e as proporções originais/exibidas. Os cartões de regras não são reconstruídos ao editar a calculadora. Abrir regras, alternar pelo teclado e saltar para a proteção contra hit kill continuam disponíveis.

## Medição diagnóstica

Comparação do mesmo ensaio Node no mesmo ambiente, antes e depois. São custos isolados; os tempos não equivalem a uma promessa de desempenho em qualquer hardware ou conexão.

| Operação | Antes | Depois |
| --- | --- | --- |
| 1.000 leituras em memória de um payload de 100 KB | 178 ms; 1.000 serializações | 2 ms; zero serializações |
| 100 leituras consecutivas em cache com 32 entradas | 73 ms; 100 gravações; 3.301 leituras de cache | 5 ms; 4 gravações; 133 leituras |
| 4.000 consultas numéricas de movimento | 449 ms | 2 ms |
| 2.000 buscas nas regras do Guia | 676 ms | 53 ms |

O número de agrupamentos varia com o tempo de conclusão do armazenamento. O teste determinístico retém uma manutenção no disco e comprova que cem consultas adjacentes produzem uma única manutenção, além de verificar que A → B → A preserva A como a entrada mais recente.

## Verificação

Os testes adicionais cobrem serialização única e peso UTF-8 exato, resposta entregue ao chamador, entrada substituída/maior que o orçamento, agrupamento de leituras, ordem de uso entre URLs, resultados numéricos e históricos, descarte e recarregamento de catálogos, equivalência da pesquisa para todas as regras e ausência de alterações nos dados de origem.

`browser-guide-performance.mjs` integra o CI com CPU reduzida em quatro vezes, nos dois temas e em 320, 390, 768, 1280 e 1440 px. Verifica busca, acentos, proporções, estado sem resultados, restauração das 40 regras, calculadora, seções abertas, proteção contra hit kill, teclado e estabilidade da moldura. Os fluxos de gerador, movimentos, cache offline e navegação também são exercitados antes da publicação. Capturas do Guia são inspecionadas visualmente.

## Base de execução

A auditoria atualizada do npm passou a identificar três avisos na faixa do Next.js 16.3.8, com severidade agregada crítica. Next.js e eslint-config-next foram atualizados juntos para **16.4.2**, mantendo os overrides existentes de sharp e PostCSS e o build com webpack. As fontes oficiais indicam 16.4.1 como versão corrigida para os avisos de otimização de imagens, Server Actions e funções `use cache`; a revisão 16.4.2 também incorpora correções posteriores de estabilidade. O alerta na cadeia de ferramentas de desenvolvimento é revisado separadamente da auditoria de produção.

Fontes: [otimização de imagens](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [Server Actions](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), [`use cache`](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [release 16.4.2](https://github.com/vercel/next.js/releases/tag/v16.4.2).

Resultados locais finais: 646 testes aprovados, lint, tipos, build com Next.js 16.4.2 e auditoria de produção com zero vulnerabilidades conhecidas. A auditoria completa continua apontando a cadeia de desenvolvimento de `braces` já descrita em `VALIDACAO.md`.

No navegador: 11 grupos de verificações do Guia; três do cache nativo, incluindo recarregamento sem rede do catálogo; movimentos mobile; 16 grupos do gerador com CPU 6× mais lenta; navegação de todas as áreas com coleção completa e CPU 4× mais lenta; atualização automática/PWA. Todos passaram sem erros JavaScript. Os dois novos roteiros integram o CI. A inspeção visual confirmou a apresentação preservada do Guia nos dois temas.

A preparação do navegador no CI usa o endereço HTTPS oficial `archive.ubuntu.com` quando a imagem do runner configura o espelho HTTP da Azure. Os logs da execução anterior registraram mais de oito minutos no download de 21,1 MB de fontes por esse espelho. Os pacotes assinados e a instalação completa das dependências do navegador permanecem os mesmos; nenhum teste foi omitido.
