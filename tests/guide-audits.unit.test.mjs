import test from 'node:test';
import assert from 'node:assert/strict';
import { reproduceGuideCases } from '../src/core/guideAuditFixtures.js';
import { GUIDE_AUDIT_CASES } from '../src/data/guide-audit-cases.js';
import { RPG_RULE_SECTIONS } from '../src/core/rpgRules.js';
import { actionChangesRoomState, normalizeAuthoritativeRequest, resolveTrainerItemAction, resolveCaptureAction, getCaptureInterventionBlockReason } from '../server/authoritativeActions.js';
import { createPokemonRollReceipt, normalizeLocalRollHistory } from '../src/core/localRolls.js';
import { createRoomSnapshot, normalizeRoomSnapshot } from '../src/core/room.js';

test('every displayed numerical guide case is reproduced by the actual game engine',()=>{
    const actual=reproduceGuideCases();
    assert.deepEqual(actual,GUIDE_AUDIT_CASES);
    assert.deepEqual(actual.poison.rows.map(row=>row[1]),['3 de 3 HP','2 de 3 HP','Envenenado','2 de 3 HP','Envenenado','1 de 3 HP']);
    assert.deepEqual(actual.max.rows.map(row=>row[1]),['4 de 6 HP','8 de 12 HP','4 de 6 HP']);
    assert.deepEqual(actual.xp.rows.map(row=>row[1]),['Comum','1','11','0','2']);
    assert.deepEqual(actual.capture.rows.map(row=>row[1]),['1 de 3 HP','77%','51','Sim','0']);
    const rules=RPG_RULE_SECTIONS.flatMap(s=>s.rules);
    for(const rule of rules){
        assert.ok(rule.steps.length>=3,rule.id);
        if(rule.auditCase)assert.ok(actual[rule.auditCase],rule.id);
        assert.doesNotMatch(rule.steps.join(' '),/19 partes em 16|3 partes em 16|Ataque original 10 contra Defesa original 60/,rule.id);
    }
});

test('a trainer item intervention shares the capture opportunity, keeps Pokémon action, and never invents healing',()=>{
    const actor={id:'pikachu',name:'Pikachu',speciesName:'pikachu',speciesId:25,side:'ally',teamId:'team',level:5,maxHp:3,currentHp:2,moves:['thunder-shock'],pp:[30],lastActionRound:0};
    const wild={...actor,id:'pidgey',name:'Pidgey',speciesName:'pidgey',speciesId:16,side:'opponent',teamId:'wild'};
    const room=normalizeRoomSnapshot({...createRoomSnapshot('Guia'),phase:'batalha',battleStarted:true,tokens:[actor,wild],initiative:['pikachu','pidgey'],turnIndex:0,trainerBags:{team:{'poke-ball':1}}});
    const request=normalizeAuthoritativeRequest({action:'trainer-item',requestId:'guide_item_request_219',expectedRevision:0,trainerTokenId:'pikachu',itemLabel:'Potion'});
    assert.equal(actionChangesRoomState(request.action),true,'shared rooms send the current revision for an item intervention');
    const recorded=resolveTrainerItemAction({request,snapshot:room,role:'narrator'});
    const receipt=createPokemonRollReceipt({action:request.action,label:'Item do Treinador',detail:recorded.result.detail,success:true},{id:'item-guide-219',createdAt:1720000000000});
    assert.deepEqual(normalizeLocalRollHistory(JSON.parse(JSON.stringify([receipt]))),[receipt],'item registration survives local history reload');
    assert.equal(recorded.nextSnapshot.tokens[0].currentHp,2);
    assert.equal(recorded.nextSnapshot.tokens[0].pp[0],30);
    assert.equal(recorded.nextSnapshot.tokens[0].lastActionRound,0);
    assert.match(getCaptureInterventionBlockReason(recorded.nextSnapshot,recorded.nextSnapshot.tokens[0]),/já usou/);
    assert.throws(()=>resolveCaptureAction({snapshot:recorded.nextSnapshot,role:'narrator',species:{capture_rate:255},request:{trainerTokenId:'pikachu',targetId:'pidgey',ball:'poke-ball',wildConfirmed:true}}),/já usou/);
    assert.throws(()=>resolveTrainerItemAction({request,snapshot:recorded.nextSnapshot,role:'narrator'}),/já usou/);
    assert.throws(()=>resolveTrainerItemAction({request,snapshot:room,role:'player'}),/Só o Narrador/);
    assert.throws(()=>resolveTrainerItemAction({request,snapshot:{...room,turnIndex:1},role:'narrator'}),/começo do turno/);
    assert.throws(()=>normalizeAuthoritativeRequest({...request,healing:99}),/não aceita/);
});
