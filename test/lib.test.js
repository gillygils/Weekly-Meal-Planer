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

test('moving a meal swaps it with the target day', async () => {
  const { moveMeal } = await import('../server/lib/planner.js');
  const make = (locks = []) => {
    const plan = ensureSlots({ slots: [] }, ['dinner']);
    plan.slots.forEach((s, i) => { s.recipeId = 'ABCDEFG'[i]; s.locked = locks.includes(i); });
    return plan;
  };
  const row = (p) => p.slots.map((s) => (s.recipeId || '-') + (s.locked ? '*' : '')).join('');
  assert.equal(row(moveMeal(make(), 'dinner', 0, 3)), 'DBCAEFG'); // Mon <-> Thu
  assert.equal(row(moveMeal(make([1, 3]), 'dinner', 0, 3)), 'D*B*CAEFG'); // locks travel with their meals
  const empty = make();
  empty.slots[2].recipeId = null;
  assert.equal(row(moveMeal(empty, 'dinner', 0, 2)), '-BADEFG'); // onto an empty day
});

test('nutrition estimates and health score', async () => {
  const { estimateNutrition, withNutrition, healthScore } = await import('../server/lib/nutrition.js');
  const r = finalizeRecipe({ id: 'n1', name: 'Chicken & rice', servings: 2, ingredients: [
    { name: 'chicken breast', measure: '400g' }, { name: 'basmati rice', measure: '1 cup' }, { name: 'broccoli', measure: '200g' }, { name: 'salt', measure: 'to taste' },
  ] });
  const n = estimateNutrition(r);
  // 400g chicken ≈ 480 kcal / 90 g protein; 1 cup rice ≈ 185 g ≈ 666 kcal; broccoli ≈ 68 kcal. Per serving ≈ 607.
  assert.ok(n.kcal > 560 && n.kcal < 660, `kcal ${n.kcal}`);
  assert.ok(n.protein > 50 && n.protein < 62, `protein ${n.protein}`);
  assert.equal(n.source, 'estimate');
  assert.ok(healthScore(r, n) >= 80);
  // Published nutrition wins over the estimate.
  const reported = withNutrition({ ...r, reportedNutrition: { calories: '500 kcal', proteinContent: '45 g' } });
  assert.equal(reported.nutrition.kcal, 500);
  assert.equal(reported.nutrition.protein, 45);
  assert.equal(reported.nutrition.source, 'recipe');
  // Deep-frying oil isn't all eaten, and "50g/2oz" isn't 50 + 2.
  const fried = estimateNutrition(finalizeRecipe({ id: 'n2', name: 'x', servings: 4, ingredients: [{ name: 'vegetable oil', measure: '2 quarts' }, { name: 'butter', measure: '50g/2oz' }] }));
  assert.ok(fried.kcal < 700, `fried ${fried.kcal}`);
});

test('randomizer honors health goals', async () => {
  const { withNutrition } = await import('../server/lib/nutrition.js');
  const lean = (i) => withNutrition(finalizeRecipe({ id: `lean${i}`, name: `Lean ${i}`, category: 'Chicken', servings: 2, ingredients: [{ name: 'chicken breast', measure: '400g' }, { name: 'broccoli', measure: '300g' }, { name: 'brown rice', measure: '1 cup' }, { name: 'spinach', measure: '100g' }] }));
  const heavy = (i) => withNutrition(finalizeRecipe({ id: `heavy${i}`, name: `Heavy ${i}`, category: 'Beef', servings: 2, ingredients: [{ name: 'ground beef', measure: '500g' }, { name: 'butter', measure: '100g' }, { name: 'cheddar', measure: '200g' }, { name: 'pasta', measure: '300g' }] }));
  const recipes = [...Array.from({ length: 10 }, (_, i) => lean(i)), ...Array.from({ length: 10 }, (_, i) => heavy(i))];
  assert.ok(recipes[0].healthScore >= 65 && recipes[10].healthScore < 65, `${recipes[0].healthScore} / ${recipes[10].healthScore}`);
  const plan = randomizePlan(ensureSlots({ slots: [] }, ['dinner']), recipes, { meals: ['dinner'], excludedProteins: [], healthFocus: true, maxCalories: 800, minProtein: 30 });
  assert.ok(plan.slots.every((s) => s.recipeId.startsWith('lean')));
});

test('creator pages, captions and robots.txt', async () => {
  const { recipeFromPlainHtml, parseCaption, nutritionFromText, robotsRules, robotsAllows } = await import('../server/lib/sources.js');
  const html = `<html><head><meta property="og:title" content="Chicken Zucchini Pasta — Hunt4Shredz"></head><body>
    <h1>CHICKEN ZUCCHINI PASTA</h1><h4>Serving:</h4>
    <ul><li><p>1.5 lbs (680 grams) chicken breast</p></li><li><p>2 cups (200 grams) zucchini</p></li><li><p>8 oz pasta</p></li><li><p>1 tbsp olive oil</p></li></ul>
    <p>Season the chicken with salt and pepper and set it aside.</p>
    <ol><li><p>Cook the pasta until al dente.</p></li><li><p>Sear the chicken and add the zucchini.</p></li><li><p>Divide into 4 equal portions</p></li></ol>
    <p>Calories: 430, cal, Protein: 47g, Carbohydrates: 35g, Fat: 10g</p></body></html>`;
  const r = recipeFromPlainHtml(html, 'https://www.hunt4shredz.com/chicken-zucchini-pasta');
  assert.equal(r.name, 'Chicken Zucchini Pasta');
  assert.equal(r.servings, 4);
  assert.equal(r.ingredients[0].measure, '1.5 lbs');
  assert.equal(r.ingredients[0].name, 'chicken breast');
  assert.equal(r.instructions.length, 4);
  assert.deepEqual(r.reportedNutrition, { calories: 430, proteinContent: 47, carbohydrateContent: 35, fatContent: 10 });
  // A privacy policy with a bullet list isn't a recipe.
  assert.equal(recipeFromPlainHtml('<ul><li>We collect your name</li><li>We store 2 cookies</li><li>1 year retention</li></ul><ol><li>Contact us at any time to opt out.</li></ol>', 'https://x.com/privacy'), null);
  const cap = parseCaption('Protein burrito bowl 🔥 520 calories, 48g protein! Ingredients: 500g chicken breast, 1 cup rice, 1 can black beans #mealprep');
  assert.equal(cap.name, 'Protein burrito bowl');
  assert.equal(cap.ingredients.length, 3);
  assert.equal(cap.nutrition.calories, 520);
  assert.equal(nutritionFromText('Calories: 367.5, cal, Protein: 17.5g').calories, 367.5);
  const rules = robotsRules('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /search\nDisallow: /api/\nAllow: /api/ui/');
  assert.equal(robotsAllows(rules, '/chicken-pasta'), true);
  assert.equal(robotsAllows(rules, '/search?q=1'), false);
  assert.equal(robotsAllows(rules, '/api/ui/x'), true);
  assert.equal(robotsAllows(robotsRules('User-agent: WeeklyMealPlanner\nDisallow: /\n\nUser-agent: *\nDisallow:'), '/a'), false);
});

test('custom recipes from the editor', async () => {
  const { buildCustomRecipe } = await import('../server/lib/custom.js');
  const r = buildCustomRecipe({ name: 'Taco bowls', ingredientsText: '500g ground turkey\n1 cup rice\n\n1 can black beans', instructionsText: 'Cook.\nServe.', servings: '2', mealTypes: ['dinner'], nutrition: { kcal: '600', protein: '50' } });
  assert.equal(r.ingredients.length, 3);
  assert.equal(r.servings, 2);
  assert.deepEqual(r.mealTypes, ['dinner']);
  assert.equal(r.nutrition.kcal, 600);
  assert.equal(r.nutrition.source, 'manual');
  const edited = buildCustomRecipe({ name: 'Taco bowls v2', ingredientsText: '1 cup rice' }, { ...r, favorite: true });
  assert.equal(edited.id, r.id);
  assert.equal(edited.favorite, true);
  assert.throws(() => buildCustomRecipe({ name: '', ingredientsText: 'x' }), /name/);
});
