import React, { useEffect, useMemo, useState } from "react";
import { describeTrait } from "../../core/descriptions.js";
import { fetchCached, formatName } from "../../core/mechanics.js";
import {
    consumeHeldItem,
    getTraitStatus,
    recordTraitEvent,
    restoreHeldItem,
    setAbilitySuppressed,
    TRAIT_AUTOMATION_LABELS,
} from "../../core/traitMechanics.js";

const useTraitDetail = (kind, id) => {
    const [detail, setDetail] = useState(null);
    useEffect(() => {
        let active = true;
        if (!id) {
            setDetail(null);
            return () => { active = false; };
        }
        fetchCached(`https://pokeapi.co/api/v2/${kind}/${encodeURIComponent(id)}`, { maxAgeMs: 24 * 60 * 60 * 1000 })
            .then(value => { if (active) setDetail(value || null); })
            .catch(() => { if (active) setDetail(null); });
        return () => { active = false; };
    }, [kind, id]);
    return detail;
};

const TraitCard = ({ kind, id, profile, active, consumed, suppressed, detail, canEdit, onActivate, onConsume, onRestore, onToggleSuppression }) => {
    const explanation = describeTrait(kind, id, detail);
    const stateLabel = consumed
        ? "Já foi usado"
        : suppressed
            ? "Sem efeito nesta cena"
            : active
                ? "Funcionando agora"
                : "Aguardando a condição";
    return (
        <article className={`trait-card is-${kind} ${active ? "is-active" : ""} ${consumed || suppressed ? "is-paused" : ""}`}>
            <header>
                <span>
                    <small>{kind === "ability" ? "Habilidade" : "Item segurado"}</small>
                    <strong>{formatName(id)}</strong>
                </span>
                <b>{stateLabel}</b>
            </header>
            <div className="trait-card-copy">
                <span>{TRAIT_AUTOMATION_LABELS[profile.automation]}</span>
                <strong>{profile.title}</strong>
                <p>{explanation.summary}</p>
                <small>{explanation.trigger}</small>
                <small>{explanation.handling}</small>
                {explanation.catalog.text ? (
                    <details><summary>{explanation.catalog.label}</summary><p lang={explanation.catalog.code}>{explanation.catalog.text}</p></details>
                ) : (
                    <p className="catalog-description-missing">O catálogo não trouxe outro texto. O gatilho e o modo de resolver continuam visíveis acima, sem completar a regra por suposição.</p>
                )}
            </div>
            {canEdit && (
                <div className="trait-card-actions">
                    <button type="button" onClick={onActivate}>Registrar ativação</button>
                    {kind === "item" && !consumed && <button type="button" className="is-warning" onClick={onConsume}>Consumir ou remover</button>}
                    {kind === "item" && consumed && <button type="button" className="is-restore" onClick={onRestore}>Restaurar item</button>}
                    {kind === "ability" && <button type="button" className={suppressed ? "is-restore" : "is-warning"} onClick={onToggleSuppression}>{suppressed ? "Reativar" : "Suprimir"}</button>}
                </div>
            )}
        </article>
    );
};

export default function TraitMechanicsPanel({ token, snapshot, role, onTokenChange, onNotice }) {
    const status = useMemo(() => getTraitStatus(token), [token]);
    const abilityId = status.state.ability.id;
    const itemId = token.item || status.state.item.originalId;
    const abilityDetail = useTraitDetail("ability", abilityId);
    const itemDetail = useTraitDetail("item", itemId);
    const canEdit = role === "narrator";
    if (!abilityId && !itemId) return null;

    const commit = (nextToken, message) => {
        onTokenChange(nextToken);
        if (message) onNotice?.(message);
    };

    const register = (kind, sourceId) => {
        const next = recordTraitEvent(token, {
            kind,
            sourceId,
            label: "Ativação registrada",
            detail: `O Narrador confirmou a condição na rodada ${snapshot.round}`,
            round: snapshot.round,
        });
        commit(next, `${formatName(sourceId)} entrou no histórico de ${token.name}.`);
    };

    const consume = () => {
        const result = consumeHeldItem(token, { reason: "Consumo ou remoção confirmada pelo Narrador", round: snapshot.round });
        if (result.applied) commit(result.token, `${formatName(result.itemId)} saiu de uso e permanece registrado para restauração.`);
    };

    const restore = () => {
        const result = restoreHeldItem(token, { round: snapshot.round });
        if (result.applied) commit(result.token, `${formatName(result.itemId)} foi restaurado.`);
    };

    const history = status.state.history.slice(-6).reverse();

    return (
        <details className="token-traits" open={Boolean(status.itemConsumed || status.state.ability.suppressed)}>
            <summary>
                <span>
                    <small>Condições, uso e efeitos</small>
                    <strong>Habilidade e item</strong>
                </span>
                <b>{[abilityId, itemId].filter(Boolean).length === 1 ? "1 presente" : `${[abilityId, itemId].filter(Boolean).length} presentes`}</b>
            </summary>
            <div className="token-traits-body">
                <div className="trait-context" aria-label="Contexto que pode ativar efeitos">
                    <span>Rodada {snapshot.round}</span>
                    <span>Clima: {formatName(snapshot.weather)}</span>
                    <span>Terreno: {formatName(snapshot.terrain)}</span>
                </div>
                <div className="trait-card-grid">
                    {abilityId && (
                        <TraitCard
                            kind="ability"
                            id={abilityId}
                            profile={status.ability}
                            active={status.abilityActive}
                            suppressed={status.state.ability.suppressed}
                            detail={abilityDetail}
                            canEdit={canEdit}
                            onActivate={() => register("ability", abilityId)}
                            onToggleSuppression={() => {
                                const suppressed = !status.state.ability.suppressed;
                                const changed = recordTraitEvent(
                                    setAbilitySuppressed(token, suppressed, "Alteração confirmada pelo Narrador"),
                                    {
                                        kind: "ability",
                                        sourceId: abilityId,
                                        label: suppressed ? "Habilidade suprimida" : "Habilidade reativada",
                                        detail: "Alteração confirmada pelo Narrador",
                                        round: snapshot.round,
                                    },
                                );
                                commit(
                                    changed,
                                    `${formatName(abilityId)} ${suppressed ? "foi suprimida" : "voltou a funcionar"}.`,
                                );
                            }}
                        />
                    )}
                    {itemId && (
                        <TraitCard
                            kind="item"
                            id={itemId}
                            profile={status.item}
                            active={status.itemActive}
                            consumed={status.itemConsumed}
                            detail={itemDetail}
                            canEdit={canEdit}
                            onActivate={() => register("item", itemId)}
                            onConsume={consume}
                            onRestore={restore}
                        />
                    )}
                </div>
                {history.length > 0 && (
                    <div className="trait-history">
                        <strong>Últimos acontecimentos</strong>
                        <ol>
                            {history.map((entry, index) => (
                                <li key={`${entry.round}-${entry.sourceId}-${index}`}>
                                    <span>R{entry.round || "—"}</span>
                                    <p><strong>{formatName(entry.sourceId)}</strong>{entry.label ? ` — ${entry.label}` : ""}<small>{entry.detail}</small></p>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
                <p className="trait-integrity-note">O MyOwnDex só aplica sozinho o que a cena comprova. Sempre que faltar alvo, escolha ou interpretação, a regra permanece à vista para o Narrador decidir com o grupo.</p>
            </div>
        </details>
    );
}
