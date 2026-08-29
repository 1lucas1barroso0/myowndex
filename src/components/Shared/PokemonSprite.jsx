import React, { useEffect, useMemo, useState } from "react";
import { finiteNumberOrNull } from "../../core/math.js";

const EMPTY_CANDIDATES = Object.freeze([]);

const spriteUrls = ({ src, pokemonId, shiny = false, candidates = [] }) => {
    const id = finiteNumberOrNull(pokemonId);
    const regularPath = shiny ? "shiny/" : "";
    return [...new Set([
        src,
        ...candidates,
        Number.isFinite(id) && id > 0
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${regularPath}${id}.png`
            : "",
        Number.isFinite(id) && id > 0
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shiny ? "shiny/" : ""}${id}.png`
            : "",
        Number.isFinite(id) && id > 0 && !shiny
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`
            : "",
    ].filter(Boolean))];
};

export default function PokemonSprite({
    src = "",
    pokemonId = 0,
    shiny = false,
    candidates = EMPTY_CANDIDATES,
    alt = "",
    className = "",
    fallbackClassName = "pokemon-sprite-fallback",
    loading = "lazy",
}) {
    const sources = useMemo(
        () => spriteUrls({ src, pokemonId, shiny, candidates }),
        [src, pokemonId, shiny, candidates],
    );
    const [sourceIndex, setSourceIndex] = useState(0);

    useEffect(() => setSourceIndex(0), [sources]);

    if (!sources[sourceIndex]) {
        return (
            <span className={fallbackClassName} role="img" aria-label={alt || "Sprite temporariamente indisponível"}>
                <span aria-hidden="true">◇</span>
            </span>
        );
    }

    return (
        <img
            src={sources[sourceIndex]}
            alt={alt}
            className={className}
            loading={loading}
            decoding="async"
            onError={() => setSourceIndex(index => index + 1)}
        />
    );
}
