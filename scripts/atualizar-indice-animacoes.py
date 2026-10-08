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
    return json.loads(subprocess.check_output(['curl', '--max-time', '30', '--fail', '--silent', '--show-error', '--location', BASE + path]))


def keys(tree):
    if tree.get('truncated'):
        raise ValueError('The source tree is truncated; do not publish a partial map.')
    return sorted(entry['path'][:-4] for entry in tree['tree'] if entry['type'] == 'blob' and entry['path'].endswith('.gif'))


VIEWS = ['', 'shiny', 'female', 'shiny/female', 'back', 'back/shiny', 'back/female', 'back/shiny/female']


def availability(tree):
    if tree.get('truncated'):
        raise ValueError('The source tree is truncated; do not publish a partial map.')
    result = {view: [] for view in VIEWS}
    for entry in tree['tree']:
        if entry['type'] != 'blob' or not entry['path'].endswith('.gif'):
            continue
        folder, _, filename = entry['path'].rpartition('/')
        if folder in result and re.fullmatch(r'[0-9]+(?:-[a-z0-9-]+)?', filename[:-4]):
            result[folder].append(filename[:-4])
    return {view: sorted(values) for view, values in result.items()}


def folder(tree, name):
    entry = next(entry for entry in tree['tree'] if entry['path'] == name and entry['type'] == 'tree')
    return get('git/trees/' + entry['sha'])


def build(commit, checked):
    if not re.fullmatch(r'[a-f0-9]{40}|master', commit):
        raise ValueError('Use a 40-character commit SHA or master.')
    source = get('commits/' + commit)
    commit = source['sha']
    tree = get('git/trees/' + source['commit']['tree']['sha'])
    pokemon = folder(folder(tree, 'sprites'), 'pokemon')
    tree = pokemon
    for name in ['versions', 'generation-v', 'black-white', 'animated']:
        tree = folder(tree, name)
    bw = availability(get('git/trees/' + tree['sha'] + '?recursive=1'))
    showdown = folder(folder(pokemon, 'other'), 'showdown')
    show = availability(get('git/trees/' + showdown['sha'] + '?recursive=1'))
    shiny_entry = next(entry for entry in tree['tree'] if entry['path'] == 'shiny' and entry['type'] == 'tree')
    return {
        'schemaVersion': 2,
        'source': 'https://github.com/PokeAPI/sprites',
        'commit': commit,
        'checked': checked,
        'animatedTree': tree['sha'],
        'shinyTree': shiny_entry['sha'],
        'regular': bw[''],
        'shiny': bw['shiny'],
        'views': {view: values for view, values in bw.items() if view not in ['', 'shiny']},
        'showdownTree': showdown['sha'],
        'showdown': show,
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
