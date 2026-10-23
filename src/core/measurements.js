import { integerInRange } from './math.js';

// PokeAPI stores integral decimetres/hectograms. Change the displayed unit,
// never the underlying Pokémon measurement or a weight-based rule.
export const formatPokemonHeight = value => {
  const decimetres = integerInRange(value, 0, 999999, 0);
  return decimetres ? decimetres % 10 === 0 ? `${decimetres / 10} m` : `${decimetres * 10} cm` : '—';
};
export const formatPokemonWeight = value => {
  const hectograms = integerInRange(value, 0, 999999, 0);
  return hectograms ? hectograms % 10 === 0 ? `${hectograms / 10} kg` : `${hectograms * 100} g` : '—';
};
