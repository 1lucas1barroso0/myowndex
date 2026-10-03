import React, { useEffect, useMemo, useRef, useState } from "react";
import { getStorageScope, readStorage, resolveStorageKey, writeStorage } from "../../core/storage.js";
import { clearLocalRollsDurable, LOCAL_DICE_SIDES, LOCAL_ROLL_HISTORY_KEY, LOCAL_ROLL_MODES, LOCAL_ROLL_PREFIX, localRollEvent, localRollOdds, localRollSpec, localRollText, mergeLocalRolls, performLocalRoll, readLocalRollHistoryDurable, readLocalRolls, saveLocalRollDurable } from "../../core/localRolls.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import LocalPokemonDice from "./LocalPokemonDice.jsx";

const DEFAULTS = { kind:"attribute", mode:"normal", attribute:0, opposition:"", chance:50, quantity:1, sides:6, modifier:0, label:"" };
const preferenceKey = "myowndex_local_dice_preferences_v1";
const percentage = value => new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:2}).format(value);
const kindLabel = spec => spec.kind === "percent" ? "d100" : spec.kind === "free" ? `${spec.quantity}d${spec.sides}` : spec.mode === "normal" ? "2d6" : "3d6 · manter 2";
const rollLabel = spec => spec.kind === "free" || spec.mode === "normal" ? kindLabel(spec) : `${kindLabel(spec)} · ${LOCAL_ROLL_MODES[spec.mode]}`;
const rollTime = new Intl.DateTimeFormat("pt-BR", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
const rollOutcome = record => record.fumble ? "Erro crítico" : record.critical ? "Crítico potencial" : record.success == null ? "" : record.success ? "Sucesso" : "Falha";

function RollTimestamp({ value }) {
    const date = new Date(value);
    return value > 0 && Number.isFinite(date.getTime()) ? <time dateTime={date.toISOString()}>{rollTime.format(date)}</time> : <span>Sem data</span>;
}

function Faces({ record }) {
    const remaining=[...record.kept];
    return <ol className="local-dice-faces" aria-label="Valores sorteados">
        {record.values.map((value,index)=>{
            const matched=remaining.indexOf(value), kept=matched>=0;
            if(kept) remaining.splice(matched,1);
            return <li key={index} className={kept ? "is-kept" : "is-discarded"}><b>{value}</b>{!kept && <small>Descartado</small>}</li>;
        })}
    </ol>;
}

export default function LocalDicePanel({ context="guia", onRoll, compact=false, showHeading=true, ...pokemonProps }) {
    const [page,setPage]=useState("simple");
    const [draft,setDraft]=useState(DEFAULTS);
    const [history,setHistory]=useState([]);
    const [result,setResult]=useState(null);
    const [busy,setBusy]=useState(false);
    const [ready,setReady]=useState(false);
    const [error,setError]=useState("");
    const [feedback,setFeedback]=useState("");
    const [clearPending,setClearPending]=useState(false);
    const [accountApplying,setAccountApplying]=useState(false);
    const applyingAccount=useRef(false);
    const lock=useRef(false), unlockTimer=useRef(null), alive=useRef(true);
    useEffect(()=>{
        alive.current=true;
        const saved=readStorage(preferenceKey,null);
        if(saved) { try { setDraft({...DEFAULTS,...localRollSpec(saved)}); } catch { /* Invalid drafts cannot silently change a roll. */ } }
        const records=readLocalRolls(); setHistory(records); setResult(records.find(r=>!r.legacy) || null);
        void readLocalRollHistoryDurable().then(next=>{if(alive.current){setHistory(next);setResult(next.find(r=>!r.legacy)||null);setReady(true);}});
        const refresh=()=>{
            void readLocalRollHistoryDurable().then(next=>{
                if(!alive.current)return;
                setHistory(next);
                setResult(current=>current && next.some(entry=>entry.id===current.id) ? current : next.find(entry=>!entry.legacy) || null);
            });
        };
        const sync=event=>{
            if(event.key!==null && !event.key?.startsWith(resolveStorageKey(LOCAL_ROLL_PREFIX)) && event.key!==resolveStorageKey(LOCAL_ROLL_HISTORY_KEY) && event.key!==resolveStorageKey("myowndex_guide_roll_history_v1")) return;
            refresh();
        };
        const syncHere=event=>{
            if(event.detail?.scope!==getStorageScope()) return;
            const key=event.detail.key;
            if(key?.startsWith(LOCAL_ROLL_PREFIX) || key===LOCAL_ROLL_HISTORY_KEY || key==="myowndex_guide_roll_history_v1") refresh();
        };
        const accountDocumentChanged=event=>{
            if(event.detail?.scope!==getStorageScope() || !event.detail?.document)return;
            const preferences=event.detail.document.localTools?.dicePreferences;
            try { setDraft({...DEFAULTS,...localRollSpec(preferences || DEFAULTS)}); } catch { /* Keep a valid local configuration if the incoming draft is malformed. */ }
            refresh();
        };
        const accountApplyChanged=event=>{
            if(event.detail?.scope!==getStorageScope())return;
            applyingAccount.current=event.type==="myowndex:account-apply-start";
            setAccountApplying(applyingAccount.current);
        };
        window.addEventListener("storage",sync);
        window.addEventListener("myowndex:storage",syncHere);
        window.addEventListener("myowndex:account-document",accountDocumentChanged);
        window.addEventListener("myowndex:account-apply-start",accountApplyChanged);
        window.addEventListener("myowndex:account-apply-end",accountApplyChanged);
        return ()=>{ alive.current=false; clearTimeout(unlockTimer.current); window.removeEventListener("storage",sync); window.removeEventListener("myowndex:storage",syncHere);window.removeEventListener("myowndex:account-document",accountDocumentChanged);window.removeEventListener("myowndex:account-apply-start",accountApplyChanged);window.removeEventListener("myowndex:account-apply-end",accountApplyChanged); };
    },[]);
    const configuration=useMemo(()=>{ try { return {spec:localRollSpec(draft),odds:localRollOdds(draft)}; } catch(e) { return {error:e.message}; } },[draft]);
    useEffect(()=>{ if(ready && configuration.spec) writeStorage(preferenceKey,configuration.spec); },[configuration,ready]);
    const update=(key,value)=>setDraft(current=>({...current,[key]:value}));
    const roll=async event=>{
        event.preventDefault();
        if(lock.current || applyingAccount.current || !ready || configuration.error) return;
        lock.current=true; setBusy(true); setError(""); setFeedback("");
        let receipt;
        try {
            receipt=performLocalRoll(draft,{context});
            // Result and history use this same receipt. Effects never generate dice.
            const persisted=await saveLocalRollDurable(receipt);
            setResult(receipt); setHistory(current=>mergeLocalRolls([receipt],current,readLocalRolls()));
            if(!persisted) setFeedback("Resultado preservado nesta sessão. O dispositivo não permitiu salvar o histórico; você pode baixá-lo.");
            if(onRoll) await onRoll(localRollEvent(receipt));
        } catch(e) {
            if(alive.current) setError(receipt ? "O resultado foi preservado, mas não pôde ser registrado na cena. Não houve uma nova rolagem." : e instanceof Error ? e.message : "Não foi possível concluir a rolagem. Nenhum resultado novo foi gerado.");
        } finally {
            if(alive.current) unlockTimer.current=setTimeout(()=>{lock.current=false;setBusy(false);},350);
        }
    };
    const download=()=>{
        try {
            const text=`MyOwnDex · Histórico de rolagens locais\nRegistros ${getStorageScope() ? "desta conta" : "deste dispositivo"}. O histórico local não substitui os recibos de rolagens do servidor.\n\n`+history.map(localRollText).join("\n\n────────────────\n\n");
            const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
            const a=document.createElement("a");a.href=url;a.download=`MyOwnDex-rolagens-${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            setFeedback("Histórico preparado para download.");
        } catch { setFeedback("O dispositivo não permitiu baixar o histórico agora."); }
    };
    const clearHistory=async ()=>{
        if(applyingAccount.current)return;
        setClearPending(false);
        if(!history.length) return;
        if(!await clearLocalRollsDurable()) { setFeedback("Não foi possível apagar o histórico neste dispositivo."); return; }
        setHistory([]); setResult(null); setFeedback("Histórico apagado.");
    };
    const changed=result && !result.legacy && configuration.spec && JSON.stringify(result.spec)!==JSON.stringify(configuration.spec);
    return <section className={`local-dice-panel ${compact ? "is-compact" : "game-panel"}`} aria-label="Rolagens locais">
        {showHeading && <header className="local-dice-heading"><div><h3>Dados locais</h3></div></header>}
        <div className="local-dice-pages" aria-label="Escolher rolagens"><button type="button" aria-pressed={page==="simple"} onClick={()=>setPage("simple")}>Simples</button><button type="button" aria-pressed={page==="pokemon"} onClick={()=>setPage("pokemon")}>Pokémon</button></div>
        <div hidden={page!=="simple"}>
        <form className="local-dice-controls" onSubmit={roll} onKeyDown={event=>{if(event.key==="Enter" && event.repeat) event.preventDefault();}}>
            <fieldset disabled={busy || accountApplying}><legend className="sr-only">Configurar rolagem local</legend>
                <div className="local-dice-tabs" aria-label="Tipo de rolagem">{[["attribute","2d6","Teste"],["percent","d100","Chance"],["free","dX","Livre"]].map(([kind,die,label])=><button type="button" key={kind} aria-pressed={draft.kind===kind} onClick={()=>update("kind",kind)}><b>{die}</b><small>{label}</small></button>)}</div>
                <div className="local-dice-fields">
                    {draft.kind!=="free" && <label>Modo<select value={draft.mode} onChange={e=>update("mode",e.target.value)}>{Object.entries(LOCAL_ROLL_MODES).map(([mode,label])=><option key={mode} value={mode}>{label}</option>)}</select></label>}
                    {draft.kind==="attribute" && <label>Modificador<input type="number" step="1" min="-99999" max="99999" value={draft.attribute} required onChange={e=>update("attribute",e.target.value)} /></label>}
                    {draft.kind==="percent" && <label className="local-dice-chance">Chance base (%)<input type="number" step="1" min="0" max="100" value={draft.chance} required onChange={e=>update("chance",e.target.value)} /><input aria-label="Ajustar chance percentual" type="range" min="0" max="100" value={draft.chance || 0} onChange={e=>update("chance",e.target.value)} /></label>}
                    {draft.kind==="free" && <><label>Quantidade<input type="number" step="1" min="1" max="20" value={draft.quantity} required onChange={e=>update("quantity",e.target.value)} /></label><label>Dado<select value={draft.sides} onChange={e=>update("sides",e.target.value)}>{LOCAL_DICE_SIDES.map(sides=><option key={sides} value={sides}>d{sides}</option>)}</select></label><label>Modificador<input type="number" step="1" min="-99999" max="99999" value={draft.modifier} required onChange={e=>update("modifier",e.target.value)} /></label></>}
                </div>
                <details className="local-dice-options" open={Boolean(draft.opposition !== "" || draft.label)}>
                    <summary>Ajustes opcionais</summary>
                    <div className="local-dice-fields">
                        {draft.kind==="attribute" && <label>Dificuldade<input type="number" step="1" min="-99999" max="99999" value={draft.opposition ?? ""} onChange={e=>update("opposition",e.target.value)} /><small>Opcional. Empates favorecem a oposição.</small></label>}
                        <label className="local-dice-label">Nome da ação<input maxLength={80} value={draft.label} onChange={e=>update("label",e.target.value)} /></label>
                    </div>
                </details>
                {configuration.error && <p className="local-dice-feedback is-error" role="alert">{configuration.error}</p>}
                <div className="local-dice-submit"><button type="submit" className="room-primary-button" disabled={!ready || Boolean(configuration.error)} aria-busy={busy} onClick={event=>{if(event.detail>1) event.preventDefault();}}>{busy ? "Registrando…" : `Rolar ${configuration.spec ? kindLabel(configuration.spec) : "dados"}`}</button></div>
                {!configuration.error && <details className="local-dice-probability">
                    <summary>Probabilidades</summary>
                    <div className="local-dice-odds" aria-live="polite">
                        {draft.kind==="attribute" && <><span>{configuration.odds.success!==null ? `Superar dificuldade: ${percentage(configuration.odds.success)}. ` : "2d6 + modificador. "}Crítico: {percentage(configuration.odds.critical)} · erro crítico: {percentage(configuration.odds.fumble)}.</span><small>{draft.mode==="normal" ? "Dois dados de seis faces." : draft.mode==="advantage" ? "Três dados; mantêm-se os dois maiores." : "Três dados; mantêm-se os dois menores."} É preciso superar a dificuldade; empates falham.</small></>}
                        {draft.kind==="percent" && <><span>Chance efetiva de sucesso: <b>{percentage(configuration.odds.success)}</b></span><small>{draft.mode==="normal" ? "Rola de 1 a 100." : draft.mode==="advantage" ? "Vantagem · menor de dois d100." : "Desvantagem · maior de dois d100."} Sucesso quando o resultado é menor ou igual à chance base.</small></>}
                        {draft.kind==="free" && <span>Resultados possíveis: <b>{configuration.odds.minimum} a {configuration.odds.maximum}</b>.</span>}
                    </div>
                </details>}
            </fieldset>
        </form>
        {error && <p className="local-dice-feedback is-error" role="alert">{error}</p>}
        {feedback && <p className="local-dice-feedback" role="status">{feedback}</p>}
        </div>
        <div hidden={page!=="pokemon"}><LocalPokemonDice {...pokemonProps} accountApplying={accountApplying} isAccountApplying={()=>applyingAccount.current} context={context} onReceipt={record=>{setResult(record);setHistory(current=>mergeLocalRolls([record],current,readLocalRolls()));}} /></div>
        {result?.version===3 && <article className="local-dice-result local-pokemon-receipt" aria-live="polite"><header><h4>{result.spec.label}</h4><RollTimestamp value={result.createdAt} /></header><p>{result.detail}</p>{result.groups.map((group,index)=><p key={index}><strong>{group.label}</strong> · {group.values.join(" · ")}</p>)}{result.success!=null && <strong className={result.success?"is-success":"is-failure"}>{result.success?"Sucesso":"Falha"}</strong>}</article>}
        {result?.version===2 && !result.legacy && <article className="local-dice-result" key={result.id} aria-live="polite" aria-atomic="true">
            <header><div><small>{rollLabel(result.spec)}</small><h4>{result.spec.label || "Resultado"}</h4></div><strong className="local-dice-total">{result.total}</strong></header>
            <Faces record={result} />
            <p className="local-dice-equation">{result.kept.join(" + ")}{(result.spec.attribute ?? result.spec.modifier ?? 0)!==0 && ` ${(result.spec.attribute ?? result.spec.modifier)<0 ? "−" : "+"} ${Math.abs(result.spec.attribute ?? result.spec.modifier)}`} = <b>{result.total}</b></p>
            <div className="local-dice-verdict">{result.critical && <b>Crítico potencial</b>}{result.fumble && <b>Erro crítico</b>}{result.success!==null && <strong className={result.success ? "is-success" : "is-failure"}>{result.success ? "Sucesso" : "Falha"}<small>{result.spec.kind==="percent" ? `Chance base ${result.spec.chance}%` : `Dificuldade ${result.spec.opposition}${result.margin===0 ? " · empate" : ""}`}</small></strong>}</div>
            {result.suggestion && <p>Sugestão para o erro crítico: {result.suggestion}</p>}
            {changed && <><small className="local-dice-config-note">Resultado anterior. Os ajustes atuais valem para a próxima rolagem.</small><div className="local-dice-result-actions"><button type="button" disabled={busy} onClick={()=>setDraft({...DEFAULTS,...result.spec})}>Reutilizar ajustes</button></div></>}
        </article>}
        <details className="local-dice-history"><summary><span>Histórico</span><b>{history.length} {history.length===1 ? "rolagem" : "rolagens"}</b></summary><div>
            <p>{history.length ? "Até 100 resultados salvos. Selecione uma rolagem para consultar os dados e os ajustes usados." : "Role os dados para começar seu histórico."}</p>
            <div className="local-dice-history-actions"><button type="button" disabled={!history.length} onClick={download}>Baixar histórico</button><button type="button" className="is-clear" disabled={!history.length || accountApplying} onClick={()=>setClearPending(true)}>Apagar histórico</button></div>
            {history.length>0 && <ol>{history.map(entry=><li key={entry.id}><button type="button" disabled={Boolean(entry.legacy)} aria-pressed={!entry.legacy && result?.id===entry.id} onClick={()=>{setResult(entry);setFeedback("");}}><span>{entry.spec.label || kindLabel(entry.spec)} <small>{entry.context==="aventura" ? "Aventura" : entry.context==="central" ? "Dados locais" : "Guia"} · <RollTimestamp value={entry.createdAt} /></small></span>{entry.version!==3 && <b>{entry.total}</b>}</button><div className="local-dice-history-meta"><small>{entry.version===3 ? entry.detail : `Dados: ${entry.values.join(" · ")}${entry.legacy ? " · registro anterior" : entry.spec.mode!=="normal" ? ` · ${LOCAL_ROLL_MODES[entry.spec.mode]}` : ""}`}</small>{!entry.legacy && rollOutcome(entry) && <small className={`local-dice-history-outcome ${entry.fumble || entry.success===false ? "is-failure" : "is-success"}`}>{rollOutcome(entry)}</small>}</div></li>)}</ol>}
        </div></details>
        <ConfirmDialog
            open={clearPending}
            title="Apagar histórico de rolagens?"
            description={`O histórico ${getStorageScope() ? "desta conta" : "deste dispositivo"} será apagado. O Diário das aventuras será preservado.`}
            confirmLabel="Apagar histórico"
            onConfirm={clearHistory}
            onCancel={()=>setClearPending(false)}
        />
    </section>;
}
