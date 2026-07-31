export const MYOWNDEX_TERMS = Object.freeze({
    app: "MyOwnDex",
    pokedex: "Pokédex",
    pc: "PC do Bill",
    box: "Box",
    boxes: "Boxes",
    room: "Central da Aventura",
    adventure: "aventura",
    guide: "Guia do Treinador",
    narrator: "Narrador",
    player: "Jogador",
    pokemon: "Pokémon",
    move: "movimento",
    ability: "habilidade",
    pokeBall: "Poké Ball",
});

export const CANONICAL_POKE_BALL_NAMES = Object.freeze({
    "poke-ball": "Poké Ball",
    "great-ball": "Great Ball",
    "ultra-ball": "Ultra Ball",
    "master-ball": "Master Ball",
    "safari-ball": "Safari Ball",
    "level-ball": "Level Ball",
    "lure-ball": "Lure Ball",
    "moon-ball": "Moon Ball",
    "friend-ball": "Friend Ball",
    "love-ball": "Love Ball",
    "heavy-ball": "Heavy Ball",
    "fast-ball": "Fast Ball",
    "sport-ball": "Sport Ball",
    "premier-ball": "Premier Ball",
    "repeat-ball": "Repeat Ball",
    "timer-ball": "Timer Ball",
    "nest-ball": "Nest Ball",
    "net-ball": "Net Ball",
    "dive-ball": "Dive Ball",
    "luxury-ball": "Luxury Ball",
    "heal-ball": "Heal Ball",
    "quick-ball": "Quick Ball",
    "dusk-ball": "Dusk Ball",
    "cherish-ball": "Cherish Ball",
    "park-ball": "Park Ball",
    "dream-ball": "Dream Ball",
    "beast-ball": "Beast Ball",
    "strange-ball": "Strange Ball",
    "origin-ball": "Origin Ball",
    "feather-ball": "Feather Ball",
    "wing-ball": "Wing Ball",
    "jet-ball": "Jet Ball",
    "leaden-ball": "Leaden Ball",
    "gigaton-ball": "Gigaton Ball",
});

export const formatCanonicalItemName = value => {
    const slug = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (CANONICAL_POKE_BALL_NAMES[slug]) return CANONICAL_POKE_BALL_NAMES[slug];
    return slug.split("-").filter(Boolean).map(part => {
        if (part === "pp") return "PP";
        if (part === "hp") return "HP";
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(" ");
};

export const RPG_STATUS_LABELS = Object.freeze({
    "": "Sem condição",
    burn: "Queimado",
    freeze: "Congelado",
    paralysis: "Paralisado",
    poison: "Envenenado",
    "bad-poison": "Gravemente envenenado",
    sleep: "Dormindo",
});

export const formatCount = (value, singular, plural = `${singular}s`) => {
    const count = Number(value) || 0;
    return `${count} ${count === 1 ? singular : plural}`;
};

export const formatPokemonCount = value => {
    const count = Number(value) || 0;
    return `${count} Pokémon ${count === 1 ? "encontrado" : "encontrados"}`;
};

export const formatPokemonInScene = value => {
    const count = Number(value) || 0;
    return `${count} Pokémon em cena`;
};

export const formatRemainingPp = value => {
    const count = Number(value) || 0;
    return `${count === 1 ? "Resta" : "Restam"} ${count} PP.`;
};

export const formatPartnerArrival = value => {
    const count = Number(value) || 0;
    return `${formatCount(count, "parceiro")} ${count === 1 ? "chegou" : "chegaram"} com suas informações.`;
};
