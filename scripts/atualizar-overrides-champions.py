#!/usr/bin/env python3
"""Rebuild the small runtime subset from the existing pinned local catalogue."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'public/catalog/v1/move.json').read_text())
proof = json.loads((ROOT / 'docs/catalog-text-provenance.json').read_text())['moveMetadataSources']['champions']
overrides = {
    name: entry['battleData']['champions']
    for name, entry in catalog['entries'].items()
    if entry.get('battleData', {}).get('champions')
}
payload = {
    'schemaVersion': 1,
    'source': proof,
    'moves': overrides,
    # Literal self.boosts.spa in the source pinned above; no callbacks execute.
    'statChanges': {'make-it-rain': [{'stat': 'special-attack', 'change': -2}]},
}
(ROOT / 'src/data/champions-move-overrides.json').write_text(
    json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8',
)
print(f'{len(overrides)} movimentos Champions: subconjunto local atualizado.')
