import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPokemonDisplayHeight, getPokemonSpriteScale } from "../../core/pokemonHeights.js";
import { getPokemonSpriteSources } from "../../core/pokemonSpriteSources.js";
import { getPokemonSpriteFraming } from "../../core/pokemonSpriteFraming.js";
import { subscribeSpriteActivity } from "../../core/spriteActivity.js";

const EMPTY_CANDIDATES = Object.freeze([]);

export default function PokemonSprite({
    src = "",
    pokemonId = 0,
    spriteKey = "",
    shiny = false,
    height,
    framing = "portrait",
    scaleReferenceHeight = 10,
    candidates = EMPTY_CANDIDATES,
    alt = "",
    className = "",
    fallbackClassName = "pokemon-sprite-fallback",
    loading = "lazy",
    strictAppearance = false,
}) {
    const frameRef = useRef(null);
    const [activity, setActivity] = useState({ ready: false, visible: false, reducedMotion: true });
    const choices = useMemo(
        () => getPokemonSpriteSources({ src, pokemonId, spriteKey, shiny, candidates, strictAppearance }),
        [src, pokemonId, spriteKey, shiny, candidates, strictAppearance],
    );
    const sources = activity.reducedMotion ? choices.static : [...choices.animated, ...choices.static];
    const sourceKey = sources.join("\n");
    const [recovery, setRecovery] = useState({ key: "", index: 0 });
    const [unmeasuredSource, setUnmeasuredSource] = useState("");
    const sourceIndex = recovery.key === sourceKey ? recovery.index : 0;
    const source = sources[sourceIndex];
    const hasSources = Boolean(choices.animated.length || choices.static.length);
    const available = !activity.ready || Boolean(source);
    useEffect(() => hasSources ? subscribeSpriteActivity(frameRef.current, setActivity) : undefined, [hasSources, available]);

    if (!hasSources || !available) {
        return (
            <span ref={frameRef} className={fallbackClassName} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
                <span aria-hidden="true">◇</span>
            </span>
        );
    }

    const bounds = getPokemonSpriteFraming(source);
    const physicalHeight = getPokemonDisplayHeight({ src: source || src, pokemonId, height, spriteKey });
    const motion = !activity.ready ? "pending" : !activity.visible ? "paused" : /\.(?:gif|apng)(?:[?#].*)?$/i.test(source) ? "animated" : "static";
    const scale = framing === "scene" ? getPokemonSpriteScale(pokemonId, physicalHeight, scaleReferenceHeight) : 1;
    return (
        <span
            ref={frameRef}
            className={`pokemon-sized-sprite ${className}`}
            data-pokemon-motion={motion}
            data-pokemon-framing={framing}
            data-pokemon-crop={bounds.known && unmeasuredSource !== source ? "authored-frames" : "full-image"}
            data-pokemon-height-dm={physicalHeight ?? undefined}
            data-pokemon-scale={scale}
            style={{
                "--pokemon-scale": scale,
                "--pokemon-aspect-ratio": bounds.bodyWidth / bounds.bodyHeight,
                "--sprite-canvas-width": bounds.width,
                "--sprite-canvas-height": bounds.height,
                "--sprite-body-x": bounds.x,
                "--sprite-body-y": bounds.y,
                "--sprite-body-width": bounds.bodyWidth,
                "--sprite-body-height": bounds.bodyHeight,
            }}
        >
            <img
                src={activity.visible ? source : undefined}
                alt={alt}
                className="pokemon-sprite-image"
                data-pokemon-motion={motion}
                loading={loading}
                decoding="async"
                onLoad={event => {
                    if (bounds.known && (event.currentTarget.naturalWidth !== bounds.width || event.currentTarget.naturalHeight !== bounds.height)) setUnmeasuredSource(source);
                }}
                onError={() => activity.visible && setRecovery({ key: sourceKey, index: sourceIndex + 1 })}
            />
        </span>
    );
}
