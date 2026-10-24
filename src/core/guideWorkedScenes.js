import { GUIDE_WORKED_SCENES_1_2 } from "./guideWorkedScenes12.js";
import { GUIDE_WORKED_SCENES_3_4 } from "./guideWorkedScenes34.js";
import { GUIDE_WORKED_SCENES_5_6 } from "./guideWorkedScenes56.js";
import { GUIDE_WORKED_SCENES_7 } from "./guideWorkedScenes7.js";
import { GUIDE_WORKED_SCENES_8 } from "./guideWorkedScenes8.js";

/** Exemplo integral, acessível em papel e no Guia, para cada uma das 50 regras.
 * Todos seguem o mesmo roteiro editorial: gatilho, cena, execução, resultado e fundamento.
 */
export const GUIDE_WORKED_SCENES = Object.freeze({
    ...GUIDE_WORKED_SCENES_1_2,
    ...GUIDE_WORKED_SCENES_3_4,
    ...GUIDE_WORKED_SCENES_5_6,
    ...GUIDE_WORKED_SCENES_7,
    ...GUIDE_WORKED_SCENES_8,
    "3.8": {
        quando: "Quando a luta acaba por vitória, captura, acordo ou retirada, depois das oportunidades de agir e dos efeitos finais da rodada.",
        cena: "Pikachu e Eevee participam de um resgate. Ao alcançar o objetivo, o grupo decide que o confronto terminou; Pikachu ainda está ferido e gastou PP durante a luta.",
        como: [
            "Conclua a rodada que estava em andamento, com as oportunidades de agir e efeitos finais devidos. O fim da história do confronto não autoriza apagar um resultado já resolvido.",
            "Encerre o confronto e os estados temporários de batalha. Confira HP, PP, condições persistentes e itens: esses recursos não voltam só porque a batalha terminou.",
            "Anote a conquista e conceda a recompensa uma vez. Agora o grupo pode resolver crescimento e buscar um descanso permitido, sem reiniciar a mesma batalha para renovar proteções."
        ],
        resultado: "A aventura continua com os mesmos parceiros e as consequências reais da luta. Outro confronto começa sem curar ferimentos nem devolver itens consumidos.",
        porQue: "Separar fim de rodada, fim de batalha e recuperação permite continuar a história sem usar mudanças de fase como uma reposição gratuita de recursos."
    },
    "4.5": {
        quando: "Quando o grupo investiga um lugar, procura pistas ou escolhe um caminho. A descoberta pode acontecer com ou sem teste, conforme a incerteza e o risco.",
        cena: "Eevee percebe pegadas perto de uma trilha alagada. Sua Treinadora examina o lugar e pergunta para onde seguem antes que a chuva apague as marcas.",
        como: [
            "O Narrador conta o que está visível e responde às perguntas pertinentes. A Treinadora e Eevee escolhem um objetivo sem testar repetidamente informações evidentes.",
            "Se a chuva tornar a busca incerta e houver consequência, combinem teste e risco antes dos dados. Usem as capacidades pertinentes, sem inventar um movimento para Eevee.",
            "Descrevam o resultado e o que mudou no lugar. Uma falha pode custar o tempo combinado e levar a outro caminho ou pedido de ajuda; ela não deve encerrar a aventura por falta de uma única pista."
        ],
        resultado: "O grupo encontra uma direção ou enfrenta a consequência anunciada e escolhe outra abordagem. A exploração avança sem precisar inventar uma batalha.",
        porQue: "Perguntas e capacidades dos parceiros devem produzir escolhas. Dados resolvem riscos importantes, enquanto informações claras ajudam a equipe a decidir como continuar."
    },
});
