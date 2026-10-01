# MyOwnDex

Pokédex, PC do Bill, Guia do Treinador e Central da Aventura para Pokémon RPG. Aplicação independente, executada na Vercel com Next.js, React e regras em JavaScript.

## Recursos

- Interface inspirada nos jogos de Pokémon: sprites, painéis de pixels, cores por função, tema noturno e fonte VT323 incluída no projeto.
- Catálogo nacional de 1.025 espécies incluído; 152 sprites locais (Kanto e Rotom). A abertura da Pokédex não precisa esperar pela rede.
- Busca por nome/número, favoritos e filtro por geração de estreia. Detalhes, formas, habilidades e movimentos usam a PokéAPI, com cache.
- PC com seis slots visuais, mini-equipes nas Boxes, tipos e Shiny em destaque. Importação, compartilhamento, duplicação, exclusão e desfazer preservados.
- Registro da Pokédex acessível por teclado, abas com setas, retorno do foco e rolagem contínua no celular. Movimento respeita a preferência de redução de animações.
- Telas grandes carregadas sob demanda; service worker nunca guarda APIs privadas nem respostas RSC.
- A Vercel executa páginas e APIs diretamente. Salas usam banco Turso sob seu controle; áudio compartilhado usa armazenamento S3/R2 sob seu controle, com upload direto assinado.

## Rodar no Linux

Use Node.js 24 LTS (mínimo 22.18), npm e Git.

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`. Pokédex, PC, Guia e aventura local funcionam sem configurar banco. Boxes e preferências ficam salvas neste navegador e dispositivo. Exporte suas Boxes pelo Link Cable para transferi-las a outro navegador ou domínio.

Para aventuras compartilhadas, copie `.env.example` para `.env.local` e configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Trilhas enviadas pelo narrador também precisam das variáveis S3 e de CORS. Consulte [docs/RUNTIME.md](docs/RUNTIME.md) para configuração, limites e TURN. As salas da instalação atual usam Turso; a atualização não depende de migrar o serviço antigo.

## Atualizar pelo Linux

Baixe `myowndex-v11-linux.sh`, abra o terminal na pasta do download e execute:

```bash
bash myowndex-v11-linux.sh
```

O arquivo inclui o projeto completo. Reaproveita os seus logins do GitHub e da Vercel e os bancos já configurados. Você não precisa criar outra conta Turso, copiar tokens, extrair um arquivo ZIP ou migrar salas.

O atualizador confere a integridade dos arquivos, valida o código e conduz a publicação. Uma falha identifica a etapa interrompida e preserva a pasta de trabalho. Credenciais ficam fora do repositório. Consulte [docs/AUTOMACAO.md](docs/AUTOMACAO.md) para o procedimento e a remoção da integração de hospedagem antiga.

## Arquitetura e fontes

- `app/`: aplicação Next.js e APIs de sala; `server/`: persistência, autorização e regras autoritativas.
- `src/core/`: regras RPG, cálculos, captura e armazenamento local. Os estilos RPG/Jogo/Hackmon continuam distintos; regras próprias do RPG não são apresentadas como regras oficiais de cartucho.
- `src/components/`: Pokédex, PC, aventura e Guia.
- [PokéAPI](https://pokeapi.co/), [dados das espécies](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv) e [sprites](https://github.com/PokeAPI/sprites) são as fontes do catálogo e das imagens.
- Fonte [VT323](https://github.com/google/fonts/tree/main/ofl/vt323), sob SIL Open Font License; licença incluída em `public/fonts/OFL.txt`.
- [Sistema visual e referências](docs/icon-visual-system.md), [validação](docs/VALIDACAO.md) e [publicação](docs/AUTOMACAO.md).

Projeto de fãs, sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Sprites e personagens pertencem aos respectivos titulares.
