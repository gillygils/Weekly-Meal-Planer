// Week plan structure and the randomizer.
import { MEAL_TYPES, recipeCost, createAvoidMatcher, isEasyRecipe, isRecoveryRecipe } from './recipes.js';

export const DAY_COUNT = 7;

export function slotId(day, meal) {
  return `${day}-${meal}`;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Weekday (0 = Sunday) of day index `day` in the week starting on plan.key. */
export function weekdayOf(planKey, day) {
  const start = planKey ? new Date(`${planKey}T00:00:00Z`).getUTCDay() : 1;
  return (start + day) % 7;
}

/**
 * Make sure a plan has a slot for every day x enabled meal, keeping existing picks.
 * Marks slots `off` ("fend for yourself") from the meal-days setting, unless a
 * slot has its own `skip` override (true = skip this one, false = plan it anyway).
 */
export function ensureSlots(plan, meals, mealDays = null) {
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
  for (const s of slots) {
    const days = mealDays?.[s.meal] || ALL_DAYS;
    s.off = s.skip != null ? Boolean(s.skip) : !days.includes(weekdayOf(plan.key, s.day));
  }
  plan.slots = slots;
  return plan;
}

/** Slots that actually need food (not switched off). */
export const activeSlots = (plan) => plan.slots.filter((s) => !s.off);

/**
 * Move a meal to another day by swapping it with that day's meal (or empty
 * slot). Every other day stays as it is, and each meal keeps its own lock.
 */
export function moveMeal(plan, meal, from, to) {
  const src = plan.slots.find((s) => s.meal === meal && s.day === from);
  const dst = plan.slots.find((s) => s.meal === meal && s.day === to);
  if (!src || !dst || from === to || src.off || dst.off) return plan;
  [src.recipeId, dst.recipeId] = [dst.recipeId, src.recipeId];
  [src.locked, dst.locked] = [dst.locked, src.locked];
  plan.updatedAt = new Date().toISOString();
  return plan;
}

export const HEALTHY_SCORE = 65;

/** Health goals from settings: "healthier meals", max calories and min protein per serving. */
export function meetsHealthGoals(recipe, settings) {
  const n = recipe.nutrition;
  if (settings.healthFocus && (recipe.healthScore ?? 0) < HEALTHY_SCORE) return false;
  if (settings.maxCalories > 0 && (!n || n.kcal > settings.maxCalories)) return false;
  if (settings.minProtein > 0 && (!n || (n.protein ?? 0) < settings.minProtein)) return false;
  return true;
}

export function matchesFilters(recipe, meal, settings, { ignoreBudget = false, ignoreHealth = false } = {}) {
  if (recipe.hidden) return false;
  if (meal && !recipe.mealTypes.includes(meal)) return false;
  const excluded = settings.excludedProteins || [];
  if (excluded.length) {
    if (recipe.proteins.some((p) => excluded.includes(p))) return false;
    if (excluded.includes('vegetarian') && recipe.mainProtein === 'vegetarian') return false;
  }
  if (!ignoreBudget && settings.maxPricePerServing > 0 && recipeCost(recipe) > settings.maxPricePerServing) return false;
  if (!ignoreHealth && !meetsHealthGoals(recipe, settings)) return false;
  return true;
}

function nameKey(r) {
  return r.name.toLowerCase().replace(/[^a-z]/g, '');
}

// Words that don't tell dishes apart ("Chicken Alfredo" and "Fettuccine Alfredo" are the same idea).
const FILLER = new Set(('a an and the with of in on for to my easy quick simple homemade best classic style recipe one pot pan sheet skillet '
  + 'minute healthy chicken beef pork turkey shrimp fish salmon tuna tofu sausage steak ground pasta rice').split(' '));

/** The words that make a dish what it is, e.g. "Chicken Alfredo Pasta" -> {alfredo}. */
export function dishWords(r) {
  const words = r.name.toLowerCase().normalize('NFD').replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER.has(w))
    .map((w) => w.replace(/(?<=[^s])s$/, '').replace(/^fettucine$/, 'fettuccine'));
  return new Set(words.length ? words : [nameKey(r)]);
}

/** Two dishes are "the same thing" when they share at least half of their key words. */
export function sameDish(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared > 0 && shared / Math.max(a.size, b.size) >= 0.5;
}

// How many recent picks per week the randomizer remembers so it doesn't keep offering them again.
const SEEN_LIMIT = 40;

function weightedPick(candidates, settings, rng, preferEasy = false) {
  const weights = candidates.map((r) => {
    let w = settings.favoritesBoost && r.favorite ? 3 : 1;
    // On easy days, the hand-picked easy meals (grilled cheese, tacos…) come up most.
    if (preferEasy && r.easy === true) w *= 3;
    // In postpartum mode the built-in recovery meals come up more than other good matches.
    if (settings.postpartumMode && r.postpartum === true) w *= 3;
    // With "healthier meals" on, the healthiest options come up more often too.
    if (settings.healthFocus && r.healthScore != null) w *= 0.5 + r.healthScore / 50;
    return w;
  });
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
export function pickRecipe({ meal, recipes, settings, usedIds, usedNames, recentIds, usedDishes = [], seenIds = new Set(), seenDishes = [], rng = Math.random, preferEasy = false }) {
  // `seen` = shown recently in this week (re-rolls), `dupNames` = the same dish elsewhere this week.
  const passes = [
    { budget: true, health: true, recent: true, dupNames: true, seen: true },
    { budget: true, health: true, recent: false, dupNames: true, seen: true },
    { budget: true, health: true, recent: false, dupNames: true, seen: false },
    { budget: true, health: true, recent: false, dupNames: false, seen: false },
    { budget: true, health: false, recent: false, dupNames: false, seen: false },
    { budget: false, health: false, recent: false, dupNames: false, seen: false },
  ];
  const dish = new Map();
  const dishOf = (r) => dish.get(r.id) || dish.set(r.id, dishWords(r)).get(r.id);
  for (const pass of passes) {
    const candidates = recipes.filter((r) =>
      matchesFilters(r, meal, settings, { ignoreBudget: !pass.budget, ignoreHealth: !pass.health }) &&
      !usedIds.has(r.id) &&
      !(pass.dupNames && (usedNames.has(nameKey(r)) || usedDishes.some((d) => sameDish(d, dishOf(r))))) &&
      !(pass.seen && (seenIds.has(r.id) || seenDishes.some((d) => sameDish(d, dishOf(r))))) &&
      !(pass.recent && recentIds.has(r.id)));
    if (candidates.length) {
      if (!pass.budget) {
        // Over budget everywhere: lean towards the cheapest options.
        candidates.sort((a, b) => recipeCost(a) - recipeCost(b));
        return weightedPick(candidates.slice(0, Math.max(3, Math.ceil(candidates.length / 5))), settings, rng, preferEasy);
      }
      return weightedPick(candidates, settings, rng, preferEasy);
    }
  }
  return null;
}

export const isEasy = (r) => (typeof r.easyFlag === 'boolean' ? r.easyFlag : isEasyRecipe(r));
export const isRecovery = (r) => (r.postpartum != null ? Boolean(r.postpartum) : typeof r.recoveryFlag === 'boolean' ? r.recoveryFlag : isRecoveryRecipe(r));

/** True when this slot falls on one of the "easy meals" days in Settings. */
export const wantsEasy = (plan, s, settings) => (settings.easyDays || []).includes(weekdayOf(plan.key, s.day));

/** Fill unlocked meals with random recipes: the whole week, one day (`onlyDay`) or one meal (`onlySlotId`). */
export function randomizePlan(plan, recipes, settings, { recentIds = new Set(), onlySlotId = null, onlyDay = null, onlyIf = null, rng = Math.random } = {}) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  // Allergies & dislikes are a hard rule: those recipes are never candidates.
  const avoid = createAvoidMatcher(settings);
  const pool = recipes.filter((r) => !avoid(r.ingredients.map((i) => i.name)).length);
  const easyPool = pool.filter(isEasy);
  const recovery = Boolean(settings.postpartumMode);
  const recoveryPool = recovery ? pool.filter(isRecovery) : [];
  const recoveryEasyPool = recoveryPool.filter(isEasy);
  const usedIds = new Set();
  const usedNames = new Set();
  const usedDishes = [];
  // Recipes this week has already shown, so repeated clicks keep bringing up something new.
  plan.seen = (plan.seen || []).filter((id) => byId.has(id));
  for (const s of plan.slots) if (s.recipeId && byId.has(s.recipeId) && !plan.seen.includes(s.recipeId)) plan.seen.push(s.recipeId);
  const seenIds = new Set(plan.seen);
  const seenDishes = plan.seen.map((id) => dishWords(byId.get(id)));
  const reroll = (s) => !s.locked && !s.off && (onlySlotId ? s.id === onlySlotId : onlyDay != null ? s.day === onlyDay : onlyIf ? onlyIf(s) : true);
  for (const s of plan.slots) {
    if (!reroll(s) && s.recipeId && byId.has(s.recipeId)) {
      usedIds.add(s.recipeId);
      usedNames.add(nameKey(byId.get(s.recipeId)));
      usedDishes.push(dishWords(byId.get(s.recipeId)));
    }
  }
  for (const s of plan.slots) {
    if (!reroll(s)) continue;
    // Re-rolling a single slot should give something different from what's there now.
    if ((onlySlotId || onlyDay != null) && s.recipeId) usedIds.add(s.recipeId);
    // Easy days pick from the easy recipes first; postpartum mode from the recovery
    // recipes. With both, easy recovery meals come first, then any easy meal, then any
    // recovery meal, and only then everything else.
    const args = { meal: s.meal, settings, usedIds, usedNames, usedDishes, seenIds, seenDishes, recentIds, rng };
    const easy = wantsEasy(plan, s, settings);
    const tiers = [
      ...(easy && recovery ? [[recoveryEasyPool, true]] : []),
      ...(easy ? [[easyPool, true]] : []),
      ...(recovery ? [[recoveryPool, false]] : []),
      [pool, false],
    ];
    let pick = null;
    for (const [recipes, preferEasy] of tiers) if ((pick = pickRecipe({ ...args, recipes, preferEasy }))) break;
    s.recipeId = pick ? pick.id : null;
    if (pick) {
      usedIds.add(pick.id);
      usedNames.add(nameKey(pick));
      usedDishes.push(dishWords(pick));
      plan.seen.push(pick.id);
    }
  }
  plan.seen = [...new Set(plan.seen)].slice(-SEEN_LIMIT);
  plan.updatedAt = new Date().toISOString();
  return plan;
}
