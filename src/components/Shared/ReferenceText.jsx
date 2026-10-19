import React, { useId, useState } from 'react';
import './ReferenceText.css';
import { formatReferenceText } from '../../core/pokedexRecord.js';

/** Original and local Portuguese prose share one place; names stay in English. */
export default function ReferenceText({ original, portuguese, originalLanguage = 'en', source, defaultLanguage = 'pt-BR', label = 'Descrição', className = '' }) {
    const [language, setLanguage] = useState(defaultLanguage);
    const textId = useId();
    const translated = Boolean(portuguese) && (language === 'pt-BR' || !original);
    const textLanguage = translated ? 'pt-BR' : originalLanguage;
    const text = formatReferenceText(translated ? portuguese : original, textLanguage);
    const toggleLabel = translated ? 'Ver texto original em inglês' : 'Ver tradução em português';
    const sourceLabel = source === 'pokeapi' ? 'PokéAPI'
        : source === 'pokemon-go' ? 'Pokémon GO'
            : source === 'pokemon-showdown' ? 'Pokémon Showdown' : null;
    if (!text) return null;

    return (
        <div className={`reference-text ${className}`}>
            <div className="reference-text-toolbar">
                <small title={sourceLabel ? `Referência: ${sourceLabel}` : undefined}>{label}</small>
                {original && portuguese && <button type="button" className="reference-language-toggle" aria-label={toggleLabel} title={toggleLabel} aria-pressed={translated} aria-controls={textId} onClick={() => setLanguage(value => value === 'pt-BR' ? 'en' : 'pt-BR')}>
                    {translated ? 'Ver original' : 'Ver português'}
                </button>}
            </div>
            <p id={textId} lang={textLanguage} aria-live="polite" aria-atomic="true">{text}</p>
        </div>
    );
}
