# Registros EN/PT da Pokédex

O botão EN/PT apresenta original e português do mesmo registro. Os textos são arquivos locais carregados com a ficha; alternar idioma funciona offline após carregar a ficha e não usa chave, servidor de tradução, GPT ou IA.

A edição 11.3 cobre as 1.025 espécies da Pokédex Nacional. São 1.007 pares oficiais de Pokémon GO preservados no repositório PokeMiners/pogo_assets e 18 originais de Pokémon Scarlet com tradução editorial MyOwnDex. Há um par oficial adicional de Gimmighoul Roaming Form; Chest Form recebe sua descrição correspondente de Scarlet. O texto de uma forma não é apresentado como se descrevesse a outra.

Os recursos GO vêm de English/BrazilianPortuguese de Latest APK/Remote, usando a mesma chave nos dois idiomas. Os nove casos sem chave base usam a forma padrão confirmada nos dados PokeAPI. Scarlet usa language_id 9/version scarlet do CSV original e sua tradução revisada. Nunca misturar original antigo Red/Blue com português de GO: a origem pode conter outra descrição.

A UI identifica Pokémon GO ou Pokémon Scarlet e, no português editorial, “Tradução MyOwnDex”. Pokémon, itens, movimentos e demais nomes próprios permanecem em inglês. Dados brutos oficiais ficam intactos; a apresentação normaliza espaços, proporções e nomes como Poké Ball, Winged King e Iron Serpent. As 18 traduções editoriais não são apresentadas como localização oficial brasileira.

Fontes, commits, URLs, SHA-256, direitos e escolhas de forma estão em [pokedex-entries-provenance.json](pokedex-entries-provenance.json). Textos Pokémon GO pertencem a The Pokémon Company/Niantic; PokeMiners disponibiliza assets para uso educacional, sem licença independente permissiva para esses textos. O banco PokeAPI usa BSD-3-Clause; direitos dos textos Pokémon continuam com seus titulares. MyOwnDex é um projeto de fãs.

Regeração opcional durante desenvolvimento:

```bash
python3 scripts/atualizar-descricoes-pokedex.py
npm test
```

O script usa apenas Python padrão e downloads dos commits fixados. Não roda durante instalação, build, publicação ou uso do site. Não redistribui os dumps integrais de pesquisa: inclui somente descrições necessárias e sua proveniência.

Uma espécie futura ausente do corpus conserva seu original do catálogo. Não inventa português nem mostra uma alternância que não pode funcionar. O corpus precisa ser ampliado e validado ao adicionar novas espécies.
