/** Canonical text shared by the guide and contextual battle help. */
export default function RuleText({ rule }) {
    if (!rule) return null;
    return <>
        {rule.body?.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {rule.bullets?.length > 0 && <ul>{rule.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
    </>;
}
