// Weekly Meal Planner server. Zero dependencies: plain Node http + a JSON file.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store, sanitizeSettings } from './store.js';
import { ensureSlots, randomizePlan } from './lib/planner.js';
import { buildGroceryList } from './lib/grocery.js';
import { fetchAllSources, importFromUrl } from './lib/sources.js';
import { PROTEINS, ALLERGEN_GROUPS } from './lib/recipes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data'));
const PASSWORD = process.env.APP_PASSWORD || '';

const store = new Store(DATA_DIR);

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

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, 'Request too large');
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
  ensureSlots(plan, store.db.settings.meals);
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
  return { ...rest, ingredientCount: ingredients.length, ingredientNames: ingredients.map((i) => i.name) };
}

function groceryFor(plan) {
  const byId = new Map(store.db.recipes.map((r) => [r.id, r]));
  const items = buildGroceryList(plan.slots, byId, store.db.settings.householdSize)
    .map((i) => ({ ...i, checked: Boolean(plan.checked[i.key]) }));
  return { week: plan.key, items, extras: plan.extras };
}

let refreshing = null;

// ---------- routes ----------

const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  routes.push({ method, re, keys, handler });
};

route('GET', '/api/meta', () => ({ proteins: [...PROTEINS, 'vegetarian'], allergens: Object.fromEntries(Object.entries(ALLERGEN_GROUPS).map(([k, g]) => [k, g.label])), recipeCount: store.db.recipes.length, auth: Boolean(PASSWORD) }));

route('GET', '/api/settings', () => store.db.settings);
route('PUT', '/api/settings', async ({ body }) => {
  store.db.settings = sanitizeSettings(body, store.db.settings);
  store.save();
  return store.db.settings;
});

route('GET', '/api/recipes', () => store.db.recipes.filter((r) => !r.hidden).map(summary));
route('GET', '/api/recipes/:id', ({ params }) => {
  const r = store.recipe(params.id);
  if (!r) throw new HttpError(404, 'Recipe not found');
  return r;
});
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
  let recipe;
  try {
    recipe = await importFromUrl(body.url);
  } catch (e) {
    throw new HttpError(422, e.message);
  }
  const dupe = store.db.recipes.find((r) => r.sourceUrl === recipe.sourceUrl && !r.hidden);
  if (dupe) return { recipe: dupe, duplicate: true };
  store.db.recipes.push(recipe);
  store.save();
  return { recipe, duplicate: false };
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
route('PATCH', '/api/weeks/:key/slots/:slot', ({ params, body }) => {
  const plan = getWeek(params.key);
  const slot = plan.slots.find((s) => s.id === params.slot);
  if (!slot) throw new HttpError(404, 'Slot not found');
  if ('recipeId' in body) {
    if (body.recipeId !== null && !store.recipe(body.recipeId)) throw new HttpError(404, 'Recipe not found');
    slot.recipeId = body.recipeId;
    if (!slot.recipeId) slot.locked = false;
  }
  if ('locked' in body) slot.locked = Boolean(body.locked) && Boolean(slot.recipeId);
  plan.updatedAt = new Date().toISOString();
  store.save();
  return plan;
});
route('POST', '/api/weeks/:key/clear', ({ params }) => {
  const plan = getWeek(params.key);
  for (const s of plan.slots) if (!s.locked) s.recipeId = null;
  store.save();
  return plan;
});

route('GET', '/api/weeks/:key/grocery', ({ params }) => groceryFor(getWeek(params.key)));
route('PATCH', '/api/weeks/:key/grocery', ({ params, body }) => {
  const plan = getWeek(params.key);
  if (body.uncheckAll) {
    plan.checked = {};
    for (const e of plan.extras) e.checked = false;
  }
  if (typeof body.key === 'string') {
    if (body.checked) plan.checked[body.key] = true;
    else delete plan.checked[body.key];
  }
  if (typeof body.extraId === 'string') {
    const e = plan.extras.find((x) => x.id === body.extraId);
    if (e) e.checked = Boolean(body.checked);
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
const SHARED_LIB = { '/lib/recipes.js': path.join(here, 'lib', 'recipes.js') };

function serveStatic(req, res, pathname) {
  let file = SHARED_LIB[pathname] || path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!SHARED_LIB[pathname] && !file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
  });
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
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      return send(res, 200, await r.handler({ params, body, req }));
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
