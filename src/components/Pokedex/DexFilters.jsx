import React from "react";
import { formatType, TYPES } from "../../core/mechanics.js";
import GameIcon from "../Shared/GameIcon.jsx";
import RoomSelect from "../Shared/RoomSelect.jsx";

const clampDexNumber = value => {
    if (value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.max(1, Math.min(1025, Math.floor(number))));
};

export default function DexFilters({
    types = [],
    onTypesChange,
    minNumber = "",
    maxNumber = "",
    onMinNumberChange,
    onMaxNumberChange,
    variantView = "grouped",
    onVariantViewChange,
    onReset,
}) {
    const activeCount = types.length
        + Number(Boolean(minNumber))
        + Number(Boolean(maxNumber))
        + Number(variantView !== "grouped");
    const toggleType = type => {
        onTypesChange?.(types.includes(type) ? types.filter(value => value !== type) : [...types, type]);
    };

    return <details className="dex-more-filters">
        <summary><GameIcon name="types" /><span>Mais filtros</span>{activeCount > 0 && <b>{activeCount}</b>}</summary>
        <div className="dex-more-filters-body">
            <fieldset className="dex-type-filter">
                <legend>Tipos</legend>
                <p>Marque um ou mais. Com vários, o Pokémon precisa ter todos eles.</p>
                <div className="dex-type-options">
                    {TYPES.filter(type => type !== "stellar").map(type => <button
                        key={type}
                        type="button"
                        aria-pressed={types.includes(type)}
                        onClick={() => toggleType(type)}
                    >{formatType(type)}</button>)}
                </div>
            </fieldset>

            <fieldset className="dex-range-filter">
                <legend>Intervalo da National Dex</legend>
                <p>Use só o começo, só o fim ou os dois.</p>
                <div className="dex-range-fields">
                    <label><span>Do nº</span><input type="number" inputMode="numeric" min="1" max="1025" value={minNumber}
                        onChange={event => onMinNumberChange?.(event.target.value === "" ? "" : event.target.value)}
                        onBlur={event => onMinNumberChange?.(clampDexNumber(event.target.value))} /></label>
                    <span aria-hidden="true">até</span>
                    <label><span>Até o nº</span><input type="number" inputMode="numeric" min="1" max="1025" value={maxNumber}
                        onChange={event => onMaxNumberChange?.(event.target.value === "" ? "" : event.target.value)}
                        onBlur={event => onMaxNumberChange?.(clampDexNumber(event.target.value))} /></label>
                </div>
            </fieldset>

            <label className="dex-variant-filter">
                <span>Variantes na lista</span>
                <RoomSelect value={variantView} onChange={event => onVariantViewChange?.(event.target.value)}>
                    <option value="grouped">Juntas na espécie</option>
                    <option value="split">Separar as fixas</option>
                    <option value="regional">Só variantes regionais</option>
                </RoomSelect>
                <small>Formas que o mesmo Pokémon pode trocar continuam juntas na ficha.</small>
            </label>

            {activeCount > 0 && <button type="button" className="room-secondary-button dex-filter-reset" onClick={onReset}>Limpar estes filtros</button>}
        </div>
    </details>;
