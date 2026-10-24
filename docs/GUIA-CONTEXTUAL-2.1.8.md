# Guia do Treinador — clareza e fidelidade (2.1.8)

O que motivou a revisão: mesmo na 2.1.7, a regra 6.2 podia expor cálculos longos sem explicar qual Pokémon foi afetado por qual movimento, quando o efeito apareceu e o que o jogador deveria acompanhar. A abertura de detalhes não deve exigir leitura de matemática para entender a aventura.

## Critérios aplicados a todas as 48 regras

- **Antes dos cálculos:** indicar quem participa, qual Pokémon age, que movimento, habilidade, item ou ação ele usa, contra quem ou o quê, em que momento e o que pode acontecer. Não inventar um oponente quando a regra diz respeito apenas ao próprio Pokémon ou a uma ação do Treinador.
- **Fatos verificáveis:** quando o movimento muda de jogo ou geração, citar o contexto. Em Scarlet/Violet, Ekans aprende Poison Sting no nível 4; o golpe pode envenenar, mas não garante isso. Jigglypuff aprende Sing nesse jogo; o acerto é necessário para adormecer Eevee. Golbat conhece Supersonic em gerações que o disponibilizam, mas não é obtido normalmente em Scarlet/Violet.
- **Sem confundir etapas:** acertar não é o mesmo que causar uma condição. Envenenar não é o mesmo que tirar HP imediatamente. O dano contínuo acontece no momento definido pela regra. Ver a prévia ou o Diário não repete uma ação.
- **Respeitar o RPG:** disputas narrativas com cordas, pontes e resgates são decisões de mesa, não novos efeitos oficiais para Vine Whip ou para espécies envolvidas. A proteção que mantém 1 HP é uma adaptação do MyOwnDex, não uma propriedade universal de todo Pokémon nos jogos.
- **Sem esconder limites:** se uma ação gasta PP, Poké Ball, a vez ou uma intervenção, isso precisa ficar claro. Imunidades, falha de acerto, requisitos para captura e impossibilidades de uso não devem ser transformados em acertos ou ações gratuitas.
- **Contas para conferência:** o Guia apresenta primeiro a explicação e uma cena. “Entenda melhor” mostra uma condição concreta; “Conferir números e exceções” mantém os textos completos para quem precisar acompanhar probabilidades, arredondamentos e limites.
- **Boa leitura:** blocos curtos, rótulos naturais, foco por teclado, busca que só expande a camada necessária, temas Claro e Escuro, largura responsiva e nenhuma informação essencial cortada.

## Exemplo rastreável: veneno e HP (6.2)

Em Scarlet/Violet, Ekans usa Poison Sting contra Pikachu. É preciso acertar o movimento e acontecer o envenenamento. Quando o efeito de veneno chega ao momento de causar dano no RPG, o aplicativo consulta o HP. Em casos de dano muito pequeno, a perda de HP daquele instante pode ser 0, sem que Pikachu deixe de estar envenenado. A explicação integral de partes de HP, sorteios e arredondamentos continua disponível para quem deseja conferir a conta; ela não é necessária para jogar.

## Verificações automáticas

Preservar 48 IDs e títulos; garantir 48 cenas e 48 esclarecimentos, termos de busca com e sem acento, condições específicas e acesso aos números por teclado. Pesquisas simples não devem abrir as contas. Uma pesquisa que só aparece na explicação numérica deve revelar a camada pertinente. Validar também os casos de veneno, sono, confusão, aprendizagem de movimentos e regressões do aplicativo. Não alterar o motor de batalha, as fontes dos Pokémon, os dados salvos ou as fórmulas.

## Referências

- [W3C WAI — Use Clear and Understandable Content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/)
- [W3C WAI — Use Clear Step-by-step Instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/)
- [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Pokémon Database — Ekans, Scarlet/Violet](https://pokemondb.net/pokedex/ekans/moves/9)
- [Pokémon Database — Poison Sting e seus efeitos](https://pokemondb.net/move/poison-sting)
- [Pokémon Database — Sing e seus aprendizes](https://pokemondb.net/move/sing)
- [Pokémon Database — Golbat, jogos e repertórios](https://pokemondb.net/pokedex/golbat/moves/9)
- [Revisão anterior de exemplos 2.1.5](EXEMPLOS-LEGITIMOS-2.1.5.md)
- [Regras e fontes de verdade do RPG](POLIMENTO-REGRAS-INTEIRAS.md)

A aprovação do CI demonstra conformidade técnica dos testes executados. Só uma observação com crianças e fãs pode verificar se a redação atingiu plenamente seu público.
