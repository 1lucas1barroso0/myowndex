import assert from "node:assert/strict";
import test from "node:test";
import { createRoomSnapshot } from "../src/core/room.js";
import { flushLocalPokemonDiceWrites, LOCAL_DICE_ROOM_KEY, localOpposedAttribute, normalizeLocalDiceRoom, registerLocalPokemonDiceWrites, rollLocalPokemonOpposition } from "../src/core/localPokemonRolls.js";
import { createPokemonRollReceipt, localRollText, normalizeLocalRollHistory, normalizeLocalRollReceipt } from "../src/core/localRolls.js";
import { createScheduledSave } from "../src/core/scheduledSave.js";
import { getStorageScope, readDurableStorage, setStorageScope, writeDurableStorage } from "../src/core/storage.js";

const token=(id,original=100)=>({id,name:id,maxHp:10,currentHp:10,side:id==="A"?"ally":"opponent",originalStats:{attack:original,defense:original,speed:original},stats:{attack:10,defense:10,speed:10},stages:{attack:0,defense:0,speed:0},moves:[],level:20});
const snapshot=(...tokens)=>({...createRoomSnapshot(),tokens});
const faces=values=>{let index=0;return ()=>{assert.ok(index<values.length,"unexpected entropy draw");return (values[index++]-0.5)/6;};};

test("local opposition uses original proportional attributes and rolls both sides once, including strict defensive ties",()=>{
    const field=snapshot(token("A",50),token("B",100));
    const before=JSON.stringify(field);
    const result=rollLocalPokemonOpposition({snapshot:field,attackerId:"A",defenderId:"B",random:faces([6,6,3,3])});
    assert.equal(result.attack.total,600);assert.equal(result.defense.total,600);assert.equal(result.success,false);
    assert.equal(result.winner,"B");assert.match(result.detail,/Empate/);assert.doesNotMatch(result.detail,/600|multiplic|ponderad/);
    assert.equal(JSON.stringify(field),before,"testing never changes a Box, HP or scene");
});

test("local opposition stages originals once and never reapplies stages to reconstructed current stats",()=>{
    const original={...token("A",100),stages:{attack:2}};
    assert.equal(localOpposedAttribute(original,"attack",snapshot(original)),200);
    const fallback={...token("A"),originalStats:{},stats:{attack:20},stages:{attack:2}};
    assert.equal(localOpposedAttribute(fallback,"attack",snapshot(fallback)),200);
    assert.equal(localOpposedAttribute({...token("A"),originalStats:{attack:0}},"attack",snapshot()),1);
});

test("local speed opposition includes weather abilities, held items and conditions with directional integer rounding",()=>{
    const swimmer={...token("A",101),ability:"swift-swim",item:"choice-scarf",status:"paralysis"};
    const field={...snapshot(swimmer),weather:"chuva"};
    assert.equal(localOpposedAttribute(swimmer,"speed",field),152);
    const neutral=snapshot(swimmer,{...token("B"),ability:"cloud-nine"});
    assert.equal(localOpposedAttribute(swimmer,"speed",{...neutral,weather:"chuva"}),75);
});

test("invalid or inactive local opposition is rejected before any entropy draw",()=>{
    const field=snapshot(token("A"),token("B"));
    const run=options=>rollLocalPokemonOpposition({snapshot:field,attackerId:"A",defenderId:"B",random:()=>assert.fail("invalid opposition consumed entropy"),...options});
    for(const options of [{defenderId:"A"},{attackerId:"missing"},{attackerStat:"hp"},{defenderStat:"missing"},{mode:"garbage"},{snapshot:snapshot(token("A"),{...token("B"),currentHp:0})},{snapshot:snapshot(token("A"),{...token("B"),captured:true})}])assert.throws(()=>run(options),RangeError);
});

test("practice field bounds tokens and strips private notes/audio without mutating the source",()=>{
    const field={...snapshot(...Array.from({length:40},(_,i)=>token(`partner-${i}`))),gmNotes:"private",sceneNotes:"n".repeat(1500),audio:{trackId:"audio",title:"secret",playing:true},initiative:["partner-0","partner-35"]};
    const normal=normalizeLocalDiceRoom(field);
    assert.equal(normal.tokens.length,24);assert.equal(normal.gmNotes,"");assert.equal(normal.sceneNotes.length,1200);assert.equal(normal.audio.playing,false);
    assert.deepEqual(normal.initiative,["partner-0"]);assert.equal(field.tokens.length,40);assert.equal(field.gmNotes,"private");
});

test("complete Pokémon receipts preserve raw dice and readable outcomes without saving internal weighted products",()=>{
    const record=createPokemonRollReceipt({action:"opposed",label:"Disputa",detail:"B venceu. Empate favorece a oposição.",groups:[{label:"A",values:[6,6]},{label:"B",values:[3,3]}],success:false},{id:"opposed-qa",createdAt:1720000000000});
    assert.deepEqual(normalizeLocalRollReceipt(JSON.parse(JSON.stringify(record))),record);
    assert.match(localRollText(record),/A: 6 • 6/);assert.match(localRollText(record),/B: 3 • 3/);
    assert.doesNotMatch(JSON.stringify(record),/attribute|score|damageProduct|originalStats/);
    assert.equal(normalizeLocalRollReceipt({...record,spec:{...record.spec,action:"constructor"}}),null);
});

test("aggregate migration keeps legacy, simple and Pokémon rolls, bounded to the newest hundred",()=>{
    const legacy={legacy:true,id:"legacy-qa",kind:"attribute",values:[2,5],kept:[2,5],result:7,label:"Explorar",createdAt:1700000000000,detail:"Registro anterior"};
    const records=normalizeLocalRollHistory([legacy,...Array.from({length:120},(_,i)=>createPokemonRollReceipt({action:"initiative",label:"Iniciativa",detail:"Ordem formada."},{id:`initiative-${i}`,createdAt:1700000000001+i}))]);
    assert.equal(records.length,100);assert.equal(records[0].id,"initiative-119");
    const retained=normalizeLocalRollHistory([legacy]);
    assert.equal(retained[0].legacy,true);assert.equal(retained[0].total,7);assert.match(localRollText(retained[0]),/Explorar/);
});

test("account capture finishes pending field preparation and its debounced durable save before reading a snapshot",async t=>{
    const previousWindow=globalThis.window,previousScope=getStorageScope();
    const storage=new Map();
    globalThis.window={localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)}};
    setStorageScope("pending-field-qa");
    t.after(()=>{setStorageScope(previousScope);if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
    const before=normalizeLocalDiceRoom(snapshot(token("A")));
    await writeDurableStorage(LOCAL_DICE_ROOM_KEY,before);
    const save=createScheduledSave({save:value=>writeDurableStorage(LOCAL_DICE_ROOM_KEY,value)});
    t.after(save.cancel);
    let prepare;
    const preparation=new Promise(resolve=>{prepare=resolve;}).then(()=>save.schedule(normalizeLocalDiceRoom(snapshot({...token("A"),currentHp:4}))));
    const unregister=registerLocalPokemonDiceWrites(async()=>{await preparation;return save.flush();});
    t.after(unregister);
    let completed=false;
    const capture=flushLocalPokemonDiceWrites().then(saved=>{completed=true;return saved;});
    await Promise.resolve();
    assert.equal(completed,false,"a pending action cannot be omitted from the account document");
    prepare();
    assert.equal(await capture,true);
    assert.equal((await readDurableStorage(LOCAL_DICE_ROOM_KEY)).tokens[0].currentHp,4);
    unregister();
    assert.equal(await flushLocalPokemonDiceWrites(),true);
});

test("an unsaved practice field blocks account replacement instead of reporting successful capture",async t=>{
    const unregister=registerLocalPokemonDiceWrites(()=>false);
    t.after(unregister);
    assert.equal(await flushLocalPokemonDiceWrites(),false);
    unregister();
    assert.equal(await flushLocalPokemonDiceWrites(),true);
});
