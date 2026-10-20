import React from "react";
import { getHpReading } from "../../core/hpPresentation.js";

export default function PokemonHp({ current, maximum, className = "" }) {
    const { now, max, percent, tone } = getHpReading(current, maximum);
    return <span className={`pokemon-hp ${className}`} data-health={tone} role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={max} aria-valuenow={now} aria-valuetext={`${now} de ${max} pontos de vida${now === 0 ? ", fora de combate" : ""}`}>
        <span className="pokemon-hp-reading" aria-hidden="true"><b>HP</b><span><strong>{now}</strong><span className="pokemon-hp-maximum"> / {max}</span></span></span>
        <span className="pokemon-hp-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
    </span>;
}
