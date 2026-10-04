# MyOwnDex 2.0 — registro da nova leva

Versão interna 2.0.0, apresentada como 2.0. A fase anterior terminou na 11.6.6. Esta entrega parte da main publicada após o PR #42, `d1c7d0072cc48e489197980f977afc8b32c17e27`; esse SHA registra a base da revisão, não define o estado vigente do projeto.

## Apresentação

O Gerador não anuncia que chegaram parceiros. Os Pokémon gerados aparecem como um encontro, com seleção, edição, exportação e salvamento disponíveis. O sucesso normal não cria um aviso redundante; geração parcial, conflitos e falhas continuam explicados.

O menu comum às quatro áreas usa emblemas, seleção clara e grandes áreas de cor. Mantém os mesmos destinos, nomes acessíveis e acesso global a Dados. Os créditos são opcionais e ficam no fluxo da página, sem cobrir o jogo. O acabamento segue o macrodesign de Sword/Shield com os detalhes 2D existentes de HGSS/BW/B2W2. Não foram acrescentadas missões, recompensas ou mecânicas decorativas.

## Regras e dados preservados

A auditoria confirmou 40 IDs e títulos únicos em oito capítulos: Rolagens 4, Cálculos 5, Combate 7, Treinador 4, Criação 4, Condições 5, Habilidades/Itens/Formas 6 e Condução 5. Os 38 arquivos de core, dados e servidor auditados permanecem idênticos à base publicada.

XP inteira arredondada para baixo, demais arredondamentos, prioridade e Speed na iniciativa, nova rolagem a cada rodada, proteção contra hit kill e referências de Champions permanecem nos motores existentes. A apresentação não altera contas, sincronização, Boxes, aventuras, importação/exportação, EN/PT ou exclusões.

A nova numeração não modifica chaves de localStorage/IndexedDB, schemas nem formatos de conta. As dependências também não mudaram. O shell offline acompanha 2.0.0; a interface exibe 2.0. O instalador deriva nomes e metadados da versão e aceita o override legado sem sobrescrever o estado de outra entrega.

## Verificação

- 357 testes unitários; ESLint, tipos e build aprovados.
- 42 arquivos de referências externas atuais; nenhuma vulnerabilidade de produção no audit.
- 128 estados de acessibilidade, com WCAG 2/2.1 AA, leitura, teclado, foco, contraste, zoom e movimento reduzido: nenhum achado, texto pequeno, alvo pequeno ou erro JavaScript nas amostras.
- 99 cenários responsivos, 26 do Gerador e 11 de turnos na versão compilada.
- 62 verificações de contas, incluindo dois dispositivos, sincronização, isolamento, recuperação e exclusão.
- 7 verificações de exclusões pessoais, incluindo confirmação, cancelamento, recarga e sincronização entre abas.
- Créditos operáveis com Enter nos dois temas; menu sem cortes em 320, 390 e 1440 px; geração sem mensagem de parceria ou aviso redundante.

Os testes de conta usam somente o banco local de QA. A entrega só deve ser considerada publicada após CI aprovado e confirmação do commit correspondente na Vercel e no domínio principal. As instruções operacionais vigentes estão em CONTINUAR.md e AUTOMACAO.md.
