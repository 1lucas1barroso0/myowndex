# MyOwnDex 2.0.23 — registro de recuperação fiel

A execução anterior do Codex foi interrompida por limite de uso durante o envio de arquivos ao GitHub. A branch original existia, mas não continha a atualização. Os 21 objetos Git listados nas capturas foram resgatados e preservados por SHA no commit `7ce75e3430392a6d0876cc64c8f44c904bbef80d`, branch `recovery/codex-2.0.23-originals-20261010`. A integração nesta versão utiliza exatamente esses objetos, não reconstituições conjecturais.

## Arte Silicobra

Quatro folhas originais de quadros do projeto EBDX foram baixadas pelo commit fixado `836bb026ba8f6c3b3ee3bb6d461c510263953a02`. Foram reproduzidas quatro animações APNG de 70 quadros a 100 ms por quadro e quatro PNG estáticos. Todos os oito SHA-256 coincidem com `public/sprites/native/provenance-silicobra.json`, extraído do Codex original. O script reproduzível é `scripts/reproduzir-silicobra-2-0-23.py` (Pillow 12.3.0).

Os 113 pacotes históricos de sprites permanecem intactos. O novo `assets/sprites-2d/sprites-2d-113.zip` contém exatamente oito arquivos, tem 159.613 bytes e SHA-256 `37ffdf6dc367875a2a0835eef033d938bfc99cab9633481fc2d54193427ee96a`. O manifesto totaliza 2.617 arquivos, 71.628.959 bytes e 114 pacotes. Silicobra (#843) é isolada de um recurso externo cuja arte corresponde indevidamente à Sandaconda. Nenhuma animação 3D é substituta.

## Política de publicação

O pacote reconstruído não autoriza publicação por si só. Conferir o CI completo (testes, lint, tipagem e compilação), teste real de navegador, Preview correspondente ao commit e produção pós-merge. Preservar contas, Boxes, cenas e gravações. Nunca substituir a `main` por checkpoint antigo. O PR de recuperação é https://github.com/1lucas1barroso0/myowndex/pull/82.
