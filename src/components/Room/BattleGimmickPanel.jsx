import React, { useEffect, useState } from "react";
import { applyGimmick, ETERNAMAX_FORM_DATA, EXCEPTIONAL_FORM_DATA, getZAMegaFormData, endGimmick, canUseZMove, getGimmickChoices, normalizeGimmickState } from "../../core/battleGimmicks.js";
import { fetchCached, formatName } from "../../core/mechanics.js";
import { getCurrentMoveReference } from "../../core/championsMoves.js";
import { getMoveSpecialProfile } from "../../core/specialMechanics.js";
import RoomSelect from "../Shared/RoomSelect.jsx";
import { battleMovePresentation } from "../../core/battleMovePresentation.js";

const headings={mega:"Mega Evolução",tera:"Terastalização",dyna:"Dynamax",gmax:"Gigantamax",eternamax:"Eternamax",primal:"Reversão Primitiva",ultra:"Ultra Burst"};
export default function BattleGimmickPanel({snapshot,role,selectedTokenId,onSelectToken,onTokenChange,onOpenZ,onNotice}){
    const [busy,setBusy]=useState("");
    const [zDetails,setZDetails]=useState({});
    const [moveDetails,setMoveDetails]=useState({});
    const zLoadKey=JSON.stringify([...new Set(snapshot.tokens.filter(t=>String(t.item||"").endsWith("-z")).flatMap(t=>t.moves||[]).filter(Boolean))].sort());
    useEffect(()=>{
        let current=true;
        const names=JSON.parse(zLoadKey);
        if(!names.length){setZDetails({});return;}
        Promise.all(names.map(async name=>{
          try { return [name,getCurrentMoveReference(await fetchCached(`https://pokeapi.co/api/v2/move/${encodeURIComponent(name)}`))]; }
          catch { return [name,null]; }
        })).then(entries=>{if(current)setZDetails(Object.fromEntries(entries));});
        return ()=>{current=false;};
    },[zLoadKey]);
    const movesKey=JSON.stringify([...new Set(snapshot.tokens.filter(t=>["dyna","gmax"].includes(t.gimmickState?.active)).flatMap(t=>t.moves||[]).filter(Boolean))].sort());
    useEffect(()=>{
        let live=true;
        const names=JSON.parse(movesKey);
        Promise.all(names.map(async name=>{
            try{return [name,getCurrentMoveReference(await fetchCached("https://pokeapi.co/api/v2/move/"+encodeURIComponent(name)))];}
            catch{return [name,null];}
        })).then(rows=>{if(live)setMoveDetails(Object.fromEntries(rows));});
        return ()=>{live=false;};
    },[movesKey]);
    const canPrepareZ=candidate=>candidate.moves?.some(name=>canUseZMove(candidate,zDetails[name],snapshot) && getMoveSpecialProfile(zDetails[name])?.id!=="called-move");
    const eligible=snapshot.tokens.filter(candidate=>
        (getGimmickChoices(candidate,{phase:snapshot.phase,snapshot}).length>0
        || Boolean(normalizeGimmickState(candidate.gimmickState,candidate).active)
        || canPrepareZ(candidate)) && !candidate.hidden && !candidate.captured);
    if(snapshot.phase!=="batalha"||!eligible.length)return null;
    const token=eligible.find(candidate=>candidate.id===selectedTokenId)||eligible[0];
    const state=normalizeGimmickState(token.gimmickState,token);
    const options=getGimmickChoices(token,{phase:snapshot.phase,snapshot});
    const changedMoves=(token.moves||[]).filter(Boolean).map(name=>{
        const shown=moveDetails[name]?battleMovePresentation(token,moveDetails[name]):null;
        return {name,translated:shown?.label||formatName(name),changed:!!shown&&shown.kind!=="normal"};
    });
    const activate=async choice=>{
        if(role!=="narrator"||busy||snapshot.initiative.length)return;
        setBusy(choice.id);
        try{
            let formData=null;
            if(choice.id==="eternamax")formData=ETERNAMAX_FORM_DATA;
            else if(EXCEPTIONAL_FORM_DATA[choice.form])formData=EXCEPTIONAL_FORM_DATA[choice.form];
            else if(getZAMegaFormData(choice.form))formData=getZAMegaFormData(choice.form);
            else if(choice.form){
                formData=await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(choice.form)}`);
                if(!formData||formData.name!==choice.form)throw new Error("A forma oficial não pôde ser carregada.");
            }
            const result=applyGimmick(token,choice.id,{formData,snapshot});
            if(!result.applied)throw new Error(result.reason);
            await onTokenChange(result.token);
            onSelectToken(token.id);
            onNotice?.(`${token.name}: ${choice.label} ativada!`);
        }catch(error){
            onNotice?.(error instanceof Error?error.message:"Não foi possível ativar essa transformação.");
        }finally{setBusy("");}
    };
    return <section className="battle-gimmick-panel" aria-label="Transformações especiais">
        <header>
          <span><strong>Transformações de batalha</strong><small>Prepare a transformação antes de rolar a iniciativa.</small></span>
          <label className="gimmick-pokemon-choice">
            <span>Pokémon</span>
            <RoomSelect aria-label="Pokémon para transformar" value={token.id}
              onChange={event=>onSelectToken(event.target.value)}>
              {eligible.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </RoomSelect>
          </label>
        </header>
        {state.active ? <div className={`battle-gimmick-current is-${state.active}`} role="status">
            <b>{headings[state.active]||"Forma especial"} ativa</b>
            {state.active==="tera"&&<small>Tipo Tera: {formatName(token.teraType)}</small>}
            {["dyna","gmax"].includes(state.active)&&state.rounds>0&&<small>HP na entrada {state.base?.currentHp}/{state.base?.maxHp} → HP Max atual {token.currentHp}/{token.maxHp} · {state.rounds} {state.rounds===1?"rodada restante":"rodadas restantes"}</small>}
            {state.active==="primal" && <small>Orb equipada • sem limite de três rodadas</small>}
            {state.active==="ultra" && state.rounds>0 && <small>Light That Burns the Sky fica disponível na próxima rodada</small>}
            {["eternamax","primal"].includes(state.active) && role==="narrator" && <button type="button" disabled={Boolean(busy)} onClick={()=>void onTokenChange(endGimmick(token))}>{state.active==="primal"?"Encerrar Reversão Primitiva":"Encerrar Eternamax"}</button>}
        </div> : options.length>0&&<div className="battle-gimmick-actions">
            {options.map(choice=><button type="button" key={choice.id} className={`gimmick-action gimmick-${choice.id}`}
              title={choice.hint} disabled={role!=="narrator"||Boolean(busy)}
              onClick={()=>void activate(choice)}>
                <span className="gimmick-emblem" aria-hidden="true">{({mega:"✧",tera:"◇",dyna:"◈",gmax:"◆",eternamax:"✺",primal:"◉",ultra:"✦"})[choice.id]}</span>
                <strong>{busy===choice.id?"Ativando…":choice.label}</strong>
                <small>{choice.hint}</small>
            </button>)}
        </div>}
        {canPrepareZ(token) && !state.active && <button type="button" className="battle-z-shortcut" onClick={()=>{onSelectToken(token.id);onOpenZ?.()}}>
            <strong>Movimento Z</strong>
            <small>Escolha o golpe no painel Resolver um movimento. Só libera ataques compatíveis com o Z-Crystal.</small>
            <span aria-hidden="true">›</span>
        </button>}
        {state.active && changedMoves.some(move=>move.changed) &&
          <div className="gimmick-move-preview" aria-label="Movimentos transformados">
            <strong>Movimentos nesta forma</strong>
            <ul>{changedMoves.map(move=><li key={move.name} className={move.changed?"is-changed":""}>
              <span>{move.translated}</span>{move.changed&&<small>Original: {formatName(move.name)}</small>}
            </li>)}</ul>
          </div>}
    </section>;
}
