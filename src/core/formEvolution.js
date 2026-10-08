import evolutionCatalogue from '../data/form-evolutions.json' with { type: 'json' };
import forms from '../data/forms.json' with { type: 'json' };
import { shouldSeparateDexVariant } from './dexVariants.js';

const byName = new Map(evolutionCatalogue.nodes.map(node => [node.name, node]));
const byPokemonName = new Map();
const defaultBySpecies = new Map();
for (const node of evolutionCatalogue.nodes) {
    if (!byPokemonName.has(node.pokemonName) || node.isDefault) byPokemonName.set(node.pokemonName, node);
    if (node.isDefault) defaultBySpecies.set(node.speciesId, node);
}
const formByName = new Map([...forms.defaults, ...forms.entries].map(form => [form.name, form]));
const paths = evolutionCatalogue.paths.map(path => path.map(name => byName.get(name)));

const identityName = identity => typeof identity === 'string' ? identity : identity?.formKey || identity?.name || '';
const stableFormName = name => {
    if (name === 'darmanitan-galar-zen') return 'darmanitan-galar-standard';
    if (name === 'marowak-totem') return 'marowak-alola';
    // Only Eternal Flower Floette can use Floettite; the ordinary flower
    // colours never become this Mega or inherit its distinct identity.
    if (name === 'floette-mega') return 'floette-eternal';
    const stable = name.replace(/-totem(?=-alola$)/, '').replace(/-(?:gmax|mega(?:-[xy])?)$/, '');
    return byName.has(stable) || formByName.has(stable) ? stable : name;
};
const nodeForIdentity = identity => {
    const name = identityName(identity);
    // Zen Mode is the same Galarian individual, not an evolution into the
    // ordinary Darmanitan lineage.
    const evolutionaryName = stableFormName(name);
    return byName.get(evolutionaryName) || byPokemonName.get(evolutionaryName)
        || defaultBySpecies.get(Number(identity?.speciesId)) || null;
};

/** The identity underneath a reversible battle state, without changing policy. */
export const getStableFormIdentity = identity => {
    const name = stableFormName(identityName(identity));
    const form = formByName.get(name) || byName.get(name) || byPokemonName.get(name);
    return { name, speciesId: Number(form?.speciesId || identity?.speciesId) || 0 };
};

/** Keep exact inherited forms and regional founders in their official line. */
export function resolveFormEvolutionPaths(speciesPaths, identity) {
    if (!Array.isArray(speciesPaths) || !speciesPaths.length) return [];
    const active = nodeForIdentity(identity);
    if (!active) return speciesPaths.map(path => path.map(node => ({ ...node, speciesId: Number(node.id) })));
    const selected = paths.filter(path => path.some(node => shouldSeparateDexVariant(active)
        ? node.name === active.name
        : node.pokemonName === active.pokemonName));
    return selected.map(path => path.map(node => ({
        name: node.name, id: node.pokemonId, speciesId: node.speciesId,
        pokemonName: node.pokemonName, spriteKey: node.spriteKey,
    })));
}

/** An absent regional/distinct learnset never licenses the ordinary form's moves. */
export function getFormLearnsetFallback(identity, defaultPokemonName) {
    const name = identityName(identity);
    if (!name || name === defaultPokemonName) return null;
    const stableName = stableFormName(name);
    if (stableName !== name) return stableName;
    const form = formByName.get(name) || byName.get(name) || byPokemonName.get(name);
    if (form && shouldSeparateDexVariant(form)) return null;
    return defaultPokemonName || null;
}
