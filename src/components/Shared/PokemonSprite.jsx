import React, { useEffect, useMemo, useState } from "react";
import { getPokemonSpriteScale } from "../../core/pokemonHeights.js";
import { getPokemonSpriteSources } from "../../core/pokemonSpriteSources.js";

const EMPTY_CANDIDATES = Object.freeze([]);

// Chromium delivers a separate media event for each MediaQueryList instance.
// A full Pokédex must receive one preference change, rather than dozens of
// consecutive synchronous React commits from separate native events.
let motionQuery = null;
let motionUpdateQueued = false;
const motionListeners = new Set();
const queueMotionUpdate = () => {
    if (motionUpdateQueued) return;
    motionUpdateQueued = true;
    queueMicrotask(() => {
        motionUpdateQueued = false;
        const reduced = Boolean(motionQuery?.matches);
        for (const listener of motionListeners) listener(reduced);
    });
};
const subscribeMotion = listener => {
    if (!motionQuery && typeof window !== "undefined" && window.matchMedia) {
        motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    }
    motionListeners.add(listener);
    if (motionListeners.size === 1) motionQuery?.addEventListener("change", queueMotionUpdate);
    queueMotionUpdate();
    return () => {
        motionListeners.delete(listener);
        if (!motionListeners.size) motionQuery?.removeEventListener("change", queueMotionUpdate);
    };
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
    strictAppearance = false,
}) {
    // Start static during hydration. A media preference change may affect an
    // entire Pokédex page; ordinary state lets React batch those updates rather
    // than force one synchronous commit for every visible sprite.
    const [reducedMotion, setReducedMotion] = useState(true);
    useEffect(() => subscribeMotion(setReducedMotion), []);
    const sources = useMemo(
        () => {
            const choices = getPokemonSpriteSources({ src, pokemonId, spriteKey, shiny, candidates, strictAppearance });
            return reducedMotion ? choices.static : [...choices.animated, ...choices.static];
        },
        [src, pokemonId, spriteKey, shiny, candidates, strictAppearance, reducedMotion],
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
            data-pokemon-motion={/\.gif(?:[?#].*)?$/i.test(sources[sourceIndex]) ? "animated" : "static"}
            style={{ "--pokemon-scale": getPokemonSpriteScale(pokemonId, height) }}
            loading={loading}
            decoding="async"
            onError={() => setSourceIndex(index => index + 1)}
        />
    );
}
