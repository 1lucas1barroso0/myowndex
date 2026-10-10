// Real Chromium regression: visual weather is animated, accessible and lightweight.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({headless:true,args:["--no-sandbox"], ...(proxy ? { proxy:{server:proxy,bypass:"localhost,127.0.0.1,::1"} } : {})});
const page = await browser.newPage({viewport:{width:1280,height:900},reducedMotion:"no-preference",serviceWorkers:"block"});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const baseUrl=process.env.MYOWNDEX_SMOKE_URL || "http://127.0.0.1:3000";
try {
    await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
    await page.locator(".app-root.game-edition.handheld-edition").waitFor();
    assert.equal(await page.getByRole("button",{name:"Instalar aplicativo"}).count(),0);
    assert.equal(await page.getByRole("dialog",{name:"Instalar o MyOwnDex"}).count(),0);
    const manifest=await (await page.request.get(new URL("/manifest.webmanifest",baseUrl).href)).json();
    assert.equal(manifest.display,"standalone");
    assert.equal(manifest.start_url,"/?abrir=aventura");
    await page.getByRole("button",{name:"Abrir o PC do Bill"}).click();
    const stage=page.locator(".pc-mascot-stage");await stage.waitFor();
    const mascot=await stage.evaluate(node=>{
        const s=getComputedStyle(node),a=getComputedStyle(node,"::before");
        const p=getComputedStyle(node.querySelector(".pokemon-companion"));
        return {border:s.borderTopWidth,background:s.backgroundColor,before:a.content,companionBorder:p.borderTopWidth};
    });
    assert.equal(mascot.border,"0px");
    assert.equal(mascot.before,"none");
    assert.equal(mascot.companionBorder,"0px");
    assert.equal(mascot.background,"rgba(0, 0, 0, 0)");
    await page.evaluate(()=>{
        const root=document.querySelector(".app-root");
        const board=document.createElement("div");
        board.id="weather-qa";board.className="battlefield-board scene-floresta";
        Object.assign(board.style,{width:"min(100%, 480px)",aspectRatio:"3 / 2",position:"relative"});
        root.append(board);
    });
    const weather=["chuva","neve","sol","areia","nevoa"];
    for(const motion of ["no-preference","reduce"]){
        await page.emulateMedia({reducedMotion:motion});
        for(const theme of ["normal","night"]){
            await page.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
            for(const state of weather){
                const v=await page.evaluate(state=>{
                    const el=document.getElementById("weather-qa");el.className="battlefield-board scene-floresta weather-"+state;
                    const read=part=>{const c=getComputedStyle(el,part);return {content:c.content,animation:c.animationName,background:c.backgroundImage,opacity:Number(c.opacity),pointer:c.pointerEvents};};
                    return {back:read("::before"),front:read("::after"),width:document.documentElement.scrollWidth};
                },state);
                assert.equal(v.width,1280, `${theme} ${state}: no horizontal overflow`);
                for(const part of [v.back,v.front]){
                    assert.equal(part.content,'""');assert.equal(part.pointer,"none");
                    assert.notEqual(part.background,"none");
                    assert.ok(part.opacity>0&&part.opacity<1);
                    if(motion==="reduce")assert.equal(part.animation,"none",`${state}: reduced motion`);
                    else assert.match(part.animation,/myowndex-(rain|snow|sun|sand|fog)-/,`${state}: animation`);
                }
                console.log("Weather check:",theme,state,motion);
            }
        }
    }
    assert.deepEqual(errors,[]);
    console.log("Passed 20 moving/reduced weather cases, Porygon frame and app manifest.");
} finally { await browser.close(); }
