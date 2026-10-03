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
stem = "myowndex-v11.6"
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


def extract(script, state, expected=0):
    result = subprocess.run(
        ["bash", str(script), "extrair"],
        env={**os.environ, "MYOWNDEX_V11_STATE_DIR": str(state)},
        text=True,
        capture_output=True,
    )
    assert result.returncode == expected, (result.returncode, result.stdout, result.stderr)
    return result


assert installer.is_file() and archive_path.is_file() and zip_path.is_file()
manifest = (delivery / "SHA256-V11.6.txt").read_text().splitlines()
assert len(manifest) == 3
for line in manifest:
    expected, filename = line.split(maxsplit=1)
    assert digest(delivery / filename) == expected
passed("SHA-256 dos três artefatos")

text = installer.read_text()
run(["bash", "-n", str(installer)])
assert '__ARCHIVE_SHA256__' not in text and '__MYOWNDEX_PACKAGE_BASE64__' not in text
assert 'DEX_BASE="83462f453e0f67317aa40a20f71c7d4b827bf005"' in text
passed("Sintaxe Bash, marcadores resolvidos e base publicada com PRs20–28")

payload = text.split("<<'MYOWNDEX_PACKAGE_BASE64'\n", 1)[1].split("\nMYOWNDEX_PACKAGE_BASE64\n", 1)[0]
assert base64.b64decode(payload) == archive_path.read_bytes()
expected_archive_digest = re.search(r'^DEX_ARCHIVE_SHA="([0-9a-f]{64})"$', text, re.M).group(1)
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
assert json.loads(contents["myowndex/package.json"])["version"] == "11.6.0"
assert json.loads(contents["myowndex/package-lock.json"])["version"] == "11.6.0"
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
    assert not (state / f"v11-{expected_archive_digest[:16]}").exists()
    passed("Reexecução idempotente no mesmo estado")

    old_state = workspace / "entrega anterior"
    old_state.mkdir()
    old_digest = "0" * 64
    (old_state / "package-sha256").write_text(old_digest + "\n")
    (old_state / "branch").write_text("branch antigo preservado\n")
    (old_state / "pr-number").write_text("17\n")
    extract(installer, old_state)
    child = old_state / f"v11-{expected_archive_digest[:16]}"
    assert (old_state / "package-sha256").read_text().strip() == old_digest
    assert (old_state / "branch").read_text() == "branch antigo preservado\n"
    assert (old_state / "pr-number").read_text() == "17\n"
    assert json.loads((child / "source/myowndex/package.json").read_text())["version"] == "11.6.0"
    extract(installer, old_state)
    assert len(list(old_state.glob("v11-*"))) == 1
    passed("Versão anterior preservada e retomada no estado específico do pacote")

    old_without_digest = workspace / "estado legado sem digest"
    old_without_digest.mkdir()
    (old_without_digest / "patch-ready").write_text("ok anterior\n")
    extract(installer, old_without_digest)
    assert (old_without_digest / "patch-ready").read_text() == "ok anterior\n"
    assert not (old_without_digest / "package-sha256").exists()
    assert (old_without_digest / f"v11-{expected_archive_digest[:16]}" / "source/myowndex/package.json").exists()
    passed("Estado legado sem digest preservado")

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
    assert json.loads((failure_state / "source/myowndex/package.json").read_text())["version"] == "11.6.0"
    passed("Pacote corrompido rejeitado e retomada íntegra no mesmo estado")

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
