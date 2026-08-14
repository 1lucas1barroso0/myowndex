import React, { useEffect, useMemo, useState } from "react";
import { formatName } from "../../core/mechanics.js";
import {
    applyBattleIllusion,
    getPokemonSpecialMechanics,
    normalizeSpecialState,
    revertBattleTransform,
    revertTemporaryMoveCopies,
    revealBattleIllusion,
    SPECIAL_AUTOMATION_LABELS,
    transformBattleToken,
} from "../../core/specialMechanics.js";

export default function SpecialMechanicsPanel({
    token,
    snapshot,
    role,
    onTokenChange,
    onNotice,
}) {
    const mechanics = useMemo(() => getPokemonSpecialMechanics(token), [token]);
    const state = normalizeSpecialState(token?.specialState);
    const opponents = useMemo(
        () => snapshot.tokens.filter(candidate => candidate.id !== token.id && candidate.currentHp > 0 && candidate.side !== token.side),
        [snapshot.tokens, token.id, token.side],
    );
    const allies = useMemo(
        () => snapshot.tokens.filter(candidate => candidate.id !== token.id && candidate.currentHp > 0 && candidate.side === token.side),
        [snapshot.tokens, token.id, token.side],
    );
    const [transformTargetId, setTransformTargetId] = useState("");
    const [illusionTargetId, setIllusionTargetId] = useState("");

    useEffect(() => {
        setTransformTargetId(current => opponents.some(candidate => candidate.id === current) ? current : opponents[0]?.id || "");
    }, [opponents]);

    useEffect(() => {
        setIllusionTargetId(current => allies.some(candidate => candidate.id === current) ? current : allies[allies.length - 1]?.id || "");
    }, [allies]);

    if (state.illusion && role !== "narrator") return null;
    if (!mechanics.length && !state.transform && !state.illusion && !state.moveOverrides.length && !state.markers.length) return null;

    const canEdit = role === "narrator";
    const hasIllusionMechanic = mechanics.some(mechanic => mechanic.id === "illusion");
    const hasImposterMechanic = token.ability === "imposter" || state.transform?.via === "imposter";
    const temporaryCopies = state.moveOverrides.filter(override => !override.permanent);
    const permanentCopies = state.moveOverrides.filter(override => override.permanent);

    const commit = (result, message) => {
        if (!result?.applied) return;
        onTokenChange(result.token);
        if (message) onNotice?.(message);
    };

    const applyImposter = () => {
        const target = opponents.find(candidate => candidate.id === transformTargetId);
        const result = transformBattleToken(token, target, { via: "imposter", round: snapshot.round });
        if (result.applied) commit(result, result.narrative);
        else onNotice?.(`Imposter não foi aplicado: ${result.reason}.`);
    };

    const applyIllusion = () => {
        const target = allies.find(candidate => candidate.id === illusionTargetId);
        const result = applyBattleIllusion(token, target);
        commit(result, `${token.name} agora aparece em campo como ${target?.name || "um aliado"}.`);
    };

    return (
        <details className="token-special-mechanics" open={Boolean(state.transform || state.illusion || state.moveOverrides.length)}>
            <summary>
                <span>
                    <small>Identidade e exceções</small>
                    <strong>Mecânicas únicas</strong>
                </span>
                <b>{mechanics.length || 1} perfil(is)</b>
            </summary>
            <div className="token-special-body">
                {mechanics.map(mechanic => (
                    <article key={mechanic.id}>
                        <header>
                            <strong>{mechanic.title}</strong>
                            <span>{SPECIAL_AUTOMATION_LABELS[mechanic.automation]}</span>
                        </header>
                        <p>{mechanic.summary}</p>
                        <small>Gatilho: {mechanic.trigger}.</small>
                    </article>
                ))}

                {state.transform ? (
                    <div className="token-special-state is-transform">
                        <span>
                            <small>{state.transform.via === "imposter" ? "Imposter ativo" : "Transform ativo"}</small>
                            <strong>Forma de {state.transform.sourceName || "outro Pokémon"}</strong>
                            <em>HP, nível, item e progresso continuam sendo de {token.name}.</em>
                        </span>
                        {canEdit && (
                            <button type="button" onClick={() => commit(revertBattleTransform(token), `${token.name} voltou à identidade original.`)}>
                                Voltar à forma original
                            </button>
                        )}
                    </div>
                ) : hasImposterMechanic && canEdit ? (
                    <div className="token-special-action">
                        <label>
                            <span>Alvo de Imposter</span>
                            <select value={transformTargetId} onChange={event => setTransformTargetId(event.target.value)}>
                                {!opponents.length && <option value="">Nenhum oponente disponível</option>}
                                {opponents.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                            </select>
                        </label>
                        <button type="button" disabled={!transformTargetId} onClick={applyImposter}>Ativar Imposter</button>
                    </div>
                ) : mechanics.some(mechanic => mechanic.id === "ditto") ? (
                    <p className="token-special-hint">Escolha Transform no Assistente Rotom: ele consumirá PP, validará o alvo e copiará a identidade de batalha.</p>
                ) : null}

                {hasIllusionMechanic && (
                    state.illusion ? (
                        <div className="token-special-state is-illusion">
                            <span>
                                <small>Ilusão ativa</small>
                                <strong>Aparecendo como {state.illusion.sourceName}</strong>
                                <em>A identidade real permanece preservada na ficha.</em>
                            </span>
                            {canEdit && <button type="button" onClick={() => commit(revealBattleIllusion(token), `A Ilusão de ${token.name} foi revelada.`)}>Revelar</button>}
                        </div>
                    ) : canEdit ? (
                        <div className="token-special-action">
                            <label>
                                <span>Aparência da Ilusão</span>
                                <select value={illusionTargetId} onChange={event => setIllusionTargetId(event.target.value)}>
                                    {!allies.length && <option value="">Nenhum aliado disponível</option>}
                                    {allies.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                                </select>
                            </label>
                            <button type="button" disabled={!illusionTargetId} onClick={applyIllusion}>Criar Ilusão</button>
                        </div>
                    ) : null
                )}

                {permanentCopies.map(override => (
                    <div className="token-special-state is-permanent" key={`permanent-${override.slot}`}>
                        <span>
                            <small>Sketch gravado</small>
                            <strong>{formatName(override.copiedMove)}</strong>
                            <em>Substituiu Sketch e será sincronizado com a ficha vinculada.</em>
                        </span>
                    </div>
                ))}

                {temporaryCopies.length > 0 && (
                    <div className="token-special-state is-temporary">
                        <span>
                            <small>Cópia temporária</small>
                            <strong>{temporaryCopies.map(override => formatName(override.copiedMove)).join(", ")}</strong>
                            <em>Vale apenas nesta cena.</em>
                        </span>
                        {canEdit && <button type="button" onClick={() => commit(revertTemporaryMoveCopies(token), "As cópias temporárias foram desfeitas.")}>Desfazer cópia</button>}
                    </div>
                )}

                {state.markers.length > 0 && (
                    <div className="token-special-markers" aria-label="Marcadores de mecânicas únicas">
                        {state.markers.map(marker => <span key={marker}>{formatName(marker)}</span>)}
                    </div>
                )}
            </div>
        </details>
    );
}
