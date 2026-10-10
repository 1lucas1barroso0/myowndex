import React, { useState } from "react";
import { applyGimmick, getGimmickChoices, normalizeGimmickState } from "../../core/battleGimmicks.js";
import { fetchCached } from "../../core/mechanics.js";

const headings={mega:"Mega Evolução",tera:"Terastalização",dyna:"Dynamax",gmax:"Gigantamax"};
export default function BattleGimmickPanel({token, snapshot, role, onTokenChange, onNotice}){
    const [busy,setBusy]=useState("");
    const state=normalizeGimmickState(token.gimmickState,token);
    const options=getGimmickChoices(token,{phase:snapshot.phase,snapshot});
    if(snapshot.phase!=="batalha"||(!options.length&&!state.active))return null;
    const activate=async choice=>{
        if(role!=="narrator"||busy)return;
        setBusy(choice.id);
        try {
            let formData=null;
            if(choice.form){
                formData=await fetchCached(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(choice.form)}`);
                if(!formData||formData.name!==choice.form)throw new Error("A forma oficial não pôde ser carregada.");
            }
            const result=applyGimmick(token,choice.id,{formData});
            if(!result.applied)throw new Error(result.reason);
            onTokenChange(result.token);
            onNotice?.(`${token.name}: ${choice.label} ativada!`);
        }catch(error){onNotice?.(error instanceof Error?error.message:"Não foi possível ativar essa transformação.");}
        finally{setBusy("");}
    };
    return <section className="battle-gimmick-panel" aria-label="Transformações especiais">
        <header><strong>Transformações</strong><small>Somente recursos disponíveis na ficha</small></header>
        {state.active ? <div className={`battle-gimmick-current is-${state.active}`} role="status">
            <b>{headings[state.active]||"Forma especial"} ativa</b>
            {state.active==="tera"&&<small>Tipo Tera: {token.teraType}</small>}
            {state.rounds>0&&<small>{state.rounds} {state.rounds===1?"rodada restante":"rodadas restantes"}</small>}
        </div> : <div className="battle-gimmick-actions">
            {options.map(choice=><button type="button" key={choice.id} className={`gimmick-action gimmick-${choice.id}`}
              title={choice.hint} disabled={role!=="narrator"||Boolean(busy)}
              onClick={()=>void activate(choice)}>
                <span className="gimmick-emblem" aria-hidden="true">{({mega:"✧",tera:"◇",dyna:"◈",gmax:"◆"})[choice.id]}</span>
                <strong>{busy===choice.id?"Ativando…":choice.label}</strong>
                <small>{choice.hint}</small>
            </button>)}
        </div>}
    </section>;
}
