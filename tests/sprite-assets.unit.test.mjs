import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

const paeth=(a,b,c)=>{
  const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
};

const parsePng=buffer=>{
  assert.equal(buffer.subarray(0,8).compare(SIGNATURE),0,"valid PNG signature");
  let offset=8,width=0,height=0,bitDepth=0,colorType=0,interlace=0,trns=null;
  const idat=[];
  while(offset<buffer.length){
    const length=buffer.readUInt32BE(offset);offset+=4;
    const type=buffer.toString("ascii",offset,offset+4);offset+=4;
    const data=buffer.subarray(offset,offset+length);offset+=length+4;
    if(type==="IHDR"){
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];colorType=data[9];interlace=data[12];
    } else if(type==="tRNS") trns=Buffer.from(data);
    else if(type==="IDAT") idat.push(data);
    else if(type==="IEND") break;
  }
  assert.ok(width>0&&height>0);
  assert.equal(interlace,0,"companion masters must stay non-interlaced for the lightweight audit");
  assert.ok([3,6].includes(colorType),`unsupported companion PNG color type ${colorType}`);
  if(colorType===3) assert.ok([1,2,4,8].includes(bitDepth));
  if(colorType===6) assert.equal(bitDepth,8);

  const rowBytes=colorType===6?width*4:Math.ceil(width*bitDepth/8);
  const bpp=colorType===6?4:1;
  const raw=inflateSync(Buffer.concat(idat));
  assert.equal(raw.length,height*(rowBytes+1));
  const rows=[];
  let cursor=0,previous=Buffer.alloc(rowBytes);
  for(let y=0;y<height;y++){
    const filter=raw[cursor++],source=raw.subarray(cursor,cursor+rowBytes);cursor+=rowBytes;
    const row=Buffer.alloc(rowBytes);
    for(let x=0;x<rowBytes;x++){
      const left=x>=bpp?row[x-bpp]:0,up=previous[x]||0,upLeft=x>=bpp?(previous[x-bpp]||0):0;
      const value=source[x];
      if(filter===0) row[x]=value;
      else if(filter===1) row[x]=(value+left)&255;
      else if(filter===2) row[x]=(value+up)&255;
      else if(filter===3) row[x]=(value+Math.floor((left+up)/2))&255;
      else if(filter===4) row[x]=(value+paeth(left,up,upLeft))&255;
      else assert.fail(`unsupported PNG filter ${filter}`);
    }
    rows.push(row);previous=row;
  }
  const paletteIndex=(row,x)=>{
    if(bitDepth===8)return row[x];
    const perByte=8/bitDepth,shift=8-bitDepth*((x%perByte)+1),mask=(1<<bitDepth)-1;
    return (row[Math.floor(x/perByte)]>>shift)&mask;
  };
  const alphaAt=(x,y)=>{
    const row=rows[y];
    if(colorType===6)return row[x*4+3];
    const index=paletteIndex(row,x);
    return trns&&index<trns.length?trns[index]:255;
  };
  return {width,height,alphaAt};
};

test("every decorative Pokémon master is transparent, padded and impossible to crop at rest",async()=>{
  const companionSource=await readFile("src/components/Shared/PokemonCompanion.jsx","utf8");
  const ids=[...companionSource.matchAll(/id:\s*(\d+)/g)].map(match=>Number(match[1]));
  assert.ok(ids.length>=8,"every primary surface keeps a registered partner");
  assert.equal(new Set(ids).size,ids.length,"each decorative partner owns one registry entry");

  for(const id of ids){
    const png=parsePng(await readFile(`public/sprites/companions/${id}.png`));
    let opaque=0,minX=png.width,minY=png.height,maxX=-1,maxY=-1;
    for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
      if(png.alphaAt(x,y)>0){
        opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      }
    }
    assert.ok(opaque>0,`${id}.png must contain visible pixels`);
    assert.ok(opaque<png.width*png.height*.72,`${id}.png must keep meaningful transparent space`);
    assert.ok(minX>=1&&minY>=1&&maxX<=png.width-2&&maxY<=png.height-2,
      `${id}.png needs a transparent safety border: bbox ${minX},${minY}–${maxX},${maxY} in ${png.width}x${png.height}`);
    for(let x=0;x<png.width;x++){
      assert.equal(png.alphaAt(x,0),0,`${id}.png top edge must be transparent`);
      assert.equal(png.alphaAt(x,png.height-1),0,`${id}.png bottom edge must be transparent`);
    }
    for(let y=0;y<png.height;y++){
      assert.equal(png.alphaAt(0,y),0,`${id}.png left edge must be transparent`);
      assert.equal(png.alphaAt(png.width-1,y),0,`${id}.png right edge must be transparent`);
    }
  }
});


const inspectGif=buffer=>{
  assert.equal(buffer.subarray(0,3).toString("ascii"),"GIF");
  let frames=0,transparentControls=0,controls=0;
  for(let index=0;index<buffer.length-7;index+=1){
    if(buffer[index]===0x2c) frames+=1;
    if(buffer[index]===0x21&&buffer[index+1]===0xf9&&buffer[index+2]===0x04){
      controls+=1;
      if(buffer[index+3]&1) transparentControls+=1;
    }
  }
  return {frames,controls,transparentControls};
};

test("decorative partners use animated transparent GIF masters and one RotomDex identity", async () => {
  const companionFiles=await readdir("public/sprites/companions");
  const gifs=companionFiles.filter(name=>name.endsWith(".gif"));
  const pngs=companionFiles.filter(name=>name.endsWith(".png"));
  assert.ok(gifs.length>=8&&pngs.length>=8,"every partner keeps animated and recovery masters");
  for(const name of gifs){
    const meta=inspectGif(await readFile(`public/sprites/companions/${name}`));
    assert.ok(meta.frames>1,`${name} must contain natural authored animation`);
    assert.ok(meta.controls>0&&meta.transparentControls===meta.controls,`${name} must keep transparent animated frames`);
  }
  const component=await readFile("src/components/Shared/PokemonCompanion.jsx","utf8");
  assert.match(component,/\/sprites\/companions\/\$\{companion\.id\}\.gif/);
  assert.doesNotMatch(component,/myowndex-companion-idle|myowndex-companion-pop/);
  const source=await Promise.all([
    readFile("src/App.jsx","utf8"),
    readFile("app/layout.tsx","utf8"),
    readFile("app/manifest.ts","utf8"),
    readFile("public/sw.js","utf8"),
  ]);
  for(const text of source){
    assert.match(text,/myowndex-rotomdex-v101\.svg/);
    assert.doesNotMatch(text,/myowndex-(?:icon|maskable)-v100|favicon-v100/);
  }
});
