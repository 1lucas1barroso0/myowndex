import { RPG_RULE_SECTIONS } from "./rpgRules.js";

export const GUIDE_RULE_CONTEXTS = Object.freeze(Object.fromEntries(RPG_RULE_SECTIONS.flatMap(section => section.rules.map(rule => [rule.id, rule.context]))));
