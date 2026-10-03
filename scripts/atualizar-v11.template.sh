#!/usr/bin/env bash
# Atualização independente do MyOwnDex. O empacotador inclui o código neste arquivo.
set +x
set -Eeuo pipefail
umask 077

DEX_STAGE="preparação da atualização"
DEX_REPO="1lucas1barroso0/myowndex"
DEX_BASE="4f1be7ad640e93831b38045cc7a7057be2fd7e16"
DEX_SCOPE="1lucas1barroso0s-projects"
DEX_PRODUCTION="https://myowndex.vercel.app"
DEX_ARCHIVE_SHA="__ARCHIVE_SHA256__"
DEX_RELEASE=""
DEX_CHECKOUT=""
DEX_LOG=""
DEX_ACTION="${1:-publicar}"
DEX_LOCKED=0

dex_unlock() {
  if (( DEX_LOCKED )); then flock --unlock 9 || true; exec 9>&-; fi
}
trap dex_unlock EXIT

dex_fail() {
  printf '\nMyOwnDex parou na etapa [%s]: %s\n' "$DEX_STAGE" "$*" >&2
  if [[ -n "$DEX_RELEASE" ]]; then
    printf 'Arquivos e estado preservados: %s\nExecute este mesmo arquivo novamente para retomar.\n' "$DEX_RELEASE" >&2
  fi
  exit 1
}
trap 'DEX_STATUS=$?; printf "\nMyOwnDex parou na etapa [%s], linha %s (código %s).\n" "$DEX_STAGE" "$LINENO" "$DEX_STATUS" >&2; if [[ -n "$DEX_RELEASE" ]]; then printf "Arquivos preservados: %s\n" "$DEX_RELEASE" >&2; fi; if [[ -n "$DEX_LOG" ]]; then printf "Log das verificações: %s\n" "$DEX_LOG" >&2; fi; printf "Execute este mesmo arquivo novamente para retomar.\n" >&2; exit "$DEX_STATUS"' ERR
dex_vercel() { npx --yes vercel@62.1.0 "$@"; }
dex_field() {
  node --input-type=module - "$1" "$2" <<'DEX_JSON_FIELD'
import { readFileSync } from "node:fs";
let value = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const part of process.argv[3].split(".")) value = value?.[part];
if (value !== undefined && value !== null) process.stdout.write(String(value));
DEX_JSON_FIELD
}
dex_log_run() { "$@" 2>&1 | tee -a "$DEX_LOG"; }
dex_deployment_url() {
  node --input-type=module - "$1" <<'DEX_DEPLOYMENT_URL'
import { readFileSync } from "node:fs";
const urls = readFileSync(process.argv[2], "utf8").split(/\s+/).filter(value => /^https:\/\/myowndex[^/]*\.vercel\.app\/?$/.test(value));
if (!urls.length) { console.error("A Vercel não retornou a URL do deployment."); process.exit(1); }
process.stdout.write(urls.at(-1));
DEX_DEPLOYMENT_URL
}
dex_validate() {
  DEX_STAGE="instalação das dependências"
  dex_log_run npm ci
  DEX_STAGE="testes do MyOwnDex"
  dex_log_run npm test
  DEX_STAGE="revisão do código"
  dex_log_run npm run lint
  DEX_STAGE="verificação dos tipos"
  dex_log_run npm run typecheck
  DEX_STAGE="compilação do aplicativo"
  dex_log_run npm run build
  git add -A
  git write-tree > "$DEX_RELEASE/validated-tree"
}
dex_wait_checks() {
  local dex_sha="$1" dex_attempt dex_result
  DEX_STAGE="verificações do GitHub no código enviado"
  for ((dex_attempt=1; dex_attempt<=120; dex_attempt++)); do
    gh api "repos/$DEX_REPO/commits/$dex_sha/check-runs?per_page=100&filter=latest" > "$DEX_RELEASE/check-runs.json"
    gh api "repos/$DEX_REPO/commits/$dex_sha/status?per_page=100" > "$DEX_RELEASE/statuses.json"
    gh api --method GET "repos/$DEX_REPO/actions/workflows/quality.yml/runs" \
      --raw-field head_sha="$dex_sha" --raw-field per_page=10 > "$DEX_RELEASE/workflow-runs.json"
    if node --input-type=module - "$DEX_RELEASE" "$dex_sha" <<'DEX_CI_GUARD'
import { readFileSync } from "node:fs";
import path from "node:path";
const directory = process.argv[2];
const read = file => JSON.parse(readFileSync(path.join(directory, file), "utf8"));
const checks = read("check-runs.json").check_runs || [];
const statuses = read("statuses.json").statuses || [];
const runs = (read("workflow-runs.json").workflow_runs || []).filter(run => run.head_sha === process.argv[3]);
const accepted = new Set(["success", "neutral", "skipped"]);
const failedChecks = checks.filter(check => check.status === "completed" && !accepted.has(check.conclusion));
const failedStatuses = statuses.filter(status => ["error", "failure"].includes(status.state));
const latestRun = runs.sort((a, b) => b.id - a.id)[0];
if (failedChecks.length || failedStatuses.length || (latestRun?.status === "completed" && latestRun.conclusion !== "success")) {
  const quota = failedStatuses.find(status => /vercel/i.test(status.context || "") && /rate.limit|retry in|limit.*deploy/i.test(status.description || ""));
  if (quota) {
    console.error("A Vercel atingiu o limite diário de publicações. O código, PR, dados e log continuam preservados. Execute este mesmo arquivo após a liberação do limite; nenhum plano será alterado.");
  }
  console.error("Uma verificação falhou. Consulte o PR ou o GitHub Actions antes de retomar.");
  for (const failed of [...failedChecks, ...failedStatuses]) console.error(`• ${failed.name || failed.context}`);
  process.exit(1);
}
if (!latestRun || latestRun.status !== "completed" || latestRun.conclusion !== "success" ||
    checks.some(check => check.status !== "completed") || statuses.some(status => status.state !== "success")) process.exit(10);
console.log("GitHub: testes, código, tipos, build e demais verificações concluídos.");
DEX_CI_GUARD
    then
      return 0
    else
      dex_result=$?
      [[ "$dex_result" == "10" ]] || dex_fail "O GitHub sinalizou uma falha; a integração e a publicação foram interrompidas."
    fi
    if (( dex_attempt % 4 == 1 )); then printf 'Aguardando as verificações do GitHub… (%s/120)\n' "$dex_attempt"; fi
    sleep 15
  done
  dex_fail "As verificações ainda não terminaram após 30 minutos. O PR foi preservado; execute este mesmo arquivo mais tarde."
}

case "$DEX_ACTION" in
  publicar|verificar|extrair) ;;
  *) dex_fail "Uso: bash myowndex-v11.5-linux.sh [publicar|verificar|extrair]" ;;
esac
[[ "$DEX_ARCHIVE_SHA" =~ ^[0-9a-f]{64}$ ]] || dex_fail "Este arquivo ainda é um modelo sem o pacote final. Baixe o instalador publicado."
for DEX_TOOL in mktemp base64 sha256sum tar tee flock; do
  command -v "$DEX_TOOL" >/dev/null || dex_fail "Falta $DEX_TOOL; instale coreutils, tar e util-linux pelo gerenciador da sua distribuição."
done
DEX_RELEASE="${MYOWNDEX_V11_STATE_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/myowndex/releases/v11-${DEX_ARCHIVE_SHA:0:16}}"
if [[ -n "${MYOWNDEX_V11_STATE_DIR:-}" ]]; then
  DEX_SAVED_ARCHIVE_SHA=""
  if [[ -s "$DEX_RELEASE/package-sha256" ]]; then read -r DEX_SAVED_ARCHIVE_SHA < "$DEX_RELEASE/package-sha256"; fi
  if { [[ -n "$DEX_SAVED_ARCHIVE_SHA" && "$DEX_SAVED_ARCHIVE_SHA" != "$DEX_ARCHIVE_SHA" ]]; } \
    || { [[ -z "$DEX_SAVED_ARCHIVE_SHA" ]] && { [[ -e "$DEX_RELEASE/branch" || -e "$DEX_RELEASE/pr-number" || -e "$DEX_RELEASE/patch-ready" ]]; }; }; then
    DEX_RELEASE="${DEX_RELEASE%/}/v11-${DEX_ARCHIVE_SHA:0:16}"
  fi
fi
mkdir -p -- "$DEX_RELEASE/source"
exec 9> "$DEX_RELEASE/atualizacao.lock"
flock --nonblock 9 || dex_fail "Esta atualização já está em execução em outro terminal. Aguarde a primeira execução terminar."
DEX_LOCKED=1
if [[ -s "$DEX_RELEASE/package-sha256" ]]; then
  read -r DEX_SAVED_ARCHIVE_SHA < "$DEX_RELEASE/package-sha256"
  [[ "$DEX_SAVED_ARCHIVE_SHA" == "$DEX_ARCHIVE_SHA" ]] || dex_fail "A pasta de estado pertence a outro pacote; os arquivos foram preservados."
else
  printf '%s\n' "$DEX_ARCHIVE_SHA" > "$DEX_RELEASE/package-sha256.tmp"
  mv -- "$DEX_RELEASE/package-sha256.tmp" "$DEX_RELEASE/package-sha256"
fi
DEX_LOG="$DEX_RELEASE/verificacoes.log"
DEX_CHECKOUT="$DEX_RELEASE/repo"
DEX_STAGE="extração e integridade do pacote"
base64 --decode > "$DEX_RELEASE/projeto.tar.gz" <<'MYOWNDEX_PACKAGE_BASE64'
__MYOWNDEX_PACKAGE_BASE64__
MYOWNDEX_PACKAGE_BASE64
printf '%s  %s\n' "$DEX_ARCHIVE_SHA" "$DEX_RELEASE/projeto.tar.gz" | sha256sum --check --status
while IFS= read -r DEX_MEMBER; do
  [[ "$DEX_MEMBER" == myowndex/* && "$DEX_MEMBER" != *'/../'* && "$DEX_MEMBER" != *'/./'* ]] || dex_fail "O pacote contém um caminho inválido."
done < <(tar -tzf "$DEX_RELEASE/projeto.tar.gz")
tar -xzf "$DEX_RELEASE/projeto.tar.gz" -C "$DEX_RELEASE/source"
rm -- "$DEX_RELEASE/projeto.tar.gz"
DEX_SOURCE="$DEX_RELEASE/source/myowndex"
[[ -f "$DEX_SOURCE/package.json" && -f "$DEX_SOURCE/vercel.json" ]] || dex_fail "O pacote não contém o projeto completo."
printf '\nMyOwnDex 11.5: código extraído em %s\n' "$DEX_SOURCE"
if [[ "$DEX_ACTION" == "extrair" ]]; then exit 0; fi

DEX_MISSING=()
for DEX_TOOL in curl git rsync gh; do
  if ! command -v "$DEX_TOOL" >/dev/null; then DEX_MISSING+=("$DEX_TOOL"); fi
done
if (( ${#DEX_MISSING[@]} )); then
  DEX_STAGE="preparação das ferramentas Linux"
  command -v apt-get >/dev/null || dex_fail "Instale estas ferramentas e execute novamente: ${DEX_MISSING[*]}"
  DEX_SUDO=()
  if [[ "$(id -u)" != "0" ]]; then command -v sudo >/dev/null || dex_fail "A instalação das ferramentas ausentes precisa de sudo."; DEX_SUDO=(sudo); fi
  "${DEX_SUDO[@]}" apt-get update
  "${DEX_SUDO[@]}" apt-get install -y ca-certificates "${DEX_MISSING[@]}"
fi
DEX_STAGE="preparação do Node.js"
if ! node -e 'const[a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)' >/dev/null 2>&1 || ! command -v npm >/dev/null; then
  DEX_NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$DEX_NVM_DIR/nvm.sh" ]]; then
    curl --fail --show-error --location https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh --output "$DEX_RELEASE/install-nvm.sh"
    NVM_DIR="$DEX_NVM_DIR" bash "$DEX_RELEASE/install-nvm.sh"
  fi
  export NVM_DIR="$DEX_NVM_DIR"
  set +u
  source "$DEX_NVM_DIR/nvm.sh" --no-use
  nvm install 24
  nvm use 24
  set -u
fi
node -e 'const[a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<18)){console.error("Use Node.js 24 LTS, ou no mínimo 22.18.");process.exit(1)}'
DEX_STAGE="acesso ao GitHub"
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  if [[ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then unset GH_TOKEN GITHUB_TOKEN; fi
  gh auth login --hostname github.com --git-protocol https --web
fi
gh auth setup-git
DEX_STAGE="cópia isolada do repositório"
if [[ ! -d "$DEX_CHECKOUT/.git" ]]; then
  [[ ! -e "$DEX_CHECKOUT" ]] || dex_fail "A pasta preservada não é um checkout Git; não foi sobrescrita."
  git clone "https://github.com/$DEX_REPO.git" "$DEX_CHECKOUT"
fi
cd "$DEX_CHECKOUT"
[[ "$(git remote get-url origin)" == "https://github.com/$DEX_REPO.git" ]] || dex_fail "O checkout preservado aponta para outro repositório."
git config core.filemode false
if ! git var GIT_AUTHOR_IDENT >/dev/null 2>&1; then
  gh api user > "$DEX_RELEASE/github-user.json"
  DEX_AUTHOR="$(dex_field "$DEX_RELEASE/github-user.json" name)"
  DEX_LOGIN="$(dex_field "$DEX_RELEASE/github-user.json" login)"
  DEX_USER_ID="$(dex_field "$DEX_RELEASE/github-user.json" id)"
  git config user.name "${DEX_AUTHOR:-$DEX_LOGIN}"
  git config user.email "$DEX_USER_ID+$DEX_LOGIN@users.noreply.github.com"
fi
git fetch origin main
DEX_PR=""
DEX_MERGED="false"
if [[ -s "$DEX_RELEASE/pr-number" ]]; then
  read -r DEX_PR < "$DEX_RELEASE/pr-number"
  [[ "$DEX_PR" =~ ^[0-9]+$ ]] || dex_fail "O número de PR preservado é inválido."
  gh api "repos/$DEX_REPO/pulls/$DEX_PR" > "$DEX_RELEASE/pr.json"
  DEX_MERGED="$(dex_field "$DEX_RELEASE/pr.json" merged)"
  if [[ "$DEX_MERGED" != "true" && "$(dex_field "$DEX_RELEASE/pr.json" state)" != "open" ]]; then dex_fail "O PR foi fechado sem integração. Confira o estado no GitHub antes de retomar."; fi
fi

if [[ "$DEX_MERGED" == "true" ]]; then
  DEX_MERGE_SHA="$(dex_field "$DEX_RELEASE/pr.json" merge_commit_sha)"
  git merge-base --is-ancestor "$DEX_MERGE_SHA" origin/main || dex_fail "Main já não contém a integração desta atualização."
  git switch --detach origin/main
else
  if [[ ! -s "$DEX_RELEASE/branch" ]]; then
    DEX_STAGE="preparação do código atualizado"
    git cat-file -e "$DEX_BASE^{commit}" || dex_fail "A versão base desta entrega não foi encontrada; confira o histórico atual."
    git merge-base --is-ancestor "$DEX_BASE" origin/main || dex_fail "Main não contém a versão base desta entrega; o histórico e o checkout foram preservados."
    DEX_BRANCH="codex/myowndex-v11-$(date -u +%Y%m%d-%H%M%S)-$RANDOM"
    git rev-parse origin/main > "$DEX_RELEASE/branch-base"
    printf '%s\n' "$DEX_BRANCH" > "$DEX_RELEASE/branch"
  fi
  read -r DEX_BRANCH < "$DEX_RELEASE/branch"
  [[ "$DEX_BRANCH" =~ ^codex/myowndex-v11-[0-9]{8}-[0-9]{6}-[0-9]+$ ]] || dex_fail "O branch preservado não corresponde a esta atualização."
  if git show-ref --verify --quiet "refs/heads/$DEX_BRANCH"; then git switch "$DEX_BRANCH"; else git switch -c "$DEX_BRANCH" origin/main; fi
  [[ -s "$DEX_RELEASE/branch-base" ]] || dex_fail "A base do branch preservado não foi encontrada."
  if [[ ! -f "$DEX_RELEASE/patch-ready" ]]; then
    DEX_STAGE="preparação do patch completo"
    DEX_SNAPSHOT="$(mktemp -d "$DEX_RELEASE/snapshot.XXXXXX")"
    git clone --no-hardlinks "$DEX_CHECKOUT" "$DEX_SNAPSHOT"
    git -C "$DEX_SNAPSHOT" checkout --detach "$DEX_BASE"
    rsync -a --delete \
      --exclude='/.git' --exclude='/node_modules/' --exclude='/.next/' --exclude='/.vercel/' \
      --exclude='/.npm-cache/' --exclude='/.sites-runtime/' --exclude='/.wrangler/' \
      --exclude='/next-env.d.ts' --exclude='*.tsbuildinfo' \
      --filter='+ /.env.example' --filter='- /.env*' \
      "$DEX_SOURCE/" "$DEX_SNAPSHOT/"
    git -C "$DEX_SNAPSHOT" add -A
    git -C "$DEX_SNAPSHOT" diff --cached --binary "$DEX_BASE" > "$DEX_RELEASE/atualizacao.patch"
    printf 'ok\n' > "$DEX_RELEASE/patch-ready.tmp"
    mv -- "$DEX_RELEASE/patch-ready.tmp" "$DEX_RELEASE/patch-ready"
  fi
  if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
    if [[ -f "$DEX_RELEASE/patch-started" && ! -f "$DEX_RELEASE/patch-applied" ]]; then printf 'conflito\n' > "$DEX_RELEASE/patch-conflicted"; fi
    dex_fail "Há um conflito Git preservado no checkout. Resolva os arquivos do git status, execute git add nesses arquivos e retome este instalador."
  fi
  if git rev-parse --verify --quiet MERGE_HEAD >/dev/null; then
    DEX_STAGE="conclusão da resolução de conflito preservada"
    git add -A
    git commit --no-edit
  fi
  if [[ ! -f "$DEX_RELEASE/patch-applied" ]]; then
    DEX_STAGE="aplicação da atualização preservando mudanças existentes"
    read -r DEX_BRANCH_BASE < "$DEX_RELEASE/branch-base"
    if [[ -f "$DEX_RELEASE/patch-conflicted" ]] || { [[ -f "$DEX_RELEASE/patch-started" ]] && { ! git diff --cached --quiet || [[ "$(git rev-parse HEAD)" != "$DEX_BRANCH_BASE" ]]; }; }; then
      # Uma resolução manual já verificada como livre de conflitos não recebe o patch novamente.
      git add -A
      if git diff --cached --quiet && [[ "$(git rev-parse HEAD)" == "$DEX_BRANCH_BASE" ]]; then
        dex_fail "A resolução do patch foi descartada. Confira a atualização preservada antes de continuar."
      fi
    elif [[ -s "$DEX_RELEASE/atualizacao.patch" ]]; then
      printf 'iniciado\n' > "$DEX_RELEASE/patch-started"
      if git apply --reverse --check --index "$DEX_RELEASE/atualizacao.patch" >/dev/null 2>&1; then
        echo "O patch completo desta entrega já está aplicado; as mudanças existentes foram preservadas."
      elif ! git apply --3way --index "$DEX_RELEASE/atualizacao.patch"; then
        if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
          printf 'conflito\n' > "$DEX_RELEASE/patch-conflicted"
          dex_fail "A atualização encontrou mudanças incompatíveis. O conflito está preservado no checkout; resolva os arquivos do git status antes de retomar."
        fi
        dex_fail "Não foi possível aplicar o patch. O checkout foi preservado; consulte a mensagem do Git acima."
      fi
    fi
    printf 'ok\n' > "$DEX_RELEASE/patch-applied"
  fi
  read -r DEX_BRANCH_BASE < "$DEX_RELEASE/branch-base"
  if [[ "$(git rev-parse origin/main)" != "$DEX_BRANCH_BASE" ]]; then
    DEX_STAGE="integração de mudanças recentes de main"
    if ! git diff --cached --quiet; then git commit -m "MyOwnDex 11.5: clareza, harmonia e acabamento visual"; fi
    git merge --no-edit origin/main
    git rev-parse origin/main > "$DEX_RELEASE/branch-base"
  fi
fi

git add -A
DEX_TREE="$(git write-tree)"
DEX_VALIDATED=""
if [[ -s "$DEX_RELEASE/validated-tree" ]]; then read -r DEX_VALIDATED < "$DEX_RELEASE/validated-tree"; fi
if [[ "$DEX_TREE" != "$DEX_VALIDATED" || ! -d node_modules ]]; then
  dex_validate
else
  echo "Este mesmo código já passou em testes, lint, tipos e build nesta execução preservada."
fi
if [[ "$DEX_ACTION" == "verificar" ]]; then
  printf '\nMyOwnDex validado. Para publicar, execute este arquivo sem argumentos.\nCheckout: %s\n' "$DEX_CHECKOUT"
  exit 0
fi
if [[ "$DEX_MERGED" != "true" && -z "$DEX_PR" && "$(git write-tree)" == "$(git rev-parse 'origin/main^{tree}')" ]]; then
  # A entrega pode ter sido integrada por outra execução ou pela publicação automática.
  # O GitHub não aceita um PR sem mudanças; confirme o código já integrado e continue.
  DEX_MERGE_SHA="$(git rev-parse origin/main)"
  dex_wait_checks "$DEX_MERGE_SHA"
  git fetch origin main
  [[ "$(git rev-parse origin/main)" == "$DEX_MERGE_SHA" ]] || dex_fail "Main mudou durante as verificações. Execute este mesmo arquivo novamente para validar o código atual."
  git switch --detach "$DEX_MERGE_SHA"
  DEX_MERGED="true"
  echo "Esta atualização já está em main; o código validado segue para publicação."
fi
DEX_STAGE="acesso e vinculação à Vercel"
if ! dex_vercel whoami >/dev/null 2>&1; then dex_vercel login; fi
dex_vercel link --yes --project myowndex --scope "$DEX_SCOPE"
node --input-type=module - <<'DEX_VERCEL_GUARD'
import { readFileSync } from "node:fs";
const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (project.projectId !== "prj_SNR3J2ji67I21CoZPFHcreiQ2Xi1" || project.orgId !== "team_RswfjP7KBOsDaJcc9W4dylKp") {
  console.error("A pasta foi vinculada a outro projeto Vercel. A publicação foi interrompida.");
  process.exit(1);
}
DEX_VERCEL_GUARD

if [[ "$DEX_MERGED" != "true" ]]; then
  if ! git diff --cached --quiet; then
    DEX_STAGE="registro do código validado"
    git commit -m "MyOwnDex 11.5: clareza, harmonia e acabamento visual"
  fi
  DEX_HEAD="$(git rev-parse HEAD)"
  printf '%s\n' "$DEX_HEAD" > "$DEX_RELEASE/head"
  DEX_STAGE="envio do branch ao GitHub"
  git push --set-upstream origin "$DEX_BRANCH"
  if [[ -z "$DEX_PR" ]]; then
    DEX_STAGE="localização ou abertura do PR pela API atual"
    gh api --method GET "repos/$DEX_REPO/pulls" --raw-field state=all \
      --raw-field head="1lucas1barroso0:$DEX_BRANCH" --raw-field base=main --raw-field per_page=100 > "$DEX_RELEASE/existing-prs.json"
    DEX_PR="$(node --input-type=module - "$DEX_RELEASE/existing-prs.json" "$DEX_BRANCH" <<'DEX_FIND_PR'
import { readFileSync } from "node:fs";
const pulls = JSON.parse(readFileSync(process.argv[2], "utf8")).filter(pr => pr.head?.ref === process.argv[3] && pr.base?.ref === "main");
if (pulls.length > 1) { console.error("Há mais de um PR para este branch; confira o GitHub."); process.exit(1); }
if (pulls[0]) process.stdout.write(String(pulls[0].number));
DEX_FIND_PR
    )"
    if [[ -z "$DEX_PR" ]]; then
      node --input-type=module - "$DEX_BRANCH" "$DEX_RELEASE/new-pr.json" <<'DEX_NEW_PR'
import { writeFileSync } from "node:fs";
writeFileSync(process.argv[3], JSON.stringify({
  title: "MyOwnDex 11.5: interface mais clara, organizada e acolhedora",
  head: process.argv[2], base: "main", draft: false,
  body: "A interface separa navegação, ferramentas e preferências, dá destaque claro aos dados locais e organiza as fichas e as ações do PC. Nomes dos movimentos ficam em primeiro plano; habilidades, itens, evolução e atributos ganham hierarquia e espaço de leitura.\n\nPreserva contas, sincronização, Boxes, idiomas, referências por jogo, importação/exportação e todos os motores e regras dos PRs #20–#28.\n\nO instalador verifica testes, lint, tipos e build, aguarda CI e Preview e confirma versão e APIs em produção. A configuração existente de Turso e Vercel é reaproveitada.",
}), { mode: 0o600 });
DEX_NEW_PR
      gh api --method POST "repos/$DEX_REPO/pulls" --input "$DEX_RELEASE/new-pr.json" > "$DEX_RELEASE/pr.json"
      DEX_PR="$(dex_field "$DEX_RELEASE/pr.json" number)"
    fi
    [[ "$DEX_PR" =~ ^[0-9]+$ ]] || dex_fail "O GitHub não confirmou a abertura do PR."
    printf '%s\n' "$DEX_PR" > "$DEX_RELEASE/pr-number"
  fi
  printf 'PR: https://github.com/%s/pull/%s\n' "$DEX_REPO" "$DEX_PR"
  dex_wait_checks "$DEX_HEAD"
  DEX_STAGE="publicação do Preview validado"
  dex_vercel deploy --yes --scope "$DEX_SCOPE" > "$DEX_RELEASE/preview-deploy.txt"
  DEX_PREVIEW="$(dex_deployment_url "$DEX_RELEASE/preview-deploy.txt")"
  dex_vercel curl / --deployment "$DEX_PREVIEW" --yes --scope "$DEX_SCOPE" -- --silent --show-error --fail --max-time 90 --output "$DEX_RELEASE/preview.html"
  DEX_HTTP="$(dex_vercel curl /api/rooms/AAAAAA --deployment "$DEX_PREVIEW" --yes --scope "$DEX_SCOPE" -- --silent --show-error --max-time 90 --output "$DEX_RELEASE/preview-api.json" --write-out '%{http_code}')"
  [[ "$DEX_HTTP" == "401" ]] || dex_fail "O Preview não confirmou acesso ao banco existente (HTTP $DEX_HTTP). Nenhuma variável foi alterada."
  dex_vercel curl /api/account/session --deployment "$DEX_PREVIEW" --yes --scope "$DEX_SCOPE" -- --silent --show-error --fail --max-time 90 --output "$DEX_RELEASE/preview-account.json"
  node --input-type=module - "$DEX_RELEASE/preview-account.json" <<'DEX_ACCOUNT_HEALTH'
import { readFileSync } from "node:fs";
const response = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (response.account !== null || response.limitBytes !== 4 * 1024 * 1024) { console.error("O Preview não confirmou a API de contas."); process.exit(1); }
DEX_ACCOUNT_HEALTH
  DEX_VERSION="$(node -p 'require("./package.json").version')"
  node --input-type=module - "$DEX_RELEASE/preview.html" "$DEX_VERSION" <<'DEX_PREVIEW_HTML'
import { readFileSync } from "node:fs";
const html = readFileSync(process.argv[2], "utf8");
if (!html.includes("MyOwnDex") || !html.includes(process.argv[3])) { console.error("O Preview não corresponde à versão validada."); process.exit(1); }
DEX_PREVIEW_HTML
  DEX_STAGE="integração segura do PR"
  git fetch origin main
  read -r DEX_BRANCH_BASE < "$DEX_RELEASE/branch-base"
  [[ "$(git rev-parse origin/main)" == "$DEX_BRANCH_BASE" ]] || dex_fail "Main mudou durante as verificações. Execute este mesmo arquivo novamente: a atualização incorporará as mudanças e repetirá os checks."
  gh api "repos/$DEX_REPO/pulls/$DEX_PR" > "$DEX_RELEASE/pr-current.json"
  node --input-type=module - "$DEX_RELEASE/pr-current.json" "$DEX_HEAD" "$DEX_BRANCH" <<'DEX_MERGE_GUARD'
import { readFileSync } from "node:fs";
const pr = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (pr.state !== "open" || pr.draft || pr.head?.sha !== process.argv[3] || pr.head?.ref !== process.argv[4] || pr.base?.ref !== "main") {
  console.error("O PR mudou ou está em rascunho. Confira seu estado antes de retomar."); process.exit(1);
}
DEX_MERGE_GUARD
  gh api --method PUT "repos/$DEX_REPO/pulls/$DEX_PR/merge" \
    --raw-field sha="$DEX_HEAD" --raw-field merge_method=squash > "$DEX_RELEASE/merge.json"
  [[ "$(dex_field "$DEX_RELEASE/merge.json" merged)" == "true" ]] || dex_fail "O GitHub não confirmou a integração. O PR e o checkout foram preservados."
  DEX_MERGE_SHA="$(dex_field "$DEX_RELEASE/merge.json" sha)"
  git fetch origin main
  git merge-base --is-ancestor "$DEX_MERGE_SHA" origin/main || dex_fail "O GitHub ainda não confirmou o código integrado em main. Execute novamente para retomar."
  git switch --detach origin/main
fi

git add -A
DEX_TREE="$(git write-tree)"
read -r DEX_VALIDATED < "$DEX_RELEASE/validated-tree"
if [[ "$DEX_TREE" != "$DEX_VALIDATED" ]]; then dex_validate; fi
DEX_DEPLOY_HEAD="$(git rev-parse HEAD)"
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$DEX_DEPLOY_HEAD" ]] || dex_fail "Main recebeu novas alterações antes da publicação. Execute novamente para validar e publicar o código mais recente."
DEX_STAGE="publicação em produção"
dex_vercel deploy --prod --skip-domain --yes --scope "$DEX_SCOPE" > "$DEX_RELEASE/production-deploy.txt"
DEX_DEPLOYMENT="$(dex_deployment_url "$DEX_RELEASE/production-deploy.txt")"
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$DEX_DEPLOY_HEAD" ]] || dex_fail "Main mudou durante o build. O deployment foi criado sem atribuir o endereço público; execute novamente para publicar o código atual."
DEX_STAGE="ativação da versão publicada"
dex_vercel promote "$DEX_DEPLOYMENT" --yes --scope "$DEX_SCOPE"
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$DEX_DEPLOY_HEAD" ]] || dex_fail "Main recebeu uma atualização durante a ativação. Execute este arquivo novamente para confirmar a publicação mais recente."
DEX_STAGE="verificação do endereço público"
curl --silent --show-error --fail --retry 3 --retry-delay 2 --max-time 90 "$DEX_PRODUCTION/" --output "$DEX_RELEASE/production.html"
DEX_VERSION="$(node -p 'require("./package.json").version')"
node --input-type=module - "$DEX_RELEASE/production.html" "$DEX_VERSION" <<'DEX_PRODUCTION_HTML'
import { readFileSync } from "node:fs";
const html = readFileSync(process.argv[2], "utf8");
if (!html.includes("MyOwnDex") || !html.includes(process.argv[3])) { console.error("A versão publicada ainda não foi confirmada no endereço público."); process.exit(1); }
DEX_PRODUCTION_HTML
curl --silent --show-error --fail --retry 3 --retry-delay 2 --max-time 90 "$DEX_PRODUCTION/api/account/session" --output "$DEX_RELEASE/production-account.json"
node --input-type=module - "$DEX_RELEASE/production-account.json" <<'DEX_PRODUCTION_ACCOUNT'
import { readFileSync } from "node:fs";
const response = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (response.account !== null || response.limitBytes !== 4 * 1024 * 1024) { console.error("A API de contas publicada ainda não foi confirmada."); process.exit(1); }
DEX_PRODUCTION_ACCOUNT
DEX_STAGE="teste e limpeza das salas publicadas"
cat > "$DEX_RELEASE/verify-rooms.mjs" <<'DEX_VERIFY_ROOMS'
import { pathToFileURL } from "node:url";
const originalFetch = globalThis.fetch.bind(globalThis);
const origin = new URL(process.env.MYOWNDEX_SMOKE_URL).origin;
let session;
let removed = false;
let failure;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const method = String(options.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const response = await originalFetch(input, { ...options, signal: options.signal || AbortSignal.timeout(45_000) });
  if (url.origin === origin && url.pathname === "/api/rooms" && method === "POST" && response.status === 201) {
    const created = await response.clone().json();
    session = { code: created.code, key: created.narratorKey };
  }
  if (session && url.origin === origin && url.pathname === `/api/rooms/${session.code}` && method === "DELETE" && response.ok) removed = true;
  return response;
};
try { await import(pathToFileURL(process.argv[2]).href); } catch (error) { failure = error; }
try {
  if (session) {
    const url = `${origin}/api/rooms/${session.code}`;
    const headers = { "x-myowndex-room-key": session.key, "x-myowndex-room-protocol": "3" };
    if (!removed) {
      const deleted = await originalFetch(url, { method: "DELETE", headers, signal: AbortSignal.timeout(45_000) });
      if (!deleted.ok) throw new Error(`Não foi possível remover a aventura de teste (HTTP ${deleted.status}).`);
    }
    const after = await originalFetch(url, { headers, signal: AbortSignal.timeout(45_000) });
    if (![401, 404].includes(after.status)) throw new Error("A remoção da aventura de teste não foi confirmada.");
    console.log("Aventura de teste removida e limpeza confirmada.");
  } else if (!failure) throw new Error("O teste não confirmou a criação de uma aventura.");
} catch (error) { if (!failure) failure = error; else console.error("A limpeza da aventura de teste também falhou. Execute a verificação novamente."); }
globalThis.fetch = originalFetch;
if (failure) {
  let message = String(failure.message || failure);
  if (session?.key) message = message.split(session.key).join("[oculto]");
  console.error(`Verificação das salas: ${message.slice(0, 1000)}`);
  process.exit(1);
}
DEX_VERIFY_ROOMS
MYOWNDEX_SMOKE_URL="$DEX_PRODUCTION" node "$DEX_RELEASE/verify-rooms.mjs" "$DEX_CHECKOUT/tests/room-api.smoke.mjs"
printf '%s\n' "$DEX_DEPLOY_HEAD" > "$DEX_RELEASE/completed-head"
printf '\nMyOwnDex atualizado, publicado e salas verificadas: %s\nVersão: %s\nCheckout preservado: %s\n' "$DEX_PRODUCTION" "$DEX_VERSION" "$DEX_CHECKOUT"
