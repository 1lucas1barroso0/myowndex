import React, { useState } from "react";
import { applyGimmick, getGimmickChoices, normalizeGimmickState } from "../../core/battleGimmicks.js";
import { fetchCached, formatName } from "../../core/mechanics.js";
import RoomSelect from "../Shared/RoomSelect.jsx";

const headings={mega:"Mega Evolução",tera:"Terastalização",dyna:"Dynamax",gmax:"Gigantamax"};
const canPrepareZ = token => token.item?.endsWith("-z")
    && token.moves?.some(Boolean)
    && token.currentHp>0
    && !normalizeGimmickState(token.gimmickState,token).used.includes("z");
export default function BattleGimmickPanel({snapshot,role,selectedTokenId,onSelectToken,onTokenChange,onOpenZ,onNotice}){
    const [busy,setBusy]=useState("");
    const eligible=snapshot.tokens.filter(candidate=>
        (getGimmickChoices(candidate,{phase:snapshot.phase,snapshot}).length>0
        || Boolean(normalizeGimmickState(candidate.gimmickState,candidate).active)
        || canPrepareZ(candidate)) && !candidate.hidden && !candidate.captured);
    if(snapshot.phase!=="batalha"||!eligible.length)return null;
    const token=eligible.find(candidate=>candidate.id===selectedTokenId)||eligible[0];
    const state=normalizeGimmickState(token.gimmickState,token);
    const options=getGimmickChoices(token,{phase:snapshot.phase,snapshot});
    const activate=async choice=>{
        if(role!=="narrator"||busy)return;
        setBusy(choice.id);
        try{
            let formData=null;
            if(choice.form){
                formData=await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(choice.form)}`);
                if(!formData||formData.name!==choice.form)throw new Error("A forma oficial não pôde ser carregada.");
            }
            const result=applyGimmick(token,choice.id,{formData});
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
          <span><strong>Transformações de batalha</strong><small>Ative uma mecânica disponível para este Pokémon.</small></span>
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
            {state.rounds>0&&<small>{state.rounds} {state.rounds===1?"rodada restante":"rodadas restantes"}</small>}
        </div> : options.length>0&&<div className="battle-gimmick-actions">
            {options.map(choice=><button type="button" key={choice.id} className={`gimmick-action gimmick-${choice.id}`}
              title={choice.hint} disabled={role!=="narrator"||Boolean(busy)}
              onClick={()=>void activate(choice)}>
                <span className="gimmick-emblem" aria-hidden="true">{({mega:"✧",tera:"◇",dyna:"◈",gmax:"◆"})[choice.id]}</span>
                <strong>{busy===choice.id?"Ativando…":choice.label}</strong>
                <small>{choice.hint}</small>
            </button>)}
        </div>}
        {canPrepareZ(token) && !state.active && <button type="button" className="battle-z-shortcut" onClick={()=>{onSelectToken(token.id);onOpenZ?.()}}>
            <strong>Movimento Z</strong>
            <small>Escolha o golpe no painel Resolver um movimento. Só libera ataques compatíveis com o Z-Crystal.</small>
            <span aria-hidden="true">›</span>
        </button>}
    </section>;
}
