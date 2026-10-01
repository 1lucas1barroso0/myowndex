#!/usr/bin/env python3
"""Create the source archives and a Bash installer containing the same archive."""
import argparse
import base64
import hashlib
import shutil
import tarfile
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = (args.output or root.parent / "entrega").resolve()
output.mkdir(parents=True, exist_ok=True)
excluded = {".git", "node_modules", ".next", ".npm-cache", ".sites-runtime", ".wrangler", ".vercel"}
files = []
for path in root.rglob("*"):
    if not path.is_file() or path.is_relative_to(output):
        continue
    relative = path.relative_to(root)
    if excluded.intersection(relative.parts) or path.name.endswith(".tsbuildinfo") or path.name == "next-env.d.ts":
        continue
    if path.name.startswith(".env") and path.name != ".env.example":
        continue
    files.append((path, "myowndex/" + relative.as_posix()))
files.sort(key=lambda entry: entry[1])

archive_path = output / "myowndex-v10-linux.tar.gz"
with tarfile.open(archive_path, "w:gz") as archive:
    for path, name in files:
        info = archive.gettarinfo(str(path), arcname=name)
        info.uid = info.gid = 0
        info.uname = info.gname = ""
        info.mode = 0o755 if path.suffix == ".sh" else 0o644
        with path.open("rb") as handle:
            archive.addfile(info, handle)

zip_path = output / "myowndex-v10.zip"
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path, name in files:
        archive.write(path, name)
shutil.copyfile(zip_path, output / "myowndex-v10-linux.zip")

digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
header = r'''#!/usr/bin/env bash
set -Eeuo pipefail
DEX_STAGE="verificação inicial"
DEX_INSTALL_DIR=""
trap 'DEX_EXIT=$?; printf "\nMyOwnDex: falha na etapa [%s] (código %s).\n" "$DEX_STAGE" "$DEX_EXIT" >&2; if [[ -n "$DEX_INSTALL_DIR" ]]; then printf "Arquivos preservados em: %s\n" "$DEX_INSTALL_DIR" >&2; fi; exit "$DEX_EXIT"' ERR
DEX_ACTION="${1:-enviar}"
case "$DEX_ACTION" in
  extrair|preparar|verificar|preview|enviar|publicar) ;;
  *) echo "Uso: bash myowndex-corrigido-linux.sh [enviar|preview|verificar|preparar|extrair|publicar]" >&2; exit 2 ;;
esac
for DEX_TOOL in mktemp base64 sha256sum tar; do
  command -v "$DEX_TOOL" >/dev/null || { echo "Ferramenta ausente: $DEX_TOOL. Instale coreutils e tar." >&2; exit 1; }
done
DEX_INSTALL_ROOT="${MYOWNDEX_INSTALL_ROOT:-$HOME}"
if [[ ! -d "$DEX_INSTALL_ROOT" || ! -w "$DEX_INSTALL_ROOT" ]]; then
  echo "A pasta de instalação precisa existir e permitir escrita: $DEX_INSTALL_ROOT" >&2
  exit 1
fi
DEX_INSTALL_DIR="$(mktemp -d "$DEX_INSTALL_ROOT/myowndex-v10.XXXXXX")"
DEX_STAGE="extração do pacote incluído neste arquivo"
DEX_ARCHIVE="$DEX_INSTALL_DIR/projeto.tar.gz"
base64 --decode > "$DEX_ARCHIVE" <<'MYOWNDEX_PACKAGE_BASE64'
'''
footer = r'''MYOWNDEX_PACKAGE_BASE64
DEX_STAGE="verificação da integridade do pacote"
printf '%s  %s\n' '__ARCHIVE_SHA256__' "$DEX_ARCHIVE" | sha256sum --check --status
tar -xzf "$DEX_ARCHIVE" -C "$DEX_INSTALL_DIR"
rm -- "$DEX_ARCHIVE"
printf '\nMyOwnDex extraído em: %s/myowndex\n' "$DEX_INSTALL_DIR"
if [[ "$DEX_ACTION" == "extrair" ]]; then
  exit 0
fi
DEX_STAGE="preparação, validação e envio"
bash "$DEX_INSTALL_DIR/myowndex/preparar-linux.sh" "$DEX_ACTION"
'''.replace("__ARCHIVE_SHA256__", digest)
payload = base64.encodebytes(archive_path.read_bytes()).decode("ascii")
installer = output / "myowndex-corrigido-linux.sh"
installer.write_text(header + payload + footer)
installer.chmod(0o755)

launch_command = r'''bash -c '
arquivo=""
for pasta in "$PWD" "$(xdg-user-dir DOWNLOAD 2>/dev/null)" "$HOME/Downloads" "$HOME/Baixados"; do
  [ -d "$pasta" ] || continue
  for candidato in "$pasta"/myowndex-corrigido-linux*.sh; do
    [ -f "$candidato" ] || continue
    if [ -z "$arquivo" ] || [ "$candidato" -nt "$arquivo" ]; then arquivo="$candidato"; fi
  done
done
if [ -n "$arquivo" ]; then exec bash "$arquivo"; fi
echo "Instalador não encontrado. Abra o terminal na pasta onde baixou o arquivo e tente novamente." >&2
exit 1
'
'''
(output / "COMANDO-LINUX.txt").write_text(launch_command)
(output / "LEIA-PRIMEIRO.txt").write_text(
    "MyOwnDex 10 — instalador Linux corrigido\n\n"
    "1. Baixe myowndex-corrigido-linux.sh. Ele inclui o projeto completo.\n"
    "2. Cole o comando abaixo no terminal. Ele procura o instalador na pasta atual e nas pastas de downloads.\n\n"
    + launch_command
    + "\n3. Quando solicitado, digite sua senha do Linux e autorize os logins GitHub/Vercel no navegador.\n\n"
    "O modo padrão valida o aplicativo, envia um branch, abre PR em rascunho e cria Preview. Não exige GPT nem chave de IA.\n"
    "Para apenas extrair o projeto, execute: bash myowndex-corrigido-linux.sh extrair\n\n"
    "Antes de integrar o PR em main ou executar publicar, configure Turso e migre o backup integral das 7 aventuras antigas. O deploy não migra dados. Áudio novo também precisa de S3/R2.\n\n"
    "Nenhum PR ou deploy foi criado nesta sessão. Os 21 arquivos de testes passaram; build, lint, tipos e navegador continuam pendentes de execução com dependências completas. O script interrompe o envio e identifica a etapa se um check falhar.\n"
)

with tarfile.open(archive_path) as archive:
    assert len(archive.getmembers()) == len(files)
    for path, name in files:
        assert archive.extractfile(name).read() == path.read_bytes(), name

checksums = []
for path in [archive_path, zip_path, output / "myowndex-v10-linux.zip", installer, output / "COMANDO-LINUX.txt", output / "LEIA-PRIMEIRO.txt"]:
    checksums.append(hashlib.sha256(path.read_bytes()).hexdigest() + "  " + path.name)
    print(str(path) + " (" + str(path.stat().st_size) + " bytes)")
(output / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n")
print("Verified:", len(files), "source files.")
