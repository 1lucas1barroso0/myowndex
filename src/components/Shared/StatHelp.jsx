import React from "react";

/** The same first explanation in the catalogue and the editable partner sheet. */
export default function StatHelp({ className }) {
    return <details className={className}>
        <summary>Entender os atributos</summary>
        <p>A Pokédex mostra os atributos base, para comparar espécies. A ficha calcula os valores do seu parceiro com seu nível, suas características naturais e seu treinamento.</p>
        <ul>
            <li><strong>HP:</strong> energia do Pokémon. Com zero HP, ele fica fora de combate.</li>
            <li><strong>Ataque e Defesa:</strong> força e proteção em movimentos físicos, como Tackle.</li>
            <li><strong>Ataque Especial e Defesa Especial:</strong> força e proteção em movimentos especiais, como Ember.</li>
            <li><strong>Velocidade:</strong> ajuda a decidir quem age primeiro. A prioridade do movimento também conta.</li>
        </ul>
        <p>A categoria do movimento indica qual par usar. A ficha mostra essa informação junto do movimento.</p>
    </details>;
}
