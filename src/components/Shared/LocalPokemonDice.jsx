import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyStageChange, STAGE_LABELS } from "../../core/automation.js";
import { formatName } from "../../core/mechanics.js";
import { createRoomSnapshot, addTeamToSnapshot, normalizeRoomToken, ROOM_WEATHERS, ROOM_TERRAINS, STATUS_LABELS, syncTeamsWithRoomProgress } from "../../core/room.js";
import { hydratePokemon } from "../../core/team.js";
import { createScheduledSave } from "../../core/scheduledSave.js";
import { getStorageScope, readDurableStorage, resolveStorageKey, writeDurableStorage } from "../../core/storage.js";
import { createPokemonRollReceipt, saveLocalRollDurable } from "../../core/localRolls.js";
import { LOCAL_DICE_ROOM_KEY, LOCAL_DICE_TOKEN_LIMIT, LOCAL_OPPOSED_STATS, normalizeLocalDiceRoom, registerLocalPokemonDiceWrites, removeLocalDiceToken, rollLocalPokemonOpposition } from "../../core/localPokemonRolls.js";
import { resolveAuthoritativeAction } from "../../../server/authoritativeActions.js";
import CombatAssistant from "../Room/CombatAssistant.jsx";
import CaptureAssistant from "../Room/CaptureAssistant.jsx";
import SpecialMechanicsPanel from "../Room/SpecialMechanicsPanel.jsx";
import TraitMechanicsPanel from "../Room/TraitMechanicsPanel.jsx";
import RoomSelect from "./RoomSelect.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import PokemonSprite from "./PokemonSprite.jsx";

const initialField = () => createRoomSnapshot("Campo livre");
const actionLabel = { combat:"Movimento", capture:"Captura", initiative:"Iniciativa", "advance-turn":"Rodada", opposed:"Disputa" };

function actionReceipt(action, resolved, snapshot, context, request = {}) {
    const result = resolved.result || {};
    const event = resolved.eventPayload || {};
    let detail = event.text || result.detail || "";
    let groups = [];
    let success = null;
    if (action === "combat") {
        const attackerName=event.attackerName || snapshot.tokens.find(token=>token.id===request.attackerId)?.name || "Pokémon";
        const moveName=event.moveName || formatName(request.calledMoveName || request.moveName) || "Movimento";
        const targetName=event.defenderName || (result.targetResults || []).map(entry=>entry.target?.name).filter(Boolean).join(", ");
        detail = `${attackerName} · ${moveName}${targetName ? ` → ${targetName}` : ""}. ${result.moveConnected ? "Alcançou o alvo." : "Não alcançou o alvo."}${result.consequences?.damage ? ` Dano aplicado: ${result.consequences.damage}.` : ""}${result.consequences?.healed ? ` HP recuperado: ${result.consequences.healed}.` : ""}`;
        success = result.moveConnected === true;
        groups = (result.targetResults || []).flatMap(entry => {
            const resolution = entry.resolution || {};
            const target = entry.target?.name || "Alvo";
            return [
                { label:`Ataque · ${target}`, values:resolution.attackTest?.dice || [] },
                { label:`Defesa · ${target}`, values:resolution.defenseTest?.dice || [] },
                { label:`Precisão · ${target}`, values:resolution.accuracyTest?.rolls || [] },
            ];
        }).filter(group => group.values.length);
    } else if (action === "capture") {
        success = result.success;
        groups = [{ label:"d100", values:result.rolls || [] }].filter(group=>group.values.length);
    } else if (action === "initiative") {
        groups = (result.results || []).map(entry=>({ label:snapshot.tokens.find(token=>token.id===entry.tokenId)?.name || "Pokémon", values:[...(entry.dice || []),...(entry.tieBreakRolls || [])] }));
        detail ||= `Ordem da rodada: ${(result.results || []).map(entry=>snapshot.tokens.find(token=>token.id===entry.tokenId)?.name).filter(Boolean).join(", ")}.`;
    } else if(action==="advance-turn") {
        detail ||= result.closingRound ? "Rodada encerrada. Escolha os movimentos para a próxima rodada." : "Próximo turno preparado.";
    }
    return createPokemonRollReceipt({ action, label:actionLabel[action], detail, groups, success,
        critical:(result.targetResults || []).some(entry=>entry.resolution?.criticalHit),
        fumble:(result.targetResults || []).some(entry=>entry.resolution?.attackTest?.fumble),
    },{ context });
}

/** Adapts a practice field to the existing Adventure assistants. Rules, entropy,
 * exceptions, permissions and PP/HP updates remain in their shared engines. */
export default function LocalPokemonDice({ teams = [], setTeams, snapshot: sceneSnapshot, onSnapshotChange, onDeclareMove,
    onAuthoritativeAction, remote = false, role = "narrator", playerId, onEvent, onReceipt, context = "central", accountApplying = false, isAccountApplying }) {
    const [scope] = useState(getStorageScope);
    const [field,setField] = useState(initialField);
    const [ready,setReady] = useState(false);
    const [adding,setAdding] = useState(false);
    const [selectedSource,setSelectedSource] = useState("");
    const [side,setSide] = useState("ally");
    const [selectedTokenId,setSelectedTokenId] = useState("");
    const [notice,setNotice] = useState("");
    const [pending,setPending] = useState("");
    const [busy,setBusy] = useState(false);
    const [attackerStat,setAttackerStat] = useState("attack");
    const [defenderStat,setDefenderStat] = useState("defense");
    const [oppositionId,setOppositionId] = useState("");
    const [opposedMode,setOpposedMode] = useState("normal");
    const alive = useRef(true);
    const actionLock = useRef(false);
    const pendingWork = useRef(new Set());
    const fieldRevision=useRef(0);
    const hasScene = Boolean(sceneSnapshot);
    const snapshot = sceneSnapshot || field;
    const snapshotRef = useRef(snapshot);
    useEffect(()=>{snapshotRef.current=snapshot;},[snapshot]);
    const editing = !sceneSnapshot || role === "narrator";
    const selectedToken = snapshot.tokens.find(token=>token.id===selectedTokenId) || snapshot.tokens[0];
    const sources = useMemo(()=>teams.flatMap(team=>team.pokemon.map(pokemon=>({ key:`${team.id}:${pokemon.id}`, team, pokemon,
        label:`${pokemon.nickname || formatName(pokemon.species?.name)} · ${team.name}` }))),[teams]);
    const currentSource = sources.find(source=>source.key===selectedSource);
    const onSaveResult = useCallback(saved=>{if(!saved)setNotice("O campo continua aberto, mas esta mudança ainda não foi salva.");},[]);
    const save = useMemo(()=>createScheduledSave({ save:value=>writeDurableStorage(LOCAL_DICE_ROOM_KEY,value,{scope}), onResult:onSaveResult }),[scope,onSaveResult]);
    useEffect(()=>registerLocalPokemonDiceWrites(async()=>{
        while(pendingWork.current.size)await Promise.allSettled([...pendingWork.current]);
        return hasScene ? true : save.flush();
    }),[hasScene,save]);
    useEffect(()=>{
        alive.current = true;
        if (hasScene) { setReady(true); return ()=>{alive.current=false;}; }
        const initialRevision=fieldRevision.current;
        void readDurableStorage(LOCAL_DICE_ROOM_KEY,null,{scope}).then(value=>{if(alive.current){if(value && initialRevision===fieldRevision.current)setField(normalizeLocalDiceRoom(value));setReady(true);}});
        const flush=()=>void save.flush();
        const applyField=value=>{
            const normalized=value ? normalizeLocalDiceRoom(value) : initialField();
            fieldRevision.current+=1;
            snapshotRef.current=normalized;
            setField(normalized);
        };
        const accountDocumentChanged=event=>{
            if(event.detail?.scope!==scope || !event.detail?.document)return;
            applyField(event.detail.document.localTools?.diceRoom);
        };
        const refreshField=()=>{
            if(save.hasPending() || pendingWork.current.size)return;
            const revision=fieldRevision.current;
            void readDurableStorage(LOCAL_DICE_ROOM_KEY,null,{scope}).then(value=>{
                if(alive.current && !save.hasPending() && !pendingWork.current.size && revision===fieldRevision.current)applyField(value);
            });
        };
        const storageChanged=event=>{if(event.key===resolveStorageKey(LOCAL_DICE_ROOM_KEY,{scope}) || event.key===null)refreshField();};
        const storageChangedHere=event=>{if(event.detail?.scope===scope && event.detail?.key===LOCAL_DICE_ROOM_KEY)refreshField();};
        window.addEventListener("pagehide",flush);
        window.addEventListener("myowndex:account-document",accountDocumentChanged);
        window.addEventListener("storage",storageChanged);
        window.addEventListener("myowndex:storage",storageChangedHere);
        return ()=>{alive.current=false;window.removeEventListener("pagehide",flush);window.removeEventListener("myowndex:account-document",accountDocumentChanged);window.removeEventListener("storage",storageChanged);window.removeEventListener("myowndex:storage",storageChangedHere);void save.flush();save.cancel();};
    },[hasScene,scope,save]);

    const trackWork=work=>{
        const task=(async()=>work())();
        pendingWork.current.add(task);
        void task.finally(()=>pendingWork.current.delete(task)).catch(()=>{});
        return task;
    };

    const commit = useCallback(next=>{
        if(sceneSnapshot) onSnapshotChange?.(next);
        else { const normalized = normalizeLocalDiceRoom(next);fieldRevision.current+=1;snapshotRef.current=normalized;setField(normalized);save.schedule(normalized); }
    },[sceneSnapshot,onSnapshotChange,save]);
    const updateToken = nextToken => commit({ ...snapshotRef.current, tokens:snapshotRef.current.tokens.map(token=>token.id===nextToken.id ? normalizeRoomToken(nextToken) : token) });
    const showError = useCallback(error=>setNotice(error instanceof Error ? error.message : String(error)),[]);
    const record = async receipt=>{
        const saved = await saveLocalRollDurable(receipt,{scope});
        if(!alive.current) return;
        onReceipt?.(receipt);
        if(!saved)setNotice("O resultado continua na tela, mas não entrou no histórico.");
    };

    const runAction = request=>trackWork(async()=>{
        if(isAccountApplying?.())throw new Error("Aguarde a conta terminar de atualizar.");
        if(actionLock.current) throw new Error("Aguarde a jogada em andamento.");
        actionLock.current=true;setBusy(true);setNotice("");
        try {
            let before = snapshotRef.current;
            if(sceneSnapshot && remote) {
                const response = await onAuthoritativeAction(request);
                await record(actionReceipt(request.action,response,before,context,request));
                return response;
            }
            // Fetch only the selected moves/species, never a whole Box catalog.
            const { fetchCached } = await import("../../core/mechanics.js");
            let move=null,calledMove=null,species=null;
            if(request.action==="combat") {
                move=await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(request.moveName)}`);
                if(request.calledMoveName)calledMove=await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(request.calledMoveName)}`);
                if(!move || (request.calledMoveName && !calledMove))throw new Error("Não foi possível consultar esse movimento.");
            }
            if(request.action==="capture") {
                const target=before.tokens.find(token=>token.id===request.targetId);
                const pokemon=await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(target?.speciesId || target?.speciesName || "")}`);
                if(pokemon?.species?.name)species=await fetchCached(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(pokemon.species.name)}`);
                if(!species)throw new Error("Não foi possível consultar a espécie do alvo.");
            }
            if(!alive.current)throw new Error("O campo foi fechado antes da jogada.");
            before=snapshotRef.current;
            const resolved=resolveAuthoritativeAction({ request, snapshot:before, role:sceneSnapshot?role:"narrator", move,calledMove,species });
            if(resolved.nextSnapshot)commit(resolved.nextSnapshot);
            const receipt=actionReceipt(request.action,resolved,before,context,request);
            await record(receipt);
            if(sceneSnapshot && onEvent)await onEvent(resolved.eventType,resolved.eventPayload);
            return resolved;
        } finally { actionLock.current=false;if(alive.current)setBusy(false); }
    });
    const addPartner=()=>trackWork(async()=>{
        if(isAccountApplying?.() || !currentSource || adding || snapshot.tokens.length>=LOCAL_DICE_TOKEN_LIMIT)return;
        setAdding(true);setNotice("");
        try {
            const pokemon=await hydratePokemon(currentSource.pokemon);
            if(!alive.current)return;
            const added=addTeamToSnapshot(snapshotRef.current,{...currentSource.team,pokemon:[pokemon]},side,"",{ activePokemonIds:[pokemon.id] });
            if(!added.added?.length && added.room.tokens.length===snapshotRef.current.tokens.length)throw new Error("Este Pokémon já está no campo. Escolha outro parceiro.");
            commit(added.room);
            setSelectedTokenId(added.room.tokens.at(-1)?.id || "");
        } catch(error){if(alive.current)showError(error);} finally {if(alive.current)setAdding(false);}
    });
    const declareMove=async(tokenId,move)=>{
        if(isAccountApplying?.())return;
        if(sceneSnapshot && onDeclareMove)return onDeclareMove(tokenId,move);
        commit({...snapshotRef.current,tokens:snapshotRef.current.tokens.map(token=>token.id===tokenId?{...token,declaredMove:move.name,priority:move.priority || 0}:token)});
    };
    const opposed=()=>trackWork(async()=>{
        if(isAccountApplying?.() || actionLock.current || !selectedToken || !oppositionId)return;
        actionLock.current=true;setBusy(true);setNotice("");
        try {
            const result=rollLocalPokemonOpposition({snapshot:snapshotRef.current,attackerId:selectedToken.id,defenderId:oppositionId,attackerStat,defenderStat,mode:opposedMode});
            const receipt=createPokemonRollReceipt({action:"opposed",label:"Disputa",detail:result.detail,mode:opposedMode,success:result.success,
                groups:[{label:result.attackerName,values:result.attack.dice},{label:result.defenderName,values:result.defense.dice}],
                critical:result.attack.critical,fumble:result.attack.fumble,
            },{context});
            await record(receipt);
        } catch(error){showError(error);} finally{actionLock.current=false;if(alive.current)setBusy(false);}
    });
    const confirm = ()=>{
        if(isAccountApplying?.() || actionLock.current || adding)return;
        if(pending==="reset") { commit(initialField());setSelectedTokenId("");setOppositionId(""); }
        if(pending==="apply" && setTeams)setTeams(current=>syncTeamsWithRoomProgress(current,snapshotRef.current));
        if(pending.startsWith("remove:")) {
            const tokenId=pending.slice(7);
            const next=removeLocalDiceToken(snapshotRef.current,tokenId);
            commit(next);
            setSelectedTokenId(current=>current===tokenId ? next.tokens[0]?.id || "" : current);
            setOppositionId(current=>current===tokenId ? "" : current);
        }
        setPending("");setNotice(pending==="apply"?"Progresso registrado nas Boxes.":pending==="reset"?"Campo limpo.":"Pokémon retirado do campo.");
    };

    if(!ready)return <p role="status">Abrindo o campo…</p>;
    return <div className="local-pokemon-dice">
        {sceneSnapshot && <p className="local-pokemon-context">Campo da aventura · rodada {snapshot.round}</p>}
        <fieldset className="local-pokemon-workbench" disabled={busy || adding || accountApplying}><legend className="sr-only">Configurar e resolver jogadas Pokémon</legend>
        {!sceneSnapshot && <details className="local-pokemon-setup" open={!snapshot.tokens.length}>
            <summary>Pokémon das Boxes <b>{snapshot.tokens.length}</b></summary>
            {sources.length ? <div className="local-dice-fields">
                <label>Pokémon<RoomSelect aria-label="Pokémon da Box" value={selectedSource} onChange={event=>setSelectedSource(event.target.value)}><option value="">Escolha um parceiro</option>{sources.map(source=><option key={source.key} value={source.key}>{source.label}</option>)}</RoomSelect></label>
                <label>Posição<RoomSelect aria-label="Posição no campo" value={side} onChange={event=>setSide(event.target.value)}><option value="ally">Aliado</option><option value="opponent">Oponente</option></RoomSelect></label>
                <button type="button" className="room-primary-button" disabled={!currentSource || adding || snapshot.tokens.length>=LOCAL_DICE_TOKEN_LIMIT} onClick={()=>void addPartner()}>{adding?"Preparando…":"Trazer para o campo"}</button>
            </div> : <p>Escolha ou gere Pokémon no PC para montar o campo.</p>}
            <small>As Boxes só mudam quando você registra o progresso.</small>
        </details>}
        {snapshot.tokens.length>0 && <>
            <div className="local-pokemon-roster" aria-label="Pokémon em campo">{snapshot.tokens.map(token=><button type="button" key={token.id} aria-pressed={selectedToken?.id===token.id} onClick={()=>setSelectedTokenId(token.id)}>
                <PokemonSprite src={token.sprite} alt="" /><span><strong>{token.name}</strong><small>HP {token.currentHp} de {token.maxHp}{token.captured?" · capturado":""}</small></span>
            </button>)}</div>
            <CombatAssistant snapshot={snapshot} role={sceneSnapshot?role:"narrator"} playerId={playerId} selectedTokenId={selectedToken?.id} remote onAuthoritativeAction={runAction} onSnapshotChange={commit} onDeclareMove={declareMove} onEvent={onEvent} onError={showError} />
            <details className="room-tool local-pokemon-initiative"><summary><strong>Iniciativa</strong><b>R{snapshot.round}</b></summary><div className="room-tool-body">
                {snapshot.initiative.length>0 && <ol>{snapshot.initiative.map((id,index)=><li key={id} aria-current={index===snapshot.turnIndex?"step":undefined}>{snapshot.tokens.find(token=>token.id===id)?.name}</li>)}</ol>}
                <div className="local-pokemon-actions"><button type="button" disabled={!editing || busy || !snapshot.tokens.some(token=>!token.hidden && token.currentHp>0)} onClick={()=>void runAction({action:"initiative"}).catch(showError)}>Rolar iniciativa</button><button type="button" disabled={!editing || busy || !snapshot.initiative.length} onClick={()=>void runAction({action:"advance-turn"}).catch(showError)}>{snapshot.initiative.length && snapshot.turnIndex>=snapshot.initiative.length-1?"Encerrar rodada":"Próximo turno"}</button></div>
            </div></details>
            <details className="room-tool"><summary><strong>Disputa entre Pokémon</strong></summary><div className="room-tool-body"><div className="local-dice-fields">
                <label>Pokémon<RoomSelect aria-label="Pokémon da disputa" value={selectedToken?.id || ""} onChange={event=>setSelectedTokenId(event.target.value)}>{snapshot.tokens.map(token=><option key={token.id} value={token.id}>{token.name}</option>)}</RoomSelect></label>
                <label>Atributo<RoomSelect aria-label="Atributo do Pokémon" value={attackerStat} onChange={event=>setAttackerStat(event.target.value)}>{Object.entries(LOCAL_OPPOSED_STATS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</RoomSelect></label>
                <label>Rival<RoomSelect aria-label="Rival da disputa" value={oppositionId} onChange={event=>setOppositionId(event.target.value)}><option value="">Escolha um Pokémon</option>{snapshot.tokens.filter(token=>token.id!==selectedToken?.id).map(token=><option key={token.id} value={token.id}>{token.name}</option>)}</RoomSelect></label>
                <label>Atributo rival<RoomSelect aria-label="Atributo do rival" value={defenderStat} onChange={event=>setDefenderStat(event.target.value)}>{Object.entries(LOCAL_OPPOSED_STATS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</RoomSelect></label>
                <label>Situação<RoomSelect value={opposedMode} onChange={event=>setOpposedMode(event.target.value)}><option value="normal">Normal</option><option value="advantage">Vantagem</option><option value="disadvantage">Desvantagem</option></RoomSelect></label>
            </div><button type="button" className="room-primary-button" disabled={busy || !selectedToken || !oppositionId || selectedToken.id===oppositionId} onClick={()=>void opposed()}>Resolver disputa</button></div></details>
            <CaptureAssistant snapshot={snapshot} role={sceneSnapshot?role:"narrator"} remote onAuthoritativeAction={runAction} onSnapshotChange={commit} onEvent={onEvent} onError={showError} />
            {editing && <details className="room-tool"><summary><strong>Condições do campo</strong></summary><div className="room-tool-body"><div className="local-dice-fields">
                <label>Clima<RoomSelect value={snapshot.weather} onChange={event=>commit({...snapshot,weather:event.target.value})}>{ROOM_WEATHERS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</RoomSelect></label>
                <label>Terreno<RoomSelect value={snapshot.terrain} onChange={event=>commit({...snapshot,terrain:event.target.value})}>{ROOM_TERRAINS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</RoomSelect></label>
                <label>Fase<RoomSelect value={snapshot.phase} onChange={event=>commit({...snapshot,phase:event.target.value})}><option value="exploracao">Exploração</option><option value="batalha">Batalha</option></RoomSelect></label>
            </div>{selectedToken && <div className="local-pokemon-status"><h4>{selectedToken.name}</h4><div className="local-dice-fields">
                <label>HP atual<input type="number" min="0" max={selectedToken.maxHp} step="1" value={selectedToken.currentHp} onChange={event=>updateToken({...selectedToken,currentHp:Math.floor(Number(event.target.value))})} /></label>
                <label>Condição<RoomSelect value={selectedToken.status} onChange={event=>updateToken({...selectedToken,status:event.target.value})}>{Object.entries(STATUS_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</RoomSelect></label>
                {Object.entries(STAGE_LABELS).map(([key,label])=><label key={key}>{label}<RoomSelect value={selectedToken.stages?.[key] || 0} onChange={event=>updateToken(applyStageChange(selectedToken,key,Number(event.target.value)-(selectedToken.stages?.[key] || 0)))}>{Array.from({length:13},(_,index)=>index-6).map(stage=><option key={stage} value={stage}>{stage>0?`+${stage}`:stage}</option>)}</RoomSelect></label>)}
            </div><TraitMechanicsPanel token={selectedToken} snapshot={snapshot} role="narrator" onTokenChange={updateToken} onNotice={setNotice} /><SpecialMechanicsPanel token={selectedToken} snapshot={snapshot} role="narrator" onTokenChange={updateToken} onNotice={setNotice} />
            {!sceneSnapshot && <button type="button" onClick={()=>setPending(`remove:${selectedToken.id}`)}>Retirar do campo</button>}
            </div>}</div></details>}
            {!sceneSnapshot && <div className="local-pokemon-actions">{setTeams && <button type="button" onClick={()=>setPending("apply")}>Registrar progresso nas Boxes</button>}<button type="button" onClick={()=>setPending("reset")}>Limpar campo</button></div>}
        </>}
        </fieldset>
        {notice && <p role="status" className="local-dice-feedback">{notice}</p>}
        <ConfirmDialog open={Boolean(pending)} title={pending==="apply"?"Registrar progresso nas Boxes?":pending==="reset"?"Limpar o campo?":"Retirar este Pokémon do campo?"} description={pending==="apply"?"HP, PP e condições deste campo vão para as fichas correspondentes.":pending==="reset"?"O campo será esvaziado. Boxes e histórico ficam como estão.":"Este Pokémon sai apenas do campo. A ficha e o histórico ficam como estão."} confirmLabel={pending==="apply"?"Registrar progresso":pending==="reset"?"Limpar campo":"Retirar Pokémon"} onConfirm={confirm} onCancel={()=>setPending("")} />
    </div>;
}
