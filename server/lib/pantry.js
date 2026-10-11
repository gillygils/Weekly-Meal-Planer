// "Already have": things in the pantry, fridge or freezer. Grocery items that
// match are moved out of the shopping list automatically.
import { containsWord } from './recipes.js';
import { normalizeIngredientName, aisleFor } from './grocery.js';

export const PLACES = ['pantry', 'spices', 'fridge', 'freezer'];

export const STAPLES = [
  ['salt', 'spices'], ['black pepper', 'spices'], ['garlic powder', 'spices'], ['onion powder', 'spices'], ['paprika', 'spices'],
  ['cumin', 'spices'], ['chili powder', 'spices'], ['oregano', 'spices'], ['cinnamon', 'spices'], ['italian seasoning', 'spices'],
  ['olive oil', 'pantry'], ['vegetable oil', 'pantry'], ['flour', 'pantry'], ['sugar', 'pantry'], ['brown sugar', 'pantry'],
  ['rice', 'pantry'], ['pasta', 'pantry'], ['soy sauce', 'pantry'], ['vinegar', 'pantry'], ['honey', 'pantry'],
  ['baking powder', 'pantry'], ['baking soda', 'pantry'], ['chicken stock', 'pantry'], ['butter', 'fridge'], ['eggs', 'fridge'], ['milk', 'fridge'],
];

/**
 * Find the pantry entry that covers a grocery item. "rice" covers "basmati rice"
 * and "chicken" covers "chicken thighs", but only within the same aisle, so
 * "chicken" (meat) doesn't cover "chicken stock" and "garlic" doesn't cover
 * "garlic powder".
 */
export function pantryMatch(itemKey, pantry) {
  const item = normalizeIngredientName(itemKey);
  const aisle = aisleFor(item);
  let best = null;
  for (const p of pantry || []) {
    const term = normalizeIngredientName(p.name);
    if (!term) continue;
    if (term === item) return p;
    if (aisleFor(term) !== aisle) continue;
    if ((containsWord(item, term) || containsWord(term, item)) && (!best || term.length > normalizeIngredientName(best.name).length)) best = p;
  }
  return best;
}
