// Real API/SQLite integration. Disposable room only; never mutate production.
import assert from "node:assert/strict";

const url=process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
assert.ok(["localhost","127.0.0.1","[::1]"].includes(new URL(url).hostname),"Shared dice QA requires a local test database");
const {chromium}=await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const browser=await chromium.launch({headless:true,executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
const page=await context.newPage();
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
let room;
let rollRequests=0;
page.on("request",request=>{if(/\/api\/rooms\/[^/]+\/rolls$/.test(new URL(request.url()).pathname))rollRequests++;});
try {
  await page.goto(url);
  await page.getByRole("button",{name:"Abrir a Central da Aventura",exact:true}).click();
  const lobby=page.locator(".room-lobby-card.is-narrator");
  await lobby.getByLabel("Nome da aventura",{exact:true}).fill("Dados QA");
  await lobby.getByLabel("Seu nome na aventura",{exact:true}).fill("Narrador QA");
  await lobby.getByRole("button",{name:"Abrir nova aventura",exact:true}).click();
  await page.locator(".room-app").waitFor();
  room=await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_live_room_v1")));
  assert.equal(room.local,false);
  for(const theme of ["Claro","Escuro"]) {
    await page.getByRole("radio",{name:theme,exact:true}).click();
    await page.getByRole("button",{name:"Abrir Dados",exact:true}).filter({visible:true}).first().click();
    const dialog=page.getByRole("dialog",{name:"Dados",exact:true});
    assert.equal(await dialog.locator(".local-dice-pages,.local-dice-history").count(),0);
    assert.equal(await dialog.locator(".local-dice-options").evaluate(element=>element.open),false,"empty saved difficulty stays collapsed");
    for(const kind of ["attribute","percent","free"]) {
      await dialog.getByRole("button",{name:kind==="attribute"?"2d6 Teste":kind==="percent"?"d100 Chance":"dX Livre",exact:true}).click();
      if(kind!=="free")await dialog.getByRole("combobox",{name:"Modo",exact:true}).selectOption("disadvantage");
      if(kind==="attribute")await dialog.getByLabel("Modificador",{exact:true}).fill("-3");
      if(kind==="percent")await dialog.getByLabel("Chance base (%)",{exact:true}).fill("50");
      if(kind==="free") {
        await dialog.getByLabel("Quantidade",{exact:true}).fill("20");
        await dialog.getByRole("combobox",{name:"Dado",exact:true}).selectOption("100");
        await dialog.getByLabel("Modificador",{exact:true}).fill("-4");
      }
      const response=page.waitForResponse(response=>/\/api\/rooms\/[^/]+\/rolls$/.test(new URL(response.url()).pathname) && response.request().method()==="POST");
      const before=rollRequests;
      await dialog.getByRole("button",{name:/^Rolar /}).click();
      const network=await response;
      assert.equal(network.status(),200);
      const authoritative=(await network.json()).result;
      await page.waitForFunction(total=>document.querySelector(".local-dice-total")?.textContent===String(total),authoritative.audit.result);
      assert.deepEqual(await dialog.locator(".local-dice-faces b").allTextContents(),authoritative.audit.rawDice.map(String));
      assert.equal(await dialog.locator(".local-dice-faces .is-kept").count(),authoritative.audit.keptDice.length);
      assert.equal(rollRequests,before+1,"one click makes one server request, with no redraw");
      if(kind==="percent")assert.match(await dialog.locator(".local-dice-verdict").innerText(),authoritative.audit.success?/Sucesso/:/Falha/);
      for(const width of [320,390,768,1280,1440]) {
        await page.setViewportSize({width,height:844});
        const fit=await dialog.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right,
          escaped:[...element.querySelectorAll("button,.room-select,.local-dice-faces li,.local-dice-total")].filter(node=>node.getClientRects().length && (!node.closest("details:not([open])") || node.tagName==="SUMMARY")).filter(node=>{const rect=node.getBoundingClientRect();return rect.left<0 || rect.right>innerWidth+1;}).map(node=>node.textContent)}));
        assert.ok(fit.scroll<=fit.width+1 && fit.left>=0 && fit.right<=width+1,`${theme} ${kind} fits at ${width}`);
        assert.deepEqual(fit.escaped,[]);
      }
      console.log(`PASS shared-${theme}-${kind}-exact-server-receipt-320-to-1440`);
    }
    await dialog.getByRole("button",{name:"Fechar dados",exact:true}).click();
  }
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("myowndex_local_roll_history_v3") || "[]").length),0,"shared receipts stay in the Adventure Diary");
  assert.deepEqual(errors,[]);
  console.log("PASS shared-history-is-not-duplicated-and-no-runtime-errors");
} catch(error) {
  console.error(await page.locator(".local-dice-dialog").innerText());
  console.error(await page.locator(".local-dice-dialog select").evaluateAll(nodes=>nodes.map(node=>({label:node.closest("label")?.innerText,aria:node.getAttribute("aria-label"),disabled:node.disabled,html:node.outerHTML}))));
  await page.screenshot({path:"/tmp/myowndex-final38-shared-failure.png"});
  throw error;
} finally {
  if(room && !room.local) {
    const response=await context.request.delete(`${new URL(url).origin}/api/rooms/${room.code}`,{headers:{origin:new URL(url).origin,"x-myowndex-room-protocol":"3","x-myowndex-room-key":room.key},data:{}});
    assert.equal(response.status(),200,"disposable QA room is removed");
  }
  await context.close();await browser.close();
}
