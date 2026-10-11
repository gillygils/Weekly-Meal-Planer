// Recipes typed in (or finished) by hand in the app's recipe editor.
import { finalizeRecipe, mealTypesFor, MEAL_TYPES } from './recipes.js';
import { parseIngredientLine } from './grocery.js';
import { withNutrition } from './nutrition.js';

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/**
 * Build (or rebuild) a recipe from editor fields. Keeps the existing recipe's
 * id, favorite, price override and date when editing.
 */
export function buildCustomRecipe(input, existing = null) {
  const name = String(input.name || '').trim().slice(0, 120);
  if (!name) throw new Error('Give the recipe a name.');
  const ingredients = lines(input.ingredientsText).slice(0, 80).map(parseIngredientLine);
  if (!ingredients.length) throw new Error('Add at least one ingredient, one per line.');
  const manual = input.nutrition && Number(input.nutrition.kcal) > 0
    ? { calories: Number(input.nutrition.kcal), proteinContent: input.nutrition.protein, carbohydrateContent: input.nutrition.carbs, fatContent: input.nutrition.fat }
    : null;
  let sourceUrl = String(input.sourceUrl || '').trim();
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) sourceUrl = '';
  let image = String(input.image || '').trim();
  if (image && !/^https?:\/\//i.test(image)) image = '';
  const mealTypes = Array.isArray(input.mealTypes) ? input.mealTypes.filter((m) => MEAL_TYPES.includes(m)) : null;
  const r = finalizeRecipe({
    id: existing?.id || `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    source: existing?.source || (/tiktok\.com/i.test(sourceUrl) ? 'TikTok' : 'My recipes'),
    sourceUrl,
    creator: String(input.creator || existing?.creator || '').trim().slice(0, 60),
    name,
    category: existing?.category || '',
    cuisine: String(input.cuisine ?? existing?.cuisine ?? '').trim().slice(0, 40),
    image,
    servings: Number(input.servings) || existing?.servings || 4,
    totalMinutes: Number(input.totalMinutes) || null,
    tags: existing?.tags || [],
    ingredients,
    instructions: lines(input.instructionsText).slice(0, 60),
    mealTypes: mealTypes && mealTypes.length ? mealTypes : existing?.mealTypes || mealTypesFor('', [], name),
    reportedNutrition: manual,
    addedAt: existing?.addedAt,
    easy: input.easy == null ? existing?.easy ?? null : Boolean(input.easy),
  });
  r.favorite = existing?.favorite || false;
  r.costOverride = existing?.costOverride ?? null;
  r.custom = true;
  withNutrition(r);
  if (manual) r.nutrition.source = 'manual';
  return r;
}
