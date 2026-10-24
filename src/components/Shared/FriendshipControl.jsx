import React, { useEffect, useId, useRef, useState } from "react";
import { adjustPokemonFriendship } from "../../core/experience.js";
import { integerInRange } from "../../core/math.js";

export default function FriendshipControl({ pokemon, onChange, disabled = false }) {
    const fieldId = useId();
    const currentRef = useRef(pokemon);
    useEffect(() => { currentRef.current = pokemon; }, [pokemon]);
    const friendship = integerInRange(pokemon.friendship, 0, 255, 70);
    const [draft, setDraft] = useState(friendship);
    useEffect(() => setDraft(friendship), [friendship]);
    const adjust = delta => {
        if (disabled) return;
        const next = adjustPokemonFriendship(currentRef.current, delta);
        currentRef.current = next;
        setDraft(next.friendship);
        onChange(next);
    };

    return <div className="friendship-control editor-wide-field">
        <div className="friendship-control-heading"><div><label htmlFor={`${fieldId}-friendship`} className="editor-label">Amizade</label><small id={`${fieldId}-friendship-scale`} className="friendship-input-scale">De 0 a 255</small></div></div>
        <div className="friendship-controls"><input id={`${fieldId}-friendship`} aria-describedby={`${fieldId}-friendship-scale`} type="number" inputMode="numeric" min="0" max="255" step="1" disabled={disabled} value={draft} onBlur={() => setDraft(friendship)} onChange={event => { const value = event.target.value; setDraft(value); if (value !== "") { const next = { ...currentRef.current, friendship: integerInRange(value, 0, 255, friendship) }; currentRef.current = next; onChange(next); } }} className="editor-input" /><div role="group" aria-label="Ajustar Amizade por decisão do Narrador">{[-5, 5, 10, 20].map(delta => <button key={delta} type="button" disabled={disabled || (delta < 0 ? friendship === 0 : friendship === 255)} onClick={() => adjust(delta)} aria-label={`${delta > 0 ? "Aumentar" : "Diminuir"} Amizade em ${Math.abs(delta)}`}>{delta > 0 ? "+" : "−"}{Math.abs(delta)}</button>)}</div></div>
        <details className="friendship-help"><summary>Decisão do Narrador</summary><p>O vínculo cresce com a história que vocês vivem! O Narrador pode dar +5 por um cuidado significativo, +10 por um marco e +20 por uma grande virada. +50 fica para um acontecimento excepcional.</p><p>Cuidados do dia a dia somam no máximo +10 por sessão; grandes marcos diferentes ficam fora desse limite. Conte cada acontecimento uma vez. Desmaiar, perder ou falhar não reduz a Amizade automaticamente. Uma perda de confiança precisa fazer sentido na história e ser conversada.</p><p>A Amizade não aumenta sozinha ao ganhar XP, subir de nível ou terminar a sessão. Nos jogos, ela vai de 0 a 255. No RPG, divida por 10 e arredonde para baixo: o máximo é 25.</p></details>
    </div>;
}
