import assert from "node:assert/strict";
import packageJson from "../package.json" with {type:"json"};
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE||"playwright");
const proxy=process.env.MYOWNDEX_BROWSER_PROXY||process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"],...(proxy?{proxy:{server:proxy,bypass:"localhost,127.0.0.1,::1"}}:{})});
const base=process.env.MYOWNDEX_SMOKE_URL||"http://127.0.0.1:3000";
const context=await browser.newContext({serviceWorkers:"allow",viewport:{width:390,height:844}});
const page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(base,{waitUntil:"domcontentloaded"});
  const manifestUrl=await page.locator('link[rel="manifest"]').getAttribute("href");
  assert.equal(manifestUrl,"/manifest.webmanifest","Stable manifest URL keeps the same installed PWA identity");
  const installedManifest=await page.evaluate(async()=>fetch("/manifest.webmanifest",{cache:"no-store"}).then(r=>r.json()));
  assert.equal(installedManifest.display,"standalone");
  assert.deepEqual(installedManifest.display_override,["fullscreen","standalone"]);
  assert.equal(installedManifest.scope,"/");
  assert.ok(installedManifest.icons.some(icon=>icon.purpose==="maskable"));
  assert.ok(installedManifest.icons.every(icon=>icon.src.includes("/icons/myowndex-dex-v105-r4-")));
  assert.equal(installedManifest.id,"/");
  const browserIcon=await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  assert.equal(browserIcon,"/icons/myowndex-dex-v105-r4-180.png");
  for(const path of ["/api/version","/sw.js"]){
    const response=await context.request.get(new URL(path,base).href,{headers:{"Cache-Control":"no-cache"}});
    assert.equal(response.status(),200,path);
    assert.match(response.headers()["cache-control"]||"",/no-store/,path);
    if(path==="/api/version"){
      const current=await response.json();
      assert.equal(current.version,packageJson.version);
      assert.equal(typeof current.revision,"string");
      assert.ok(current.revision.length>0);
    }
  }
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:30000});
  const active=await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    return {script:registration.active?.scriptURL,controlled:!!navigator.serviceWorker.controller};
  });
  assert.ok(active.controlled&&active.script.endsWith("/sw.js"));
  await page.evaluate(()=>localStorage.setItem("myowndex-cache-update-qa","preserved"));
  await page.reload({waitUntil:"domcontentloaded"});
  assert.equal(await page.evaluate(()=>localStorage.getItem("myowndex-cache-update-qa")),"preserved");
  assert.equal(await page.locator(".app-root").getAttribute("data-version"),packageJson.version);
  assert.ok(await page.locator("html").getAttribute("data-release"));
  // The browser's app-installation registry cannot be controlled by a page.
  // A normal tab must continue serving data and a valid canonical manifest.
  assert.equal(await page.evaluate(()=>matchMedia("(display-mode: standalone)").matches),false);
  assert.equal(await page.evaluate(()=>matchMedia("(display-mode: fullscreen)").matches),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem("myowndex-cache-update-qa")),"preserved");
  // Recovery is a distinct *opt-in* PWA, never a mutation of the canonical app.
  // It must work even on a browser with an old installation record, without
  // deleting any origin storage or altering the ordinary application's id.
  const rescueManifestResponse=await context.request.get(new URL("/manifest-resgate.webmanifest",base).href);
  assert.equal(rescueManifestResponse.status(),200);
  assert.match(rescueManifestResponse.headers()["content-type"]||"",/application\/manifest\+json/);
  assert.match(rescueManifestResponse.headers()["cache-control"]||"",/no-store/);
  const rescueManifest=await rescueManifestResponse.json();
  assert.equal(rescueManifest.id,"/myowndex-resgate");
  assert.equal(rescueManifest.name,"MyOwnDex");
  assert.equal(rescueManifest.short_name,"MyOwnDex");
  assert.equal(rescueManifest.scope,installedManifest.scope);
  assert.equal(rescueManifest.start_url,"/reinstalar?abrir=aventura");
  assert.equal(rescueManifest.display,installedManifest.display);
  assert.deepEqual(rescueManifest.icons,installedManifest.icons,"Recovery reuses the approved v105 artwork");
  assert.ok(rescueManifest.shortcuts.every(item=>item.url.startsWith("/reinstalar?abrir=")));
  await page.goto(new URL("/reinstalar",base).href,{waitUntil:"domcontentloaded"});
  await page.getByRole("heading",{name:"Recuperar a instalação no celular"}).waitFor();
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"),"/manifest-resgate.webmanifest");
  const nativeInstall=page.getByRole("button",{name:"Instalar MyOwnDex"});
  assert.equal(await nativeInstall.isDisabled(),true);
  await page.getByRole("checkbox",{name:/Entendi que este é um caminho alternativo/}).check();
  assert.equal(await nativeInstall.isEnabled(),true);
  // Headless Chromium may not offer beforeinstallprompt automatically. The
  // fallback must give honest instructions rather than pretending to install.
  await nativeInstall.click();
  await page.getByRole("dialog",{name:"Instalação pelo navegador"}).waitFor();
  await page.getByRole("button",{name:"Entendi",exact:true}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem("myowndex-cache-update-qa")),"preserved");
  // Test the native user-choice path without installing an OS/WebAPK package.
  await page.evaluate(()=>{
    window.__myowndexRescueTestPrompt=false;
    const event=new Event("beforeinstallprompt",{cancelable:true});
    event.prompt=async()=>{window.__myowndexRescueTestPrompt=true;};
    event.userChoice=Promise.resolve({outcome:"accepted",platform:"web"});
    window.dispatchEvent(event);
  });
  await nativeInstall.click();
  await page.waitForFunction(()=>window.__myowndexRescueTestPrompt===true);
  assert.equal(await page.evaluate(()=>localStorage.getItem("myowndex-cache-update-qa")),"preserved");
  await page.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"),"/manifest.webmanifest");
  assert.equal((await page.evaluate(async()=>fetch("/manifest.webmanifest").then(r=>r.json()))).id,"/");
  assert.deepEqual(errors,[]);
  console.log("PASS release endpoint no-store, active PWA, current version and retained local data");
}finally{await browser.close();}
