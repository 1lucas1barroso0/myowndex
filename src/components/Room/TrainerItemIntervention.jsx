import React, { useRef, useState } from 'react';
import RoomSelect from '../Shared/RoomSelect.jsx';
import { getCaptureInterventionBlockReason, resolveTrainerItemAction } from '../../../server/authoritativeActions.js';

export default function TrainerItemIntervention({ snapshot, role, remote, onAuthoritativeAction, onSnapshotChange, onEvent, onError }) {
    const [selected,setSelected]=useState(''),[item,setItem]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
    const lock=useRef(false);
    const partners=snapshot.tokens.filter(p=>p.side==='ally'&&!p.hidden&&!p.captured&&p.currentHp>0);
    const partner=partners.find(p=>p.id===selected);
    const blocked=partner?getCaptureInterventionBlockReason(snapshot,partner):'';
    const submit=async event=>{
        event.preventDefault();if(lock.current||!partner||!item.trim()||blocked)return;
        lock.current=true;setBusy(true);setNotice('');
        try {
            const request={action:'trainer-item',trainerTokenId:partner.id,itemLabel:item.trim()};
            if(remote){const response=await onAuthoritativeAction(request);setNotice(response.result.detail);}
            else {const response=resolveTrainerItemAction({snapshot,role,request});if(await onSnapshotChange(response.nextSnapshot)===false)throw Error('O registro não foi salvo. Tente novamente.');await onEvent?.(response.eventType,response.eventPayload);setNotice(response.result.detail);}
        } catch(error){onError?.(error);}
        finally{lock.current=false;setBusy(false);}
    };
    return <details className="room-tool"><summary><strong>Item do Treinador</strong></summary><div className="room-tool-body">
        <p>Combine o item com o Narrador. Esta ferramenta registra a intervenção; o efeito e o gasto do item são confirmados por ele.</p>
        {role==='narrator'?<form onSubmit={submit}><fieldset className="combat-grid" disabled={busy}>
            <legend className="sr-only">Registrar intervenção por item</legend>
            <label><span>Seu Pokémon em campo</span><RoomSelect aria-label="Pokémon da intervenção por item" value={partner?.id||''} onChange={event=>setSelected(event.target.value)} required><option value="">{partners.length?'Escolha um Pokémon':'Sem parceiro em campo'}</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</RoomSelect></label>
            <label><span>Item usado</span><input type="text" maxLength={60} value={item} onChange={event=>setItem(event.target.value)} required /></label>
        </fieldset>{blocked&&<p role="status">{blocked}</p>}<button className="room-primary-button" type="submit" disabled={busy||!partner||!item.trim()||Boolean(blocked)}>{busy?'Registrando…':'Registrar intervenção por item'}</button></form>:<p>O Narrador confirma o registro no começo da vez do seu Pokémon.</p>}
        {notice&&<p role="status">{notice}</p>}
    </div></details>;
}
