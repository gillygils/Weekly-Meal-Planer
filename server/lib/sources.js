// Pull recipes from the internet: TheMealDB, DummyJSON and any recipe page
// that publishes schema.org Recipe data (most big recipe sites do).
import dns from 'node:dns/promises';
import net from 'node:net';
import { finalizeRecipe, cleanText, splitInstructions } from './recipes.js';
import { parseIngredientLine } from './grocery.js';
import { withNutrition } from './nutrition.js';

const UA = 'WeeklyMealPlanner/1.0 (+self-hosted)';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function fromMealDb(m) {
  return withNutrition(fromMealDbRaw(m));
}

function fromMealDbRaw(m) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || '').trim();
    if (name) ingredients.push({ name, measure: (m[`strMeasure${i}`] || '').trim() });
  }
  return finalizeRecipe({
    id: `mealdb-${m.idMeal}`,
    source: 'TheMealDB',
    servingsEstimated: true,
    sourceUrl: m.strSource || `https://www.themealdb.com/meal/${m.idMeal}`,
    name: m.strMeal,
    category: m.strCategory || '',
    cuisine: m.strArea || m.strCountry || '',
    image: m.strMealThumb || '',
    servings: 4,
    tags: (m.strTags || '').split(',').map((t) => t.trim()),
    ingredients,
    instructions: splitInstructions(m.strInstructions),
  });
}

export async function fetchMealDb(log = () => {}) {
  const out = new Map();
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    try {
      const data = await getJson(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);
      for (const m of data.meals || []) out.set(m.idMeal, fromMealDb(m));
    } catch (e) {
      log(`TheMealDB "${letter}" failed: ${e.message}`);
    }
  }
  return [...out.values()];
}

function fromDummyJson(r) {
  return withNutrition(finalizeRecipe({
    reportedNutrition: r.caloriesPerServing ? { calories: r.caloriesPerServing } : null,
    id: `dummyjson-${r.id}`,
    source: 'DummyJSON',
    sourceUrl: `https://dummyjson.com/recipes/${r.id}`,
    name: r.name,
    category: (r.mealType || [])[0] || '',
    cuisine: r.cuisine || '',
    image: r.image || '',
    servings: r.servings || 4,
    totalMinutes: (r.prepTimeMinutes || 0) + (r.cookTimeMinutes || 0),
    tags: [...(r.tags || []), ...(r.mealType || [])],
    ingredients: (r.ingredients || []).map((line) => parseIngredientLine(line)),
    instructions: r.instructions || [],
  }));
}

export async function fetchDummyJson() {
  const data = await getJson('https://dummyjson.com/recipes?limit=0');
  return (data.recipes || []).map(fromDummyJson);
}

export async function fetchAllSources(log = () => {}) {
  const results = await Promise.allSettled([fetchMealDb(log), fetchDummyJson()]);
  const recipes = [];
  for (const r of results) {
    if (r.status === 'fulfilled') recipes.push(...r.value);
    else log(`Source failed: ${r.reason?.message || r.reason}`);
  }
  return recipes;
}

// ---------- Import from any recipe URL (schema.org JSON-LD) ----------

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') ||
    (l.startsWith('::ffff:') && isPrivateIp(l.slice(7)));
}

async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) links are supported.');
  if (process.env.ALLOW_PRIVATE_IMPORTS !== 'true') {
    const addrs = await dns.lookup(url.hostname, { all: true }).catch(() => []);
    if (!addrs.length) throw new Error(`Could not resolve ${url.hostname}.`);
    if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('Importing from private network addresses is disabled.');
  }
  return url;
}

function typeIs(node, t) {
  const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
  return types.some((x) => String(x || '').toLowerCase() === t);
}

function findRecipeNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findRecipeNode(n, depth + 1);
      if (f) return f;
    }
    return null;
  }
  if (typeIs(node, 'recipe')) return node;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const f = findRecipeNode(node[key], depth + 1);
    if (f) return f;
  }
  return null;
}

function flattenInstructions(ins) {
  if (!ins) return [];
  if (typeof ins === 'string') return splitInstructions(cleanText(ins.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n')).replace(/\. (?=[A-Z])/g, '.\n'));
  if (Array.isArray(ins)) return ins.flatMap(flattenInstructions);
  if (typeIs(ins, 'howtosection')) return flattenInstructions(ins.itemListElement);
  if (ins.text) return [cleanText(ins.text)];
  if (ins.name) return [cleanText(ins.name)];
  return [];
}

function parseDuration(iso) {
  const m = /^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(iso || '').replace(/(\d+)D/i, (_, d) => `${d * 24}H`).replace('PT', 'P'));
  if (!m) return null;
  const mins = Number(m[1] || 0) * 60 + Number(m[2] || 0);
  return mins || null;
}

function firstString(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstString(v[0]);
  if (typeof v === 'object') return v.url || v.contentUrl || v['@id'] || '';
  return String(v);
}

export function recipeFromJsonLd(node, url) {
  const yieldNum = Number(String(firstString(node.recipeYield) || node.recipeYield || '').match(/\d+/)?.[0]);
  const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : node.ingredients || [])
    .map((line) => parseIngredientLine(cleanText(line)))
    .filter((i) => i.name);
  const category = cleanText(firstString(node.recipeCategory));
  const keywords = typeof node.keywords === 'string' ? node.keywords.split(',') : node.keywords || [];
  const host = new URL(url).hostname.replace(/^www\./, '');
  return withNutrition(finalizeRecipe({
    reportedNutrition: node.nutrition || null,
    id: `url-${Buffer.from(url).toString('base64url').slice(-24)}-${Date.now().toString(36)}`,
    source: host,
    sourceUrl: url,
    name: cleanText(node.name || node.headline || 'Imported recipe'),
    category,
    cuisine: cleanText(firstString(node.recipeCuisine)),
    image: firstString(node.image),
    servings: yieldNum > 0 && yieldNum < 50 ? yieldNum : 4,
    totalMinutes: parseDuration(node.totalTime) || (parseDuration(node.prepTime) || 0) + (parseDuration(node.cookTime) || 0) || null,
    tags: keywords.map((k) => cleanText(k)).filter((k) => k && k.length < 30).slice(0, 8),
    ingredients,
    instructions: flattenInstructions(node.recipeInstructions),
  }));
}

export async function importFromUrl(raw) {
  const url = await assertPublicUrl(String(raw || '').trim());
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; WeeklyMealPlanner/1.0)', accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if ([401, 402, 403, 429].includes(res.status)) throw new Error(`That site blocked the request (HTTP ${res.status}). Try another recipe site, or try again later.`);
  if (!res.ok) throw new Error(`The site responded with HTTP ${res.status}.`);
  const html = (await res.text()).slice(0, 5_000_000);
  const blocks = [...html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of blocks) {
    let data;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (node) {
      const recipe = recipeFromJsonLd(node, res.url || url.href);
      if (!recipe.ingredients.length) throw new Error('Found a recipe but it has no ingredient list.');
      return recipe;
    }
  }
  throw new Error('No recipe data found on that page. Try a page from a major recipe site.');
}
