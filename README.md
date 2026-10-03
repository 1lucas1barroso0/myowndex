# MyOwnDex

Pokédex, PC do Bill, Guia do Treinador e Central da Aventura para Pokémon RPG. Aplicação independente, executada na Vercel com Next.js, React e regras em JavaScript.

## Recursos

- Interface inspirada na clareza de Pokémon Sword/Shield e nos detalhes 2D de HGSS/BW/B2W2: espaço para respirar, cores por função, sprites e artwork no foco individual.
- Modos RPG/Jogos/Livre visíveis, separados das opções Claro/Escuro, e campos com rótulos persistentes. Registros, Boxes e edição reorganizam o conteúdo no celular, tablet e computador.
- Escolhas com nomes longos mantêm o texto legível. Formulários e iniciativa se organizam pela largura do painel; os controles de aparência ocupam um canto compacto do cabeçalho.
- Catálogo nacional de 1.025 espécies incluído; 152 sprites locais (Kanto e Rotom). A abertura da Pokédex não precisa esperar pela rede.
- Busca por nome/número, favoritos e filtro por geração de estreia. Detalhes, formas, habilidades e movimentos usam a PokéAPI, com cache.
- Boxes com até seis Pokémon, lista rolável e parceiros sem espaços vazios decorativos. Importação, compartilhamento, duplicação, exclusão e desfazer preservados.
- Registro da Pokédex, linha evolutiva e movimentos com cores por função, hierarquia de leitura e símbolos distintos. A ficha mantém navegação por teclado, abas com setas, retorno do foco e rolagem contínua no celular. Movimento respeita a preferência de redução de animações.
- Alternância EN/PT no registro com textos incluídos no projeto, sem tradução por IA. Nomes próprios permanecem no original; fontes e cobertura dos textos em português estão em [docs/VALIDACAO.md](docs/VALIDACAO.md).
- Guia com regras individuais expansíveis, busca e destaque para a proteção contra hit kill. Pokémon, itens, movimentos e habilidades mantêm seus nomes originais em inglês; valores calculados seguem os arredondamentos das regras. A leitura segue os padrões responsivos do Fate Gameplay Toolkit.
- Telas grandes carregadas sob demanda; service worker nunca guarda APIs privadas nem respostas RSC.
- Cache público limitado a 256 respostas de catálogo e 500 assets regeneráveis, hidratação com quatro tarefas simultâneas e salvamento agrupado. Boxes mantêm seus dados e formato de armazenamento.
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

Baixe `myowndex-v11.6-linux.sh`, abra o terminal na pasta do download e execute:

```bash
bash myowndex-v11.6-linux.sh
```

O arquivo inclui o projeto completo. Reaproveita os seus logins do GitHub e da Vercel e os bancos já configurados. Você não precisa criar outra conta Turso, copiar tokens, extrair um arquivo ZIP ou migrar salas.

O atualizador confere a integridade dos arquivos, valida o código e conduz a publicação. Uma falha identifica a etapa interrompida e preserva a pasta de trabalho. Credenciais ficam fora do repositório. Consulte [docs/AUTOMACAO.md](docs/AUTOMACAO.md) para o procedimento e a remoção da integração de hospedagem antiga.

A versão atual é **11.6.4**. O estado vigente do projeto é sempre o conteúdo de `main`, com a versão declarada em `package.json`; documentos de entregas anteriores são apenas registros históricos. A versão atual mantém contas sincronizadas, encontros rápidos pelo gerador, referências EN/PT por jogo, XP inteira, Dados acessíveis em todos os módulos e as regras preservadas dos PRs #20 a #28. O instalador executa testes, ESLint, verificação de tipos e build antes da publicação.

## Arquitetura e fontes

- `app/`: aplicação Next.js e APIs de sala; `server/`: persistência, autorização e regras autoritativas.
- `src/core/`: regras RPG, cálculos, captura e armazenamento local. Os modos RPG/Jogos/Livre continuam distintos; regras próprias do RPG não são apresentadas como regras oficiais de cartucho.
- `src/components/`: Pokédex, PC, aventura e Guia.
- [PokéAPI](https://pokeapi.co/), [dados das espécies](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv) e [sprites](https://github.com/PokeAPI/sprites) são as fontes do catálogo e das imagens.
- Fonte [VT323](https://github.com/google/fonts/tree/main/ofl/vt323), sob SIL Open Font License; licença incluída em `public/fonts/OFL.txt`.
- [Sistema visual e referências](docs/icon-visual-system.md), [referências responsivas do Fate](docs/CLEAN-REFERENCIAS.md), [validação](docs/VALIDACAO.md) e [publicação](docs/AUTOMACAO.md).

Projeto de fãs, sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Sprites e personagens pertencem aos respectivos titulares.
