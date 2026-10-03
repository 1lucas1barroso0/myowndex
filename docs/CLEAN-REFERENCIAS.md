# Referências observadas para a atualização 11.1

## Fate Gameplay Toolkit

Projeto consultado diretamente em 1 de outubro de 2026:

- Fonte: https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit
- Produção: https://fate-gameplay-toolkit.vercel.app

A consulta usou o código publicado e a Central de Regras no navegador real. A referência aqui é o comportamento responsivo e de leitura; a identidade visual Pokémon continua própria do MyOwnDex.

Padrões úteis encontrados:

- [fate-design.css, linha 245](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-design.css#L245): coluna de texto até 68 caracteres, fonte entre 17 e 19 px, entrelinha 1,85 e margens internas progressivas. Textos continuam legíveis quando a tela diminui.
- [fate-design.css, linha 224](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-design.css#L224) e [linha 402](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-design.css#L402): navegação lateral vira seletor de capítulos em telas estreitas. O conteúdo passa a ocupar uma coluna; não é reduzido para conservar o desenho do desktop.
- [fate-design.css, linha 139](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-design.css#L139): grids com `minmax(min(100%, 14rem), 1fr)` permitem que um campo ocupe a largura disponível mesmo abaixo de seu tamanho ideal.
- [fate-design.css, linha 88](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-design.css#L88): botões têm altura automática, texto que pode quebrar linha e tamanho mínimo para interação.
- [growing-textarea.tsx](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/components/growing-textarea.tsx): quando necessário, a altura de um texto editável é recalculada também ao mudar a largura, com `ResizeObserver`.
- [fate-functional.css, linha 48](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-functional.css#L48): dialogs usam limite baseado em `100dvh`, organização em coluna e conteúdo rolável com `min-height: 0`.
- [fate-design.css, linha 260](https://github.com/1lucas1barroso0/Fate-Gameplay-Toolkit/blob/main/app/fate-design.css#L260): exemplos e observações recebem recuo e borda discreta; parágrafos e tabelas continuam organizados por conteúdo, sem transformar cada sentença em um cartão.

Medições reais da Central de Regras publicada, com agent-browser e Chromium:

| Tela | Largura total do documento | Coluna de leitura | Fonte / entrelinha | Navegação |
| --- | --- | --- | --- | --- |
| 1280 px | 1280 px | 701 px | 17 / 31,45 px | Lateral |
| 390 px | 390 px | 357 px | 17 / 30,94 px | Seletor |
| 320 px | 320 px | 290 px | 17 / 30,94 px | Seletor |

Nenhum botão, input, textarea ou select visível ultrapassou horizontalmente a tela nessas medições. Essa verificação refere-se ao Fate; a verificação do MyOwnDex deve ser registrada separadamente.

## Armazenamento do MyOwnDex

Esta atualização preserva o formato e as chaves das Boxes (`myowndex_rotom_v4`), sua migração anterior, importação e exportação. Boxes não recebem vencimento nem limpeza automática. O catálogo persistido de cada parceiro guarda os sprites básicos, artwork oficial e animações Black/White utilizados, além dos atributos offline. URLs redundantes de gerações não utilizadas deixam de acompanhar cada ficha; movimentos, EVs, notas e demais dados do jogador permanecem. No ensaio com dados reais, 480 parceiros ocuparam 3,85 MiB UTF-16.

O cache regenerável agora tem limite de 256 respostas públicas da PokéAPI na memória e em Cache Storage, com recência de acesso. Requests simultâneas para a mesma URL continuam compartilhadas. Limpar o cache não permite que uma resposta antiga recrie entradas nem apague a request mais recente dessa URL.

O service worker limita imagens e arquivos regeneráveis a 500 entradas, preserva o shell offline separadamente e não guarda requests das salas. Sprites públicos usam CORS sem credenciais quando possível, evitando o custo de quota inflado de respostas opacas. Ao trocar de versão, somente caches antigos do próprio shell e dos assets MyOwnDex são removidos.

A hidratação das Boxes divide quatro tarefas simultâneas entre todos os chamadores. A ordem e as edições locais continuam preservadas, inclusive quando dados de catálogo não estão disponíveis.

`createScheduledSave` agrupa alterações rápidas, limita a espera e oferece flush síncrono. O dono do helper deve fazer flush em `pagehide`, ao ocultar a página e ao desmontar. Uma falha mantém a edição pendente em memória para nova tentativa e mantém o valor já persistido intacto.

Limite existente: editar Boxes simultaneamente em duas abas ainda segue a política anterior de última escrita do valor local. Este trabalho não introduz outra promessa de sincronização local entre abas. As aventuras compartilhadas continuam usando seu protocolo no servidor.

## Retomada 11.4: contas e encontros

Em 2 de outubro de 2026 consultamos também o código atual do Fate, especialmente `components/account-provider.tsx`, `lib/workspace-storage.ts`, `lib/workspace-sync.ts`, `lib/server/account-workspace.ts` e `STORAGE.md`. Reaproveitamos princípios de isolamento por identidade, confirmação de salvamento antes da troca, revisão no servidor e preservação de versões conflitantes. O MyOwnDex usa seu Turso existente e autenticação própria; não depende do banco Neon ou do provedor de autenticação do Fate. Contas agora reúnem edições independentes e oferecem cópias de recuperação, conforme CONTAS-E-SINCRONIZACAO.md. O visitante local conserva as chaves anteriores.

PokéroleDex foi consultado como inspiração para encontros rápidos, inspeção individual e envio dos parceiros ao armazenamento. Fontes e escolhas estão em GENERATOR-SOURCES.md. As regras de Pokérole não substituem as regras do MyOwnDex.

Memória e disco têm limites separados em bytes e quantidade de entradas. Referências públicas e imagens são descartáveis; Boxes são protegidas e não expiram. IndexedDB recebe snapshots duráveis; localStorage fornece o espelho imediato. Uma cópia antiga menor não prevalece sobre uma escrita nova confirmada no banco local, mesmo quando a quota impede atualizar metadados. A Box aberta é a única hidratada com dados completos; Boxes fechadas conservam dados compactos e todas as edições.
