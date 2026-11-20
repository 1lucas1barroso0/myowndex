import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function verifyPublication({ version, revision, fetcher = fetch,
    pause = () => new Promise(resolve => setTimeout(resolve, 10000)), attempts = 60 }) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const response = await fetcher('https://myowndex.vercel.app/api/version', {
                cache: 'no-store', signal: AbortSignal.timeout(10000),
            });
            if (response.ok) {
                const current = await response.json();
                if (current.version === version && current.revision === revision) return current;
            }
        } catch { /* Transient failures do not confirm publication. */ }
        if (attempt + 1 < attempts) await pause();
    }
    throw new Error(`Production has not confirmed MyOwnDex ${version}, revision ${revision}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    await verifyPublication({ version, revision });
    console.log(`Produção confirmada: MyOwnDex ${version}, ${revision}.`);
}
