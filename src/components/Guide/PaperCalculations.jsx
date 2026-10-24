import { countTrainerOutcomes } from '../../core/guideMath.js';

export default function PaperCalculations() {
    return <section aria-label="Contas para jogar sem aplicativo" className="guide-paper-calculations">
        <h3>Entender a dificuldade de um teste do Treinador</h3>
        <p>Dois dados de seis faces têm 36 pares possíveis, todos com a mesma chance. O total precisa superar a dificuldade; empatar não basta. Não use esta tabela para uma disputa entre atributos de Pokémon.</p>
        <table><caption>Teste normal de 2d6, conforme a regra 8.5</caption><thead><tr><th scope="col">Dificuldade</th><th scope="col">Totais que passam</th><th scope="col">Pares que passam</th></tr></thead><tbody>{[5,7,9].map(value=>{
            const outcome=countTrainerOutcomes(value);
            return <tr key={value}><th scope="row">{value}</th><td>{value+1} a 12</td><td>{outcome.successes} de {outcome.total}</td></tr>;
        })}</tbody></table>
        <p>Uma dificuldade maior é uma escolha de desafio, não uma punição por tentar uma boa ideia. Combine o risco antes dos dados. Para uma tarefa possível sem risco nem custo, siga a regra 8.8 e resolva pela história.</p>
        <h3>Sortear uma parte sem arredondar a chance</h3>
        <p>No caso conferido da regra 6.2, Pikachu está envenenado e tem 3 HP máximos no RPG. O Poison vale um oitavo desse máximo. Role um dado de oito faces: com 1, 2 ou 3, ele perde 1 HP; com os demais resultados, não perde HP nessa aplicação e continua envenenado.</p>
        <p>Sem esse dado, numere oito papéis iguais, dobre-os da mesma maneira, misture e tire um sem olhar. Devolva o papel e misture antes da próxima aplicação. Os resultados possíveis são os mesmos do dado; os valores pertencem a essa ficha de Pikachu, não a todos os Pokémon.</p>
        <p>Para um efeito de HP, aplique primeiro a parte inteira e sorteie somente a sobra, uma vez por aplicação. Um resultado de 0 não cura a condição nem guarda uma dívida para depois. Isso é uma adaptação do RPG, descrita na regra 6.2.</p>
    </section>;
}
