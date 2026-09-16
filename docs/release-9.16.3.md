# MyOwnDex 9.16.3 — rolagens locais mais limpas

Ajuste restrito ao painel local:

- removidos “Mantido”, “Resultado registrado”, o selo “Seguro e offline” e o bloco visível de detalhes técnicos;
- exemplo do nome da ação atualizado para “Atacar com Fire Blast”;
- explicação de empate reescrita como “É preciso superar a dificuldade; empates falham.”;
- ação de copiar reduzida a “Copiar”; “Reutilizar” aparece somente quando os controles atuais diferem da rolagem exibida;
- histórico local pode ser apagado por inteiro, incluindo registros antigos do Guia, sem apagar as preferências dos dados;
- abas abertas sincronizam a remoção do histórico.

A mecânica, as probabilidades, o Web Crypto e as rolagens compartilhadas não foram alterados. O lockfile permanece intacto.

## Validação

169 testes unitários, ESLint, TypeScript, build completo Sites/Cloudflare e teste de HTML renderizado.

## Linux

```sh
bash "$HOME/Downloads/MyOwnDex-9.16.3-instalar.sh"
```
