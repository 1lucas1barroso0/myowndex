import React from "react";

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

// Decorative partners use their own animated sprite masters. Their motion is
// authored in the sprite frames themselves: CSS never invents bobbing, sway or
// pseudo-idle movement. PNG masters remain available only as static fallbacks
// for asset inspection and emergency recovery.
export default function PokemonCompanion({ place, className = "", eager = false }) {
    const companion = POKEMON_COMPANIONS[place];
    if (!companion) return null;
    return (
        <span
            className={`pokemon-companion companion-${companion.tone} ${className}`.trim()}
            data-companion-place={place}
            data-companion-id={companion.id}
            aria-hidden="true"
        >
            <img
                src={`/sprites/companions/${companion.id}.gif`}
                alt=""
                width="96"
                height="96"
                loading={eager ? "eager" : "lazy"}
                decoding="async"
            />
        </span>
    );
}
