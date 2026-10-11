// Tiny JSON-file database. Everything lives in DATA_DIR/db.json so the whole
// app can be backed up by copying one file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(here, 'seed', 'recipes.json');

export const DEFAULT_SETTINGS = {
  householdSize: 4,
  meals: ['dinner'],
  maxPricePerServing: 0, // 0 = no limit
  excludedProteins: [],
  favoritesBoost: true,
  currency: '$',
  weekStartsOn: 1, // 0 = Sunday, 1 = Monday
};

export function sanitizeSettings(input, base = DEFAULT_SETTINGS) {
  const s = { ...base };
  if (input.householdSize != null) s.householdSize = Math.min(30, Math.max(1, Math.round(Number(input.householdSize) || 1)));
  if (Array.isArray(input.meals)) {
    const meals = input.meals.filter((m) => ['breakfast', 'lunch', 'dinner'].includes(m));
    if (meals.length) s.meals = meals;
  }
  if (input.maxPricePerServing != null) s.maxPricePerServing = Math.max(0, Math.round((Number(input.maxPricePerServing) || 0) * 100) / 100);
  if (Array.isArray(input.excludedProteins)) s.excludedProteins = input.excludedProteins.map(String).slice(0, 20);
  if (input.favoritesBoost != null) s.favoritesBoost = Boolean(input.favoritesBoost);
  if (input.currency != null) s.currency = String(input.currency).slice(0, 4) || '$';
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
    this.saveNow();
  }

  load() {
    if (fs.existsSync(this.file)) {
      const db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      db.settings = sanitizeSettings(db.settings || {}, DEFAULT_SETTINGS);
      db.recipes ||= [];
      db.weeks ||= {};
      return db;
    }
    return { version: 1, settings: { ...DEFAULT_SETTINGS }, recipes: [], weeks: {} };
  }

  /** Add any bundled recipes that aren't in the database yet (never overwrites user edits). */
  mergeSeed() {
    if (!fs.existsSync(SEED_FILE)) return 0;
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    return this.addRecipes(seed);
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
