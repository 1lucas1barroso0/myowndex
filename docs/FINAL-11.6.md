# Fechamento 11.6

Esta rodada parte do checkpoint 11.5 publicado (`6b8d8dad6238c91a8606c45f3b80e736b15b6f8a`) e mantém os dados, o PC, a sincronização, as aventuras, os idiomas e os motores dos PRs #20–#28.

## Regras e idiomas

- O Guia agora contém 40 regras distintas. A regra 6.5 separa Efeitos voláteis de Condições principais, reaproveitando literalmente Confusion e Hesitation que já existiam na regra 6.1. Nenhuma mecânica foi inventada ou alterada.
- O registro usa alternância natural entre `Ver tradução do registro em português` e `Ver registro original em inglês`. Nomes oficiais de Pokémon, movimentos, habilidades, itens, Nature e condições permanecem em inglês; títulos e instruções da interface seguem em português.
- A descrição original continua sendo a referência visível. Quando não há tradução oficial ou editorial verificada, a tela informa a ausência em vez de criar texto.

## Remoção segura

- Prévia do gerador: remover um parceiro ou limpar a prévia inteira, com confirmação; Box e exportações permanecem.
- Dados locais: apagar um recibo individual ou o histórico; remover parceiros e limpar o campo; HP, PP, turno e Boxes não são revertidos por essas ações.
- Diário: Narrador pode apagar entradas; jogador pode apagar as próprias. Limpar usa um corte de sequência para não apagar mensagens novas em uma repetição. Recibos autoritativos ficam ocultos, mas continuam idempotentes para retries e nunca reaplicam a ação.
- Conta: apagar cópias anteriores, cópias de contas desconectadas, a cópia local ao sair e a cópia local ao remover a conta. A remoção da cópia local usa época de invalidação para impedir que outra aba a recrie; o documento atual e os dados em outros dispositivos só são removidos quando a ação confirmada abrange esse destino.

## Validação

`npm test` passou com 349 testes; lint, TypeScript e build de produção passaram. Os navegadores confirmaram 40 regras, referências EN/PT, contas e remoções, sem erros, em 320, 390, 768 e 1280 px nos dois temas. O pacote Linux foi verificado com 12 checagens determinísticas.
