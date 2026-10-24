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
        <p>Para uma chance de 3 em 16, use um dado de 16 faces: 1, 2 ou 3 ativam o efeito. Sem esse dado, numere 16 papéis iguais, dobre-os da mesma maneira, misture e tire um sem olhar. Devolva o papel e misture de novo antes de outra tentativa. Isso serve para qualquer razão de inteiros positivos: o número de resultados favoráveis é a primeira parte; o total de papéis é a segunda.</p>
        <p>Para um efeito de HP, aplique primeiro a parte inteira e sorteie somente a sobra, uma vez por aplicação. Um resultado de 0 não cura a condição nem guarda uma dívida para depois. Isso é uma adaptação do RPG, descrita na regra 6.2.</p>
    </section>;
}
