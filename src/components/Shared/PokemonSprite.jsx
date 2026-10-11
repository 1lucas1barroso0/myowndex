import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPokemonDisplayHeight, getPokemonSpriteScale } from "../../core/pokemonHeights.js";
import { getPokemonSpriteSources } from "../../core/pokemonSpriteSources.js";
import { getPokemonSpriteFraming } from "../../core/pokemonSpriteFraming.js";
import { subscribeSpriteActivity } from "../../core/spriteActivity.js";

const EMPTY_CANDIDATES = Object.freeze([]);

export default function PokemonSprite({
    src = "",
    children = null,
    pokemonId = 0,
    spriteKey = "",
    shiny = false,
    height,
    framing = "portrait",
    scaleReferenceHeight = 10,
    sceneScale = 1,
    candidates = EMPTY_CANDIDATES,
    alt = "",
    className = "",
    fallbackClassName = "pokemon-sprite-fallback",
    loading = "lazy",
    strictAppearance = false,
}) {
    const frameRef = useRef(null);
    const [activity, setActivity] = useState({ ready: false, visible: false, reducedMotion: true });
    const choices = useMemo(() => {
        const preferred = getPokemonSpriteSources({ src, pokemonId, spriteKey, shiny, candidates, strictAppearance });
        // An old Box can contain no sprite path or a now-broken custom path.
        // Keep its chosen artwork first, but recover from the catalogued,
        // verified 2D appearance of the *same PokÃ©mon* if loading fails.
        if (strictAppearance || !(Number(pokemonId) > 0)) return preferred;
        const safe = getPokemonSpriteSources({ pokemonId, spriteKey,¶»§q«^