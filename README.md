# MyOwnDex

Pokédex, PC do Bill, Guia do Treinador e Central da Aventura para Pokémon RPG. Aplicação independente, executada na Vercel com Next.js, React e regras em JavaScript.

## Recursos

- Interface inspirada na clareza de Pokémon Sword/Shield e nos detalhes 2D de HGSS/BW/B2W2: espaço para respirar, cores por função, sprites e artwork no foco individual.
- Modos RPG/Jogos/Livre visíveis, separados das opções Claro/Escuro, e campos com rótulos persistentes. Registros, Boxes e edição reorganizam o conteúdo no celular, tablet e computador.
- Escolhas com nomes longos mantêm o texto legível. Formulários e iniciativa se organizam pela largura do painel; os controles de aparência ocupam um canto compacto do cabeçalho.
- Catálogo nacional de 1.025 espécies incluído. A lista normal permanece agrupada por número da National Dex; somente variantes não intercambiáveis que funcionam como Pokémon realmente distintos em mecânica e identidade podem ser reveladas separadamente. Formas trocáveis e diferenças apenas estéticas continuam dentro da entrada da espécie. Há 152 sprites locais (Kanto e Rotom), com sprites específicos de forma consultados quando disponíveis. A abertura da Pokédex não precisa esperar pela rede.
- Busca por nome, número e intervalos fechados ou abertos da National Dex, favoritos, geração, um ou dois tipos e variantes regionais. A nova segregação exige as duas condições: forma não intercambiável e identidade mecânica/narrativa própria; diferença apenas visual nunca basta.
- Boxes com até seis Pokémon e lista rolável, sem espaços vazios decorativos. Importação, compartilhamento, duplicação, exclusão e desfazer preservados.
- Registro da Pokédex, linha evolutiva e movimentos com cores por função, hierarquia de leitura e símbolos distintos. A ficha mantém navegação por teclado, abas com setas, retorno do foco e rolagem contínua no celular. Movimento respeita a preferência de redução de animações.
- Alternância EN/PT no registro com textos incluídos no projeto, sem tradução por IA. Nomes próprios permanecem no original; fontes e cobertura dos textos em português estão em [docs/VALIDACAO.md](docs/VALIDACAO.md).
- Guia com 40 regras individuais expansíveis, busca e destaque para a proteção contra hit kill. Pokémon, itens, movimentos e habilidades mantêm seus nomes originais em inglês; valores calculados seguem os arredondamentos das regras. A leitura segue os padrões responsivos do Fate Gameplay Toolkit.
- Telas grandes carregadas sob demanda; service worker nunca guarda APIs privadas nem respostas RSC.
- Cache público limitado a 256 respostas de catálogo e 500 assets regeneráveis, hidratação com quatro tarefas simultâneas e salvamento agrupado. Boxes mantêm seus dados e formato de armazenamento.
- A Vercel executa páginas e APIs diretamente. Aventuras compartilhadas usam banco Turso sob seu controle.

## Rodar no Linux

Use Node.js 24 LTS (mínimo 22.18), npm e Git.

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`. Pokédex, PC, Guia e aventura local funcionam sem configurar banco. Boxes e preferências ficam salvas neste navegador e dispositivo. Exporte suas Boxes pelo Link Cable para transferi-las a outro navegador ou domínio.

Para aventuras compartilhadas, copie `.env.example` para `.env.local` e configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Consulte [docs/RUNTIME.md](docs/RUNTIME.md) para configuração e limites. As salas da instalação atual usam Turso; a atualização não depende de migrar o serviço antigo.

## Atualizar pelo Linux

Baixe `myowndex-v2.0-linux.sh`, abra o terminal na pasta do download e execute:

```bash
bash myowndex-v2.0-linux.sh
```

O arquivo inclui o projeto completo. Reaproveita os seus logins do GitHub e da Vercel e os bancos já configurados. Você não precisa criar outra conta Turso, copiar tokens, extrair um arquivo ZIP ou migrar salas.

O atualizador confere a integridade dos arquivos, valida o código e conduz a publicação. Uma falha identifica a etapa interrompida e preserva a pasta de trabalho. Credenciais ficam fora do repositório. Consulte [docs/AUTOMACAO.md](docs/AUTOMACAO.md) para o procedimento e a remoção da integração de hospedagem antiga.

A versão atual é **2.0.17** e esse número completo é exibido também nos créditos e na abertura, sempre a partir da mesma versão do pacote. A nova leva sucede a 11.6.6 e mantém as 40 regras, contas sincronizadas, Boxes, aventuras, encontros rápidos pelo gerador, referências EN/PT por jogo, XP inteira e Dados acessíveis em todos os módulos. A numeração da entrega é independente do formato dos dados. A 2.0.4 preserva as chaves de armazenamento e a compatibilidade com Boxes e códigos anteriores; os novos campos de identidade de forma são opcionais e não exigem migração. O estado vigente do projeto é sempre o conteúdo de `main`, com a versão declarada em `package.json`; documentos de entregas anteriores são registros históricos. O instalador executa testes, ESLint, verificação de tipos e build antes da publicação.

A preparação da rodada reúne a escolha de um movimento ou Outra ação para cada Pokémon antes da iniciativa. A ordem considera a prioridade efetiva, incluindo Prankster, Gale Wings e Triage, e mantém a ponderação proporcional pela Velocidade. As escolhas ficam confirmadas até o fim da rodada; novas escolhas e uma nova rolagem iniciam a seguinte. A intervenção do Treinador continua separada do turno do Pokémon.

A revisão 2.0.4 concluiu a base técnica de identificação de formas. A 2.0.5 concluiu os filtros e a clareza da Pokédex. A 2.0.6 fecha a fronteira de variantes: formas intercambiáveis e formas puramente estéticas permanecem agrupadas; a segregação só existe para variantes não intercambiáveis que funcionam como Pokémon distintos em mecânica e identidade. Veja `docs/VARIANTES-2.0.6.md`.

A revisão 2.0.7 reforça a Pokédex como ferramenta simples de usar: busca, favoritos, ordem, geração, tipos, região, variantes e intervalo são testados em conjunto. Estados antigos ou inválidos voltam a escolhas seguras, os textos visíveis dos filtros usam frases mais simples e a integridade da versão passa a ser verificada automaticamente. Veja `docs/FILTROS-E-CLAREZA-2.0.7.md`.

A revisão 2.0.8 reorganiza o Gerador para separar claramente **quem pode aparecer** de **como a ficha será montada**. Escolher um Pokémon específico não se mistura com filtros aleatórios; tipo, geração de estreia, região e lendários delimitam juntos o conjunto sorteável; natureza, Shiny e Hidden Ability só mudam a ficha. O sorteio é explicitamente feito por entrada da Pokédex e só depois escolhe uma forma elegível, impedindo que Pokémon com várias formas recebam chance extra. O termo “prévia” foi removido da interface do Gerador e substituído por encontro/resultado atual. Os controles de variantes da Pokédex também ficaram visual e verbalmente mais distintos. Veja `docs/GERADOR-2.0.8.md`.

A revisão 2.0.10 retira do MyOwnDex a reprodução de trilha sonora, efeitos sonoros e chamadas. Esses recursos ficam externos à aplicação e sob responsabilidade do Narrador e dos jogadores, reduzindo interface, código, APIs, armazenamento e configuração da Central da Aventura.

A revisão 2.0.11 consolida a camada responsiva e de desempenho: a Pokédex nunca esmaga cartões para manter colunas, o shell evita rolagens concorrentes, telas baixas/estreitas e landscape continuam utilizáveis e conteúdo fora da tela pode adiar pintura. Dados mantém sua entropia isolada da interface e da persistência: falhas de renderização, cache, banco ou armazenamento não escolhem, substituem nem repetem resultados.

A revisão 2.0.12 corrige o caso real de celulares em que o navegador/PWA expõe um viewport de layout amplo: a densidade móvel passa a considerar também o dispositivo de toque, mantendo dois cartões por linha em retrato, usando o espaço em paisagem e fazendo Dados ocupar praticamente toda a largura útil. Rolagens locais agora mostram o resultado antes de qualquer persistência ou sincronização; histórico, conta, cache e callbacks rodam depois e não criam cooldown nem bloqueiam a próxima rolagem.

A interface usa rótulos legíveis, foco visível, alvos confortáveis e contraste consistente nos dois temas. Fichas, gerador e diálogos têm navegação pelo teclado e retorno de foco. Ajuda adicional fica recolhida; consultas de catálogo permitem tentar novamente após falhas de conexão. O roteiro de acessibilidade e os demais testes de navegador estão descritos em [docs/VALIDACAO.md](docs/VALIDACAO.md).

## Arquitetura e fontes

- `app/`: aplicação Next.js e APIs de sala; `server/`: persistência, autorização e regras autoritativas.
- `src/core/`: regras RPG, cálculos, captura e armazenamento local. Os modos RPG/Jogos/Livre continuam distintos; regras próprias do RPG não são apresentadas como regras oficiais de cartucho.
- `src/components/`: Pokédex, PC, aventura e Guia.
- [PokéAPI](https://pokeapi.co/), [dados das espécies](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv) e [sprites](https://github.com/PokeAPI/sprites) são as fontes do catálogo e das imagens.
- Fonte [VT323](https://github.com/google/fonts/tree/main/ofl/vt323), sob SIL Open Font License; licença incluída em `public/fonts/OFL.txt`.
- [Sistema visual e referências](docs/icon-visual-system.md), [referências responsivas do Fate](docs/CLEAN-REFERENCIAS.md), [validação](docs/VALIDACAO.md) e [publicação](docs/AUTOMACAO.md).

Projeto de fãs, sem vínculo com Nintendo, Game Freak ou The Pokémon Company. Sprites e personagens pertencem aos respectivos titulares.


A revisão 2.0.13 faz a passagem de direção de arte do produto sem alterar o conteúdo aprovado: superfícies ganham profundidade, hierarquia e materiais consistentes; Aventura passa a ler como seleção de papéis de jogo, Dados como estação de rolagem, Conta como Cartão de Treinador e Pokédex como coleção. O tratamento preserva legibilidade, temas Claro/Escuro, responsividade, toque, teclado, movimento reduzido e alto contraste.


A revisão 2.0.14 troca o acabamento rígido da 2.0.13 por uma direção de arte mais alegre, fosca e acolhedora, mantendo a leitura de jogo sem transformar a interface em plástico. Todos os parceiros decorativos usam GIF local quando movimento é permitido e aparecem sem disco ou círculo de fundo; Aventura, Pokédex, PC, Guia, Dados, Gerador e Cartão de Treinador mantêm ao menos um Pokémon decorativo. O Cartão de Treinador remove o título redundante “Seu MyOwnDex”. A identidade do app foi redesenhada como diário de treinador/Pokédex/rota de aventura e passa a ser usada no cabeçalho, abertura, favicon e manifesto.

Rolagens locais passam a manter três garantias explícitas: o resultado aparece imediatamente, entra no histórico da sessão antes de qualquer gravação e ganha cópias redundantes em cache local e armazenamento durável sem que nenhuma delas bloqueie a próxima rolagem. A correção também fecha o erro que podia interromper a inclusão no histórico após a geração do resultado. A versão visível do rodapé deriva diretamente de `package.json`, evitando divergência com a versão publicada.


A revisão 2.0.15 é o passe de retenção e robustez visual. A identidade do produto passa a usar uma única RotomDex estilizada nas cores do MyOwnDex no cabeçalho, abertura, favicon, manifesto, atalhos e tela inicial. Parceiros decorativos usam exclusivamente os PNGs transparentes locais e recebem movimento leve por CSS, evitando os fundos opacos presentes nos GIFs antigos e respeitando redução de movimento. Cabeçalhos de Aventura, Pokédex, PC e Guia recuperam cor, ritmo e presença sem voltar ao acabamento plástico.

Na Pokédex, os cards deixam de usar régua, faixa ou marcador cinza atrás do Pokémon. O palco do sprite é transparente e a escala física não reduz o Pokémon dentro do card; cada criatura permanece inteira, centralizada e legível. A bateria de Dados cobre todos os dados oferecidos, dezenas de milhares de combinações locais, mais de um milhão de amostras criptográficas somadas aos testes existentes e uma matriz ampliada de viewports. Esses testes detectam regressões de viés, histórico, corte de sprites, overflow e bloqueio de rolagens, sem substituir a garantia estrutural do CSPRNG e da rejection sampling.


A revisão 2.0.17 fecha a etapa de hardening visual e probabilístico. Os masters transparentes dos parceiros são auditados em byte/PNG para exigir transparência e borda segura; a Pokédex não possui palco, régua ou fundo cinza para sprites e usa ancoragem inferior previsível. Cabeçalhos e ferramentas deixam margem positiva para o movimento dos parceiros em vez de depender de posicionamento negativo. A identidade visível continua usando exclusivamente a RotomDex v101.

A validação automática passa a executar também uma matriz Chromium real de celulares, tablets, landscape e desktop, cobrindo overflow, diálogos, parceiros decorativos, todos os sprites visíveis da Pokédex e rajadas de rolagens locais. O motor seguro também recebe auditoria de transições consecutivas de d6, além das distribuições já existentes, para detectar regressões de estado ou repetição artificial.
