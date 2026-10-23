import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareOfflineAssets, OfflineBuildAssetsPlugin } from '../scripts/preparar-offline.mjs';

const fixture = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'myowndex-offline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'public'));
  fs.mkdirSync(path.join(root, '.next/static/chunks/app'), { recursive: true });
  fs.mkdirSync(path.join(root, '.next/static/css'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({version:'2.1.0'}));
  return root;
};
const compile = (root, assets, version = '2.1.0') => fs.writeFileSync(path.join(root, '.next/offline-build-assets.json'), JSON.stringify({version, assets: assets.map(name => 'static/' + name)}));
const write = (root, name, text) => fs.writeFileSync(path.join(root,'.next/static',name),text);

test('offline manifest pins current lazy features and ignores stale hashes left by previous compilations', t => {
  const root = fixture(t);
  for (const [file, text] of [['chunks/app/page-a.js','boot'],['chunks/lazy-room-b.js','room'],['css/style-c.css','css'],['chunks/private.map','source'],['chunks/secret.json','private'],['chunks/old.js','obsolete code']]) write(root,file,text);
  compile(root, ['chunks/app/page-a.js','chunks/lazy-room-b.js','css/style-c.css']);
  const manifest = prepareOfflineAssets(root);
  assert.equal(manifest.version, '2.1.0');
  assert.equal(manifest.bytes, 11);
  assert.deepEqual(manifest.assets.map(asset=>asset.path), ['/_next/static/chunks/app/page-a.js','/_next/static/chunks/lazy-room-b.js','/_next/static/css/style-c.css']);
  // A second build leaves old bytes on disk; only its actual emitted list wins.
  write(root,'chunks/lazy-room-new.js','new code');
  compile(root, ['chunks/app/page-a.js','chunks/lazy-room-new.js','css/style-c.css']);
  assert.equal(prepareOfflineAssets(root).bytes,15);
  assert.ok(!prepareOfflineAssets(root).assets.some(asset=>asset.path.includes('room-b')));
  write(root,'chunks/oversize.js',Buffer.alloc(4*1024*1024+1));
  compile(root, ['chunks/oversize.js']);
  assert.throws(()=>prepareOfflineAssets(root),/orçamento/);
});

test('offline preparation rejects missing, stale or unsafe compilation lists without replacing a good manifest', t => {
  const root = fixture(t);
  write(root, 'chunks/good.js', 'good');
  compile(root, ['chunks/good.js']);
  prepareOfflineAssets(root);
  const previous=fs.readFileSync(path.join(root,'public/offline-assets.json'),'utf8');
  for (const [assets,version] of [[['chunks/good.js'],'old'],[['../package.js'],'2.1.0'],[['chunks/missing.js'],'2.1.0'],[['chunks/good.js','chunks/good.js'],'2.1.0']]) {
    compile(root, assets, version);
    assert.throws(()=>prepareOfflineAssets(root));
    assert.equal(fs.readFileSync(path.join(root,'public/offline-assets.json'),'utf8'),previous);
  }
  fs.symlinkSync(path.join(root,'.next/static/chunks/good.js'),path.join(root,'.next/static/chunks/link.js'));
  compile(root,['chunks/link.js']);
  assert.throws(()=>prepareOfflineAssets(root),/simbólicos/);
  fs.rmSync(path.join(root,'.next/offline-build-assets.json'));
  assert.throws(()=>prepareOfflineAssets(root));
  assert.equal(fs.readFileSync(path.join(root,'public/offline-assets.json'),'utf8'),previous);
});


test('the client compilation boundary includes lazy screens but excludes API route stubs and old disk hashes', t => {
  const root=fixture(t);
  write(root,'chunks/app/page.js','page');write(root,'chunks/lazy.js','lazy');write(root,'chunks/old.js','old');
  let afterEmit;
  new OfflineBuildAssetsPlugin('2.1.0').apply({outputPath:path.join(root,'.next'),hooks:{afterEmit:{tap:(_name,callback)=>{afterEmit=callback;}}}});
  afterEmit({getAssets:()=>['static/chunks/app/page.js','static/chunks/lazy.js','static/chunks/app/api/rooms/[code]/route.js'].map(name=>({name}))});
  assert.deepEqual(prepareOfflineAssets(root).assets.map(asset=>asset.path),['/_next/static/chunks/app/page.js','/_next/static/chunks/lazy.js']);
});
