# MyOwnDex 9.16.4 — instalador resistente a instabilidade de rede

Correção do instalador após um timeout real do registro npm durante o download de `youch-core`.

- o download de pré-validação usa até três novas tentativas para falhas de rede;
- o `npm ci` mantém o cache e repete automaticamente até três vezes somente diante de timeout, conexão interrompida, DNS temporário ou erro de busca;
- falhas de código, integridade ou configuração não são repetidas;
- cada tentativa continua limitada por tempo e protegida pelo lock de instalação;
- se a conexão continuar indisponível, o checkout e o cache permanecem preservados para retomada posterior.

Código da aplicação, rolagens e lockfile não foram alterados nesta versão.

## Linux

```sh
bash "$HOME/Downloads/MyOwnDex-9.16.4-instalar.sh"
```
