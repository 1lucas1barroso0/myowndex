import assert from "node:assert/strict";
import { RPG_RULE_SECTIONS } from "../src/core/rpgRules.js";
import { GUIDE_PAPER_STEPS } from "../src/core/guidePaperSteps.js";

const { chromium } = await import(process.env.MYOWNDEX_PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.MYOWNDEX_SMOKE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless:true, executablePath:process.env.MYOWNDEX_BROWSER_EXECUTABLE || undefined, args:["--no-sandbox"] });
const expectedIds = RPG_RULE_SECTIONS.flatMap(section=>section.rules.map(rule=>rule.id)).sort();
const errors=[];
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.on("pageerror", error=>errors.push(error.message));
  await page.goto(new URL("/guia/livro",baseUrl).href,{waitUntil:"domcontentloaded",timeout:60000});
  await page.getByRole("heading",{name:"Livro de regras",exact:true}).waitFor();
  const ids=await page.locator(".book-rule").evaluateAll(entries=>entries.map(element=>element.id.replace("regra-","").replace("-","."))).then(all=>all.sort());
  assert.deepEqual(ids,expectedIds);
  assert.equal(await page.locator(".book-procedure").count(),48);
  assert.equal(await page.locator(".book-canonical").count(),48);
  assert.equal(await page.locator(".book-worked-example").count(),48);
  for (const rule of RPG_RULE_SECTIONS.flatMap(section=>section.rules)) {
    const card=page.locator(`#regra-${rule.id.replace(".","-")}`);
    assert.ok((await card.locator(".book-procedure li").count())>=2,`Paper procedure ${rule.id}`);
    const body=await card.locator(".book-procedure").innerText();
    assert.ok(body.includes(GUIDE_PAPER_STEPS[rule.id][0]),`Manual content ${rule.id}`);
    assert.equal(await card.locator(".book-worked-example h5").count(),5,`All questions present for ${rule.id}`);
    if(rule.body)assert.ok((await card.locator(".book-canonical").innerText()).includes(rule.body.split(/\\n\\s*\\n/)[0]),`Full rule ${rule.id}`);
  }
  for(const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:900});
    const measure=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(measure.scroll<=measure.width+1,`Book layout at ${width}px: ${JSON.stringify(measure)}`);
  }
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator(".book-toolbar").evaluate(e=>getComputedStyle(e).display),"none");
  assert.deepEqual(errors,[]);
  console.log("Complete printable book: 48 procedures, canonical rules and four responsive widths verified.");
} finally { await browser.close(); }
