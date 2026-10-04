# Estado atual do MyOwnDex

**Versão atual: 2.0.0.** A interface apresenta **2.0**. A leva anterior encerrou em 11.6.6; essa nova numeração não modifica o formato dos dados, contas, Boxes ou aventuras.

Este arquivo descreve como retomar trabalho sem carregar estado antigo como se ainda fosse atual. A fonte de verdade é, nesta ordem:

1. `main` no repositório;
2. a versão de `package.json`;
3. a suíte de testes e o CI do commit que será publicado;
4. o Preview correspondente ao mesmo commit;
5. a produção depois do merge.

SHAs, números de PR, contagens de testes e estados de deploy de rodadas anteriores são evidência histórica, não estado atual.

## Regras de continuidade

- Nunca substituir a `main` atual por um checkpoint antigo.
- Nunca reutilizar como instrução vigente um documento de release anterior.
- Antes de publicar, executar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`.
- Preview e produção devem corresponder ao commit realmente validado.
- Dados do usuário, Boxes, contas e aventuras não são descartados para simplificar uma atualização.
- Dados históricos podem permanecer preservados, mas devem ser identificados como históricos.
- Rótulos, textos e documentação operacional devem acompanhar a interface atual.
- A versão do shell offline deve acompanhar exatamente `package.json`.
- O instalador Linux documentado deve acompanhar a linha de versão atual.

## Estado funcional vigente

O MyOwnDex reúne Pokédex, PC do Bill, Guia do Treinador, Gerador, Dados, contas e Central da Aventura. Dados tem um único acesso global: fora de uma aventura, oferece Rolagens e Campo livre; dentro dela, usa o contexto da aventura e seu Diário, sem duplicar campo ou histórico. Recibos compartilhados são exibidos a partir da resposta confirmada pelo servidor, sem sortear novamente. Dados usa o mesmo núcleo de regras da aventura quando há contexto Pokémon e não altera Boxes sem ação explícita. Cálculos internos que não precisam ser manipulados pelo jogador permanecem automatizados.

A interface deve continuar responsiva, utilizável por teclado, legível em telas estreitas e reconhecível como jogo. Placeholders não são usados como instrução ou decoração.

A interface usa rótulos legíveis, contraste coerente entre os temas, controles com alvo confortável e foco contextual. Abrir fichas, gerar Pokémon e corrigir erros deve levar o teclado ao conteúdo correspondente; fechar diálogos ou cancelar ações devolve o foco. Confirmações bloqueiam a interação com o fundo, inclusive dentro de Dados. Campos de consulta permitem tentar novamente após falha de rede. Siglas e instruções adicionais ficam em ajuda recolhida, sem aumentar o ruído permanente.

No Campo dos Dados, Box e Pokémon são escolhas separadas. O contador acompanha os Pokémon em campo; a iniciativa mostra a rodada e uma fila com sprites, turno atual e avanço explícito. Escolher um parceiro ou usuário mantém a seleção visual consistente. Movimentos mostram o resultado essencial e guardam a auditoria completa em detalhes recolhidos, sem repetir recibos abaixo do campo. O histórico continua permitindo consultar e apagar cada jogada.

Alterações salvas em outra aba são reconhecidas pela revisão verificada do armazenamento, inclusive no intervalo anterior ao commit do IndexedDB. Uma cópia antiga em memória não pode encobrir essa revisão. A leitura continua protegendo dados quando o dispositivo não permite atualizar uma das cópias.

A iniciativa da Aventura e do Campo usa uma fila comum com sprites. Cada rodada oferece somente sua ação atual: rolar, avançar ou encerrar; encerrar aplica os efeitos e prepara uma nova rolagem. Não há botão de refazer no meio da rodada. As regras e o estado persistido permanecem nos motores existentes. A Aventura prioriza o campo e recolhe preparação/participantes; o Gerador abre compacto e expande após gerar os resultados.

As 40 regras e as funções existentes são preservadas. A linguagem visual combina a clareza de Sword/Shield com o acabamento 2D de HGSS/BW/B2W2. A ação principal é imediatamente reconhecível; detalhes são consultáveis sem ocupar permanentemente a tela. Textos descrevem o que acontece no jogo, sem assumir que todo Pokémon é aliado. Nomes próprios permanecem no original, com explicações naturais em português e referências EN/PT quando disponíveis.

## Documentos históricos

Arquivos com versão ou intervalo de PR no próprio nome, como `REFINO-11.5.md`, `FINAL-11.6.md` e `PR-20-28.md`, registram decisões e auditorias daquele momento. Eles não substituem este arquivo, o README, `package.json` ou o código atual.

## Publicação

O estado só é considerado publicado depois que o CI do commit final passa e o deployment de produção correspondente fica pronto no domínio principal. Um build local ou Preview aprovado, isoladamente, não prova que produção está atualizada.
