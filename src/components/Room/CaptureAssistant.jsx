import React, { useEffect, useRef, useState } from "react";
import { CAPTURE_BALLS, calculateCaptureChance } from "../../core/capture.js";
import { fetchCached, formatNumberPtBr } from "../../core/mechanics.js";
import { resolveCaptureAction } from "../../../server/authoritativeActions.js";

export default function CaptureAssistant({ role, snapshot, remote, onAuthoritativeAction, onSnapshotChange, onEvent, onError }) {
    const [trainerTokenId, setTrainer] = useState("");
    const [targetId, setTarget] = useState("");
    const [ball, setBall] = useState("poke-ball");
    const [wildConfirmed, setWild] = useState(false);
    const [species, setSpecies] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const lock = useRef(false);
    const target = snapshot.tokens.find(token => token.id === targetId);
    const speciesName = target?.speciesName || target?.speciesId;
    useEffect(() => {
        let active = true;
        setSpecies(null);
        if (speciesName) void (async () => {
            try {
                const pokemon = await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(speciesName)}`);
                if (!pokemon?.species?.name) throw new Error("A espécie do alvo não foi confirmada.");
                const detail = await fetchCached(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(pokemon.species.name)}`);
                if (active) setSpecies({ name: speciesName, detail });
            } catch (error) { if (active) onError?.(error); }
        })();
        return () => { active = false; };
    }, [speciesName, onError]);
    let calculation = null;
    if (target && species?.name === speciesName) {
        try { calculation = calculateCaptureChance({ target, captureRate: species.detail.capture_rate, ball }); }
        catch { /* A removed, captured or fainted target cannot be rolled. */ }
    }
    const capture = async event => {
        event.preventDefault();
        if (lock.current || !calculation || !trainerTokenId || !wildConfirmed) return;
        lock.current = true; setBusy(true);
        try {
            const request = { action: "capture", trainerTokenId, targetId, ball, wildConfirmed };
            if (remote) {
                const response = await onAuthoritativeAction(request);
                setResult(response.result);
            } else {
                const resolved = resolveCaptureAction({ request, snapshot, role, species: species.detail });
                setResult(resolved.result);
                onSnapshotChange(resolved.nextSnapshot);
                await onEvent(resolved.eventType, resolved.eventPayload);
                if (resolved.sfxPayload) await onEvent("sfx", resolved.sfxPayload);
            }
        } catch (error) { onError?.(error); }
        finally { lock.current = false; setBusy(false); }
    };
    return <details className="room-tool">
        <summary><span><small>Um novo parceiro</small><strong>Captura</strong></span></summary>
        <div className="room-tool-body">
            {role !== "narrator" ? <p>Combine a tentativa com o Narrador. O resultado aparecerá no Diário.</p> : <form onSubmit={capture}>
                <fieldset className="combat-grid capture-fields" disabled={busy}>
                    <legend className="sr-only">Preparar captura</legend>
                    <label>Equipe em campo<select value={trainerTokenId} onChange={event => setTrainer(event.target.value)} required>
                        <option value="">Escolha seu Pokémon</option>
                        {snapshot.tokens.filter(token => token.side === "ally" && !token.hidden && !token.captured).map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                    </select></label>
                    <label>Alvo selvagem<select value={targetId} onChange={event => { setTarget(event.target.value); setWild(false); }} required>
                        <option value="">Escolha o alvo</option>
                        {snapshot.tokens.filter(token => token.id !== trainerTokenId && token.side !== "ally" && !token.hidden && !token.captured && !token.ownerPlayerId && token.currentHp > 0).map(token => <option key={token.id} value={token.id}>{token.name}</option>)}
                    </select></label>
                    <label>Poké Ball<select value={ball} onChange={event => setBall(event.target.value)}>{Object.entries(CAPTURE_BALLS).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}</select></label>
                    <label className="capture-confirmation"><input type="checkbox" checked={wildConfirmed} onChange={event => setWild(event.target.checked)} required /> O alvo é selvagem e a captura é permitida.</label>
                </fieldset>
                {calculation && <p>Chance: <strong>{calculation.chance}%</strong> · Taxa {calculation.captureRate}/255 · HP {calculation.currentHp}/{calculation.maxHp} · Ball ×{formatNumberPtBr(calculation.ballBonus)} · Condição ×{formatNumberPtBr(calculation.statusBonus)}</p>}
                <p>Adaptação d100 do RPG. A tentativa usa a intervenção da rodada; ajuste a Ball no inventário.</p>
                <button type="submit" className="room-primary-button" disabled={busy || !calculation || !trainerTokenId || !wildConfirmed}>{busy ? "Resolvendo…" : "Lançar Poké Ball"}</button>
            </form>}
            {result && <p role="status">{result.detail}{result.success ? " Registre o novo parceiro no PC." : ""}</p>}
        </div>
    </details>;
}
