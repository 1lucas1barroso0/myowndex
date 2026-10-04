import React, { useEffect, useMemo, useState } from "react";
import { fetchCached, formatName } from "../../core/mechanics.js";
import AbilityCard from "../Pokedex/AbilityCard.jsx";
import ItemCard from "../Pokedex/ItemCard.jsx";
import {
    consumeHeldItem,
    getTraitStatus,
    recordTraitEvent,
    restoreHeldItem,
    setAbilitySuppressed,
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
                <small>Estado na batalha</small>
                <b>{stateLabel}</b>
            </header>
            <div className="trait-card-copy">
                {kind === "ability" ? <AbilityCard name={id} detail={detail} compact /> : <ItemCard name={id} detail={detail} compact />}
                <small>{profile.automation === "automatic" ? "Aplicação automática na batalha" : profile.automation === "contextual" ? "Requer escolha de alvo ou contexto" : "Ativação e uso podem ser registrados abaixo"}</small>
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
                <div className="trait-context" role="group" aria-label="Contexto que pode ativar efeitos">
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
            </div>
        </details>
    );
}
