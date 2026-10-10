import spriteFraming from "../data/sprite-framing.json" with { type: "json" };

const fullFrame = Object.freeze({ known: false, width: 96, height: 96, x: 0, y: 0, bodyWidth: 96, bodyHeight: 96 });

export const getPokemonSpriteFraming = source => {
    if (typeof source !== "string" || !source) return fullFrame;
    const path = source.split(/[?#]/)[0];
    const pokeapiMatch = path.match(/^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/([^/]+)\/sprites\/pokemon\/(.+)$/);
    const smogonMatch = path.match(/^https:\/\/raw\.githubusercontent\.com\/smogon\/sprites\/([^/]+)\/(.+)$/);
    const pokeapiPath = pokeapiMatch?.[1] === spriteFraming.pokeapiCommit ? pokeapiMatch[2] : "";
    const smogonPath = smogonMatch?.[1] === spriteFraming.smogonCommit ? smogonMatch[2] : "";
    const key = path.startsWith("/") ? `local${path}`
        : pokeapiPath ? `pokeapi/${pokeapiPath}` : smogonPath ? `smogon/${smogonPath}` : "";
    const values = spriteFraming.assets[key];
    if (!values) return fullFrame;
    const [width, height, x, y, bodyWidth, bodyHeight] = values;
    return { known: true, width, height, x, y, bodyWidth, bodyHeight };
};
