import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const MiB=1024*1024;
export const STATIC_LIMIT_BYTES=140*MiB;
export const INDIVIDUAL_LIMIT_BYTES=4*MiB;
const unexpectedFile=/(?:^|\/)(?:__pycache__|node_modules|\.next|\.git|coverage|test-results|playwright-report|tmp)(?:\/|$)|\.(?:zip|tar|tgz|bak|tmp|log|sqlite|db)$/i;
const safeFiles=(base,directory,results=[])=>{
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const absolute=path.join(directory,entry.name);
    if(entry.isSymbolicLink())throw new Error("Artefato público contém link simbólico: "+path.relative(base,absolute));
    if(entry.isDirectory()){safeFiles(base,absolute,results);continue;}
    if(!entry.isFile())throw new Error("Entrada pública desconhecida: "+path.relative(base,absolute));
    results.push({path:path.relative(base,absolute).replaceAll(path.sep,"/"),bytes:fs.statSync(absolute).size});
  }
  return results;
};
export const inspectDeployment=(projectRoot=root)=>{
  const publicRoot=path.join(projectRoot,"public");
  if(!fs.existsSync(publicRoot))throw new Error("A pasta pública é obrigatória.");
  const files=safeFiles(publicRoot,publicRoot);
  for(const file of files){
    if(unexpectedFile.test(file.path))throw new Error("Arquivo temporário não pode ser publicado: "+file.path);
    if(file.bytes>INDIVIDUAL_LIMIT_BYTES)throw new Error("Arquivo público excessivo: "+file.path+" ("+file.bytes+" bytes)");
  }
  const bytes=files.reduce((sum,item)=>sum+item.bytes,0);
  if(bytes>STATIC_LIMIT_BYTES)throw new Error(
    "Artefatos estáticos atingiram "+(bytes/MiB).toFixed(1)+" MiB (limite "+(STATIC_LIMIT_BYTES/MiB)+" MiB). Audite duplicações antes do deploy."
  );
  const sprites=files.filter(file=>/^sprites\/native\/2d-[a-f0-9]{24}\.(?:gif|apng|png)$/.test(file.path));
  const manifestPath=path.join(projectRoot,"assets/sprites-2d/index.json");
  if(fs.existsSync(manifestPath)){
    const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
    if(!Number.isInteger(manifest.entries)||manifest.entries<1||manifest.entries!==sprites.length)
      throw new Error("Sprites do release incompletos ou duplicados: "+sprites.length+" / "+manifest.entries);
    const expectedBytes=manifest.bytes;
    const actualBytes=sprites.reduce((total,sprite)=>total+sprite.bytes,0);
    if(actualBytes!==expectedBytes)throw new Error("Bytes dos sprites não correspondem ao manifesto verificado.");
  }
  return {files:files.length,bytes,mb:Number((bytes/MiB).toFixed(2)),sprites:sprites.length};
};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=inspectDeployment();
  console.log("Auditoria de artefatos: "+result.mb+" MiB públicos, "+result.files+" arquivos, "+result.sprites+" sprites 2D verificados. Nenhum temporário ou pacote duplicado.");
}
