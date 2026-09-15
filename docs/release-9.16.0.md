# MyOwnDex 9.16.0

Atualização de apresentação e usabilidade sobre a versão 9.15.0 publicada.

- Sistema visual compartilhado pelas quatro áreas: navegação de aparelho de aventura, superfícies legíveis, cartões de Pokémon, hierarquia de texto e temas claro/escuro.
- Navegação inferior em telas pequenas, área segura de PWA, campos de 16 px no celular e respeito a movimento reduzido.
- Pokédex com favoritos salvos no aparelho, filtro, ordenação e busca por números com zeros, acentos, pontuação e símbolos de gênero.
- Histórico real do navegador: Voltar/Avançar e links diretos preservam o convite da aventura.
- Importação por Link Cable disponível mesmo sem nenhuma Box.
- Nomes compostos preservados na ficha. Consulta em carregamento pode ser cancelada. Respostas tardias não substituem uma forma recém-selecionada.
- RNG compartilhado, protocolo 2, idempotência, auditoria, papéis Narrador/Jogador, regras e migrações permanecem na implementação da 9.15.0.

## Validação

156 testes unitários, ESLint e TypeScript passaram. Dependências instaladas com o lockfile existente, sem alteração de versões. Teste de contraste cobre texto principal, secundário, seleção e botões de ambos os temas. Navegador: menu de aventura, Pokédex, favoritos, busca numérica, histórico e importação com PC vazio. O build e o teste de HTML renderizado também são exigidos pelo instalador.

A checagem visual é representativa, não uma certificação de todos os aparelhos/navegadores. Não foi feita nova auditoria completa de regras ou RNG nesta atualização.

## Linux

O instalador cria um checkout separado em `~/MyOwnDex-9.16.0`, mantendo checkouts anteriores intactos. A fonte completa e seu histórico acompanham o pacote. Ele executa validação antes de publicar a branch de atualização e `main`, sempre por fast-forward. Para a publicação, use a autenticação GitHub já configurada no Linux. Se o remoto divergir ou contiver trabalho mais novo, ele preserva esse trabalho.

Para repetir dentro do checkout: `bash scripts/validate-and-publish.sh`.

Somente validar: `bash scripts/validate-and-publish.sh --validate-only`.

O domínio Vercel continua encaminhando para o mesmo runtime Sites/Cloudflare. A fonte da interface não é publicada como uma aplicação estática separada: a API e o RNG continuam no servidor existente.
