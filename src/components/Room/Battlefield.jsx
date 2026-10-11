import React, { useId, useMemo, useState } from "react";
import { getHitKillProtectionKey } from "../../core/automation.js";
import { formatPokemonInScene } from "../../core/copy.js";
import { formatName, formatType } from "../../core/mechanics.js";
import { clampFinite, safeDivide } from "../../core/math.js";
import { getPokemonDisplayHeight } from "../../core/pokemonHeights.js";
import { getPokemonSpriteFraming } from "../../core/pokemonSpriteFraming.js";
import { getPokemonSpriteSources } from "../../core/pokemonSpriteSources.js";
import { ROOM_SCENARIOS, ROOM_TERRAINS, ROOM_WEATHERS, STATUS_LABELS } from "../../core/room.js";
import { getBattleDisplayIdentity } from "../../core/specialMechanics.js";
import { getTraitStatus } from "../../core/traitMechanics.js";
import PokemonSprite from "../Shared/PokemonSprite.jsx";
import RoomSelect from "../Shared/RoomSelect.jsx";

const clamp = (value, minimum, maximum) => clampFinite(value, minimum, maximum, minimum);

const HIT_KILL_FIELD_LABELS = Object.freeze({
    available: "proteÃ§Ã£o contra hit kill disponÃ­vel",
    used: "proteÃ§Ã£o contra hit kill consumida nesta batalha",
    lost: "proteÃ§Ã£o contra hit kill encerrada por autocusto nesta batalha",
});

const getHpTone = token => {
    const percentage = safeDivide(token.currentHp, token.maxHp, 0);
    if (percentage <= 0.25) return "danger";
    if (percentage <= 0.5) return "warning";
    return "healthy";
};

const displayedPokemonId = (token, display) => display.disgui¶»§q«^