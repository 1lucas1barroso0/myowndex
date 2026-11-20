import { readFile, writeFile } from 'node:fs/promises';

// Version changes invalidate the PWA shell; personal storage keys stay intact.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const previous = pkg.version;
const [major, minor, patch] = previous.split('.').map(Number);
if (![major, minor, patch].every(Number.isSafeInteger)) throw new Error('Invalid release version');
const version = `${major}.${minor}.${patch + 1}`;
pkg.version = version;
await writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
lock.version = version;
lock.packages[''].version = version;
await writeFile('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
for (const path of ['public/sw.js', 'README.md', 'docs/CONTINUAR.md']) {
    const source = await readFile(path, 'utf8');
    const old = path === 'public/sw.js' ? `myowndex-shell-v${previous}`
        : path === 'README.md' ? `A versão atual é **${previous}**` : `Versão atual: ${previous}`;
    if (!source.includes(old)) throw new Error(`Release marker missing: ${path}`);
    await writeFile(path, source.replaceAll(old, old.replace(previous, version)));
}
console.log(`MyOwnDex ${version}: updated reference data and offline shell.`);
