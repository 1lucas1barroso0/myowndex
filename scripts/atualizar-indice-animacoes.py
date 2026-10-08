#!/usr/bin/env python3
"""Rebuild the exact animated-sprite availability map using verified HTTPS.

No application or account data is read. The file is written only with --output.
Check the current map:
  python3 scripts/atualizar-indice-animacoes.py --check src/data/animated-sprites.json
Review a new snapshot before replacing the application file:
  python3 scripts/atualizar-indice-animacoes.py --commit master --output /tmp/animated-sprites-next.json
"""
import argparse
import datetime
import json
import pathlib
import re
import subprocess

BASE = 'https://api.github.com/repos/PokeAPI/sprites/'


def get(path):
    return json.loads(subprocess.check_output(['curl', '--fail', '--silent', '--show-error', '--location', BASE + path]))


def keys(tree):
    if tree.get('truncated'):
        raise ValueError('The source tree is truncated; do not publish a partial map.')
    return sorted(entry['path'][:-4] for entry in tree['tree'] if entry['type'] == 'blob' and entry['path'].endswith('.gif'))


def build(commit, checked):
    if not re.fullmatch(r'[a-f0-9]{40}|master', commit):
        raise ValueError('Use a 40-character commit SHA or master.')
    source = get('commits/' + commit)
    commit = source['sha']
    tree = get('git/trees/' + source['commit']['tree']['sha'])
    for folder in ['sprites', 'pokemon', 'versions', 'generation-v', 'black-white', 'animated']:
        entry = next(entry for entry in tree['tree'] if entry['path'] == folder and entry['type'] == 'tree')
        tree = get('git/trees/' + entry['sha'])
    shiny_entry = next(entry for entry in tree['tree'] if entry['path'] == 'shiny' and entry['type'] == 'tree')
    shiny = get('git/trees/' + shiny_entry['sha'])
    return {
        'source': 'https://github.com/PokeAPI/sprites',
        'commit': commit,
        'checked': checked,
        'animatedTree': tree['sha'],
        'shinyTree': shiny['sha'],
        'regular': keys(tree),
        'shiny': keys(shiny),
    }


parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--check', type=pathlib.Path)
parser.add_argument('--commit', default='master')
parser.add_argument('--checked', default=datetime.date.today().isoformat())
parser.add_argument('--output', type=pathlib.Path)
args = parser.parse_args()
if args.check:
    saved = json.loads(args.check.read_text())
    rebuilt = build(saved['commit'], saved['checked'])
    if saved != rebuilt:
        raise SystemExit('Availability differs from its pinned source. Do not publish until reviewed.')
    print(f"Verified {len(rebuilt['regular'])} regular and {len(rebuilt['shiny'])} shiny keys at {rebuilt['commit']}.")
elif args.output:
    rebuilt = build(args.commit, args.checked)
    args.output.write_text(json.dumps(rebuilt, separators=(',', ':')) + '\n')
    print(f"Wrote {args.output}: {len(rebuilt['regular'])} regular and {len(rebuilt['shiny'])} shiny keys at {rebuilt['commit']}.")
else:
    parser.error('Choose --check or --output. Nothing has been changed.')
