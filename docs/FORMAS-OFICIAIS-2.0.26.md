# Mecânicas oficiais e identidade das formas — MyOwnDex 2.0.26

## Implementado, verificável e testado
- **Rayquaza**: Mega Rayquaza exige o movimento Dragon Ascent, não uma Mega Stone; Z-Crystals impedem a transformação. Mega Evolução continua limitada a uma por treinador/batalha como as demais, com os mesmos comandos de ativação, atributos e reversão.
- **Kyogre e Groudon**: Reversão Primitiva exige Blue Orb ou Red Orb, respectivamente, mantém HP, usa tipos/atributos/habilidade da forma e **não consome** a Mega Evolução de um aliado. A forma reverte ao sair do campo e o Narrador pode encerrá-la explicitamente; novas ativações são possíveis na mesma batalha. Neste RPG a ativação é **guiada pelo Narrador**, não automática ao entrar no campo; habilidades de clima dependem das regras e controles da cena.
- **Necrozma**: somente Dusk Mane (10155) e Dawn Wings (10156) segurando Ultranecrozium Z podem se tornar Ultra Necrozma (10157). Ultra Burst consome a ativação até a próxima batalha; o Z-Move próprio de Photon Geyser não fica disponível antes da rodada seguinte. O form snapshot restaura a forma de fusão correta.
- **Eternatus**: Eternamax continua um estado de chefe narrado, não um Dynamax acessível livremente ao treinador.
- As fontes 2D pré-existentes, versões anteriores e dados dos usuários permanecem intactos. O programa usa dados locais verificáveis dos quatro perfis de forma, inclusive offline.

## O que o projeto ainda não deve afirmar
O catálogo de formas reconhece diferenças de espécie e aparência, mas **isso não prova automação de todos os gatilhos de forma e habilidades dos jogos oficiais**. Terapagos (Tera Shift/Stellar), o conjunto de Megaevoluções introduzidas em Legends: Z-A e Mega Dimension, transformações por habilidade ou condições individuais, efeitos de clima primal e formas dependentes de item ou fusão devem ser auditados separadamente por disponibilidade de sprites 2D exatos, gatilhos, dados de atributos e restrições de cada jogo. Não preencher essas lacunas com forma, sprite, transformação ou habilidade de outra espécie. Não afirmar cobertura integral antes dos testes.

## Fontes de referência verificadas (consultadas em 11/10/2026)
- https://bulbapedia.bulbagarden.net/wiki/Mega_Evolution
- https://bulbapedia.bulbagarden.net/wiki/Rayquaza_(Pok%C3%A9mon)
- https://bulbapedia.bulbagarden.net/wiki/Primal_Reversion
- https://bulbapedia.bulbagarden.net/wiki/Ultra_Burst
- https://bulbapedia.bulbagarden.net/wiki/Eternamax
- https://legends.pokemon.com/pt-br/news/mega_lucario_z
- https://www.pokemon.com/br/pokedex/terapagos

Arquivos do código: src/core/battleGimmicks.js, src/components/Room/BattleGimmickPanel.jsx, tests/battle-gimmicks.unit.test.mjs, tests/browser-gimmicks-phases.mjs.
