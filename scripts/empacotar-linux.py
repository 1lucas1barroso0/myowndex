#!/usr/bin/env python3
"""Package the versioned source and a resumable, self-contained Linux updater."""
import argparse
import base64
import gzip
import hashlib
import json
import re
import tarfile
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = (args.output or root.parent / "entrega").resolve()
output.mkdir(parents=True, exist_ok=True)
version = json.loads((root / "package.json").read_text())["version"]
if not re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version):
    raise SystemExit("Declare uma versão estável no formato major.minor.patch em package.json.")
release = ".".join(version.split(".")[:2])
lock = json.loads((root / "package-lock.json").read_text())
if lock.get("version") != version or lock.get("packages", {}).get("", {}).get("version") != version:
    raise SystemExit("As versões de package.json e package-lock.json precisam coincidir.")
if f'const CACHE_NAME = "myowndex-shell-v{version}";' not in (root / "public/sw.js").read_text():
    raise SystemExit("O shell offline precisa acompanhar a versão de package.json.")
template = (root / "scripts/atualizar-v11.template.sh").read_text()
if not re.search(r'^DEX_BASE="[0-9a-f]{40}"$', template, re.M):
    raise SystemExit("Declare a base publicada e auditada no modelo do atualizador.")
replacements = {
    "__RELEASE_VERSION__": version,
    "__RELEASE_LABEL__": release,
}
for marker in (*replacements, "__ARCHIVE_SHA256__", "__MYOWNDEX_PACKAGE_BASE64__"):
    if template.count(marker) != 1:
        raise SystemExit(f"Expected exactly one updater marker: {marker}")
stem = f"myowndex-v{release}"
excluded = {".git", "node_modules", ".next", ".npm-cache", ".sites-runtime", ".wrangler", ".vercel", "outputs", "work", "coverage", "dist", "dist-static", "dist-gateway", "__pycache__"}
files = []
for path in root.rglob("*"):
    if not path.is_file() or path.is_symlink() or path.is_relative_to(output):
        continue
    relative = path.relative_to(root)
    if excluded.intersection(relative.parts) or path.name.endswith((".tsbuildinfo", ".log", ".pyc")) or path.name == "next-env.d.ts":
        continue
    if path.name.startswith(".env") and path.name != ".env.example":
        continue
    files.append((path, "myowndex/" + relative.as_posix()))
files.sort(key=lambda entry: entry[1])
archive_path = output / f"{stem}-linux.tar.gz"
with archive_path.open("wb") as destination:
    with gzip.GzipFile(fileobj=destination, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w") as archive:
            for path, name in files:
                info = archive.gettarinfo(str(path), arcname=name)
                info.uid = info.gid = info.mtime = 0
                info.uname = info.gname = ""
                info.mode = 0o755 if path.suffix == ".sh" else 0o644
                with path.open("rb") as handle:
                    archive.addfile(info, handle)
zip_path = output / f"{stem}.zip"
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path, name in files:
        info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o755 if path.suffix == ".sh" else 0o644) << 16
        archive.writestr(info, path.read_bytes())
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
replacements["__ARCHIVE_SHA256__"] = digest
replacements["__MYOWNDEX_PACKAGE_BASE64__"] = base64.encodebytes(archive_path.read_bytes()).decode("ascii").rstrip("\n")
for marker, value in replacements.items():
    template = template.replace(marker, value)
installer = output / f"{stem}-linux.sh"
installer.write_text(template)
installer.chmod(0o755)
command = """bash -c '
arquivo=""
for pasta in "$PWD" "$(xdg-user-dir DOWNLOAD 2>/dev/null)" "$HOME/Downloads" "$HOME/Baixados"; do
  [ -d "$pasta" ] || continue
  for candidato in "$pasta"/myowndex-v__RELEASE__-linux*.sh; do
    [ -f "$candidato" ] || continue
    if [ -z "$arquivo" ] || [ "$candidato" -nt "$arquivo" ]; then arquivo="$candidato"; fi
  done
done
if [ -n "$arquivo" ]; then exec bash "$arquivo"; fi
echo "Baixe myowndex-v__RELEASE__-linux.sh e abra o terminal na pasta do arquivo." >&2
exit 1
'
""".replace("__RELEASE__", release)
(output / f"COMANDO-V{release}.txt").write_text(command)
(output / f"LEIA-V{release}.txt").write_text(
    f"MyOwnDex {version}\n\n"
    f"1. Baixe somente {stem}-linux.sh. O projeto inteiro está incluído.\n"
    f"2. Cole o comando de COMANDO-V{release}.txt no terminal. Ele encontra o arquivo baixado.\n"
    "3. Aguarde os testes, Preview, integração no GitHub, publicação e teste das salas.\n"
    "   Se um login expirou, conclua a autenticação indicada. O banco já existente é reutilizado.\n"
    "   Se houver falha, os arquivos e o log ficam preservados; execute o mesmo comando para retomar.\n\n"
    "Validação desta atualização: testes, ESLint, verificação de tipos e build.\n"
    "O instalador repete os checks no Linux antes de publicar.\n\n"
    "Netlify: a fonte não depende mais dela. O GitHub App externo exige retirar somente o repositório\n"
    "myowndex em https://github.com/settings/installations, Netlify > Configure > Repository access.\n"
    "O instalador não remove integrações de outros projetos.\n"
)
checksums = []
for path in (archive_path, zip_path, installer):
    checksums.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}")
(output / f"SHA256-V{release}.txt").write_text("\n".join(checksums) + "\n")
print(json.dumps({"version": version, "source_files": len(files), "installer": str(installer), "bytes": installer.stat().st_size, "sha256": checksums[-1].split()[0]}, indent=2))
