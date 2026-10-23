# MyOwnDex — polimento das regras com números inteiros

Data: 23/10/2026. Candidata **2.1.0**, exclusivamente local. Base examinada: `86c090bc86e8457469478ef4246657540f9956f3`, versão 2.0.52. **Não houve deploy, push, promoção, mudança de produção ou alteração de dados reais de jogadores.**

Este documento substitui a recomendação anterior de HP fracionário e dano entre 85% e 100%. O patch é material de revisão; a aprovação do trabalho local não é autorização para publicar.

O ensaio ampliado, os pareceres críticos de IA, as sete falhas reproduzidas e as fontes externas estão detalhados em [ENSAIOS-E-REFERENCIAS-2.1.0.md](ENSAIOS-E-REFERENCIAS-2.1.0.md). Foram acrescentados 96 confrontos roteirizados e 50420 verificações; a origem de cada evidência e seus limites são explícitos.

A rodada de práticas positivas/negativas está em [POLIMENTO-PRATICAS-2.1.0.md](POLIMENTO-PRATICAS-2.1.0.md). Corrige reconhecimento tardio da batalha no prêmio de XP, reenvio coerente, apresentação das escolhas/contas, mensagens, limites dos controles de HP, recuperação, repertório automático do gerador e seleção dos arquivos offline da compilação atual. Os parâmetros de combate das espécies não foram alterados nesta rodada.

## 1. Decisões centrais

| Assunto | Candidata local |
| --- | --- |
| Valores de jogo | HP atual/máximo, dano, cura, XP, EVs e Amizade sempre inteiros. Multiplicadores são operações com razões de inteiros, não HP fracionário. |
| HP | Valor original dividido por 8, inteiro mais próximo, metade exata para cima; mínimo 1. Shedinja conserva 1. |
| Demais atributos e poder | Divisor 10 preservado; mesma regra anterior de arredondamento. |
| Defesa | Disputa proporcional preservada, incluindo empate favorável à defesa. Não há uma segunda divisão de dano pela Defesa. |
| Dano rolado | Pequena variação inteira em torno da base, com maior chance de manter a base. |
| Multi-hit comum | Preserva poder e contagem; muda a proteção geral para considerar a ação inteira. |
| Efeitos pequenos | Resto vira chance de mais 1 HP; não há piso universal de 1 nem saldo fracionário escondido. |
| Chefes | Sem bônus universal de atributos, HP, turnos ou proteção por serem chefes. |

As razões abaixo são contas a executar antes de produzir um resultado inteiro. Nunca se escreve HP parcial numa ficha ou snapshot.

### Identidade e público

O RPG e o aplicativo são para crianças e fãs assíduos, conhecedores e entusiasmados. A direção permanente em `IDENTIDADE-E-JOGABILIDADE.md`, vinculada ao `AGENTS.md` e à direção de interface, exige preservar diferenças de espécie e indivíduo, interações Pokémon e continuidade do parceiro. A revisão deve apresentar primeiro escolhas e exemplos claros e permitir aprofundar regras, referências e exceções. Exploração, descoberta, cuidado, amizade e cooperação têm lugar junto das batalhas.

A candidata conserva defesa proporcional, tipos, habilidades, movimentos, PP, condições e exigências de formas; identifica HP por 8, d6 de dano, proteção geral e procedimentos narrativos como adaptações de mesa. O Guia já estabelece desmaio em HP 0 sem morte automática e chefes sem bônus universal. A triagem de multi-hit especial evita substituir silenciosamente uma sequência própria por uma genérica. Esses pontos são compatíveis com a direção; não comprovam que todos os encontros e públicos já tiveram uma experiência satisfatória. O roteiro de mesa agora inclui compreensão de iniciantes, profundidade para conhecedores e reconhecimento do parceiro. Essa observação continua pendente.

## 2. Dano: regra e limites

Depois dos modificadores e do arredondamento da base, role um d6 por impacto e alvo:

| d6 | Resultado |
| --- | --- |
| 1 | Base menos um passo |
| 2, 3, 4, 5 | Base |
| 6 | Base mais um passo |

O passo é a base dividida por 10, arredondada para baixo, mínimo 1. Base 6 produz 5, 6 ou 7; base 20 produz 18, 20 ou 22. Base 1 permanece 1, preservando o piso sem introduzir outro erro ou inflar sua média. O teto comum é aplicado depois; crítico, dano fixo e outras exceções mantêm suas permissões. Quando o teto corta a parte alta, a média efetiva pode ficar abaixo da base.

Dano fixo, proporcional ao HP, cura, custos, drenagem, recuo e residual não recebem esse d6. Drenagem e recuo partem do dano efetivamente aplicado. Cada impacto tem um resultado registrado; execução e prévia usam a mesma lista, em vez de multiplicar um dano rolado pelo número de hits. O servidor guarda também os sorteios auditados. Reenviar a mesma requisição não gera outro resultado.

O método é uma **adaptação de mesa**. O intervalo do cartucho entre 85% e 100% não produziria uma variação acima da base e frequentemente desapareceria no arredondamento dos números pequenos.

## 3. Efeitos pequenos sem frações de HP

Separe a parte inteira da razão e resolva o resto como chance de mais 1. Para máximo de 3 HP e queimadura de uma parte em 16, há 3 resultados em 16 que retiram 1 HP; nos demais, retira 0 nessa ocorrência. Para 19 dividido por 16, aplica 1 e tem 3 chances em 16 de aplicar mais 1.

- Não há dívida, contador de HP parcial ou saldo transferido para outra rodada.
- Cada fonte continua separada para imunidade, gatilho e nocaute. Magic Guard também bloqueia os resíduos de itens, enquanto Future Sight/Doom Desire continuam dano direto; resíduos G-Max não ativam Sash/Sturdy como se fossem um golpe direto. O efeito permanece ativo quando o resultado é 0.
- Custos voluntários mantêm mínimo 1 e a exigência de poder pagar. Não se compra Substitute ou outro benefício com um custo sorteado de 0.
- Queimadura, veneno, clima, recuperação persistente, contato, drenagem, recuo e curas percentuais passam pela resolução inteira aplicável.
- Registros de fim de rodada distinguem fonte ativa sem alteração de HP de cura ou perda real. Um resultado 0 não consome a proteção.
- Em Max, as referências percentuais comuns usam o HP-base, sem Max. O limite da cura continua sendo o máximo temporário atual.

Esse método conserva a força média dos efeitos pequenos e acrescenta variação. **Não garante uma perda ou cura em toda ocorrência.** É o principal compromisso a observar em mesa: se o grupo preferir previsibilidade, uma alternativa de contadores inteiros precisará de outra especificação e testes; HP fracionário continua descartado.

## 4. Proteção geral e multi-hit

A elegibilidade é verificada no início do movimento: HP cheio, proteção disponível e espécie elegível. Some o dano direto dos impactos que realmente alcançam o Pokémon depois de precisão, Substitute, demais bloqueios e teto. Se o total o derrubaria, mas é menor que três vezes o máximo, limite a ação para terminar em 1 HP e consuma a proteção uma vez.

Os outros impactos dessa mesma ação não retiram o último HP por dano direto. Um total de três vezes o máximo ou maior atravessa a proteção geral. Nocaute direto e Shedinja conservam suas exceções. Outro adversário, outro movimento ou uma consequência indireta continuam sendo fontes separadas.

Sturdy, Focus Sash e a reserva de sobrevivência continuam separados. Quando a proteção geral cobre a ação, não se gasta a Sash no impacto seguinte desse mesmo movimento. Quando a proteção geral não é elegível, as proteções próprias são verificadas por impacto. Cura, troca e fase não renovam o uso geral.

Nos multi-hits comuns de 2 a 5, permanecem os pesos 35/35/15/15. Skill Link e Loaded Dice mantêm suas regras existentes. **O estudo não é uma auditoria exaustiva de cada movimento especial do catálogo.** Sequências com precisão própria por impacto, poder crescente, integrantes da equipe, distribuição entre alvos ou reações entre hits precisam de resolução específica; não se pode extrapolar a validação dos multi-hits comuns para todos esses casos.

O caminho automático agora interrompe, antes de sorteio ou gasto, sequências como Triple Kick, Triple Axel, Population Bomb, Beat Up, Dragon Darts e Surging Strikes e combinações identificadas com reações intermediárias de habilidade, item ou efeitos. O painel orienta a resolução guiada. As marcações de contato de Arm Thrust, Double Slap, Double Hit, Double Kick, Fury Attack, Fury Swipes, Tail Slap, Dual Wingbeat e Triple Dive também foram corrigidas para que a triagem reconheça essas combinações. O Narrador aplica a regra própria, registra PP, dano e proteção uma vez e avança a ação. Assim, a ausência de um motor completo de reações entre hits não produz silenciosamente um resultado genérico incorreto. A automação integral dessas sequências continua sendo trabalho separado, não uma alegação desta candidata.

## 5. Formas Max: funcionamento e integração

A permissão `canDynamax` fica separada do nível Dynamax. Um Pokémon habilitado pode usá-la no nível 0. Fichas antigas com nível 0 não recebem autorização nova silenciosamente; o Narrador pode habilitá-la. Fichas antigas com nível positivo mantêm acesso, salvo exclusões de espécie.

| Nível Dynamax | Conta do máximo |
| --- | --- |
| 0 | HP-base multiplicado por 30 e dividido por 20 |
| 5 | HP-base multiplicado por 35 e dividido por 20 |
| 10 | HP-base multiplicado por 40 e dividido por 20: dobra |

Arredonde o máximo para baixo. O HP atual entra na mesma proporção inteira. Guarde o HP-base da entrada e o HP Max inicial. No retorno, a mudança efetiva de HP Max é convertida para a escala-base, arredondando para baixo; consciente mantém pelo menos 1, desmaiado continua 0. Entrar e sair sem eventos conserva exatamente o HP anterior. A quantização pode custar um ponto-base ao converter uma perda pequena; não há restituição fracionária escondida.

Exemplo: 3 HP máximos, 1 atual, nível 10 → 6 máximos e 2 atuais. Sem eventos, volta a 1 de 3. A transformação não cura a ferida.

Correções integradas:

- Shedinja permanece com 1 HP. Zacian, Zamazenta e Eternatus não usam Dynamax comum.
- Gigantamax usa o mesmo aumento de HP; exige fator e espécie compatíveis. Eternamax usa dados próprios, sem um dobro universal.
- Duração de três rodadas e encerramento na troca preservados. Dyna/Gmax compartilham um uso por Treinador por batalha.
- Transformações são preparadas antes da iniciativa; o painel e a validação impedem ativação tardia que mudaria o sentido da prioridade já rolada. Prioridade efetiva já existente preservada: ataque Max 0; Max Guard 4. PP continua vindo do movimento original; o movimento transformado tem seus próprios efeitos.
- Hesitação não interrompe Dyna/Gmax. OHKO e Low Kick, Grass Knot, Heavy Slam, Heat Crash, Roar e Whirlwind são bloqueados nas interações implementadas.
- Leftovers, queimadura e demais referências percentuais comuns usam HP-base. G-Max Finale também usa a referência-base e resolução inteira.
- Efeitos aleatórios G-Max aceitam a fonte auditada do servidor, além da fonte injetada dos testes.
- O painel mostra HP-base, HP Max e rodadas restantes. Registrar progresso no PC converte o HP temporário para a base, evitando cura artificial.
- Há teste de limite para máximo-base 99999 e máximo Max 199998, além dos valores comuns.

O dobro é correto no nível Dynamax 10. A progressão por nível é preservada; não se apresenta todo nível como dobro. Os ajustes de arredondamento são adaptações explícitas à escala inteira do RPG.

## 6. Captura e intervenções

A fórmula d100 continua sendo a adaptação explícita do MyOwnDex, com taxa da espécie, HP, Ball e condição. Seus fatores são multiplicados como razões inteiras antes de dividir e arredondar a chance final. Taxa positiva continua com chance de 1 a 100; taxa 0 não ganha captura comum. Master Ball preserva a exceção própria e não autoriza capturar o parceiro alheio.

A Great Ball em alvo cheio de taxa 255 agora resulta em **50%**, sem o erro de cair para 49%. Formas Dyna/Gmax/Eternamax precisam terminar antes da tentativa comum.

O Narrador registra as quantidades de Balls na bolsa do Treinador. Uma captura salva, na mesma operação, resultado, alvo, consumo de uma Ball e intervenção. Falha também consome. Repetir a requisição retorna o recibo anterior; não repete gasto nem sorteio. A bolsa tem edição explícita com botão de salvar, e uma edição pendente impede lançar a Ball com um saldo ainda não confirmado.

Mudar a fase da cena não encerra sozinho o confronto. **Encerrar batalha**, depois de concluir a rodada, termina transformações e estados temporários, preservando HP, PP, condições persistentes e gastos. Só **Nova batalha** inicia outro confronto e renova os recursos próprios de batalha. Isso também distingue corretamente a captura fora de combate de uma simples mudança de fase.

Em batalha, a janela é o começo do turno de um Pokémon controlado pelo Treinador, antes da condição e da ação, uma vez por Treinador e rodada. Não se interrompe dano resolvido. A captura não gasta a ação do Pokémon. Fora de batalha, continuam o tempo e o risco da cena.

**Limite de automação:** a bolsa adicionada cobre Balls. Não foi criado um inventário universal nem um resolvedor de todos os itens de cura. Intervenções de item e suas consequências continuam exigindo arbitragem e registro do Narrador; não se deve anunciar que todas já são transacionais como a captura.

## 7. XP, descanso e amizade

**XP:** conserve a sobra. Desconte a meta de cada nível e repita enquanto o saldo pagar outra meta. Nível 10 com saldo 4 e prêmio 3 paga 5 e chega ao nível 11 com saldo 2. Um prêmio maior pode atravessar vários níveis. EVs continuam sendo o dobro da XP recebida, uma vez pelo recibo. O teto padrão é 100; exceção explícita pode usar até 200, sem reduzir um nível já existente. No teto, o saldo permanece; conta, exportação e normalização não o cortam em 999999. Operações que excederiam o limite inteiro seguro são recusadas.

Registre o prêmio fora da ordem de batalha, depois de usar **Encerrar batalha** quando houver um confronto iniciado, e depois de encerrar transformações, incluindo Transform. Mudar apenas a fase não libera a recompensa. A busca da ficha usa o identificador local ou o vínculo compartilhado da Box; se faltar a fonte necessária para recalcular atributos, a subida de nível é recusada com orientação, sem aplicar XP parcialmente. Subir não revive HP 0, não limpa condição, não devolve PP nem itens. A ficha e a sala usam a mesma progressão; recibos e fusão de prêmios concorrentes continuam ativos. Não há reconstrução retroativa de XP que a versão antiga já descartou.

**Descanso curto:** dez minutos seguros, uma vez por Pokémon entre descansos completos. Cura um quarto do máximo, para baixo, mínimo 1, até o máximo; exige consciência. Não cura condições, recupera PP nem renova proteção. O uso persiste em troca, fase, PC e exportação.

**Descanso completo:** oito horas seguras ou atendimento completo em Centro. Restaura HP e PP, trata condições comuns e libera outro descanso curto. Não repõe Balls, dinheiro, itens consumidos, amizade ou proteção da mesma batalha. Transformações, incluindo Transform, e cópias temporárias de movimentos terminam antes. Um confronto iniciado precisa ser encerrado explicitamente depois da rodada; mudar apenas a fase não libera descanso. Os cuidados narrativos e a segurança do lugar continuam sendo decisões da mesa.

**Amizade:** mantém valor original de 0 a 255 e conversão RPG por 10, para baixo, até 25. Referências: +5 por cuidado significativo, +10 por marco, +20 por virada; +50 excepcional. Rotina soma no máximo +10 na sessão, sem apagar marcos distintos. Não há ganho automático por XP ou clique, nem perda automática por desmaio. O controle continua sendo edição do Narrador, não um sistema automático de recompensas por evento.

## 8. Ações e procedimentos narrativos

| Procedimento | Regra revisada |
| --- | --- |
| Outra ação | Declarar Trocar, Improvisar, Fugir ou outro objetivo antes da iniciativa. Não reservar um ataque para escolher depois. Troca voluntária exige a declaração específica e usa a vez de quem sai. Encerrar a rodada limpa também a categoria da ação anterior. |
| Improvisar | Combinar objetivo, teste, benefício, custo e risco antes dos dados. Usa a ação principal e PP quando empregar movimento. Um benefício coerente: Vantagem/Desvantagem de um uso, até o fim da rodada seguinte, ou mudança concreta de posição/objetivo. Sem dano completo e bônus gratuito. |
| Ajudar | Uma pessoa faz o teste com Vantagem; contribuição útil e exposição ao risco são necessárias. Ajuda não acumula dados. |
| Teste coletivo | Cada papel pertinente testa; um sucesso capaz resolve o objetivo, mas papéis indispensáveis também precisam passar. Consequência agregada: 0 passos se todos passam; 1 se há falha; 2 se pelo menos metade falha. Sem multiplicar punições por pessoa nem acrescentar participantes irrelevantes. |
| Repetir | Pode tentar de novo pagando novo tempo, recurso ou exposição. Repetição imediata sem mudança relevante pode ter Desvantagem anunciada, sem acumular. Preparação muda a abordagem, não apaga o perigo anterior. Não se aplica essa penalidade genérica a ataques ou capturas. |
| Fugir | Ação de prioridade 0 e disputa de Velocidade; empate favorece quem bloqueia. Sair encerra participação ofensiva na cena. Perseguição longa: Fuga e Perigo de 0 a 3, uma disputa principal por rodada, apoio usa ações e progresso não zera. |
| Chefes | Composição, repertório, terreno, sinais e objetivos. Não recebem multiplicador geral nem renovam proteção em fases. Uma raid é um formato separado, com qualquer exceção anunciada e limitada. |

Os procedimentos ficam no Guia e usam os testes, notas e decisões existentes. Há funções compartilhadas testadas para resultado coletivo e contadores de perseguição; **não há um painel novo que automatize toda arbitragem, expiração de benefícios narrativos ou perseguição**. Essa distinção evita prometer recursos que o app não oferece.

O Guia passa de 40 a 48 regras, preservando IDs, especialmente 3.4. Novas regras: 1.5, 5.5, 7.7 e 8.6 a 8.10. Busca, contagem, explicação compartilhada da proteção e testes acompanham a mudança.

## 9. Dados, migração e compatibilidade

- Sala: schema 9; equipe: schema 6; escala RPG: versão 3; protocolo de sala: 4.
- Leitura dos formatos antigos permanece. Exportações novas usam versão interna 5 para Box e 2 para Pokémon, rejeitada por leitores antigos que não entendem a revisão. A revisão atual também lê as anteriores.
- HP antigo cheio continua cheio, 0 continua 0 e ferido é convertido proporcionalmente, para baixo, mínimo consciente 1. A conversão é idempotente e depende da referência de HP; se ela ainda falta, espera hidratação em vez de adivinhar.
- Salas da escala imediatamente anterior conservam o HP da batalha em curso até **Nova batalha**. O painel avisa; não se recalcula a ordem em andamento. O marcador acompanha cada token.
- PP, condições, amizade, itens consumidos, uso de proteção, EVs e recibos são preservados. Não se rerrolam eventos históricos.
- Permissão Max, HP de entrada, bolsa e descanso usado sobrevivem às normalizações e aos canais implementados de persistência/compartilhamento.
- Edições manuais no PC têm revisão de origem. A aventura não sobrescreve uma ficha mais recente; o Narrador pode atualizá-la no intervalo, sem iniciativa ou transformação ativa. A atualização compara os campos com a origem da edição: nome ou atributos novos não desfazem dano, PP, condição, descanso ou consumo de item posteriores na cena; alterações explícitas desses campos no PC são aplicadas. A confirmação limpa a base de comparação, e XP fica bloqueada enquanto a ficha aguarda atualização. Revisão e base de comparação acompanham conta e Link Cable.
- A leitura dos fatores usa razões inteiras. Altura e peso usam metros/centímetros e quilogramas/gramas inteiros, conservando as medidas originais do catálogo. Nove traduções editoriais de habilidades e berries que aproximavam um terço em porcentagem agora conservam `1/3`, como no original; os pares públicos e os hashes de procedência acompanham a correção. Fatores em prosa, como “multiplicado por 1,5”, também são lidos como `3/2`. O Guia e a calculadora distinguem HP por 8 dos demais atributos por 10; a ficha permite Dynamax habilitado de nível 0 e o campo distingue proteção ainda não usada de elegibilidade com HP cheio.
- Versão e cache PWA acompanham a candidata. Clientes de protocolo antigo recebem atualização obrigatória nas mutações compartilhadas; dados de treino e histórico não são apagados por essa mudança.

**Antes de uma publicação futura:** fazer exportação/cópia integral dos dados anteriores e testar sua recuperação. Esta etapa não adicionou um novo mecanismo universal de backup pré-migração. Os testes de pureza/idempotência e os mecanismos existentes de recuperação não substituem testar a restauração em dispositivo com dados antigos.

## 10. Evidências e limites

### Comparação isolada: 144000 duelos

Cinco modelos, 12 perfis de espécies, seis níveis, cinco perfis de ataque, 80 repetições por perfil. Mesmas hipóteses do estudo anterior: espécies espelhadas, tipos neutros, STAB comum, ataques físicos, IV 31, EV 0, natureza neutra. Há 1365 verificações da aritmética-base contra o motor e 10000 propriedades de partição de XP no comparador. Limite de 60 rodadas; casos não encerrados permanecem contados.

| Cenário, 960 duelos por modelo | Base anterior | Inteiros, HP por 8, proteção por ação e d6 curto |
| --- | --- | --- |
| Nível 5, multi-hit poder 15, precisão 85 | 452 KOs antes de agir; mediana 1 rodada; P90 3 | 77 KOs antes de agir; mediana 2; P90 7 |
| Nível 10, mesmo multi-hit | 397 KOs antes de agir; mediana 1; P90 4 | 6 KOs antes de agir; mediana 3; P90 11 |
| Nível 80, poder 90 | Mediana 3; P90 13; 8 não encerrados | Mediana 4; P90 19; 9 não encerrados |

Isso apoia um ganho moderado de HP e a mudança da proteção, sem justificar reduzir a defesa ou usar um divisor ainda menor. Também expõe a cauda longa de confrontos resistentes. Não é uma previsão de frequência em campanha: não inclui repertórios adaptativos, PP, trocas, itens, decisões humanas ou todos os casos especiais de Max/multi-hit.

### Integração e regressões

A revisão adicional de qualidade encontrou e corrigiu limites de descanso, recompensa e vínculo de fichas. Foram acrescentados seis testes de regressão; os resultados abaixo incluem essa revisão. Não se atribui nota de diversão nem se alega observação humana com base nesses testes.

A regressão inclui **689 testes aprovados**, sem falhas, cancelamentos ou testes ignorados, ESLint sem erros ou avisos de código, TypeScript aprovado e build de produção local aprovado. Logs completos acompanham o pacote. O aviso do npm sobre a configuração de proxy do ambiente não é erro de código.

- **920024 verificações de estresse integrado**: 344064 casos de captura, 55550 ciclos Max, 24080 sequências de dano e 1680 resoluções de movimento, além da distribuição residual no motor real.
- **144000 duelos experimentais**, separados das verificações integradas, nas hipóteses descritas acima.
- **48 jornadas mecânicas cruzadas**: geração, Box, Max, combate autoritativo com PP, residual, descanso, captura, XP com recibo, sincronização, documento de conta e exportação/restauração. Três perfis de espécie, quatro níveis e quatro sementes. Esse conjunto é um dos 689 testes, não 48 testes adicionais. O ensaio ampliado separado executa 96 confrontos com tipos próprios, seis Pokémon e escolhas roteirizadas distintas; não são sessões humanas.
- Rotas reais com SQLite em memória verificam declaração, captura, encerramento e reinício de confronto, repetição idempotente e permissões. Não usam contas reais.
- Migração idempotente, HP 0, tetos, PP, itens consumidos, recibos concorrentes, valores altos de XP e edições manuais pendentes têm regressões próprias. Seis novos testes verificam bloqueio de descanso/XP em confronto ainda aberto, Transform, cópias temporárias, preservação de movimentos permanentes, Box compartilhada com ID local diferente e recusa de subida sem fonte de atributos.
- Os controles de descanso e XP consultam os mesmos motivos usados pelo núcleo e explicam o bloqueio junto da ação. O descanso consulta o estado mais recente da cena antes de salvar, evitando agir sobre uma seleção antiga.
- A inspeção estreita encontrou baixo contraste nos botões de HP do tema escuro: variáveis antigas calculavam a superfície usando a cor do texto, que se torna branca nesse tema. As duas variáveis de compatibilidade agora apontam para as superfícies escuras já existentes; os painéis que as compartilham acompanham a correção, sem cores novas ou mudança de identidade.
- Auditoria local de publicação confere 2617 sprites 2D, orçamento público e ausência de temporários públicos ou pacotes duplicados. A entrega Linux também passou por integridade, extração isolada, reexecução, recuperação de corrupção, bloqueio concorrente e determinismo, sem executar o fluxo de publicação. Executar essa auditoria não publica.

A revisão crítica ampliada corrigiu importação com revisão igual, identidade do parceiro nos códigos, PP de slots não copiados, Mimic com Sketch, cópias anteriores a Transform, XP/atualização de ficha durante Tera Shift e duas atualizações offline incompletas consecutivas. Há sete testes de regressão adicionais. O Guia explicita os degraus, o piso individual de XP e a lista prévia de participantes coletivos, com exemplos de improvisação e cooperação. As mesmas correções são usadas pela cena local, servidor e persistência compartilhada onde esses núcleos são chamados.

### Inspeção visual e interação realizadas

A prévia gerenciada foi viabilizada com um lançador exclusivo na cópia de QA, sem modificar o comando de desenvolvimento do produto. O impedimento anterior de opções incompatíveis do supervisor foi superado. Dados locais descartáveis foram usados.

| Área | Evidência observada | Limite |
| --- | --- | --- |
| Pokédex e Guia | Busca, favorito, registro, sprites, regras Max e leitura das escalas; 48 regras pesquisáveis | Não é inspeção manual individual das 1025 espécies |
| Gerador e Box/ficha | Gerar dois parceiros, salvar sem duplicar, reabrir/recarregar; editar nome, nível, amizade e permissão Max | Não cobre visualmente todas as combinações de formulário |
| Aventura e Max | Entrada de 2/4 para 4/8; dano para 3/8; PC conserva 1/4; três rodadas encerram Max; atualização da ficha pendente no intervalo | Cena local descartável, sem jogadores remotos simultâneos |
| XP e vínculo | Nível 10, XP 4 + prêmio 3 → nível 11, XP 2, 6 EVs pendentes; ferida preservada; nome e nível novos aparecem na cena após atualização | Mesclagem de dano/PP/item durante edição pendente também verificada automaticamente |
| Fim de batalha e captura | Descanso e XP bloqueados após mera troca de fase; encerramento libera cuidados e recompensa, descanso usado não repete; nível 5 + 3 XP → nível 6, XP 0 e 6 EVs; confirmação de encerramento; captura fora do confronto; bolsa de Master Ball de 2 para 1, alvo capturado e segunda tentativa desabilitada | Itens genéricos continuam guiados pelo Narrador |
| Dados e continuidade | Resultado 2d6 e histórico preservados ao reabrir/recarregar; Box, aventura e resultados do gerador também persistem | Não demonstra sincronização autenticada entre dois aparelhos |
| Interface compartilhada | Claro/Escuro, desktop e larguras de 320, 390 e 768 px, inclusive altura reduzida; cortina só com puxador, controles ocultos fora do foco; diálogo com Tab/Escape | Viewport de iframe não equivale a telefone físico, teclado do sistema ou Safari |
| Cartão/conta | Estado de visitante/serviço indisponível inspecionado; documentos e APIs testados com SQLite em memória | Interface autenticada completa não validada em HTTPS nesta prévia |

A revisão manteve a direção existente: vermelho da marca, cores por tipo, arte 2D, controles agrupados, rótulos e continuidade. Os ajustes visuais desta etapa corrigem texto, estados e organização dos controles; não redesenham a identidade do MyOwnDex.

### PWA: falha encontrada e correção

Visitar apenas a tela inicial não garantia o código das áreas carregadas sob demanda no cache. O compilador registra os JS/CSS do cliente efetivamente emitidos e o pós-build gera `offline-assets.json` dessa lista, incluindo os módulos de Aventura, PC, Guia, gerador e conta. Hashes antigos deixados na pasta de saída e stubs de API não entram no shell. O worker verifica versão, caminhos, quantidade, bytes e compatibilidade com o HTML antes de marcar o shell como completo.

O cache completo admite até 256 arquivos de código, 12 MiB no total e 4 MiB por arquivo. Downloads têm concorrência quatro. A navegação só substitui a entrada offline depois de guardar todos os módulos. Se a atualização for interrompida, mantém um shell anterior utilizável e tenta completar a revisão quando a conexão retorna. APIs privadas e respostas RSC continuam fora do cache. O manifesto é gerado novamente no build da instalação, sem uma lista de hashes antiga embutida no pacote-fonte.

Os testes de worker em ambiente simulado cobrem primeira abertura de áreas ainda não visitadas offline, atualizações interrompidas consecutivas, preservação de shell antigo com e sem marcador, recuperação online, versão/HTML incompatíveis, limites e falha de quota. O ensaio adicional usa o HTML, a lista e todos os arquivos reais da compilação, desconecta e confere a abertura e os arquivos offline. Os testes executam o script real com CacheStorage/rede controlados; não equivalem à instalação nativa em navegador móvel. O orçamento dos catálogos e sprites permanece separado do shell e os dados dos jogadores não são removidos.

### Limites ainda abertos

1. **PWA instalada e conta autenticada em HTTPS:** a prévia disponível usa HTTP em `terminal.local`. Não permite validar instalação nativa/service worker e o cookie Secure de produção nesse domínio. Não se enfraqueceu a segurança para contornar isso. Faltam os ensaios físicos Android/iOS, atualização offline, restauração com dados antigos e armazenamento apertado. As regressões automatizadas já cobrem a lógica correspondente.
2. **Mesa com pessoas:** nenhuma sessão humana foi observada. O roteiro em `VALIDACAO-2.1.0.md` define cenas, registro de tempo, participação e reviravoltas para essa observação. As 48 jornadas, os 96 confrontos roteirizados e os 144000 duelos são ensaios técnicos. Diversão, emoção e protagonismo não foram certificados.
3. **Multi-hit especial e arbitragem:** as sequências explicitamente triadas são guiadas; a candidata não oferece automação integral de reações entre impactos nem um inventário universal. Improvisação, ajuda, perseguição e amizade continuam envolvendo decisões do Narrador.

O pacote contém o patch completo sobre a base indicada, a lista exata de arquivos alterados, estudos, resultados, roteiro de validação e logs. Não inclui credenciais, dados reais de jogadores, dependências instaladas ou deploy. A candidata **2.1.0 permanece local e revisável**; esses limites não são apresentados como testes concluídos.

## 11. Referências

Mecânicas Max: [site oficial de Sword/Shield](https://swordshield.pokemon.com/en-gb/gameplay/pokemon-become-huge-dynamax/), [estratégias oficiais de Dynamax](https://www.pokemon.com/us/features/dynamax-pokemon-battle-strategies-for-pokemon-sword-and-pokemon-shield), [formato oficial de raids](https://swordshield.pokemon.com/pt-pt/gameplay/dynamax-powerful-pokemon/).

Investigação de implementação: [condições](https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts), [Pokémon e HP-base](https://github.com/smogon/pokemon-showdown/blob/master/sim/pokemon.ts), [itens](https://github.com/smogon/pokemon-showdown/blob/master/data/items.ts), [movimentos](https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts) e [resolução](https://github.com/smogon/pokemon-showdown/blob/master/sim/battle-actions.ts) do Pokémon Showdown. É uma fonte primária de implementação, não o editor oficial de Pokémon; não foram importadas banlists ou cláusulas competitivas.

Referências de design de mesa: [colaboração](https://bladesinthedark.com/teamwork) e [contadores de progresso](https://bladesinthedark.com/progress-clocks), do SRD de Blades in the Dark. As regras propostas aqui são adaptações próprias.
