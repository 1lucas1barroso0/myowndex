#!/usr/bin/env python3
"""Update exact sprite identities from the pinned PokeAPI catalogue CSVs.

This offline tool never changes animation assets or form exposure policy. Use
pokemon.csv and pokemon_forms.csv from the catalogueCommit recorded in
src/data/native-sprites.json, then review the output. --check verifies the
current snapshot without writing it.
"""
import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_csv(path):
    with path.open(newline='', encoding='utf8') as source:
        return list(csv.DictReader(source))


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pokemon-csv', type=Path, required=True)
parser.add_argument('--forms-csv', type=Path, required=True)
parser.add_argument('--index', type=Path, default=ROOT / 'src/data/native-sprites.json')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
index = json.loads(args.index.read_text())
resources = {entry['id']: entry['identifier'] for entry in read_csv(args.pokemon_csv)}
keys = {}
for entry in read_csv(args.forms_csv):
    pokemon_id = entry['pokemon_id']
    assert pokemon_id in resources, entry['id']
    key = pokemon_id if entry['is_default'] == '1' or not entry['form_identifier'] else pokemon_id + '-' + entry['form_identifier']
    assert entry['id'] not in keys
    keys[entry['id']] = key
# Existing persistent/cosmetic catalogue keys were independently checked
# against the same source. Never silently reinterpret one of these forms.
forms = json.loads((ROOT / 'src/data/forms.json').read_text())
for entry in forms['defaults'] + forms['entries']:
    assert keys[str(entry['formId'])] == entry['spriteKey'], entry['name']
if args.check:
    assert resources == index['pokemonResources'], 'Pokémon resources differ from the pinned snapshot'
    assert keys == index['formKeys'], 'Form resource keys differ from the pinned snapshot'
else:
    index['pokemonResources'] = resources
    index['formKeys'] = keys
    args.index.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
print(f'Verified {len(resources)} Pokémon resources and {len(keys)} exact form identities.')
