import test from 'node:test';
import assert from 'node:assert/strict';
import { detectProteins, mainProtein, mealTypesFor, finalizeRecipe } from '../server/lib/recipes.js';
import { parseMeasure, parseIngredientLine, normalizeIngredientName, aisleFor, buildGroceryList, formatQty } from '../server/lib/grocery.js';
import { ensureSlots, randomizePlan } from '../server/lib/planner.js';
import { recipeFromJsonLd } from '../server/lib/sources.js';

test('protein detection avoids false positives', () => {
  assert.deepEqual(detectProteins(['minced garlic', 'tofu', 'soy sauce']), ['tofu']);
  assert.deepEqual(detectProteins(['eggplant', 'goat cheese', 'oyster sauce', 'fish sauce']), []);
  assert.deepEqual(detectProteins(['salmon fillet', 'eggs']), ['fish', 'egg']);
  assert.deepEqual(detectProteins(['king prawns'], 'Seafood'), ['shellfish']);
  assert.equal(mainProtein(['chicken', 'egg'], 'Chicken'), 'chicken');
  assert.equal(mainProtein([], 'Vegetarian'), 'vegetarian');
});

test('meal types', () => {
  assert.deepEqual(mealTypesFor('Dessert'), []);
  assert.deepEqual(mealTypesFor('Breakfast'), ['breakfast']);
  assert.deepEqual(mealTypesFor('Beef'), ['lunch', 'dinner']);
  assert.deepEqual(mealTypesFor('Vegan', [], 'Vegan Chocolate Cake'), []);
});

test('measure parsing', () => {
  assert.deepEqual(parseMeasure('1 1/2 cups'), { qty: 1.5, unit: 'cup', note: '' });
  assert.deepEqual(parseMeasure('200g'), { qty: 200, unit: 'g', note: '' });
  assert.deepEqual(parseMeasure('1kg'), { qty: 1000, unit: 'g', note: '' });
  assert.equal(parseMeasure('½ tsp').qty, 0.5);
  assert.equal(parseMeasure('To taste').qty, null);
  assert.equal(parseMeasure('1 x 400g tin').qty, 400);
  assert.deepEqual(parseIngredientLine('2 cups chopped onion'), { measure: '2 cups', name: 'chopped onion' });
  assert.deepEqual(parseIngredientLine('Fresh basil'), { measure: '', name: 'Fresh basil' });
  assert.equal(formatQty(1.5, 'cup'), '1 ½ cups');
  assert.equal(formatQty(1500, 'g'), '1.5 kg');
});

test('ingredient names and aisles', () => {
  assert.equal(normalizeIngredientName('Red Onions, finely chopped'), 'red onion');
  assert.equal(normalizeIngredientName('tomatoes'), 'tomato');
  assert.equal(normalizeIngredientName('asparagus'), 'asparagus');
  assert.equal(aisleFor('olive oil'), 'Oils, Sauces & Condiments');
  assert.equal(aisleFor('coconut milk'), 'Canned & Jarred');
  assert.equal(aisleFor('eggplant'), 'Produce');
  assert.equal(aisleFor('chicken breast'), 'Meat & Seafood');
});

const mk = (id, extra = {}) => finalizeRecipe({ id, name: `Recipe ${id}`, category: 'Beef', ingredients: [{ name: 'beef', measure: '500g' }, { name: 'onion', measure: '1' }], ...extra });

test('grocery list merges and scales', () => {
  const a = mk('a');
  const b = mk('b', { ingredients: [{ name: 'Onions', measure: '2' }, { name: 'salt', measure: 'to taste' }] });
  const recipes = new Map([[a.id, a], [b.id, b]]);
  const list = buildGroceryList([{ recipeId: 'a' }, { recipeId: 'b' }], recipes, 8);
  const onion = list.find((i) => i.key === 'onion');
  assert.equal(onion.amount, '6'); // (1 + 2) * 8/4
  assert.equal(list.find((i) => i.key === 'beef').amount, '1 kg');
  assert.equal(list.find((i) => i.key === 'salt').amount, 'to taste');
});

test('randomizer respects locks, exclusions, budget and uniqueness', () => {
  const recipes = [];
  for (let i = 0; i < 30; i++) recipes.push(mk(`beef${i}`));
  for (let i = 0; i < 30; i++) recipes.push(mk(`fish${i}`, { category: 'Seafood', ingredients: [{ name: 'cod', measure: '1' }] }));
  recipes.push(mk('pricey', { category: 'Chicken', ingredients: Array(20).fill({ name: 'lobster' }) }));
  const settings = { meals: ['dinner'], excludedProteins: ['fish'], maxPricePerServing: 5, favoritesBoost: true };
  const plan = ensureSlots({ slots: [] }, ['dinner']);
  plan.slots[0].recipeId = 'fish0';
  plan.slots[0].locked = true;
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  randomizePlan(plan, recipes, settings, { rng });
  assert.equal(plan.slots[0].recipeId, 'fish0', 'locked slot kept');
  const picked = plan.slots.slice(1).map((s) => s.recipeId);
  assert.ok(picked.every((id) => id.startsWith('beef')), 'no excluded proteins / over-budget picks');
  assert.equal(new Set(picked).size, picked.length, 'no duplicates');
  const before = plan.slots[3].recipeId;
  randomizePlan(plan, recipes, settings, { rng, onlySlotId: plan.slots[3].id });
  assert.notEqual(plan.slots[3].recipeId, before, 'single re-roll changes the meal');
});

test('JSON-LD recipe import parsing', () => {
  const r = recipeFromJsonLd({
    '@type': ['Recipe'],
    name: 'Weeknight Salmon',
    image: [{ url: 'https://example.com/a.jpg' }],
    recipeYield: '2 servings',
    totalTime: 'PT1H5M',
    recipeIngredient: ['2 salmon fillets', '1 tbsp olive oil', '1/2 lemon'],
    recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Heat oven.' }, { '@type': 'HowToStep', text: 'Bake salmon.' }] }],
  }, 'https://www.example.com/salmon');
  assert.equal(r.name, 'Weeknight Salmon');
  assert.equal(r.servings, 2);
  assert.equal(r.totalMinutes, 65);
  assert.equal(r.image, 'https://example.com/a.jpg');
  assert.deepEqual(r.instructions, ['Heat oven.', 'Bake salmon.']);
  assert.equal(r.mainProtein, 'fish');
  assert.equal(r.source, 'example.com');
});

test('allergies & dislikes matching', async () => {
  const { createAvoidMatcher } = await import('../server/lib/recipes.js');
  const f = createAvoidMatcher({ avoidAllergens: ['dairy', 'gluten', 'peanuts'], avoidIngredients: ['Mushrooms', 'cilantro'] });
  assert.deepEqual(f(['coconut milk', 'butter beans', 'rice flour']), []);
  assert.deepEqual(f(['unsalted butter']), ['Dairy']);
  assert.deepEqual(f(['soy sauce']), ['Gluten / wheat']);
  assert.deepEqual(f(['peanut butter']), ['Peanuts']);
  assert.deepEqual(f(['button mushroom', 'fresh coriander']), ['Mushrooms', 'cilantro']);
  assert.deepEqual(f(['nutmeg']), []);
});

test('randomizer never picks avoided ingredients', () => {
  const recipes = [];
  for (let i = 0; i < 20; i++) recipes.push(mk(`plain${i}`));
  for (let i = 0; i < 20; i++) recipes.push(mk(`shroom${i}`, { ingredients: [{ name: 'beef', measure: '1' }, { name: 'chestnut mushrooms', measure: '200g' }] }));
  const settings = { meals: ['dinner'], excludedProteins: [], avoidIngredients: ['mushroom'], avoidAllergens: [] };
  const plan = randomizePlan(ensureSlots({ slots: [] }, ['dinner']), recipes, settings);
  assert.ok(plan.slots.every((s) => s.recipeId.startsWith('plain')));
});

test('moving a meal shifts the days in between and respects locks', async () => {
  const { moveMeal } = await import('../server/lib/planner.js');
  const make = (locks = []) => {
    const plan = ensureSlots({ slots: [] }, ['dinner']);
    plan.slots.forEach((s, i) => { s.recipeId = 'ABCDEFG'[i]; s.locked = locks.includes(i); });
    return plan;
  };
  const row = (p) => p.slots.map((s) => s.recipeId + (s.locked ? '*' : '')).join('');
  assert.equal(row(moveMeal(make(), 'dinner', 0, 3)), 'BCDAEFG'); // Mon -> Thu
  assert.equal(row(moveMeal(make(), 'dinner', 5, 1)), 'AFBCDEG'); // Sat -> Tue
  assert.equal(row(moveMeal(make([1]), 'dinner', 0, 3)), 'CB*DAEFG'); // locked Tue stays put
  assert.equal(row(moveMeal(make([3]), 'dinner', 0, 3)), 'D*BCAEFG'); // onto a locked day: swap
  assert.equal(row(moveMeal(make([0]), 'dinner', 0, 2)), 'BCA*DEFG'); // the lock travels with the moved meal
});
