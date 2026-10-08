# Direção artística — revisão 2.0.18

## Marca

A decisão mais recente substitui integralmente a RotomDex v101. A v103 é uma nova mascote própria do MyOwnDex, com silhueta legível, rosto expressivo e cores vibrantes. Um único master gera todos os formatos. Cabeçalho, carregamento e favicon mantêm transparência; Apple, instalação e compartilhamento recebem o fundo creme quando a plataforma exige uma imagem opaca. Não usar marcas antigas como alternativa ativa.

## Carregamento

Mostrar apenas a marca e um pequeno indicador de progresso. Nome e versão não precisam ser repetidos, e um segundo Pokémon decorativo não acompanha a marca. O estado continua identificado para leitores de tela. Ao carregar uma área dentro do jogo, a caixa é compacta; não cria uma segunda altura de tela abaixo do cabeçalho. O indicador respeita movimento reduzido.

## Pokémon vivos

Os Pokémon usam animações reais da identidade exibida, sem trocar uma variante pelo original para conseguir movimento. Toedscool e Scovillain usam seus próprios quadros animados. A preferência por movimento reduzido e a recuperação após falha de rede continuam acessíveis. A escala oficial comprimida, a transparência e a ancoragem na base permanecem. Fontes, créditos e comparação de quadros ficam registrados em `public/sprites/native/`. A disponibilidade por identidade está em `src/data/native-sprite-coverage.json`; a auditoria inclui recursos técnicos que não aparecem separados na lista principal.

## Formas e aparências

O botão se chama **Separar variantes**. A lista mantém a política aprovada: diferenças cosméticas e formas intercambiáveis ficam dentro da entrada. A ficha oferece uma escolha compacta de aparência, incluindo letras de Unown, mantos de Burmy, padrões de Vivillon e combinações de Alcremie. O Gerador também permite escolher uma aparência quando um Pokémon específico é selecionado, sem mudar as chances do sorteio. Tipos, aparência e identidade acompanham a ficha ao guardar, compartilhar e reabrir as Boxes.

## Continuidade

As 40 regras, contas, Boxes, aventuras, progresso e cálculos permanecem compatíveis. Esta revisão altera a marca, o carregamento, a consulta de aparências e a disponibilidade das animações. Os documentos de versões anteriores são históricos; esta decisão prevalece sobre a aprovação anterior da v101.
