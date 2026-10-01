import React, { useEffect, useState } from "react";
import { describeTrait } from "../../core/descriptions.js";
import { fetchCached, formatName } from "../../core/mechanics.js";

export default function AbilityCard({ url, isHidden }) {
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let mounted = true;
        setData(null);
        setLoadError(false);
        if (!url) {
            setLoadError(true);
            return () => { mounted = false; };
        }
        fetchCached(url).then(result => {
            if (!mounted) return;
            if (result) setData(result);
            else setLoadError(true);
        });
        return () => { mounted = false; };
    }, [url]);

    if (loadError) return (
        <div className="record-ability-card is-unavailable" role="status">
            Não foi possível consultar esta habilidade.
        </div>
    );
    if (!data) return <div className="record-ability-card skeleton" aria-label="Consultando habilidade" role="status" />;

    const explanation = describeTrait("ability", data.name, data);

    return (
        <article className={`record-ability-card ${isHidden ? "is-hidden" : ""}`}>
            <header className="record-ability-heading">
                <h4>{formatName(data.name)}</h4>
                {isHidden && <span className="record-ability-badge">Oculta</span>}
            </header>
            <div className="ability-description">
                <p lang={explanation.catalog.text ? explanation.catalog.code : "pt-BR"}>
                    {explanation.catalog.text || "Descrição indisponível no catálogo."}
                </p>
                <details className="catalog-description record-ability-rules">
                    <summary>Na aventura</summary>
                    <p>{explanation.summary}</p>
                    <p><strong>Gatilho:</strong> {explanation.profile.trigger}.</p>
                    <p>{explanation.handling}</p>
                </details>
            </div>
        </article>
    );
}
