import { CONDITION_HELP } from '../../core/conditionHelp.js';

/** Short, identical help next to each condition control. */
export default function ConditionHelp({ status = '', named = false, query = '' }) {
    const condition = CONDITION_HELP[status];
    if (!condition || !status) return null;
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const match = Boolean(query.trim()) && normalize(Object.values(condition).join(' ')).includes(normalize(query));
    return <details className="condition-help" data-condition={status || 'none'} open={match}>
        <summary>{named ? condition.label : `Entender: ${condition.label}`}</summary>
        <div className="condition-help-content">
            <p>{condition.what}</p>
            <p><strong>Quando acontece?</strong> {condition.when}</p>
            <p><strong>Como termina?</strong> {condition.ends}</p>
            {condition.note && <p>{condition.note}</p>}
        </div>
    </details>;
}
