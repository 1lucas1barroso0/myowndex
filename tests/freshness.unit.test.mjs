import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("release-facing files agree on the current MyOwnDex version", async () => {
  const [pkgText, lockText, worker, readme, automation, current, app] = await Promise.all([
    read("package.json"),
    read("package-lock.json"),
    read("public/sw.js"),
    read("README.md"),
    read("docs/AUTOMACAO.md"),
    read("docs/CONTINUAR.md"),
    read("src/App.jsx"),
  ]);
  const pkg = JSON.parse(pkgText);
  const lock = JSON.parse(lockText);
  const version = pkg.version;
  const releaseLine = version.split(".").slice(0, 2).join(".");
  assert.equal(lock.version, version);
  assert.equal(lock.packages?.[""]?.version, version);
  assert.match(worker, new RegExp(`myowndex-shell-v${version.replaceAll(".", "\\.")}`));
  assert.match(readme, new RegExp(`A versão atual é \\*\\*${version.replaceAll(".", "\\.")}\\*\\*`));
  for (const [name, source] of [["README", readme], ["AUTOMACAO", automation]]) {
    assert.ok(source.includes(`myowndex-v${releaseLine}-linux.sh`), `${name} must point to the current installer line`);
    const installers = [...source.matchAll(/myowndex-v(\d+\.\d+)-linux\.sh/g)].map(match => match[1]);
    assert.ok(installers.every(found => found === releaseLine), `${name} contains an obsolete installer reference`);
  }
  assert.ok(current.includes(`Versão atual: ${version}`));
  assert.match(app, new RegExp(`const APP_VERSION = "${version.replaceAll(".", "\\.")}";`));
});

test("active documentation does not present an older release as current", async () => {
  const paths = [
    "README.md",
    "docs/AUTOMACAO.md",
    "docs/CONTINUAR.md",
    "docs/VALIDACAO.md",
    "docs/RUNTIME.md",
    "docs/CLEAN-REFERENCIAS.md",
    "docs/POKEDEX-IDIOMAS.md",
    "docs/CONTAS-E-SINCRONIZACAO.md",
    "docs/voice-and-terminology.md",
    "docs/icon-visual-system.md",
  ];
  const oldReleaseClaim = /(?:versão|edição|entrega|produção|atualização|retomada)\s+(?:do\s+)?11\.[0-5]/i;
  for (const path of paths) {
    const source = await read(path);
    assert.doesNotMatch(source, oldReleaseClaim, `${path} presents an older release as current`);
  }
  const validation = await read("docs/VALIDACAO.md");
  assert.doesNotMatch(validation, /produção ainda|\b\d+\s+(?:testes|checkpoints)\b/i);
  const current = await read("docs/CONTINUAR.md");
  assert.doesNotMatch(current, /\b[0-9a-f]{40}\b|PR\s*#\d+/i, "current-state documentation must not pin an old commit or PR");
});

test("historical release documents identify themselves as historical", async () => {
  for (const path of ["docs/REFINO-11.5.md", "docs/FINAL-11.6.md", "docs/PR-20-28.md", "docs/REGRAS-40.md"]) {
    const source = await read(path);
    assert.match(source.slice(0, 260), /Registro histórico/i, `${path} must not masquerade as current state`);
  }
});
