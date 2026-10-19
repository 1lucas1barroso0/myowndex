# Estado atual do MyOwnDex

**Versão atual: 2.0.32.** A atualização do aplicativo é automática quando existe conexão, com cache estático por hash, revalidação de recursos mutáveis e salvamento antes do recarregamento. A ausência de rede não permite baixar uma versão ainda não recebida. A interface apresenta a versão completa atual, derivada de `package.json`. A leva anterior encerrou em 11.6.6; essa numeração não exige migração nem rompe contas, Boxes ou aventuras. Campos de identidade de forma continuam opcionais e compatíveis com dados anteriores.

A revisão 2.0.27 implementa as 49 variantes oficiais registradas da nova leva de Megaevoluções de Legends: Z-A e Mega Dimension, com itens e identidade exatos, atributos e sprites 2D próprios; introduz Tera Shift, Terastal e Stellar do Terapagos e os climas Primordial Sea, Desolate Land e Delta Stream; reforça o modo instalado imersivo de PWA com preferência por fullscreen e fallback para standalone sem mudar a identidade instalada. Registro técnico detalhado em docs/REVISAO-2.0.27.md. A aparência de app sem barras é garantida apenas nos modos instalados que os navegadores oferecem; o sistema pode manter barras de status e controles próprios.

A revisão 2.0.26 faz uma auditoria de condições oficiais além de Eternamax: Mega Rayquaza só precisa conhecer Dragon Ascent (mas não pode segurar Z-Crystal); Kyogre e Groudon têm Reversão Primitiva com as suas Orbs correspondentes, sem bloquear a Mega de outros parceiros nem limitar revirações sucessivas; Necrozma Dusk Mane e Dawn Wings têm Ultra Burst com Ultranecrozium Z e a liberação do Z-Move de Photon Geyser apenas após uma rodada. Os quatro perfis de forma (tipos, habilidades, atributos e altura) são confirmados e disponíveis sem depender de rede. Ativação de Primal Reversion é guiada pelo Narrador no RPG, em vez de simular uma ativação automática não implementada. O relatório em docs/FORMAS-OFICIAIS-2.0.26.md explica a cobertura, as restrições e as formas novas que ainda exigem fontes verificadas.

A revisão 2.0.25 também vincula halo, brilho e símbolos de transformação ao sprite redimensionável, e acrescenta Eternamax como forma especial de chefe somente para Eternatus, com a arte 2D própria já catalogada, altura oficial de 100 m e atributos próprios. A ativação e o encerramento são controlados pelo Narrador; Eternamax não é Dynamax/Gigantamax comum e não expira automaticamente após três rodadas. Os dados oficiais necessários ficam disponíveis localmente, inclusive sem a API externa.

A revisão 2.0.25 recupera sprites do mesmo Pokémon quando a Box não tem imagem ou usa um caminho que deixou de funcionar; a cena mantém os tamanhos oficiais em seus dados, mas garante no mínimo 32 px de altura visual para ninguém desaparecer, preservando proporções originais e diferenças entre espécies. A validação de navegador cobre Flabébé com sprite ausente e Wailord com imagem antiga quebrada.

A revisão 2.0.24 registra a auditoria da herança da 2.0.22 (113 pacotes originais intactos), preserva a origem da 2.0.23 e automatiza G-Max Befuddle, Stun Shock, Smite, Gold Rush (confusão) e Snooze com testes. Os demais efeitos especiais guiados pelo Narrador continuam explicitamente identificados e não são descritos como automáticos. Veja docs/AUDITORIA-2.0.22-2.0.24.md.

Na revisão 2.0.23, testes de regressão, transformações especiais, seleção das Boxes, atualização automática e correções na arte da Silicobra foram recuperados dos 21 objetos originais interrompidos. O catálogo de sprites passa a 2.617 imagens em 114 pacotes; os 113 pacotes anteriores são preservados e o pacote adicional, verificável por hash, contém apenas os oito sprites corrigidos. Consulte `docs/RECUPERACAO-2.0.23.md`.

Na 2.0.21, o mapa da aventura respeita a composição integral 3:2 (sem `object-fit: cover`), com enquadramento responsivo; o PC deixa Porygon livre da antiga barra de três traços. A atualização é somente visual e preserva os arquivos dos cenários, Pokémon, dados e regras.

A direção vigente é exclusivamente 2D, com cores vivas e arte oficial ou comunitária de autoria/procedência registrada. A marca usa a obra humana de Carol Liao/toicon; os cenários usam mapas compostos de tiles humanos licenciados. GIFs de modelos 3D e arte gerada não são alternativas de recuperação. Retratos enquadram o corpo, e a escala física compartilhada do campo é linear; o uso anterior de escala comprimida foi substituído. Sprites fora da tela, cobertos por um diálogo ou em aba oculta suspendem a animação sem alterar o jogo. Consulte `DIRECAO-ARTISTICA-2.0.20.md` e seus registros de procedência. As revisões descritas abaixo são histórico de decisões, e suas políticas visuais são substituídas quando divergirem desta direção.


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

A revisão 2.0.15 trouxe a RotomDex própria nas cores do MyOwnDex, cabeçalhos mais vivos e palcos transparentes. A revisão 2.0.17 preservou esse desenho e corrigiu os formatos de ícones. A 2.0.18 substitui a marca v101 por uma nova RotomDex v103, conforme a decisão daquela revisão.

Parceiros decorativos usam animações GIF transparentes e naturais, com PNG estático quando a pessoa prefere menos movimento ou a imagem falha. Cada espécie decorativa tem um único lar. Os sprites de jogo podem usar animações verificadas da identidade exata, preservando Shiny e variantes. A escala oficial é comprimida para distinguir tamanhos sem esconder espécies pequenas. Não reintroduzir discos, halos, régua, haste, fundo cinza ou balanço artificial.

Dados mantém Web Crypto como fonte aleatória de produção e rejection sampling para intervalos uniformes. A suíte 2.0.15 amplia a auditoria para todos os dados oferecidos, centenas de milhares de draws seguros adicionais, dezenas de milhares de recibos locais mistos e uma matriz ampliada de viewports. Rolagens locais não usam cooldown por clique; cada ativação válida gera seu recibo antes de cache ou persistência e entra no histórico da sessão imediatamente.

A revisão 2.0.17 acrescenta uma barreira de qualidade permanente. O CI passa a rodar a matriz real de browser com Chromium após testes, lint, tipos e build. A matriz inclui celulares estreitos, retrato alto, landscape curto, tablets e desktops; verifica overflow, modais, sprites decorativos, cards visíveis da Pokédex e rajadas de rolagens até o limite do histórico. Os arquivos dos parceiros são verificados para garantir transparência, animação real e recuperação estática. O RNG mantém Web Crypto + rejection sampling e ganha uma auditoria adicional de transições consecutivas para flagrar qualquer acoplamento de estado ou preferência artificial.

A revisão 2.0.17 consolida a direção fosca, vibrante e acolhedora com animações naturais de identidade exata, recuperação estática e escala oficial comprimida. A RotomDex aprovada acompanha ícones raster compatíveis com instalações e prévias de links. A explicação do sorteio fica disponível sob demanda, e os tipos de dados mantêm botões separados e legíveis também no celular. Linhas evolutivas respeitam variantes e formas de gênero fixo permanecem coerentes no Gerador, no PC e no compartilhamento. Filtros são aplicados antes do agrupamento nacional, permanecem ao alternar a visualização e usam apenas regiões canônicas. A edição permite somente formas reversíveis do mesmo indivíduo. Veja `docs/DIRECAO-ARTISTICA-2.0.17.md`.

A revisão 2.0.18 renova a marca com um único master RotomDex v103 e derivados para cada plataforma. Cabeçalho, carregamento, favicon, instalação e compartilhamento usam a mesma identidade; arquivos antigos não são referências ativas. O carregamento contém somente a marca e três pontos de progresso, com nome acessível e sem texto ou versão repetidos. Dentro de uma área, ocupa uma caixa compacta, sem acrescentar outra altura de tela. A cobertura de animações reais é ampliada para Pokémon ausentes da fonte anterior, respeitando identidade, formas, Shiny e movimento reduzido. Veja `docs/DIRECAO-ARTISTICA-2.0.18.md`.

A revisão 2.0.19 substitui a mascote v103 por uma Pokédex vermelha sem rosto, com desenho e pintura próprios. A marca v104 aparece no cabeçalho, carregamento, favicon, instalação e compartilhamento; artes antigas são históricas. Os filtros introduzem as regiões com “Conhecer variantes de”, sem mudar como funcionam. O detalhe do PC é curto e decorativo, preservando espaço e a animação nativa de Porygon. O carregamento compacto, a cobertura de animações e as 40 regras permanecem. Veja `docs/DIRECAO-ARTISTICA-2.0.19.md`.

## Documentos históricos

Arquivos com versão ou intervalo de PR no próprio nome, como `REFINO-11.5.md`, `FINAL-11.6.md` e `PR-20-28.md`, registram decisões e auditorias daquele momento. Eles não substituem este arquivo, o README, `package.json` ou o código atual.

## Publicação

O estado só é considerado publicado depois que o CI do commit final passa e o deployment de produção correspondente fica pronto no domínio principal. Um build local ou Preview aprovado, isoladamente, não prova que produção está atualizada.

## 2.0.28 — Instalação e manipulação do campo

- O manifesto da aplicação instalada prefere o modo de tela cheia quando o navegador e o sistema o suportam, mantendo standalone onde fullscreen não é suportado. Janelas normais continuam abrindo como site.
- Launch handler incentiva a reutilização da janela instalada, quando suportado. Ícones, escopo, atalhos, viewport e service worker permanecem ativos. iOS/iPadOS, Firefox e certos sistemas podem manter suas próprias barras e gestos do sistema; nenhuma aplicação web consegue ocultar universalmente controles impostos pelo navegador/SO.
- O arraste de todas as espécies, inclusive Eternamax, utiliza como alvo também a imagem redimensionada. A captura de ponteiro mantém o movimento quando o cursor deixa a figura, sem desviar gestos de redimensionamento ou movimentos de teclado; arrastar uma imagem não inicia o download ou drag nativo do browser.
- O cache offline preserva dados e sprites disponíveis, mas a primeira execução, acesso à rede e alguns navegadores exigem instalação online; não prometer recursos nativos sem API.

## 2.0.30: instalação, ícone vigente e continuidade

- A marca oficial permanece a Pokédex humana v105 (Carol Liao/toicon, CC BY 4.0), com imagens idênticas em bytes. Aliases `myowndex-dex-v105-r2-*.png` mudam apenas as URLs para impedir que sugestões novas reutilizem referências visuais antigas de cache. Nunca trocar por v91, v101, v103 ou v104.
- O manifesto conserva `id: "/"`, escopo `"/"` e `start_url: "/?abrir=aventura"` em `/manifest.webmanifest`. Não versionar o caminho do manifesto ou mudar o ID do PWA: isso pode desassociar atualizações e duplicar instalações.
- O estado visual de aplicativo instalado no componente opcional de instalação só depende do modo da janela (standalone/fullscreen/iOS), não do evento `appinstalled`, estado salvo ou cache. Se o componente for exibido, uma aba comum mantém acesso às orientações. Não reintroduzir controles de instalação por padrão na interface e não tentar forçar `beforeinstallprompt` quando o navegador o omite.
- Se o navegador ainda mostrar o app como instalado após a remoção, verificar registros do Android/navegador e reinstalar por meios nativos. O site não pode desinstalar WebAPKs nem limpar o registro do Chrome; nunca apagar Boxes ou dados locais automaticamente para contornar o problema.
- Regredir ícones, splash, atalhos, modo standalone, diálogos e troca de release nos testes, incluindo o ciclo simulado `appinstalled` em aba comum. A proteção do acervo de sprites e das salas permanece inalterada.

## 2.0.30: recuperação opcional de registro PWA preso no Android

- `/reinstalar` oferece um fluxo opcional de segunda instalação com manifesto `/manifest-resgate.webmanifest` e identidade **fixa** `/myowndex-resgate`. O aplicativo normal mantém `id: "/"`, mesmo manifesto e mesmos dados.
- A página explica o risco de dois ícones, pede consentimento explícito e só tenta o prompt disponibilizado pelo navegador. Se o prompt não aparecer, oferece as instruções do sistema; não mente sobre o estado de instalação.
- Quando o atalho alternativo abre em modo standalone/fullscreen, a rota carrega o MyOwnDex integralmente, preservando a navegação em `/reinstalar` e compartilhando armazenamento, conta e service worker pela origem. As opções de atalhos do manifesto alternativo permanecem dentro dessa rota.
- Precache somente os dois manifestos e o ponto de entrada alternativo necessários; não registrar um segundo service worker e não apagar caches, contas, Boxes ou aventuras.
- O service worker distingue a raiz `/` de outros caminhos ao salvar a versão offline: abrir o guia não substitui o HTML offline da Pokédex.
- Verificar por testes reais: os dois manifests com identidades diferentes mas mesmas imagens, entrada da instalação alternativa, ausência de reset de dados e cache de navegação isolado. A reinstalação física de WebAPK precisa ser confirmada no dispositivo, não pode ser prometida só com testes em Chromium.

## 2.0.31: nome do ícone de recuperação

- O PWA alternativo instalado a partir de `/reinstalar` usa `name: "MyOwnDex"` e `short_name: "MyOwnDex"`, idênticos ao aplicativo principal. O termo “Resgate” fica apenas no ID técnico interno estável `/myowndex-resgate`, invisível como nome do aplicativo.
- O `id` alternativo, `scope`, `start_url`, arquivos dos ícones v105 e armazenamento compartilhado permanecem inalterados. Não deve surgir um terceiro aplicativo por mudança de ID.
- O botão da página alternativa passa a dizer “Instalar MyOwnDex”. Verificação unitária e navegador confirmam os dois campos exibíveis dos manifestos, a identidade alternativa e a preservação dos dados.
- Um atalho já instalado pode manter seu nome antigo até o sistema processar o novo manifesto ou até reinstalação; a web não consegue renomear diretamente um WebAPK ainda armazenado pelo Android.


## 2.0.32: linha evolutiva navegável

Os membros da linha evolutiva são botões: toque, mouse, Enter e Espaço trocam a amostragem na mesma ficha, preservando a busca e a posição da Pokédex ao fundo. A seleção conserva a forma regional ou cosmética exata e seu número nacional. Falhas mantêm a ficha anterior e permitem nova tentativa. O teste de navegador cobre 320, 768 e 1280 px e foi incluído no CI.

A base aprovada em produção é b2b4ad3 (2.0.31). A checagem obrigatória de fontes detectou oito arquivos externos atualizados. Os catálogos foram reconstruídos com os pins atuais da PokeAPI e do Showdown; seis traduções editoriais foram revisadas e persistidas. Os valores de batalha literais e o catálogo de movimentos permaneceram idênticos. As 2.617 artes e seus pacotes não foram alterados. A preparação do catálogo usa as traduções revisadas antes de verificar descrições pendentes, sem tradução online durante build ou uso.
