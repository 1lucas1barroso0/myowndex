import { calculateStat, convertToTTRPG, NATURES } from "./mechanics.js";
import { getPokemonSpriteSources } from "./pokemonSpriteSources.js";
import { calculateStagedStats } from "./automation.js";
import { integerInRange } from "./math.js";

const slug = value => typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : "";
const stones = [
["abomasnow","abomasite"],["absol","absolite"],["aerodactyl","aerodactylite"],["aggron","aggronite"],
["alakazam","alakazite"],["altaria","altarianite"],["ampharos","ampharosite"],["audino","audinite"],
["banette","banettite"],["beedrill","beedrillite"],["blastoise","blastoisinite"],["blaziken","blazikenite"],
["camerupt","cameruptite"],["charizard","charizardite-x"],["charizard","charizardite-y"],
["diancie","diancite"],["gallade","galladite"],["garchomp","garchompite"],
["gardevoir","gardevoirite"],["gengar","gengarite"],["glalie","glalitite"],
["gyarados","gyaradosite"],["heracross","heracronite"],["houndoom","houndoominite"],
["kangaskhan","kangaskhanite"],["latias","latiasite"],["latios","latiosite"],
["lopunny","lopunnite"],["lucario","lucarionite"],["manectric","manectite"],
["mawile","mawilite"],["medicham","medichamite"],["metagross","metagrossite"],
["mewtwo","mewtwonite-x"],["mewtwo","mewtwonite-y"],["pidgeot","pidgeotite"],
["pinsir","pinsirite"],["sableye","sablenite"],["salamence","salamencite"],
["sceptile","sceptilite"],["scizor","scizorite"],["sharpedo","sharpedonite"],
["slowbro","slowbronite"],["stee¶»§q«^