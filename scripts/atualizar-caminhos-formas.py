#!/usr/bin/env python3
"""Rebuild exact evolutionary paths without changing the approved Dex grouping.

The official CSV identifies required and resulting forms. Runtime filters keep
non-interchangeable lineages apart; this optional script never runs during play.
"""
import argparse
import csv
import hashlib
import io
import json
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN = '2ee1c422ad9f3831245dab0ac2a5cd1aae61cd72'
BASE = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{PIN}/data/v2/csv/'
SOURCES = {
    'pokemon': '16c81c33188b0eac403aa2f759fcbe9e42c611f722d263f5b5a6a5bff9f8ce6b',
    'pokemon_species': 'e66e2eeb25fd3836b0ebab6bf87bbf01960aa3c0555e2bac495fa8393c5e0c45',
    'pokemon_forms': '99bf8f7ad4dc1f2e291357a090cef6a575623ec3cbf9030d0e33656e6e608ae2',
    'pokemon_evolution': 'e78be51c8805551fffccd5551a556e752e4a76ff1b52482b53b409dd3882e1dd',
}


def read_source(name, directory):
    raw = ((directory / f'{name}.csv').read_bytes() if directory else
           urllib.request.urlopen(BASE + name + '.csv', timeout=60).read())
    if hashlib.sha256(raw).hexdigest() != SOURCES[name]:
        raise ValueError(f'Pinned source integrity failed: {name}')
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8'))))


def build(data):
    pokemon = {row['id']: row for row in data['pokemon']}
    species = {row['id']: row for row in data['pokemon_species']}
    forms = {row['id']: row for row in data['pokemon_forms']}
    default_pokemon = {row['species_id']: row for row in pokemon.values() if row['is_default'] == '1'}
    default_forms = {row['pokemon_id']: row for row in forms.values() if row['is_default'] == '1'}
    catalogue = json.loads((ROOT / 'src/data/forms.json').read_text())
    if catalogue['sourceCommit'] != PIN:
        raise ValueError('The form and evolution catalogues must use the same revision')
    # Use the same policy as the UI and Generator instead of maintaining a
    # competing list of segregated forms in a second updater.
    query = """import {readFileSync} from 'node:fs';
import {shouldSeparateDexVariant} from './src/core/dexVariants.js';
const data=JSON.parse(readFileSync('src/data/forms.json','utf8'));
process.stdout.write(JSON.stringify([...data.defaults,...data.entries].filter(shouldSeparateDexVariant)));"""
    selected = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', query], cwd=ROOT))
    relevant_species = {str(entry['speciesId']) for entry in selected}
    # Default members of each affected family are required too: ordinary
    # Meowth must retain Persian while Galarian Meowth retains Perrserker.
    while True:
        expanded = relevant_species | {row['evolves_from_species_id'] for key, row in species.items()
                                      if key in relevant_species and row['evolves_from_species_id']}
        expanded |= {key for key, row in species.items() if row['evolves_from_species_id'] in expanded}
        if expanded == relevant_species:
            break
        relevant_species = expanded
    seeds = {entry['name'] for entry in selected}
    # Caps and Cosplay costumes remain grouped in the Dex, but those special
    # Pikachu individuals cannot evolve into Raichu. Merely viewing a costume
    # must not borrow the ordinary Pikachu's evolutionary path.
    seeds |= {entry['name'] for entry in catalogue['entries'] if entry['speciesId'] == 25}
    seeds |= {default_forms[default_pokemon[key]['id']]['identifier'] for key in relevant_species}
    edges = set()
    for row in data['pokemon_evolution']:
        parent = species[row['evolved_species_id']]['evolves_from_species_id']
        if not parent or row['evolved_species_id'] not in relevant_species:
            continue
        source = (forms[row['required_pokemon_form_id']] if row['required_pokemon_form_id']
                  else default_forms[default_pokemon[parent]['id']])
        target = (forms[row['evolved_pokemon_form_id']] if row['evolved_pokemon_form_id']
                  else default_forms[default_pokemon[row['evolved_species_id']]['id']])
        if any(form['is_battle_only'] == '1' or form['is_mega'] == '1' for form in (source, target)):
            continue
        edges.add((source['identifier'], target['identifier']))
    incoming, outgoing = {}, {}
    for source, target in sorted(edges):
        incoming.setdefault(target, []).append(source)
        outgoing.setdefault(source, []).append(target)

    def ancestors(name, visited=()):
        if name in visited:
            raise ValueError(f'Unexpected evolution cycle: {name}')
        return ([path + [name] for parent in incoming[name]
                 for path in ancestors(parent, (*visited, name))] if name in incoming else [[name]])

    def leaves(name, visited=()):
        if name in visited:
            raise ValueError(f'Unexpected evolution cycle: {name}')
        return ([leaf for child in outgoing[name] for leaf in leaves(child, (*visited, name))]
                if name in outgoing else [name])

    paths = {tuple(path) for seed in seeds for leaf in leaves(seed) for path in ancestors(leaf)}
    by_name = {row['identifier']: row for row in forms.values()}
    nodes = []
    for name in sorted({name for path in paths for name in path}):
        form = by_name[name]
        row = pokemon[form['pokemon_id']]
        nodes.append({
            'name': name, 'pokemonName': row['identifier'], 'pokemonId': int(row['id']),
            'speciesId': int(row['species_id']), 'formId': int(form['id']),
            'spriteKey': row['id'] if form['is_default'] == '1' else f'{row["id"]}-{form["form_identifier"]}',
            'isDefault': row['is_default'] == '1' and form['is_default'] == '1',
        })
    return {
        'schemaVersion': 1, 'sourceCommit': PIN, 'sourceHashes': SOURCES,
        'nodes': nodes, 'paths': sorted(paths),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Use locally cached, checksum-verified CSV sources.')
    args = parser.parse_args()
    result = build({name: read_source(name, args.source_dir) for name in SOURCES})
    target = ROOT / 'src/data/form-evolutions.json'
    encoded = (json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    target.write_bytes(encoded)
    print(json.dumps({'nodes': len(result['nodes']), 'paths': len(result['paths']), 'bytes': len(encoded),
                      'sha256': hashlib.sha256(encoded).hexdigest()}))


if __name__ == '__main__':
    main()
