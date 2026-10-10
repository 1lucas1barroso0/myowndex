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
  assert.match(app, /import packageJson from "\.\.\/package\.json";/);
  assert.match(app, /const APP_VERSION = packageJson\.version;/);
  assert.doesNotMatch(app, /APP_VERSION_LABEL/, "visible version must not have a second manually maintained label");
  assert.ok(worker.includes(`myowndex-shell-v${pkg.version}`));
  assert.ok(readme.includes(`A versão atual é **${pkg.version}**`));
  assert.ok(current.includes(`**Versão atual: ${pkg.version}.**`));
  assert.match(app, /game-release">MyOwnDex <b>\{APP_VERSION\}<\/b>/);
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

test("release freshness endpoint and device auto-update preserve durable game state", async () => {
  const [route, app, worker, room, vercel] = await Promise.all([
    read("../app/api/version/route.ts"), read("../src/App.jsx"), read("../public/sw.js"),
    read("../src/components/Room/RpgRoom.jsx"), read("../vercel.json")
  ]);
  assert.match(route,/dynamic = "force-dynamic"/);
  assert.match(route,/packageInfo\.version/);
  assert.match(route,/VERCEL_GIT_COMMIT_SHA/);
  assert.match(app,/document\.documentElement\.dataset\.release/);
  assert.match(route,/no-store/);
  assert.match(app,/fetch\("\/api\/version"/);
  assert.match(app,/cache: "no-store"/);
  assert.match(app,/visibilitychange/);
  assert.match(app,/addEventListener\("online"/);
  assert.match(app,/2 \* 60 \* 1000/);
  assert.match(app,/teamSave\.flush\(\)/);
  assert.match(app,/myowndex:prepare-update/);
  assert.match(room,/saveQueueRef\.current\.then/);
  assert.match(worker,/await self\.skipWaiting\(\)/);
  assert.match(worker,/await cache\.put\(request, prepared\.response\)/);
  assert.match(worker,/url\.pathname\.startsWith\("\/_next\/static\/"/);
  const headers=JSON.parse(vercel).headers;
  for(const url of ["/","/sw.js","/manifest.webmanifest"]){
    const rule=headers.find(h=>h.source===url);
    assert.ok(rule?.headers.some(h=>h.key==="Cache-Control"&&h.value.includes("no-store")),url);
  }
});
