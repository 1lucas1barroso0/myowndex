/** The same names and explanations in sheets, battles and the guide.
 * Internal condition IDs remain compatible with old saves and imports.
 */
export const CONDITION_HELP = Object.freeze({
    '': { label:'Sem condição', what:'Seu Pokémon não tem nenhuma das condições desta lista.', when:'Cada movimento, habilidade e item ainda pode ter seu próprio efeito.', ends:'Confusion (ficar confuso) e Flinch (perder a vez por um susto) são anotados à parte.' },
    burn: { label:'Burn', what:'Pode tirar vida e enfraquece os movimentos físicos.', when:'A perda de vida acontece no fim da rodada, depois das vezes dos Pokémon.', ends:'Trocar de Pokémon não cura por si só. Use um cuidado que tire a queimadura.', note:'Guts e Facade têm suas próprias regras para o dano físico.' },
    freeze: { label:'Freeze', what:'Pode impedir seu Pokémon de usar o movimento escolhido.', when:'Confira se ele descongela quando chegar sua vez. No RPG, descongela antes da terceira tentativa de agir, se não tiver descongelado antes.', ends:'Trocar de Pokémon não descongela por si só. Confira as curas e os movimentos que podem tirar o gelo.' },
    paralysis: { label:'Paralysis', what:'Diminui a Velocidade e pode impedir seu Pokémon de agir.', when:'No RPG, há 1 chance em 8 de perder a ação. Confira quando chegar a vez dele. Ela não tira vida por si só.', ends:'Trocar de Pokémon não cura por si só. Use um cuidado que tire a paralisia.', note:'Quick Feet tem sua própria regra para a Velocidade.' },
    poison: { label:'Poison', what:'Pode tirar vida. A força do veneno fica igual de uma rodada para outra.', when:'Age no fim da rodada. Na escala pequena do RPG, pode não tirar vida desta vez e continuar ativo.', ends:'Trocar de Pokémon não cura por si só. Use um cuidado que tire o veneno.' },
    'bad-poison': { label:'Badly Poisoned', what:'O veneno começa mais fraco que em Poison. Sua força aumenta a cada fim de rodada em campo, até o limite da condição.', when:'Age no fim da rodada. A força aumenta mesmo se o Pokémon não perder vida. O dano pode variar; não precisa ser maior em toda rodada.', ends:'Numa troca comum, a força volta ao início. A troca não cura por si só. Use um cuidado que tire o veneno.', note:'Poison e Badly Poisoned são duas formas de envenenamento. Um Pokémon não fica com os dois ao mesmo tempo. Habilidades e itens mantêm suas exceções.' },
    sleep: { label:'Sleep', what:'Pode impedir seu Pokémon de usar o movimento escolhido.', when:'No RPG, pode impedir uma ou duas tentativas de agir. Confira quando chegar a vez dele. Se ainda dormir, essa vez passa sem gastar os usos do movimento impedido.', ends:'Trocar não o acorda por si só nem reinicia a espera. Ele pode acordar ou receber um cuidado que tire o sono.', note:'Snore e Sleep Talk podem funcionar enquanto ele dorme. Rest e Early Bird têm regras próprias.' },
    confusion: { label:'Confusion', what:'Seu Pokémon pode se machucar em vez de usar o movimento escolhido.', when:'Confira a confusão na vez dele. Ela pode existir junto com sono, veneno ou outra condição.', ends:'Pode terminar com o tempo ou com um cuidado próprio. Trocar de Pokémon também tira a confusão.' },
    flinch: { label:'Flinch', what:'Um susto pode fazer seu Pokémon perder a vez de agir.', when:'Só impede a vez que ainda não aconteceu nesta rodada. Se ele já agiu, não perde a vez da rodada seguinte.', ends:'Termina nesta rodada. Habilidades e transformações que impedem hesitação continuam valendo.' },
});

export const MAIN_CONDITION_IDS = Object.freeze(['burn','paralysis','sleep','freeze','poison','bad-poison']);
export const RPG_STATUS_LABELS = Object.freeze(Object.fromEntries(['', ...MAIN_CONDITION_IDS].map(id=>[id,CONDITION_HELP[id].label])));

export const POISON_COMPARISON_NOTES = Object.freeze([
    'Um Pokémon não fica com os dois ao mesmo tempo. Toxic pode causar Badly Poisoned; Poison Sting pode causar Poison. O tipo Poison e a condição Poison são informações diferentes.',
    'Magic Guard pode impedir a perda de HP sem curar o veneno. Poison Heal pode recuperar HP enquanto o Pokémon está envenenado. Uma habilidade que cura ao sair, como Natural Cure, segue sua própria regra.',
]);

export const getGuideConditionIds = ruleId => ruleId === '6.1' ? MAIN_CONDITION_IDS : ruleId === '6.2' ? ['poison', 'bad-poison'] : ruleId === '6.5' ? ['confusion', 'flinch'] : [];
export const getGuideConditionText = ruleId => [
    ...getGuideConditionIds(ruleId).map(id => Object.values(CONDITION_HELP[id]).join(' ')),
    ...(ruleId === '6.2' ? POISON_COMPARISON_NOTES : []),
].join(' ');
