import { integerInRange } from './math.js';

/** Same limits as Pokémon progression, without changing a stored level. */
export const getGuideLevelProgress = (level, mode = 'rpg') => {
    const cap = mode === 'free' ? 200 : 100;
    const current = integerInRange(level, 1, cap, 1);
    return { level: current, cap, requiredXp: current >= cap ? null : Math.floor((current + 1) / 2) };
};

/** Enumerate equiprobable dice, including the strict win condition of rule 8.5. */
export const countTrainerOutcomes = (difficulty, mode = 'normal') => {
    let successes = 0, total = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
        for (let c = 1; c <= (mode === 'normal' ? 1 : 6); c++) {
            const dice = mode === 'normal' ? [a,b] : [a,b,c].sort((left,right)=>left-right);
            const kept = mode === 'advantage' ? dice.slice(-2) : dice.slice(0,2);
            if (kept[0] + kept[1] > difficulty) successes++;
            total++;
        }
    }
    return { successes, total };
};

export const PAPER_STAT_STEPS = Object.freeze([
    'Separe o nível, os atributos-base da espécie e forma, os IVs, os EVs e a natureza. Atributo-base, IV e EV são valores diferentes: não use o atributo final como se fosse o atributo-base.',
    'Para cada atributo, divida seus EVs por 4 e descarte a sobra. Some esse resultado ao IV e ao dobro do atributo-base. Multiplique pelo nível, divida por 100 e descarte a sobra outra vez.',
    'Para HP, some o nível e depois 10. Shedinja é a exceção: seu HP máximo é 1. A natureza não modifica HP.',
    'Para os demais atributos, some 5. Se a natureza aumenta esse atributo, multiplique por 110 e divida por 100; se reduz, multiplique por 90 e divida por 100. Natureza neutra mantém o valor. Descarte a sobra ao final.',
    'Guarde esses atributos originais para as disputas. Só depois converta para o RPG: HP dividido por 8, os demais por 10. Arredonde ao inteiro mais próximo; na metade exata, HP sobe e outros atributos descem. O máximo de HP nunca fica abaixo de 1.',
]);
