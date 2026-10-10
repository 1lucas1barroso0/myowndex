#!/usr/bin/env python3
"""Build the local reference catalogue from a pinned PokeAPI database.

Normal builds reuse the persisted Portuguese strings and never translate online.
--translate-missing is an explicit development-only editorial preparation step.
English game text is official; the Portuguese rendering is MyOwnDex editorial
text, not a claim that the core games have an official Brazilian localization.
"""
import argparse
import concurrent.futures
import csv
import hashlib
import io
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/catalog/v1'
PIN = '2ee1c422ad9f3831245dab0ac2a5cd1aae61cd72'
SHOWDOWN_PIN = '41898849ebabde360b26f918d79d52bd2c929a98'
CSV_ROOT = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{PIN}/data/v2/csv/'
FILES = ['versions', 'version_groups', 'pokemon_species_names', 'pokemon_species_flavor_text',
         'ability_names', 'ability_prose', 'abilities', 'ability_flavor_text',
         'move_names', 'move_effect_prose', 'moves', 'move_flavor_text',
         'item_names', 'item_prose', 'items', 'item_flavor_text', 'type_names']
SOURCE_CACHE = Path('/tmp/myowndex-catalog-source')
TRANSLATION_CACHE = Path('/tmp/myowndex-catalog-translations.json')


def clean(text):
    text = str(text or '').replace('\u00ad', '').replace('\u00a0', ' ')
    return re.sub(r'\s+', ' ', text).strip().replace('POKéMON', 'Pokémon').replace('POKÉMON', 'Pokémon').replace('POKEMON', 'Pokémon')


def download(name):
    path = SOURCE_CACHE / (name + '.csv')
    # The development cache is only reused when it has the pinned-source proof.
    proof = path.with_suffix('.sha')
    if not path.exists() or not proof.exists() or proof.read_text().strip() != PIN:
        path.write_bytes(urllib.request.urlopen(CSV_ROOT + name + '.csv', timeout=60).read())
        proof.write_text(PIN)
    data = path.read_bytes()
    return name, list(csv.DictReader(io.StringIO(data.decode('utf-8')))), {
        'url': CSV_ROOT + name + '.csv', 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
    }


def text_key(text):
    return hashlib.sha256(text.encode()).hexdigest()[:20]


def refine_portuguese(english, portuguese):
    """Review technical phrasing without translating or changing the English source."""
    text = portuguese.replace('\u200b', '')
    if 'holder' in english.lower():
        text = re.sub(r'\btitular\b', 'portador', text)
        text = re.sub(r'\bTitular\b', 'Portador', text)
    if english.startswith('Held'):
        text = re.sub(r'^Realizado(?: em batalha)?\s*:', 'Item equipado:', text)
    if english.startswith('Used on a party'):
        text = re.sub(r'^Usado em (?:uma festa|um grupo|grupo|uma equipe) Pokémon\s*:', 'Usado em um Pokémon da equipe:', text)
    if 'switch' in english.lower():
        text = re.sub(r'\bswitch-in\b', 'entrada em campo', text, flags=re.I)
        text = re.sub(r'\bswitch-out\b', 'saída de campo', text, flags=re.I)
        text = re.sub(r'\bdesligar\b', 'sair do campo', text)
        text = re.sub(r'\bao desligar\b', 'ao sair do campo', text)
    if 'flinch' in english.lower():
        text = re.sub(r'\brecuar\b', 'hesitar', text)
    if 'substitute' in english.lower():
        text = re.sub(r'\bsubstituto\b', 'Substitute', text, flags=re.I)
    if 'damaging attack' in english:
        text = text.replace('ataque prejudicial', 'ataque que causa dano')
    if 'move' in english.lower():
        text = text.replace('esta movimentação', 'este movimento').replace('essa movimentação', 'esse movimento')
        text = text.replace('esta mudança', 'este movimento').replace('desta mudança', 'deste movimento')
        text = text.replace('a última movimentação', 'o último movimento')
        text = text.replace('dessas movimentações', 'desses movimentos').replace('uma dessas movimentações', 'um desses movimentos')
        text = text.replace('as movimentações', 'os movimentos').replace('a movimentação', 'o movimento')
        text = re.sub(r'\bmovimentações\b', 'movimentos', text)
        text = re.sub(r'\bmovimentação\b', 'movimento', text)
    if 'bad poison' in english:
        text = text.replace('veneno ruim', 'envenenamento grave')
    text = text.replace('Overworld:', 'Fora da batalha:').replace('multi-hit', 'com múltiplos golpes')
    if 'rounded half down' in english:
        text = re.sub(r'arredondad[oa] pela metade para baixo',
                      'arredondado para o inteiro mais próximo, com empate para baixo', text)
    return text


def showdown(kind):
    plural = {'ability': 'abilities', 'move': 'moves', 'item': 'items'}[kind]
    url = f'https://raw.githubusercontent.com/smogon/pokemon-showdown/{SHOWDOWN_PIN}/data/text/{plural}.ts'
    raw = urllib.request.urlopen(url, timeout=60).read()
    # Parse only literal text fields, never execute code from a downloaded file.
    result = {}
    entry = None
    context = 'base'
    for line in raw.decode().splitlines():
        opened = re.match(r'^\t([a-z0-9]+): \{$', line)
        if opened:
            entry = result.setdefault(opened[1], {})
            context = 'base'
            continue
        if entry is None:
            continue
        group = re.match(r'^\t\t(gen\d+|champions|letsgo): \{$', line)
        if group:
            context = group[1]
            continue
        if line == '\t\t},':
            context = 'base'
        field = re.match(r'^\t{2,3}(name|desc|shortDesc): ("(?:[^"\\]|\\.)*"),?\s*$', line)
        if field:
            value = json.loads(field[2])
            if field[1] == 'name':
                entry['name'] = value
            else:
                entry.setdefault(context, {})[field[1]] = value
    return result, {'repository': 'smogon/pokemon-showdown', 'commit': SHOWDOWN_PIN, 'url': url,
                    'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}


def showdown_move_metadata():
    """Read literal fields only; callbacks in source files are never executed.

    Historical targeting/category/PP/power cannot be inferred from current
    PokéAPI metadata. Keep the actual generation overrides with their source.
    Dynamic effects remain explained by the separately paired reference text.
    """
    paths = {'base': 'data/moves.ts'}
    paths.update({f'gen{generation}': f'data/mods/gen{generation}/moves.ts' for generation in range(1, 9)})
    paths.update({'champions': 'data/mods/champions/moves.ts',
                  'letsgo': 'data/mods/gen7letsgo/moves.ts',
                  'bdsp': 'data/mods/gen8bdsp/moves.ts',
                  'legacyCategory': 'data/mods/gen3/scripts.ts'})

    def retrieve(item):
        context, path = item
        url = f'https://raw.githubusercontent.com/smogon/pokemon-showdown/{SHOWDOWN_PIN}/{path}'
        raw = urllib.request.urlopen(url, timeout=60).read()
        values = {}
        current = None
        for line in raw.decode().splitlines():
            opened = re.match(r'^\t([a-z0-9]+): \{$', line)
            if opened:
                current = values.setdefault(opened[1], {})
                continue
            if current is None:
                continue
            # Exact indentation excludes all callback/nested-effect bodies.
            field = re.match(r'^\t\t(accuracy|basePower|category|pp|priority|target|type): (true|-?\d+|"(?:[^"\\]|\\.)*"),', line)
            if field:
                current[field[1]] = json.loads(field[2])
        proof = {'repository': 'smogon/pokemon-showdown', 'commit': SHOWDOWN_PIN, 'url': url,
                 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        if context == 'legacyCategory':
            match = re.search(r"const specialTypes = \[([^]]+)\]", raw.decode())
            if not match:
                raise ValueError('The pinned pre-split category source changed')
            values = re.findall(r"'([^']+)'", match[1])
        else:
            values = {name: fields for name, fields in values.items() if fields}
        return context, values, proof

    result = list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(retrieve, paths.items()))
    return {context: values for context, values, _ in result}, {context: proof for context, _, proof in result}


def label(version):
    special = {'red': 'Pokémon Red', 'blue': 'Pokémon Blue', 'firered': 'Pokémon FireRed',
               'leafgreen': 'Pokémon LeafGreen', 'heartgold': 'Pokémon HeartGold',
               'soulsilver': 'Pokémon SoulSilver', 'xd': 'Pokémon XD: Gale of Darkness',
               'colosseum': 'Pokémon Colosseum', 'legends-arceus': 'Pokémon Legends: Arceus',
               'legends-za': 'Pokémon Legends: Z-A', 'pokemon-go': 'Pokémon GO',
               'lets-go-pikachu': 'Pokémon: Let’s Go, Pikachu!', 'lets-go-eevee': 'Pokémon: Let’s Go, Eevee!'}
    return special.get(version, 'Pokémon ' + version.replace('-', ' ').title())


def load_translations():
    values = {}
    for path in OUTPUT.glob('*.json'):
        data = json.loads(path.read_text())
        for pair in data.get('texts', {}).values():
            if len(pair) >= 2 and pair[0] and pair[1]:
                values[pair[0]] = pair[1]
    if TRANSLATION_CACHE.exists():
        values.update(json.loads(TRANSLATION_CACHE.read_text()))
    return values


def prepare_translations(texts, translations, names, online):
    missing = [text for text in texts if text not in translations]
    if missing and not online:
        raise RuntimeError(f'{len(missing)} new English descriptions require an editorial Portuguese rendering. Reuse the published catalogue or run the explicit development preparation flag.')
    # Protect names before translating prose, including move/item/ability/type names.
    protected_names = sorted(set(names) | {'HP', 'PP', 'EV', 'EVs', 'IV', 'IVs', 'Pokémon'}, key=lambda value: (-len(value), value))
    name_pattern = re.compile(r'(?<![\w])(?:' + '|'.join(re.escape(name) for name in protected_names if name) + r')(?![\w])')
    batches = []
    current = []
    size = 0
    for text in missing:
        if current and size + len(text) > 4200:
            batches.append(current)
            current, size = [], 0
        current.append(text)
        size += len(text) + 30
    if current:
        batches.append(current)

    def translate_batch(batch):
        token_names = {}
        def protect(match):
            token = f'NXQ{len(token_names):05}QXN'
            token_names[token] = match[0]
            return token
        payload = '\n\n'.join(f'ZXQ{index:05}QXZ\n{name_pattern.sub(protect, text)}' for index, text in enumerate(batch))
        url = 'https://translate.googleapis.com/translate_a/single?' + urllib.parse.urlencode({
            'client': 'gtx', 'sl': 'en', 'tl': 'pt', 'dt': 't', 'q': payload,
        })
        for attempt in range(5):
            try:
                result = json.load(urllib.request.urlopen(url, timeout=45))
                translated = ''.join(part[0] for part in result[0] if part and part[0])
                parts = re.split(r'ZXQ\s*(\d{5})\s*QXZ', translated)
                if len(parts) != len(batch) * 2 + 1:
                    raise ValueError('Editorial batch boundaries were not preserved')
                pairs = {}
                for offset in range(1, len(parts), 2):
                    index = int(parts[offset])
                    text = parts[offset + 1]
                    for token, name in token_names.items():
                        text = re.sub(re.escape(token), lambda _: name, text, flags=re.I)
                    if re.search(r'[NZ]XQ\d+QX[NZ]', text, re.I):
                        raise ValueError('An original-name marker was not preserved')
                    text = clean(text).replace('movimentos prejudiciais', 'movimentos que causam dano').replace('movimentos danosos', 'movimentos que causam dano')
                    text = re.sub(r'\bO usuário\b', 'Quem usa', text)
                    text = re.sub(r'\bo usuário\b', 'quem usa', text)
                    text = text.replace('este Pokemon', 'este Pokémon').replace('um Pokemon', 'um Pokémon')
                    if not text:
                        raise ValueError('Empty Portuguese rendering')
                    pairs[batch[index]] = text
                return pairs
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(min(2 ** attempt, 8))

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(translate_batch, batch) for batch in batches]
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            translations.update(future.result())
            completed += 1
            TRANSLATION_CACHE.write_text(json.dumps(translations, ensure_ascii=False))
            if completed % 15 == 0 or completed == len(batches):
                print(f'Editorial Portuguese: {completed}/{len(batches)} batches, {len(translations)} paired texts', flush=True)
    return translations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--translate-missing', action='store_true')
    args = parser.parse_args()
    SOURCE_CACHE.mkdir(exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(download, FILES))
    tables = {name: rows for name, rows, _ in sources}
    groups = {row['id']: row for row in tables['version_groups']}
    versions = {row['id']: row for row in tables['versions']}
    names = [row['name'] for table in ['pokemon_species_names', 'ability_names', 'move_names', 'item_names', 'type_names']
             for row in tables[table] if row['local_language_id'] == '9']
    english = set()
    def collect(text):
        value = clean(text)
        if value:
            english.add(value)
            return text_key(value)
        return None
    catalogs = {}
    showdown_proofs = {}
    move_metadata, move_metadata_proofs = showdown_move_metadata()
    for kind in ['ability', 'move', 'item']:
        rows = tables[{'ability': 'abilities', 'move': 'moves', 'item': 'items'}[kind]]
        entries = {row['identifier']: {'id': int(row['id']), 'flavors': []} for row in rows}
        by_id = {str(entry['id']): key for key, entry in entries.items()}
        if kind == 'move':
            prose = {row['move_effect_id']: row for row in tables['move_effect_prose'] if row['local_language_id'] == '9'}
            detail_rows = {row['id']: prose.get(row['effect_id']) for row in rows}
        else:
            detail_rows = {row[f'{kind}_id']: row for row in tables[f'{kind}_prose'] if row['local_language_id'] == '9'}
        for id_value, row in detail_rows.items():
            if not row or id_value not in by_id:
                continue
            entry = entries[by_id[id_value]]
            entry['short'] = collect(row['short_effect'])
            entry['effect'] = collect(row['effect'])
        for row in tables[f'{kind}_flavor_text']:
            if row['language_id'] != '9' or row[f'{kind}_id'] not in by_id:
                continue
            entry = entries[by_id[row[f'{kind}_id']]]
            group = groups[row['version_group_id']]
            entry['flavors'].append([group['identifier'], collect(row['flavor_text']), int(group['order'])])
        for entry in entries.values():
            entry['flavors'].sort(key=lambda value: -value[2])
        latest, showdown_proofs[kind] = showdown(kind)
        for slug, entry in entries.items():
            showdown_id = re.sub(r'[^a-z0-9]', '', slug)
            if kind == 'move':
                literal = {context: fields[showdown_id] for context, fields in move_metadata.items()
                           if isinstance(fields, dict) and showdown_id in fields}
                if literal.get('base'):
                    entry['battleData'] = literal
            revised = latest.get(showdown_id)
            if not revised or not revised.get('base'):
                continue
            names.append(revised.get('name', ''))
            entry['mechanics'] = {}
            for generation, prose in revised.items():
                if not isinstance(prose, dict):
                    continue
                entry['mechanics'][generation] = {
                    'effect': collect(prose.get('desc') or prose.get('shortDesc')),
                    'short': collect(prose.get('shortDesc') or prose.get('desc')),
                }
        catalogs[kind] = entries

    species_entries = {}
    for row in tables['pokemon_species_flavor_text']:
        if row['language_id'] != '9':
            continue
        version = versions[row['version_id']]
        order = int(groups[version['version_group_id']]['order'])
        species_entries.setdefault(row['species_id'], []).append([
            version['identifier'], collect(row['flavor_text']), order,
        ])
    # Retain exact previously audited GO localization pairs, including form-specific entries.
    existing = json.loads((ROOT / 'src/data/pokedex-entries.json').read_text())
    translations = load_translations()
    for species_id, record in existing.items():
        if record['source'] == 'pokemon-go':
            en = clean(record['en'])
            english.add(en)
            translations[en] = clean(record['pt'])
            species_entries.setdefault(species_id, []).append(['pokemon-go', text_key(en), 0])
        for form_name, pair in record.get('forms', {}).items():
            en = clean(pair['en'])
            english.add(en)
            translations[en] = clean(pair['pt'])
            species_entries.setdefault(species_id, []).append(['pokemon-go', text_key(en), 0, form_name])
        if record.get('sourceKind') == 'editorial':
            en = clean(record['en'])
            english.add(en)
            translations[en] = clean(record['pt'])
            # Older PokeAPI flavour tables omit many DLC species. The paired 11.3 record fills that real source gap.
            found = species_entries.setdefault(species_id, [])
            if not any(value[0] == record['version'] for value in found):
                found.append([record['version'], text_key(en), 27])
    translations = prepare_translations(sorted(english), translations, names, args.translate_missing)
    reviewed_path = ROOT / 'scripts/catalogo-ajustes-pt.json'
    reviewed = json.loads(reviewed_path.read_text()) if reviewed_path.exists() else {}
    assert not set(reviewed).difference(english), 'An editorial review must correspond to an actual pinned English source'
    translations.update(reviewed)
    all_texts = {text_key(text): [text, translations[text]] for text in sorted(english)}
    assert len(all_texts) == len(english), 'Text hash collision'
    labels = {row['identifier']: label(row['identifier']) for row in versions.values()}
    labels['pokemon-go'] = label('pokemon-go')
    outputs = []
    def write(name, kind, entries):
        wanted = set()
        if kind == 'species':
            for history in entries.values():
                wanted.update(entry[1] for entry in history)
        else:
            for entry in entries.values():
                wanted.update(key for key in [entry.get('short'), entry.get('effect')] if key)
                wanted.update(flavor[1] for flavor in entry['flavors'])
                for revised in entry.get('mechanics', {}).values():
                    wanted.update(key for key in revised.values() if key)
        selected = {key: all_texts[key] for key in sorted(wanted)}
        if kind != 'species':
            selected = {key: [pair[0], refine_portuguese(*pair)] for key, pair in selected.items()}
        data = {'schemaVersion': 1, 'kind': kind, 'texts': selected, 'entries': entries}
        if kind == 'species':
            data['labels'] = labels
        else:
            data['versionGenerations'] = {row['identifier']: int(row['generation_id']) for row in groups.values()}
            data['versionOrders'] = {row['identifier']: int(row['order']) for row in groups.values()}
            if kind == 'move':
                data['legacySpecialTypes'] = [name.lower() for name in move_metadata['legacyCategory']]
        target = OUTPUT / f'{name}.json'
        target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        outputs.append({'file': f'catalog/v1/{target.name}', 'bytes': target.stat().st_size,
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'entries': len(entries), 'texts': len(wanted)})
    for kind, entries in catalogs.items():
        write(kind, kind, entries)
    for bucket in range(11):
        subset = {key: sorted(history, key=lambda item: -item[2]) for key, history in species_entries.items()
                  if (int(key) - 1) // 100 == bucket}
        write(f'species-{bucket}', 'species', subset)
    proof = {
        'schemaVersion': 1, 'sourceCommit': PIN, 'sources': {name: source for name, _, source in sources},
        'mechanicsSources': showdown_proofs,
        'moveMetadataSources': move_metadata_proofs,
        'englishTexts': len(english), 'languages': ['en', 'pt-BR'],
        'editorialPolicy': 'PokeAPI preserves official English game text. Portuguese core-game references are editorial MyOwnDex renderings, prepared during development, including automated translation with original names protected. They are not an official localization. Runtime/build/install never call a translation service or language model.',
        'translationPreparation': {'service': 'Google Translate', 'execution': 'explicit development-only preparation; persisted strings are shipped locally', 'names': 'English Pokémon, move, ability, item and type names protected before prose translation'},
        'reviewedEditorialOverrides': {'file': 'scripts/catalogo-ajustes-pt.json', 'entries': len(reviewed), 'sha256': hashlib.sha256(reviewed_path.read_bytes()).hexdigest() if reviewed_path.exists() else None},
        'historyPolicy': 'Every English entry present in the pinned PokeAPI CSV is retained with its actual game/version. Most recent available core-game record comes first; official GO pairs follow. A missing source is never invented.',
        'mechanicsPolicy': 'Full current battle explanations come from the pinned Pokémon Showdown reference, with generation/Champions overrides. Showdown is a community battle reference, not literal official game dialogue. PokeAPI long prose has historical rules (e.g. pre-Gen9 Protean/Battle Bond), so it is not silently preferred over the revised explanation. Official in-game flavor remains separately available by selected game.',
        'moveMetadataPolicy': 'Only literal power, accuracy, PP, priority, target, type and category are read from pinned Showdown generation/Champions/Let’s Go/BDSP data. Pre-Gen4 categories use the source type split; Gen1/2 single-battle targets remain single. Callbacks are never executed. Unverified historical secondary effects are not derived from current metadata. Legends games retain their actual in-game flavor instead of being labelled as a main-series generation ruleset.',
        'rights': 'PokeAPI database BSD-3-Clause; Pokémon Showdown MIT. Pokémon text copyright remains with the original rights holders. Existing GO localization pairs retain their original provenance.',
        'outputs': outputs,
    }
    (ROOT / 'docs/catalog-text-provenance.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'texts': len(english), 'files': len(outputs), 'bytes': sum(output['bytes'] for output in outputs)}), flush=True)


if __name__ == '__main__':
    main()
