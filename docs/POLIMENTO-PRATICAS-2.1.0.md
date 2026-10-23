# MyOwnDex 2.1.0 — revisão das práticas de jogo e interface

23/10/2026. Candidata local sobre 2.0.52. Sem deploy, push, promoção ou alteração de dados reais. A revisão usa `IDENTIDADE-E-JOGABILIDADE.md` e `DIRECAO-DE-INTERFACE.md` como critérios; não acrescenta modalidades por idade, bônus de chefe ou alterações arbitrárias nas espécies.

## Correções desta rodada

1. **XP reconhece a batalha que chega depois da abertura do painel.** O controle anterior guardava em estado apenas a presença inicial do contexto. Se o oponente entrasse depois, podia mostrar “Batalha reconhecida” e ainda calcular uma recompensa sem os modificadores do confronto. A presença atual dos dados passa a determinar o modo de batalha, com a opção manual mantida quando não há contexto automático.
2. **Uma nova tentativa conserva a recompensa inteira.** Uma falha de confirmação já reutilizava o recibo, mas os controles permitiam mudar o valor antes de reenviar. Agora recibo, valor, cálculo e contexto da tentativa ficam juntos; os campos ficam bloqueados e o botão oferece repetir o mesmo registro. A resposta de sucesso mostra o valor efetivamente reenviado. Não há nova recompensa por repetir o pedido.
3. **Escolhas antes das contas.** Os três prêmios-base mostram “Comum”, “Importante” e “Conquista”. A recompensa final e os EVs continuam visíveis; a conta completa fica em “Entender a recompensa”, sem remover fórmula, motivos, participantes ou ajuste manual. Todos os resumos do painel compartilham alvo de toque de 48 px. A borda de seleção mantém a mesma espessura para não deslocar o botão.
4. **Informação comum não parece erro.** Avisos de sucesso e continuidade do gerador usam a cor informativa existente. Erros mantêm destaque próprio. Limpar/remover usam o mesmo tratamento dos controles secundários e preservam a confirmação contextual.
5. **Carregamento com resposta visível.** PC, Guia e Aventura mostram o destino que está abrindo, com mensagem acessível e nova tentativa quando o módulo não abre. Restaurar o encontro do gerador também mostra uma mensagem visível. Não há porcentagem fictícia nem espera artificial.
6. **Controles de HP com efeito e permissão claros.** Curar 1 HP fica indisponível com HP cheio; dano e cura ficam bloqueados enquanto a cena salva. Nomes acessíveis e os limites existentes são mantidos. Isso não altera cura, dano, proteção ou o significado de HP 0.
7. **Recuperação com a identidade do aplicativo.** A tela de erro usa o ícone vigente do MyOwnDex, com proporção reservada e a mesma classe da marca. Foi removido o círculo genérico com brilho e cor avulsa desse estado; o botão de reabertura também passou a usar o controle primário compartilhado, evitando contraste inadequado em contextos aninhados.
8. **Preparo offline acompanha a compilação atual.** O compilador registra a lista de JS/CSS do cliente, incluindo módulos sob demanda. O preparo usa essa lista em vez de percorrer todos os hashes que sobraram de compilações anteriores. Stubs de rotas de API ficam fora da lista; seus caminhos com `[code]` eram incompatíveis com a validação do worker e não representam telas do aplicativo. Versão incompatível, caminho inválido, arquivo ausente, link simbólico ou excesso de orçamento impedem trocar o manifesto válido.
9. **Repertório natural coerente no gerador.** No teste do aplicativo completo, o sorteio automático gerou um Pikachu de nível 5 sem movimentos ao escolher Champions, cujos dados disponíveis não ofereciam aprendizado por nível. A opção automática agora procura o jogo mais recente com algum aprendizado por nível para a espécie. Não recua a um jogo antigo só porque o nível escolhido ainda não alcançou os movimentos daquele repertório, não inclui TM/tutor/ovo como se fossem naturais e não altera os parceiros já guardados. Uma escolha explícita de Champions é preservada, com orientação para definir movimentos na ficha. A [página oficial de Champions](https://champions.pokemon.com/en-us/pokemon/) confirma que os movimentos podem ser alterados por treinamento; a seleção de um repertório natural para encontros é uma decisão explícita do MyOwnDex, apoiada no método registrado nos dados, e não uma afirmação de que todos os jogos usam aprendizado por nível.

## Efeito do ajuste offline

Um rebuild local acumulado tinha 64 arquivos e 7870342 bytes na lista. A seleção da compilação atual passou a **40 arquivos e 4791671 bytes**. Essa redução de aproximadamente 39% se refere à lista contaminada por sobras, não a uma promessa de que o aplicativo inteiro ficou 39% mais rápido. Frente ao último pacote de revisão, com 56 arquivos e 4794389 bytes, a diferença de bytes é pequena; a correção principal é impedir acúmulo futuro e a inclusão de stubs incompatíveis.

O teste adicional carrega **o HTML real, o manifesto real e todos os arquivos emitidos do build de produção**, executa o worker real com rede/cache controlados, desconecta e confere a raiz e os 40 arquivos offline. Isso amplia o teste de fixtures pequenas. Continua sendo uma simulação de CacheStorage/rede, sem representar instalação física Android/iOS. O hook usa a compilação Webpack explicitamente escolhida pelo projeto; uma migração futura de compilador precisa fornecer a lista equivalente e passar pela mesma validação, sem retornar silenciosamente à varredura de hashes antigos.

## Práticas positivas consideradas

| Diretriz | Aplicação nesta revisão | Evidência e limite |
| --- | --- | --- |
| Hierarquia | Escolhas e resultado de XP primeiro; cálculo sob demanda; destino visível ao carregar | Inspeção do componente e ensaio de interface; compreensão humana continua pendente |
| Grupos coerentes | Controles secundários de limpeza e remoção sem cor de erro; seleção de XP mantém borda estável | CSS do padrão e inspeção nos dois temas |
| Um sistema | Resumos de XP compartilham medidas e estados; recuperação usa a marca vigente | Sem novo sistema de cores ou nova família de controles |
| Espaço proporcional | Conta completa recolhida; nenhuma altura fixa nova para preencher espaço | Conferência em viewport estreito e baixo |
| Cortina e ficha | Preservados os marcos, controles ocultos fora do foco e leitura antes de edição | Regressões existentes e amostra visual; não equivale a teclado físico |
| Shiny e HP | Preservados medidores e símbolos; cura desabilitada no máximo | Mesmo componente HP nas fichas; sem alteração de escala |
| Gestos controlados | Sem mudança nos gestos de cortina/campo ou no arraste de sprites | Testes existentes continuam aplicáveis; sem alegar novo ensaio físico |
| Toque confortável | Resumos de XP com 48 px; campos mantêm rótulos e números inteiros | Medidas do DOM e navegação por teclado |
| Feedback com propósito | Falha de XP orienta repetir o mesmo valor; avisos comuns informativos; carregamento e nova tentativa | Ensaio com falha de confirmação controlada |
| Pokémon reconhecíveis | Tipos, espécies, habilidades e sprites mantidos; repertório natural respeita método e nível; recuperação identifica MyOwnDex | Sem bônus universal ou movimentos inventados para preencher slots |
| Opções justificadas | Contexto de batalha altera a recompensa quando chega; cura cheia não oferece ação sem efeito | Caso antes/depois e estado do botão no aplicativo |
| Vocabulário familiar | “Comum”, “Importante”, “Conquista”, “Entender a recompensa”, “Tentar registrar” | Detalhe técnico permanece disponível, sem exigir leitura inicial da conta |
| Moldura estável | Sem nova rolagem global; seleção não muda espessura de borda | Viewports/temas e retorno de foco observados por amostragem |
| Continuidade | Recibo, contexto e valor da tentativa ficam vinculados; caches antigos não contaminam a nova lista | Testes de persistência existentes e novos ensaios do worker/UI |
| Convite para jogar | Painel prioriza decisão e resultado, conservando profundidade consultável | Critério de design, sem atribuir nota de diversão |
| Revisão completa | Regras, dados, geração, cena, PC, Guia, Dados e conta mantêm a suíte integrada; inspecionadas áreas compartilhadas afetadas | Cobertura técnica delimitada; não é inspeção manual de todo o catálogo |

## Práticas negativas consideradas

| Prática proibida | Tratamento |
| --- | --- |
| Vazios e alturas sem função | Estados de carregamento têm mensagem compacta; nenhuma altura artificial acrescentada |
| Cores concorrentes e formulários dominantes | Avisos normais usam informação; limpeza/remover são secundários; conta de XP recolhida |
| Desalinhamento, arte cortada e fechar inconsistente | Mesma estrutura de controles; marca de erro com dimensões próprias; conferência visual das áreas afetadas |
| Categorias artificiais e configurações sem efeito | Nenhuma categoria nova; corrigido contexto automático de XP, repertório natural do gerador e botão de cura sem efeito |
| Placeholder como orientação, repetição e jargão no fluxo | Rótulos persistentes mantidos; explicação inicial curta, aprofundamento em detalhes; sem novo placeholder |
| Efeitos visuais concorrentes e deslocamento ao tocar | Removido brilho/círculo genérico da recuperação; seleção de XP com borda estável |
| Rolagens competindo e perda silenciosa | Mantido o contêiner de conteúdo; tentativa de XP preservada com mensagem; teste de continuidade existente |
| Obstáculos artificiais e recompensas manipulativas | Sem espera artificial, recompensa por clique, renovação de proteção ou buff universal de chefe |
| Remendos CSS e aprovação só por testes verdes | Alterados os seletores existentes do padrão; verificação visual separada dos testes automáticos |

Esta matriz registra decisões e evidências da revisão. Não transforma ausência de falha numa amostra em garantia universal. Permanecem necessários os testes humanos de clareza/diversão e os ensaios físicos/autenticados já registrados no roteiro da 2.1.0.


## Validação executada nesta rodada

- **689 testes aprovados**, sem falhas ou testes ignorados; ESLint, TypeScript e compilação de produção aprovados. Os quatro testes líquidos novos cobrem a seleção/validação de arquivos offline e repertório automático. Não se somam aos ensaios mecânicos anteriores como se medissem diversão.
- **XP, antes e depois:** o componente anterior, aberto sem contexto, mantinha 3 XP/6 EVs após reconhecer o confronto. O corrigido recalcula 12 XP/24 EVs no mesmo caso. Na compilação final, falha controlada, mudança posterior do contexto e nova tentativa preservaram os mesmos 12 XP, 24 EVs e identificador de recibo; a confirmação mostrou esse valor. Esse ensaio cobre a vida do componente aberto, sem alegar retomada de uma tentativa pendente depois de desmontar a tela.
- **Clareza e largura:** escolhas de XP e explicações inspecionadas em Claro/Escuro, com largura de 320 px e alvos dos resumos de pelo menos 48 px; nenhuma rolagem horizontal no documento de teste. Recuperação usa imagem de 72 × 72 px e botão de 48 px, branco sobre o vermelho primário nos dois temas. A cor e a espessura de foco continuam perceptíveis.
- **Aplicativo completo:** dano de 1 HP habilitou cura; voltar ao máximo desabilitou a ação. No gerador, o encontro antigo permaneceu até a confirmação explícita de substituição. Um novo Pikachu de nível 5, em automático, trouxe quatro movimentos naturais de Scarlet/Violet; a seleção explícita de Champions mostrou a orientação antes de gerar. O modal mediu 320 px de largura e 318 px internos, sem excesso horizontal.
- **Offline compilado:** HTML, worker e todos os 40 arquivos reais (4791671 bytes), incluindo módulos sob demanda, passaram no ensaio com rede/cache controlados. Lint e inicialização por `next start` também verificam o hook isolado de compilação, sem carregar o script inteiro de preparo no arquivo de configuração.

O ensaio visual usou cópia descartável e rota auxiliar de QA, fora do patch do produto. A prévia reteve uma resposta de uma compilação anterior durante um reinício; a saída final de QA foi construída em diretório próprio e sua referência de código foi conferida antes dos últimos testes. Nenhuma alteração para contornar essa condição entrou no produto. Há registros textuais e fixture de reprodução no pacote de revisão. Abertura de módulos já aquecidos não foi apresentada como medição de rede lenta. Instalação física, conta autenticada em HTTPS e observação humana permanecem nos limites já registrados.
