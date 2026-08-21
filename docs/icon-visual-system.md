# Sistema visual icon-root do MyOwnDex

Este documento é o contrato visual da aplicação. O ícone oficial do MyOwnDex é a origem da identidade de todas as telas; nenhum componente pode criar uma paleta paralela.

## Tokens canônicos

| Papel no ícone | Token | Cor |
| --- | --- | --- |
| Carcaça clara | `--dex-case-bright` | `#EF4444` |
| Carcaça profunda | `--dex-case-deep` | `#7F1D1D` |
| Tela clara | `--dex-screen-highlight` | `#F0FDFF` |
| Lente em foco | `--dex-lens-cyan` | `#67E8F9` |
| Lente profunda | `--dex-lens-deep` | `#075985` |
| Superfície clara | `--surface` | `#F8FAFC` |
| Linha | `--dex-line` | `#CBD5E1` |
| Moldura/ink | `--dex-bezel` | `#0F172A` |
| LED especial | `--dex-led-pink` | `#FB7185` |
| LED de atenção | `--dex-led-yellow` | `#FDE047` |
| Tela de apoio | `--dex-screen-soft` | `#BAE6FD` |

Tons intermediários só podem nascer desses tokens por `color-mix`, transparência ou aliases compatíveis. Os aliases históricos existem para não quebrar componentes antigos, mas devem sempre resolver para a paleta do ícone.

## Hierarquia semântica

- Vermelho da carcaça: ação principal, impacto, perigo real e confirmação de consequência forte.
- Ciano da lente: foco, seleção, informação, conexão e atividade.
- Rosa do LED: mecânica especial, estado raro e exceção.
- Amarelo do LED: atenção, limite e regra que não pode passar despercebida.
- Azul-claro da tela: leitura, apoio e separação de conteúdo.
- Ink, azul profundo e vermelho profundo: texto, borda, profundidade e contraste.

Cor nunca é o único indicador. Todo estado também precisa de texto, ícone, borda, peso, posição, atributo ARIA ou outra pista equivalente.

## Geometria

Há três níveis de raio:

1. `--dex-radius-shell`: moldura principal e grandes diálogos;
2. `--dex-radius-panel`: seções e cartões;
3. `--dex-radius-control`: botões, abas, campos e sinais compactos.

Sombras pixeladas usam deslocamentos curtos e sólidos. Pixels são acabamento e ritmo, não decoração excessiva.

## Claro, noturno e tema do aparelho

Os temas mantêm a mesma identidade e hierarquia. No claro, superfícies de tela permanecem suaves e os sinais preservam contraste. No noturno, a moldura ink domina; não se usam grandes clarões brancos. O amarelo de limite vira borda e texto luminoso sobre ink. O modo “como o aparelho” apenas resolve qual desses contratos aplicar.

## Conteúdo e tipografia

A família tipográfica existente não deve ser substituída arbitrariamente. Conteúdo legível nunca pode ser truncado, escondido, ellipsizado, recortado ou sacrificado para caber em uma forma. Textos longos quebram linha; conteúdo técnico usa wrapping ou uma área de rolagem conscientemente projetada. Elementos puramente decorativos podem usar clipping.

Foco visível não pode ser cortado. Modais, popovers e menus precisam respeitar viewport, zoom e `safe-area-inset-*`. O contrato também cobre `prefers-reduced-motion`, `prefers-contrast: more` e `forced-colors`.

## Regras críticas de combate

O limite comum de dano e a proteção contra Hit Kill são conceitos distintos e sempre aparecem separados. Resultados de combate mostram, quando aplicável:

1. limite comum;
2. dano calculado;
3. dano aplicado ou simulado;
4. ativação da proteção contra Hit Kill;
5. sobrevivência por item ou habilidade;
6. exceções, como crítico, dano fixo ou nocaute direto.

O bloco final `ICON-ROOT EMPHASIS + CONTENT-INTEGRITY CONTRACT` em `src/index.css` é a camada de compatibilidade vigente. Alterações futuras devem ampliar esse contrato sem criar uma nova pilha de exceções contraditórias.
