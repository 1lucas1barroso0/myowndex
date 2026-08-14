# MyOwnDex

MyOwnDex reúne Pokédex, PC do Bill, criação de equipes, Guia do Treinador e uma Central da Aventura conectada para Narrador e Jogadores.

A voz da interface segue o guia em
[`docs/voice-and-terminology.md`](docs/voice-and-terminology.md), que centraliza
os termos fixos, a concordância e o tom usado em toda a jornada.

## Experiência

- Pokédex responsiva com espécies, formas, atributos, tipos, movimentos, habilidades e evolução.
- Boxes locais com salvamento automático, exportação de uma equipe inteira ou de Pokémon escolhidos, importação com prévia e destino selecionável e restauração após exclusões.
- Fichas que mantêm forma, habilidade, tipo Tera, atributos, HP, PP, XP e sugestões do jogo sempre em dia.
- Central da Aventura persistente com papéis separados, convite único que já abre a aventura correta, campo 2D, iniciativa, conversa, áudio e progresso integrado às Boxes.
- Assistente Rotom que resolve disputa, precisão, golpe crítico, STAB, tipos, limite de dano, PP, cura, recuo, condições, estágios e famílias de movimentos excepcionais.
- Mecânicas próprias de Ditto, Smeargle, Zorua e Zoroark: Transform/Imposter preservam a ficha real, Sketch e Mimic distinguem aprendizado permanente de cópia temporária e Illusion separa identidade pública de identidade verdadeira.
- Painel de exceções que identifica automação integral, resolução guiada e decisão narrativa para formas, habilidades e movimentos cuja regra depende do contexto da cena.
- Uso offline para a interface e os dados da Pokédex já consultados; APIs privadas da aventura nunca entram no cache.

O MyOwnDex sugere e calcula o que puder, sem tirar a liberdade de registrar escolhas próprias da aventura.

## Arquitetura

- React 19 e Vinext/Vite na interface.
- PokéAPI com cache em memória e Cache Storage para dados oficiais.
- Cloudflare D1 para aventuras, participantes e acontecimentos.
- Cloudflare R2 para trilhas compartilhadas.
- Estado local versionado para Boxes e preferências do aparelho.

## Publicação oficial

- `https://myowndex.vercel.app` é o endereço público e permanece visível durante toda a navegação.
- A Vercel encaminha interface, PWA e APIs para o mesmo runtime validado, sem copiar ou fragmentar dados.
- Aventuras, participantes e chamadas continuam isolados no D1; trilhas continuam no R2.
- O gateway não armazena respostas privadas e preserva a permissão de microfone no domínio oficial.
- A arquitetura usa apenas os recursos gratuitos já vinculados ao projeto; nenhum segredo é salvo no repositório.

O arquivo `vercel.json` é a fonte única da integração do domínio. A validação automatizada impede que o gateway seja publicado sem o encaminhamento completo ou com cache em APIs privadas.

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
npx tsc --noEmit --incremental false
npm run build
```

As regras canônicas do sistema ficam em `src/core/rpgRules.js` e são apresentadas integralmente no Guia do Treinador dentro do próprio MyOwnDex.
