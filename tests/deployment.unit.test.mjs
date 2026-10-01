import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Vercel builds the complete native Next runtime without an external gateway", async () => {
  const config = JSON.parse(await read("vercel.json"));
  assert.equal(config.framework, "nextjs");
  assert.equal(config.buildCommand, "npm run build");
  assert.equal(config.outputDirectory, ".next");
  assert.equal(config.rewrites, undefined);

  const packageJson = JSON.parse(await read("package.json"));
  assert.match(packageJson.scripts.build, /^next build/);
  assert.match(packageJson.scripts.dev, /^next dev/);
  assert.match(packageJson.scripts.start, /^next start/);
  assert.equal(packageJson.dependencies.vinext, undefined);
  assert.equal(packageJson.devDependencies.wrangler, undefined);

  const apiHeaders = config.headers.find(rule => rule.source === "/api/:path*")?.headers || [];
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
