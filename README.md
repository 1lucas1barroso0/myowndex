# MyOwnDex

MyOwnDex reúne Pokédex, PC do Bill, criação de equipes, regras e uma Sala RPG conectada para Narrador e Jogadores.

## Experiência

- Pokédex responsiva com espécies, formas, atributos, tipagens, Movimentos, habilidades e evolução.
- Boxes locais com salvamento automático, compartilhamento sem duplicatas e restauração após exclusões.
- Fichas reativas: forma, habilidade, Tera, atributos, HP, PP, XP e sugestões legais acompanham o Pokémon e o jogo selecionado.
- Sala RPG persistente com papéis separados, convites, campo 2D, iniciativa, chat, áudio, progresso e sincronização com as Boxes.
- Assistente de Movimento que resolve disputa, precisão, crítico, STAB, tipagem, teto de dano, PP, cura, recuo, condições e estágios.
- Modo offline para a interface e os dados da Pokédex já consultados; APIs privadas da sala nunca entram no cache.

Defaults oficiais são automatizados. Campos manuais continuam livres e são preservados como exceções narrativas.

## Arquitetura

- React 19 e Vinext/Vite na interface.
- PokéAPI com cache em memória e Cache Storage para dados oficiais.
- Cloudflare D1 para salas, participantes e acontecimentos.
- Cloudflare R2 para trilhas compartilhadas.
- Estado local versionado para Boxes e preferências do aparelho.

O núcleo de regras fica em `src/core/`; componentes de Pokédex, PC e Sala RPG ficam em `src/components/`; rotas persistentes ficam em `app/api/rooms/`.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm ci
npm run dev
```

Validações:

```bash
npm test
npm run lint
```

As regras canônicas do sistema são mantidas em [Guia do Treinador Pokémon](https://guia-do-treinador-pokemon.vercel.app/).
