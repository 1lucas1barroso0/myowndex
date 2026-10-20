// A disposable guest lobby: layout, real role buttons and reachability; no room creation.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const proxy = process.env.MYOWNDEX_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({ headless:true, args:["--no-sandbox"], ...(proxy ? {proxy:{server:proxy,bypass:"localhost,127.0.0.1,::1"}} : {}) });
const base = process.env.MYOWNDEX_SMOKE_URL || "http://localhost:3000";
const errors = [], writes = [];
let checks = 0;
let currentPage;
async function review(page, name) {
    if (process.env.MYOWNDEX_REVIEW_IMAGES !== "1") return;
    await page.waitForFunction(() => {
        const frame = document.querySelector(".adventure-intro .pokemon-sized-sprite"), image = frame?.querySelector("img");
        return frame && getComputedStyle(frame).opacity === "1" && image?.complete && image.naturalWidth > 0;
    });
    const encoded = (await page.screenshot({type:"png"})).toString("base64");
    const count = Math.ceil(encoded.length / 8000);
    for (let i=0;i<count;i++) console.log(`ADVENTURE_REVIEW|${name}|${i}|${count}|${encoded.slice(i*8000,(i+1)*8000)}`);
}
try {
    for (const width of [320,390,768,1280]) {
        const context = await browser.newContext({viewport:{width,height:844},serviceWorkers:"block",reducedMotion:"reduce"});
        await context.route("**/api/**", route => {
            if (["GET","HEAD","OPTIONS"].includes(route.request().method())) return route.fallback();
            writes.push(route.request().url()); return route.abort();
        });
        const page = await context.newPage();
        currentPage = page;
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(new URL("/?abrir=aventura",base).href,{waitUntil:"domcontentloaded"});
        const lobby = page.locator(".room-lobby"), area = page.locator("#main-content");
        await lobby.waitFor();
        const narrator = lobby.getByRole("button",{name:"Criar uma aventura em grupo",exact:true});
        const player = lobby.getByRole("button",{name:"Entrar via convite",exact:true});
        const read = () => page.evaluate(() => {
            const area = document.querySelector("#main-content"), a = area.getBoundingClientRect();
            const hero = document.querySelector(".adventure-intro").getBoundingClientRect();
            const choices = document.querySelector(".room-entry-choices").getBoundingClientRect();
            return {hero:hero.top-a.top+area.scrollTop,choices:choices.top-a.top+area.scrollTop,overflow:document.documentElement.scrollWidth>innerWidth,outerScroll:scrollY};
        });
        for (const theme of ["normal","night"]) {
            await page.evaluate(value => document.documentElement.dataset.theme=value,theme);
            await page.evaluate(() => document.fonts.ready.then(() => true));
            for (const level of width<=700 ? [4,0] : [null]) {
                if (level!==null) {
                    await page.locator(".app-curtain-grip").press(level===0 ? "Home" : "End");
                    await page.waitForFunction(value => document.querySelector(".app-header").dataset.curtainLevel===String(value),level);
                }
                await area.evaluate(e => e.scrollTop=0);
                const initial = await read();
                assert.ok(initial.hero>=8 && initial.hero<=80,`Bounded top spacing at ${width}px, ${theme}, curtain ${level}: ${initial.hero}`);
                assert.equal(initial.overflow,false); assert.equal(initial.outerScroll,0);
                if (width===390 && theme==="normal" && level===4) await review(page,"mobile-start");
                if (width===1280 && theme==="night") await review(page,"desktop-start");
                for (const [control,formName] of [[narrator,"Criar aventura"],[player,"Entrar na aventura"]]) {
                    await control.click();
                    const form = lobby.getByRole("form",{name:formName,exact:true});
                    await form.waitFor();
                    const current = await read();
                    assert.ok(Math.abs(current.hero-initial.hero)<1 && Math.abs(current.choices-initial.choices)<1,
                        `Opening ${formName} preserves the title and role positions at ${width}px`);
                    assert.equal(await lobby.locator("form:visible").count(),1);
                    assert.equal(current.overflow,false); assert.equal(current.outerScroll,0);
                    if (width===390 && theme==="normal" && level===0 && formName==="Entrar na aventura") {
                        await area.evaluate(e => e.scrollTop=0); await review(page,"mobile-invite");
                    }
                    const submit=form.getByRole("button",{name:formName==="Criar aventura"?"Abrir nova aventura":"Entrar na aventura",exact:true});
                    await submit.scrollIntoViewIfNeeded();
                    const button=await submit.boundingBox(), viewport=await area.boundingBox();
                    assert.ok(button.y>=viewport.y-1 && button.y+button.height<=viewport.y+viewport.height+1,"The action remains reachable inside the game area");
                    assert.equal(await page.evaluate(()=>scrollY),0);
                    await area.evaluate(e => e.scrollTop=0);
                    checks++;
                }
                await player.click(); await area.evaluate(e => e.scrollTop=0);
                assert.equal(await lobby.locator("form:visible").count(),0);
                const closed=await read();
                assert.ok(Math.abs(closed.hero-initial.hero)<1 && Math.abs(closed.choices-initial.choices)<1,"Closing setup preserves the entry position");
                checks++;
            }
        }
        await context.close();
    }
    assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
    console.log(JSON.stringify({checks,errors,blockedWrites:writes}));
} catch (error) {
    if (currentPage && !currentPage.isClosed()) await review(currentPage,"failure").catch(()=>{});
    throw error;
} finally { await browser.close(); }
