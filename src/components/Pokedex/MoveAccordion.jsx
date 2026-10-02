import React, { useId, useState } from "react";
import { describeMove } from "../../core/descriptions.js";
import { convertToTTRPG, fetchCached, formatDamageClass, formatName, formatType, TYPE_COLORS, TYPE_TEXT_COLORS } from "../../core/mechanics.js";

const methodLabel = detail => {
    const method = detail?.move_learn_method?.name;
    if (method === "level-up") return detail.level_learned_at ? `Nv. ${detail.level_learned_at}` : "Nível";
    if (method === "machine") return "Máquina";
    if (method === "tutor") return "Tutor";
    if (method === "egg") return "Ovo";
    return formatName(method || "Outro");
};

export default function MoveAccordion({ moveData, isTTRPG }) {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const panelId = useId();
    if (!moveData?.move) return null;

    const handleOpen = async () => {
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);
        if (!data && nextOpen && moveData.move.url) {
            setLoadError(false);
            const result = await fetchCached(moveData.move.url);
            if (result) setData(result);
            else setLoadError(true);
        }
    };

    const details = moveData.latest_detail || moveData.latest_details?.[0];
    const explanation = data ? describeMove(data, { isTTRPG }) : null;
    const moveColor = TYPE_COLORS[data?.type?.name] || 'var(--ui-blue)';

    return (
        <article className={`record-move-card ${isOpen ? "is-open" : ""}`} style={{ "--move-type": moveColor }}>
            <button type="button" onClick={handleOpen} aria-expanded={isOpen} aria-controls={panelId} className="record-move-toggle">
                <span className="record-move-method">{methodLabel(details)}</span>
                <span className="record-move-name">{formatName(moveData.move.name)}</span>
                <span aria-hidden="true" className="record-move-chevron">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
                <div id={panelId} className="record-move-panel">
                    {!data && !loadError ? <p role="status" className="record-section-note">Consultando movimento…</p> : loadError ? (
                        <p role="status">Não foi possível consultar este movimento.</p>
                    ) : (
                        <div className="move-description animate-fade-in">
                            <div className="record-move-classification">
                                <span className="record-type-chip" style={{ backgroundColor: TYPE_COLORS[data.type?.name] || TYPE_COLORS.normal, color: TYPE_TEXT_COLORS[data.type?.name] || TYPE_TEXT_COLORS.normal }}>{formatType(data.type?.name)}</span>
                                <span className="record-move-category">{formatDamageClass(data.damage_class?.name)}</span>
                            </div>
                            <dl className="record-move-facts" aria-label="Valores do movimento">
                                {data.damage_class?.name !== 'status' && <div><dt>Poder</dt><dd>{data.power ? (isTTRPG ? convertToTTRPG(data.power) : data.power) : "Variável"}</dd></div>}
                                <div><dt>Precisão</dt><dd>{data.accuracy == null || data.accuracy === true ? "Sem teste" : `${data.accuracy}%`}</dd></div>
                                <div><dt>PP</dt><dd>{data.pp ?? "—"}</dd></div>
                            </dl>
                            {explanation.catalog.text ? (
                                <div className="record-move-description">
                                    {explanation.catalog.code === 'en' && <span className="record-catalog-language">EN <span className="sr-only">Texto original em inglês</span></span>}
                                    <p className="move-human-summary" lang={explanation.catalog.code}>{explanation.catalog.text}</p>
                                </div>
                            ) : <p className="record-section-note">Descrição indisponível no catálogo.</p>}
                            {explanation.facts.length > 0 && (
                                <details className="catalog-description record-move-rules">
                                    <summary>Na batalha</summary>
                                    <ul className="move-human-facts" aria-label={`Dados de ${formatName(data.name)}`}>
                                        {explanation.facts.map((fact, index) => <li key={`${data.name}-fact-${index}`}>{fact}</li>)}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}
