# MyOwnDex 10

Pokédex, PC do Bill, Guia do Treinador e Central da Aventura para Pokémon RPG. Aplicação independente, executada na própria Vercel com Next.js, React e regras em JavaScript. Não usa IA, autenticação externa ou encaminhamento para outra hospedagem.

## O que mudou

- Interface de console portátil: molduras de pixels, botões com relevo, cores vivas, tema noturno e fonte VT323 incluída no projeto.
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

Abra `http://localhost:3000`. Pokédex, PC, Guia e aventura local funcionam sem configurar banco. Boxes e preferências continuam salvas neste navegador; trocar de domínio ou aparelho não transfere o armazenamento local. Exporte as Boxes pelo Link Cable antes de trocar de domínio.

Para aventuras compartilhadas, copie `.env.example` para `.env.local` e configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Trilhas enviadas pelo narrador também precisam das variáveis S3 e de CORS. Consulte [docs/RUNTIME.md](docs/RUNTIME.md) para configuração completa, limites, TURN e migração.

**Aventuras antigas:** foram identificadas 7 salas no banco anterior. O pacote contém código, catálogo e sprites; os registros privados ficam no serviço original. Antes de substituir a produção, importe um backup SQLite completo no Turso. A consulta encontrou zero áudios cadastrados; se houver objetos no bucket antigo, preserve suas chaves ao copiá-los. Não publique backups ou credenciais no GitHub.

## Automatizar no Linux

O arquivo `myowndex-corrigido-linux.sh` inclui o projeto completo. Se você baixou esse instalador, execute `bash myowndex-corrigido-linux.sh` na pasta do download. Ele cria uma pasta nova na sua pasta pessoal, confere a integridade e inicia a preparação. Você não precisa extrair um ZIP ou TAR manualmente.

Se já extraiu o projeto, execute dentro dele:

```bash
bash preparar-linux.sh enviar
```

O comando instala as ferramentas ausentes em Ubuntu/Debian/Mint, prepara o Node.js, abre os logins necessários, executa testes, lint, verificação de tipos e build, envia um branch ao GitHub, abre um PR em rascunho e cria um Preview na Vercel. A instalação pode pedir sua senha do Linux; os logins precisam de sua autorização no navegador. Credenciais não são enviadas ao repositório.

Uma falha identifica a etapa interrompida e a pasta preservada. Copie as últimas linhas do terminal para investigar um erro de instalação, login, lint, tipos ou build.

O site atual continua disponível. Se o repositório evoluiu desde a versão-base, o script interrompe o envio para preservar as mudanças mais recentes. Consulte [docs/AUTOMACAO.md](docs/AUTOMACAO.md) para os modos de verificação, Preview e publicação.

Depois de configurar o banco independente e migrar as aventuras antigas, a publicação final é:

```bash
bash preparar-linux.sh publicar
```

Esse modo atualiza `main` e produção. Configure as variáveis do banco na Vercel em Production e Preview quando utilizar salas. A publicação não migra os dados do serviço anterior. A integração GitHub/Vercel também pode publicar automaticamente quando o PR for integrado em `main`.

## Arquitetura e fontes

- `app/`: aplicação Next.js e APIs de sala; `server/`: persistência, autorização e regras autoritativas.
- `src/core/`: regras RPG, cálculos, captura e armazenamento local. Os estilos RPG/Jogo/Hackmon continuam distintos; regras próprias do RPG não são apresentadas como regras oficiais de cartucho.
- `src/components/`: Pokédex, PC, aventura e Guia.
- [PokéAPI](https://pokeapi.co/), [dados das espécies](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv) e [sprites](https://github.com/PokeAPI/sprites) são as fontes do catálogo e das imagens.
- Fonte [VT323](https://github.com/google/fonts/tree/main/ofl/vt323), sob SIL Open Font License; licença incluída em `public/fonts/OFL.txt`.

Projeto de fãs, sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Sprites e personagens pertencem aos respectivos titulares.
