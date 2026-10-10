import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {inspectDeployment,STATIC_LIMIT_BYTES,INDIVIDUAL_LIMIT_BYTES} from "../scripts/verificar-deployment.mjs";

const fixture=()=>{const base=fs.mkdtempSync(path.join(os.tmpdir(),"myowndex-deploy-"));fs.mkdirSync(path.join(base,"public"));return base};
test("deployment audit allows necessary artwork without touching user data",()=>{
 const base=fixture();
 try{
  fs.mkdirSync(path.join(base,"public","sprites","native"),{recursive:true});
  fs.writeFileSync(path.join(base,"public","sprites","native","healthy.gif"),"GIF");
  fs.writeFileSync(path.join(base,"public","index.html"),"<html/>");
  assert.equal(inspectDeployment(base).files,2);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test("deployment audit blocks backups, logs, ZIPs and accidental binary copies",()=>{
 for(const filename of ["debug.log","dump.zip","session.db","backup.bak","orphan.tmp"]){
  const base=fixture();
  try{
   fs.writeFileSync(path.join(base,"public",filename),"garbage");
   assert.throws(()=>inspectDeployment(base),/temporário/,filename);
  }finally{fs.rmSync(base,{recursive:true,force:true})}
 }
});
test("deployment audit enforces file budget and an explicit static release budget",()=>{
 assert.equal(STATIC_LIMIT_BYTES,140*1024*1024);
 assert.equal(INDIVIDUAL_LIMIT_BYTES,4*1024*1024);
 const base=fixture();
 try{
  fs.writeFileSync(path.join(base,"public","oversize.bin"),Buffer.alloc(INDIVIDUAL_LIMIT_BYTES+1));
  assert.throws(()=>inspectDeployment(base),/excessivo/);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test("Next only traces runtime files and Vercel still receives the sprite build inputs",()=>{
 const config=fs.readFileSync(new URL("../next.config.ts",import.meta.url),"utf8");
 const ignore=fs.readFileSync(new URL("../.vercelignore",import.meta.url),"utf8");
 const packageJson=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));
 assert.match(config,/outputFileTracingExcludes/);
 assert.match(config,/assets\/sprites-2d\/\*\*/);
 assert.doesNotMatch(ignore,/^assets\/sprites-2d\s*$/m);
 assert.match(ignore,/!scripts\/materializar-sprites-2d\.mjs/);
 assert.match(ignore,/!scripts\/verificar-deployment\.mjs/);
 assert.equal(packageJson.scripts.postbuild,"node scripts/verificar-deployment.mjs");
});
