import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import sharp from "sharp";

const variants=[
 ["32",32],["96",96],["180",180],["192",192],
 ["app-512",512],["maskable-512",512],
];
test("every current install icon renders the same outlined Pokédex source",async()=>{
 const source=readFileSync('public/icons/myowndex-dex-v105-r4-source.svg');
 for(const [key,size] of variants){
  const current=readFileSync(`public/icons/myowndex-dex-v105-r4-${key}.png`);
  const artwork=await sharp(source).resize(key==='maskable-512'?Math.floor(size*.76):size,key==='maskable-512'?Math.floor(size*.76):size).png({compressionLevel:9}).toBuffer();
  const expected=['32','96'].includes(key)?artwork:await sharp({create:{width:size,height:size,channels:4,background:{r:255,g:225,b:107,alpha:1}}}).composite([{input:artwork,gravity:'centre'}]).png({compressionLevel:9}).toBuffer();
  assert.deepEqual(current,expected,key+' must share the current source and framing');
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
  assert.ok(layout.includes(`myowndex-dex-v105-r4-${name}.png`) || manifest.includes(`myowndex-dex-v105-r4-${name}.png`));
 }
 assert.match(worker,/"\/manifest\.webmanifest"/);
 assert.ok(!worker.includes("/manifest.webmanifest?v="));
 assert.ok(!install.includes("setInstalled(true)"),"Install event must not become a persisted or permanent installed flag");
 assert.match(install,/window\.addEventListener\("appinstalled", onInstalled\)/);
 assert.match(install,/window\.addEventListener\("pageshow", checkWindowMode\)/);
 assert.doesNotMatch(install,/localStorage\.(?:clear|removeItem|setItem)/);
});
