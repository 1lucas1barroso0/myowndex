# Gerador mobile — revisão 2.0.51

## Problema reproduzido

Com viewport de 390 × 844, toque habilitado e CPU do Chromium reduzida em seis vezes, foi gerado um encontro de seis Bulbasaur. Ao tocar em Limpar encontro, a confirmação era criada com `z-index: 400`, atrás do gerador (`1050`). A regra compartilhada de diálogos tinha especificidade maior do que a correção local anterior. A tela do gerador ficava inerte, mas continuava pintada sobre a confirmação: visualmente, parecia travada. A captura de tela confirmou a falha; verificar apenas a existência do diálogo ou disparar um clique automatizado não a detectava.

## Correções

- A confirmação do gerador prevalece sobre a regra compartilhada e aparece na camada 1200. Limpar, remover um parceiro e substituir um encontro usam o mesmo comportamento corrigido.
- O seletor nacional mantém suas opções e renderização entre alterações de apelido, seleção, progresso e abertura de confirmação. Todas as espécies e formas permanecem disponíveis no seletor nativo.
- Os cartões são independentes e memoizados, com callbacks estáveis: editar ou selecionar um parceiro não reconstrói os demais.
- A compactação e a comparação do rascunho ocorrem depois da pausa de digitação, em vez de compactar tanto imediatamente quanto no salvamento. O rascunho inicial não é normalizado duas vezes.
- Consultas independentes dos golpes são feitas em paralelo, respeitando o limite global de três pedidos, cancelamento, ordem dos golpes e PP correspondentes.
- A limpeza mantém o encontro até a confirmação da gravação. Armazenamento lento mostra `Limpando encontro…` e impede toques repetidos; falha conserva os parceiros e apresenta erro. O retorno do foco usa o contêiner interno e não move a moldura do app.

Não foram retirados recursos, Pokémon, opções, regras, Boxes ou arquivos. O formato persistido continua compatível.

## Validação

`tests/browser-generator-mobile.mjs` passa a integrar o CI e verifica 16 grupos de casos com CPU reduzida em seis vezes:

- geração de seis parceiros, cancelamento com rede pendente, edição, seleção e reabertura;
- confirmação visível acima do gerador, recebendo toque e cabendo no viewport, em Claro/Escuro e larguras 320, 390, 768, 1280 e 1440;
- cancelamento da limpeza e da substituição sem perda do encontro;
- falha simultânea de localStorage e IndexedDB conservando os seis parceiros;
- gravação lenta com confirmação ocupada e limpeza durável após recarregar;
- nova geração, remoção individual e limpeza repetida, sem erros JavaScript ou rolagem da moldura.

A inspeção visual das capturas mobile confirma a posição e a leitura do diálogo nos dois temas. Uma repetição diagnóstica do mesmo roteiro com dados reais reduziu a digitação de 19 caracteres de 1376 ms para 934 ms, incluindo o intervalo artificial de 20 ms por tecla; limpar levou 226 ms após o clique automatizado. São observações deste ambiente, não uma garantia de tempo em todo hardware ou rede. O defeito da confirmação invisível foi reproduzido e corrigido objetivamente.

O teste unitário adicional verifica consultas de golpes concorrentes, limite de três e associação correta de PP mesmo com respostas fora de ordem. A suíte completa, lint, tipos, compilação, dependências de produção e roteiros de navegador são verificados sobre a fonte final antes da publicação. A aplicação instalada recebe a versão 2.0.51 pelo mecanismo de atualização existente.

Resultados locais da fonte preparada: `npm ci`, 641 testes unitários/integração, lint, tipos e build aprovados; auditoria de produção com zero vulnerabilidades. Gerador com dados reais: 26 verificações; gerador mobile: 16; exclusões pessoais: 7; desempenho geral e atualização PWA aprovados. O roteiro antigo de exclusões foi atualizado para os nomes atuais dos controles e do HP e também passa a integrar o CI. A checagem local de fontes externas encontrou HTTP 403 na API pública do GitHub; o CI autenticado deve concluir essa checagem antes de integrar. O alerta de desenvolvimento na cadeia do lint continua o já documentado em `VALIDACAO.md`, sem dependência afetada no aplicativo de produção.
