import React, { useEffect, useId, useRef, useState } from 'react';
import { getCatalogText, loadCatalogText } from '../../core/catalogText.js';
import { describeTrait } from '../../core/descriptions.js';
import { extractId, fetchCached, formatName } from '../../core/mechanics.js';
import ReferenceText from '../Shared/ReferenceText.jsx';

export default function TraitReference({ kind, url, name, detail, isHidden, compact = false, versionGroup = 'champions' }) {
    const lookup = name || detail?.name || extractId(url);
    const detailUrl = url || (lookup && lookup !== '0' ? `https://pokeapi.co/api/v2/${kind}/${encodeURIComponent(lookup)}/` : null);
    const requestKey = `${kind}:${lookup}:${detailUrl || ''}:${versionGroup}`;
    const [detailResult, setDetailResult] = useState(null);
    const [catalogResult, setCatalogResult] = useState(null);
    const [retryRequest, setRetryRequest] = useState(null);
    const articleRef = useRef(null);
    const titleId = useId();
    const matchedDetail = detailResult?.key === requestKey ? detailResult : null;
    const data = detail || matchedDetail?.data || null;
    const detailReady = Boolean(detail) || !detailUrl || Boolean(matchedDetail);
    const ready = catalogResult?.key === requestKey;
    const reference = ready ? catalogResult.reference : null;
    const error = Boolean(matchedDetail?.error);

    useEffect(() => {
        let active = true;
        loadCatalogText(kind).then(() => {
            if (!active) return;
            setCatalogResult({ key: requestKey, reference: getCatalogText(kind, data?.name || lookup, data, { versionGroup }) });
        }).catch(() => { if (active) setCatalogResult({ key: requestKey, reference: null }); });
        return () => { active = false; };
    }, [kind, lookup, data, requestKey, versionGroup]);

    useEffect(() => {
        let active = true;
        if (detail || !detailUrl) return () => { active = false; };
        fetchCached(detailUrl, { forceRefresh: retryRequest?.key === requestKey }).then(value => {
            if (!active) return;
            setDetailResult({ key: requestKey, data: value || null, error: !value });
        }).catch(() => { if (active) setDetailResult({ key: requestKey, data: null, error: true }); });
        return () => { active = false; };
    }, [detail, detailUrl, requestKey, retryRequest]);

    const explanation = data || ready ? describeTrait(kind, data?.name || lookup, data, { versionGroup }) : null;
    const shownReference = reference?.original || reference?.portuguese ? reference : explanation?.catalog?.text ? {
        original: explanation.catalog.code === 'en' ? explanation.catalog.text : '',
        portuguese: explanation.catalog.code === 'pt-BR' ? explanation.catalog.text : '',
        originalLanguage: explanation.catalog.code,
    } : null;
    const title = data?.name || name || lookup;
    const portrait = kind === 'item' ? data?.sprites?.default : null;
    const pending = !ready || !detailReady;
    const retry = () => {
        articleRef.current?.focus({ preventScroll: true });
        setDetailResult(null);
        setRetryRequest(previous => ({ key: requestKey, attempt: (previous?.attempt || 0) + 1 }));
    };

    return (
        <article ref={articleRef} tabIndex={-1} aria-labelledby={titleId} aria-busy={!shownReference && pending} className={`record-trait-card record-${kind}-card${isHidden ? ' is-hidden' : ''}${compact ? ' is-compact' : ''}`}>
            <header className="record-trait-heading record-ability-heading">
                {portrait && <img className="record-item-sprite" src={portrait} width="48" height="48" alt="" loading="lazy" />}
                <div><small>{kind === 'ability' ? 'Habilidade' : 'Item segurado'}</small><h4 id={titleId}>{title && title !== '0' ? formatName(title) : kind === 'ability' ? 'Habilidade' : 'Item'}</h4></div>
                {isHidden && <span className="record-ability-badge">Oculta</span>}
            </header>
            {shownReference ? <ReferenceText {...shownReference} label="Como funciona" defaultLanguage="pt-BR" />
                : pending ? <p className="record-section-note" role="status">Consultando descrição…</p>
                    : <p className="record-section-note" role="status">{error
                        ? 'Não foi possível carregar esta descrição.'
                        : 'A fonte deste registro ainda não fornece uma descrição.'}</p>}
            {!shownReference && !pending && error && detailUrl && <div className="record-load-retry"><button type="button" onClick={retry}>Tentar novamente</button></div>}
        </article>
    );
}
