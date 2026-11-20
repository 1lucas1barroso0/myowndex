#!/usr/bin/env python3
"""Refresh reproducible reference data; never execute downloaded source code.

Run in a disposable checkout. Publication is a separate, validated CI step.
Missing translations or unsupported schemas fail closed and keep production intact.
"""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
GENERATORS = ['atualizar-indice-gerador.py', 'atualizar-indice-formas.py',
              'atualizar-caminhos-formas.py', 'atualizar-descricoes-pokedex.py',
              'atualizar-catalogo-bilingue.py', 'atualizar-overrides-champions.py']


def download(url):
    headers = {'User-Agent': 'myowndex-data-refresh'}
    token = os.environ.get('GITHUB_TOKEN', '').strip()
    if token and url.startswith('https://api.github.com/'):
        headers['Authorization'] = f'Bearer {token}'
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['pokeapi', 'showdown', 'go']:
        parser.add_argument(f'--{key}', help='Exact revision, for reproducible offline review')
    parser.add_argument('--review-mechanics', action='store_true',
                        help='Confirm source callbacks were reviewed against the local battle implementation')
    args = parser.parse_args()
    repos = {'pokeapi': 'PokeAPI/pokeapi', 'showdown': 'smogon/pokemon-showdown', 'go': 'PokeMiners/pogo_assets'}
    pins = {}
    for key, repo in repos.items():
        pins[key] = getattr(args, key) or json.loads(download(f'https://api.github.com/repos/{repo}/commits/master'))['sha']
        if not re.fullmatch('[0-9a-f]{40}', pins[key]):
            raise ValueError('Invalid source revision')
    prior = re.search(r"(?m)^SHOWDOWN_PIN = '([0-9a-f]{40})'", (ROOT / 'scripts/atualizar-catalogo-bilingue.py').read_text())[1]
    # Numeric metadata is not the whole engine. Never bless new callbacks just
    # because the catalogue parser (deliberately) ignores executable code.
    if pins['showdown'] != prior and not args.review_mechanics:
        compare = json.loads(download(f'https://api.github.com/repos/{repos["showdown"]}/compare/{prior}...{pins["showdown"]}'))
        sensitive = [item['filename'] for item in compare.get('files', [])
                     if (item['filename'] in ['data/moves.ts', 'data/abilities.ts', 'data/items.ts']
                         or re.match(r'data/mods/(?:champions|gen[1-9]|gen7letsgo|gen8bdsp)/', item['filename']))
                     and item['filename'].endswith('.ts') and not item['filename'].endswith('formats-data.ts')]
        if len(compare.get('files', [])) >= 300 or sensitive:
            raise RuntimeError('Battle implementation review required before updating pins: ' + ', '.join(sensitive))
    national = download(f'https://raw.githubusercontent.com/{repos["pokeapi"]}/{pins["pokeapi"]}/data/v2/csv/pokemon_species.csv')
    source_ids = {int(row['id']) for row in csv.DictReader(io.StringIO(national.decode())) if int(row['id']) < 10000}
    supported = {int(key) for key in json.loads((ROOT / 'src/data/generator-species.json').read_text())}
    if source_ids != supported:
        raise RuntimeError('National Dex coverage changed. Update generation limits, indices and consumers before publication.')
    # Update every consumer together, retaining the existing checksum verification.
    for script in GENERATORS[:-1]:
        path = ROOT / 'scripts' / script
        source = path.read_text()
        for variable, key in [('PIN', 'pokeapi'), ('API_SHA', 'pokeapi'), ('SHOWDOWN_PIN', 'showdown'), ('GO_SHA', 'go')]:
            source = re.sub(rf"(?m)^{variable} = '[0-9a-f]{{40}}'", f"{variable} = '{pins[key]}'", source)
        if script in ['atualizar-indice-gerador.py', 'atualizar-caminhos-formas.py']:
            def checksum(match):
                name = match[1]
                url = f'https://raw.githubusercontent.com/{repos["pokeapi"]}/{pins["pokeapi"]}/data/v2/csv/{name}.csv'
                return f"'{name}': '{hashlib.sha256(download(url)).hexdigest()}'"
            source = re.sub(r"'([a-z_]+)': '[0-9a-f]{64}'", checksum, source)
        path.write_text(source)
    for script in GENERATORS:
        subprocess.run(['python3', str(ROOT / 'scripts' / script)], cwd=ROOT, check=True)
    # Record source revisions, not wall-clock timestamps: an unchanged run has no diff.
    (ROOT / 'docs/data-refresh-sources.json').write_text(json.dumps({
        'schemaVersion': 1, 'sources': {key: {'repository': repos[key], 'commit': pin} for key, pin in pins.items()},
        'policy': 'Published only after tests, typecheck and build. Missing translations require editorial completion. Announced patches are not activated by calendar date alone.'
    }, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
