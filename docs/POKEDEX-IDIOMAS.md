# Registros e referências EN/PT

O botão EN/PT apresenta original e português do mesmo registro. Os textos são arquivos locais carregados com a ficha; alternar idioma funciona offline após carregar a referência e não usa chave, servidor de tradução, GPT ou IA. Nomes próprios de Pokémon, habilidades, movimentos, itens e tipos permanecem em inglês.

O corpus local preserva os registros históricos disponíveis nas fontes versionadas do projeto. O registro mais recente disponível de um jogo principal aparece primeiro; o seletor permite consultar outras edições. Pokémon GO mantém pares português/inglês quando a fonte oferece correspondência verificável. Formas diferentes não reutilizam texto umas das outras sem confirmação da origem.

Os recursos GO vêm de English/BrazilianPortuguese de Latest APK/Remote, usando a mesma chave nos dois idiomas. Casos sem chave base usam somente a forma confirmada pelas fontes do projeto. Registros editoriais existem apenas para lacunas documentadas e não substituem registros de outra edição. Nunca se mistura original antigo de um jogo com português de uma fonte diferente.

A cobertura exata do corpus é determinada pelos arquivos versionados e pelos testes de proveniência, não por números copiados manualmente para esta página. As explicações vindas de Pokémon Showdown são referências comunitárias de mecânicas, não diálogos oficiais de um jogo.

Cobertura é diferente de inventar texto: a fonte ainda não fornece prosa para 59 habilidades do spin-off Pokémon Conquest e 542 IDs de itens, sobretudo itens-chave novos e alguns TMs. A interface encerra a consulta e informa a ausência; não fica carregando indefinidamente nem apresenta uma regra imaginada. Ao ampliar a fonte, as novas descrições precisam ser incluídas e validadas. Cada descrição incluída tem os dois idiomas.

As listas de movimentos permitem escolher qualquer jogo que realmente forneça um learnset para aquele Pokémon. No modo Jogos, valores históricos de poder, precisão, PP, tipo, categoria, prioridade e alvo vêm dos dados literais Showdown fixados e do histórico PokeAPI. Em RPG/Livre, o seletor escolhe o repertório daquela edição, mas a resolução e as descrições dos movimentos permanecem atuais, conforme o PR #23. A classificação anterior à geração 4 respeita o tipo, e os alvos das gerações 1/2 respeitam batalhas individuais. IDs de versão não são tratados como ordem cronológica: Red/Green Japan tem ID28, mas é anterior a Red/Blue. Fatos secundários atuais não são reutilizados como regras de uma geração antiga. Legends mantém seu texto oficial específico, pois seu sistema de batalha não equivale ao de uma geração principal.

Original e tradução permanecem associados à mesma fonte e edição. A UI identifica PokéAPI, Pokémon GO ou Pokémon Showdown e, no português editorial, “Tradução MyOwnDex”. Dados brutos oficiais ficam intactos; a apresentação normaliza espaços, proporções e nomes como Poké Ball, Winged King e Iron Serpent. Traduções editoriais não são apresentadas como localização oficial brasileira. A preparação inicial utilizou tradução automática com nomes protegidos, seguida de ajustes editoriais registrados; não se afirma que 20 mil textos foram revisados individualmente por humanos.

Fontes, commits, URLs, SHA-256, direitos e escolhas de forma estão em [pokedex-entries-provenance.json](pokedex-entries-provenance.json) e [catalog-text-provenance.json](catalog-text-provenance.json). PokeAPI está fixado em `bc92d3b6029ef1abe9e7ad424c400b338f3c11fe`; Showdown em `de9d7f93083c1f7f40d48f8da3a6b4dd09141110`. Textos Pokémon GO pertencem a The Pokémon Company/Niantic; PokeMiners disponibiliza assets para uso educacional, sem licença independente permissiva para esses textos. O banco PokeAPI usa BSD-3-Clause e Showdown usa MIT; direitos dos textos Pokémon continuam com seus titulares. MyOwnDex é um projeto de fãs.

As referências de habilidade e item usam Champions como regra atual por padrão, inclusive seus ajustes verificados de Healer (50%), Unseen Fist e Slowbronite. Uma consulta histórica explícita mantém o texto daquela edição. Essa escolha é aplicada ao par EN/PT e ao resumo, sem alterar os registros oficiais brutos.

Regeração opcional durante desenvolvimento:

```bash
python3 scripts/atualizar-descricoes-pokedex.py
python3 scripts/atualizar-catalogo-bilingue.py
npm test
```

Os scripts usam Python padrão e downloads dos commits fixados. Não rodam durante instalação, build, publicação ou uso do site. A atualização padrão do catálogo reutiliza as traduções persistidas e os ajustes versionados em [catalogo-ajustes-pt.json](../scripts/catalogo-ajustes-pt.json); não chama tradutor. A opção explícita `--translate-missing` é somente uma ferramenta de preparação editorial durante desenvolvimento, nunca uma dependência do produto. Não são redistribuídos os dumps integrais de pesquisa: somente referências necessárias e sua proveniência.

Os arquivos locais são carregados sob demanda. O cache de referência tem limites independentes de oito entradas e oito MiB estimados de texto; evicta somente dados públicos descartáveis. Ele não compartilha armazenamento com Boxes, credenciais de salas ou contas. As consultas têm timeout, deduplicação e rejeição de respostas malformadas ou maiores que o limite. Nenhum catálogo inteiro é embutido no JavaScript inicial.

Uma espécie futura ausente do corpus conserva seu original do catálogo. Não inventa português nem mostra uma alternância que não pode funcionar. O corpus precisa ser ampliado e validado ao adicionar novas espécies.
