// Weekly Meal Planner server. Zero dependencies: plain Node http + a JSON file.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store, sanitizeSettings } from './store.js';
import { ensureSlots, randomizePlan, moveMeal, activeSlots, isEasy, wantsEasy } from './lib/planner.js';
import { pantryMatch, autoPlace, PLACES, STAPLES } from './lib/pantry.js';
import { aiScanEnabled, scanPhotos, lookupBarcode, ScanError } from './lib/scan.js';
import { freshnessPlan, localNow, addDaysIso } from './lib/freshness.js';
import { cachedImage } from './lib/images.js';
import { sendNotification, listNames } from './lib/notify.js';
import { buildGroceryList, normalizeIngredientName, aisleFor } from './lib/grocery.js';
import { fetchAllSources, importLink, normalizeUrl, pullCreatorSite, SUGGESTED_CREATORS } from './lib/sources.js';
import { buildCustomRecipe } from './lib/custom.js';
import { priceGroceryList, STORES } from './lib/pricing.js';
import { PIN_RE, hashPin, verifyPin, createSession, sessionValid, endSession, pruneSessions, readCookie, sessionCookie, clearCookie, clientIp, Throttle } from './lib/pin.js';
import { PROTEINS, ALLERGEN_GROUPS, isRecoveryRecipe } from './lib/recipes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data'));
const PASSWORD = process.env.APP_PASSWORD || '';

const store = new Store(DATA_DIR);

// Forgot the PIN? `touch $DATA_DIR/reset-pin` and restart: the PIN is cleared
// and the next visitor is asked to set a new one.
const RESET_FILE = path.join(DATA_DIR, 'reset-pin');
if (fs.existsSync(RESET_FILE)) {
  delete store.db.auth;
  store.saveNow();
  fs.rmSync(RESET_FILE);
  console.log('PIN cleared. Open the app to set a new one.');
}
const throttle = new Throttle();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(data);
}

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function checkAuth(req, res) {
  if (!PASSWORD) return true;
  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const pass = encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '';
  const a = Buffer.from(pass);
  const b = Buffer.from(PASSWORD);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  res.writeHead(401, { 'www-authenticate': 'Basic realm="Meal Planner"', 'content-type': 'text/plain' });
  res.end('Authentication required');
  return false;
}

// ---------- helpers ----------

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function getWeek(key, create = true) {
  if (!WEEK_RE.test(key) || Number.isNaN(Date.parse(key))) throw new HttpError(400, 'Week must be YYYY-MM-DD');
  let plan = store.db.weeks[key];
  if (!plan) {
    if (!create) return null;
    plan = { key, slots: [], checked: {}, extras: [], createdAt: new Date().toISOString() };
    store.db.weeks[key] = plan;
  }
  ensureSlots(plan, store.db.settings.meals, store.db.settings.mealDays);
  return plan;
}

function recentIds(key) {
  const ids = new Set();
  for (const k of [addDays(key, -7), addDays(key, 7)]) {
    const p = store.db.weeks[k];
    for (const s of p?.slots || []) if (s.recipeId) ids.add(s.recipeId);
  }
  return ids;
}

function summary(r) {
  const { instructions, ingredients, ...rest } = r;
  return { ...rest, recoveryFlag: isRecoveryRecipe(r), ingredientCount: ingredients.length, ingredientNames: ingredients.map((i) => i.name) };
}

function groceryFor(plan) {
  const byId = new Map(store.db.recipes.map((r) => [r.id, r]));
  plan.needAnyway ||= {};
  // Pantry items marked "running low" go on the list until they're ticked off in the
  // cart; they stay on this week's list (ticked) after that so the trip still adds up.
  const restocking = (p) => p.low || p.restockedWeek === plan.key;
  const lowShown = new Set();
  const list = buildGroceryList(activeSlots(plan), byId, store.db.settings.householdSize)
    .map((i) => {
      const p = plan.needAnyway[i.key] ? null : pantryMatch(i.key, store.db.pantry);
      const base = { ...i, checked: Boolean(plan.checked[i.key]) };
      if (p && restocking(p)) {
        lowShown.add(p.id);
        return { ...base, have: null, low: { id: p.id, name: p.name } };
      }
      return { ...base, have: p ? { id: p.id, name: p.name, where: p.where } : null };
    });
  for (const p of store.db.pantry) {
    if (!restocking(p) || lowShown.has(p.id)) continue;
    const key = normalizeIngredientName(p.name);
    if (!key || list.some((i) => i.key === key)) continue;
    list.push({ key, name: p.name.charAt(0).toUpperCase() + p.name.slice(1), aisle: aisleFor(key), amount: '', recipes: [], totals: {},
      checked: Boolean(plan.checked[key]), have: null, low: { id: p.id, name: p.name } });
  }
  const pricing = priceGroceryList(list, store.db.settings, store.db.priceBook);
  const byKey = new Map(pricing.items.map((p) => [p.key, p]));
  const items = list.map(({ totals, ...i }) => {
    const p = byKey.get(i.key);
    return p ? { ...i, price: { buy: p.buy, at: p.at, best: p.best, pantry: p.pantry } } : i;
  });
  const freshness = freshnessFor(plan);
  // Tag the meat you should freeze when you unpack, with the day it's for.
  const freezeBy = new Map();
  for (const t of freshness.tasks) for (const i of t.items) if (i.why === 'freeze') {
    const k = normalizeIngredientName(i.name);
    freezeBy.set(k, [...(freezeBy.get(k) || []), t.date]);
  }
  for (const i of items) if (freezeBy.has(i.key)) i.freezeFor = [...new Set(freezeBy.get(i.key))].sort();
  return { week: plan.key, items, extras: plan.extras, freshness, pricing: { stores: pricing.stores, totals: pricing.totals, plan: pricing.plan, realCount: pricing.realCount } };
}

/**
 * Which meals need their meat frozen after shopping, and when to thaw it.
 * Before you've shopped it assumes the day before the week starts (or today).
 */
function freshnessFor(plan) {
  const settings = store.db.settings;
  if (!settings.freezeAlerts) return { shoppedOn: plan.shoppedOn || null, assumed: false, tasks: [] };
  const today = localNow(settings.timeZone).date;
  const weekEnd = addDaysIso(plan.key, 6);
  const assumedDay = today >= plan.key && today <= weekEnd ? today : addDaysIso(plan.key, -1);
  const shoppedOn = plan.shoppedOn || assumedDay;
  const byId = new Map(store.db.recipes.map((r) => [r.id, r]));
  const freezerMatch = (name) => {
    const p = pantryMatch(name, store.db.pantry);
    return p && p.where === 'freezer' && !p.low ? p : null;
  };
  return { shoppedOn, assumed: !plan.shoppedOn, tasks: freshnessPlan({ plan, byId, shoppedOn, freezerMatch }) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayName = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
let appOrigin = '';

/** Phone notification, if set up. Failures are logged, never thrown at the user. */
async function notify(msg) {
  if (!store.db.settings.ntfyTopic) return false;
  try {
    await sendNotification(store.db.settings, { ...msg, click: appOrigin ? `${appOrigin}/#plan` : undefined });
    return true;
  } catch (e) {
    console.error('Notification failed:', e.message);
    return false;
  }
}

/** "Freeze when you unpack" right after the list gets ticked off. */
function notifyFreeze(plan) {
  const freeze = freshnessFor(plan).tasks.flatMap((t) => t.items.filter((i) => i.why === 'freeze').map((i) => `${i.name} (${dayName(t.date)})`));
  if (freeze.length) notify({ title: 'Freeze when you unpack', message: `Put these in the freezer: ${listNames(freeze)}. You'll get a reminder to thaw each one the night before.`, tags: ['snowflake'] });
}

/** Evening-before reminders to move frozen meat to the fridge. Runs every few minutes. */
async function thawReminders() {
  const settings = store.db.settings;
  if (!settings.ntfyTopic || !settings.freezeAlerts) return;
  const now = localNow(settings.timeZone);
  if (now.hour < settings.thawHour) return;
  for (const plan of Object.values(store.db.weeks)) {
    if (plan.key > addDaysIso(now.date, 7) || plan.key < addDaysIso(now.date, -7)) continue;
    ensureSlots(plan, settings.meals, settings.mealDays);
    plan.notified ||= {};
    for (const t of freshnessFor(plan).tasks) {
      const id = `thaw:${t.slotId}:${t.date}:${t.recipeId}`;
      if (t.thawOn !== now.date || plan.notified[id]) continue;
      plan.notified[id] = new Date().toISOString();
      store.save();
      await notify({ title: `Thaw tonight for ${dayName(t.date)}`, message: `Move ${listNames(t.items.map((i) => i.name))} from the freezer to the fridge for ${dayName(t.date)}'s ${t.meal}: ${t.recipe}.`, tags: ['meat_on_bone'] });
    }
  }
}
const REMINDER_EVERY_MS = Number(process.env.REMINDER_EVERY_MS) || 5 * 60 * 1000;
setInterval(() => { thawReminders().catch((e) => console.error(e)); }, REMINDER_EVERY_MS).unref();
setTimeout(() => { thawReminders().catch((e) => console.error(e)); }, 10_000).unref();

let refreshing = null;

// ---------- routes ----------

const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  routes.push({ method, re, keys, handler });
};

// ---------- PIN lock ----------

route('GET', '/api/auth/status', ({ req }) => {
  const auth = store.db.auth;
  return { pinSet: Boolean(auth?.hash), authed: Boolean(auth?.hash) && sessionValid(auth, readCookie(req)) };
});
route('POST', '/api/auth/setup', ({ req, res, body }) => {
  if (store.db.auth?.hash) throw new HttpError(409, 'A PIN is already set.');
  const pin = String(body.pin || '');
  if (!PIN_RE.test(pin)) throw new HttpError(400, 'Use 4 to 8 digits.');
  store.db.auth = { ...hashPin(pin), sessions: {} };
  res.setHeader('set-cookie', sessionCookie(req, createSession(store.db.auth)));
  store.save();
  return { ok: true };
});
route('POST', '/api/auth/login', ({ req, res, body }) => {
  const auth = store.db.auth;
  if (!auth?.hash) throw new HttpError(409, 'No PIN set yet.');
  const ip = clientIp(req);
  const wait = throttle.wait(ip);
  if (wait) throw new HttpError(429, `Too many wrong PINs. Try again in ${wait < 90 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.`);
  if (!verifyPin(body.pin, auth)) {
    throttle.fail(ip);
    throw new HttpError(401, "That PIN isn't right.");
  }
  throttle.succeed(ip);
  pruneSessions(auth);
  res.setHeader('set-cookie', sessionCookie(req, createSession(auth)));
  store.save();
  return { ok: true };
});
route('POST', '/api/auth/logout', ({ req, res }) => {
  endSession(store.db.auth, readCookie(req));
  res.setHeader('set-cookie', clearCookie(req));
  store.save();
  return { ok: true };
});
route('POST', '/api/auth/change', ({ req, res, body }) => {
  const auth = store.db.auth;
  if (!sessionValid(auth, readCookie(req))) throw new HttpError(401, 'Enter your PIN first.');
  const ip = clientIp(req);
  if (throttle.wait(ip)) throw new HttpError(429, 'Too many wrong PINs. Try again later.');
  if (!verifyPin(body.current, auth)) {
    throttle.fail(ip);
    throw new HttpError(401, "Your current PIN isn't right.");
  }
  if (!PIN_RE.test(String(body.pin || ''))) throw new HttpError(400, 'Use 4 to 8 digits.');
  // A new PIN signs out every other device.
  store.db.auth = { ...hashPin(body.pin), sessions: {} };
  res.setHeader('set-cookie', sessionCookie(req, createSession(store.db.auth)));
  store.save();
  return { ok: true };
});
route('POST', '/api/auth/signout-all', ({ req, res }) => {
  if (!sessionValid(store.db.auth, readCookie(req))) throw new HttpError(401, 'Enter your PIN first.');
  store.db.auth.sessions = {};
  res.setHeader('set-cookie', clearCookie(req));
  store.save();
  return { ok: true };
});

route('GET', '/api/meta', () => ({ stores: STORES, proteins: [...PROTEINS, 'vegetarian'], allergens: Object.fromEntries(Object.entries(ALLERGEN_GROUPS).map(([k, g]) => [k, g.label])), recipeCount: store.db.recipes.length, auth: Boolean(PASSWORD), suggestedCreators: SUGGESTED_CREATORS }));

route('GET', '/api/settings', () => store.db.settings);

// Recipe photos from other sites, served from the app's own address (see lib/images.js).
const RESPONDED = Symbol('responded');
route('GET', '/api/img', async ({ req, res }) => {
  const u = new URL(req.url, 'http://x').searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(u) || u.length > 2000) throw new HttpError(400, 'Bad image address');
  let img;
  try {
    img = await cachedImage(u, path.join(DATA_DIR, 'images'));
  } catch {
    throw new HttpError(502, "Couldn't load that photo");
  }
  res.writeHead(200, {
    'content-type': img.type,
    'cache-control': 'private, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
  });
  fs.createReadStream(img.file).pipe(res);
  return RESPONDED;
});
route('POST', '/api/notify/test', async () => {
  try {
    await sendNotification(store.db.settings, { title: 'Meal Planner', message: "Notifications work! You'll get freeze and thaw reminders here.", tags: ['white_check_mark'], click: appOrigin ? `${appOrigin}/#plan` : undefined });
  } catch (e) {
    throw new HttpError(502, `Couldn't send it: ${e.message}`);
  }
  return { ok: true };
});
route('PUT', '/api/settings', async ({ body }) => {
  store.db.settings = sanitizeSettings(body, store.db.settings);
  store.save();
  return store.db.settings;
});

route('GET', '/api/recipes', () => store.db.recipes.filter((r) => !r.hidden).map(summary));
route('GET', '/api/recipes/:id', ({ params }) => {
  const r = store.recipe(params.id);
  if (!r) throw new HttpError(404, 'Recipe not found');
  return { ...r, pantry: pantryFor(r) };
});
/** For each ingredient, the pantry item that covers it (and whether it's running low). */
function pantryFor(r) {
  return r.ingredients.map((i) => {
    const p = pantryMatch(i.name, store.db.pantry);
    return p ? { id: p.id, name: p.name, low: Boolean(p.low) } : null;
  });
}
route('PATCH', '/api/recipes/:id', ({ params, body }) => {
  const r = store.recipe(params.id);
  if (!r) throw new HttpError(404, 'Recipe not found');
  if ('favorite' in body) r.favorite = Boolean(body.favorite);
  if ('costOverride' in body) {
    const v = Number(body.costOverride);
    r.costOverride = body.costOverride === null || body.costOverride === '' || !(v > 0) ? null : Math.round(v * 100) / 100;
  }
  if (Array.isArray(body.mealTypes)) {
    const m = body.mealTypes.filter((x) => ['breakfast', 'lunch', 'dinner'].includes(x));
    r.mealTypes = m;
  }
  store.save();
  return r;
});
route('DELETE', '/api/recipes/:id', ({ params }) => {
  const r = store.recipe(params.id);
  if (!r) throw new HttpError(404, 'Recipe not found');
  // Hide rather than delete so a future refresh doesn't bring it back.
  r.hidden = true;
  r.favorite = false;
  for (const plan of Object.values(store.db.weeks)) {
    for (const s of plan.slots) if (s.recipeId === r.id) { s.recipeId = null; s.locked = false; }
  }
  store.save();
  return { ok: true };
});
route('POST', '/api/recipes/import', async ({ body }) => {
  let res;
  try {
    res = await importLink(body.url);
  } catch (e) {
    throw new HttpError(422, e.message);
  }
  if (res.draft) {
    // A TikTok without the recipe in its caption: the app opens the editor to finish it.
    const dupe = store.db.recipes.find((r) => normalizeUrl(r.sourceUrl) === normalizeUrl(res.draft.sourceUrl) && !r.hidden);
    return dupe ? { recipe: dupe, duplicate: true } : { draft: res.draft };
  }
  const { recipe } = res;
  const dupe = store.db.recipes.find((r) => normalizeUrl(r.sourceUrl) === normalizeUrl(recipe.sourceUrl) && !r.hidden);
  if (dupe) return { recipe: dupe, duplicate: true };
  store.db.recipes.push(recipe);
  store.save();
  return { recipe, duplicate: false };
});

route('POST', '/api/recipes', ({ body }) => {
  let recipe;
  try {
    recipe = buildCustomRecipe(body);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  store.db.recipes.push(recipe);
  store.save();
  return recipe;
});
route('PUT', '/api/recipes/:id', ({ params, body }) => {
  const i = store.db.recipes.findIndex((r) => r.id === params.id);
  if (i === -1) throw new HttpError(404, 'Recipe not found');
  try {
    store.db.recipes[i] = buildCustomRecipe(body, store.db.recipes[i]);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  store.save();
  return store.db.recipes[i];
});

let pulling = null;
route('POST', '/api/creators/pull', async ({ body }) => {
  if (pulling) throw new HttpError(409, 'Already pulling creator recipes. Give it a minute.');
  const creators = store.db.settings.creators.filter((c) => c.url && (!body.name || c.name === body.name));
  if (!creators.length) throw new HttpError(400, 'Follow a creator with a recipe website first (Settings → Creators).');
  pulling = (async () => {
    const results = [];
    for (const c of creators) {
      const known = new Set(store.db.recipes.map((r) => normalizeUrl(r.sourceUrl)));
      try {
        const { recipes, checked, remaining } = await pullCreatorSite(c, { knownUrls: known, log: (m) => console.warn(m) });
        const added = store.addRecipes(recipes);
        results.push({ name: c.name, added, checked, remaining });
      } catch (e) {
        results.push({ name: c.name, added: 0, error: e.message });
      }
    }
    return results;
  })();
  try {
    const results = await pulling;
    return { results, total: store.db.recipes.length };
  } finally {
    pulling = null;
  }
});
route('POST', '/api/recipes/refresh', async () => {
  refreshing ||= fetchAllSources((m) => console.warn(m)).finally(() => { refreshing = null; });
  const recipes = await refreshing;
  const added = store.addRecipes(recipes);
  return { fetched: recipes.length, added, total: store.db.recipes.length };
});

route('GET', '/api/weeks/:key', ({ params }) => getWeek(params.key));
route('POST', '/api/weeks/:key/randomize', ({ params }) => {
  const plan = getWeek(params.key);
  randomizePlan(plan, store.db.recipes, store.db.settings, { recentIds: recentIds(plan.key) });
  store.save();
  return plan;
});
route('POST', '/api/weeks/:key/slots/:slot/reroll', ({ params }) => {
  const plan = getWeek(params.key);
  const slot = plan.slots.find((s) => s.id === params.slot);
  if (!slot) throw new HttpError(404, 'Slot not found');
  if (slot.locked) throw new HttpError(409, 'That meal is locked. Unlock it first.');
  randomizePlan(plan, store.db.recipes, store.db.settings, { recentIds: recentIds(plan.key), onlySlotId: slot.id });
  store.save();
  return plan;
});
// After turning on easy days: swap any unlocked, not-yet-easy meals on those days.
route('POST', '/api/weeks/:key/apply-easy', ({ params }) => {
  const plan = getWeek(params.key);
  const settings = store.db.settings;
  const swap = (s) => wantsEasy(plan, s, settings) && !(s.recipeId && isEasy(store.recipe(s.recipeId) || {}));
  const changed = plan.slots.filter((s) => !s.locked && !s.off && swap(s)).length;
  randomizePlan(plan, store.db.recipes, settings, { recentIds: recentIds(plan.key), onlyIf: swap });
  store.save();
  return { ...plan, changed };
});
route('POST', '/api/weeks/:key/days/:day/reroll', ({ params }) => {
  const plan = getWeek(params.key);
  const day = Number(params.day);
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new HttpError(400, 'Day must be 0-6');
  randomizePlan(plan, store.db.recipes, store.db.settings, { recentIds: recentIds(plan.key), onlyDay: day });
  store.save();
  return plan;
});
route('PATCH', '/api/weeks/:key/slots/:slot', ({ params, body }) => {
  const plan = getWeek(params.key);
  const slot = plan.slots.find((s) => s.id === params.slot);
  if (!slot) throw new HttpError(404, 'Slot not found');
  if ('recipeId' in body) {
    if (body.recipeId !== null && !store.recipe(body.recipeId)) throw new HttpError(404, 'Recipe not found');
    // Only an explicit "choose for this meal" may replace a locked meal.
    if (slot.locked && body.recipeId !== slot.recipeId && !body.replaceLocked) throw new HttpError(409, 'That meal is locked. Unlock it first to replace it.');
    if (slot.off && body.recipeId) throw new HttpError(409, 'That meal is set to fend for yourself. Tap "Plan anyway" first.');
    slot.recipeId = body.recipeId;
    if (!slot.recipeId) slot.locked = false;
  }
  if ('locked' in body) slot.locked = Boolean(body.locked) && Boolean(slot.recipeId);
  if ('skip' in body) {
    // true = skip this meal this week, false = plan it even on an off day, null = follow Settings.
    slot.skip = body.skip === null ? undefined : Boolean(body.skip);
    if (slot.skip === undefined) delete slot.skip;
    ensureSlots(plan, store.db.settings.meals, store.db.settings.mealDays);
  }
  plan.updatedAt = new Date().toISOString();
  store.save();
  return plan;
});
route('POST', '/api/weeks/:key/move', ({ params, body }) => {
  const plan = getWeek(params.key);
  const from = Number(body.from);
  const to = Number(body.to);
  const valid = (d) => Number.isInteger(d) && d >= 0 && d < 7;
  if (!valid(from) || !valid(to) || !plan.slots.some((s) => s.meal === body.meal)) throw new HttpError(400, 'Invalid move');
  moveMeal(plan, body.meal, from, to);
  store.save();
  return plan;
});
route('POST', '/api/weeks/:key/clear', ({ params }) => {
  const plan = getWeek(params.key);
  for (const s of plan.slots) if (!s.locked) s.recipeId = null;
  store.save();
  return plan;
});

// Price book: real prices (per package / per lb) and aisles the household has entered.
route('PUT', '/api/prices', ({ body }) => {
  const storeKey = String(body.store || '');
  const key = String(body.key || '').slice(0, 80);
  if (!STORES[storeKey] || !key) throw new HttpError(400, 'Store and item are required');
  const book = (store.db.priceBook[storeKey] ||= {});
  const price = Math.round(Number(body.price) * 100) / 100;
  const aisle = String(body.aisle ?? book[key]?.aisle ?? '').trim().slice(0, 30);
  if (!(price > 0) && !aisle) delete book[key];
  else book[key] = { price: price > 0 ? price : null, aisle, updatedAt: new Date().toISOString() };
  store.save();
  return book[key] || null;
});

// Pantry / fridge / freezer: things you already have.
const pantryState = () => ({ items: store.db.pantry, places: PLACES, staples: STAPLES });
route('GET', '/api/pantry', pantryState);
route('POST', '/api/pantry', ({ body }) => {
  // "auto" files each item where it usually lives (cumin -> spices, chicken -> freezer).
  const place = (w, name) => (PLACES.includes(w) ? w : autoPlace(name));
  // Either { name: "rice, cumin", where } typed in, or { items: [{ name, where }] } from a scan.
  const entries = Array.isArray(body.items)
    ? body.items.slice(0, 200).map((i) => ({ name: String(i?.name || '').trim().slice(0, 60), where: i?.where }))
    : String(body.name || '').split(',').map((n) => ({ name: n.trim().slice(0, 60), where: body.where }));
  for (const e of entries) e.where = place(e.where, e.name);
  const list = entries.filter((e) => e.name);
  if (!list.length) throw new HttpError(400, 'Type what you have.');
  const have = new Set(store.db.pantry.map((p) => p.name.toLowerCase()));
  for (const { name, where } of list) {
    if (have.has(name.toLowerCase()) || store.db.pantry.length >= 500) continue;
    store.db.pantry.push({ id: crypto.randomUUID(), name, where, addedAt: new Date().toISOString() });
    have.add(name.toLowerCase());
  }
  store.save();
  return pantryState();
});

// Camera: read a photo of a shelf with Claude, or look up a barcode. Nothing is
// added until you confirm the list in the app.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
let scanTimes = [];
route('GET', '/api/pantry/scan', () => ({ photo: aiScanEnabled(), barcode: true }));
route('POST', '/api/pantry/scan', async ({ body }) => {
  const images = (Array.isArray(body.images) ? body.images : []).slice(0, 4).map((img) => ({
    type: String(img?.type || ''),
    data: String(img?.data || '').replace(/^data:[^,]*,/, ''),
  }));
  if (!images.length || images.some((i) => !IMAGE_TYPES.includes(i.type) || !i.data)) throw new HttpError(400, 'Send a JPEG, PNG or WebP photo.');
  // Each scan costs a little on the API key, so keep runaway clicking in check.
  scanTimes = scanTimes.filter((t) => t > Date.now() - 3600_000);
  if (scanTimes.length >= 30) throw new HttpError(429, 'That is a lot of photo scans for one hour. Try again later.');
  scanTimes.push(Date.now());
  try {
    const items = await scanPhotos(images);
    return { items: markHave(items) };
  } catch (e) {
    if (e instanceof ScanError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
route('GET', '/api/pantry/barcode/:code', async ({ params }) => {
  if (!/^\d{6,14}$/.test(params.code)) throw new HttpError(400, "That doesn't look like a barcode.");
  let found;
  try {
    found = await lookupBarcode(params.code);
  } catch (e) {
    if (e instanceof ScanError) throw new HttpError(e.status, e.message);
    throw new HttpError(502, 'The barcode lookup is not reachable right now.');
  }
  if (!found) throw new HttpError(404, "That barcode isn't in the Open Food Facts database. Type the item in instead.");
  return markHave([found])[0];
});
/** Flag scanned items the pantry already covers, so the app can leave them unticked. */
function markHave(items) {
  return items.map((it) => ({ ...it, have: Boolean(pantryMatch(it.name, store.db.pantry)) }));
}
// "Running low": flag a pantry item (or a recipe ingredient, adding it to the pantry) so it goes on the grocery list.
route('POST', '/api/pantry/low', ({ body }) => {
  const name = String(body.name || '').trim().slice(0, 60);
  if (!name) throw new HttpError(400, 'Which item?');
  const low = body.low !== false;
  let p = body.id ? store.db.pantry.find((x) => x.id === body.id) : pantryMatch(name, store.db.pantry);
  if (!p && low) {
    const clean = normalizeIngredientName(name) || name.toLowerCase();
    p = { id: crypto.randomUUID(), name: clean, where: autoPlace(clean), addedAt: new Date().toISOString() };
    store.db.pantry.push(p);
  }
  if (p) {
    p.low = low;
    delete p.restockedWeek;
  }
  store.save();
  return { ...pantryState(), item: p || null };
});
route('DELETE', '/api/pantry/:id', ({ params }) => {
  store.db.pantry = store.db.pantry.filter((p) => p.id !== params.id);
  store.save();
  return pantryState();
});

route('GET', '/api/weeks/:key/grocery', ({ params }) => groceryFor(getWeek(params.key)));
route('PATCH', '/api/weeks/:key/grocery', ({ params, body }) => {
  const plan = getWeek(params.key);
  if (body.uncheckAll) {
    plan.checked = {};
    for (const e of plan.extras) e.checked = false;
  }
  if (body.uncheckAll) {
    for (const p of store.db.pantry) if (p.restockedWeek === plan.key) { p.low = true; delete p.restockedWeek; }
  }
  if (typeof body.key === 'string') {
    // Ticking a running-low item means it's restocked; unticking it puts the flag back.
    const lowId = groceryFor(plan).items.find((i) => i.key === body.key)?.low?.id;
    const p = lowId && store.db.pantry.find((x) => x.id === lowId);
    if (p && body.checked) { p.low = false; p.restockedWeek = plan.key; }
    if (p && !body.checked && p.restockedWeek === plan.key) { p.low = true; delete p.restockedWeek; }
    if (body.checked) plan.checked[body.key] = true;
    else delete plan.checked[body.key];
  }
  if (typeof body.needAnyway === 'string') {
    // "I'm out of it": buy this item this week even though the pantry has it.
    plan.needAnyway ||= {};
    if (body.value) plan.needAnyway[body.needAnyway] = true;
    else delete plan.needAnyway[body.needAnyway];
  }
  if (typeof body.extraId === 'string') {
    const e = plan.extras.find((x) => x.id === body.extraId);
    if (e) e.checked = Boolean(body.checked);
  }
  if (body.uncheckAll) delete plan.shoppedOn;
  if ('shoppedOn' in body) {
    // Set by hand ("we shopped Saturday") or cleared.
    if (body.shoppedOn === null) delete plan.shoppedOn;
    else if (DATE_RE.test(String(body.shoppedOn))) plan.shoppedOn = String(body.shoppedOn);
  } else if (body.checked && !plan.shoppedOn && DATE_RE.test(String(body.today || ''))) {
    // Most of the list ticked off = you went shopping today.
    const need = groceryFor(plan).items.filter((i) => !i.have);
    if (need.length >= 3 && need.filter((i) => i.checked).length / need.length >= 0.75) {
      plan.shoppedOn = String(body.today);
      notifyFreeze(plan);
    }
  }
  store.save();
  return groceryFor(plan);
});
route('POST', '/api/weeks/:key/grocery/extras', ({ params, body }) => {
  const plan = getWeek(params.key);
  const name = String(body.name || '').trim().slice(0, 120);
  if (!name) throw new HttpError(400, 'Item name required');
  plan.extras.push({ id: crypto.randomUUID(), name, checked: false });
  store.save();
  return groceryFor(plan);
});
route('DELETE', '/api/weeks/:key/grocery/extras/:id', ({ params }) => {
  const plan = getWeek(params.key);
  plan.extras = plan.extras.filter((e) => e.id !== params.id);
  store.save();
  return groceryFor(plan);
});

// ---------- static files ----------

// The browser shares the server's allergen matching code.
const SHARED_LIB = {
  '/lib/recipes.js': path.join(here, 'lib', 'recipes.js'),
  '/lib/pantry-catalog.js': path.join(here, 'lib', 'pantry-catalog.js'),
};

// A fingerprint of the app's code. index.html and the scripts ask for
// "/app.js?v=<this>", so after an update browsers and Cloudflare fetch the new
// files instead of reusing an old cached copy under the same address.
const CODE_FILES = () => [
  ...fs.readdirSync(PUBLIC_DIR).filter((f) => /\.(js|css|html)$/.test(f)).map((f) => path.join(PUBLIC_DIR, f)),
  ...Object.values(SHARED_LIB),
];
const ASSET_VERSION = crypto.createHash('sha1').update(CODE_FILES().map((f) => fs.readFileSync(f)).join('\0')).digest('hex').slice(0, 10);

/** Add ?v=<version> to the app's own CSS/JS references in HTML and JS import lines. */
function versionAssets(text, ext) {
  if (ext === '.html') return text.replace(/(href|src)="(\/(?:styles\.css|app\.js))"/g, `$1="$2?v=${ASSET_VERSION}"`);
  return text.replace(/(from\s+['"])(\.\/lib\/[\w.-]+\.js)(['"])/g, `$1$2?v=${ASSET_VERSION}$3`);
}

function serveStatic(req, res, pathname) {
  let file = SHARED_LIB[pathname] || path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!SHARED_LIB[pathname] && !file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  const stat = fs.statSync(file);
  const etag = `"${stat.size.toString(36)}-${Math.round(stat.mtimeMs).toString(36)}-${ASSET_VERSION}"`;
  // App code is always revalidated (a cheap 304 when unchanged), so after an
  // update browsers and Cloudflare never keep running the old version.
  const code = ['.html', '.js', '.css', '.webmanifest'].includes(ext);
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': code ? 'no-cache' : 'public, max-age=86400',
    etag,
    'x-content-type-options': 'nosniff',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  if (ext === '.html' || ext === '.js') {
    const body = versionAssets(fs.readFileSync(file, 'utf8'), ext);
    res.writeHead(200, headers);
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!checkAuth(req, res)) return;
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/healthz') return send(res, 200, { ok: true });
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, pathname);
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(pathname);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      if (!pathname.startsWith('/api/auth/')) {
        // Everything except the PIN screen itself needs a signed-in device.
        const auth = store.db.auth;
        if (!auth?.hash) throw new HttpError(401, 'Set a PIN to start using the app.');
        if (!sessionValid(auth, readCookie(req))) throw new HttpError(401, 'Enter your PIN.');
        // Remembered so notifications can link back to the app.
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        if (host) appOrigin = `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${host}`;
      }
      // Photo scans carry images, everything else is small.
      const limit = pathname === '/api/pantry/scan' ? 12_000_000 : 1_000_000;
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req, limit) : {};
      const out = await r.handler({ params, body, req, res });
      if (out === RESPONDED) return undefined;
      return send(res, 200, out);
    }
    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Meal planner running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Data: ${store.file} (${store.db.recipes.length} recipes)`);
});

const shutdown = () => {
  store.saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
