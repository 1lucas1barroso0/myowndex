#!/usr/bin/env python3
"""Regenerate the compact Pokédex/generator catalogue from pinned PokeAPI data.

The catalogue has one entry for every National Dex species plus every persistent
form/style represented by PokeAPI's pokemon_forms table. Battle-only or
necessarily temporary transformations stay inside the species record.

This optional development command never runs during build or application use.
"""
import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN = 'bc92d3b6029ef1abe9e7ad424c400b338f3c11fe'
BASE = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{PIN}/data/v2/csv/'
SOURCES = {
    'pokemon_species': 'e66e2eeb25fd3836b0ebab6bf87bbf01960aa3c0555e2bac495fa8393c5e0c45',
    'pokemon': '16c81c33188b0eac403aa2f759fcbe9e42c611f722d263f5b5a6a5bff9f8ce6b',
    'pokemon_forms': '99bf8f7ad4dc1f2e291357a090cef6a575623ec3cbf9030d0e33656e6e608ae2',
    'version_groups': '28da8d89d8eb4966941f81a9e62b3990510ed4d76dd774158246551a8e7707a7',
    'types': '37f039c8d722f47d51ba1c5c5ecf9b7007235b1a9a1af2827645c777b70307c8',
    'pokemon_types': 'f1fc4bfd657a034ea3bf6972423b10276424aa068577b304a78a08996425ba05',
    'pokemon_types_past': '02553c38e3871f99c7ed809b944066fea3f42ef6bccd4daba19274aca01fbff0',
}

# PokeAPI correctly marks ordinary battle transformations as battle-only.
# These are known non-battle-only rows whose state still cannot be a lasting
# identity. Minior's persistent colour is represented by its Meteor form; Core
# is the reversible battle state. Vehicle states similarly remain grouped.
TEMPORARY_FORM_NAMES = {
    'shaymin-sky',
    'hoopa-unbound',
    'eternatus-eternamax',
    'koraidon-limited-build',
    'koraidon-sprinting-build',
    'koraidon-swimming-build',
    'koraidon-gliding-build',
    'miraidon-low-power-mode',
    'miraidon-drive-mode',
    'miraidon-aquatic-mode',
    'miraidon-glide-mode',
    'minior-red',
    'minior-orange',
    'minior-yellow',
    'minior-green',
    'minior-blue',
    'minior-indigo',
    'minior-violet',
}


def download(name, expected):
    raw = urllib.request.urlopen(BASE + name + '.csv', timeout=30).read()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError(f'Pinned source integrity failed: {name}')
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8'))))


def sorted_types(rows, type_names):
    return [type_names[row['type_id']] for row in sorted(rows, key=lambda row: int(row['slot']))]


def main():
    data = {name: download(name, checksum) for name, checksum in SOURCES.items()}
    species = {row['id']: row for row in data['pokemon_species']}
    pokemon = {row['id']: row for row in data['pokemon']}
    type_names = {row['id']: row['identifier'] for row in data['types']}
    version_generations = {row['id']: int(row['generation_id']) for row in data['version_groups']}

    current_types = {}
    for row in data['pokemon_types']:
        current_types.setdefault(row['pokemon_id'], []).append(row)

    past_types = {}
    for row in data['pokemon_types_past']:
        past_types.setdefault(row['pokemon_id'], {}).setdefault(int(row['generation_id']), []).append(row)

    entries = []
    for form in data['pokemon_forms']:
        pokemon_row = pokemon.get(form['pokemon_id'])
        if not pokemon_row:
            continue
        species_id = int(pokemon_row['species_id'])
        if not 1 <= species_id <= 1025:
            continue
        if form['is_battle_only'] != '0' or form['is_mega'] != '0':
            continue
        if form['identifier'] in TEMPORARY_FORM_NAMES:
            continue

        species_row = species[pokemon_row['species_id']]
        types = sorted_types(current_types.get(pokemon_row['id'], []), type_names)
        if not types:
            raise ValueError(f'Missing type data for {form["identifier"]}')

        pokemon_default = pokemon_row['is_default'] == '1'
        form_default = form['is_default'] == '1'
        main_default = pokemon_default and form_default
        form_identifier = form['form_identifier'] or ''

        entry = {
            'speciesId': species_id,
            'pokemonId': int(pokemon_row['id']),
            'formId': int(form['id']),
            'speciesName': species_row['identifier'],
            'pokemonName': pokemon_row['identifier'],
            'catalogFormKey': form['identifier'],
            'form': form_identifier,
            'generation': int(species_row['generation_id']),
            'formGeneration': version_generations.get(
                form['introduced_in_version_group_id'],
                int(species_row['generation_id']),
            ),
            'legendary': species_row['is_legendary'] == '1',
            'mythical': species_row['is_mythical'] == '1',
            'isDefault': main_default,
            'isPokemonDefault': pokemon_default,
            'isFormDefault': form_default,
            'storageFormKey': '' if form_default else form['identifier'],
            'spriteKey': str(pokemon_row['id']) if form_default else f'{pokemon_row["id"]}-{form_identifier}',
            'types': types,
            'url': f'https://pokeapi.co/api/v2/pokemon-species/{species_id}/',
            'pokemonUrl': f'https://pokeapi.co/api/v2/pokemon/{pokemon_row["id"]}/',
            'formUrl': f'https://pokeapi.co/api/v2/pokemon-form/{form["id"]}/',
        }

        history = []
        for generation, rows in sorted(past_types.get(pokemon_row['id'], {}).items()):
            history.append({'generation': generation, 'types': sorted_types(rows, type_names)})
        if history:
            entry['pastTypes'] = history

        entries.append(entry)

    entries.sort(key=lambda entry: (
        entry['speciesId'],
        not entry['isDefault'],
        not entry['isPokemonDefault'],
        entry['pokemonId'],
        entry['formId'],
    ))

    by_species = {}
    for entry in entries:
        by_species[entry['speciesId']] = by_species.get(entry['speciesId'], 0) + 1
    for entry in entries:
        entry['formCount'] = by_species[entry['speciesId']]

    if len(by_species) != 1025:
        raise ValueError(f'Incomplete National Dex: expected 1025 species, found {len(by_species)}')
    defaults = sum(1 for entry in entries if entry['isDefault'])
    if defaults != 1025:
        raise ValueError(f'Expected 1025 primary species forms, found {defaults}')
    if len({entry['catalogFormKey'] for entry in entries}) != len(entries):
        raise ValueError('Duplicate catalogue form identity')

    target = ROOT / 'src/data/dex-entries.json'
    encoded = (json.dumps(entries, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    target.write_bytes(encoded)
    print(json.dumps({
        'entries': len(entries),
        'species': len(by_species),
        'persistentForms': len(entries) - len(by_species),
        'bytes': len(encoded),
        'sha256': hashlib.sha256(encoded).hexdigest(),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
