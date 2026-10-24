// Reproducible game situations, using the same public functions as the PC,
// battle, capture and rest assistants. No real account or adventure is touched.
import { createTokenFromPokemon, createRoomSnapshot, normalizeRoomSnapshot, applyEndOfRoundEffects } from './room.js';
import { resolveCombatAction, resolveCaptureAction } from '../../server/authoritativeActions.js';
import { captureTrainerKey } from './capture.js';
import { applyGimmick, endGimmick } from './battleGimmicks.js';
import { getChallengeReward, applyPokemonExperienceAward } from './experience.js';
import { restPokemon, resolveGroupOutcome, advanceChase } from './adventureRules.js';
import { rollLocalPokemonOpposition } from './localPokemonRolls.js';
import { checkActionConditions } from './battleConditions.js';

const keys = ['hp','attack','defense','special-attack','special-defense','speed'];
const species = {
    pikachu: [25,[35,55,40,50,50,90],['electric'],'static',['thunder-shock','quick-attack']],
    eevee: [133,[55,55,50,45,65,55],['normal'],'run-away',['tackle','sand-attack']],
    ekans: [23,[35,60,44,40,54,55],['poison'],'shed-skin',['poison-sting']],
    pidgey: [16,[40,45,40,35,35,56],['normal','flying'],'keen-eye',['tackle']],
    geodude: [74,[40,80,100,30,30,20],['rock','ground'],'rock-head',['tackle','defense-curl']],
    umbreon: [197,[95,65,110,60,130,65],['dark'],'synchronize',['toxic']],
};
export function guidePokemon(name, level = 5) {
    const [id,stats,types,ability,moves] = species[name];
    return {id:`guide-${name}`,level,nature:'hardy',ability,moves,
        friendship:70,evs:Object.fromEntries(keys.map(k=>[k,0])),ivs:Object.fromEntries(keys.map(k=>[k,31])),
        canDynamax:true,dynamaxLevel:10,rpg:{scaleVersion:3,xp:0,pp:name==='pikachu'?[30,30]:name==='eevee'?[35,15]:name==='umbreon'?[10]:[35]},
        species:{id,name,stats:stats.map((base_stat,i)=>({base_stat,stat:{name:keys[i]}})),types:types.map(name=>({type:{name}}))},
    };
}
const token = (name,level=5,side='ally') => ({...createTokenFromPokemon(guidePokemon(name,level),{id:`guide-${name}`,versionGroup:name==='pidgey'?'firered-leafgreen':'scarlet-violet'},0,side),id:name});
const poisonedMove = {name:'poison-sting',power:15,accuracy:100,pp:35,priority:0,type:{name:'poison'},damage_class:{name:'physical'},target:{name:'selected-pokemon'},stat_changes:[],meta:{ailment:{name:'poison'},ailment_chance:30,category:{name:'damage+ailment'}}};
const shockMove = {...poisonedMove,name:'thunder-shock',power:40,pp:30,type:{name:'electric'},damage_class:{name:'special'},meta:{ailment:{name:'paralysis'},ailment_chance:10,category:{name:'damage+ailment'}}};
const tackleMove = {...poisonedMove,name:'tackle',power:40,pp:35,type:{name:'normal'},meta:{ailment:{name:'none'},ailment_chance:0,category:{name:'damage'}}};
const hp = p => `${p.currentHp} de ${p.maxHp} HP`;
const trace = (values, fallback=0) => {let i=0;return ()=>values[i++]??fallback;};

export function reproduceGuideCases() {
    const pika=token('pikachu'),ekans=token('ekans',5,'opponent');
    const scene=normalizeRoomSnapshot({...createRoomSnapshot('Caso conferido: Ekans e Pikachu'),phase:'batalha',tokens:[ekans,pika]});
    const poisoned=resolveCombatAction({snapshot:scene,role:'narrator',request:{attackerId:'ekans',defenderId:'pikachu',moveName:'poison-sting',mode:'normal'},move:poisonedMove,random:trace([.8,.6,0,.2])});
    const hurt=poisoned.nextSnapshot.tokens.find(p=>p.id==='pikachu');
    if(hurt.status!=='poison')throw Error('O caso de Poison Sting não causou veneno.');
    const quiet=applyEndOfRoundEffects(poisoned.nextSnapshot,()=>.999999).room.tokens.find(p=>p.id==='pikachu');
    const affected=applyEndOfRoundEffects(poisoned.nextSnapshot,()=>0).room.tokens.find(p=>p.id==='pikachu');
    const comparisonPikachu = token('pikachu',100);
    const umbreon = {...token('umbreon',100,'opponent'),versionGroup:'heartgold-soulsilver'};
    const toxicMove = {...poisonedMove,name:'toxic',power:null,pp:10,accuracy:85,damage_class:{name:'status'},meta:{ailment:{name:'poison'},ailment_chance:0,category:{name:'ailment'}}};
    const toxicScene = normalizeRoomSnapshot({...createRoomSnapshot('Comparação: Poison e Badly Poisoned'),phase:'batalha',tokens:[umbreon,comparisonPikachu]});
    const toxic = resolveCombatAction({snapshot:toxicScene,role:'narrator',request:{attackerId:'umbreon',defenderId:'pikachu',moveName:'toxic',mode:'normal'},move:toxicMove,random:()=>0});
    if(toxic.nextSnapshot.tokens.find(p=>p.id==='pikachu').status!=='bad-poison')throw Error('O caso de Toxic não aplicou Badly Poisoned.');
    const ends = initial => {
        let current=initial;
        return Array.from({length:3},()=>{
            current=applyEndOfRoundEffects(current,()=>.999999).room;
            return hp(current.tokens.find(p=>p.id==='pikachu'));
        });
    };
    const poisonRounds=ends({...toxicScene,tokens:[{...comparisonPikachu,status:'poison'}]});
    const toxicRounds=ends({...toxic.nextSnapshot,tokens:toxic.nextSnapshot.tokens.filter(p=>p.id==='pikachu')});
    const eevee=guidePokemon('eevee',10);eevee.rpg.xp=4;
    const reward=getChallengeReward({baseXp:1,battle:false});
    const grown=applyPokemonExperienceAward(eevee,{xp:reward.xp,awardId:'xp_loyw3v28_00000000-0000-4000-8000-000000000219',isTTRPG:true});
    const baseMax={...token('pikachu',20),currentHp:4};
    const enlarged=applyGimmick(baseMax,'dyna').token;
    const unchanged=endGimmick(enlarged);
    const captureActor=token('eevee'),wild={...token('pidgey',5,'opponent'),currentHp:1};
    const trainerKey=captureTrainerKey(captureActor);
    const captureRoom=normalizeRoomSnapshot({...createRoomSnapshot('Caso conferido: captura de Pidgey'),phase:'batalha',battleStarted:true,initiative:['eevee','pidgey'],turnIndex:0,tokens:[captureActor,wild],trainerBags:{[trainerKey]:{'poke-ball':1}}});
    const capture=resolveCaptureAction({snapshot:captureRoom,role:'narrator',request:{action:'capture',trainerTokenId:'eevee',targetId:'pidgey',ball:'poke-ball',wildConfirmed:true},species:{capture_rate:255},random:()=>.5});
    const restScene={...createRoomSnapshot('Descanso'),phase:'intervalo',battleStarted:true,battleEnded:true};
    const rested=restPokemon({...token('eevee',20),currentHp:1},'short',restScene);
    const group=resolveGroupOutcome([{success:false,essential:true},{success:true,essential:true}]);
    const runner=token('pikachu'),bird=token('pidgey',5,'opponent');
    const race=rollLocalPokemonOpposition({snapshot:{tokens:[runner,bird]},attackerId:runner.id,defenderId:bird.id,attackerStat:'speed',defenderStat:'speed',mode:'advantage',random:trace([.8,.6,.1,.8,.6])});
    let chase={escape:0,danger:0};
    for(let attempt=0;attempt<3;attempt++){
        const contest=rollLocalPokemonOpposition({snapshot:{tokens:[runner,bird]},attackerId:runner.id,defenderId:bird.id,attackerStat:'speed',defenderStat:'speed',mode:'normal',random:trace([.8,.6,.8,.6])});
        chase=advanceChase(chase,contest.success);
    }
    const earth=token('geodude',5,'opponent');
    const immuneScene=normalizeRoomSnapshot({...createRoomSnapshot('Pikachu e Geodude'),phase:'batalha',tokens:[pika,earth]});
    const immune=resolveCombatAction({snapshot:immuneScene,role:'narrator',request:{attackerId:'pikachu',defenderId:'geodude',moveName:'thunder-shock',mode:'normal'},move:shockMove,random:trace([.8,.6,0,.2])});
    const duel=normalizeRoomSnapshot({...createRoomSnapshot('Eevee e Pikachu'),phase:'batalha',tokens:[token('eevee',20),token('pikachu',20,'opponent')]});
    const survival=resolveCombatAction({snapshot:duel,role:'narrator',request:{attackerId:'eevee',defenderId:'pikachu',moveName:'tackle',mode:'normal'},move:tackleMove,random:trace([.999,.999,0,.2],.5)});
    const saved=survival.nextSnapshot.tokens.find(p=>p.id==='pikachu');
    const attackRoom=normalizeRoomSnapshot({...createRoomSnapshot('Pikachu e Eevee'),phase:'batalha',tokens:[token('pikachu',20),token('eevee',20,'opponent')]});
    const variations=[0,.5,.999].map(last=>resolveCombatAction({snapshot:attackRoom,role:'narrator',request:{attackerId:'pikachu',defenderId:'eevee',moveName:'thunder-shock',mode:'normal'},move:shockMove,random:trace([.8,.6,0,.2],last)}));
    let sleeping={...token('eevee'),status:'sleep'};
    const attempts=[];
    for(let n=0;n<3;n++){const check=checkActionConditions({token:sleeping,move:tackleMove,random:()=>.999});attempts.push(check.canAct?'Pode tentar Tackle':'O sono impediu Tackle');sleeping=check.token;}
    return {
        'poison-comparison':{title:'Pikachu com Poison e Pikachu atingido por Toxic',reference:'RPG; Umbreon aprende Toxic pela TM06 em HeartGold/SoulSilver',
            intro:'São duas sequências separadas, começando com o mesmo Pikachu com HP cheio. Em cada sequência, ele fica em campo por três fins de rodada sem receber outro efeito. Não são danos fixos para outros Pokémon nem uma previsão de toda rolagem.',
            setup:`Pikachu e Umbreon de teste: nível 100, natureza Hardy, IVs 31 em todos os atributos, nenhum EV e nenhum item. Pikachu começa com ${hp(comparisonPikachu)}. Na primeira sequência, ele já tem Poison. Na segunda, Umbreon usa Toxic com sucesso; o movimento aplica Badly Poisoned sem causar dano direto. Estes sorteios do RPG escolheram a parte inteira de cada perda.`,
            rows:[['Poison · depois do primeiro fim de rodada',poisonRounds[0]],['Poison · depois do segundo fim de rodada',poisonRounds[1]],['Poison · depois do terceiro fim de rodada',poisonRounds[2]],['Badly Poisoned · depois do primeiro fim de rodada',toxicRounds[0]],['Badly Poisoned · depois do segundo fim de rodada',toxicRounds[1]],['Badly Poisoned · depois do terceiro fim de rodada',toxicRounds[2]]],
            sources:['src/core/mechanics.js:calculateStat','server/authoritativeActions.js:resolveCombatAction','src/core/room.js:applyEndOfRoundEffects']},
        scale:{title:'A ficha de Pikachu é mostrada no modo RPG',reference:'RPG; mesma ficha nos valores originais e convertidos',
            setup:'Pikachu de teste no nível 5, Hardy, IVs 31 em todos os atributos e nenhum EV. Os valores abaixo vieram da construção real da ficha.',
            rows:[['HP máximo na ficha original',String(pika.originalStats.hp)],['HP máximo no RPG',String(pika.maxHp)],['Velocidade na ficha original',String(pika.originalStats.speed)],['Velocidade exibida no RPG',String(pika.stats.speed)]],
            sources:['src/core/mechanics.js:calculateStat','src/core/room.js:createTokenFromPokemon']},
        immunity:{title:'Thunder Shock de Pikachu contra Geodude de Kanto',reference:'RPG; Geodude com os tipos Rock/Ground, sem efeito que remova sua imunidade',
            setup:'Pikachu e Geodude de Kanto de teste no nível 5, Hardy, IVs 31 e nenhum EV. Pikachu conhece Thunder Shock, tinha os PP completos e tentou o movimento.',
            rows:[['Geodude antes do movimento',hp(earth)],['Geodude depois do movimento',hp(immune.nextSnapshot.tokens.find(p=>p.id==='geodude'))],['PP de Thunder Shock antes',String(pika.pp[0])],['PP de Thunder Shock depois',String(immune.nextSnapshot.tokens.find(p=>p.id==='pikachu').pp[0])]],
            sources:['server/authoritativeActions.js:resolveCombatAction']},
        race:{title:'Pikachu tenta alcançar Pidgey com vantagem',reference:'RPG; disputa de Velocidade nos Dados',
            setup:'Pikachu e Pidgey de teste no nível 5, Hardy, IVs 31 e nenhum EV. O Narrador combinou vantagem para Pikachu antes da disputa. Os resultados de dados desta execução estão registrados abaixo.',
            rows:[['Dados rolados para Pikachu',race.attack.dice.join(', ')],['Dados mantidos para Pikachu',race.attack.kept.join(', ')],['Dados de Pidgey',race.defense.dice.join(', ')],['Quem venceu a disputa?',race.winner]],
            sources:['src/core/localPokemonRolls.js:rollLocalPokemonOpposition','src/core/rpgRules.js:rollProportionalAttributeTest']},
        survival:{title:'Eevee usa Tackle; Pikachu conserva sua chance de continuar',reference:'RPG; proteção geral disponível',
            setup:'Eevee e Pikachu de teste no nível 20, Hardy, IVs 31 e nenhum EV. Pikachu começa com HP cheio, sem item e sem ter usado a proteção. Nesta execução, Eevee venceu a disputa e o Tackle foi crítico.',
            rows:[['Pikachu antes de Tackle',hp(duel.tokens.find(p=>p.id==='pikachu'))],['Pikachu depois da ação',hp(saved)],['Proteção registrada como usada?',survival.nextSnapshot.hitKillProtectionUsed.length?'Sim':'Não']],
            sources:['server/authoritativeActions.js:resolveCombatAction','src/core/automation.js:resolveDamageSequence']},
        damage:{title:'Thunder Shock de Pikachu em Eevee',reference:'RPG; pequena variação de um ataque',
            intro:'Os resultados abaixo mostram possibilidades para o mesmo Thunder Shock. Cada uma começa com Eevee de HP cheio. Não são ataques seguidos.',
            setup:'Pikachu e Eevee de teste no nível 20, Hardy, IVs 31, nenhum EV e sem itens. As três execuções abaixo começam com Eevee saudável; são alternativas, não três ataques aplicados seguidos. Pikachu vence a disputa sem crítico.',
            rows:[...variations.map((v,i)=>[['Eevee com a variação menor','Eevee com a variação intermediária','Eevee com a variação maior'][i],hp(v.nextSnapshot.tokens.find(p=>p.id==='eevee'))]),['Na variação maior, a proteção foi usada?',variations[2].nextSnapshot.hitKillProtectionUsed.length?'Sim: Eevee conservou seu último HP.':'Não']],
            sources:['server/authoritativeActions.js:resolveCombatAction','src/core/integerRules.js:rollDamageVariation']},
        sleep:{title:'Eevee dorme quando chega sua vez de tentar Tackle',reference:'RPG; sono sem Rest, Early Bird ou movimento que permita agir dormindo',
            intro:'Aqui acompanhamos uma sequência: Eevee tenta agir quando chega sua vez. Entre uma tentativa e outra, os demais Pokémon também têm suas vezes.',
            setup:'Eevee de teste está dormindo. Cada linha representa outra vez de Eevee, depois de os demais participantes terem suas próprias vezes. Esta execução sorteou a duração maior de sono do RPG.',
            rows:attempts.map((v,i)=>[['Primeira vez de Eevee','Próxima vez de Eevee','Vez de Eevee depois dessas tentativas'][i],v]),
            sources:['src/core/battleConditions.js:checkActionConditions']},
        poison:{title:'Ekans usa Poison Sting em Pikachu',reference:'RPG; movimentos de Scarlet/Violet',
            intro:`Depois do golpe, Pikachu está com ${hp(hurt)}. A seguir, mostramos duas possibilidades para o veneno ao encerrar a rodada. São resultados alternativos; não aplique os dois na mesma rodada. Pikachu continua envenenado nos dois casos.`,
            setup:'Pikachu e Ekans de teste: nível 5, natureza Hardy, IVs 31 em todos os atributos e nenhum EV. Ekans conhece Poison Sting; Pikachu não segura item.',
            rows:[['Pikachu antes do movimento',hp(pika)],['Pikachu depois do impacto',hp(hurt)],['Condição recebida',hurt.status==='poison'?'Envenenado':hurt.status],['Uma possibilidade ao encerrar a rodada: sem perda de HP',hp(quiet)],['A condição nessa possibilidade',quiet.status==='poison'?'Envenenado':quiet.status],['Outra possibilidade ao encerrar a mesma rodada: com perda de HP',hp(affected)],['A condição nessa outra possibilidade',affected.status==='poison'?'Envenenado':affected.status]],
            sources:['src/core/mechanics.js:calculateStat','server/authoritativeActions.js:resolveCombatAction','src/core/room.js:applyEndOfRoundEffects']},
        xp:{title:'Eevee recebe a recompensa Comum',reference:'RPG; recompensa fora de batalha',
            setup:'Eevee de teste no nível 10, com 4 XP já registradas. O Narrador concluiu um desafio e escolheu Comum; esta recompensa ainda não foi entregue.',
            rows:[['Botão escolhido','Comum'],['XP concedida',String(reward.xp)],['Nível de Eevee depois da recompensa',String(grown.level)],['XP que ficou guardada',String(grown.rpg.xp)],['EVs disponíveis para treinar',String(grown.rpg.pendingEvs)]],
            sources:['src/core/experience.js:getChallengeReward','src/core/experience.js:applyPokemonExperienceAward']},
        max:{title:'Pikachu usa Dynamax e volta sem receber outro efeito',reference:'RPG; transformação de Sword/Shield permitida pelo Narrador',
            intro:'Acompanhe o mesmo Pikachu antes, durante e depois de Dynamax. Neste caso, ele não recebe dano nem cura enquanto está gigante. O HP temporário acaba quando volta ao normal.',
            setup:'Pikachu de teste no nível 20, natureza Hardy, IVs 31, nenhum EV e nível Dynamax 10. Já perdeu HP antes de se transformar.',
            rows:[['Antes de Dynamax',hp(baseMax)],['Durante Dynamax',hp(enlarged)],['Ao voltar, sem dano nem cura entre as formas',hp(unchanged)]],
            sources:['src/core/room.js:createTokenFromPokemon','src/core/battleGimmicks.js:applyGimmick','src/core/battleGimmicks.js:endGimmick']},
        capture:{title:'O Treinador de Eevee tenta capturar Pidgey',reference:'RPG; Pidgey de Kanto, referência FireRed/LeafGreen',
            setup:'Pidgey de teste no nível 5, Hardy, IVs 31 e nenhum EV, com HP perdido e sem condição. É selvagem e pode ser capturado. O Treinador registrou uma Poké Ball na bolsa.',
            rows:[['HP do Pidgey selvagem',hp(wild)],['Chance mostrada pelo assistente',`${capture.result.chance}%`],['Resultado do d100 registrado',String(capture.result.result)],['A tentativa funcionou?',capture.result.success?'Sim':'Não'],['Poké Balls restantes na bolsa',String(capture.nextSnapshot.trainerBags[trainerKey]['poke-ball'])]],
            sources:['server/authoritativeActions.js:resolveCaptureAction','src/core/capture.js:calculateCaptureChance']},
        rest:{title:'Eevee faz um descanso curto',reference:'RPG; batalha encerrada e lugar seguro',
            setup:'Eevee de teste no nível 20, Hardy, IVs 31, nenhum EV, consciente e sem ter usado descanso curto desde o último descanso completo.',
            rows:[['Antes da pausa',`1 de ${rested.maxHp} HP`],['Depois da pausa',hp(rested)],['Outra pausa curta já está disponível?',rested.shortRestUsed?'Não':'Sim']],
            sources:['src/core/adventureRules.js:restPokemon']},
        group:{title:'Bulbasaur não segura a corda; Machop firma a tábua',reference:'RPG; tarefas combinadas como indispensáveis',
            setup:'Fora de batalha. O grupo combinou que tanto a corda quanto a tábua precisam ficar firmes. Bulbasaur falhou e Machop conseguiu fazer sua parte.',
            rows:[['A travessia foi concluída?',group.success?'Sim':'Não'],['Avanços do perigo combinado',String(group.riskSteps)]],
            sources:['src/core/adventureRules.js:resolveGroupOutcome']},
        chase:{title:'Pikachu consegue abrir distância de Pidgey',reference:'RPG; perseguição longa com a saída combinada',
            setup:'O grupo escolheu uma perseguição longa. Pikachu venceu as três disputas principais consecutivas, sem falha entre elas.',
            rows:[['Marcador Fuga depois dessas disputas',String(chase.escape)],['Marcador Perigo',String(chase.danger)],['Conclusão','Pikachu alcançou a saída combinada.']],
            sources:['src/core/adventureRules.js:advanceChase']},
    };
}
