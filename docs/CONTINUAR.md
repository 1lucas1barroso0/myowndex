# Estado atual do MyOwnDex

**Versão atual: 2.0.18.** A interface apresenta a versão completa atual, derivada de `package.json`. A leva anterior encerrou em 11.6.6; essa numeração não exige migração nem rompe contas, Boxes ou aventuras. Campos de identidade de forma continuam opcionais e compatíveis com dados anteriores.

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

A iniciativa da Aventura e do Campo usa uma fila comum com sprites. Antes de rolar, cada Pokémon confirma um movimento ou Outra ação, sem gastar PP ou executar o movimento. A prioridade efetiva considera o movimento e as habilidades ativas, incluindo Prankster, Gale Wings e Triage. Dentro da mesma prioridade, permanece a ponderação proporcional de 2d6 pela Velocidade efetiva, com os modificadores existentes e desempate entre os realmente empatados.

Cada rodada oferece somente sua ação atual: escolher, rolar, avançar ou encerrar. A escolha confirmada acompanha a rodada; controles, ações e servidor impedem mudar a prioridade depois da iniciativa ou refazer a ordem no meio dela. Encerrar aplica os efeitos finais, libera novas escolhas e prepara a próxima rolagem. A intervenção do Treinador continua separada do turno do Pokémon. A vantagem do teste secundário depende da diferença dos dados mantidos, com sucesso na disputa quando exigido; os atributos não criam essa vantagem. A Aventura prioriza o campo e recolhe preparação/participantes; o Gerador abre compacto e expande após gerar os resultados.

A revisão 2.0.1 inclui XP-base 1–3, fatores ×2/×4, reduções da base e mínimo 1 no final; cada aquisição gera EVs equivalentes ao dobro do XP recebido. Reservas e recibos limitados persistem nas Boxes, cenas, conta e códigos, com fusão e idempotência. Amizade continua manual, com apresentação RPG até 25. Veja `docs/REGRAS-2.0.1.md`. Não reintroduzir declarações implícitas, rerrolagem ativa, campos de fase na prática ou versões incompletas divergentes da proteção. Não remover as exceções de contenção de layout em TurnOrder e local-pokemon-status-tool: corrigem campos de tamanho zero no Blink após atualizar a rodada.

As fases exibem ferramentas pertinentes, mantendo a ordem ativa intacta. Os sprites usam alturas oficiais locais; o HUD fica fora do campo. A aparência amarela do botão Dados existe somente com o diálogo aberto.

A revisão 2.0.2 dá uma ilustração local própria aos nove cenários, com recorte legível também no celular, e simplifica a linguagem das mesmas 40 regras. Mudar de fase não renova proteções, turnos ou intervenções. O Campo começa em Treino livre; depois da primeira iniciativa, as rodadas exigem nova declaração e rolagem. Nova batalha requer confirmação, sem rodada ativa, e preserva HP, PP e itens. Recuo, drenagem, autolesão e itens consumidos seguem a mesma mecânica no Campo e na Aventura. O registro de progresso conserva a origem dos itens transferidos, sem transformar trocas temporárias em equipamentos novos das Boxes. Veja `docs/CENARIOS-E-REGRAS-2.0.2.md`.

As 40 regras e as funções existentes são preservadas. A linguagem visual combina a clareza de Sword/Shield com o acabamento 2D de HGSS/BW/B2W2. A ação principal é imediatamente reconhecível; detalhes são consultáveis sem ocupar permanentemente a tela. Textos descrevem o que acontece no jogo, sem assumir que todo Pokémon é aliado. Nomes próprios permanecem no original, com explicações naturais em português e referências EN/PT quando disponíveis.

A revisão 2.0.3 usa materiais visuais comuns em todas as áreas: painéis acolhedores, cantos confortáveis, controles táteis e sprites valorizados. A seleção permanece explícita, os detalhes continuam recolhidos e as proporções oficiais dos Pokémon são preservadas. Os temas Claro e Escuro compartilham a mesma hierarquia. Movimentos de interface respeitam a preferência por movimento reduzido; não há animações novas contínuas. Veja `docs/ESTETICA-2.0.3.md`.

A revisão 2.0.4 registrou a recuperação técnica do Dex48 e o catálogo de formas. Sua política ampla de exposição foi posteriormente refinada. O catálogo técnico continua disponível para sprites, referências e compatibilidade, mas não obriga a Pokédex a expor cada forma como entrada própria.

A busca por geração usa a estreia da forma quando ela é conhecida, sem reescrever o número nacional da espécie. A revisão das 40 regras é editorial: efetividade de tipos usa linguagem própria, enquanto Vantagem continua reservada ao mecanismo de dados. As fontes versionadas incluem agora o catálogo de formas; a referência do Pokémon Showdown foi atualizada após mudanças históricas em Gen III/IV sem alterar os campos literais consumidos pelo MyOwnDex. Veja `docs/DEX48-2.0.4.md`.

A revisão 2.0.5 concluiu a atualização de descoberta da Pokédex: filtros por tipo, região e intervalo, busca de variantes, explicações simples nas 40 regras, Diário da aventura, Amizade ±5/±50 e ícones sem cantos transparentes. Veja `docs/POKEDEX-CLARA-2.0.5.md`.

A revisão 2.0.6 fixa a regra atual de variantes com **duas travas obrigatórias**. Uma forma só pode receber a nova segregação quando é **não intercambiável** e também funciona como um Pokémon distinto para o jogo e para a identidade narrativa, com diferenças mecânicas próprias relevantes. Se o mesmo indivíduo pode trocar entre as formas, elas permanecem agrupadas mesmo quando a troca altera mecânicas. Diferenças puramente estéticas também permanecem agrupadas, sejam permanentes ou não. Variantes regionais continuam separáveis. O Gerador usa a mesma fronteira. Nenhuma migração de Boxes, favoritos, contas, códigos ou aventuras é necessária. Veja `docs/VARIANTES-2.0.6.md`.

A revisão 2.0.7 fecha a camada de confiabilidade dos filtros da Pokédex. Busca, favoritos, ordem, geração, até dois tipos, regiões, variantes e intervalos são exercitados em uma matriz de combinações. A interface usa frases curtas e evita termos técnicos quando fala diretamente com o jogador. Estados antigos ou inválidos de geração, região e ordem voltam a valores seguros. O release também corrige versões de dependências que haviam sido alteradas por engano no `package-lock.json` e adiciona uma verificação para impedir nova divergência entre pacote, lockfile, aplicativo, cache offline e documentação. Veja `docs/FILTROS-E-CLAREZA-2.0.7.md`.

A revisão 2.0.8 torna o Gerador mais claro e auditável. O fluxo distingue três coisas: o encontro básico (quantidade e nível), a escolha de quem pode aparecer e a montagem da ficha. Escolher um Pokémon ou forma exatos limpa os filtros de sorteio para impedir combinações contraditórias; no modo aleatório, tipo, geração de estreia, variante regional e lendários/míticos podem ser combinados como filtros. Jogo de referência define repertório e, em Jogos, também respeita o período histórico. Natureza, Shiny e Hidden Ability não alteram a chance da entrada sorteada. A aleatoriedade continua em duas etapas obrigatórias: primeiro uma entrada da National Dex recebe o bilhete, depois uma forma elegível daquela entrada é sorteada, sem peso adicional para Pokémon com mais formas. A interface do Gerador não usa mais o termo “prévia”. Veja `docs/GERADOR-2.0.8.md`.

A revisão 2.0.10 remove da aplicação trilha sonora, efeitos sonoros e chamada, incluindo interface, estado de sala, eventos sonoros, APIs, sinalização, armazenamento, estilos, testes e variáveis de ambiente dedicadas. Áudio e comunicação de voz passam a ser externos ao MyOwnDex e ficam a encargo do Narrador e dos jogadores.

A revisão 2.0.11 endurece responsividade, fluidez e isolamento das rolagens. A Pokédex reduz colunas antes de comprimir cartões, controles horizontais continuam alcançáveis em telas estreitas e o shell mantém um único dono de rolagem com unidades dinâmicas de viewport, safe areas e conteúdo fora da tela renderizado sob demanda. O diálogo de Dados permanece utilizável em telas estreitas, baixas, landscape e com teclado virtual. A geração aleatória continua exclusivamente no núcleo CSPRNG/Web Crypto com rejection sampling; renderização, animação, cache, IndexedDB, armazenamento durável, sincronização e falhas de persistência não participam da escolha do resultado nem provocam rerrolagem.

A revisão 2.0.12 cobre explicitamente celulares cujo navegador ou modo PWA entrega um viewport de layout maior que a tela física. Em dispositivos de toque estreitos, a Pokédex força densidade móvel por envelope físico, o modal de Dados usa a largura útil em vez do teto de 40rem e a tipografia compensa o layout virtual largo. Rolagens locais são result-first: o recibo imutável é gerado e exibido antes de IndexedDB, histórico, conta, callbacks ou Diário; essas tarefas seguem em segundo plano e não impõem cooldown. Apenas rolagens remotas autoritativas aguardam o servidor, pois nesse caso o servidor é a fonte válida do resultado.

A revisão 2.0.13 é uma passagem de direção de arte sobre o conteúdo já aprovado. A linguagem visual deixa de tratar as telas como formulários tematizados e passa a usar materiais e hierarquia próprios de jogo: cabeçalho como moldura de handheld, Aventura como seleção de papéis, Dados como instrumento de mesa, Conta como Cartão de Treinador e Pokédex como coleção. O acabamento usa profundidade curta, bordas táteis, estados selecionados fortes, motivos discretos de interface de jogo e valorização de sprites, sem introduzir texto, regra, dependência ou animação contínua. A camada final está em `src/game-art-direction.css` e deve continuar compatível com Claro/Escuro, movimento reduzido, alto contraste, teclado e telas estreitas.

A revisão 2.0.14 substitui o acabamento plástico da 2.0.13 por uma linguagem de diário de aventura: superfícies foscas, cores felizes, profundidade curta e controles táteis sem brilho artificial. Pokémon decorativos nunca recebem disco/círculo de fundo e os módulos principais mantêm pelo menos um GIF parceiro, com PNG estático sob redução de movimento. O Cartão de Treinador deixa de repetir “Seu MyOwnDex”. O ícone v100 representa um diário/Pokédex aberto com lente de consulta e rota de aventura e é a identidade usada no cabeçalho, abertura, favicon e manifesto.

A mesma revisão corrige o histórico de Dados local: `LOCAL_ROLL_LIMIT` passa a ser importado explicitamente, a rolagem entra no estado da sessão antes de qualquer persistência, recebe uma cópia rápida no armazenamento do navegador e uma cópia durável assíncrona. Falha de cache, IndexedDB, conta ou callback não remove nem rerrola o resultado e não bloqueia uma nova rolagem. Somente rolagens remotas autoritativas podem aguardar o servidor. A versão mostrada no rodapé é lida diretamente de `package.json`; não manter um rótulo de versão paralelo.

A revisão 2.0.15 trouxe a RotomDex própria nas cores do MyOwnDex, cabeçalhos mais vivos e palcos transparentes. A revisão 2.0.17 preservou esse desenho e corrigiu os formatos de ícones. A 2.0.18 substitui a marca v101 por uma nova RotomDex v103, conforme a decisão mais recente do usuário.

Parceiros decorativos usam animações GIF transparentes e naturais, com PNG estático quando a pessoa prefere menos movimento ou a imagem falha. Cada espécie decorativa tem um único lar. Os sprites de jogo podem usar animações verificadas da identidade exata, preservando Shiny e variantes. A escala oficial é comprimida para distinguir tamanhos sem esconder espécies pequenas. Não reintroduzir discos, halos, régua, haste, fundo cinza ou balanço artificial.

Dados mantém Web Crypto como fonte aleatória de produção e rejection sampling para intervalos uniformes. A suíte 2.0.15 amplia a auditoria para todos os dados oferecidos, centenas de milhares de draws seguros adicionais, dezenas de milhares de recibos locais mistos e uma matriz ampliada de viewports. Rolagens locais não usam cooldown por clique; cada ativação válida gera seu recibo antes de cache ou persistência e entra no histórico da sessão imediatamente.

A revisão 2.0.17 acrescenta uma barreira de qualidade permanente. O CI passa a rodar a matriz real de browser com Chromium após testes, lint, tipos e build. A matriz inclui celulares estreitos, retrato alto, landscape curto, tablets e desktops; verifica overflow, modais, sprites decorativos, cards visíveis da Pokédex e rajadas de rolagens até o limite do histórico. Os arquivos dos parceiros são verificados para garantir transparência, animação real e recuperação estática. O RNG mantém Web Crypto + rejection sampling e ganha uma auditoria adicional de transições consecutivas para flagrar qualquer acoplamento de estado ou preferência artificial.

A revisão 2.0.17 consolida a direção fosca, vibrante e acolhedora com animações naturais de identidade exata, recuperação estática e escala oficial comprimida. A RotomDex aprovada acompanha ícones raster compatíveis com instalações e prévias de links. A explicação do sorteio fica disponível sob demanda, e os tipos de dados mantêm botões separados e legíveis também no celular. Linhas evolutivas respeitam variantes e formas de gênero fixo permanecem coerentes no Gerador, no PC e no compartilhamento. Filtros são aplicados antes do agrupamento nacional, permanecem ao alternar a visualização e usam apenas regiões canônicas. A edição permite somente formas reversíveis do mesmo indivíduo. Veja `docs/DIRECAO-ARTISTICA-2.0.17.md`.

A revisão 2.0.18 renova a marca com um único master RotomDex v103 e derivados para cada plataforma. Cabeçalho, carregamento, favicon, instalação e compartilhamento usam a mesma identidade; arquivos antigos não são referências ativas. O carregamento contém somente a marca e três pontos de progresso, com nome acessível e sem texto ou versão repetidos. Dentro de uma área, ocupa uma caixa compacta, sem acrescentar outra altura de tela. A cobertura de animações reais é ampliada para Pokémon ausentes da fonte anterior, respeitando identidade, formas, Shiny e movimento reduzido. Veja `docs/DIRECAO-ARTISTICA-2.0.18.md`.

## Documentos históricos

Arquivos com versão ou intervalo de PR no próprio nome, como `REFINO-11.5.md`, `FINAL-11.6.md` e `PR-20-28.md`, registram decisões e auditorias daquele momento. Eles não substituem este arquivo, o README, `package.json` ou o código atual.

## Publicação

O estado só é considerado publicado depois que o CI do commit final passa e o deployment de produção correspondente fica pronto no domínio principal. Um build local ou Preview aprovado, isoladamente, não prova que produção está atualizada.
