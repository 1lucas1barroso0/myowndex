import { formatGameFactor } from "../../core/integerRules.js";
import React, { useEffect, useRef, useState } from "react";
import { CAPTURE_BALLS, calculateCaptureChance, captureTrainerKey } from "../../core/capture.js";
import { fetchCached } from "../../core/mechanics.js";
import { getCaptureInterventionBlockReason, resolveCaptureAction } from "../../../server/authoritativeActions.js";
import RoomSelect from "../Shared/RoomSelect.jsx";

export default function CaptureAssistant({ role, snapshot, remote, onAuthoritativeAction, onSnapshotChange, onEvent, onError }) {
    const [trainerTokenId, setTrainer] = useState("");
    const [targetId, setTarget] = useState("");
    const [ball, setBall] = useState("poke-ball");
    const [wildConfirmed, setWild] = useState(false);
    const [species, setSpecies] = useState(null);
    const [speciesLoadState, setSpeciesLoadState] = useState("idle");
    const [speciesRefresh, setSpeciesRefresh] = useState(0);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [bagDraft, setBagDraft] = useState("0");
    const lock = useRef(false);
    const retrySpeciesRequested = useRef(false);
    const trainers = snapshot.tokens.filter(token => token.side === "ally" && !token.hidden && !token.captured && token.currentHp > 0);
    const targets = snapshot.tokens.filter(token => token.id !== trainerTokenId && token.side !== "ally" && !token.hidden && !token.captured && !token.ownerPlayerId && token.currentHp > 0);
    const target = targets.find(token => token.id === targetId);
    const interventionBlock = getCaptureInterventionBlockReason(snapshot, trainers.find(token => token.id === trainerTokenId));
    const trainerKey = captureTrainerKey(trainers.find(token=>token.id===trainerTokenId));
    const availableBalls = snapshot.trainerBags?.[trainerKey]?.[ball] ?? 0;
    useEffect(()=>setBagDraft(String(availableBalls)),[trainerKey,ball,availableBalls]);
    const bagCount=Number(bagDraft);
    const validBagCount=bagDraft.trim()!=="" && Number.isSafeInteger(bagCount) && bagCount>=0 && bagCount<=999999;
    const bagChanged=bagDraft!==String(availableBalls);
    const speciesName = target?.speciesName || target?.speciesId;
    useEffect(() => {
        let active = true;
        const forceRefresh = retrySpeciesRequested.current;
        retrySpeciesRequested.current = false;
        setSpecies(null);
        setSpeciesLoadState(speciesName ? "loading" : "idle");
        if (speciesName) void (async () => {
            try {
                const pokemon = await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(speciesName)}`, { forceRefresh });
                if (!pokemon?.species?.name) throw new Error("A espécie do alvo não foi confirmada.");
                const detail = await fetchCached(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(pokemon.species.name)}`, { forceRefresh });
                if (!detail) throw new Error("Não foi possível consultar a espécie do alvo.");
                if (active) {
                    setSpecies({ name: speciesName, detail });
                    setSpeciesLoadState("ready");
                }
            } catch { if (active) setSpeciesLoadState("error"); }
        })();
        return () => { active = false; };
    }, [speciesName, speciesRefresh]);
    let calculation = null;
    let calculationError = "";
    if (target && species?.name === speciesName) {
        try { calculation = calculateCaptureChance({ target, captureRate: species.detail.capture_rate, ball }); }
        catch (error) { calculationError=error.message; }
    }
    const capture = async event => {
        event.preventDefault();
        if (lock.current || interventionBlock || !calculation || !trainerTokenId || !wildConfirmed) return;
        lock.current = true; setBusy(true);
        try {
            const request = { action: "capture", trainerTokenId, targetId, ball, wildConfirmed };
            if (remote) {
                const response = await onAuthoritativeAction(request);
                setResult(response.result);
            } else {
                const resolved = resolveCaptureAction({ request, snapshot, role, species: species.detail });
                if (await onSnapshotChange(resolved.nextSnapshot) === false) throw new Error("A captura não foi salva. Tente novamente.");
                setResult(resolved.result);
                await onEvent(resolved.eventType, resolved.eventPayload);
            }
        } catch (error) { onError?.(error); }
        finally { lock.current = false; setBusy(false); }
    };
    return <details className="room-tool">
        <summary><span><strong>Captura</strong></span></summary>
        <div className="room-tool-body">
            {role !== "narrator" ? <p>Combine a tentativa com o Narrador. O resultado aparecerá no Diário.</p> : <form onSubmit={capture}>
                <fieldset className="combat-grid capture-fields" disabled={busy}>
                    <legend className="sr-only">Preparar captura</legend>
                    <label><span>Pokémon ajudando</span><RoomSelect aria-label="Pokémon ajudando" value={trainers.some(token=>token.id===trainerTokenId) ? trainerTokenId : ""} disabled={!trainers.length} onChange={event => setTrainer(event.target.value)} required>
                        <option value="">{trainers.length ? "Escolha um Pokémon" : "Sem Pokémon em campo"}</option>
                        {trainers.map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                    </RoomSelect></label>
                    <label><span>Alvo da captura</span><RoomSelect aria-label="Alvo da captura" value={target?.id || ""} disabled={!targets.length} onChange={event => { setTarget(event.target.value); setWild(false); }} required>
                        <option value="">{targets.length ? "Escolha um alvo" : "Sem alvo selvagem"}</option>
                        {targets.map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                    </RoomSelect></label>
                    <label><span>Poké Ball</span><RoomSelect aria-label="Poké Ball" value={ball} onChange={event => setBall(event.target.value)}>{Object.entries(CAPTURE_BALLS).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}</RoomSelect></label>
                    {trainerKey && <div className="capture-inventory"><label><span>{CAPTURE_BALLS[ball].label} na bolsa</span><input type="number" min="0" max="999999" step="1" inputMode="numeric" value={bagDraft} onChange={event=>setBagDraft(event.target.value)} /></label><button type="button" disabled={!validBagCount || !bagChanged || busy} onClick={async()=>{
                        if(lock.current)return;
                        lock.current=true;setBusy(true);
                        try { if(await onSnapshotChange({ ...snapshot, trainerBags: { ...snapshot.trainerBags, [trainerKey]: { ...snapshot.trainerBags?.[trainerKey], [ball]: bagCount } } })===false)throw new Error("Não foi possível salvar a bolsa."); }
                        catch(error){onError?.(error);}
                        finally{lock.current=false;setBusy(false);}
                    }}>Salvar bolsa</button></div>}
                    <label className="capture-confirmation"><input type="checkbox" checked={wildConfirmed} onChange={event => setWild(event.target.checked)} required /><span>O alvo é selvagem e a captura é permitida.</span></label>
                </fieldset>
                {speciesLoadState === "loading" && <p role="status" className="sr-only">Calculando a chance de captura…</p>}
                {speciesLoadState === "error" && <div><p role="alert">Não foi possível consultar este alvo.</p><button type="button" onClick={() => { retrySpeciesRequested.current = true; setSpeciesRefresh(current => current + 1); }}>Tentar novamente</button></div>}
                {calculationError && <p role="status">{calculationError}</p>}
                {calculation && <dl className="capture-metrics">
                    <div><dt>Chance · d100</dt><dd>{calculation.chance}%</dd></div>
                    <div><dt>Taxa de captura</dt><dd>{calculation.captureRate} de 255</dd></div>
                    <div><dt>HP do alvo</dt><dd>{calculation.currentHp} de {calculation.maxHp}</dd></div>
                    <div><dt>Bônus</dt><dd>Poké Ball ×{formatGameFactor(calculation.ballBonus)}<br />Condição ×{formatGameFactor(calculation.statusBonus)}</dd></div>
                </dl>}
                <details className="capture-help"><summary>Como capturar</summary><p className="capture-note">Escolha seu Pokémon, o alvo e a Poké Ball. Confirme que o alvo é selvagem. A captura usa d100 e a intervenção no começo do seu turno. Registre as Balls na bolsa: cada tentativa retira uma, mesmo se falhar. Formas Max precisam terminar antes da captura.</p></details>
                {interventionBlock && <p role="status">{interventionBlock}</p>}
                <button type="submit" className="room-primary-button" disabled={busy || Boolean(interventionBlock) || !calculation || !trainerTokenId || !wildConfirmed || availableBalls<1 || bagChanged}>{busy ? "Resolvendo…" : "Lançar Poké Ball"}</button>
            </form>}
            {result && <p role="status">{result.detail}{result.success ? " Registre o novo parceiro no PC." : ""}</p>}
        </div>
    </details>;
}
