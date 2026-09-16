import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_ROLL_LIMIT, LOCAL_ROLL_PREFIX, localRollEvent, localRollOdds, localRollSpec, localRollText, mergeLocalRolls, performLocalRoll, readLocalRolls, saveLocalRoll } from "../src/core/localRolls.js";
import { rollAttributeTest } from "../src/core/rpgRules.js";

class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key,value) { this.data.set(key,String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const options = { id:"local-test", createdAt:1720000000000 };
const faces = (values, sides=6) => {
  let cursor=0;
  return () => {
    assert.ok(cursor<values.length,"unexpected extra entropy draw");
    return (values[cursor++]-0.5)/sides;
  };
};

test("local receipts retain exact raw and kept dice, modifiers and strict target ties", () => {
  const input={kind:"attribute",mode:"advantage",attribute:3,opposition:15,label:"Investigar"};
  const roll=performLocalRoll(input,{...options,random:faces([6,1,6])});
  assert.deepEqual(roll.values,[6,1,6]);
  assert.deepEqual(roll.kept,[6,6]);
  assert.equal(roll.total,15);
  assert.equal(roll.critical,true);
  assert.equal(roll.success,false);
  assert.equal(roll.margin,0);
  input.attribute=90;
  assert.equal(roll.spec.attribute,3);
  assert.ok(Object.isFrozen(roll) && Object.isFrozen(roll.spec) && Object.isFrozen(roll.values) && Object.isFrozen(roll.kept));
  const lower=performLocalRoll({mode:"disadvantage",attribute:-2},{...options,random:faces([5,2,2])});
  assert.deepEqual(lower.kept,[2,2]);
  assert.equal(lower.total,2);
  assert.equal(lower.success,null);
});

test("critical failure consumes one suggestion draw and keeps it for every display and export", () => {
  let draws=0;
  const roll=performLocalRoll({}, {...options,random:()=>{draws++;return 0;}});
  assert.equal(draws,3);
  assert.equal(roll.fumble,true);
  assert.ok(roll.suggestion);
  assert.equal(localRollText(roll),localRollText(roll));
  localRollEvent(roll);
  assert.equal(draws,3,"rendering and forwarding never reroll dice or the suggestion");
});

test("percent dice include 1 and 100 and preserve exact 0%, 100%, advantage and disadvantage", () => {
  const zero=performLocalRoll({kind:"percent",chance:0},{...options,random:faces([1],100)});
  assert.equal(zero.total,1);assert.equal(zero.success,false);
  const full=performLocalRoll({kind:"percent",chance:100},{...options,random:faces([100],100)});
  assert.equal(full.total,100);assert.equal(full.success,true);
  for(const [mode,total,success] of [["advantage",23,true],["disadvantage",87,false]]) {
    const record=performLocalRoll({kind:"percent",mode,chance:50},{...options,random:faces([87,23],100)});
    assert.equal(record.total,total);assert.equal(record.success,success);assert.deepEqual(record.values,[87,23]);
  }
});

test("free dice support every offered die, twenty independent draws and signed modifiers", () => {
  for(const sides of [4,6,8,10,12,20,100]) {
    const record=performLocalRoll({kind:"free",quantity:2,sides,modifier:-3},{...options,random:faces([1,sides],sides)});
    assert.deepEqual(record.values,[1,sides]);assert.equal(record.total,sides-2);
    assert.match(localRollText(record),/ − 3 = /);
    assert.equal(record.success,null);
  }
  const record=performLocalRoll({kind:"free",quantity:20,sides:20,modifier:7},{...options,random:faces(Array(20).fill(20),20)});
  assert.equal(record.total,407);assert.equal(record.values.length,20);
  assert.deepEqual(localRollOdds({kind:"free",quantity:20,sides:20,modifier:7}),{minimum:27,maximum:407});
});

test("invalid input is rejected before consuming entropy or silently clamping a request", () => {
  const invalid=[{attribute:""},{attribute:1.5},{attribute:Infinity},{attribute:true},{attribute:[]},{mode:"constructor"},{kind:"other"},{kind:"percent",chance:-1},{kind:"percent",chance:101},{kind:"free",quantity:0},{kind:"free",quantity:21},{kind:"free",sides:7},{opposition:"invalid"}];
  for(const input of invalid) assert.throws(()=>performLocalRoll(input,{...options,random:()=>{assert.fail("invalid request consumed entropy");}}),RangeError);
  assert.equal(localRollSpec({attribute:"-2",opposition:""}).attribute,-2);
  assert.equal(localRollSpec({attribute:"-2",opposition:""}).opposition,null);
});

test("exact odds agree with every 2d6 and 3d6 engine outcome without drawing random values", () => {
  for(const mode of ["normal","advantage","disadvantage"]) {
    let total=0,success=0,critical=0,fumble=0;
    for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) for(let c=1;c<=(mode==="normal"?1:6);c++) {
      const r=rollAttributeTest({mode,attribute:2,opposition:9,random:faces(mode==="normal"?[a,b]:[a,b,c])});
      total++;success+=Number(r.success);critical+=Number(r.critical);fumble+=Number(r.fumble);
    }
    assert.deepEqual(localRollOdds({mode,attribute:2,opposition:9}),{success:success/total,critical:critical/total,fumble:fumble/total});
  }
  assert.equal(localRollOdds({}).critical,1/36);
  assert.equal(localRollOdds({mode:"advantage"}).critical,16/216);
  assert.equal(localRollOdds({mode:"disadvantage"}).fumble,16/216);
  assert.equal(localRollOdds({kind:"percent",mode:"advantage",chance:50}).success,.75);
  assert.equal(localRollOdds({kind:"percent",mode:"disadvantage",chance:50}).success,.25);
});

test("separate tab receipts persist independently, deduplicate by identity and refuse replacement", () => {
  const storage=new MemoryStorage();
  const a=performLocalRoll({kind:"percent"},{...options,id:"tab-a",random:faces([50],100)});
  const b=performLocalRoll({kind:"percent"},{...options,id:"tab-b",createdAt:options.createdAt+1,random:faces([80],100)});
  assert.equal(saveLocalRoll(a,storage),true);assert.equal(saveLocalRoll(b,storage),true);assert.equal(saveLocalRoll(a,storage),true);
  assert.deepEqual(readLocalRolls(storage).map(r=>r.id),["tab-b","tab-a"]);
  assert.equal(mergeLocalRolls([a],[a,b]).length,2);
  const fake=performLocalRoll({kind:"percent"},{...options,id:"tab-a",random:faces([99],100)});
  assert.equal(saveLocalRoll(fake,storage),false);
  assert.equal(readLocalRolls(storage).find(r=>r.id==="tab-a").total,50);
});

test("history preserves legacy guide records and ignores corrupt arithmetic and invalid timestamps", () => {
  const storage=new MemoryStorage();
  storage.setItem("myowndex_guide_roll_history_v1",JSON.stringify([{id:"legacy",values:[3,4],result:7,label:"Anterior",createdAt:1,detail:"3 + 4"}]));
  const roll=performLocalRoll({opposition:7},{...options,random:faces([3,4])});
  assert.equal(saveLocalRoll(roll,storage),true);
  storage.setItem(LOCAL_ROLL_PREFIX+"broken","{broken");
  storage.setItem(LOCAL_ROLL_PREFIX+"arithmetic",JSON.stringify({...roll,id:"arithmetic",total:999}));
  storage.setItem(LOCAL_ROLL_PREFIX+"time",JSON.stringify({...roll,id:"time",createdAt:9000000000000000}));
  const records=readLocalRolls(storage);
  assert.equal(records.length,2);assert.equal(records[1].legacy,true);assert.equal(records[1].total,7);
  assert.equal(records[0].margin,0);assert.ok(Object.isFrozen(records[0]));
  assert.match(localRollText(records[1]),/Anterior/);
});

test("storage quota failures retain the already completed receipt and never consume more entropy", () => {
  const storage=new MemoryStorage();storage.setItem=()=>{throw new Error("QuotaExceededError");};
  const record=performLocalRoll({}, {...options,random:faces([3,5])});
  assert.equal(saveLocalRoll(record,storage),false);assert.equal(record.total,8);
  assert.equal(saveLocalRoll(record,null),false);assert.deepEqual(readLocalRolls(null),[]);
  assert.match(localRollText(record),/3 \+ 5 = 8/);
});

test("history retains the newest hundred and exports full original parameters and local context", () => {
  const storage=new MemoryStorage();
  for(let i=0;i<105;i++) {
    const roll=performLocalRoll({kind:"percent",mode:"advantage",chance:65,label:"Capturar"},{...options,id:`entry-${i}`,createdAt:options.createdAt+i,context:"aventura",random:faces([70,30],100)});
    assert.equal(saveLocalRoll(roll,storage),true);
  }
  const records=readLocalRolls(storage);
  assert.equal(records.length,LOCAL_ROLL_LIMIT);assert.equal(storage.length,100);assert.equal(records.at(-1).id,"entry-5");
  assert.match(localRollText(records[0]),/Capturar · d100 · Vantagem/);
  assert.match(localRollText(records[0]),/chance 65% · Sucesso/);
  assert.match(localRollText(records[0]),/aventura · Rolagem local/);
  const event=localRollEvent(records[0]);assert.deepEqual(event.rolls,[70,30]);assert.equal(event.result,30);
});
