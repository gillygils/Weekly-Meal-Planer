// "Already have": things in the pantry, fridge or freezer. Grocery items that
// match are moved out of the shopping list automatically.
import { containsWord } from './recipes.js';
import { normalizeIngredientName, aisleFor } from './grocery.js';
import { PANTRY_CATALOG } from './pantry-catalog.js';

export const PLACES = ['pantry', 'spices', 'fridge', 'freezer'];

export const STAPLES = [
  ['salt', 'spices'], ['black pepper', 'spices'], ['garlic powder', 'spices'], ['onion powder', 'spices'], ['paprika', 'spices'],
  ['cumin', 'spices'], ['chili powder', 'spices'], ['oregano', 'spices'], ['cinnamon', 'spices'], ['italian seasoning', 'spices'],
  ['olive oil', 'pantry'], ['vegetable oil', 'pantry'], ['flour', 'pantry'], ['sugar', 'pantry'], ['brown sugar', 'pantry'],
  ['rice', 'pantry'], ['pasta', 'pantry'], ['soy sauce', 'pantry'], ['vinegar', 'pantry'], ['honey', 'pantry'],
  ['baking powder', 'pantry'], ['baking soda', 'pantry'], ['chicken stock', 'pantry'], ['butter', 'fridge'], ['eggs', 'fridge'], ['milk', 'fridge'],
];

const CATALOG_PLACE = new Map(PANTRY_CATALOG.flatMap((i) => [i.name, ...i.also].map((n) => [n, i.where])));

/** Where an item usually lives: the catalog knows most staples; otherwise go by grocery aisle. */
export function autoPlace(name) {
  const n = String(name || '').toLowerCase().trim();
  if (CATALOG_PLACE.has(n)) return CATALOG_PLACE.get(n);
  const aisle = aisleFor(normalizeIngredientName(n));
  return /Spices/.test(aisle) ? 'spices' : /Meat|Frozen/.test(aisle) ? 'freezer' : /Dairy|Produce/.test(aisle) ? 'fridge' : 'pantry';
}

/**
 * Find the pantry entry that covers a grocery item. "rice" covers "basmati rice"
 * and "chicken" covers "chicken thighs", but only within the same aisle, so
 * "chicken" (meat) doesn't cover "chicken stock" and "garlic" doesn't cover
 * "garlic powder".
 */
export function pantryMatch(itemKey, pantry) {
  const item = sameName(normalizeIngredientName(itemKey));
  const aisle = aisleFor(item);
  let best = null;
  for (const p of pantry || []) {
    const term = sameName(normalizeIngredientName(p.name));
    if (!term) continue;
    if (term === item) return p;
    if (aisleFor(term) !== aisle) continue;
    const covers = (containsWord(item, term) && !differentKind(term, item)) || (containsWord(term, item) && !differentKind(item, term));
    if (covers && (!best || term.length > normalizeIngredientName(best.name).length)) best = p;
  }
  return best;
}

// Different names for the same thing.
function sameName(n) {
  return n.replace(/\bstock\b/g, 'broth').replace(/\bbay leaf\b/g, 'bay leaves')
    .replace(/\b(chilli|chili|red pepper) flakes?\b/g, 'red pepper flake').replace(/\bchilli\b/g, 'chili')
    .replace(/\bblack peppercorns?\b/g, 'black pepper');
}

// Words that make "X something" a different product from plain "something":
// garlic salt isn't salt, brown sugar isn't sugar, sour cream isn't cream.
const NOT_THE_SAME = {
  salt: 'garlic onion celery seasoned season truffle smoked lemon',
  pepper: 'white pink lemon cayenne szechuan sichuan aleppo red bell',
  sugar: 'brown powdered confectioners icing coconut turbinado raw caster',
  flour: 'cake self-rising almond rice coconut corn bread',
  paprika: 'smoked hot',
  cream: 'sour ice cheese coconut',
  milk: 'coconut almond oat soy powdered evaporated condensed butter',
  butter: 'peanut almond apple cashew plant',
  oil: 'chili truffle sesame coconut',
  'chili powder': 'ancho chipotle kashmiri',
  vinegar: 'balsamic',
  garlic: 'granulated dried powder salt',
  onion: 'dried powder salt soup',
  mustard: 'powder seed seeds dry',
};

/** True when `longer` is a variety of `shorter` that a recipe can't swap in, either way round. */
function differentKind(shorter, longer) {
  const blocked = NOT_THE_SAME[shorter] || NOT_THE_SAME[shorter.split(' ').pop()];
  if (!blocked) return false;
  const extra = longer.replace(shorter, ' ').split(/\s+/).filter(Boolean);
  return extra.some((w) => blocked.split(' ').includes(w));
}
