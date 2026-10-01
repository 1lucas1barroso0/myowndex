#!/usr/bin/env bash
set -Eeuo pipefail
DEX_STAGE="verificação inicial"
trap 'DEX_EXIT=$?; printf "\nMyOwnDex: falha na etapa [%s], linha %s (código %s).\nPasta do projeto: %s\n" "$DEX_STAGE" "$LINENO" "$DEX_EXIT" "${DEX_SOURCE_DIR:-$PWD}" >&2; if [[ -n "${DEX_RELEASE_DIR:-}" ]]; then printf "Checkout preservado: %s/repo\n" "$DEX_RELEASE_DIR" >&2; fi; exit "$DEX_EXIT"' ERR

DEX_ACTION="${1:-verificar}"
DEX_SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEX_BASE_COMMIT="b74ed69540cafa7978356957212c7dda073d22de"
DEX_REPOSITORY="https://github.com/1lucas1barroso0/myowndex.git"
DEX_REPOSITORY_NAME="1lucas1barroso0/myowndex"
DEX_VERCEL_SCOPE="1lucas1barroso0s-projects"

if [[ "$DEX_ACTION" != "verificar" && "$DEX_ACTION" != "preview" && "$DEX_ACTION" != "enviar" && "$DEX_ACTION" != "publicar" ]]; then
  echo "Uso: bash publicar-linux.sh verificar|preview|enviar|publicar" >&2
  exit 2
fi
for DEX_TOOL in node npm; do
  command -v "$DEX_TOOL" >/dev/null || { echo "Instale $DEX_TOOL antes de continuar." >&2; exit 1; }
done
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<18)){console.error("Use Node.js 24 LTS (mínimo 22.18).");process.exit(1)}'

if [[ "$DEX_ACTION" == "enviar" || "$DEX_ACTION" == "publicar" ]]; then
  for DEX_TOOL in git rsync; do
    command -v "$DEX_TOOL" >/dev/null || { echo "Instale $DEX_TOOL antes de publicar." >&2; exit 1; }
  done
fi
if [[ "$DEX_ACTION" == "enviar" ]]; then
  DEX_STAGE="login no GitHub"
  command -v gh >/dev/null || { echo "Execute bash preparar-linux.sh enviar para instalar o GitHub CLI." >&2; exit 1; }
  if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    if [[ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then
      echo "O GitHub não aceitou a autenticação atual. Usando login pelo navegador nesta execução."
      unset GH_TOKEN GITHUB_TOKEN
    fi
    gh auth login --hostname github.com --git-protocol https --web
  fi
  gh auth setup-git
fi

cd "$DEX_SOURCE_DIR"
echo "Instalando dependências e validando o MyOwnDex…"
DEX_STAGE="instalação das dependências (npm ci)"
npm ci
DEX_STAGE="testes"
npm test
DEX_STAGE="revisão do código (lint)"
npm run lint
DEX_STAGE="verificação dos tipos"
npm run typecheck
DEX_STAGE="compilação (build)"
npm run build

if [[ "$DEX_ACTION" == "verificar" ]]; then
  echo "Validação concluída. Para conferir online: bash publicar-linux.sh preview"
  exit 0
fi

echo "Autenticando na Vercel e vinculando o projeto myowndex…"
DEX_STAGE="login na Vercel"
if ! npx --yes vercel@latest whoami; then
  npx --yes vercel@latest login
fi
if [[ ! -f "$DEX_SOURCE_DIR/.vercel/project.json" ]]; then
  DEX_STAGE="vinculação do projeto Vercel"
  npx --yes vercel@latest link --yes --project myowndex --scope "$DEX_VERCEL_SCOPE"
fi
node --input-type=module -e 'import{readFileSync}from"node:fs";const p=JSON.parse(readFileSync(".vercel/project.json","utf8"));if(p.projectId!=="prj_SNR3J2ji67I21CoZPFHcreiQ2Xi1"||p.orgId!=="team_RswfjP7KBOsDaJcc9W4dylKp"){console.error("A pasta está vinculada a outro projeto Vercel. Confira .vercel/project.json e vincule myowndex na equipe 1lucas1barroso0s-projects.");process.exit(1)}console.log("Projeto Vercel confirmado: myowndex.")'

if [[ "$DEX_ACTION" == "preview" ]]; then
  DEX_STAGE="criação do Preview"
  npx --yes vercel@latest deploy --scope "$DEX_VERCEL_SCOPE"
  echo "Preview concluído. O comando não enviou alterações ao GitHub nem publicou em produção."
  exit 0
fi

DEX_RELEASE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/myowndex-release.XXXXXX")"
DEX_STAGE="download do repositório GitHub"
git clone --branch main --single-branch "$DEX_REPOSITORY" "$DEX_RELEASE_DIR/repo"
DEX_REMOTE_COMMIT="$(git -C "$DEX_RELEASE_DIR/repo" rev-parse HEAD)"
# Arquivos baixados podem ter permissões diferentes das usadas pelo GitHub.
git -C "$DEX_RELEASE_DIR/repo" config core.filemode false

rsync -a --delete \
  --exclude='/.git/' --exclude='/node_modules/' --exclude='/.next/' \
  --exclude='/.vercel/' --exclude='/.npm-cache/' --exclude='/.sites-runtime/' \
  --exclude='/.wrangler/' --exclude='/next-env.d.ts' --exclude='*.tsbuildinfo' \
  --filter='+ /.env.example' --filter='- /.env*' \
  "$DEX_SOURCE_DIR/" "$DEX_RELEASE_DIR/repo/"

cd "$DEX_RELEASE_DIR/repo"
DEX_STAGE="comparação com o GitHub"
git add -A
if ! git diff --cached --quiet; then
  if [[ "$DEX_REMOTE_COMMIT" != "$DEX_BASE_COMMIT" ]]; then
    echo "O GitHub contém uma versão diferente da base desta entrega." >&2
    echo "Nada foi enviado ou publicado. Confira as diferenças no checkout: $DEX_RELEASE_DIR/repo" >&2
    echo "Use o código atual do GitHub quando o PR desta entrega já tiver sido integrado." >&2
    exit 1
  fi
  if ! git var GIT_AUTHOR_IDENT >/dev/null 2>&1; then
    if command -v gh >/dev/null && gh auth status --hostname github.com >/dev/null 2>&1; then
      git config user.name "$(gh api user --jq '.name // .login')"
      git config user.email "$(gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"')"
    else
      echo "Configure seu nome e e-mail no Git, ou execute bash preparar-linux.sh publicar." >&2
      exit 1
    fi
  fi
  if [[ "$DEX_ACTION" == "enviar" ]]; then
    DEX_STAGE="criação do branch"
    DEX_BRANCH="codex/myowndex-v10-$(date -u +%Y%m%d-%H%M%S)-${RANDOM}"
    git switch -c "$DEX_BRANCH"
  fi
  git commit -m "Melhora MyOwnDex e migra para Vercel independente"
  if [[ "$DEX_ACTION" == "enviar" ]]; then
    DEX_STAGE="envio do branch ao GitHub"
    git push --set-upstream origin "$DEX_BRANCH"
    DEX_PR_BODY="$DEX_RELEASE_DIR/pr.md"
    cat > "$DEX_PR_BODY" <<'DEX_PR_TEXT'
MyOwnDex passa a executar páginas e APIs diretamente na Vercel, com Next.js, sem autenticação GPT nem encaminhamento para Sites. Pokédex e PC recebem interface de console portátil, catálogo local, sprites, filtros e navegação por teclado.

Testes, ESLint, tipos e build foram executados pelo script antes deste envio. O workflow do GitHub repete a validação.

A produção permanece na versão atual. Antes de integrar este PR, configure Turso/S3 na Vercel e importe o backup completo das 7 salas do serviço anterior. O deploy não migra os registros privados. Consulte docs/RUNTIME.md e docs/VALIDACAO.md.
DEX_PR_TEXT
    DEX_STAGE="abertura do PR em rascunho"
    gh pr create --repo "$DEX_REPOSITORY_NAME" --base main --head "$DEX_BRANCH" \
      --draft --title "MyOwnDex 10: interface retrô e execução independente na Vercel" \
      --body-file "$DEX_PR_BODY"
  else
    DEX_STAGE="envio para main"
    git push origin main
  fi
else
  echo "O GitHub já contém os mesmos arquivos. Nenhum commit ou push adicional é necessário."
fi

mkdir -p "$DEX_RELEASE_DIR/repo/.vercel"
cp "$DEX_SOURCE_DIR/.vercel/project.json" "$DEX_RELEASE_DIR/repo/.vercel/project.json"
if [[ "$DEX_ACTION" == "enviar" ]]; then
  DEX_STAGE="criação do Preview"
  echo "Criando Preview. A integração GitHub/Vercel também pode gerar um Preview para este branch."
  npx --yes vercel@latest deploy --scope "$DEX_VERCEL_SCOPE"
  echo "Envio concluído. Checkout: $DEX_RELEASE_DIR/repo"
  echo "A publicação final deve aguardar a configuração do banco e a migração das salas antigas."
  exit 0
fi
echo "Publicando no projeto vinculado. As salas usam as variáveis Turso/S3 cadastradas na Vercel."
DEX_STAGE="publicação em produção"
npx --yes vercel@latest deploy --prod --scope "$DEX_VERCEL_SCOPE"
echo "Checkout utilizado na publicação: $DEX_RELEASE_DIR/repo"
