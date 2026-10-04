import React, { useEffect, useId, useRef, useState } from "react";
import { getCatalogText, loadCatalogText } from "../../core/catalogText.js";
import { describeMove } from "../../core/descriptions.js";
import { convertToTTRPG, fetchCached, formatDamageClass, formatName, formatType, TYPE_COLORS, TYPE_TEXT_COLORS } from "../../core/mechanics.js";
import { getMoveReferenceForMode } from "../../core/referenceGames.js";
import ReferenceText from "../Shared/ReferenceText.jsx";

const methodLabel = detail => {
    const method = detail?.move_learn_method?.name;
    if (method === "level-up") return detail.level_learned_at ? `Nv. ${detail.level_learned_at}` : "Nível";
    if (method === "machine") return "Máquina";
    if (method === "tutor") return "Tutor";
    if (method === "egg") return "Ovo";
    return formatName(method || "Outro");
};

export default function MoveAccordion({ moveData, isTTRPG, versionGroup }) {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [retryAttempt, setRetryAttempt] = useState(0);
    const [catalogReady, setCatalogReady] = useState(false);
    const [reference, setReference] = useState(null);
    const panelId = useId();
    const panelRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        loadCatalogText('move').then(() => {
            if (!active) return;
            const referenceVersion = isTTRPG ? 'champions' : versionGroup?.value;
            const versionData = getMoveReferenceForMode(data, { id: versionGroup?.id, value: versionGroup?.value }, isTTRPG ? 'rpg' : 'game');
            setReference({ ...getCatalogText('move', data?.name || moveData?.move?.name,
                versionData, { versionGroup: referenceVersion }), versionData });
            setCatalogReady(true);
        }).catch(() => { if (active) setCatalogReady(true); });
        return () => { active = false; };
    }, [isOpen, data, isTTRPG, moveData?.move?.name, versionGroup?.id, versionGroup?.value]);

    useEffect(() => {
        if (!isOpen || data || !moveData?.move?.url) return;
        let active = true;
        setLoadError(false);
        fetchCached(moveData.move.url, { forceRefresh: retryAttempt > 0 }).then(result => {
            if (!active) return;
            if (result) setData(result);
            else setLoadError(true);
        }).catch(() => { if (active) setLoadError(true); });
        return () => { active = false; };
    }, [data, isOpen, moveData?.move?.url, retryAttempt]);

    if (!moveData?.move) return null;

    const handleOpen = () => setIsOpen(value => !value);
    const retry = () => {
        panelRef.current?.focus({ preventScroll: true });
        setLoadError(false);
        setRetryAttempt(attempt => attempt + 1);
    };

    const details = moveData.latest_detail || moveData.latest_details?.[0];
    // Retain the verified snapshot with the visible description. Public cache
    // eviction must never turn an already-open old-game move into modern data.
    const versionData = reference?.versionData || (data ? getMoveReferenceForMode(data, versionGroup, isTTRPG ? 'rpg' : 'game') : null);
    const historical = versionData?.reference_generation < 9 || versionData?.reference_metadata_verified === false;
    const explanation = versionData ? describeMove(versionData, { isTTRPG, historical }) : null;
    const shownReference = reference?.original || reference?.portuguese ? reference : catalogReady && explanation?.catalog.text ? {
        original: explanation.catalog.code === 'en' ? explanation.catalog.text : '',
        portuguese: explanation.catalog.code === 'pt-BR' ? explanation.catalog.text : '',
        originalLanguage: explanation.catalog.code,
    } : null;
    const moveColor = TYPE_COLORS[versionData?.type?.name] || 'var(--ui-blue)';

    return (
        <article className={`record-move-card ${isOpen ? "is-open" : ""}`} style={{ "--move-type": moveColor }}>
            <button id={`${panelId}-toggle`} type="button" onClick={handleOpen} aria-expanded={isOpen} aria-controls={panelId} className="record-move-toggle">
                <span className="record-move-name">{formatName(moveData.move.name)}</span>
                <span className="record-move-method">{methodLabel(details)}</span>
                <span aria-hidden="true" className="record-move-chevron">{isOpen ? "−" : "+"}</span>
            </button>

            <div ref={panelRef} id={panelId} hidden={!isOpen} role="region" tabIndex={-1} aria-labelledby={`${panelId}-toggle`} aria-busy={isOpen && !data && !loadError} className="record-move-panel">
                {isOpen && (<>
                    {!data && !loadError ? <p role="status" className="record-section-note">Consultando movimento…</p> : loadError ? (
                        <div className="record-load-retry">
                            <p role="alert">Não foi possível abrir este movimento.</p>
                            <button type="button" onClick={retry}>Tentar novamente</button>
                        </div>
                    ) : (
                        <div className="move-description animate-fade-in">
                            <div className="record-move-classification">
                                <span className="record-type-chip" style={{ backgroundColor: TYPE_COLORS[versionData.type?.name] || TYPE_COLORS.normal, color: TYPE_TEXT_COLORS[versionData.type?.name] || TYPE_TEXT_COLORS.normal }}>{formatType(versionData.type?.name)}</span>
                                <span className="record-move-category">{formatDamageClass(versionData.damage_class?.name)}</span>
                            </div>
                            <dl className="record-move-facts" aria-label="Valores do movimento">
                                {versionData.damage_class?.name !== 'status' && <div><dt>Poder</dt><dd>{versionData.power ? (isTTRPG ? convertToTTRPG(versionData.power) : versionData.power) : "Variável"}</dd></div>}
                                <div><dt>Precisão</dt><dd>{versionData.accuracy == null || versionData.accuracy === true ? "Sem teste" : `${versionData.accuracy}%`}</dd></div>
                                <div><dt><abbr title="Usos disponíveis do movimento">PP</abbr></dt><dd>{versionData.pp ?? "—"}</dd></div>
                            </dl>
                            {shownReference ? <ReferenceText {...shownReference} label="Efeito do movimento" defaultLanguage="pt-BR" className="record-move-description" /> : <p className="record-section-note" role="status">{catalogReady ? 'Este registro não trouxe uma descrição.' : 'Consultando descrição…'}</p>}
                            {moveData.latest_details?.length > 1 && <div className="record-move-methods" role="group" aria-label="Formas de aprender este movimento">
                                {[...new Set(moveData.latest_details.map(methodLabel))].map(method => <span key={method}>{method}</span>)}
                            </div>}
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
                </>)}
            </div>
        </article>
    );
}
