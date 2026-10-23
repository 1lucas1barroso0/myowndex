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
        <details className="friendship-help"><summary>Decisão do Narrador</summary><p>O vínculo muda pela história, nunca automaticamente. Ao terminar a sessão, o Narrador decide se a Amizade muda ou continua igual. Use +5 para um cuidado significativo, +10 para um marco, +20 para uma virada importante; +50 é excepcional. Cuidados rotineiros somam no máximo +10 por sessão. Repetir um botão não cria outro evento. Desmaiar ou falhar não reduz o vínculo automaticamente.</p><p>Nos jogos, a escala vai de 0 a 255. No RPG, divida por 10 e arredonde para baixo: o máximo é 25.</p></details>
    </div>;
}
