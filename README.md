# MyOwnDex

MyOwnDex reúne Pokédex, PC do Bill, criação de equipes, Guia do Treinador e uma Central da Aventura conectada para Narrador e Jogadores.

A voz da interface segue o guia em
[`docs/voice-and-terminology.md`](docs/voice-and-terminology.md), que centraliza
os termos fixos, a concordância e o tom usado em toda a jornada.

## Experiência

- Pokédex responsiva com espécies, formas, atributos, tipos, movimentos, habilidades e evolução.
- Boxes locais com salvamento automático, compartilhamento sem duplicatas e restauração após exclusões.
- Fichas que mantêm forma, habilidade, tipo Tera, atributos, HP, PP, XP e sugestões do jogo sempre em dia.
- Central da Aventura persistente com papéis separados, convites, campo 2D, iniciativa, conversa, áudio e progresso integrado às Boxes.
- Assistente Rotom que resolve disputa, precisão, golpe crítico, STAB, tipos, limite de dano, PP, cura, recuo, condições e estágios.
- Uso offline para a interface e os dados da Pokédex já consultados; APIs privadas da aventura nunca entram no cache.

O MyOwnDex sugere e calcula o que puder, sem tirar a liberdade de registrar escolhas próprias da aventura.

## Arquitetura

- React 19 e Vinext/Vite na interface.
- PokéAPI com cache em memória e Cache Storage para dados oficiais.
- Cloudflare D1 para aventuras, participantes e acontecimentos.
- Cloudflare R2 para trilhas compartilhadas.
- Estado local versionado para Boxes e preferências do aparelho.

O núcleo de regras fica em `src/core/`; componentes de Pokédex, PC e Central da Aventura ficam em `src/components/`; rotas persistentes ficam em `app/api/rooms/`.

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
