# Filtros e clareza — MyOwnDex 2.0.7

A 2.0.7 reforça a Pokédex sem mudar as regras de variantes definidas na 2.0.6.

## Filtros

Busca, favoritos, ordenação, geração, tipos, regiões, variantes e faixa numérica continuam podendo ser usados juntos. A suíte agora testa uma matriz ampla dessas combinações, em vez de validar apenas exemplos isolados.

Estados antigos ou inválidos salvos pela interface também são tratados de modo seguro:

- geração desconhecida volta para Todas;
- ordem desconhecida volta para número crescente;
- regiões que não existem são ignoradas;
- nomes de tipos são normalizados antes do filtro;
- filtros regionais continuam encontrando a variante correta mesmo quando o modo de variantes veio de um estado antigo.

A regra de tipos continua simples: um tipo exige esse tipo; dois tipos exigem os dois.

## Texto para o jogador

A área de filtros usa frases curtas e diretas. Termos internos como “segregação”, “intercambiável” e “identidade mecânica/narrativa” não são necessários para usar a Pokédex e saíram das instruções visíveis.

A regra continua a mesma: variantes que funcionam como Pokémon diferentes podem ser mostradas separadamente; formas que o mesmo Pokémon troca e diferenças apenas de aparência continuam na mesma ficha.

## Integridade da versão

A versão 2.0.7 corrige três campos de versão de dependências no `package-lock.json` que não correspondiam aos pacotes realmente resolvidos. Um teste novo confere a partir de agora:

- `package.json`;
- a raiz do `package-lock.json`;
- versões dos pacotes resolvidos no lockfile;
- `APP_VERSION`;
- cache do service worker;
- README;
- `docs/CONTINUAR.md`.

Assim, uma atualização de versão não pode mais alterar silenciosamente a versão de uma dependência nem deixar partes do site apontando para releases diferentes.

## Fontes

Os pins versionados de PokéAPI e PokeMiners continuam atuais para os arquivos consumidos nesta rodada. O Pokémon Showdown possui uma mudança posterior somente em `server/artemis/remote.ts`, fora dos arquivos usados pelo MyOwnDex. O comando `npm run freshness` continua sendo a verificação obrigatória antes de chamar os dados de atuais.
