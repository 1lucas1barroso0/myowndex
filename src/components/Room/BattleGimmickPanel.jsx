import React, { useEffect, useState } from "react";
import { applyGimmick, ETERNAMAX_FORM_DATA, endGimmick, canUseZMove, getGimmickChoices, normalizeGimmickState } from "../../core/battleGimmicks.js";
import { fetchCached, formatName } from "../../core/mechanics.js";
import { getCurrentMoveReference } from "../../core/championsMoves.js";
import { getMoveSpecialProfile } from "../../core/specialMechanics.js";
import RoomSelect from "../Shared/RoomSelect.jsx";
import { battleMovePresentation } from "../../core/battleMovePresentation.js";

const headings={mega:"Mega EvoluÃ§Ã£o",tera:"TerastalizaÃ§Ã£o",dyna:"Dynamax",gmax:"Gigantamax",eternamax:"Eternamax"};
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
        })).then(entries=>{if(current)setZDetails(Object.¶»§q«^