#!/usr/bin/env python3
"""Rebuild the persistent-form catalogue from pinned PokéAPI data.

Battle-only transformations and Mega forms stay attached to their ordinary
Pokémon entry. Persistent regional, style, size and equivalent forms receive
their own catalogue identity.
"""
import csv
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN = 'bc92d3b6029ef1abe9e7ad424c400b338f3c11fe'
BASE = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{PIN}/data/v2/csv/'
COLLAPSED_REVERSIBLE_FORMS = {
    'eternatus-eternamax',
    'koraidon-limited-build', 'koraidon-sprinting-build', 'koraidon-swimming-build', 'koraidon-gliding-build',
    'miraidon-low-power-mode', 'miraidon-drive-mode', 'miraidon-aquatic-mode', 'miraidon-glide-mode',
    'minior-red', 'minior-orange', 'minior-yellow', 'minior-green', 'minior-blue', 'minior-indigo', 'minior-violet',
}


def load(name):
    raw = urllib.request.urlopen(BASE + name + '.csv', timeout=60).read()
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8'))))


def main():
    pokemon = load('pokemon')
    forms = load('pokemon_forms')
    version_groups = load('version_groups')
    pokemon_types = load('pokemon_types')
    pokemon_types_past = load('pokemon_types_past')
    types = load('types')

    pokemon_by_id = {row['id']: row for row in pokemon}
    generation_by_version_group = {row['id']: int(row['generation_id']) for row in version_groups}
    type_name = {row['id']: row['identifier'] for row in types}
    types_by_pokemon = {}
    past_types_by_pokemon = {}
    for row in pokemon_types:
        types_by_pokemon.setdefault(row['pokemon_id'], []).append((int(row['slot']), type_name[row['type_id']]))
    for row in pokemon_types_past:
        past_types_by_pokemon.setdefault(row['pokemon_id'], {}).setdefault(int(row['generation_id']), []).append(
            (int(row['slot']), type_name[row['type_id']]))

    entries = []
    for form in forms:
        p = pokemon_by_id.get(form['pokemon_id'])
        if not p:
            continue
        if form['is_battle_only'] == '1' or form['is_mega'] == '1':
            continue
        if p['is_default'] == '1' and form['is_default'] == '1':
            continue
        if form['identifier'] in COLLAPSED_REVERSIBLE_FORMS:
            continue
        generation = generation_by_version_group.get(form['introduced_in_version_group_id'])
        form_types = [name for _, name in sorted(types_by_pokemon.get(p['id'], []))]
        if not generation or not form_types:
            continue
        entry = {
            'name': form['identifier'],
            'formId': int(form['id']),
            'formIdentifier': form['form_identifier'] or '',
            'pokemonName': p['identifier'],
            'pokemonId': int(p['id']),
            'speciesId': int(p['species_id']),
            'generation': generation,
            'types': form_types,
        }
        if p['id'] in past_types_by_pokemon:
            entry['pastTypes'] = [
                {'generation': past_generation, 'types': [name for _, name in sorted(past_types)]}
                for past_generation, past_types in sorted(past_types_by_pokemon[p['id']].items())
            ]
        entries.append(entry)

    entries.sort(key=lambda entry: (entry['speciesId'], entry['generation'], entry['formId']))
    target = ROOT / 'src/data/forms.json'
    target.write_text(json.dumps({
        'schemaVersion': 1,
        'sourceCommit': PIN,
        'entries': entries,
    }, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'forms': len(entries), 'target': str(target.relative_to(ROOT))}, ensure_ascii=False))


if __name__ == '__main__':
    main()
