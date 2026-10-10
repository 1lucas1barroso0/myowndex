#!/usr/bin/env python3
"""Arrange licensed, human-drawn tiles without synthesizing or repainting art."""
from pathlib import Path
from PIL import Image
import base64
import hashlib
import io
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/scenes/source/kenney-roguelike.png"
SHEET = Image.open(SOURCE).convert("RGBA")
SHEETS = {name: Image.open(ROOT / f"public/scenes/source/kenney-{name}.png").convert("RGBA") for name in ["tiny-town", "tiny-ski", "tiny-dungeon"]}
WIDTH, HEIGHT = 30, 20
DECORATIONS = json.loads((ROOT / 'public/scenes/source/decorations.json').read_text(encoding='utf-8'))


def tile(x, y, source="rpg"):
    if source != "rpg":
        return SHEETS[source].crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16))
    return SHEET.crop((x * 17, y * 17, x * 17 + 16, y * 17 + 16))


def scene(ground, backdrop=None):
    image = Image.new("RGBA", (WIDTH * 16, HEIGHT * 16), backdrop or "#142638")
    if ground:
        for y in range(HEIGHT):
            for x in range(WIDTH):
                image.alpha_composite(tile(*ground), (x * 16, y * 16))
    return image


def put(image, source, x, y, scale=1):
    pixels = tile(*source)
    if scale != 1:
        pixels = pixels.resize((16 * scale, 16 * scale), Image.Resampling.NEAREST)
    image.alpha_composite(pixels, (x * 16, y * 16))


def ground(image, color, left, top, width, height):
    """Flat map geometry; original landmark pixels are never repainted."""
    image.paste(color, (left * 16, top * 16, (left + width) * 16, (top + height) * 16))


def area(image, source, left, top, width, height):
    for y in range(top, top + height):
        for x in range(left, left + width):
            put(image, source, x, y)


def reserve(image, name, x, y, width, height):
    """Keep important landmarks fully inside the map and apart from each other."""
    if x < 1 or y < 1 or x + width > WIDTH - 1 or y + height > HEIGHT - 1:
        raise ValueError(f"{name}: incomplete at edge ({x}, {y}, {width}, {height})")
    used = image.info.setdefault("occupied_landmarks", [])
    for other, left, top, right, bottom in used:
        if x < right and left < x + width and y < bottom and top < y + height:
            raise ValueError(f"{name}: overlaps {other}")
    used.append((name, x, y, x + width, y + height))


def tree(image, x, y, evergreen=False, scale=1):
    reserve(image, "pinheiro" if evergreen else "arvore", x, y, scale if evergreen else 3 * scale, 2 * scale if evergreen else 3 * scale)
    if evergreen:
        put(image, (4, 0, "tiny-town"), x, y, scale)
        put(image, (4, 1, "tiny-town"), x, y + scale, scale)
    else:
        for dy in range(3):
            for dx in range(3):
                put(image, (6 + dx, dy, "tiny-town"), x + dx * scale, y + dy * scale, scale)


def house(image, left, top, roof=0, scale=1):
    reserve(image, "casa", left, top, 4 * scale, 4 * scale)
    # Four roof/wall tiles form a familiar little town house. Original pixels
    # and tile orientation are retained; maps never distort the Pokémon art.
    for y in range(2):
        for x in range(4):
            put(image, (roof + (0 if x == 0 else 2 if x == 3 else 1), 4 + y, "tiny-town"), left + x * scale, top + y * scale, scale)
    for x in range(4):
        put(image, (0 if x == 0 else 3 if x == 3 else 1, 6, "tiny-town"), left + x * scale, top + 2 * scale, scale)
        put(image, (0 if x == 0 else 3 if x == 3 else 2 if x == 2 else 1, 7, "tiny-town"), left + x * scale, top + 3 * scale, scale)
    put(image, (2, 6, "tiny-town"), left + scale, top + 2 * scale, scale)


def route():
    image = scene(None, "#17a64a")
    for y in range(HEIGHT):
        middle = 14 + (1 if 5 <= y < 12 else -1 if y >= 12 else 0)
        ground(image, "#e99a2e", middle - 1, y, 3, 1)
    for x, y in [(3, 2), (23, 2), (3, 14), (23, 14)]:
        tree(image, x, y, scale=1)
    for x, y in [(9, 6), (21, 12), (10, 17), (21, 7)]:
        put(image, (2, 0, "tiny-town"), x, y)
    put(image, (11, 6, "tiny-town"), 18, 4)
    put(image, (11, 6, "tiny-town"), 11, 13)
    return image


def forest():
    image = scene(None, "#08783b")
    # Border groves stay inside the scene; the centre is reserved for Pokémon.
    for x, y in [(3, 2), (8, 2), (20, 2), (25, 2),
                 (3, 16), (8, 16), (20, 16), (25, 16)]:
        tree(image, x, y, evergreen=True)
    for x, y in [(3, 7), (23, 7), (3, 12), (23, 12)]:
        tree(image, x, y)
    for x, y in [(11, 7), (18, 14), (10, 13), (20, 7)]:
        put(image, (5, 2, "tiny-town"), x, y)
    return image

def town():
    image = scene(None, "#3478a2")
    ground(image, "#182e48", 0, 10, WIDTH, 3)
    ground(image, "#182e48", 14, 0, 2, HEIGHT)
    house(image, 3, 2)
    house(image, 22, 2, roof=4)
    ground(image, "#17a64a", 3, 14, 8, 6)
    ground(image, "#17a64a", 19, 14, 8, 6)
    for x, y in [(5, 15), (22, 15)]:
        tree(image, x, y)
    for x in [9, 21]:
        put(image, (38, 8), x, 8)
    return image

def beach():
    image = scene(None, "#f5bf35")
    for y in range(HEIGHT):
        coast = 12 + (y // 5) % 2
        ground(image, "#007cba", 0, y, coast, 1)
    for x, y in [(18, 3), (23, 15), (25, 6)]:
        put(image, (28, 9), x, y, 2)
    area(image, (5, 2), 7, 13, 8, 1)
    for x in [7, 10, 13]:
        put(image, (20, 0), x, 14)
    put(image, (19, 0), 18, 5, 2)
    return image


def cave():
    image = scene(None, "#182e48")
    ground(image, "#354f6c", 0, 0, WIDTH, 4)
    ground(image, "#354f6c", 0, 17, WIDTH, 3)
    for x in [0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29]:
        ground(image, "#354f6c", x, 4, 1, 13)
    for left, top in [(7, 3), (21, 3), (5, 10), (23, 10), (8, 15), (20, 15)]:
        for y in range(2):
            for x in range(2):
                put(image, (7 + x, 13 + y), left + x, top + y)
    for x, y in [(7, 5), (21, 5), (7, 14), (22, 14)]:
        put(image, (9, 6, "tiny-ski"), x, y, 2)
        put(image, (54, 21), x + 2, y, 2)
    for x in [10, 19]:
        put(image, (11, 10, "tiny-dungeon"), x, 4, 2)
    put(image, (5, 3, "tiny-dungeon"), 14, 2, 2)
    return image


def snow():
    image = scene(None, "#effaff")
    for x, y in [(4, 3), (9, 3), (20, 3), (25, 3), (4, 14), (25, 14)]:
        put(image, (6, 0, "tiny-ski"), x, y, 2)
        put(image, (6, 1, "tiny-ski"), x, y + 2, 2)
    for x, y in [(8, 9), (21, 10), (11, 16)]:
        put(image, (9, 6, "tiny-ski"), x, y, 2)
    ground(image, "#4ab3e8", 14, 0, 2, HEIGHT)
    return image


def arena():
    image = scene(None, "#14a45a")
    for y in [2, 3, 16, 17]:
        for x in range(1, WIDTH - 1):
            put(image, (38, 8), x, y)
    for x, source in [(6, (50, 0)), (10, (50, 3)), (19, (50, 6)), (23, (50, 3))]:
        put(image, source, x, 1)
    # The arena border uses the source pack's white court tiles.
    for x in range(6, 24):
        put(image, (11, 16), x, 5)
        put(image, (11, 18), x, 14)
    for y in range(6, 14):
        put(image, (10, 17), 6, y)
        put(image, (12, 17), 23, y)
    for x, y, source in [(6, 5, (10, 16)), (23, 5, (12, 16)), (6, 14, (10, 18)), (23, 14, (12, 18))]:
        put(image, source, x, y)
    area(image, (11, 16), 13, 9, 4, 1)
    area(image, (11, 18), 13, 10, 4, 1)
    return image


def laboratory():
    image = scene(None, "#245479")
    ground(image, "#102c49", 0, 0, WIDTH, 2)
    ground(image, "#102c49", 0, 18, WIDTH, 2)
    for x in [6, 18]:
        put(image, (7, 4, "tiny-dungeon"), x, 2, 2)
        put(image, (0, 9, "tiny-dungeon"), x + 3, 2, 2)
        for dx in [0, 2, 4]:
            put(image, (23, 3), x + dx, 4, 2)
    for x in [7, 21]:
        put(image, (7, 1, "tiny-dungeon"), x, 14, 2)
        put(image, (7, 2, "tiny-dungeon"), x, 16, 2)
        put(image, (47, 16), x + 2, 16, 2)
    return image


def distortion():
    image = scene(None, "#151044")
    for left, top, width, height in [(3, 3, 10, 5), (17, 3, 10, 5), (6, 12, 8, 5), (18, 12, 8, 5)]:
        area(image, (1, 21), left, top, width, height)
        for x in range(left, left + width):
            put(image, (1, 23), x, top + height)
    for x, y in [(8, 3), (21, 4), (10, 14), (22, 13)]:
        put(image, (9, 6, "tiny-ski"), x, y)
    return image


SCENES = [
    ("rota", "Rota campestre", ["grama", "caminho", "árvores", "placas"], route),
    ("floresta", "Floresta", ["árvores densas", "clareira", "vegetação"], forest),
    ("cidade", "Cidade", ["casas", "ruas", "bancos", "praças"], town),
    ("praia", "Praia", ["mar", "areia", "cais", "litoral"], beach),
    ("caverna", "Caverna", ["paredes de pedra", "rochas", "tochas"], cave),
    ("neve", "Campo nevado", ["chão claro", "pinheiros", "rochas", "trilha"], snow),
    ("arena", "Estádio", ["arquibancadas", "bandeiras", "quadra"], arena),
    ("laboratorio", "Laboratório", ["bancadas", "telas", "frascos", "piso azul"], laboratory),
    ("distorcao", "Mundo Distorcido", ["vazio", "ilhas separadas", "rochas flutuantes"], distortion),
]

manifest = {
    "source": "https://kenney.nl/assets/roguelike-rpg-pack",
    "download": "https://kenney.nl/media/pages/assets/roguelike-rpg-pack/12c03cd78b-1677697420/kenney_roguelike-rpg-pack.zip",
    "authors": ["Kenney Vleugels", "Lynn Evers"],
    "released": 2015,
    "checked": "2026-10-09",
    "license": "CC0-1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "additionalSources": [{
        "name": name,
        "source": f"https://kenney.nl/assets/{name}",
        "author": "Kenney Vleugels",
        "released": 2022 if name == "tiny-dungeon" else 2023,
        "license": "CC0-1.0",
        "sourceSha256": hashlib.sha256((ROOT / f"public/scenes/source/kenney-{name}.png").read_bytes()).hexdigest(),
    } for name in ["tiny-town", "tiny-ski", "tiny-dungeon"]],
    "method": "Nine bespoke pixel-art RPG environments authored as crisp-edged vectors; original CC0 tiles retained underneath for provenance and reproduction.",
    "visualLayerAuthor": "Original pixel-vector RPG worlds authored for MyOwnDex",
    "decorations": "public/scenes/source/decorations.json",
    "scenes": [],
}
for identity, title, features, build in SCENES:
    pixels = build().convert("RGB")
    buffer = io.BytesIO()
    pixels.save(buffer, format="PNG", optimize=True)
    png = buffer.getvalue()
    encoded = base64.b64encode(png).decode("ascii")
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH * 16} {HEIGHT * 16}"><title>{title}</title><image width="{WIDTH * 16}" height="{HEIGHT * 16}" image-rendering="pixelated" href="data:image/png;base64,{encoded}"/></svg>\n'
    svg = svg.replace("</svg>", DECORATIONS[identity] + "</svg>")
    destination = ROOT / f"public/scenes/{identity}.svg"
    destination.write_text(svg, encoding="utf-8")
    manifest["scenes"].append({"id": identity, "title": title, "features": features, "width": pixels.width, "height": pixels.height, "pixelSha256": hashlib.sha256(pixels.tobytes()).hexdigest(), "bytes": destination.stat().st_size})
(ROOT / "public/scenes/source/provenance.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{len(SCENES)} cenários 2D; {sum(item['bytes'] for item in manifest['scenes'])} bytes SVG ao todo.")
