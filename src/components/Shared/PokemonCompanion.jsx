import React, { useState } from "react";

// Decorative partners have one home each. Pokémon in teams, search results and
// the battle field are functional data and do not use this registry.
export const POKEMON_COMPANIONS = Object.freeze({
    pokedex: Object.freeze({ id: 25, name: "Pikachu", tone: "gold" }),
    "pokedex-empty": Object.freeze({ id: 54, name: "Psyduck", tone: "gold" }),
    pc: Object.freeze({ id: 137, name: "Porygon", tone: "blue" }),
    guide: Object.freeze({ id: 164, name: "Noctowl", tone: "teal" }),
    adventure: Object.freeze({ id: 258, name: "Mudkip", tone: "blue" }),
    dice: Object.freeze({ id: 494, name: "Victini", tone: "gold" }),
    generator: Object.freeze({ id: 132, name: "Ditto", tone: "violet" }),
    account: Object.freeze({ id: 133, name: "Eevee", tone: "gold" }),
});

export default function PokemonCompanion({ place, className = "", eager = false }) {
    const companion = POKEMON_COMPANIONS[place];
    const [failedAnimation, setFailedAnimation] = useState(false);
    if (!companion) return null;
    const base = `/sprites/companions/${companion.id}`;
    return (
        <span
            className={`pokemon-companion companion-${companion.tone} ${className}`.trim()}
            data-companion-place={place}
            data-companion-id={companion.id}
            aria-hidden="true"
        >
            <picture>
                <source media="(prefers-reduced-motion: reduce)" srcSet={`${base}.png`} />
                <img
                    src={`${base}.${failedAnimation ? "png" : "gif"}`}
                    alt=""
                    width="96"
                    height="96"
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                    onError={() => setFailedAnimation(true)}
                />
            </picture>
        </span>
    );
}
