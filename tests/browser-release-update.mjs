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
  assert.ok(installedManifest.icons.every(icon=>icon.src.includes("/icons/myowndex-dex-v105-r2-")));
  assert.equal(installedManifest.id,"/");
  const browserIcon=await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  assert.equal(browserIcon,"/icons/myowndex-dex-v105-r2-180.png");
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
  // A past install notification must NOT make an ordinary browser tab claim
  // to be an installed app or hide the reinstall/recovery button.
  const installButton=page.locator(".app-install-button");
  await installButton.waitFor({state:"visible",timeout:15000});
  await page.evaluate(()=>window.dispatchEvent(new Event("appinstalled")));
  await installButton.waitFor({state:"visible"});
  assert.equal(await page.locator("html").getAttribute("data-myowndex-installed"),"false");
  await installButton.click();
  const recovery=page.getByRole("dialog",{name:"Instalar o MyOwnDex"});
  await recovery.waitFor();
  assert.match(await recovery.innerText(),/foi desinstalado, mas aparece como instalado/);
  await recovery.getByRole("button",{name:"Fechar",exact:true}).click();
  assert.equal(await page.locator("myowndex-cache-update-qa").count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem("myowndex-cache-update-qa")),"preserved");
  assert.deepEqual(errors,[]);
  console.log("PASS release endpoint no-store, active PWA, current version and retained local data");
}finally{await browser.close();}
