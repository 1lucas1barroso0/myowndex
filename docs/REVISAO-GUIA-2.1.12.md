# MyOwnDex 2.1.12 | Autonomia e casos explicados em 48 regras

## Problema identificado

A versão 2.1.11 passou a mostrar as regras e os procedimentos, mas os casos muitas vezes eram resumos. A pessoa via *qual operação existia* sem aprender tudo que precisava observar antes, durante e depois de uma ação: quem tem o movimento, como o aprendeu, o alvo válido, o que foi usado, quando se sorteia uma condição, como o dano é aplicado, o que acontece ao ser atingido e como o estado é atualizado.

A abertura mobile também ocupava espaço desnecessário com um botão grande para abrir o livro e um glossário em duas colunas muito alto.

## Diretrizes editoriais verificáveis

Uma regra deve funcionar fora do site e ser compreensível isoladamente, sem confundir o efeito oficial com a adaptação do RPG. A explicação completa deve ensinar:

1. **Quando:** evento concreto, momento correto e condições necessárias.
2. **Quem:** Pokémon ou Treinador que age; alvo, objeto, adversário, aliados e quem recebe o efeito.
3. **O quê:** espécie, forma e movimento permitido, seu tipo, poder, precisão, PP, aquisição e efeito, sempre que forem relevantes à aplicação.
4. **Como:** escolha e declaração, checagens, sorteios, cálculos e consequências em ordem. Número é sempre associado a um Pokémon, situação, nível ou regra legítima. Sem resultados genéricos inventados.
5. **Depois:** quanto HP/PP/item mudou, se a condição persiste, se o Pokémon ainda pode agir, qual anotação deve ser feita, e o que é um evento diferente.
6. **Por quê:** o princípio que justifica a mecânica e suas exceções, de forma natural e compreensível.

O Guia não pode usar como explicação essencial expressões como "veja na tela", "clique no painel", "o aplicativo faz a conta" ou "consulte o Diário". A automação é um serviço opcional. Regras originais, dados, cálculos e identidades dos Pokémon não são alterados por uma reescrita editorial.

Não introduzir jargão por jargão, atalhos confusos, comparações de resultados alternativos como se fossem eventos seguidos, números sem contexto, efeitos inventados, movimentos aprendidos na edição errada ou caixas coloridas que atrapalhem a leitura.

## Caso 6.2: verificação em duas camadas

**Fonte oficial de referência: Pokémon Scarlet/Violet.** Ekans aprende Poison Sting ao alcançar o nível 4. O golpe físico Poison possui Poder 15, precisão-base 100%, 35 PP e 30% de chance secundária de envenenar. A tentativa de acertar é diferente do sorteio de envenenamento. Um alvo protegido ou imune não recebe a condição.

**Caso concreto reproduzido no MyOwnDex:** Ekans e Pikachu no nível 5, Hardy, IVs 31 e EVs 0. O Pikachu tinha 3/3 HP, recebe o impacto legítimo de Poison Sting e fica com 2/3 HP; o envenenamento também ocorre. Depois que todos tiverem sua vez, no fim da rodada o veneno comum usa 1/8 do HP máximo: 3/8 de um ponto. Para reproduzir o sorteio em dados físicos, role um d8. Resultados 1, 2 ou 3 subtraem um HP. Resultados 4, 5, 6, 7 ou 8 subtraem zero nesta rodada. Os resultados **são alternativas** partindo do mesmo 2/3 HP, não perdas consecutivas. Em qualquer alternativa, Pikachu permanece envenenado.

Verificações externas:
- Ekans: [learnset Scarlet/Violet, nível 4](https://bulbapedia.bulbagarden.net/wiki/Ekans_(Pok%C3%A9mon))
- Poison Sting: [tipo, classe, Poder, precisão, PP e chance de veneno](https://pokemondb.net/move/poison-sting)
- Combusken: [Double Kick ao evoluir em Scarlet/Violet](https://pokemondb.net/pokedex/combusken/moves/9)
- Mimic: [efeito de cópia temporária](https://pokemondb.net/move/mimic)

## Alterações no produto

- Remover apenas o botão redundante "Ler o livro completo ou imprimir" do topo do Guia. A rota de leitura e impressão independente permanece disponível por URL direta, sem impor outra navegação.
- Compactar a introdução para uma explicação humana curta, três termos básicos numa faixa flexível e uma frase sobre turno e rodada.
- Manter pesquisa com rótulo visível.
- Adicionar explicação completa em cada uma das 48 regras: "Quando esta regra entra em ação?", "Quem faz o quê?", "O que fazer, em ordem?", "O que acontece depois?" e "Por que essa regra funciona assim?".
- Preservar o procedimento de mesa, o texto canônico integral e suas exceções, além das análises auditadas por casos e recursos opcionais.
- Reutilizar a mesma fonte de exemplos completos no livro imprimível e na busca.
- Validar automaticamente presença, cobertura, densidade explicativa, detalhamento do caso 6.2 e resultado da ficha auditada. Testar renderização em navegador e impressão.

## Preservação e escopo

Mudanças restritas a conteúdo editorial, layout, busca, versão/cache, testes e documentação. Não alterar o motor das regras, fichas, saves, contas, permissões, bancos de dados, fórmulas, movimentos, dados oficiais, mecânica dos itens, captura, XP ou balanceamento. Nenhuma mudança de armazém é necessária.

## Limites

Os testes automatizados podem confirmar que os 48 exemplos existem, aparecem em todos os suportes e não dependem de botões para ensinar os passos. A comprovação da compreensão por crianças e pessoas que nunca usaram o site exige uma sessão real com regras e fichas impressas. Registre separadamente essa pendência, sem declarar compreensão 100% comprovada pela CI.
