// Pull recipes from the internet: TheMealDB, DummyJSON and any recipe page
// that publishes schema.org Recipe data (most big recipe sites do).
import dns from 'node:dns/promises';
import net from 'node:net';
import { finalizeRecipe, cleanText, splitInstructions } from './recipes.js';
import { parseIngredientLine } from './grocery.js';
import { withNutrition } from './nutrition.js';
import { lookupIngredient } from './ingredients.js';

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

const PAGE_UA = 'Mozilla/5.0 (compatible; WeeklyMealPlanner/1.0; self-hosted recipe importer)';
const BOT_TOKEN = 'weeklymealplanner';

async function fetchText(url, { accept = 'text/html,application/xhtml+xml', timeout = 20000 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': PAGE_UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  if ([401, 402, 403, 429].includes(res.status)) throw new Error(`That site blocked the request (HTTP ${res.status}). Try another recipe site, or try again later.`);
  if (!res.ok) throw new Error(`The site responded with HTTP ${res.status}.`);
  return { text: (await res.text()).slice(0, 5_000_000), finalUrl: res.url || String(url) };
}

/** Pull numbers like "Calories: 367, Protein: 17.5g, Carbs: 10g, Fat: 12g" out of free text. */
export function nutritionFromText(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const grab = (re) => { const m = re.exec(t); return m ? parseFloat(m[1].replace(',', '')) : null; };
  const NUM = '(\\d{1,4}(?:,\\d{3})*(?:\\.\\d+)?)';
  const calories = grab(new RegExp(`calories?\\s*[:\\-]?\\s*${NUM}`, 'i')) ?? grab(new RegExp(`${NUM}\\s*(?:kcal|cal(?:ories)?)\\b`, 'i'));
  if (calories == null || calories < 50 || calories > 3000) return null;
  return {
    calories,
    proteinContent: grab(/protein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i) ?? grab(/(\d+(?:\.\d+)?)\s*g\s*(?:of\s*)?protein/i),
    carbohydrateContent: grab(/carb(?:ohydrate)?s?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i) ?? grab(/(\d+(?:\.\d+)?)\s*g\s*carbs?/i),
    fatContent: grab(/\bfats?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i) ?? grab(/(\d+(?:\.\d+)?)\s*g\s*fat/i),
  };
}

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = re.exec(html);
  return m ? cleanText(m[1] || m[2]) : '';
}

const QTY_START = /^[\s​﻿]*(?:[\d½¼¾⅓⅔⅛⅜⅝⅞⅕]|one |two |three |a |an |half )/i;
const UNIT_WORD = /\b(cups?|tbsp|tsp|tablespoons?|teaspoons?|grams?|g|kg|ml|oz|ounces?|lbs?|pounds?|cloves?|cans?|pinch|slices?)\b/i;

/**
 * Best-effort recipe reader for pages without schema.org data (e.g. Squarespace
 * or Substack posts): finds the ingredient list, the steps and any macros.
 */
export function recipeFromPlainHtml(html, url) {
  const body = html
    .replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
  const lists = [...body.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({
    tag: m[1].toLowerCase(),
    index: m.index,
    end: m.index + m[0].length,
    items: [...m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].flatMap((li) => li[1].split(/<br\s*\/?>/i)).map(cleanText).filter(Boolean),
  })).filter((l) => l.items.length >= 2);
  const headingBefore = (idx) => {
    const before = body.slice(Math.max(0, idx - 1500), idx);
    const hs = [...before.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<(?:p|strong|b)[^>]*>\s*([^<]{3,40})\s*<\/(?:p|strong|b)>/gi)];
    const last = hs[hs.length - 1];
    return last ? cleanText(last[1] || last[2]).toLowerCase() : '';
  };
  let ing = null;
  let best = 0;
  for (const l of lists) {
    const qtyShare = l.items.filter((t) => QTY_START.test(t) || UNIT_WORD.test(t)).length / l.items.length;
    const score = qtyShare + (/ingredient/.test(headingBefore(l.index)) ? 0.6 : 0) - (l.items.some((t) => t.length > 160) ? 0.5 : 0);
    if (l.items.length >= 3 && qtyShare >= 0.5 && score > best) { ing = l; best = score; }
  }
  if (!ing) return null;
  // It has to look like food: most lines should be ingredients we recognize.
  const foods = ing.items.filter((t) => lookupIngredient(parseIngredientLine(t).name)).length;
  if (foods < 3 || foods / ing.items.length < 0.5) return null;
  const steps = [];
  const after = lists.find((l) => l.index > ing.index && (l.tag === 'ol' || /instruction|direction|method|step/.test(headingBefore(l.index))) && l.items.some((t) => t.length > 25));
  // Paragraphs between the ingredient list and the steps are often step one.
  const gap = body.slice(ing.end, after ? after.index : ing.end + 6000);
  for (const pm of gap.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = cleanText(pm[1]);
    if (t.length > 25 && /^[A-Z]/.test(t) && !/calories|protein:|subscribe|newsletter|cookbook|affiliate/i.test(t)) steps.push(t);
    if (!after && steps.length >= 12) break;
  }
  if (after) steps.push(...after.items);
  if (!steps.length) return null;
  const text = cleanText(body);
  const title = metaContent(html, 'og:title') || cleanText((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body) || [])[1] || (/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || 'Imported recipe');
  const NOT_QTY = '(?![.,]\\d)(?!\\s*(?:lbs?|cups?|grams?|g|oz|ounces?|tbsp|tsp|kg|ml)\\b)';
  const servings = Number((/divide (?:it |this )?(?:into|between) (\d{1,2}) /i.exec(text) || /makes (\d{1,2}) (?:servings|portions|meals)/i.exec(text)
    || new RegExp(`\\bserv(?:ings?|es)\\s*[:\\-]?\\s*(\\d{1,2})\\b${NOT_QTY}`, 'i').exec(text) || [])[1]);
  const minutes = Number((/(?:total|cook) time\s*[:\-]?\s*(\d{1,3})\s*min/i.exec(text) || [])[1]);
  const host = new URL(url).hostname.replace(/^www\./, '');
  return {
    name: title.replace(/\s*[|—–-]\s*[^|—–-]{2,40}$/, '').trim(),
    image: metaContent(html, 'og:image'),
    servings: servings > 0 ? servings : 4,
    totalMinutes: minutes || null,
    ingredients: ing.items.map((t) => parseIngredientLine(t)).filter((i) => i.name),
    instructions: steps,
    reportedNutrition: nutritionFromText(text),
    source: host,
  };
}

/** Parse a recipe out of a fetched page: schema.org data first, then the plain-HTML reader. */
export function recipeFromHtml(html, url) {
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
      const recipe = recipeFromJsonLd(node, url);
      if (recipe.ingredients.length) return recipe;
    }
  }
  const plain = recipeFromPlainHtml(html, url);
  if (!plain) return null;
  return withNutrition(finalizeRecipe({
    ...plain,
    id: urlRecipeId(url),
    sourceUrl: url,
  }));
}

function urlRecipeId(url) {
  return `url-${Buffer.from(normalizeUrl(url)).toString('base64url').slice(-24)}-${Date.now().toString(36)}`;
}

export function normalizeUrl(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    x.search = '';
    return x.href.replace(/\/$/, '').replace(/^http:/, 'https:').replace('://www.', '://');
  } catch {
    return String(u);
  }
}

// ---------- TikTok ----------

const isTikTok = (url) => /(^|\.)tiktok\.com$/i.test(url.hostname);

/** Turn a TikTok caption into recipe parts: name, ingredient lines, steps and macros. */
export function parseCaption(caption) {
  const clean = String(caption || '').replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/[ \t]+/g, ' ').trim();
  const lines = clean
    .split(/\n|(?:\s[-•▪·✅🔹🔸👉]\s)|(?:\s{2,})/u)
    .flatMap((l) => {
      const m = /^(.*?)ingredients?\s*:(.*)$/i.exec(l);
      return m ? [m[1], ...m[2].split(/,(?![^(]*\))/)] : [l];
    })
    .map((l) => l.replace(/^[\p{Extended_Pictographic}\s*•\-–]+/u, '').trim())
    .filter(Boolean);
  const ingredients = [];
  const steps = [];
  const first = lines.find((l) => !parseIngredientLine(l).measure && l.length > 3) || '';
  for (const l of lines) {
    const p = parseIngredientLine(l);
    if (p.measure && l.length < 90) ingredients.push(p);
    else if (l !== first && (/^\d+[.)]\s+/.test(l) || (l.length > 40 && /\b(add|cook|bake|mix|stir|season|heat|fry|air ?fry|roast|simmer|combine|serve|marinate|blend|whisk)\b/i.test(l)))) {
      steps.push(l.replace(/^\d+[.)]\s+/, ''));
    }
  }
  const name = first.split(/[.!?|]|\p{Extended_Pictographic}/u).find((x) => x.trim().length > 2) || '';
  return { name: name.replace(/\s+/g, ' ').slice(0, 80).trim(), ingredients, steps, nutrition: nutritionFromText(clean) };
}

async function importTikTok(url) {
  let videoUrl = url.href;
  if (!/\/video\//.test(url.pathname)) {
    // Short links (vm.tiktok.com/…) redirect to the full video URL.
    const res = await fetch(url, { headers: { 'user-agent': PAGE_UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    videoUrl = res.url || videoUrl;
  }
  if (!/\/video\//.test(videoUrl)) throw new Error('Paste the link to a single TikTok video (it should contain /video/).');
  let o;
  try {
    o = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`);
  } catch {
    throw new Error("TikTok didn't return that video. It may be private or deleted.");
  }
  const handle = (/@([\w.]+)/.exec(o.author_url || videoUrl) || [])[1];
  const parsed = parseCaption(o.title);
  const draft = {
    name: parsed.name || `${o.author_name || 'TikTok'} recipe`,
    image: o.thumbnail_url || '',
    sourceUrl: videoUrl.split('?')[0],
    creator: handle ? `@${handle}` : o.author_name || '',
    servings: 4,
    ingredientsText: parsed.ingredients.map((i) => `${i.measure} ${i.name}`.trim()).join('\n'),
    instructionsText: parsed.steps.join('\n'),
    caption: o.title || '',
    nutrition: parsed.nutrition,
  };
  if (parsed.ingredients.length >= 3) {
    return {
      recipe: withNutrition(finalizeRecipe({
        id: urlRecipeId(draft.sourceUrl),
        source: 'TikTok',
        sourceUrl: draft.sourceUrl,
        creator: draft.creator,
        name: draft.name,
        image: draft.image,
        servings: 4,
        ingredients: parsed.ingredients,
        instructions: parsed.steps,
        reportedNutrition: parsed.nutrition,
      })),
    };
  }
  // Most TikToks only show the recipe in the video, so hand back a draft to finish by hand.
  return { draft };
}

/**
 * Import from a link. Returns { recipe } when a full recipe was found, or
 * { draft } (prefilled fields) when the user needs to finish it, e.g. a TikTok.
 */
export async function importLink(raw) {
  const url = await assertPublicUrl(String(raw || '').trim());
  if (isTikTok(url)) return importTikTok(url);
  const { text, finalUrl } = await fetchText(url);
  const recipe = recipeFromHtml(text, finalUrl);
  if (!recipe) throw new Error('No recipe found on that page. Try the page for a single recipe.');
  return { recipe };
}

export async function importFromUrl(raw) {
  const res = await importLink(raw);
  if (!res.recipe) throw new Error('That link needs finishing by hand.');
  return res.recipe;
}

// ---------- Creator websites ----------

export const SUGGESTED_CREATORS = [
  { name: 'Hunt4Shredz', handle: '@hunt4shredz', url: 'https://www.hunt4shredz.com', note: 'High-protein, macro-friendly meals' },
  { name: 'AmateurProChef', handle: '@amateurprochef', url: 'https://amateurprochef.com', note: 'Big-flavor meals, plenty with a healthy twist' },
  { name: 'Chef Zealand', handle: '@chefzealand', url: '', note: 'No free recipe website. Save his TikToks by pasting a video link.' },
  { name: 'Aussie Fitness', handle: '@aussiefitness', url: '', note: 'Recipes are in his paid books. Save his TikToks by pasting a video link.' },
];

/** robots.txt rules that apply to us (our own token, else "*"). */
export function robotsRules(txt) {
  const groups = [];
  let cur = null;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'user-agent') {
      if (!cur || cur.rules.length) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(m[2].toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      cur.rules.push({ allow: key === 'allow', path: m[2] });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT_TOKEN.includes(a)));
  return (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
}

export function robotsAllows(rules, path) {
  let verdict = true;
  let len = -1;
  for (const r of rules) {
    if (!r.path) continue;
    const re = new RegExp(`^${r.path.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$')}`);
    if (re.test(path) && r.path.length > len) {
      verdict = r.allow;
      len = r.path.length;
    }
  }
  return verdict;
}

const NOT_RECIPE = /\/(about|contact|home|shop|store|cart|checkout|account|login|category|categories|tag|tags|author|page|search|products?|collections|merch|faq|subscribe|newsletter|wp-content|feed|accessibility|do-not-sell)(\/|$)|privacy|polic(y|ies)|terms|cookie|rights|targeted-ads|program|training|coaching|strategy|calculator|cookbook|meal-plans?|\/(2\d{3}\/\d{2}\/?)?$|\.(jpe?g|png|webp|gif|pdf|xml)$/i;

async function sitemapEntries(origin, robotsTxt, log) {
  const roots = [...String(robotsTxt).matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  if (!roots.length) roots.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`);
  const seen = new Set();
  const out = [];
  const queue = [...new Set(roots)];
  while (queue.length && seen.size < 10) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    let xml;
    try {
      xml = (await fetchText(sm, { accept: 'application/xml,text/xml' })).text;
    } catch (e) {
      log(`Sitemap ${sm}: ${e.message}`);
      continue;
    }
    if (/<sitemapindex/i.test(xml)) {
      const kids = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
        .filter((u) => !/product|categor|tag|author|collection|image|video/i.test(u))
        .sort((a, b) => Number(/post|recipe/i.test(b)) - Number(/post|recipe/i.test(a)));
      queue.push(...kids);
      continue;
    }
    for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
      const loc = (/<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(m[1]) || [])[1];
      const lastmod = (/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(m[1]) || [])[1] || '';
      if (loc) out.push({ loc: loc.replace(/&amp;/g, '&'), lastmod });
    }
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Import the newest recipes from a creator's website. Reads the site's sitemap,
 * respects its robots.txt, and goes one page at a time with a pause between.
 */
export async function pullCreatorSite(creator, { knownUrls = new Set(), limit = 12, maxPages = 30, delayMs = 800, log = () => {} } = {}) {
  const site = await assertPublicUrl(creator.url);
  const origin = site.origin;
  let robotsTxt = '';
  try {
    robotsTxt = (await fetchText(`${origin}/robots.txt`, { accept: 'text/plain' })).text;
  } catch { /* no robots.txt: everything allowed */ }
  const rules = robotsRules(robotsTxt);
  const entries = (await sitemapEntries(origin, robotsTxt, log))
    .filter((e) => {
      try {
        const u = new URL(e.loc);
        return u.hostname.replace(/^www\./, '') === site.hostname.replace(/^www\./, '') && u.pathname.length > 1 && !NOT_RECIPE.test(u.pathname) && robotsAllows(rules, u.pathname);
      } catch {
        return false;
      }
    })
    .filter((e) => !knownUrls.has(normalizeUrl(e.loc)))
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  const recipes = [];
  let checked = 0;
  for (const e of entries) {
    if (recipes.length >= limit || checked >= maxPages) break;
    checked++;
    try {
      const { text, finalUrl } = await fetchText(e.loc);
      const r = recipeFromHtml(text, finalUrl);
      if (r && r.ingredients.length >= 3) {
        r.creator = creator.handle || creator.name;
        r.source = creator.name;
        recipes.push(r);
      }
    } catch (err) {
      log(`${e.loc}: ${err.message}`);
    }
    await sleep(delayMs);
  }
  return { recipes, checked, remaining: Math.max(0, entries.length - checked) };
}
