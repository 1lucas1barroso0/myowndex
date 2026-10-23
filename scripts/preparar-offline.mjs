import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-derived code only. Sprites/catalogues remain bounded, warmed caches;
// personal data never belongs to this list.
export { OfflineBuildAssetsPlugin } from './offline-build-plugin.cjs';

export function prepareOfflineAssets(root, buildDirectory = '.next') {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const base = path.join(root, buildDirectory);
  // Only assets belonging to this compilation, including unopened lazy
  // features. Next may leave earlier hashes in static/ after a local rebuild.
  const compiled = JSON.parse(fs.readFileSync(path.join(base, 'offline-build-assets.json'), 'utf8'));
  if (compiled.version !== version || !Array.isArray(compiled.assets) || !compiled.assets.length
    || compiled.assets.length > 256 || new Set(compiled.assets).size !== compiled.assets.length) {
    throw new Error('A lista de código offline não corresponde ao build atual.');
  }
  const assets = [];
  for (const name of compiled.assets) {
    if (typeof name !== 'string' || !/^static\/[a-zA-Z0-9_./-]+\.(js|css)$/.test(name) || name.includes('..')) {
      throw new Error('A lista de código offline contém um caminho inválido.');
    }
    let absolute = base;
    for (const part of name.split('/')) {
      absolute = path.join(absolute, part);
      if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error('O código offline não pode conter links simbólicos.');
    }
    const file = fs.statSync(absolute);
    if (!file.isFile()) throw new Error('O código offline contém um arquivo inválido.');
    assets.push({ path: '/_next/' + name, bytes: file.size });
  }
  assets.sort((a, b) => a.path.localeCompare(b.path));
  const bytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (!assets.length || assets.length > 256 || bytes > 12 * 1024 * 1024 || assets.some(asset => asset.bytes > 4 * 1024 * 1024)) {
    throw new Error('O código offline ultrapassa o orçamento; revise o build antes de publicar.');
  }
  const manifest = { version, bytes, assets };
  fs.writeFileSync(path.join(root, 'public/offline-assets.json'), JSON.stringify(manifest) + '\n');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = prepareOfflineAssets(root, process.env.MYOWNDEX_BUILD_DIR || '.next');
  console.log(`Código offline: ${manifest.assets.length} arquivos, ${manifest.bytes} bytes, versão ${manifest.version}.`);
}
