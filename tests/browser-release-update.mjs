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
  assert.deepEqual(errors,[]);
  console.log("PASS release endpoint no-store, active PWA, current version and retained local data");
}finally{await browser.close();}
