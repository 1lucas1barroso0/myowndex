import { RPG_RULE_SECTIONS } from "../../../src/core/rpgRules.js";
import { GUIDE_PAPER_STEPS } from "../../../src/core/guidePaperSteps.js";
import { GUIDE_AUDIT_CASES } from "../../../src/data/guide-audit-cases.js";
import PrintBookButton from "./PrintBookButton.jsx";
import "./livro.css";

export const metadata = {
    title: "Livro de regras | MyOwnDex",
    description: "As 48 regras do RPG Pokémon do MyOwnDex, com procedimentos, exemplos e exceções para jogar sem aplicativo.",
};

const count = RPG_RULE_SECTIONS.reduce((total, section) => total + section.rules.length, 0);

function RuleBookEntry({ rule }) {
    const audit = rule.auditCase && GUIDE_AUDIT_CASES[rule.auditCase];
    return <article id={`regra-${rule.id.replace(".", "-")}`} className="book-rule">
        <h3><span>{rule.id}</span> {rule.title}</h3>
        {rule.plain && <p className="book-rule-lead">{rule.plain}</p>}
        <section className="book-procedure" aria-label={`Como aplicar a regra ${rule.id} sem aplicativo`}>
            <h4>Como resolver na mesa</h4>
            <ol>{GUIDE_PAPER_STEPS[rule.id].map(step => <li key={step}>{step}</li>)}</ol>
        </section>
        <section className="book-canonical">
            <h4>Regra completa e exceções</h4>
            {rule.body?.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {rule.bullets?.length > 0 && <ul>{rule.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
        </section>
        {rule.example && <p className="book-example"><strong>Exemplo com Pokémon:</strong> {rule.example}</p>}
        {audit && <aside className="book-audit" aria-label="Resultado reproduzido da regra">
            <h4>Um caso conferido</h4>
            <p><strong>{audit.title}.</strong> {audit.reference}.</p>
            {audit.intro && <p>{audit.intro}</p>}
            <p>{audit.setup}</p>
            <dl>{audit.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === "poison" ? "Envenenado" : value}</dd></div>)}</dl>
            <p className="book-footnote">Estes valores pertencem à situação identificada acima. Não são números universais para qualquer Pokémon.</p>
        </aside>}
    </article>;
}

export default function LivroDeRegras() {
    return <main className="book-reader">
        <div className="book-toolbar"><a href="/">Voltar ao MyOwnDex</a><PrintBookButton /></div>
        <header className="book-cover">
            <p className="book-eyebrow">MyOwnDex · RPG de aventura Pokémon</p>
            <h1>Livro de regras</h1>
            <p className="book-subtitle">{count} regras para ler, consultar e jogar com papel e dados.</p>
            <p>O livro explica as decisões, os testes, os resultados e as exceções. O aplicativo pode facilitar os cálculos e guardar os acontecimentos, mas não é obrigatório para seguir o procedimento de cada regra.</p>
            <p>Este RPG é uma adaptação de fãs, não um conjunto de regras oficial de Pokémon. Espécies, movimentos, formas, itens e habilidades continuam respeitando a referência dos jogos, salvo quando uma regra do RPG indicar uma adaptação.</p>
        </header>
        <section className="book-start" aria-labelledby="book-start-title">
            <h2 id="book-start-title">Preparar a mesa</h2>
            <p>Tenha dados de seis faces, um modo de sortear números de 1 a 100, fichas dos Pokémon com atributos originais, movimentos e PP, papel para anotar HP, condições, recursos e as decisões do grupo. Uma pessoa apresenta a história como Narrador.</p>
            <p><strong>HP</strong> são pontos de vida; <strong>PP</strong> são os usos de cada movimento; <strong>XP</strong> é a experiência. O <strong>turno</strong> é a vez de um Pokémon; a <strong>rodada</strong> termina depois de todos concluírem suas vezes.</p>
            <h3>O ciclo básico de uma cena</h3>
            <ol>
                <li>Conte o que o Treinador ou Pokémon quer alcançar. Defina o alvo, as condições e o risco.</li>
                <li>Quando a resposta for incerta e importante, use a regra correspondente e faça o teste com os dados.</li>
                <li>Aplique as consequências uma vez: HP, PP, condição, posição, item ou história.</li>
                <li>Em combate, siga a iniciativa e encerre a rodada depois que todos tiverem sua vez.</li>
            </ol>
            <p>Para chances fracionárias que não cabem num dado de cem faces, sorteie partes de tamanho igual. Por exemplo, uma chance de 1 em 8 pode ser resolvida com um dado de oito faces: apenas o resultado 1 ativa o efeito. Não transforme uma probabilidade exata numa porcentagem aproximada sem combinar isso com o grupo.</p>
        </section>
        <nav aria-label="Sumário do livro" className="book-contents">
            <h2>Sumário</h2>
            <ol>{RPG_RULE_SECTIONS.map(section => <li key={section.id}><a href={`#secao-${section.number}`}>{section.number}. {section.title}</a></li>)}</ol>
        </nav>
        {RPG_RULE_SECTIONS.map(section => <section className="book-chapter" key={section.id} id={`secao-${section.number}`} aria-labelledby={`titulo-secao-${section.number}`}>
            <header className="book-chapter-header">
                <h2 id={`titulo-secao-${section.number}`}>{section.number}. {section.title}</h2>
                <p>{section.summary}</p>
            </header>
            {section.rules.map(rule => <RuleBookEntry key={rule.id} rule={rule} />)}
        </section>)}
        <footer className="book-end"><p>Fim das {count} regras. Quando alguma situação exigir um efeito especial da espécie, movimento, habilidade ou item, use a descrição correspondente da ficha do jogo escolhido. Anote toda decisão diferente antes de rolar.</p><p>MyOwnDex · Guia para uso pessoal e impressão.</p></footer>
    </main>;
}
