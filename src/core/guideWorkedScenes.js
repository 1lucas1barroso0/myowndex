import { GUIDE_WORKED_SCENES_1_2 } from "./guideWorkedScenes12.js";
import { GUIDE_WORKED_SCENES_3_4 } from "./guideWorkedScenes34.js";
import { GUIDE_WORKED_SCENES_5_6 } from "./guideWorkedScenes56.js";
import { GUIDE_WORKED_SCENES_7 } from "./guideWorkedScenes7.js";
import { GUIDE_WORKED_SCENES_8 } from "./guideWorkedScenes8.js";

/** Exemplo integral, acessível em papel e no Guia, para cada uma das 48 regras.
 * Todos seguem o mesmo roteiro editorial: gatilho, cena, execução, resultado e fundamento.
 */
export const GUIDE_WORKED_SCENES = Object.freeze({
    ...GUIDE_WORKED_SCENES_1_2,
    ...GUIDE_WORKED_SCENES_3_4,
    ...GUIDE_WORKED_SCENES_5_6,
    ...GUIDE_WORKED_SCENES_7,
    ...GUIDE_WORKED_SCENES_8,
});
