import assert from "node:assert/strict";
import test from "node:test";
import { mergeAccountDocuments, normalizeAccountDocument, recordAccountChanges } from "../src/core/accountDocument.js";
import { createRoomSnapshot } from "../src/core/room.js";
import { performLocalRoll } from "../src/core/localRolls.js";

const receipt=(id,createdAt)=>performLocalRoll({kind:"free",sides:20},{id,createdAt,random:()=>.5});
const draft={schema:1,results:[{versionGroup:"scarlet-violet",saved:false,exported:false,pokemon:{id:"generated",species:{name:"bulbasaur"},level:10}}]};

test("deleting one account roll keeps other original and independently generated results without stale resurrection",()=>{
    const original=receipt("removed",10),retained=receipt("retained",20),newReceipt=receipt("new-elsewhere",30);
    const base=recordAccountChanges(normalizeAccountDocument(),{localTools:{rollHistory:[retained,original]}},30);
    const local=recordAccountChanges(base,{localTools:{rollHistory:[retained]}},40);
    const remote=recordAccountChanges(base,{localTools:{rollHistory:[newReceipt,retained,original]}},50);
    const merged=mergeAccountDocuments(local,remote,base).document;
    assert.deepEqual(merged.localTools.rollHistory.map(roll=>roll.id),[newReceipt.id,retained.id]);
    assert.ok(merged.tombstones.localRolls[original.id]);
    assert.deepEqual(mergeAccountDocuments(merged,remote).document.localTools.rollHistory.map(roll=>roll.id),[newReceipt.id,retained.id]);
    assert.equal(merged.localTools.rollHistory[1].total,retained.total);
});

test("explicit preview and field clears propagate while preserving account Boxes and roll receipts",()=>{
    const field={...createRoomSnapshot("Campo de testes"),tokens:[{id:"field-partner",name:"Bulbasaur",currentHp:4,maxHp:5,side:"ally",moves:[]}]};
    const roll=receipt("preserved-roll",10);
    const base=recordAccountChanges(normalizeAccountDocument(),{boxes:[{id:"box",shareId:"box",name:"Box preservada",updatedAt:10,pokemon:[draft.results[0].pokemon]}],localTools:{generatorDraft:draft,diceRoom:field,rollHistory:[roll]}},20);
    const local=recordAccountChanges(base,{localTools:{generatorDraft:{schema:1,results:[]},diceRoom:createRoomSnapshot("Campo de testes")}},30);
    assert.equal(local.localTools.generatorDraft,null,"empty preview is an explicit normalized clear");
    assert.ok(local.clocks["localTools.generatorDraft"]>base.clocks["localTools.generatorDraft"]);
    const merged=mergeAccountDocuments(local,base,base).document;
    assert.equal(merged.localTools.generatorDraft,null);
    assert.deepEqual(merged.localTools.diceRoom.tokens,[]);
    assert.equal(merged.boxes[0].pokemon[0].id,"generated");
    assert.equal(merged.localTools.rollHistory[0].id,roll.id);
    assert.equal(mergeAccountDocuments(merged,base).document.localTools.generatorDraft,null,"stale cloud preview must not reappear");
});
