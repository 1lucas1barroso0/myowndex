import React, { useId, useRef, useState } from "react";
import { createExperienceAwardId, getChallengeReward, resolveChallengeAward } from "../../core/experience.js";
import { integerInRange } from "../../core/math.js";

/** One challenge, one receipt. The same receipt is reused if saving fails. */
export default function ExperienceAward({ onAward, disabled = false, winnerLevel = 1, battleContext = null }) {
    const fieldId = useId();
    const [baseXp, setBaseXp] = useState(1);
    const [manualXp, setManualXp] = useState(null);
    const [manualBattle, setManualBattle] = useState(false);
    const [attempt, setAttempt] = useState(null);
    const hasBattleContext = attempt?.recognized ?? Boolean(battleContext);
    const battle = attempt?.battle ?? (hasBattleContext || manualBattle);
    // Without an explicit override, battle data always tracks the active scene.
    const [contextOverride, setContextOverride] = useState(null);
    const context = attempt?.context || contextOverride || {
        winnerMaxLevel: battleContext?.winnerMaxLevel ?? winnerLevel,
        opponentMaxLevel: battleContext?.opponentMaxLevel ?? winnerLevel,
        winnerCount: battleContext?.winnerCount ?? 1,
        opponentCount: battleContext?.opponentCount ?? 1,
    };
    const [busy, setBusy] = useState(false);
    const [received, setReceived] = useState(null);
    const [error, setError] = useState("");
    const receiptRef = useRef(null);
    const savingRef = useRef(false);
    const automatic = attempt?.automatic || getChallengeReward({ baseXp, battle, ...context });
    const reward = attempt?.reward || resolveChallengeAward(automatic, manualXp);
    const locked = disabled || busy || Boolean(received);
    const fieldsLocked = locked || Boolean(attempt);
    const complete = Boolean(attempt) || Boolean(reward) && (!battle || Object.values(context).every(value => Number.isInteger(Number(value)) && Number(value) > 0));

    const award = async () => {
        if (locked || !complete || savingRef.current) return;
        savingRef.current = true;
        setBusy(true);
        setError("");
        try {
            // A retry must repeat both the receipt and its exact reward, even
            // if another scene update arrives after a failed acknowledgement.
            receiptRef.current ||= { automatic, context: { ...context }, battle, recognized: hasBattleContext,
                reward: { ...reward, awardId: createExperienceAwardId() } };
            const pending = receiptRef.current;
            setAttempt(pending);
            const saved = await onAward({ ...pending.reward });
            if (saved === false) throw new Error("Não foi possível registrar. Tente novamente.");
            setReceived(pending.reward);
        } catch (failure) {
            setError(failure?.message || "Não foi possível registrar. Tente novamente.");
        } finally {
            savingRef.current = false;
            setBusy(false);
        }
    };

    const newChallenge = () => {
        receiptRef.current = null;
        setAttempt(null);
        setBaseXp(1);
        setManualXp(null);
        setManualBattle(false);
        setContextOverride(null);
        setReceived(null);
        setError("");
    };

    const changeContext = (key, value, maximum) => {
        setError("");
        setContextOverride(current => ({ ...(current || context), [key]: value === "" ? "" : integerInRange(value, 1, maximum, 1) }));
    };

    return <details className="experience-award">
        <summary>Ganhar XP</summary>
        <div className="experience-award-body">
            <fieldset disabled={fieldsLocked} className="experience-base-choice">
                <legend>Recompensas pelo desafio</legend>
                <div role="group" aria-label="XP do desafio">
                    {["Comum", "Importante", "Conquista"].map((label, index) => <button key={label} type="button" aria-pressed={baseXp === index + 1} onClick={() => setBaseXp(index + 1)}><span>{index + 1} XP</span><small>{label}</small></button>)}
                </div>
            </fieldset>
            <div className="experience-battle-context">
                {hasBattleContext ? <div className="experience-context-auto"><strong>Batalha reconhecida</strong><span>O MyOwnDex já conhece os níveis e os Pokémon envolvidos.</span></div>
                : <label className="experience-battle-toggle"><input type="checkbox" checked={battle} disabled={fieldsLocked} onChange={event => setManualBattle(event.target.checked)} />Considerar os dois lados da batalha</label>}
                {battle && <details className="experience-context-editor">
                    <summary>{hasBattleContext?"Conferir dados da batalha":"Informar participantes e níveis"}</summary>
                    <div className="experience-sides">
                    {[
                        { title: "Vencedor", prefix: "winner" },
                        { title: "Adversário", prefix: "opponent" },
                    ].map(side => <fieldset key={side.prefix} disabled={fieldsLocked}>
                        <legend>{side.title}</legend>
                        <label htmlFor={`${fieldId}-${side.prefix}-level`}>Maior nível<input id={`${fieldId}-${side.prefix}-level`} type="number" inputMode="numeric" min="1" max="200" step="1" value={context[`${side.prefix}MaxLevel`]} onChange={event => changeContext(`${side.prefix}MaxLevel`, event.target.value, 200)} /></label>
                        <label htmlFor={`${fieldId}-${side.prefix}-count`}>Pokémon que lutaram<input id={`${fieldId}-${side.prefix}-count`} type="number" inputMode="numeric" min="1" max="40" step="1" value={context[`${side.prefix}Count`]} onChange={event => changeContext(`${side.prefix}Count`, event.target.value, 40)} /></label>
                    </fieldset>)}
                    </div>
                </details>}
            </div>
            <details className="experience-calculation">
            <summary>Entender a recompensa</summary>
            <dl className="experience-breakdown" aria-label="Cálculo automático de XP">
                <div><dt>XP-base</dt><dd>{automatic.baseXp}</dd></div>
                <div><dt>Multiplicador</dt><dd>×{automatic.multiplier}</dd></div>
                <div><dt>XP multiplicada</dt><dd>{automatic.multipliedXp}</dd></div>
                <div><dt>Reduções</dt><dd>{automatic.penalties ? `−${automatic.penalties}` : "0"}</dd></div>
                <div><dt>Resultado automático</dt><dd>{automatic.xp} XP</dd></div>
            </dl>
            <p className="experience-formula-note">Multiplique a XP-base e depois subtraia as reduções. A recompensa mínima é 1 XP. Cada XP recebido concede 2 EVs.</p>
            {automatic.reasons.length > 0 && <ul className="experience-reasons">{automatic.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
            </details>
            <details className="experience-manual-choice">
                <summary>Ajuste manual do Narrador</summary>
                <label className="experience-manual-toggle">
                    <input type="checkbox" checked={manualXp !== null} disabled={fieldsLocked}
                      onChange={event => { setError(""); setManualXp(event.target.checked ? String(automatic.xp) : null); }} />
                    Substituir o resultado automático
                </label>
                {manualXp !== null && <label className="experience-manual-field">XP a conceder
                    <input type="number" min="1" max="999999" step="1" inputMode="numeric"
                        value={manualXp} disabled={fieldsLocked} onChange={event => { setError(""); setManualXp(event.target.value); }} />
                </label>}
                {manualXp !== null && <small>O valor manual substitui o resultado calculado. Os EVs continuam sendo o dobro do XP.</small>}
            </details>
            <dl className="experience-reward-preview" aria-live="polite">
                <div><dt>XP final</dt><dd>{complete ? reward.xp : "—"}</dd></div>
                <div><dt>EVs para treinar</dt><dd>{complete ? reward.evs : "—"}</dd></div>
            </dl>
            {received ? <div className="experience-received"><p role="status">{received.xp} XP e {received.evs} EVs registrados.</p><button type="button" onClick={newChallenge}>Novo desafio</button></div> : <button type="button" className="room-primary-button experience-confirm" disabled={locked || !complete} onClick={() => void award()}>{busy ? "Registrando…" : complete ? attempt ? `Tentar registrar ${reward.xp} XP` : `Receber ${reward.xp} XP` : "Complete a batalha"}</button>}
            {error && attempt && <p className="experience-formula-note">A recompensa permanece em {reward.xp} XP e {reward.evs} EVs. Tente registrar novamente.</p>}
            {!complete && manualXp !== null && <p role="alert" className="experience-error">Informe um valor inteiro.</p>}
            {error && <p role="alert" className="experience-error">{error}</p>}
        </div>
    </details>;
}
