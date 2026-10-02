// Canonical English names; descriptions and controls can still use Portuguese.
const ENGLISH_NAMES = Object.freeze({
    "nidoran-f": "Nidoran♀", "nidoran-m": "Nidoran♂",
    "mr-mime": "Mr. Mime", "mime-jr": "Mime Jr.", "mr-rime": "Mr. Rime",
    farfetchd: "Farfetch’d", sirfetchd: "Sirfetch’d", flabebe: "Flabébé",
    "ho-oh": "Ho-Oh", "porygon-z": "Porygon-Z", "type-null": "Type: Null",
    "jangmo-o": "Jangmo-o", "hakamo-o": "Hakamo-o", "kommo-o": "Kommo-o",
    "wo-chien": "Wo-Chien", "chien-pao": "Chien-Pao", "ting-lu": "Ting-Lu", "chi-yu": "Chi-Yu",
    "poke-ball": "Poké Ball", "pokedoll": "Poké Doll", "poke-doll": "Poké Doll",
    "never-melt-ice": "Never-Melt Ice", "black-glasses": "Black Glasses",
    "u-turn": "U-turn", "v-create": "V-create", "x-scissor": "X-Scissor",
    "double-edge": "Double-Edge", "will-o-wisp": "Will-O-Wisp",
    "freeze-dry": "Freeze-Dry", "lock-on": "Lock-On", "mud-slap": "Mud-Slap",
    "soft-boiled": "Soft-Boiled", "power-up-punch": "Power-Up Punch",
    "wake-up-slap": "Wake-Up Slap", "baby-doll-eyes": "Baby-Doll Eyes",
    "forest-s-curse": "Forest’s Curse", "king-s-shield": "King’s Shield",
    "land-s-wrath": "Land’s Wrath", "nature-s-madness": "Nature’s Madness",
    "trick-or-treat": "Trick-or-Treat", "multi-attack": "Multi-Attack",
    "all-out-pummeling": "All-Out Pummeling", "self-destruct": "Self-Destruct",
    "10-000-000-volt-thunderbolt": "10,000,000 Volt Thunderbolt",
    "thunder-punch": "Thunder Punch", "ice-punch": "Ice Punch", "fire-punch": "Fire Punch",
    "zero-to-hero": "Zero to Hero", "power-of-alchemy": "Power of Alchemy",
    "beads-of-ruin": "Beads of Ruin", "sword-of-ruin": "Sword of Ruin",
    "tablets-of-ruin": "Tablets of Ruin", "vessel-of-ruin": "Vessel of Ruin",
    "greninja-ash": "Ash-Greninja",
});

export const formatEnglishName = value => {
    const slug = String(value || "").trim().toLowerCase();
    if (!slug) return "Sem registro";
    if (ENGLISH_NAMES[slug]) return ENGLISH_NAMES[slug];
    const regional = slug.match(/^(.+)-(alola|galar|hisui|paldea)$/);
    if (regional) return `${({ alola: "Alolan", galar: "Galarian", hisui: "Hisuian", paldea: "Paldean" })[regional[2]]} ${formatEnglishName(regional[1])}`;
    const mega = slug.match(/^(.+)-mega(?:-([xy]))?$/);
    if (mega) return `Mega ${formatEnglishName(mega[1])}${mega[2] ? ` ${mega[2].toUpperCase()}` : ""}`;
    const form = slug.match(/^(.+)-(primal|gmax)$/);
    if (form) return `${form[2] === "primal" ? "Primal" : "Gigantamax"} ${formatEnglishName(form[1])}`;
    return slug.split(/[-\s]+/).filter(Boolean).map(part => {
        if (/^(?:hp|pp|tm\d*|hm\d*|tr\d*|z|x|y)$/.test(part)) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(" ");
};
