import { RPG_RULE_SECTIONS } from './rpgRules.js';

/** One short example shared by the app, book, search and contextual help. */
export const GUIDE_PLAYER_SCENES = Object.freeze(Object.fromEntries(
    RPG_RULE_SECTIONS.flatMap(section => section.rules.map(rule => [rule.id, rule.example]))
));
