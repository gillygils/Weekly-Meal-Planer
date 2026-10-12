// Tiny JSON-file database. Everything lives in DATA_DIR/db.json so the whole
// app can be backed up by copying one file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withNutrition, NUTRITION_VERSION } from './lib/nutrition.js';
import { finalizeRecipe, isEasyRecipe } from './lib/recipes.js';
import { parseIngredientLine } from './lib/grocery.js';
import { easyMealDrafts } from './lib/easy-meals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(here, 'seed', 'recipes.json');

export const DEFAULT_SETTINGS = {
  householdSize: 4,
  meals: ['dinner'],
  // Which weekdays (0 = Sunday) each meal is needed; the rest are "fend for yourself".
  mealDays: { breakfast: [0, 1, 2, 3, 4, 5, 6], lunch: [0, 1, 2, 3, 4, 5, 6], dinner: [0, 1, 2, 3, 4, 5, 6] },
  maxPricePerServing: 0, // 0 = no limit
  excludedProteins: [],
  avoidAllergens: [],
  avoidIngredients: [],
  favoritesBoost: true,
  healthFocus: false,
  maxCalories: 0, // per serving, 0 = no limit
  minProtein: 0, // grams per serving
  dailyCalories: 0, // per person, 0 = no target
  dailyProtein: 0,
  stores: ['meijer', 'aldi'],
  storeLevels: {}, // price level overrides, % vs. average
  tripThreshold: 5, // a second store trip has to save at least this much
  countPantry: false, // include spices, oils and sauces in price totals
  showPriceTabs: false, // the Prices and Shop plan views on the Groceries tab
  creators: [
    { name: 'Hunt4Shredz', handle: '@hunt4shredz', url: 'https://www.hunt4shredz.com' },
    { name: 'AmateurProChef', handle: '@amateurprochef', url: 'https://amateurprochef.com' },
  ],
  currency: '$',
  weekStartsOn: 1, // 0 = Sunday, 1 = Monday
  easyDays: [], // weekdays (0 = Sunday) where the randomizer picks easy meals
  freezeAlerts: true, // warn when meat would sit in the fridge too long, and remind to thaw it
  timeZone: '', // the household's time zone (set by the browser), for reminder times
  ntfyTopic: '', // phone notifications through ntfy; empty = off
  ntfyServer: 'https://ntfy.sh',
  thawHour: 18, // local hour for "move it to the fridge tonight" reminders
};

export function sanitizeSettings(input, base = DEFAULT_SETTINGS) {
  const s = { ...base };
  if (input.householdSize != null) s.householdSize = Math.min(30, Math.max(1, Math.round(Number(input.householdSize) || 1)));
  if (Array.isArray(input.meals)) {
    const meals = input.meals.filter((m) => ['breakfast', 'lunch', 'dinner'].includes(m));
    if (meals.length) s.meals = meals;
  }
  if (input.mealDays && typeof input.mealDays === 'object') {
    s.mealDays = { ...base.mealDays };
    for (const m of ['breakfast', 'lunch', 'dinner']) {
      if (Array.isArray(input.mealDays[m])) s.mealDays[m] = [...new Set(input.mealDays[m].map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    }
  }
  if (input.maxPricePerServing != null) s.maxPricePerServing = Math.max(0, Math.round((Number(input.maxPricePerServing) || 0) * 100) / 100);
  if (Array.isArray(input.excludedProteins)) s.excludedProteins = input.excludedProteins.map(String).slice(0, 20);
  if (Array.isArray(input.avoidAllergens)) s.avoidAllergens = [...new Set(input.avoidAllergens.map(String))].slice(0, 20);
  if (Array.isArray(input.avoidIngredients)) {
    s.avoidIngredients = [...new Set(input.avoidIngredients.map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, 60);
  }
  if (input.healthFocus != null) s.healthFocus = Boolean(input.healthFocus);
  for (const k of ['maxCalories', 'minProtein', 'dailyCalories', 'dailyProtein']) {
    if (input[k] != null) s[k] = Math.min(10000, Math.max(0, Math.round(Number(input[k]) || 0)));
  }
  if (Array.isArray(input.creators)) {
    s.creators = input.creators.slice(0, 30).map((c) => ({
      name: String(c.name || '').trim().slice(0, 40),
      handle: String(c.handle || '').trim().slice(0, 40),
      url: /^https?:\/\//i.test(String(c.url || '')) ? String(c.url).trim().slice(0, 200) : '',
    })).filter((c) => c.name && c.url);
  }
  if (Array.isArray(input.stores)) s.stores = [...new Set(input.stores.map(String))].filter((k) => /^[a-z-]{2,20}$/.test(k)).slice(0, 2);
  if (input.storeLevels && typeof input.storeLevels === 'object') {
    s.storeLevels = Object.fromEntries(Object.entries(input.storeLevels)
      .filter(([k, v]) => /^[a-z-]{2,20}$/.test(k) && v !== '' && v != null && Number.isFinite(Number(v)))
      .map(([k, v]) => [k, Math.max(-60, Math.min(100, Math.round(Number(v))))]));
  }
  if (input.tripThreshold != null) s.tripThreshold = Math.max(0, Math.min(500, Number(input.tripThreshold) || 0));
  if (input.countPantry != null) s.countPantry = Boolean(input.countPantry);
  if (input.showPriceTabs != null) s.showPriceTabs = Boolean(input.showPriceTabs);
  if (input.favoritesBoost != null) s.favoritesBoost = Boolean(input.favoritesBoost);
  if (input.currency != null) s.currency = String(input.currency).slice(0, 4) || '$';
  if (Array.isArray(input.easyDays)) s.easyDays = [...new Set(input.easyDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (input.freezeAlerts != null) s.freezeAlerts = Boolean(input.freezeAlerts);
  if (input.timeZone != null && /^[A-Za-z_+\-/0-9]{0,64}$/.test(String(input.timeZone))) s.timeZone = String(input.timeZone);
  if (input.ntfyTopic != null) s.ntfyTopic = String(input.ntfyTopic).trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (input.ntfyServer != null) s.ntfyServer = /^https?:\/\/[^\s]+$/i.test(String(input.ntfyServer).trim()) ? String(input.ntfyServer).trim().slice(0, 200) : 'https://ntfy.sh';
  if (input.thawHour != null) s.thawHour = Math.min(23, Math.max(0, Math.round(Number(input.thawHour) || 0)));
  if (input.weekStartsOn != null) s.weekStartsOn = Number(input.weekStartsOn) === 0 ? 0 : 1;
  return s;
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'db.json');
    this.timer = null;
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = this.load();
    this.mergeSeed();
    this.backfillNutrition();
    this.saveNow();
  }

  load() {
    if (fs.existsSync(this.file)) {
      const db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      db.settings = sanitizeSettings(db.settings || {}, DEFAULT_SETTINGS);
      db.recipes ||= [];
      db.weeks ||= {};
      db.priceBook ||= {};
      db.pantry ||= [];
      return db;
    }
    return { version: 1, settings: { ...DEFAULT_SETTINGS }, recipes: [], weeks: {}, priceBook: {}, pantry: [] };
  }

  /** Add any bundled recipes that aren't in the database yet (never overwrites user edits). */
  mergeSeed() {
    if (!fs.existsSync(SEED_FILE)) return 0;
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    const easy = easyMealDrafts(parseIngredientLine).map((d) => withNutrition(finalizeRecipe(d)));
    return this.addRecipes([...seed, ...easy]);
  }

  /** Add or refresh macros on recipes saved before nutrition existed (or an older estimate). */
  backfillNutrition() {
    let n = 0;
    for (const r of this.db.recipes) {
      if (typeof r.easyFlag !== 'boolean') r.easyFlag = isEasyRecipe(r);
      if (r.nutrition?.version === NUTRITION_VERSION || r.nutrition?.source === 'manual') continue;
      // Older TheMealDB imports assumed 4 servings; let the estimator correct that.
      if (r.id.startsWith('mealdb-') && r.servingsEstimated == null) r.servingsEstimated = true;
      withNutrition(r);
      n++;
    }
    return n;
  }

  addRecipes(list) {
    const have = new Set(this.db.recipes.map((r) => r.id));
    let added = 0;
    for (const r of list) {
      if (!have.has(r.id)) {
        this.db.recipes.push(r);
        have.add(r.id);
        added++;
      }
    }
    if (added) this.save();
    return added;
  }

  recipe(id) {
    return this.db.recipes.find((r) => r.id === id);
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(), 200);
  }

  saveNow() {
    clearTimeout(this.timer);
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
  }
}
