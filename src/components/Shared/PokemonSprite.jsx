import React, { useEffect, useMemo, useState } from "react";
import { finiteNumberOrNull } from "../../core/math.js";
import { getPokemonSpriteScale } from "../../core/pokemonHeights.js";

const EMPTY_CANDIDATES = Object.freeze([]);

const spriteUrls = ({ src, pokemonId, spriteKey = "", shiny = false, candidates = [] }) => {
    const id = finiteNumberOrNull(pokemonId);
    const regularPath = shiny ? "shiny/" : "";
    const safeSpriteKey = /^[0-9]+(?:-[a-z0-9-]+)?$/.test(String(spriteKey || "")) ? String(spriteKey) : "";
    const remoteKey = safeSpriteKey || (Number.isFinite(id) && id > 0 ? String(id) : "");
    const hasVariantSprite = Boolean(safeSpriteKey && safeSpriteKey !== String(id || ""));
    const frontUrl = remoteKey
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${regularPath}${remoteKey}.png`
        : "";
    const variantRegularUrl = hasVariantSprite
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${remoteKey}.png`
        : "";
    const localUrl = !hasVariantSprite && Number.isInteger(id) && ((id >= 1 && id <= 151) || id === 479) && !shiny
        ? `/sprites/${id}.png`
        : "";
    return [...new Set([
        hasVariantSprite ? frontUrl : ((!src || src === frontUrl) ? localUrl : ""),
        variantRegularUrl,
        ...candidates,
        src,
        localUrl,
        frontUrl,
        Number.isInteger(id) && id > 0 && id <= 649
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/${regularPath}${remoteKey || id}.png`
            : "",
    ].filter(Boolean))];
};

export default function PokemonSprite({
    src = "",
    pokemonId = 0,
    spriteKey = "",
    shiny = false,
    height,
    candidates = EMPTY_CANDIDATES,
    alt = "",
    className = "",
    fallbackClassName = "pokemon-sprite-fallback",
    loading = "lazy",
}) {
    const sources = useMemo(
        () => spriteUrls({ src, pokemonId, spriteKey, shiny, candidates }),
        [src, pokemonId, spriteKey, shiny, candidates],
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
