# Refino de apresentação11.5

A atualização parte da11.4 publicada em `4f1be7ad640e93831b38045cc7a7057be2fd7e16` (PR#29). Conserva o código válido e não reinicia a direção artística. A estrutura continua com a clareza de Sword/Shield e detalhes da linguagem2D.

- Cabeçalho: navegação, ferramentas e preferências em grupos distintos; dados com acento dourado de ação, diferente da seleção escura de navegação. Modos e aparência continuam disponíveis, com rótulos e navegação por teclado.
- Pokédex: atributos com rótulos legíveis e valores tabulares; informações do perfil agrupadas; habilidades, itens e evolução coordenados nos dois temas. O nome do movimento ocupa o primeiro plano; o método de aprendizado aparece como informação secundária, sem falsa aparência de botão.
- PC: título/capacidade agrupados; retrato e nível aproveitam o mesmo espaço no celular, mantendo a identidade inteira abaixo. Ações de remoção se distinguem das demais. Movimentos mantêm quatro posições e identificam o tipo; treinamento e atributos conservam seus campos e valores.
- Guia: a regra aberta fica identificável por um acento discreto. Conteúdo, busca, numeração e regras ficam preservados.

Não foram alterados motores, APIs de conta/sala, importação/exportação, cálculos ou persistência. Catálogos, nomes originais, EN/PT, referências por jogo, gerador, contas, recibos e regras dos PRs#20–#28 foram preservados.

## Verificação

331 testes aprovados, ESLint e TypeScript aprovados nesta rodada. O último ajuste removeu somente uma informação de tipo duplicada nos detalhes do editor e passou novamente pelo lint do componente. Os roteiros `browser-space.mjs` (140) e `browser-polish.mjs` (52) passaram em Chromium, nos dois temas e de320a1280/1440px, verificando glyphs, cortes, palavras partidas, campos, edição e persistência. Não registraram erro de JavaScript não tratado. O PC também passou oito combinações de viewport/tema com alvos de toque de44px ou mais; o cabeçalho foi conferido em320e390px.

O build de produção também passou. DistribuiçãoLinux, CI, Preview e produção serão registrados no STATUS externo após confirmação. A fonte não contém segredos. Artefatos11.4 anteriores ficam preservados. O instalador11.5 usa a base do PR#29 e continua com extração/validação/publicação e retomada segura.
