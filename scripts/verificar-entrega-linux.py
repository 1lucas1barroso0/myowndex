#!/usr/bin/env python3
"""Verify a generated delivery without publishing or using credentials.

Usage from the project root:
    python3 scripts/verificar-entrega-linux.py ../entrega

All extraction, locking, recovery, and determinism checks use temporary folders.
No GitHub, Vercel, or database operation is performed.
"""
import argparse
import base64
import fcntl
import hashlib
import json
import os
import re
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("delivery", type=Path)
args = parser.parse_args()
delivery = args.delivery.resolve()
root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
release = ".".join(version.split(".")[:2])
stem = f"myowndex-v{release}"
installer = delivery / f"{stem}-linux.sh"
archive_path = delivery / f"{stem}-linux.tar.gz"
zip_path = delivery / f"{stem}.zip"
checks = []


def passed(name):
    checks.append(name)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command, **options):
    result = subprocess.run(command, text=True, capture_output=True, **options)
    if result.returncode:
        raise AssertionError(f"Command failed: {command!r}\n{result.stdout}\n{result.stderr}")
    return result


def extract(script, state, expected=0, state_key="MYOWNDEX_STATE_DIR"):
    environment = {key: value for key, value in os.environ.items() if key not in {"MYOWNDEX_STATE_DIR", "MYOWNDEX_V11_STATE_DIR"}}
    result = subprocess.run(
        ["bash", str(script), "extrair"],
        env={**environment, state_key: str(state)},
        text=True,
        capture_output=True,
    )
    assert result.returncode == expected, (result.returncode, result.stdout, result.stderr)
    return result


assert installer.is_file() and archive_path.is_file() and zip_path.is_file()
manifest = (delivery / f"SHA256-V{release}.txt").read_text().splitlines()
assert len(manifest) == 3
for line in manifest:
    expected, filename = line.split(maxsplit=1)
    assert digest(delivery / filename) == expected
passed("SHA-256 dos três artefatos")

text = installer.read_text()
run(["bash", "-n", str(installer)])
assert all(marker not in text for marker in ("__ARCHIVE_SHA256__", "__MYOWNDEX_PACKAGE_BASE64__", "__RELEASE_VERSION__", "__RELEASE_LABEL__"))
assert f'DEX_PACKAGE_VERSION="{version}"' in text and f'DEX_RELEASE_LABEL="{release}"' in text
published_base = re.search(r'^DEX_BASE="([0-9a-f]{40})"$', (root / "scripts/atualizar-v11.template.sh").read_text(), re.M).group(1)
assert f'DEX_BASE="{published_base}"' in text
passed("Sintaxe Bash, marcadores resolvidos e base publicada auditada")

payload = text.split("<<'MYOWNDEX_PACKAGE_BASE64'\n", 1)[1].split("\nMYOWNDEX_PACKAGE_BASE64\n", 1)[0]
assert base64.b64decode(payload) == archive_path.read_bytes()
expected_archive_digest = re.search(r'^DEX_ARCHIVE_SHA="([0-9a-f]{64})"$', text, re.M).group(1)
state_id = f"v{release}-{expected_archive_digest[:16]}"
assert digest(archive_path) == expected_archive_digest
passed("Pacote embutido idêntico ao TAR e checksum interno")

excluded = {".git", "node_modules", ".next", ".vercel", ".sites-runtime", "__pycache__", "coverage", "dist"}
with tarfile.open(archive_path, "r:gz") as archive:
    members = archive.getmembers()
    assert members and all(member.isfile() for member in members)
    contents = {}
    for member in members:
        path = Path(member.name)
        assert not path.is_absolute() and path.parts[0] == "myowndex"
        assert ".." not in path.parts and not excluded.intersection(path.parts)
        assert not path.name.startswith(".env") or path.name == ".env.example"
        assert not path.name.endswith((".tsbuildinfo", ".log", ".pyc"))
        contents[member.name] = archive.extractfile(member).read()
assert json.loads(contents["myowndex/package.json"])["version"] == version
assert json.loads(contents["myowndex/package-lock.json"])["version"] == version
assert json.loads(contents["myowndex/package-lock.json"])["packages"][""]["version"] == version
assert f'const CACHE_NAME = "myowndex-shell-v{version}";' in contents["myowndex/public/sw.js"].decode()
assert "myowndex/tests/browser-responsive.mjs" in contents
assert "myowndex/docs/CONTINUAR.md" in contents
assert "myowndex/docs/VALIDACAO.md" in contents
passed("Arquivo completo, caminhos seguros e sem credenciais/dependências geradas")

with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(contents)
    assert all(archive.read(name) == data for name, data in contents.items())
passed("ZIP íntegro e equivalente ao TAR")

with tempfile.TemporaryDirectory(prefix="myowndex-entrega-qa-") as temp:
    workspace = Path(temp)
    state = workspace / "estado com espaços"
    extract(installer, state)
    source = state / "source/myowndex"
    assert all((state / "source" / name).read_bytes() == data for name, data in contents.items())
    assert (state / "package-sha256").read_text().strip() == expected_archive_digest
    assert not (state / "repo").exists()
    passed("Extração isolada em caminho com espaços, sem autenticação/publicação")

    extract(installer, state)
    assert all((state / "source" / name).read_bytes() == data for name, data in contents.items())
    assert not (state / state_id).exists()
    passed("Reexecução idempotente no mesmo estado")

    old_state = workspace / "entrega anterior"
    old_state.mkdir()
    old_digest = "0" * 64
    (old_state / "package-sha256").write_text(old_digest + "\n")
    (old_state / "branch").write_text("branch antigo preservado\n")
    (old_state / "pr-number").write_text("17\n")
    extract(installer, old_state)
    child = old_state / state_id
    assert (old_state / "package-sha256").read_text().strip() == old_digest
    assert (old_state / "branch").read_text() == "branch antigo preservado\n"
    assert (old_state / "pr-number").read_text() == "17\n"
    assert json.loads((child / "source/myowndex/package.json").read_text())["version"] == version
    extract(installer, old_state)
    assert len(list(old_state.glob(f"v{release}-*"))) == 1
    passed("Versão anterior preservada e retomada no estado específico do pacote")

    old_without_digest = workspace / "estado legado sem digest"
    old_without_digest.mkdir()
    (old_without_digest / "patch-ready").write_text("ok anterior\n")
    extract(installer, old_without_digest)
    assert (old_without_digest / "patch-ready").read_text() == "ok anterior\n"
    assert not (old_without_digest / "package-sha256").exists()
    assert (old_without_digest / state_id / "source/myowndex/package.json").exists()
    passed("Estado legado sem digest preservado")

    legacy_override = workspace / "override legado"
    extract(installer, legacy_override, state_key="MYOWNDEX_V11_STATE_DIR")
    assert json.loads((legacy_override / "source/myowndex/package.json").read_text())["version"] == version
    assert (legacy_override / "package-sha256").read_text().strip() == expected_archive_digest
    passed("Compatibilidade do override MYOWNDEX_V11_STATE_DIR")

    preferred = workspace / "override atual"
    ignored = workspace / "override antigo ignorado"
    result = run(["bash", str(installer), "extrair"], env={**os.environ, "MYOWNDEX_STATE_DIR": str(preferred), "MYOWNDEX_V11_STATE_DIR": str(ignored)})
    assert (preferred / "source/myowndex/package.json").exists() and not ignored.exists()
    passed("Override atual tem precedência sem alterar o diretório legado")

    with (state / "atualizacao.lock").open("w") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = extract(installer, state, expected=1)
        assert "já está em execução" in result.stderr
    extract(installer, state)
    passed("Bloqueio de concorrência e retomada após liberar a trava")

    corrupted = workspace / "pacote-corrompido.sh"
    payload_lines = payload.splitlines()
    payload_lines[0] = ("A" if payload_lines[0][0] != "A" else "B") + payload_lines[0][1:]
    corrupted.write_text(text.replace(payload, "\n".join(payload_lines), 1))
    failure_state = workspace / "estado recuperado"
    result = extract(corrupted, failure_state, expected=1)
    assert "extração e integridade do pacote" in result.stderr
    assert not (failure_state / "source/myowndex/package.json").exists()
    extract(installer, failure_state)
    assert json.loads((failure_state / "source/myowndex/package.json").read_text())["version"] == version
    passed("Pacote corrompido rejeitado e retomada íntegra no mesmo estado")

    package = source / "package.json"
    lock = source / "package-lock.json"
    worker = source / "public/sw.js"
    originals = {path: path.read_bytes() for path in (package, lock, worker)}
    cases = [
        (package, {**json.loads(originals[package]), "version": "invalid"}, "versão estável"),
        (lock, {**json.loads(originals[lock]), "version": "0.0.0"}, "package-lock.json"),
        (worker, worker.read_text().replace(f"myowndex-shell-v{version}", "myowndex-shell-v0.0.0", 1), "shell offline"),
    ]
    for path, changed, message in cases:
        path.write_text(json.dumps(changed) if isinstance(changed, dict) else changed)
        result = subprocess.run(["python3", str(source / "scripts/empacotar-linux.py"), "--output", str(workspace / "metadados-invalidos")], text=True, capture_output=True)
        assert result.returncode != 0 and message in result.stderr, (result.returncode, result.stdout, result.stderr)
        path.write_bytes(originals[path])
    assert not list((workspace / "metadados-invalidos").iterdir())
    passed("Metadados incoerentes rejeitados antes de gerar artefatos")

    outputs = [workspace / "determinismo1", workspace / "determinismo2"]
    for output in outputs:
        run(["python3", str(source / "scripts/empacotar-linux.py"), "--output", str(output)])
    generated = sorted(path.name for path in outputs[0].iterdir() if path.is_file())
    assert generated == sorted(path.name for path in outputs[1].iterdir() if path.is_file())
    assert all((outputs[0] / name).read_bytes() == (outputs[1] / name).read_bytes() for name in generated)
    assert (outputs[0] / f"{stem}-linux.tar.gz").read_bytes() == archive_path.read_bytes()
    assert (outputs[0] / f"{stem}.zip").read_bytes() == zip_path.read_bytes()
    assert (outputs[0] / f"{stem}-linux.sh").read_bytes() == installer.read_bytes()
    passed("Empacotamento determinístico: seis arquivos idênticos entre execuções")

print(json.dumps({"delivery": str(delivery), "source_files": len(contents), "checks": len(checks), "passed": checks}, ensure_ascii=False, indent=2))
