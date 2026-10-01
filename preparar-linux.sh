#!/usr/bin/env bash
set -Eeuo pipefail
DEX_STAGE="preparação"
trap 'DEX_EXIT=$?; printf "\nMyOwnDex: falha na etapa [%s], linha %s (código %s).\nCopie as últimas linhas do terminal para identificar o erro.\n" "$DEX_STAGE" "$LINENO" "$DEX_EXIT" >&2; exit "$DEX_EXIT"' ERR

# Execute este script na sua máquina Linux. O padrão só prepara as ferramentas.
DEX_ACTION="${1:-preparar}"
DEX_SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
case "$DEX_ACTION" in
  preparar|verificar|preview|enviar|publicar) ;;
  *) echo "Uso: bash preparar-linux.sh preparar|verificar|preview|enviar|publicar" >&2; exit 2 ;;
esac

DEX_MISSING_PACKAGES=()
for DEX_TOOL in curl git rsync; do
  if ! command -v "$DEX_TOOL" >/dev/null; then
    DEX_MISSING_PACKAGES+=("$DEX_TOOL")
  fi
done
if [[ "$DEX_ACTION" == "enviar" || "$DEX_ACTION" == "publicar" ]] && ! command -v gh >/dev/null; then
  DEX_MISSING_PACKAGES+=(gh)
fi

if (( ${#DEX_MISSING_PACKAGES[@]} > 0 )); then
  DEX_STAGE="instalação das ferramentas Linux"
  if ! command -v apt-get >/dev/null; then
    echo "Instale estas ferramentas pelo gerenciador da sua distribuição: ${DEX_MISSING_PACKAGES[*]}" >&2
    echo "Depois execute este mesmo comando novamente." >&2
    exit 1
  fi
  DEX_SUDO=()
  if [[ "$(id -u)" != "0" ]]; then
    command -v sudo >/dev/null || { echo "A instalação das ferramentas requer sudo." >&2; exit 1; }
    DEX_SUDO=(sudo)
  fi
  echo "Instalando ferramentas ausentes: ${DEX_MISSING_PACKAGES[*]}"
  "${DEX_SUDO[@]}" apt-get update
  "${DEX_SUDO[@]}" apt-get install -y ca-certificates "${DEX_MISSING_PACKAGES[@]}"
fi

DEX_NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if ! command -v node >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)' || ! command -v npm >/dev/null; then
  DEX_STAGE="preparação do Node.js"
  if [[ -s "$DEX_NVM_DIR/nvm.sh" ]]; then
    export NVM_DIR="$DEX_NVM_DIR"
    # Evita trocar uma versão válida ou ativar um alias antigo ao carregar NVM.
    # shellcheck source=/dev/null
    . "$DEX_NVM_DIR/nvm.sh" --no-use
  fi
  if ! declare -F nvm >/dev/null; then
    DEX_NVM_INSTALLER="$(mktemp "${TMPDIR:-/tmp}/myowndex-nvm.XXXXXX")"
    trap 'rm -f -- "$DEX_NVM_INSTALLER"' EXIT
    curl --fail --show-error --location \
      https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \
      --output "$DEX_NVM_INSTALLER"
    NVM_DIR="$DEX_NVM_DIR" bash "$DEX_NVM_INSTALLER"
    export NVM_DIR="$DEX_NVM_DIR"
    # shellcheck source=/dev/null
    . "$DEX_NVM_DIR/nvm.sh" --no-use
  fi
  nvm install 24
  nvm alias default 24
  nvm use 24
fi

echo "Ferramentas prontas: Node $(node --version), npm $(npm --version)."
cd "$DEX_SOURCE_DIR"

if [[ "$DEX_ACTION" == "preparar" ]]; then
  echo "Para validar, enviar um branch e abrir um Preview: bash preparar-linux.sh enviar"
  exit 0
fi

if [[ "$DEX_ACTION" == "enviar" || "$DEX_ACTION" == "publicar" ]]; then
  DEX_STAGE="login no GitHub"
  if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    if [[ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then
      echo "O GitHub não aceitou a autenticação atual. Usando login pelo navegador nesta execução."
      # O ambiente do terminal original permanece intacto.
      unset GH_TOKEN GITHUB_TOKEN
    fi
    gh auth login --hostname github.com --git-protocol https --web
  fi
  gh auth setup-git
fi

exec bash "$DEX_SOURCE_DIR/publicar-linux.sh" "$DEX_ACTION"
