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

test('store prices and the cheapest shopping plan', async () => {
  const { priceGroceryList, purchaseFor } = await import('../server/lib/pricing.js');
  const item = (key, totals) => ({ key, name: key, aisle: 'Other', recipes: ['x'], totals, checked: false });
  // Packages: 600 g pasta = 2 one-pound boxes; loose meat rounds up to the next quarter pound.
  assert.equal(purchaseFor(item('pasta', { g: 600 })).units, 2);
  assert.equal(purchaseFor(item('chicken breast', { g: 500 })).qtyText, '1.25 lb');
  assert.equal(purchaseFor(item('coriander', { pack: 1 })).units, 1);
  assert.equal(purchaseFor(item('water', { ml: 500 })), null);
  const items = [item('pasta', { g: 450 }), item('chicken breast', { g: 900 }), item('onion', { '': 3 }), item('cumin', { tsp: 1 })];
  const settings = { stores: ['meijer', 'aldi'], tripThreshold: 0.5 };
  const est = priceGroceryList(items, settings, {});
  assert.ok(est.totals.aldi < est.totals.meijer, 'Aldi estimates are cheaper');
  assert.equal(est.plan.splitWorthIt, false);
  assert.equal(est.items.find((p) => p.key === 'cumin').pantry, true);
  // Real prices: chicken much cheaper at Meijer -> split the shop.
  const real = priceGroceryList(items, settings, { meijer: { 'chicken breast': { price: 1.99, aisle: '12' } } });
  const chicken = real.items.find((p) => p.key === 'chicken breast');
  assert.equal(chicken.at.meijer.real, true);
  assert.equal(chicken.at.meijer.cost, 3.98); // 2 lb x $1.99
  assert.equal(chicken.best, 'meijer');
  assert.equal(real.plan.splitWorthIt, true);
  assert.deepEqual(real.plan.trips.map((t) => t.store), ['meijer', 'aldi']);
  assert.ok(real.plan.trips[0].items.includes('chicken breast'));
  // Pantry staples stay out of totals unless asked for.
  const withPantry = priceGroceryList(items, { ...settings, countPantry: true }, {});
  assert.ok(withPantry.totals.aldi > est.totals.aldi);
});

test('PIN hashing, sessions and the wrong-PIN throttle', async () => {
  const { hashPin, verifyPin, createSession, sessionValid, endSession, Throttle, SESSION_HOURS } = await import('../server/lib/pin.js');
  const auth = { ...hashPin('4821'), sessions: {} };
  assert.equal(auth.hash.includes('4821'), false);
  assert.equal(verifyPin('4821', auth), true);
  assert.equal(verifyPin('4822', auth), false);
  assert.equal(verifyPin('12', auth), false);
  const t0 = Date.now();
  const token = createSession(auth, t0);
  assert.equal(sessionValid(auth, token, t0 + 1000), true);
  assert.equal(sessionValid(auth, token, t0 + SESSION_HOURS * 3600 * 1000 + 1), false, 'expires after 24h');
  assert.equal(sessionValid(auth, 'nope', t0), false);
  endSession(auth, token);
  assert.equal(sessionValid(auth, token, t0), false);
  let now = 0;
  const th = new Throttle({ now: () => now });
  for (let i = 0; i < 4; i++) th.fail('a');
  assert.equal(th.wait('a'), 0, '4 misses are free');
  th.fail('a');
  assert.equal(th.wait('a'), 30);
  assert.equal(th.wait('b'), 0, 'other devices unaffected');
  now += 31000;
  th.fail('a');
  assert.equal(th.wait('a'), 60, 'backs off');
  for (let i = 0; i < 30; i++) th.fail(`ip${i}`);
  assert.ok(th.wait('fresh') > 0, 'many misses overall lock everyone');
});

test('meal days: off nights are skipped by the randomizer and groceries', async () => {
  const { activeSlots, weekdayOf, moveMeal } = await import('../server/lib/planner.js');
  const recipes = Array.from({ length: 20 }, (_, i) => mk(`r${i}`));
  // Week starting Monday 2026-10-05; no dinner on Wednesdays (weekday 3).
  const mealDays = { dinner: [0, 1, 2, 4, 5, 6] };
  const plan = ensureSlots({ key: '2026-10-05', slots: [] }, ['dinner'], mealDays);
  assert.equal(weekdayOf('2026-10-05', 2), 3);
  assert.deepEqual(plan.slots.filter((s) => s.off).map((s) => s.day), [2]);
  randomizePlan(plan, recipes, { meals: ['dinner'], excludedProteins: [] });
  assert.equal(plan.slots[2].recipeId, null, 'off night stays empty');
  assert.equal(activeSlots(plan).length, 6);
  // Per-week overrides: plan Wednesday anyway, skip Friday.
  plan.slots[2].skip = false;
  plan.slots[4].skip = true;
  ensureSlots(plan, ['dinner'], mealDays);
  assert.equal(plan.slots[2].off, false);
  assert.equal(plan.slots[4].off, true);
  // Drag-and-drop never moves a meal onto (or off) an off night.
  const before = plan.slots[4].recipeId;
  moveMeal(plan, 'dinner', 0, 4);
  assert.equal(plan.slots[4].recipeId, before);
});

test('pantry matching', async () => {
  const { pantryMatch } = await import('../server/lib/pantry.js');
  const pantry = [{ name: 'rice' }, { name: 'Chicken' }, { name: 'garlic' }, { name: 'salt' }, { name: 'olive oil' }, { name: 'chicken thighs' }];
  const m = (k) => pantryMatch(k, pantry)?.name || null;
  assert.equal(m('basmati rice'), 'rice');
  assert.equal(m('chicken breast'), 'Chicken');
  assert.equal(m('chicken thigh'), 'chicken thighs', 'most specific wins');
  assert.equal(m('chicken stock'), null, 'meat does not cover stock');
  assert.equal(m('garlic powder'), null, 'fresh garlic does not cover garlic powder');
  assert.equal(m('garlic clove'), 'garlic');
  assert.equal(m('salted butter'), null);
  assert.equal(m('extra virgin olive oil'), 'olive oil');
  assert.equal(m('onion'), null);
});

test('re-rolling one day leaves every other day alone', () => {
  const recipes = Array.from({ length: 40 }, (_, i) => mk(`d${i}`));
  const plan = ensureSlots({ key: '2026-10-05', slots: [] }, ['lunch', 'dinner']);
  randomizePlan(plan, recipes, { meals: ['lunch', 'dinner'], excludedProteins: [] });
  plan.slots.find((s) => s.id === '3-lunch').locked = true;
  const before = Object.fromEntries(plan.slots.map((s) => [s.id, s.recipeId]));
  randomizePlan(plan, recipes, { meals: ['lunch', 'dinner'], excludedProteins: [] }, { onlyDay: 3 });
  for (const s of plan.slots) {
    if (s.id === '3-dinner') assert.notEqual(s.recipeId, before[s.id], 'unlocked meal on that day changes');
    else assert.equal(s.recipeId, before[s.id], `${s.id} untouched`);
  }
});

test('easy days pick easy meals and never touch locked ones', async () => {
  const { isEasy } = await import('../server/lib/planner.js');
  const hard = (i) => finalizeRecipe({ id: `hard${i}`, name: `Hard ${i}`, category: 'Beef', totalMinutes: 120, ingredients: Array.from({ length: 12 }, (_, k) => ({ name: `beef ${k}`, measure: '1' })), instructions: Array(9).fill('Step') });
  const easy = (i) => finalizeRecipe({ id: `easy${i}`, name: `Easy ${i}`, category: 'Beef', totalMinutes: 15, ingredients: [{ name: 'bread', measure: '2' }, { name: 'cheese', measure: '2' }], instructions: ['Toast.'] });
  const recipes = [...Array.from({ length: 20 }, (_, i) => hard(i)), ...Array.from({ length: 20 }, (_, i) => easy(i))];
  assert.equal(isEasy(recipes[0]), false);
  assert.equal(isEasy(recipes[25]), true);
  // Week of Monday 2026-10-05: Saturday is day 5, Sunday day 6.
  const plan = ensureSlots({ key: '2026-10-05', slots: [] }, ['dinner']);
  plan.slots[6].recipeId = 'hard3';
  plan.slots[6].locked = true;
  randomizePlan(plan, recipes, { meals: ['dinner'], excludedProteins: [], easyDays: [0, 6] });
  assert.ok(plan.slots[5].recipeId.startsWith('easy'), 'Saturday gets an easy meal');
  assert.equal(plan.slots[6].recipeId, 'hard3', 'locked Sunday meal stays');
});

test('re-rolling keeps offering new dishes before repeating', async () => {
  const { sameDish, dishWords } = await import('../server/lib/planner.js');
  assert.ok(sameDish(dishWords({ name: 'Chicken Alfredo' }), dishWords({ name: 'Fettucine alfredo' })));
  assert.ok(!sameDish(dishWords({ name: 'Chicken Alfredo' }), dishWords({ name: 'Chicken Tacos' })));
  const names = ['Chicken Alfredo', 'Fettuccine Alfredo', 'Chicken Alfredo Pasta', 'Tacos', 'Grilled Cheese', 'Chili', 'BLT', 'Quesadillas'];
  const recipes = names.map((name, i) => ({ id: `r${i}`, name, mealTypes: ['dinner'], proteins: [], ingredients: [] }));
  const plan = ensureSlots({ key: '2026-10-12', slots: [] }, ['dinner']);
  const seen = [];
  // Plenty of distinct dishes: six clicks never show the same dish twice (all three Alfredos count as one).
  for (let i = 0; i < 6; i++) {
    randomizePlan(plan, recipes, { meals: ['dinner'], excludedProteins: [] }, { onlySlotId: '5-dinner', rng: () => 0 });
    seen.push(dishWords(recipes.find((r) => r.id === plan.slots[5].recipeId)));
  }
  // Day 5 starts empty, other days are empty too, so the six picks are six different dishes.
  for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) assert.ok(!sameDish(seen[i], seen[j]), `repeat at ${i},${j}`);
  // Once every dish has been shown it still picks something instead of giving up.
  for (let i = 0; i < 4; i++) randomizePlan(plan, recipes, { meals: ['dinner'], excludedProteins: [] }, { onlySlotId: '5-dinner' });
  assert.ok(plan.slots[5].recipeId);
});

test('pantry scanning: barcode products and photo results', async () => {
  const { productToName, placeForProduct, cleanItems, lookupBarcode, scanPhotos, aiScanEnabled } = await import('../server/lib/scan.js');
  assert.equal(productToName({ product_name: 'McCormick Ground Cumin, 1.5 oz', brands: 'McCormick' }), 'cumin');
  assert.equal(productToName({ product_name: 'Great Value Garlic Powder 3.4 oz', brands: 'Great Value,Walmart' }), 'garlic powder');
  assert.equal(placeForProduct({ product_name: 'Garlic Powder' }), 'spices');
  assert.equal(placeForProduct({ product_name: 'Vegetable Oil' }), 'pantry');
  assert.deepEqual(cleanItems([{ name: 'Cumin', where: 'spices' }, { name: 'cumin ', where: 'spices' }, { name: 'Olive Oil', where: 'attic' }, { name: '' }]),
    [{ name: 'cumin', where: 'spices' }, { name: 'olive oil', where: 'pantry' }]);
  const fake = (body, status = 200) => async () => ({ status, ok: status < 400, json: async () => body });
  assert.deepEqual(await lookupBarcode('041196910759', fake({ status: 1, product: { product_name: 'Bertolli Extra Light Olive Oil', brands: 'Bertolli' } })),
    { code: '041196910759', name: 'extra light olive oil', where: 'pantry', brand: 'Bertolli' });
  assert.equal(await lookupBarcode('000', fake({ status: 0 })), null);
  // Without an API key, photo scanning says how to turn it on instead of failing oddly.
  if (!aiScanEnabled()) await assert.rejects(scanPhotos([{ type: 'image/jpeg', data: 'x' }]), (e) => e.status === 501);
});

test('pantry catalog: suggestions, auto placement and variety matching', async () => {
  const { suggestPantry, PANTRY_CATALOG } = await import('../server/lib/pantry-catalog.js');
  const { pantryMatch, autoPlace } = await import('../server/lib/pantry.js');
  const { aisleFor } = await import('../server/lib/grocery.js');
  const names = PANTRY_CATALOG.map((i) => i.name);
  assert.equal(new Set(names).size, names.length, 'no duplicate names');
  assert.equal(suggestPantry('cum')[0].name, 'cumin');
  assert.equal(suggestPantry('evoo')[0].name, 'extra virgin olive oil');
  assert.ok(!suggestPantry('cum', { have: new Set(['cumin']) }).some((i) => i.name === 'cumin'), 'leaves out what you have');
  assert.equal(autoPlace('cumin'), 'spices');
  assert.equal(autoPlace('unsalted butter'), 'fridge');
  assert.equal(autoPlace('ground beef'), 'freezer');
  assert.equal(autoPlace('jasmine rice'), 'pantry');
  for (const n of ['garlic salt', 'celery seed', 'dried thyme', 'lemon pepper', 'ground ginger']) assert.equal(aisleFor(n), 'Spices & Seasonings', n);
  const covers = (have, need) => Boolean(pantryMatch(need, [{ name: have }]));
  for (const [have, need] of [['kosher salt', 'salt'], ['olive oil', 'extra virgin olive oil'], ['chicken broth', 'chicken stock'],
    ['red pepper flakes', 'chilli flakes'], ['black peppercorns', 'black pepper'], ['butter', 'unsalted butter']]) assert.ok(covers(have, need), `${have} covers ${need}`);
  for (const [have, need] of [['garlic salt', 'salt'], ['salt', 'garlic salt'], ['brown sugar', 'sugar'], ['peanut butter', 'butter'],
    ['smoked paprika', 'paprika'], ['cream cheese', 'cream'], ['ground ginger', 'ginger'], ['dried minced onion', 'onion'], ['white pepper', 'pepper']]) assert.ok(!covers(have, need), `${have} doesn't cover ${need}`);
});

test('disliking an ingredient does not flag its oil', async () => {
  const { createAvoidMatcher } = await import('../server/lib/recipes.js');
  const hits = (terms, names, allergens = []) => createAvoidMatcher({ avoidIngredients: terms, avoidAllergens: allergens })(names);
  assert.deepEqual(hits(['olives'], ['extra virgin olive oil']), []);
  assert.deepEqual(hits(['olives'], ['kalamata olives']), ['olives']);
  assert.deepEqual(hits(['olive oil'], ['olive oil']), ['olive oil']);
  assert.deepEqual(hits(['avocado'], ['avocado oil']), []);
  assert.deepEqual(hits(['sesame'], ['toasted sesame oil']), []);
  assert.deepEqual(hits([], ['peanut oil'], ['peanuts']), ['Peanuts'], 'allergies still count oils');
});

test('oil exclusion handles caption spellings', async () => {
  const { createAvoidMatcher } = await import('../server/lib/recipes.js');
  const m = createAvoidMatcher({ avoidIngredients: ['olives'] });
  for (const n of ['Olive Oil', 'olive-oil spray', 'olive or avocado oil', 'olive/avocado oil', 'olive & avocado oil']) assert.deepEqual(m([n]), [], n);
  for (const n of ['olives and olive oil', 'olive tapenade', 'olives/capers']) assert.deepEqual(m([n]), ['olives'], n);
});

test('fridge life and the freeze / thaw plan', async () => {
  const { fridgeLife, freshnessPlan } = await import('../server/lib/freshness.js');
  assert.equal(fridgeLife('chicken thighs, boneless').days, 2);
  assert.equal(fridgeLife('lean minced steak').kind, 'ground meat');
  assert.equal(fridgeLife('sirloin steak').days, 4);
  assert.equal(fridgeLife('bacon').days, 7);
  for (const n of ['chicken broth', 'beef tomatoes', 'kidney beans', 'artichoke hearts', 'canned tuna', 'chicken breasts, cooked and shredded', 'prosciutto', 'onion']) assert.equal(fridgeLife(n), null, n);
  const r = (id, ings) => ({ id, name: id, ingredients: ings.map((name) => ({ name, measure: '1' })) });
  const byId = new Map([['a', r('a', ['chicken thighs', 'rice'])], ['b', r('b', ['ground beef'])], ['c', r('c', ['sirloin steak'])], ['d', r('d', ['raw frozen prawns'])]]);
  // Week starts Monday Oct 13; shopped Sunday Oct 12.
  const plan = { key: '2026-10-13', slots: [
    { id: '0-dinner', day: 0, meal: 'dinner', recipeId: 'a' }, // Mon: chicken, 1 day after shopping: fine
    { id: '2-dinner', day: 2, meal: 'dinner', recipeId: 'a' }, // Wed: chicken, 3 days: freeze
    { id: '3-dinner', day: 3, meal: 'dinner', recipeId: 'c' }, // Thu: steak, 4 days: fine
    { id: '4-dinner', day: 4, meal: 'dinner', recipeId: 'b' }, // Fri: ground beef from the freezer: thaw
    { id: '5-dinner', day: 5, meal: 'dinner', recipeId: 'd' }, // Sat: bought frozen: thaw
    { id: '6-dinner', day: 6, meal: 'dinner', recipeId: 'c', off: true },
  ] };
  const tasks = freshnessPlan({ plan, byId, shoppedOn: '2026-10-12', freezerMatch: (n) => (/ground beef/.test(n) ? { name: 'ground beef' } : null) });
  assert.deepEqual(tasks.map((t) => [t.slotId, t.thawOn, t.items.map((i) => `${i.name}:${i.why}`).join()]), [
    ['2-dinner', '2026-10-14', 'chicken thighs:freeze'],
    ['4-dinner', '2026-10-16', 'ground beef:freezer'],
    ['5-dinner', '2026-10-17', 'raw frozen prawns:freezer'],
  ]);
});
