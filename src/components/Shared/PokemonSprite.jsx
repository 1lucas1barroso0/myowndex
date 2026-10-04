import React, { useEffect, useMemo, useState } from "react";
import { finiteNumberOrNull } from "../../core/math.js";
import { getPokemonSpriteScale } from "../../core/pokemonHeights.js";

const EMPTY_CANDIDATES = Object.freeze([]);

const spriteUrls = ({ src, pokemonId, shiny = false, candidates = [] }) => {
    const id = finiteNumberOrNull(pokemonId);
    const regularPath = shiny ? "shiny/" : "";
    const frontUrl = Number.isFinite(id) && id > 0
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${regularPath}${id}.png`
        : "";
    const localUrl = Number.isInteger(id) && ((id >= 1 && id <= 151) || id === 479) && !shiny
        ? `/sprites/${id}.png`
        : "";
    return [...new Set([
        (!src || src === frontUrl) ? localUrl : "",
        src,
        ...candidates,
        localUrl,
        frontUrl,
        Number.isInteger(id) && id > 0 && id <= 649
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/${regularPath}${id}.png`
            : "",
    ].filter(Boolean))];
};

export default function PokemonSprite({
    src = "",
    pokemonId = 0,
    shiny = false,
    height,
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
            <span className={fallbackClassName} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
                <span aria-hidden="true">◇</span>
            </span>
        );
    }

    return (
        <img
            src={sources[sourceIndex]}
            alt={alt}
            className={`pokemon-sized-sprite ${className}`}
            style={{ "--pokemon-scale": getPokemonSpriteScale(pokemonId, height) }}
            loading={loading}
            decoding="async"
            onError={() => setSourceIndex(index => index + 1)}
        />
    );
}
