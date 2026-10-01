import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.MYOWNDEX_SMOKE_URL;

test("native Next serves the application, manifest and icons", { skip: !baseUrl }, async () => {
  const response = await fetch(new URL("/", baseUrl), { headers: { accept: "text/html" } });

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="pt-BR"/);
  assert.match(html, /<title>MyOwnDex<\/title>/);
  assert.match(html, /rel="manifest"[^>]*href="\/manifest.webmanifest"/);
  assert.doesNotMatch(html, /chatgpt\.site|codex-preview|signin-with-chatgpt/);
  const manifestResponse = await fetch(new URL("/manifest.webmanifest", baseUrl));
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.short_name, "MyOwnDex");
  assert.equal(manifest.start_url, "/");
  const icon = await fetch(new URL(manifest.icons[0].src, baseUrl));
  assert.equal(icon.status, 200);
});
