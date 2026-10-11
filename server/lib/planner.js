// Week plan structure and the randomizer.
import { MEAL_TYPES, recipeCost, createAvoidMatcher } from './recipes.js';

export const DAY_COUNT = 7;

export function slotId(day, meal) {
  return `${day}-${meal}`;
}

/** Make sure a plan has a slot for every day x enabled meal, keeping existing picks. */
export function ensureSlots(plan, meals) {
  const enabled = MEAL_TYPES.filter((m) => meals.includes(m));
  const existing = new Map((plan.slots || []).map((s) => [s.id, s]));
  const slots = [];
  for (let day = 0; day < DAY_COUNT; day++) {
    for (const meal of enabled) {
      const id = slotId(day, meal);
      slots.push(existing.get(id) || { id, day, meal, recipeId: null, locked: false });
    }
  }
  // Keep slots for meals that were disabled but still hold a locked pick, so nothing is lost.
  for (const s of plan.slots || []) {
    if (!enabled.includes(s.meal) && s.locked && s.recipeId) slots.push(s);
  }
  plan.slots = slots;
  return plan;
}

/**
 * Move a meal to another day by swapping it with that day's meal (or empty
 * slot). Every other day stays as it is, and each meal keeps its own lock.
 */
export function moveMeal(plan, meal, from, to) {
  const src = plan.slots.find((s) => s.meal === meal && s.day === from);
  const dst = plan.slots.find((s) => s.meal === meal && s.day === to);
  if (!src || !dst || from === to) return plan;
  [src.recipeId, dst.recipeId] = [dst.recipeId, src.recipeId];
  [src.locked, dst.locked] = [dst.locked, src.locked];
  plan.updatedAt = new Date().toISOString();
  return plan;
}

export function matchesFilters(recipe, meal, settings, { ignoreBudget = false } = {}) {
  if (recipe.hidden) return false;
  if (meal && !recipe.mealTypes.includes(meal)) return false;
  const excluded = settings.excludedProteins || [];
  if (excluded.length) {
    if (recipe.proteins.some((p) => excluded.includes(p))) return false;
    if (excluded.includes('vegetarian') && recipe.mainProtein === 'vegetarian') return false;
  }
  if (!ignoreBudget && settings.maxPricePerServing > 0 && recipeCost(recipe) > settings.maxPricePerServing) return false;
  return true;
}

function nameKey(r) {
  return r.name.toLowerCase().replace(/[^a-z]/g, '');
}

function weightedPick(candidates, settings, rng) {
  const weights = candidates.map((r) => (settings.favoritesBoost && r.favorite ? 3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Pick a recipe for one slot. Tries strict rules first (unique in week, not
 * used last week, within budget) and relaxes them only when nothing fits.
 */
export function pickRecipe({ meal, recipes, settings, usedIds, usedNames, recentIds, rng = Math.random }) {
  const passes = [
    { budget: true, recent: true, dupNames: true },
    { budget: true, recent: false, dupNames: true },
    { budget: true, recent: false, dupNames: false },
    { budget: false, recent: false, dupNames: false },
  ];
  for (const pass of passes) {
    const candidates = recipes.filter((r) =>
      matchesFilters(r, meal, settings, { ignoreBudget: !pass.budget }) &&
      !usedIds.has(r.id) &&
      !(pass.dupNames && usedNames.has(nameKey(r))) &&
      !(pass.recent && recentIds.has(r.id)));
    if (candidates.length) {
      if (!pass.budget) {
        // Over budget everywhere: lean towards the cheapest options.
        candidates.sort((a, b) => recipeCost(a) - recipeCost(b));
        return weightedPick(candidates.slice(0, Math.max(3, Math.ceil(candidates.length / 5))), settings, rng);
      }
      return weightedPick(candidates, settings, rng);
    }
  }
  return null;
}

/** Fill all unlocked slots (or just `onlySlotId`) with random recipes. */
export function randomizePlan(plan, recipes, settings, { recentIds = new Set(), onlySlotId = null, rng = Math.random } = {}) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  // Allergies & dislikes are a hard rule: those recipes are never candidates.
  const avoid = createAvoidMatcher(settings);
  const pool = recipes.filter((r) => !avoid(r.ingredients.map((i) => i.name)).length);
  const usedIds = new Set();
  const usedNames = new Set();
  const reroll = (s) => !s.locked && (!onlySlotId || s.id === onlySlotId);
  for (const s of plan.slots) {
    if (!reroll(s) && s.recipeId && byId.has(s.recipeId)) {
      usedIds.add(s.recipeId);
      usedNames.add(nameKey(byId.get(s.recipeId)));
    }
  }
  for (const s of plan.slots) {
    if (!reroll(s)) continue;
    // Re-rolling a single slot should give something different from what's there now.
    if (onlySlotId && s.recipeId) usedIds.add(s.recipeId);
    const pick = pickRecipe({ meal: s.meal, recipes: pool, settings, usedIds, usedNames, recentIds, rng });
    s.recipeId = pick ? pick.id : null;
    if (pick) {
      usedIds.add(pick.id);
      usedNames.add(nameKey(pick));
    }
  }
  plan.updatedAt = new Date().toISOString();
  return plan;
}
