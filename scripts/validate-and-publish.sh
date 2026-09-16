#!/usr/bin/env bash
# Validate this checkout and fast-forward the existing MyOwnDex GitHub project.
set -euo pipefail
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"
mode="${1:-publish}"
case "$mode" in publish|--validate-only) ;; *) echo 'Uso: bash scripts/validate-and-publish.sh [--validate-only]' >&2; exit 64;; esac
for tool in git node npm curl; do command -v "$tool" >/dev/null || { echo "Falta instalar: $tool" >&2; exit 69; }; done
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<13)) { console.error("Use Node.js 22.13 ou superior."); process.exit(1); }'
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Este checkout tem alterações locais. Preserve-as antes de publicar; nada foi apagado.' >&2
  exit 65
fi
local_sha="$(git rev-parse HEAD)"
if [[ -n "${MYOWNDEX_EXPECTED_COMMIT:-}" && "$local_sha" != "$MYOWNDEX_EXPECTED_COMMIT" ]]; then
  echo 'O checkout contém outro commit. A atualização foi interrompida para preservá-lo.' >&2
  exit 65
fi
printf '\n==> Dependências exatas do lockfile\n'
npm run install:ci
printf '\n==> Testes, lint e TypeScript\n'
npm test
npm run lint
node_modules/.bin/tsc --noEmit --incremental false
printf '\n==> Build completo\n'
npm run build
node --test tests/rendered-html.test.mjs
if [[ "$mode" == '--validate-only' ]]; then echo 'Validação concluída. Nenhuma publicação solicitada.'; exit 0; fi
remote_url="$(git remote get-url origin)"
case "$remote_url" in https://github.com/1lucas1barroso0/myowndex.git|git@github.com:1lucas1barroso0/myowndex.git) ;; *) echo "O origin não é o repositório MyOwnDex esperado: $remote_url" >&2; exit 65;; esac
printf '\n==> Conferindo o GitHub antes de publicar\n'
git fetch --no-tags origin main
if ! git merge-base --is-ancestor origin/main HEAD; then
  if git merge-base --is-ancestor HEAD origin/main; then
    echo 'O GitHub já contém este trabalho e commits mais novos. A versão mais nova foi preservada.'
    exit 0
  fi
  echo 'O GitHub recebeu trabalho divergente. O pacote está salvo; nenhuma versão remota foi substituída.' >&2
  exit 65
fi
printf '\n==> Publicando por fast-forward, sem force-push\n'
git push origin HEAD:refs/heads/codex/local-dice-9.16.5
git push origin HEAD:refs/heads/main
printf '\n==> Conferindo a atualização em produção\n'
verified=0
for attempt in {1..30}; do
  if curl --fail --silent --show-error --connect-timeout 10 --max-time 20 --header 'Cache-Control: no-cache' "https://myowndex.vercel.app/sw.js?release=9.16.5" | grep -q 'myowndex-shell-v9.16.5'; then verified=1; break; fi
  sleep 5
done
if [[ "$verified" != 1 ]]; then
  echo 'GitHub atualizado, mas a versão 9.16.5 ainda não foi confirmada no domínio de produção.' >&2
  echo 'Seu código está salvo. Confira a publicação no painel de hospedagem.' >&2
  exit 75
fi
MYOWNDEX_SMOKE_URL=https://myowndex.vercel.app node tests/room-api.smoke.mjs
printf '\nConcluído.\nGitHub: %s\nProdução: https://myowndex.vercel.app\nCódigo: %s\n' "$local_sha" "$root_dir"
