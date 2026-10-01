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

    return (
        <article className={`record-move-card ${isOpen ? "is-open" : ""}`}>
            <button type="button" onClick={handleOpen} aria-expanded={isOpen} aria-controls={panelId} className="record-move-toggle">
                <div className="record-move-label">
                    <span className="record-move-method">{methodLabel(details)}</span>
                    <span className="record-move-name">{formatName(moveData.move.name)}</span>
                </div>
                <span aria-hidden="true" className="record-move-chevron">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
                <div id={panelId} className="record-move-panel">
                    {!data && !loadError ? <div className="h-10 skeleton rounded-lg" /> : loadError ? (
                        <p role="status">Não foi possível consultar este movimento.</p>
                    ) : (
                        <div className="move-description flex flex-col gap-3 animate-fade-in">
                            <div className="record-move-facts">
                                <span className="record-type-chip" style={{ backgroundColor: TYPE_COLORS[data.type?.name] || TYPE_COLORS.normal, color: TYPE_TEXT_COLORS[data.type?.name] || TYPE_TEXT_COLORS.normal }}>{formatType(data.type?.name)}</span>
                                <span className="move-fact-chip">{formatDamageClass(data.damage_class?.name)}</span>
                                <span className="move-fact-chip">Poder <strong>{data.power ? (isTTRPG ? convertToTTRPG(data.power) : data.power) : "—"}</strong></span>
                                <span className="move-fact-chip">Precisão <strong>{data.accuracy == null ? "—" : `${data.accuracy}%`}</strong></span>
                                <span className="move-fact-chip">PP <strong>{data.pp ?? "—"}</strong></span>
                            </div>
                            {explanation.catalog.text ? (
                                <p className="move-human-summary" lang={explanation.catalog.code}>{explanation.catalog.text}</p>
                            ) : <p>Descrição indisponível no catálogo.</p>}
                            {explanation.facts.length > 0 && (
                                <details className="catalog-description record-move-rules">
                                    <summary>Dados de batalha</summary>
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
