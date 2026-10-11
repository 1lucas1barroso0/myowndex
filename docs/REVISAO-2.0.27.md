# Revisão 2.0.27: Megaevoluções, Terapagos, climas extremos e instalação como jogo

## Identidade das novas Megaevoluções
- 49 entradas técnicas distintas, de 10278 a 10326, correspondendo a 44 IDs de espécies e incluindo formas específicas de Meowstic, Magearna e Tatsugiri e as duas variantes de Raichu.
- A forma só é oferecida se o ID da forma original e o item coincidirem com os dados oficiais; exemplos restritos incluem Floette Eternal (10061), Zygarde Complete (10120), Magearna Original (10147), Tatsugiri Droopy/Stretchy (10258/10259), Meowstic Female (10025).
- Atributos, tipos, altura, sprites e habilidade somente quando presente na PokéAPI são carregados por registro local; habilidades ausentes na fonte não são inventadas. Os sprites 2D vêm do repositório PokeAPI/sprites com IDs próprios.
- A UI do Narrador usa dados locais para as formas, sem exigir API externa a cada ativação. A pré-condição Key Stone do treinador permanece contextual/narrada conforme o sistema da Aventura.

## Terapagos
- Tera Shift: Normal 1024 → Terastal 10276 ao entrar em campo; o estado base permite restaurar o original ao sair.
- Tera Shell: quando ativo e em HP cheio, reduz a efetividade do primeiro golpe ao equivalente pouco efetivo, sem ignorar proteção externa.
- Tera Stellar: 10276 → Stellar 10277 por Terastalização, com tipos de defesa preservados e a habilidade Teraform Zero.
- Teraform Zero remove clima e terreno existentes no momento da transformação; efeitos de clima aplicados depois podem voltar.
- Modo Stellar e suas regras de STAB foram representados na mecânica de dano existente, porém o rastreamento de consumo *uma vez por tipo* ao longo de uma batalha ainda deve ser auditado. Não divulgar como equivalência perfeita do combate de Scarlet/Violet.

## Climas extraordinários
- Primordial Sea: chuva extrema; movimentos Fire falham.
- Desolate Land: sol extremo; movimentos Water falham.
- Delta Stream: ventos fortes; fraquezas de Flying a Electric, Ice e Rock são atenuadas enquanto a habilidade atua.
- O clima especial deriva da presença de um Pokémon vivo com a habilidade ativa, se sobrepõe a clima normal e cessa ao desaparecer o portador. Cloud Nine / Air Lock neutralizam os efeitos de clima sem apagar necessariamente sua indicação.
- Os modificadores de chuva/sol comuns continuam aplicáveis onde pertinentes; não há contagem regressiva de três ou cinco turnos nos efeitos primordiais.

## Aplicativo instalado
- Mantém o ID e escopo existentes para não duplicar aplicativos em instalações anteriores.
- Manifesto com `display: standalone` e `display_override: [fullscreen, standalone]`: prioriza fullscreen onde suportado, recua para standalone em outras plataformas.
- Suporte a metadados Apple, ícone maskable, service worker de versão consistente, área segura no iOS e janela de instalação apenas no navegador, não no aplicativo.
- Instalar com o navegador que oferece PWA e abrir pelo ícone do aplicativo. Criar um atalho convencional não garante janela separada.
- Não é possível remover programaticamente controles de sistema, a barra de status do iOS ou os controles nativos da janela em qualquer dispositivo. Links externos podem abrir no navegador. Esses limites são impostos pelo sistema e pelo navegador.

## Fontes verificáveis
- PokéAPI (IDs, dados por forma): https://github.com/PokeAPI/pokeapi/tree/c80757193bd0889054e36f4209762360bdaa4b95/data/v2/csv
- Sprites 2D: https://github.com/PokeAPI/sprites/tree/d72f64eb74912747cb5c5579061ced4842ba0a98/sprites/pokemon
- Mega Stones de Legends: Z-A e Mega Dimension: https://www.serebii.net/legendsz-a/newitems.shtml
- Site oficial Z-A: https://legends.pokemon.com/pt-br/mega-pokemon
- Suporte a PWA independente: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app
- Display fullscreen, standalone e fallback: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
- Apple standalone: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html

Testes: `tests/za-terapagos-weather-install.unit.test.mjs` e suíte geral. Manter os dados legados intactos.
