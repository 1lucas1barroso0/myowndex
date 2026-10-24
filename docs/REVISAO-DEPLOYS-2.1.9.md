# Revisão dos deploys e das 48 regras — 2.1.9

A base é a produção 2.1.8, commit `ebbf9975dca897689b6d25034891f880dad95e63`. As produções 2.1.5 a 2.1.8 estavam READY na Vercel. A consulta de erros de execução das últimas 24 horas não encontrou ocorrências; isso não demonstra compreensão por crianças nem ausência de todo defeito.

## Problemas encontrados e correções

- O detalhamento mantinha exemplos abstratos de partes de HP e outros números sem ficha. Esses parágrafos foram retirados do Guia. Os números apresentados como exemplos agora têm fichas, escolhas e saídas reproduzidas pelo núcleo do aplicativo.
- As 48 regras tinham explicações espalhadas por três arquivos. Cena e contexto agora derivam da regra canônica, também usada na ajuda de batalha. A busca usa apenas o texto mostrado e os casos conferidos, sem encontrar uma equação antiga escondida e levar a um trecho inexistente.
- Turno e rodada apareciam antes de ficarem claros. O Guia explica a vez de Pikachu, a vez do outro participante, Próximo turno e Encerrar rodada. Veneno é explicado depois dessa sequência, com o momento do botão que o aplica.
- Growl diminuía o Ataque na explicação, mas a ligação com movimentos físicos não estava clara. O texto distingue Quick Attack de Thunder Shock. A descrição de Mega Venusaur agora deixa claro quem segura Venusaurite e quem usa Key Stone.
- Potion era descrita como se saísse automaticamente da bolsa. O controle automático de estoque existente é o das Balls. O Guia agora distingue esse controle dos itens conduzidos pelo Narrador.
- Faltava registrar a oportunidade gasta por um item do Treinador. A nova ação `trainer-item` registra essa intervenção e impede uma captura adicional na mesma volta. Usa as permissões, o momento e o registro compartilhado existentes. O histórico local aceita o novo recibo e a aventura compartilhada consulta a lista canônica de ações que exigem revisão do estado, incluindo o encerramento da batalha. Não inventa uma cura nem retira uma Potion de um estoque inexistente.
- A calculadora começava com valores sem ficha. Agora aguarda uma entrada do usuário, conserva campos vazios e calcula os valores informados.

## Casos numéricos

`src/core/guideAuditFixtures.js` constrói Pokémon de teste com as funções usadas pelo PC e executa movimentos, condições, captura, XP, descanso, transformação e procedimentos de grupo. `scripts/auditar-casos-guia.mjs` reproduz a execução e compara sua saída com `src/data/guide-audit-cases.js`, a fonte dos resultados mostrados no Guia.

O caso de Poison Sting usa Ekans e Pikachu no nível 5, Hardy, IVs 31 e nenhum EV. A ficha real do núcleo dá a Pikachu 3 HP. O impacto deixa 2 HP e veneno. Ao encerrar a rodada, dois resultados de sorteio reproduzidos mostram, separadamente, Pikachu ainda com 2 HP e Pikachu com 1 HP. Nos dois caminhos continua envenenado. São alternativas a partir do mesmo estado, não cobranças sucessivas inventadas.

Os demais casos identificam fichas e ações para velocidade, imunidade de Geodude, proteção de sobrevivência, variação de dano, sono de Eevee, recompensa de XP, Dynamax de Pikachu, captura de Pidgey, descanso, cooperação e perseguição. Não são dados de contas nem registros de sessões de pessoas. As saídas são testadas contra o núcleo e têm pontos de referência estáveis para evitar que uma alteração apenas recalcule uma expectativa errada silenciosamente.

## Fidelidade e preservação

As referências de compatibilidade de Pokémon e movimentos continuam em [GUIA-CONTEXTUAL-2.1.8.md](GUIA-CONTEXTUAL-2.1.8.md) e [EXEMPLOS-LEGITIMOS-2.1.5.md](EXEMPLOS-LEGITIMOS-2.1.5.md). As fichas de teste usam os atributos-base canônicos de Pikachu, Eevee, Ekans, Pidgey e Geodude de Kanto. O jogo e a situação do caso são informados; improvisos de travessia permanecem decisões do RPG, sem efeitos oficiais inventados.

O núcleo de cálculo de `rpgRules.js`, a partir de `rollAttributeTest`, deve permanecer idêntico à 2.1.8. A atualização não troca fórmulas de dano, XP, captura ou Max, nem altera espécies ou fichas salvas. A referência mecânica está em [REFERENCIA-MECANICA-2.1.9.md](REFERENCIA-MECANICA-2.1.9.md); os exemplos abstratos antigos não devem ser reintroduzidos como orientação de jogo.

Fontes dos atributos-base conferidos: [Pikachu](https://pokemondb.net/pokedex/pikachu), [Eevee](https://pokemondb.net/pokedex/eevee), [Ekans](https://pokemondb.net/pokedex/ekans), [Pidgey](https://pokemondb.net/pokedex/pidgey) e [Geodude](https://pokemondb.net/pokedex/geodude). Pidgey também tem a taxa de captura declarada na ficha da espécie.

## Validação

Antes da publicação, executar casos reproduzidos, suíte unitária, lint, tipos, compilação e CI; inspecionar Guia, busca, casos, campos vazios e registro de item no navegador. Os testes de intervenção cobrem permissão, momento errado, repetição, bloqueio da captura e preservação de HP, PP e da ação do Pokémon.

A observação com crianças e grupos em mesa continua necessária. A integração antiga da Netlify é uma pendência externa já registrada em AUTOMACAO.md; Vercel permanece a hospedagem vigente.
