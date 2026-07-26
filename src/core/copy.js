export const MYOWNDEX_TERMS = Object.freeze({
    app: "MyOwnDex",
    pokedex: "Pokédex",
    pc: "PC do Bill",
    box: "Box",
    boxes: "Boxes",
    room: "Sala RPG",
    narrator: "Narrador",
    player: "Jogador",
    pokemon: "Pokémon",
    move: "movimento",
    ability: "habilidade",
    pokeBall: "Poké Bola",
});

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
