import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(path,"utf8");

test("canonical PWA remains untouched and Android recovery uses a distinct fixed identity",()=>{
 const main=source("app/manifest.ts");
 const alternate=source("app/manifest-resgate.webmanifest/route.ts");
 const entry=source("app/reinstalar/page.tsx");
 assert.match(main,/id: "\/"/);
 assert.match(main,/start_url: "\/\?abrir=aventura"/);
 assert.match(alternate,/id: "\/myowndex-resgate"/);
 assert.match(alternate,/start_url: "\/reinstalar\?abrir=aventura"/);
 assert.match(alternate,/import baseManifest from "\.\.\/manifest"/);
 assert.match(alternate,/\.\.\.canonical/);
 assert.match(entry,/manifest: "\/manifest-resgate\.webmanifest"/);
 assert.match(entry,/index: false/);
 assert.match(alternate,/no-store/);
 for(const view of ["aventura","pokedex","pc","guia"])
   assert.ok(alternate.includes(`/reinstalar?abrir=${view}`),view);
 assert.ok(!alternate.includes('id: "/myowndex-resgate-2'),"Never change rescue identity with release numbers");
});

test("recovery is opt-in, stays on one origin and preserves user data",()=>{
 const ui=source("src/components/Shared/RecoveryInstaller.jsx");
 assert.match(ui,/if \(appWindow === true\) return <ErrorBoundary><App/);
 assert.match(ui,/serviceWorker\.register\("\/sw\.js"/);
 assert.match(ui,/!confirmed \|\| busy/);
 assert.match(ui,/event\.userChoice/);
 assert.match(ui,/window\.addEventListener\("beforeinstallprompt", onPrompt\)/);
 assert.match(ui,/window\.addEventListener\("appinstalled", onInstalled\)/);
 assert.doesNotMatch(ui,/localStorage\.(?:clear|removeItem)/);
 assert.doesNotMatch(ui,/indexedDB\.deleteDatabase/);
 assert.doesNotMatch(ui,/caches\.delete/);
 const sw=source("public/sw.js");
 assert.ok(sw.includes('"/manifest-resgate.webmanifest"'));
 assert.ok(sw.includes('"/reinstalar?abrir=aventura"'));
 assert.match(sw,/new URL\(request\.url\)\.pathname === "\/" \? ROOT_FALLBACK : request/);
 assert.match(sw,/rememberPage\(response\.clone\(\), request\)/);
});
