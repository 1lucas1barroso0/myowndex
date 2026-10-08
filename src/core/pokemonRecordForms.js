import forms from '../data/forms.json' with { type: 'json' };
import { formatEnglishName } from './names.js';

const catalogue = [...forms.defaults, ...forms.entries];
const colourLabels = { red: 'Vermelha', yellow: 'Amarela', orange: 'Laranja', blue: 'Azul', white: 'Branca' };
const patternLabels = {
    'icy-snow': 'Neve', polar: 'Polar', tundra: 'Tundra', continental: 'Continental', garden: 'Jardim',
    elegant: 'Elegante', meadow: 'Prado', modern: 'Moderno', marine: 'Marinho', archipelago: 'Arquipélago',
    'high-plains': 'Planície', sandstorm: 'Tempestade de areia', river: 'Rio', monsoon: 'Monções',
    savanna: 'Savana', sun: 'Sol', ocean: 'Oceano', jungle: 'Selva', fancy: 'Fantasia', 'poke-ball': 'Poké Ball',
};
const creamLabels = {
    'vanilla-cream': 'Creme de baunilha', 'ruby-cream': 'Creme rubi', 'matcha-cream': 'Creme de matcha',
    'mint-cream': 'Creme de menta', 'lemon-cream': 'Creme de limão', 'salted-cream': 'Creme salgado',
    'ruby-swirl': 'Espiral rubi', 'caramel-swirl': 'Espiral de caramelo', 'rainbow-swirl': 'Espiral arco-íris',
};
const sweetLabels = { strawberry: 'Morango', berry: 'Fruta', love: 'Coração', star: 'Estrela', clover: 'Trevo', flower: 'Flor', ribbon: 'Laço' };

/** Cosmetic names are explanations in Portuguese; Pokémon names stay original. */
export const getRecordFormLabel = (name, pokemonName = '') => {
    const slug = String(name || '');
    const identifier = slug.startsWith(`${pokemonName}-`) ? slug.slice(pokemonName.length + 1) : slug;
    if (pokemonName === 'unown') return identifier === 'exclamation' ? '!' : identifier === 'question' ? '?' : `Letra ${identifier.toUpperCase()}`;
    if (pokemonName === 'burmy') return ({ plant: 'Manto vegetal', sandy: 'Manto de areia', trash: 'Manto de lixo' })[identifier] || formatEnglishName(identifier);
    if (['scatterbug', 'spewpa', 'vivillon'].includes(pokemonName)) return `Padrão ${patternLabels[identifier] || formatEnglishName(identifier)}`;
    if (['flabebe', 'floette', 'florges'].includes(pokemonName) && colourLabels[identifier]) return `Flor ${colourLabels[identifier].toLowerCase()}`;
    if (pokemonName === 'alcremie') {
        const match = identifier.match(/^(.+)-(strawberry|berry|love|star|clover|flower|ribbon)-sweet$/);
        if (match) return `${creamLabels[match[1]] || formatEnglishName(match[1])} · ${sweetLabels[match[2]]}`;
    }
    if (['deerling', 'sawsbuck'].includes(pokemonName)) return ({ spring: 'Primavera', summer: 'Verão', autumn: 'Outono', winter: 'Inverno' })[identifier] || formatEnglishName(identifier);
    return slug === pokemonName ? 'Forma base' : formatEnglishName(identifier);
};

/** All appearances stay inside their Pokémon resource, never new Dex tickets.
 * The API adds future forms; the pinned catalogue preserves known cosmetics
 * when an older cached API response does not list them yet. */
export const getPokemonRecordForms = pokemon => {
    if (!pokemon?.name) return [];
    const known = catalogue.filter(form => form.pokemonName === pokemon.name);
    const byId = new Map(known.map(form => [form.formId, form]));
    const choices = new Map();
    for (const form of [...(pokemon.forms || []), ...known.map(form => ({ name: form.name, url: `https://pokeapi.co/api/v2/pokemon-form/${form.formId}/` }))]) {
        const id = Number(String(form?.url || '').match(/\/pokemon-form\/(\d+)\/?$/)?.[1]);
        if (!Number.isInteger(id) || id <= 0 || choices.has(id)) continue;
        const metadata = byId.get(id);
        const name = metadata?.name || form.name;
        if (!name) continue;
        choices.set(id, {
            formId: id, formKey: name, pokemonName: pokemon.name, pokemonId: pokemon.id,
            spriteKey: metadata?.spriteKey || (id === pokemon.id ? String(pokemon.id) : ''),
            generation: metadata?.generation || null,
            url: `https://pokeapi.co/api/v2/pokemon-form/${id}/`,
            label: getRecordFormLabel(name, pokemon.name),
        });
    }
    return [...choices.values()];
};

/** Form resources can change types (Arceus/Silvally), not just the portrait. */
export const applyRecordAppearance = (pokemon, appearance) => {
    if (!pokemon || !appearance || appearance.pokemon?.name !== pokemon.name) return pokemon;
    const sprites = Object.fromEntries(Object.entries(appearance.sprites || {}).filter(([, value]) => Boolean(value)));
    return {
        ...pokemon,
        ...(appearance.types?.length ? { types: appearance.types } : {}),
        sprites: { ...(pokemon.sprites || {}), ...sprites },
    };
};
