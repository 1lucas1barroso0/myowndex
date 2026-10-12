import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const variants=[
 ["32",32],["96",96],["180",180],["192",192],
 ["app-512",512],["maskable-512",512],
];
test("approved v105 human artwork is byte-identical across fresh PWA installation icon aliases",()=>{
 for(const [key,size] of variants){
  const original=readFileSync(`public/icons/myowndex-dex-v105-${key}.png`);
  const current=readFileSync(`public/icons/myowndex-dex-v105-r2-${key}.png`);
  const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest(current),digest(original),key+" must preserve the approved art");
  assert.equal(current.toString("hex",0,8),"89504e470d0a1a0a");
  assert.equal(current.readUInt32BE(16),size);
  assert.equal(current.readUInt32BE(20),size);
 }
});
test("install meta, stable manifest and new icon aliases all refer to the same approved v105 identity",()=>{
 const layout=readFileSync("app/layout.tsx","utf8");
 const manifest=readFileSync("app/manifest.ts","utf8");
 const worker=readFileSync("public/sw.js","utf8");
 const install=readFileSync("src/components/Shared/AppInstallControl.jsx","utf8");
 assert.match(layout,/manifest: "\/manifest\.webmanifest"/);
 assert.match(manifest,/id: "\/"/);
 assert.match(manifest,/scope: "\/"/);
 assert.match(manifest,/start_url: "\/\?abrir=aventura"/);
 for(const [name] of variants){
  assert.ok(layout.includes(`myowndex-dex-v105-r2-${name}.png`) || manifest.includes(`myowndex-dex-v105-r2-${name}.png`));
 }
 assert.match(worker,/"\/manifest\.webmanifest"/);
 assert.ok(!worker.includes("/manifest.webmanifest?v="));
 assert.ok(!install.includes("setInstalled(true)"),"Install event must not become a persisted or permanent installed flag");
 assert.match(install,/window\.addEventListener\("appinstalled", onInstalled\)/);
 assert.match(install,/window\.addEventListener\("pageshow", checkWindowMode\)/);
 assert.doesNotMatch(install,/localStorage\.(?:clear|removeItem|setItem)/);
});
