import React, { useId, useRef, useState } from "react";
import { createExperienceAwardId, getChallengeReward } from "../../core/experience.js";
import { integerInRange } from "../../core/math.js";

/** One challenge, one receipt. The same receipt is reused if saving fails. */
export default function ExperienceAward({ onAward, disabled = false, winnerLevel = 1, battleContext = null }) {
    const fieldId = useId();
    const [baseXp, setBaseXp] = useState(1);
    const [battle, setBattle] = useState(Boolean(battleContext));
    const [context, setContext] = useState(() => ({
        winnerMaxLevel: battleContext?.winnerMaxLevel ?? winnerLevel,
        opponentMaxLevel: battleContext?.opponentMaxLevel ?? winnerLevel,
        winnerCount: battleContext?.winnerCount ?? 1,
        opponentCount: battleContext?.opponentCount ?? 1,
    }));
    const [busy, setBusy] = useState(false);
    const [received, setReceived] = useState(null);
    const [error, setError] = useState("");
    const receiptRef = useRef(null);
    const savingRef = useRef(false);
    const reward = getChallengeReward({ baseXp, battle, ...context });
    const locked = disabled || busy || Boolean(received);
    const complete = !battle || Object.values(context).every(value => Number.isInteger(Number(value)) && Number(value) > 0);

    const award = async () => {
        if (locked || !complete || savingRef.current) return;
        savingRef.current = true;
        setBusy(true);
        setError("");
        try {
            receiptRef.current ||= createExperienceAwardId();
            const saved = await onAward({ ...reward, awardId: receiptRef.current });
            if (saved === false) throw new Error("Não foi possível registrar. Tente novamente.");
            setReceived(reward);
        } catch (failure) {
            setError(failure?.message || "Não foi possível registrar. Tente novamente.");
        } finally {
            savingRef.current = false;
            setBusy(false);
        }
    };

    const newChallenge = () => {
        receiptRef.current = null;
        setBaseXp(1);
        setBattle(Boolean(battleContext));
        setContext({
            winnerMaxLevel: battleContext?.winnerMaxLevel ?? winnerLevel,
            opponentMaxLevel: battleContext?.opponentMaxLevel ?? winnerLevel,
            winnerCount: battleContext?.winnerCount ?? 1,
            opponentCount: battleContext?.opponentCount ?? 1,
        });
        setReceived(null);
        setError("");
    };

    const changeContext = (key, value, maximum) => {
        setError("");
        setContext(current => ({ ...current, [key]: value === "" ? "" : integerInRange(value, 1, maximum, 1) }));
    };

    return <details className="experience-award">
        <summary>Receber XP</summary>
        <div className="experience-award-body">
            <fieldset disabled={locked} className="experience-base-choice">
                <legend>Recompensa do desafio</legend>
                <div role="group" aria-label="XP do desafio">
                    {[1, 2, 3].map(value => <button key={value} type="button" aria-pressed={baseXp === value} onClick={() => setBaseXp(value)}>{value} XP</button>)}
                </div>
            </fieldset>
            <details className="experience-battle-context">
                <summary>Ajustar pela batalha</summary>
                <label className="experience-battle-toggle"><input type="checkbox" checked={battle} disabled={locked} onChange={event => { setBattle(event.target.checked); if (event.target.checked && !battleContext) setContext(current => ({ ...current, winnerMaxLevel: winnerLevel })); }} />Usar os dois lados da batalha</label>
                {battle && <div className="experience-sides">
                    {[
                        { title: "Vencedor", prefix: "winner" },
                        { title: "Adversário", prefix: "opponent" },
                    ].map(side => <fieldset key={side.prefix} disabled={locked}>
                        <legend>{side.title}</legend>
                        <label htmlFor={`${fieldId}-${side.prefix}-level`}>Maior nível<input id={`${fieldId}-${side.prefix}-level`} type="number" inputMode="numeric" min="1" max="200" step="1" value={context[`${side.prefix}MaxLevel`]} onChange={event => changeContext(`${side.prefix}MaxLevel`, event.target.value, 200)} /></label>
                        <label htmlFor={`${fieldId}-${side.prefix}-count`}>Pokémon que lutaram<input id={`${fieldId}-${side.prefix}-count`} type="number" inputMode="numeric" min="1" max="40" step="1" value={context[`${side.prefix}Count`]} onChange={event => changeContext(`${side.prefix}Count`, event.target.value, 40)} /></label>
                    </fieldset>)}
                </div>}
            </details>
            <dl className="experience-reward-preview" aria-live="polite">
                <div><dt>XP</dt><dd>{complete ? reward.xp : "—"}</dd></div>
                <div><dt>EVs para treinar</dt><dd>{complete ? reward.evs : "—"}</dd></div>
            </dl>
            {complete && reward.reasons.length > 0 && <ul className="experience-reasons">{reward.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
            {received ? <div className="experience-received"><p role="status">{received.xp} XP e {received.evs} EVs registrados.</p><button type="button" onClick={newChallenge}>Novo desafio</button></div> : <button type="button" className="room-primary-button experience-confirm" disabled={locked || !complete} onClick={() => void award()}>{busy ? "Registrando…" : complete ? `Receber ${reward.xp} XP` : "Complete a batalha"}</button>}
            {error && <p role="alert" className="experience-error">{error}</p>}
        </div>
    </details>;
}
