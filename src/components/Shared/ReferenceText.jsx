import React, { useId, useState } from 'react';

/** Original and local Portuguese prose share one place; names stay in English. */
export default function ReferenceText({ original, portuguese, originalLanguage = 'en', source, sourceKind, defaultLanguage = 'pt-BR', label = 'Descrição', className = '' }) {
    const [language, setLanguage] = useState(defaultLanguage);
    const textId = useId();
    const translated = language === 'pt-BR' && Boolean(portuguese);
    const text = translated ? portuguese : original;
    if (!text) return null;

    return (
        <div className={`reference-text ${className}`}>
            <div className="reference-text-toolbar">
                <small>{label}</small>
                {original && portuguese && <button type="button" className="reference-language-toggle" aria-label={translated ? 'Ver texto original em inglês' : 'Ver tradução em português'} aria-pressed={translated} aria-controls={textId} onClick={() => setLanguage(value => value === 'pt-BR' ? 'en' : 'pt-BR')}>
                    {translated ? 'PT' : 'EN'}
                </button>}
            </div>
            <p id={textId} lang={translated ? 'pt-BR' : originalLanguage} aria-live="polite" aria-atomic="true">{text}</p>
            {source && <small className="reference-text-source">{source === 'pokeapi' ? 'PokéAPI' : source === 'pokemon-go' ? 'Pokémon GO' : source === 'pokemon-showdown' ? 'Pokémon Showdown' : source}{translated && sourceKind === 'editorial' ? ' · Tradução MyOwnDex' : ''}</small>}
        </div>
    );
}
