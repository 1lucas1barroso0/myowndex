import test from 'node:test';
import assert from 'node:assert/strict';
import { getGuideLevelProgress, countTrainerOutcomes, PAPER_STAT_STEPS } from '../src/core/guideMath.js';
import { RPG_RULE_SECTIONS, FUMBLE_SUGGESTIONS } from '../src/core/rpgRules.js';
import { GUIDE_WORKED_SCENES } from '../src/core/guideWorkedScenes.js';
import { GUIDE_PAPER_STEPS } from '../src/core/guidePaperSteps.js';
import { calculateStat } from '../src/core/mechanics.js';

test('all 48 rules retain unique identities, full worked scenes and paper procedures',()=>{
 const rules=RPG_RULE_SECTIONS.flatMap(s=>s.rules);
 assert.equal(rules.length,48);assert.equal(new Set(rules.map(r=>r.id)).size,48);
 for(const r of rules){
  assert.ok(r.body||r.bullets?.length,r.id);
  for(const key of ['quando','cena','resultado','porQue'])assert.ok(GUIDE_WORKED_SCENES[r.id][key].length>30,`${r.id} ${key}`);
  assert.ok(GUIDE_WORKED_SCENES[r.id].como.length>=2,r.id);
  assert.ok(GUIDE_PAPER_STEPS[r.id].length>=2,r.id);
 }
 const stats=rules.find(r=>r.id==='2.1');
 for(const step of PAPER_STAT_STEPS)assert.ok(stats.body.includes(step));
});

test('the Guide cannot offer XP beyond each mode level cap or modify an old level',()=>{
 assert.deepEqual(getGuideLevelProgress(100,'rpg'),{level:100,cap:100,requiredXp:null});
 assert.equal(getGuideLevelProgress(100,'game').requiredXp,null);
 assert.equal(getGuideLevelProgress(100,'free').requiredXp,50);
 assert.equal(getGuideLevelProgress(200,'free').requiredXp,null);
 assert.equal(getGuideLevelProgress(200,'rpg').level,100);
 for(let n=1;n<100;n++)assert.equal(getGuideLevelProgress(n).requiredXp,Math.floor((n+1)/2));
});

test('strict trainer difficulties have exact, enumerated odds and sensible advantage',()=>{
 for(const [target,successes] of [[5,26],[7,15],[9,6]]){
  assert.deepEqual(countTrainerOutcomes(target),{successes,total:36});
  const adv=countTrainerOutcomes(target,'advantage');const dis=countTrainerOutcomes(target,'disadvantage');
  assert.equal(adv.total,216);assert.equal(dis.total,216);
  assert.ok(adv.successes/216>successes/36);assert.ok(dis.successes/216<successes/36);
 }
});

test('paper stat instructions preserve the official EV truncation, nature and Shedinja exception',()=>{
 // Pikachu, base HP35/Attack55, L50, IV31 and 252 EVs in each tested stat independently.
 assert.equal(calculateStat(35,252,31,50,1,true,'pikachu'),142);
 assert.equal(calculateStat(55,252,31,50,1.1,false,'pikachu'),117);
 assert.equal(calculateStat(55,3,31,50,1,false,'pikachu'),75);
 assert.equal(calculateStat(1,252,31,100,1,true,'shedinja'),1);
 assert.ok(FUMBLE_SUGGESTIONS.every(s=>!s.includes('pode custar mais PP')));
});
