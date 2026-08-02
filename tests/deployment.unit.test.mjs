import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the official Vercel domain transparently reaches the complete MyOwnDex runtime", async () => {
  const config = JSON.parse(await read("vercel.json"));
  assert.equal(config.framework, "vite");
  assert.equal(config.buildCommand, "npm run build:gateway");
  assert.equal(config.outputDirectory, "dist-gateway");
  assert.deepEqual(config.rewrites, [
    {
      source: "/",
      destination: "https://myowndex-update.neat-calf-9750.chatgpt.site/",
    },
    {
      source: "/:path*",
      destination: "https://myowndex-update.neat-calf-9750.chatgpt.site/:path*",
    },
  ]);

  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.scripts["build:gateway"], "bash scripts/build-gateway.sh");
  const gatewayBuild = await read("scripts/build-gateway.sh");
  assert.match(gatewayBuild, /dist-gateway/);
  assert.doesNotMatch(gatewayBuild, /vite|build:static|dist-static/);

  const apiHeaders = config.headers.find(rule => rule.source === "/api/:path*")?.headers || [];
  assert.ok(apiHeaders.some(header => header.key === "x-vercel-enable-rewrite-caching" && header.value === "0"));
  assert.ok(apiHeaders.some(header => header.key === "Cache-Control" && /no-store/.test(header.value)));

  const globalHeaders = config.headers.find(rule => rule.source === "/:path*")?.headers || [];
  assert.ok(globalHeaders.some(header => header.key === "Permissions-Policy" && header.value === "microphone=(self)"));
});

test("GitHub validates the complete application instead of publishing a disconnected static copy", async () => {
  const workflow = await read(".github/workflows/quality.yml");
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /tsc --noEmit --incremental false/);
  assert.match(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /deploy-pages|build:static/);
});
