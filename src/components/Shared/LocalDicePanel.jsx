import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { getStorageScope, readStorage, resolveStorageKey, writeStorage } from "../../core/storage.js";
import { authoritativeLocalRollReceipt, clearLocalRollsDurable, deleteLocalRollDurable, LOCAL_DICE_SIDES, LOCAL_ROLL_HISTORY_KEY, LOCAL_ROLL_MODES, LOCAL_ROLL_PREFIX, localRollEvent, localRollSpec, localRollText, mergeLocalRolls, performLocalRoll, readLocalRollHistoryDurable, readLocalRolls, saveLocalRollDurable } from "../../core/localRolls.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import LocalPokemonDice from "./LocalPokemonDice.jsx";
import RoomSelect from "./RoomSelect.jsx";
import GameIcon from "./GameIcon.jsx";

const DEFAULTS = { kind:"attribute", mode:"normal", attribute:0, opposition:"", chance:50, quantity:1, sides:6, modifier:0, label:"" };
const preferenceKey = "myowndex_local_dice_preferences_v1";
const kindLabel = spec => spec.kind === "pokemon" ? "Jogada Pokémon" : spec.kind === "percent" ? "d100" : spec.kind === "free" ? Number.isInteger(spec.quantity) && Number.isInteger(spec.sides) ? `${spec.quantity}d${spec.sides}` : "dX" : !spec.mode || spec.mode === "normal" ? "2d6" : "3d6 · manter 2";
const rollLabel = spec => spec.kind === "free" || spec.mode === "normal" ? kindLabel(spec) : `${kindLabel(spec)} · ${LOCAL_ROLL_MODES[spec.mode]}`;
const modeHelp = spec => {
    if (!spec || spec.mode === "normal") return "";
    if (spec.kind === "percent") return spec.mode === "advantage" ? "Vale o menor d100." : "Vale o maior d100.";
    return spec.mode === "advantage" ? "Mantém os dois dados mais altos." : "Mantém os dois mais baixos.";
};
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

export default function LocalDicePanel({ context="central", onRoll, compact=false, showHeading=true, ...pokemonProps }) {
    const [page,setPage]=useState("simple");
    const [draft,setDraft]=useState(DEFAULTS);
    const [history,setHistory]=useState([]);
    const [result,setResult]=useState(null);
    const [remoteResult,setRemoteResult]=useState(null);
    const [busy,setBusy]=useState(false);
    const [ready,setReady]=useState(false);
    const [error,setError]=useState("");
    const [feedback,setFeedback]=useState("");
    const [clearPending,setClearPending]=useState(false);
    const [deletePending,setDeletePending]=useState(null);
    const [accountApplying,setAccountApplying]=useState(false);
    const applyingAccount=useRef(false);
    const lock=useRef(false), unlockTimer=useRef(null), alive=useRef(true);
    const inAdventure=context==="aventura";
    const modeHintId=useId(), difficultyHintId=useId();
    const remoteAdventure=inAdventure && Boolean(pokemonProps.remote) && typeof pokemonProps.onAuthoritativeAction==="function";
    useEffect(()=>{
        alive.current=true;
        const saved=readStorage(preferenceKey,null);
        if(saved) { try { setDraft({...DEFAULTS,...localRollSpec(saved)}); } catch { /* Invalid drafts cannot silently change a roll. */ } }
        const records=readLocalRolls(); setHistory(records); setResult(inAdventure ? null : records.find(r=>!r.legacy) || null);
        void readLocalRollHistoryDurable().then(next=>{if(alive.current){setHistory(next);setResult(inAdventure ? null : next.find(r=>!r.legacy)||null);setReady(true);}});
        const refresh=()=>{
            void readLocalRollHistoryDurable().then(next=>{
                if(!alive.current)return;
                setHistory(next);
                if(!inAdventure) setResult(current=>current && next.some(entry=>entry.id===current.id) ? current : next.find(entry=>!entry.legacy) || null);
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
    },[inAdventure]);
    const configuration=useMemo(()=>{ try { return {spec:localRollSpec(draft)}; } catch(e) { return {error:e.message}; } },[draft]);
    useEffect(()=>{ if(ready && configuration.spec) writeStorage(preferenceKey,configuration.spec); },[configuration,ready]);
    const update=(key,value)=>setDraft(current=>({...current,[key]:value}));
    const roll=async event=>{
        event.preventDefault();
        if(lock.current || applyingAccount.current || !ready || configuration.error) return;
        lock.current=true; setBusy(true); setError(""); setFeedback(""); setRemoteResult(null);
        let receipt;
        try {
            const spec=configuration.spec;
            if(remoteAdventure) {
                const request=spec.kind==="attribute"
                    ? {action:"quick-attribute",mode:spec.mode,attribute:spec.attribute,opposition:spec.opposition,label:spec.label}
                    : spec.kind==="percent"
                        ? {action:"quick-percent",mode:spec.mode,chance:spec.chance,label:spec.label}
                        : {action:"quick-free",quantity:spec.quantity,sides:spec.sides,modifier:spec.modifier,label:spec.label};
                const authoritative=await pokemonProps.onAuthoritativeAction(request);
                if(alive.current){
                    const receipt=authoritativeLocalRollReceipt(authoritative,spec);
                    setResult(receipt);
                    setRemoteResult(receipt ? null : {...(authoritative.result || authoritative),spec});
                }
                return;
            }
            receipt=performLocalRoll(draft,{context});
            setResult(receipt);
            if(inAdventure) {
                if(typeof pokemonProps.onEvent==="function") await pokemonProps.onEvent("roll",localRollEvent(receipt));
            } else {
                const persisted=await saveLocalRollDurable(receipt);
                setHistory(current=>mergeLocalRolls([receipt],current,readLocalRolls()));
                if(!persisted) setFeedback("O resultado continua na tela, mas não entrou no histórico.");
                if(onRoll) await onRoll(localRollEvent(receipt));
            }
        } catch(e) {
            if(alive.current) setError(receipt ? "O resultado continua na tela, mas não entrou na aventura. Nenhuma nova rolagem foi feita." : e instanceof Error ? e.message : "Não foi possível concluir a rolagem. Nenhum resultado novo foi gerado.");
        } finally {
            if(alive.current) unlockTimer.current=setTimeout(()=>{lock.current=false;setBusy(false);},350);
        }
    };
    const download=()=>{
        try {
            const text=`MyOwnDex · Histórico de rolagens\n\n`+history.map(localRollText).join("\n\n────────────────\n\n");
            const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
            const a=document.createElement("a");a.href=url;a.download=`MyOwnDex-rolagens-${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            setFeedback("Histórico pronto para baixar.");
        } catch { setFeedback("O download não ficou pronto. Tente novamente."); }
    };
    const clearHistory=async ()=>{
        if(applyingAccount.current || lock.current)return;
        setClearPending(false);
        if(!history.length) return;
        if(!await clearLocalRollsDurable()) { setFeedback("Não foi possível apagar o histórico."); return; }
        setHistory([]); setResult(null); setFeedback("Histórico apagado.");
    };
    const deleteReceipt=async ()=>{
        if(applyingAccount.current || lock.current || !deletePending)return;
        const id=deletePending.id;
        setDeletePending(null);
        if(!await deleteLocalRollDurable(id)) { setFeedback("Não foi possível apagar esta rolagem."); return; }
        if(!alive.current)return;
        const next=await readLocalRollHistoryDurable();
        if(!alive.current)return;
        setHistory(next);
        setResult(current=>current?.id===id ? next.find(entry=>!entry.legacy)||null : current);
        setFeedback("Rolagem apagada.");
    };
    const changed=result && !result.legacy && configuration.spec && JSON.stringify(result.spec)!==JSON.stringify(configuration.spec);
    return <section className={`local-dice-panel ${compact ? "is-compact" : "game-panel"}`} aria-label="Dados">
        {showHeading && <header className="local-dice-heading"><div><h3>Dados</h3></div></header>}
        {!inAdventure && <div className="local-dice-pages" aria-label="Escolher tipo de jogada"><button type="button" aria-pressed={page==="simple"} onClick={()=>setPage("simple")}><GameIcon name="dice" />Rolagens</button><button type="button" aria-pressed={page==="pokemon"} onClick={()=>setPage("pokemon")}><GameIcon name="adventure" />Campo</button></div>}
        <div hidden={!inAdventure && page!=="simple"}>
        <form className="local-dice-controls" onSubmit={roll} onKeyDown={event=>{if(event.key==="Enter" && event.repeat) event.preventDefault();}}>
            <fieldset disabled={busy || accountApplying}><legend className="sr-only">Configurar rolagem</legend>
                <div className="local-dice-tabs" aria-label="Tipo de rolagem">{[["attribute","2d6","Teste"],["percent","d100","Chance"],["free","dX","Livre"]].map(([kind,die,label])=><button type="button" key={kind} aria-pressed={draft.kind===kind} onClick={()=>update("kind",kind)}><b>{die}</b><small>{label}</small></button>)}</div>
                <div className="local-dice-fields">
                    {draft.kind!=="free" && <label>Modo<RoomSelect aria-label="Modo" aria-describedby={modeHelp(configuration.spec) ? modeHintId : undefined} value={draft.mode} onChange={e=>update("mode",e.target.value)}>{Object.entries(LOCAL_ROLL_MODES).map(([mode,label])=><option key={mode} value={mode}>{label}</option>)}</RoomSelect>{modeHelp(configuration.spec) && <small id={modeHintId} className="local-dice-mode-help">{modeHelp(configuration.spec)}</small>}</label>}
                    {draft.kind==="attribute" && <label>Modificador<input type="number" step="1" min="-99999" max="99999" value={draft.attribute} required onChange={e=>update("attribute",e.target.value)} /></label>}
                    {draft.kind==="percent" && <label className="local-dice-chance">Chance base (%)<input type="number" step="1" min="0" max="100" value={draft.chance} required onChange={e=>update("chance",e.target.value)} /><input aria-label="Ajustar chance percentual" type="range" min="0" max="100" value={draft.chance || 0} onChange={e=>update("chance",e.target.value)} /></label>}
                    {draft.kind==="free" && <><label>Quantidade<input type="number" step="1" min="1" max="20" value={draft.quantity} required onChange={e=>update("quantity",e.target.value)} /></label><label>Dado<RoomSelect value={draft.sides} onChange={e=>update("sides",e.target.value)}>{LOCAL_DICE_SIDES.map(sides=><option key={sides} value={sides}>d{sides}</option>)}</RoomSelect></label><label>Modificador<input type="number" step="1" min="-99999" max="99999" value={draft.modifier} required onChange={e=>update("modifier",e.target.value)} /></label></>}
                </div>
                <details className="local-dice-options" open={Boolean((draft.kind==="attribute" && draft.opposition!=null && draft.opposition!=="") || draft.label)}>
                    <summary>Mais opções</summary>
                    <div className="local-dice-fields">
                        {draft.kind==="attribute" && <label>Dificuldade<input aria-label="Dificuldade" aria-describedby={difficultyHintId} type="number" step="1" min="-99999" max="99999" value={draft.opposition ?? ""} onChange={e=>update("opposition",e.target.value)} /><small id={difficultyHintId}>Opcional. Empates favorecem a oposição.</small></label>}
                        <label className="local-dice-label">Nome da ação<input maxLength={80} value={draft.label} onChange={e=>update("label",e.target.value)} /></label>
                    </div>
                </details>
                {configuration.error && <p className="local-dice-feedback is-error" role="alert">{configuration.error}</p>}
                <div className="local-dice-submit"><button type="submit" className="room-primary-button" disabled={!ready || Boolean(configuration.error)} aria-busy={busy} onClick={event=>{if(event.detail>1) event.preventDefault();}}>{busy ? "Rolando…" : `Rolar ${configuration.spec ? kindLabel(configuration.spec) : "dados"}`}</button></div>
            </fieldset>
        </form>
        {error && <p className="local-dice-feedback is-error" role="alert">{error}</p>}
        </div>
        {!inAdventure && <div hidden={page!=="pokemon"}><LocalPokemonDice {...pokemonProps} accountApplying={accountApplying} isAccountApplying={()=>applyingAccount.current} context={context} onReceipt={record=>{setResult(record);setRemoteResult(null);setHistory(current=>mergeLocalRolls([record],current,readLocalRolls()));}} /></div>}
        {feedback && <p className="local-dice-feedback" role="status">{feedback}</p>}
        {remoteResult && <article className="local-dice-result is-shared" aria-live="polite" aria-atomic="true"><header><div><small>{remoteResult.spec.label || rollLabel(remoteResult.spec)}</small><h4>{remoteResult.title}</h4></div></header><p>{remoteResult.detail}</p></article>}
        {page==="simple" && result?.version===3 && <article className="local-dice-result local-pokemon-receipt" aria-live="polite"><header><h4>{result.spec.label}</h4><RollTimestamp value={result.createdAt} /></header><p>{result.detail}</p>{result.groups.map((group,index)=><p key={index}><strong>{group.label}</strong> · {group.values.join(" · ")}</p>)}{result.success!=null && <strong className={result.success?"is-success":"is-failure"}>{result.success?"Sucesso":"Falha"}</strong>}</article>}
        {(inAdventure || page==="simple") && result?.version===2 && !result.legacy && <article className="local-dice-result" key={result.id} aria-live="polite" aria-atomic="true">
            <header><div><small>{rollLabel(result.spec)}</small><h4>{result.spec.label || "Resultado"}</h4></div><strong className="local-dice-total">{result.total}</strong></header>
            <Faces record={result} />
            <div className="local-dice-verdict">{result.critical && <b>Crítico potencial</b>}{result.fumble && <b>Erro crítico</b>}{result.success!==null && <strong className={result.success ? "is-success" : "is-failure"}>{result.success ? "Sucesso" : "Falha"}<small>{result.spec.kind==="percent" ? `Chance base ${result.spec.chance}%` : `Dificuldade ${result.spec.opposition}${result.margin===0 ? " · empate" : ""}`}</small></strong>}</div>
            {result.suggestion && <p>Sugestão para o erro crítico: {result.suggestion}</p>}
            {changed && <><small className="local-dice-config-note">Os ajustes mudaram desde esta rolagem.</small><div className="local-dice-result-actions"><button type="button" disabled={busy} onClick={()=>setDraft({...DEFAULTS,...result.spec})}>Usar de novo</button></div></>}
        </article>}
        {!inAdventure && <details className="local-dice-history"><summary><span>Histórico</span><b>{history.length} {history.length===1 ? "rolagem" : "rolagens"}</b></summary><div>
            {!history.length && <p>Nenhuma rolagem ainda.</p>}
            {history.length>0 && <div className="local-dice-history-actions"><button type="button" onClick={download}>Baixar histórico</button><button type="button" className="is-clear" disabled={busy || accountApplying} onClick={()=>setClearPending(true)}>Apagar histórico</button></div>}
            {history.length>0 && <ol>{history.map(entry=><li key={entry.id}><div className="local-dice-history-entry"><button type="button" disabled={Boolean(entry.legacy)} aria-pressed={!entry.legacy && result?.id===entry.id} onClick={()=>{setResult(entry);setPage("simple");setFeedback("");}}><span>{entry.spec.label || kindLabel(entry.spec)} <small>{entry.context==="aventura" ? "Aventura" : entry.context==="central" ? "Dados" : "Guia"} · <RollTimestamp value={entry.createdAt} /></small></span><span className="local-dice-history-result">{entry.version!==3 && <b>{entry.total}</b>}{!entry.legacy && rollOutcome(entry) && <small className={`local-dice-history-outcome ${entry.fumble || entry.success===false ? "is-failure" : "is-success"}`}>{rollOutcome(entry)}</small>}</span></button><button type="button" className="local-dice-delete-receipt" disabled={busy || accountApplying} onClick={()=>setDeletePending(entry)} aria-label={`Apagar rolagem de ${entry.spec.label || kindLabel(entry.spec)}`} title="Apagar rolagem"><span aria-hidden="true">⌫</span></button></div></li>)}</ol>}
        </div></details>}
        {!inAdventure && <ConfirmDialog
            open={clearPending}
            title="Apagar histórico de rolagens?"
            description="As rolagens salvas serão apagadas. O Diário das aventuras continua como está."
            confirmLabel="Apagar histórico"
            onConfirm={clearHistory}
            onCancel={()=>setClearPending(false)}
        />}
        {!inAdventure && <ConfirmDialog open={Boolean(deletePending)} title="Apagar esta rolagem?" description="Só esta rolagem sai do histórico. O restante do jogo continua como está." confirmLabel="Apagar rolagem" onConfirm={()=>void deleteReceipt()} onCancel={()=>setDeletePending(null)} />}
    </section>;
}
