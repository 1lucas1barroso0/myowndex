# MyOwnDex 9.16.5 — contraste do PC no modo claro

- Texto introdutório das Boxes reescrito de forma mais direta.
- Corrigida a cor interna de Compartilhar, Importar, Apagar e demais ações do PC no modo claro.
- A Box selecionada agora mantém nome e quantidade legíveis.
- Um Pokémon selecionado mantém nome e informações legíveis.
- Tema escuro preservado com cores próprias para ações destrutivas.

A causa era uma regra visual antiga com prioridade alta aplicada aos elementos internos dos botões. A correção está na camada visual carregada por último e cobre explicitamente esses estados.

## Linux

```sh
bash "$HOME/Downloads/MyOwnDex-9.16.5-instalar.sh"
```
