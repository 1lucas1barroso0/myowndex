#!/usr/bin/env python3
"""Prepare the generator's small species/type index from pinned game data.

This optional development command never runs during build or application use.
"""
import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN = '2ee1c422ad9f3831245dab0ac2a5cd1aae61cd72'
BASE = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{PIN}/data/v2/csv/'
SOURCES = {
    'pokemon_species': 'e66e2eeb25fd3836b0ebab6bf87bbf01960aa3c0555e2bac495fa8393c5e0c45',
    'pokemon': '16c81c33188b0eac403aa2f759fcbe9e42c611f722d263f5b5a6a5bff9f8ce6b',
    'types': '37f039c8d722f47d51ba1c5c5ecf9b7007235b1a9a1af2827645c777b70307c8',
    'pokemon_types': 'f1fc4bfd657a034ea3bf6972423b10276424aa068577b304a78a08996425ba05',
    'pokemon_types_past': '02553c38e3871f99c7ed809b944066fea3f42ef6bccd4daba19274aca01fbff0',
}


def download(name, expected):
    raw = urllib.request.urlopen(BASE + name + '.csv', timeout=30).read()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError(f'Pinned source integrity failed: {name}')
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8'))))


def main():
    data = {name: download(name, checksum) for name, checksum in SOURCES.items()}
    names = {row['id']: row['identifier'] for row in data['types']}
    default_forms = {int(row['species_id']): int(row['id']) for row in data['pokemon'] if row['is_default'] == '1'}
    current = {}
    past = {}
    for row in data['pokemon_types']:
        current.setdefault(int(row['pokemon_id']), []).append((int(row['slot']), names[row['type_id']]))
    for row in data['pokemon_types_past']:
        past.setdefault(int(row['pokemon_id']), {}).setdefault(int(row['generation_id']), []).append((int(row['slot']), names[row['type_id']]))
    index = {}
    for row in sorted(data['pokemon_species'], key=lambda value: int(value['id'])):
        species_id = int(row['id'])
        if not 1 <= species_id <= 1025:
            continue
        form = default_forms[species_id]
        entry = {
            'generation': int(row['generation_id']),
            'legendary': row['is_legendary'] == '1',
            'mythical': row['is_mythical'] == '1',
            'types': [name for _, name in sorted(current[form])],
        }
        if form in past:
            entry['pastTypes'] = [{'generation': generation, 'types': [name for _, name in sorted(types)]}
                                  for generation, types in sorted(past[form].items())]
        index[str(species_id)] = entry
    if len(index) != 1025 or any(not entry['types'] for entry in index.values()):
        raise ValueError('Incomplete national species/type index')
    target = ROOT / 'src/data/generator-species.json'
    encoded = (json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    target.write_bytes(encoded)
    print(json.dumps({'species': len(index), 'bytes': len(encoded), 'sha256': hashlib.sha256(encoded).hexdigest()}, ensure_ascii=False))


if __name__ == '__main__':
    main()
