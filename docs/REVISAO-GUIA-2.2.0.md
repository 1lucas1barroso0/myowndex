# MyOwnDex 2.2.0 — rework das 50 regras

Base: `de428d3673be95372350ff918987f72f8ff50806` (2.1.13). Revisão de 24/10/2026.

## Resultado

As 50 regras têm explicação curta, procedimento para jogar com papel e dados, exemplo concreto com Pokémon e acesso às exceções e cenas desenvolvidas. A leitura usa números de 01 a 50; os IDs anteriores continuam disponíveis, inclusive 3.4, para preservar referências. A busca aceita `regra 50`, `#50`, o ID antigo, nomes, termos com ou sem acento e informações dos casos conferidos.

As novas regras preenchem duas lacunas da aventura: **3.8, Encerrar a batalha e continuar**, e **4.5, Explorar e descobrir caminhos**. A primeira diferencia fim de rodada, fim de confronto e recuperação. A segunda trata de perguntas, pistas, capacidades dos parceiros, riscos e caminhos após uma falha. Ambas usam os procedimentos existentes e explicam o que depende da arbitragem do Narrador.

Todas as explicações de entrada e os exemplos curtos foram revisados. A regra 6.4 agora trata da duração e do encerramento dos efeitos, complementando os estágios de 2.3. A regra de múltiplos impactos recebeu título específico. Dynamax e Gigantamax têm duração explícita no texto canônico. Crescimento reconhece a escolha de adiar evolução; os desafios devem oferecer contribuições reais ao parceiro atual. A regra de ouro inclui combinados de tom, participação e pausa.

## Apresentação e dependências

- A abertura apresenta a aventura, termos básicos e uma introdução opcional. As regras vêm antes das calculadoras.
- Assuntos filtram o guia sem apagar a busca. Cada regra prioriza procedimento e exemplo; exceções e cenas longas são carregadas quando abertas. A busca revela a camada que contém a informação procurada.
- A numeração contínua acompanha capítulos, livro, busca, testes e contagem exibida. A leitura em papel conserva procedimentos e texto completo.
- Exemplos curtos e contextos vêm da fonte canônica. A ajuda de sobrevivência em batalha usa o mesmo componente de texto completo do Guia, incluindo limites e exceções.
- O material de cálculo usa o Pikachu envenenado do caso reproduzido, em lugar de uma fração sem ficha identificada.
- Uma única folha de estilos organiza leitura, espaços, controles, estados de foco e largura. As regras preservam contraste pelos tokens do aplicativo e alvos de pelo menos 44 px.
- Versão, lockfile, documentação vigente e shell offline acompanham a 2.2.0.

## Balanceamento e fidelidade

Os parâmetros numéricos existentes continuam sujeitos às verificações do motor: escalas inteiras, defesa proporcional e empate defensivo, dano por movimento, limites e proteção geral, efeitos pequenos, custos, captura, XP, EVs, formas e persistência. A revisão torna suas decisões e exceções mais claras, sem equiparar artificialmente as espécies. Movimentos de apoio, ataques físicos e especiais, exploração, preparação, cooperação e retirada têm funções distintas.

A oportunidade de participar depende também do encontro preparado. O Narrador deve conferir quais tentativas podem funcionar e oferecer caminhos coerentes com as capacidades reais dos parceiros. Uma regra editorial não garante vitória com qualquer ataque nem demonstra que toda espécie ficou igualmente forte.

## Verificações

- 713 testes de unidade e integração aprovados, sem testes ignorados. Incluem reprodução dos casos numéricos pelo motor, progressão, proteção, condições, múltiplos impactos, captura, formas, persistência e exportação.
- Verificação de tipos, ESLint e compilação de produção aprovados na revisão local.
- Novos testes cobrem os 50 números de leitura, endereçamento individual, novas regras, correspondência entre busca e camadas reveladas e diferenciação entre estágios e duração.
- Os roteiros de navegador acompanham os 50 procedimentos, o carregamento sob demanda, assuntos, busca numérica, calculadoras, teclado, salto à proteção e livro.

A prévia local ficou inacessível ao navegador de revisão deste ambiente. A conferência visual e os roteiros automatizados da hospedagem serão registrados no PR. Esta seção não atribui uma inspeção visual local que não ocorreu.

Compreensão por crianças, entusiasmo, diversão e protagonismo precisam ser observados numa mesa real. Testes e simulações verificam resultados e coerência; não substituem essa observação. Instalação física em Android/iOS também não é certificada por esta revisão.

## Referências consultadas

- [Pokémon Sword/Shield — Dynamax](https://swordshield.pokemon.com/en-gb/gameplay/pokemon-become-huge-dynamax/): duração, uso por batalha e substituição dos movimentos. A contagem por rodadas é a adaptação de mesa do MyOwnDex.
- [Pokémon Sword/Shield — Gigantamax](https://swordshield.pokemon.com/en-gb/gameplay/gigantamax/): fenômeno e compatibilidade próprios, distintos de uma variante estética.
- [PokéAPI — documentação](https://pokeapi.co/docs/v2): atributos, movimentos e métodos de aprendizado por versão; dados não devem ser confundidos entre espécie, forma e jogo.
- [Pokémon Showdown — condições](https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts): implementação de referência para conferir interações. É um simulador comunitário, identificado como tal.
- `IDENTIDADE-E-JOGABILIDADE.md`, `DIRECAO-DE-INTERFACE.md`, casos em `guideAuditFixtures.js` e respectivas suítes: critérios permanentes e evidência específica das adaptações do MyOwnDex.
