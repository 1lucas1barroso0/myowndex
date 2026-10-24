import { CONDITION_HELP, getGuideConditionIds, POISON_COMPARISON_NOTES } from '../../core/conditionHelp.js';
import ConditionHelp from '../Shared/ConditionHelp.jsx';

export default function ConditionReference({ ruleId, query = '' }) {
    const ids = getGuideConditionIds(ruleId);
    if (!ids.length) return null;
    if (ruleId === '6.2') return <section className="guide-condition-comparison" aria-label="Poison e Badly Poisoned">
        {ids.map(id => <article key={id}>
            <h4>{CONDITION_HELP[id].label}</h4>
            <p>{CONDITION_HELP[id].what}</p>
            <p>{CONDITION_HELP[id].when}</p>
            <p>{CONDITION_HELP[id].ends}</p>
        </article>)}
        {POISON_COMPARISON_NOTES.map(note => <p key={note}>{note}</p>)}
    </section>;
    return <section className="guide-condition-reference" aria-label="Entender as condições">
        <p>Escolha um nome para entender o efeito. As explicações abaixo são as usadas no RPG; os jogos de referência podem ter durações e chances diferentes.</p>
        {ids.map(id => <ConditionHelp key={id} status={id} named query={query} />)}
    </section>;
}
