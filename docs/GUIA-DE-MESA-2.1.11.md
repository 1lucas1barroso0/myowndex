# MyOwnDex 2.1.11 — Livro de regras e autonomia na mesa

## O problema constatado

A versão 2.1.10 tinha 48 regras com cenas e casos auditados, mas a ficha aberta exibia principalmente introduções e cenas; boa parte do texto mecânico completo, mesmo já registrado na fonte de verdade `src/core/rpgRules.js`, não chegava à leitura normal. Alguns passos remetiam diretamente a botões ou resultados do site. Isso criava dependência indevida da interface em vez de ensinar o RPG como um livro de regras.

## O que muda

1. **Cada regra, ao ser aberta:** apresenta a ideia em linguagem simples, uma cena Pokémon identificável, dois passos para aplicação sem aplicativo, o texto mecânico integral e todas as exceções da fonte. A consulta ao programa e os casos reproduzidos continuam opcionais, não essenciais para entender a regra. A regra 3.4 preserva a proteção visual especial e também ganha o texto canônico completo.
2. **Introdução:** um único parágrafo orienta a leitura; cinco termos básicos, HP, PP, XP, turno e rodada, ficam em uma grade enxuta. A pesquisa traz sugestões e encontra também procedimentos de mesa e corpo completo das regras.
3. **Livro:** a página `/guia/livro` reúne as 48 regras na ordem canônica, com sumário, preparação da mesa, procedimentos manuais, texto integral, exceções, cenas e casos de teste numericamente reproduzidos. A ação **Imprimir ou salvar em PDF** usa a impressão nativa do navegador; a folha A4 tem margens e divisões de capítulos próprias. O conteúdo não depende da interface de combate, conta, dados online nem estado da aventura.
4. **Fonte única:** a fonte dos números e fórmulas continua `rpgRules.js`. Os procedimentos adicionais em `src/core/guidePaperSteps.js` ensinam a usar as regras sem simular valores genéricos. Os exemplos são os mesmos do Guia; casos auditados preservam preparação e resultados.
5. **Verificações:** um teste unitário garante um procedimento sem referências a botões para cada identificador da fonte, além da presença dos textos integrais na rota. A CI testa a versão impressa no navegador, com as 48 entradas em 320, 390, 768 e 1280 pixels e modo de impressão, antes de publicar.

## Sem confundir automação e regra

Uma mesa pode trabalhar com fichas preparadas, dados e anotações. Cada Pokémon ainda precisa ter seus dados próprios de espécie/forma/movimentos e suas descrições, assim como em outros RPGs a ficha traz atributos. Isso não exige executar o aplicativo: uma ficha impressa serve. Movimentos, habilidades, itens e formas específicas conservam a referência da edição escolhida; não são reescritos como se este livro fosse uma Pokédex integral.

A exigência de consistência vale para qualquer ação: narração e combinações antes da rolagem, fórmula e testes antes das consequências, anotação uma vez. Ao ensinar uma adaptação própria do RPG, não tratá-la como oficial de Pokémon.

## O que foi preservado

Nenhuma regra matemática, tabela de espécie, PP, golpe, habilidade, lógica de captura, XP, efeitos, formulário de conta, salvamento, sistema de sincronização ou combate foi alterada. O incremento de versão e cache do PWA não muda chaves de dados. A tela original do Guia e as ferramentas de cálculo continuam disponíveis.

## Evidências e pendências

- Testes unitários, lint, tipos, build, conferência de fontes e testes de navegador devem passar integralmente antes da publicação. Registrar resultados reais no PR, sem antecipá-los.
- A compreensão por crianças e a experiência de mesa impressa ainda exigem testes observacionais reais, além de cobertura automatizada.
- Não confundir a prévia `READY` com uma liberação da produção sem revisão do CI. A instalação antiga da Netlify continua uma integração externa distinta da hospedagem Vercel.
