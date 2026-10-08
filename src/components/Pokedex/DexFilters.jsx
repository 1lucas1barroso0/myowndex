import React from "react";
import { formatType, TYPES } from "../../core/mechanics.js";
import { DEX_GENERATIONS, DEX_REGIONS } from "../../core/dexCollection.js";

const toggleValue = (values, value) => values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];

export default function DexFilters({
    generation,
    onGenerationChange,
    types,
    onTypesChange,
    regions,
    onRegionsChange,
    variantMode,
    onVariantModeChange,
    minNumber,
    onMinNumberChange,
    maxNumber,
    onMaxNumberChange,
    onReset,
}) {
    const activeCount = (generation !== "all" ? 1 : 0)
        + types.length + regions.length
        + (variantMode === "separate" ? 1 : 0)
        + (minNumber ? 1 : 0) + (maxNumber ? 1 : 0);

    const toggleRegion = region => {
        onRegionsChange(toggleValue(regions, region));
    };

    return <section className="dex-filters-panel" aria-label="Filtros da Pokédex">
        <div className="dex-generations" role="group" aria-label="Filtrar por geração de estreia">
            <span>Geração</span>
            {DEX_GENERATIONS.map(gen => <button
                key={gen.id}
                type="button"
                aria-pressed={generation === gen.id}
                aria-label={gen.id === "all" ? "Todas as gerações" : `Geração ${gen.label}`}
                onClick={() => onGenerationChange(gen.id)}
            >{gen.label}</button>)}
        </div>

        <details className="dex-more-filters">
            <summary>Mais filtros{activeCount ? <span>{activeCount}</span> : null}</summary>
            <div className="dex-filter-body">
                <section className="dex-filter-section" aria-labelledby="dex-types-title">
                    <div className="dex-filter-heading">
                        <strong id="dex-types-title">Tipos</strong>
                        <small>Escolha até dois tipos. Se escolher dois, o Pokémon precisa ter os dois.</small>
                    </div>
                    <div className="dex-type-grid" role="group" aria-label="Filtrar por tipos">
                        {TYPES.filter(type => type !== "stellar").map(type => <button
                            key={type}
                            type="button"
                            data-type={type}
                            aria-pressed={types.includes(type)}
                            onClick={() => onTypesChange(toggleValue(types, type).slice(-2))}
                        >{formatType(type)}</button>)}
                    </div>
                </section>

                <section className="dex-filter-section" aria-labelledby="dex-variants-title">
                    <div className="dex-filter-heading">
                        <strong id="dex-variants-title">Variantes</strong>
                        <small>Escolha como a lista mostra variantes que o MyOwnDex trata como Pokémon diferentes.</small>
                    </div>
                    <div className="dex-segmented" role="group" aria-label="Como mostrar variantes">
                        <button type="button" aria-pressed={variantMode === "grouped"} onClick={() => onVariantModeChange("grouped")}>Uma entrada</button>
                        <button type="button" aria-pressed={variantMode === "separate"} onClick={() => onVariantModeChange("separate")}>Separar variantes</button>
                    </div>
                    <p className="dex-filter-note">Uma entrada evita repetição na lista. Formas que o mesmo Pokémon pode trocar e mudanças só de aparência continuam sempre na mesma ficha.</p><div className="dex-region-grid" role="group" aria-label="Filtrar variantes regionais">
                        {DEX_REGIONS.map(region => <button
                            key={region.id}
                            type="button"
                            aria-pressed={regions.includes(region.id)}
                            onClick={() => toggleRegion(region.id)}
                        >{region.label}</button>)}
                    </div>
                </section>

                <fieldset className="dex-range-fields">
                    <legend>Número na Pokédex Nacional</legend>
                    <label><span>A partir de</span><input type="number" inputMode="numeric" min="1" max="1025" step="1" value={minNumber} onChange={event => onMinNumberChange(event.target.value)} /></label>
                    <label><span>Até</span><input type="number" inputMode="numeric" min="1" max="1025" step="1" value={maxNumber} onChange={event => onMaxNumberChange(event.target.value)} /></label>
                </fieldset>

                <button type="button" className="room-secondary-button dex-reset-filters" onClick={onReset} disabled={!activeCount}>Limpar filtros</button>
            </div>
        </details>
    </section>;
}
