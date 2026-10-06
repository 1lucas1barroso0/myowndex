import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("release version stays aligned across package, app, offline shell and current docs", async () => {
  const [pkgText, lockText, app, worker, readme, current] = await Promise.all([
    read("../package.json"),
    read("../package-lock.json"),
    read("../src/App.jsx"),
    read("../public/sw.js"),
    read("../README.md"),
    read("../docs/CONTINUAR.md"),
  ]);
  const pkg = JSON.parse(pkgText);
  const lock = JSON.parse(lockText);

  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.ok(app.includes(`const APP_VERSION = "${pkg.version}";`));
  assert.ok(worker.includes(`myowndex-shell-v${pkg.version}`));
  assert.ok(readme.includes(`A versão atual é **${pkg.version}**`));
  assert.ok(current.includes(`**Versão atual: ${pkg.version}.**`));
});

test("registry dependency versions match the tarballs recorded in package-lock", async () => {
  const lock = JSON.parse(await read("../package-lock.json"));
  for (const [path, entry] of Object.entries(lock.packages || {})) {
    if (!path || !entry?.version || !entry?.resolved?.startsWith("https://registry.npmjs.org/")) continue;
    assert.ok(
      entry.resolved.endsWith(`-${entry.version}.tgz`),
      `${path}: version ${entry.version} does not match ${entry.resolved}`
    );
  }
});
