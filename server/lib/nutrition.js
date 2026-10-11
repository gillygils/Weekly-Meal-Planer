// Per-serving macros and a simple health score for each recipe.
import { lookupIngredient, toGrams } from './ingredients.js';
import { parseMeasure } from './grocery.js';

// Bump when the estimate logic changes so stored recipes get recalculated.
export const NUTRITION_VERSION = 4;

const NEGLIGIBLE = /^(to taste|pinch|dash|garnish|to serve|for serving|for garnish|as needed|as required|optional|sprinkl|drizzle|splash|spray|few|a little)/i;

// When a recipe gives no amount at all, assume a typical amount per serving.
function defaultGramsPerServing(entry) {
  if (entry.pantry) return 4;
  if (entry.loose || /beef|pork|chicken|lamb|turkey|fish|salmon|shrimp|tofu/.test(entry.words[0])) return 140;
  if (entry.each) return Math.min(entry.each, 120) / 2;
  return 40;
}

/**
 * Estimate per-serving nutrition from the ingredient list.
 * Returns { kcal, protein, carbs, fat, fiber, source, coverage }.
 */
export function estimateNutrition(recipe) {
  const servings = recipe.servings || 4;
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let counted = 0;
  let known = 0;
  let guessed = 0;
  for (const ing of recipe.ingredients || []) {
    const entry = lookupIngredient(ing.name);
    const m = parseMeasure(ing.measure);
    if (!m.qty && NEGLIGIBLE.test(m.note || ing.measure || '')) continue;
    if (entry?.free) continue;
    counted++;
    if (!entry) continue;
    let grams = toGrams(m.qty, m.unit, entry);
    if (grams == null) {
      if (m.qty == null && !ing.measure) {
        grams = defaultGramsPerServing(entry) * servings;
        guessed++;
      } else {
        continue;
      }
    }
    // Deep-frying oil mostly stays in the pan: count about 8% of anything past ~7 tbsp.
    if (entry.words.includes('oil') && grams > 100) grams = 100 + (grams - 100) * 0.08;
    known++;
    const f = grams / 100;
    for (const k of Object.keys(total)) total[k] += entry.n[k] * f;
  }
  const per = Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / servings]));
  const coverage = counted ? known / counted : 0;
  return {
    kcal: Math.round(per.kcal),
    protein: Math.round(per.protein),
    carbs: Math.round(per.carbs),
    fat: Math.round(per.fat),
    fiber: Math.round(per.fiber),
    source: coverage >= 0.75 && guessed / Math.max(1, known) < 0.5 ? 'estimate' : 'rough',
    coverage: Math.round(coverage * 100) / 100,
  };
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Nutrition the recipe itself published (schema.org NutritionInformation or similar). */
export function reportedNutrition(raw) {
  if (!raw) return null;
  const kcal = num(raw.calories ?? raw.kcal);
  const protein = num(raw.proteinContent ?? raw.protein);
  if (kcal == null || kcal <= 0) return null;
  return {
    kcal: Math.round(kcal),
    protein: protein != null ? Math.round(protein) : null,
    carbs: num(raw.carbohydrateContent ?? raw.carbs) != null ? Math.round(num(raw.carbohydrateContent ?? raw.carbs)) : null,
    fat: num(raw.fatContent ?? raw.fat) != null ? Math.round(num(raw.fatContent ?? raw.fat)) : null,
    fiber: num(raw.fiberContent ?? raw.fiber) != null ? Math.round(num(raw.fiberContent ?? raw.fiber)) : null,
    source: 'recipe',
    coverage: 1,
  };
}

const PRODUCE = /onion|garlic|tomato|pepper|carrot|celery|spinach|kale|broccoli|cauliflower|zucchini|courgette|eggplant|aubergine|mushroom|cabbage|lettuce|cucumber|pea|bean|asparagus|leek|squash|pumpkin|avocado|lemon|lime|apple|berr|mango|corn|chard|greens|salad|herb|parsley|cilantro|coriander|basil/;

/** 0-100. Rewards protein and fiber, penalizes very high calories, fat-heavy and deep-fried meals. */
export function healthScore(recipe, n) {
  if (!n || !n.kcal) return null;
  let s = 42;
  const p = n.protein || 0;
  s += (Math.min(p, 45) / 45) * 25;
  const density = (p * 4) / n.kcal;
  if (density >= 0.3) s += 10;
  else if (density >= 0.2) s += 5;
  if (n.kcal >= 300 && n.kcal <= 650) s += 10;
  else if (n.kcal > 1100) s -= 25;
  else if (n.kcal > 850) s -= 15;
  else if (n.kcal > 650) s -= 4;
  else if (n.kcal < 250) s -= 5;
  if (n.fat != null) {
    const fatPct = (n.fat * 9) / n.kcal;
    if (fatPct > 0.5) s -= 15;
    else if (fatPct > 0.4) s -= 7;
  }
  if (n.fiber >= 6) s += 8;
  else if (n.fiber >= 3) s += 4;
  const veg = new Set((recipe.ingredients || []).map((i) => i.name.toLowerCase()).filter((x) => PRODUCE.test(x))).size;
  if (veg >= 3) s += 5;
  const text = `${recipe.name} ${(recipe.instructions || []).join(' ')}`.toLowerCase();
  if (/deep[- ]?fr(y|ied)|fry .{0,30}until golden.{0,40}(oil|batch)|heat (the )?oil to 1[78]\d/.test(text)) s -= 10;
  return Math.max(0, Math.min(100, Math.round(s)));
}

/** Attach nutrition + health score to a recipe (prefers numbers the recipe publishes). */
/**
 * TheMealDB doesn't say how many a recipe serves, so we assumed 4. Use the total
 * weight of food instead (~450 g a portion) so a 2.5 kg lamb shoulder isn't "4 servings".
 */
export function guessServings(recipe) {
  let grams = 0;
  for (const ing of recipe.ingredients || []) {
    const entry = lookupIngredient(ing.name);
    if (!entry || entry.free) continue;
    const m = parseMeasure(ing.measure);
    let g = toGrams(m.qty, m.unit, entry);
    if (g == null) continue;
    if (entry.words.includes('oil') && g > 100) g = 100;
    if (entry.words.includes('stock') || entry.words.includes('milk')) g *= 0.5; // liquids cook down
    grams += g;
  }
  // Only ever raise it: missing weights would otherwise make small recipes look like 2 portions.
  return Math.max(4, Math.min(10, Math.round(grams / 450) || 4));
}

export function withNutrition(recipe) {
  if (recipe.servingsEstimated) recipe.servings = guessServings(recipe);
  const reported = reportedNutrition(recipe.reportedNutrition);
  let n = estimateNutrition(recipe);
  if (reported) {
    // Fill any macros the recipe didn't publish by scaling our estimate to its calories.
    const scale = n.kcal ? reported.kcal / n.kcal : 0;
    n = {
      ...reported,
      protein: reported.protein ?? Math.round(n.protein * scale),
      carbs: reported.carbs ?? Math.round(n.carbs * scale),
      fat: reported.fat ?? Math.round(n.fat * scale),
      fiber: reported.fiber ?? Math.round(n.fiber * scale),
    };
  }
  recipe.nutrition = { ...n, version: NUTRITION_VERSION };
  recipe.healthScore = healthScore(recipe, n);
  return recipe;
}
