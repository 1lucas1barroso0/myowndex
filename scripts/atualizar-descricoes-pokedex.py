#!/usr/bin/env python3
"""Rebuild the bundled bilingual species descriptions from pinned public sources.

No runtime translation, external keys, language models, or third-party translation
service is used. Official GO language pairs are kept verbatim. The 18 selected
Scarlet entries have reviewed local Portuguese editorial translations.
"""
import concurrent.futures
import csv
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / 'src/data'
GO_SHA = '8353f3c4451f4b9154684222ce55128b8a33c7e4'
API_SHA = 'bc92d3b6029ef1abe9e7ad424c400b338f3c11fe'
SOURCES = {
    'go-apk-en': ('PokeMiners/pogo_assets', GO_SHA, 'Texts/Latest APK/English.txt'),
    'go-apk-pt': ('PokeMiners/pogo_assets', GO_SHA, 'Texts/Latest APK/BrazilianPortuguese.txt'),
    'go-remote-en': ('PokeMiners/pogo_assets', GO_SHA, 'Texts/Latest Remote/English.txt'),
    'go-remote-pt': ('PokeMiners/pogo_assets', GO_SHA, 'Texts/Latest Remote/BrazilianPortuguese.txt'),
    'api-flavors': ('PokeAPI/pokeapi', API_SHA, 'data/v2/csv/pokemon_species_flavor_text.csv'),
    'api-species': ('PokeAPI/pokeapi', API_SHA, 'data/v2/csv/pokemon_species.csv'),
    'api-pokemon': ('PokeAPI/pokeapi', API_SHA, 'data/v2/csv/pokemon.csv'),
    'api-versions': ('PokeAPI/pokeapi', API_SHA, 'data/v2/csv/versions.csv'),
}

# Only keys missing the ordinary species resource need an explicit standard form.
# The PokeAPI default identifiers are verified against the pinned pokemon.csv.
FORM_KEYS = {
    905: ('pokemon_desc_0905_2802', 'enamorus-incarnate'),
    916: ('pokemon_desc_0916_2981', 'oinkologne-male'),
    925: ('pokemon_desc_0925_2984', 'maushold-family-of-four'),
    931: ('pokemon_desc_0931_2985', 'squawkabilly-green-plumage'),
    964: ('pokemon_desc_0964_2989', 'palafin-zero'),
    978: ('pokemon_desc_0978_2991', 'tatsugiri-curly'),
    982: ('pokemon_desc_0982_2994', 'dudunsparce-two-segment'),
    1007: ('pokemon_desc_1007_2996', 'koraidon'),
    1008: ('pokemon_desc_1008_2997', 'miraidon'),
}

EDITORIAL_PT = {
    999: 'Este Pokémon nasceu dentro de um baú de tesouro há cerca de 1.500 anos. Ele drena a energia vital de canalhas que tentam roubar o tesouro.',
    1009: 'Esta criatura feroz é envolta em mistério. Seu nome vem de um monstro aquático mencionado em um antigo diário de expedição.',
    1010: 'Muitas de suas características físicas correspondem às de um Virizion do futuro, descrito em uma revista sobre fenômenos paranormais.',
    1011: 'Dipplin é composto por duas criaturas em um só Pokémon. Sua evolução foi desencadeada por uma maçã especial cultivada em apenas um lugar.',
    1012: 'Dizem que os arrependimentos de um mestre da cerimônia do chá, que morreu antes de aperfeiçoar sua arte, permaneceram em um pouco de matcha e se tornaram um Pokémon.',
    1013: 'Ele se passa por chá e tenta enganar as pessoas para que o bebam, podendo assim drenar sua energia vital. O truque geralmente não funciona.',
    1014: 'Depois que todos os seus músculos foram estimulados pela corrente tóxica em seu pescoço, Okidogi se transformou e ganhou um físico poderoso.',
    1015: 'A corrente é feita de toxinas que aprimoram capacidades. Ela estimulou o cérebro de Munkidori e fez os poderes psíquicos do Pokémon florescerem.',
    1016: 'Fezandipiti deve sua bela aparência e sua voz encantadora aos estimulantes tóxicos que emanam da corrente enrolada em seu corpo.',
    1017: 'O tipo deste Pokémon muda conforme a máscara que ele usa. Seus movimentos ágeis e chutes confundem os inimigos.',
    1018: 'Ele acumula eletricidade estática do ambiente. Os raios que lança quando se apoia nas quatro patas são tremendamente poderosos.',
    1019: 'Sete syrpents vivem dentro de uma maçã feita de xarope. O syrpent no centro é o comandante.',
    1020: 'Há pouquíssimos relatos de avistamentos desta criatura. Um vídeo curto mostra a criatura em fúria, expelindo pilares de chamas.',
    1021: 'Dizem que ele incinera tudo ao seu redor com relâmpagos lançados de seu pelo. Sabe-se muito pouco sobre esta criatura.',
    1022: 'Ele se parece com um Pokémon descrito em uma revista de credibilidade duvidosa como um Terrakion modificado por uma organização maligna.',
    1023: 'Ele se parece com um objeto misterioso apresentado em uma revista sobre fenômenos paranormais como uma arma de última geração com a forma de um Cobalion.',
    1024: 'Terapagos se protege usando seu poder de transformar energia em cristais duros. Este Pokémon é a origem do fenômeno Terastal.',
    1025: 'Ele alimenta outros com mochi tóxicos que despertam desejos e capacidades. Quem come os mochi fica sob o controle de Pecharunt, preso à sua vontade.',
}


def download(pair):
    key, (repo, sha, path) = pair
    url = f'https://raw.githubusercontent.com/{repo}/{sha}/{urllib.parse.quote(path)}'
    raw = urllib.request.urlopen(url, timeout=45).read()
    return key, raw, {
        'repository': repo,
        'commit': sha,
        'path': path,
        'url': url,
        'sha256': hashlib.sha256(raw).hexdigest(),
        'bytes': len(raw),
    }


def parse_resources(raw):
    text = raw.decode('utf-8').replace('\r\n', '\n')
    return dict(re.findall(
        r'RESOURCE ID: ([^\n]+)\nTEXT: (.*?)(?=\n\nRESOURCE ID: |\Z)', text, re.S,
    ))


def csv_rows(raw):
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8'))))


def main():
    downloaded = list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(download, SOURCES.items()))
    raw = {key: data for key, data, _ in downloaded}
    provenance = {key: proof for key, _, proof in downloaded}
    english = parse_resources(raw['go-apk-en'])
    english.update(parse_resources(raw['go-remote-en']))
    portuguese = parse_resources(raw['go-apk-pt'])
    portuguese.update(parse_resources(raw['go-remote-pt']))
    names = {int(row['id']): row['identifier'] for row in csv_rows(raw['api-species'])}
    defaults = {int(row['species_id']): row['identifier'] for row in csv_rows(raw['api-pokemon']) if row['is_default'] == '1'}
    versions = {row['id']: row['identifier'] for row in csv_rows(raw['api-versions'])}
    entries = {}

    for species_id in range(1, 1009):
        resource = f'pokemon_desc_{species_id:04}'
        form = None
        if resource not in english or resource not in portuguese:
            resource, form = FORM_KEYS[species_id]
            assert defaults[species_id] == form, (species_id, defaults[species_id], form)
        assert english[resource].strip() and portuguese[resource].strip(), species_id
        entry = {
            'en': english[resource].strip(),
            'pt': portuguese[resource].strip(),
            'source': 'pokemon-go',
            'sourceKind': 'official-localization',
            'resourceId': resource,
        }
        if form:
            entry['form'] = form
        entries[str(species_id)] = entry

    scarlet = {
        int(row['species_id']): row['flavor_text']
        for row in csv_rows(raw['api-flavors'])
        if row['language_id'] == '9' and versions[row['version_id']] == 'scarlet'
        and int(row['species_id']) in EDITORIAL_PT
    }
    assert set(scarlet) == set(EDITORIAL_PT)
    roaming = entries['999']
    for species_id, text in EDITORIAL_PT.items():
        entries[str(species_id)] = {
            'en': scarlet[species_id],
            'pt': text,
            'source': 'pokeapi',
            'sourceKind': 'editorial',
            'version': 'scarlet',
            'resourceId': f'pokemon-species/{species_id}/flavor-text/en/scarlet',
            'sourceUrl': f'https://pokeapi.co/api/v2/pokemon-species/{species_id}/',
        }

    entries['999']['forms'] = {'gimmighoul-roaming': roaming}
    assert list(map(int, entries)) == list(range(1, 1026))
    assert all(entry['en'].strip() and entry['pt'].strip() and entry['en'] != entry['pt'] for entry in entries.values())
    assert not any(re.search(r'<[^>]+>|\{[A-Za-z]|RESOURCE ID:', entry[lang]) for entry in entries.values() for lang in ('en', 'pt'))
    output = OUTPUT / 'pokedex-entries.json'
    output.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n')
    proof = {
        'schemaVersion': 1,
        'languages': ['en', 'pt-BR'],
        'speciesCount': len(entries),
        'officialLocalizedPairs': 1007,
        'additionalOfficialFormPairs': 1,
        'editorialLocalizedPairs': len(EDITORIAL_PT),
        'editorialVersion': 'Pokémon Scarlet',
        'editorialSpecies': [{'id': species_id, 'name': names[species_id]} for species_id in EDITORIAL_PT],
        'officialStandardFormResources': {str(key): {'resourceId': value[0], 'pokeapiDefaultForm': value[1]} for key, value in FORM_KEYS.items()},
        'sources': provenance,
        'rights': {
            'pokemonGo': 'Official Pokémon GO localization preserved by PokeMiners. Text copyright belongs to The Pokémon Company/Niantic. Repository README specifies educational use; no independent permissive asset license is declared.',
            'pokeapi': 'PokeAPI database is BSD-3-Clause. Pokémon text copyright remains with the original rights holders.',
            'editorial': 'Local Portuguese translations prepared for MyOwnDex from the corresponding pinned English Pokémon Scarlet entries. These are editorial translations, not an official Brazilian localization.',
        },
        'officialTextPolicy': 'Both texts of each official pair have the same resource ID. Texts are preserved verbatim except outer whitespace/newline normalization. English proper-name substitutions must be applied by presentation code, not by rewriting these official source records.',
        'notes': [
            'Pokémon GO and Scarlet are different sources. Never show a PokeAPI Red/Blue original with an unrelated GO localized text.',
            'Gimmighoul Chest Form uses the corresponding Scarlet original and a local translation. Roaming Form uses its paired official GO resource; the source switches with the form.',
            'The GO resource for Maushold Family of Four is 2984, not 2983 (Family of Three).',
            'Syrpent is kept in English in the Hydrapple editorial text.',
        ],
        'output': {'file': output.name, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()},
    }
    (OUTPUT.parents[1] / 'docs/pokedex-entries-provenance.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'species': len(entries), 'official': 1007, 'editorial': len(EDITORIAL_PT), 'bytes': output.stat().st_size, 'sha256': proof['output']['sha256']}))


if __name__ == '__main__':
    main()
