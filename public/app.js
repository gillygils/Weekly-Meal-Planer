// Weekly Meal Planner frontend. No framework, no build step.
import { createAvoidMatcher } from './lib/recipes.js';

const $ = (sel, root = document) => root.querySelector(sel);
const main = $('#main');
const modal = $('#modal');
const modalBody = $('#modal-body');

const MEALS = ['breakfast', 'lunch', 'dinner'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PROTEIN_LABEL = {
  chicken: 'Chicken', beef: 'Beef', pork: 'Pork', lamb: 'Lamb', goat: 'Goat', turkey: 'Turkey', duck: 'Duck',
  fish: 'Fish', shellfish: 'Shellfish', egg: 'Egg', tofu: 'Tofu', legumes: 'Beans & lentils', vegetarian: 'Vegetarian',
};
const PROTEIN_EMOJI = {
  chicken: '🍗', beef: '🥩', pork: '🥓', lamb: '🐑', goat: '🐐', turkey: '🦃', duck: '🦆',
  fish: '🐟', shellfish: '🦐', egg: '🥚', tofu: '🌱', legumes: '🫘', vegetarian: '🥦',
};
const PAGE = 48;

const state = {
  tab: 'plan',
  settings: null,
  meta: null,
  recipes: [],
  byId: new Map(),
  weekKey: null,
  plan: null,
  grocery: null,
  recipeFilters: { q: '', protein: '', meal: '', favorites: false, budget: false, sort: 'name', limit: PAGE },
  hideChecked: load('hideChecked', false),
};

// ---------- utilities ----------

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(message, type = '', key = '') {
  // A keyed toast replaces the previous one with the same key instead of stacking.
  if (key) document.querySelectorAll(`.toast[data-key="${key}"]`).forEach((t) => t.remove());
  const el = document.createElement('div');
  if (key) el.dataset.key = key;
  el.className = `toast ${type}`;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'error' ? 5000 : 2800);
}

async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.classList.add('busy'); }
  try { return await fn(); } catch (e) { toast(e.message, 'error'); return undefined; } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('busy'); }
  }
}

const money = (n) => `${state.settings.currency}${(Math.round(n * 100) / 100).toFixed(2)}`;
const cost = (r) => r.costOverride ?? r.estimatedCost;
const overBudget = (r) => state.settings.maxPricePerServing > 0 && cost(r) > state.settings.maxPricePerServing;

// Allergies & dislikes, using the same matching code as the server's randomizer.
let avoidMatch = () => [];
const avoidCache = new Map();
function setAvoidRules() {
  avoidMatch = createAvoidMatcher(state.settings);
  avoidCache.clear();
}
function avoidHits(r) {
  if (!avoidCache.has(r.id)) avoidCache.set(r.id, avoidMatch(r.ingredientNames || []));
  return avoidCache.get(r.id);
}
const HEALTHY = 65;
const isHealthy = (r) => (r.healthScore ?? 0) >= HEALTHY;
function meetsHealthGoals(r) {
  const s = state.settings;
  const n = r.nutrition;
  if (s.healthFocus && !isHealthy(r)) return false;
  if (s.maxCalories > 0 && (!n || n.kcal > s.maxCalories)) return false;
  if (s.minProtein > 0 && (!n || (n.protein ?? 0) < s.minProtein)) return false;
  return true;
}
const fmt = (n) => Math.round(n).toLocaleString();

function fitsSettings(r, meal) {
  const excluded = state.settings.excludedProteins;
  if (meal && !r.mealTypes.includes(meal)) return false;
  if (overBudget(r)) return false;
  if (!meetsHealthGoals(r)) return false;
  if (r.proteins.some((p) => excluded.includes(p))) return false;
  if (excluded.includes('vegetarian') && r.mainProtein === 'vegetarian') return false;
  return !avoidHits(r).length;
}

function thumb(r, size = 'medium') {
  if (!r.image) return '';
  return r.image.includes('themealdb.com') ? `${r.image}/${size}` : r.image;
}

function imgTag(r, size) {
  const src = thumb(r, size);
  // The emoji sits behind the photo and shows through if it is missing or fails to load.
  const ph = `<span class="ph-emoji" aria-hidden="true">${PROTEIN_EMOJI[r.mainProtein] || '🍽️'}</span>`;
  return src ? `${ph}<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ph;
}

// ---------- weeks ----------

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function weekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - state.settings.weekStartsOn + 7) % 7;
  return isoDate(addDays(d, -diff));
}
function weekRange(key) {
  const start = parseKey(key);
  const end = addDays(start, 6);
  const fmt = (d, withMonth) => d.toLocaleDateString(undefined, withMonth ? { month: 'short', day: 'numeric' } : { day: 'numeric' });
  const sameMonth = start.getMonth() === end.getMonth();
  return `${fmt(start, true)} – ${fmt(end, !sameMonth)}`;
}
function relativeWeek(key) {
  const diff = Math.round((parseKey(key) - parseKey(weekStart())) / (7 * 864e5));
  if (diff === 0) return 'This week';
  if (diff === 1) return 'Next week';
  if (diff === -1) return 'Last week';
  return diff > 0 ? `In ${diff} weeks` : `${-diff} weeks ago`;
}

// ---------- data loading ----------

function setRecipes(list) {
  state.recipes = list;
  state.byId = new Map(list.map((r) => [r.id, r]));
}

function upsertRecipe(r) {
  const summary = { ...r, ingredientCount: r.ingredients ? r.ingredients.length : r.ingredientCount };
  delete summary.ingredients;
  delete summary.instructions;
  if (state.byId.has(r.id)) {
    const i = state.recipes.findIndex((x) => x.id === r.id);
    state.recipes[i] = summary;
  } else {
    state.recipes.push(summary);
  }
  state.byId.set(r.id, summary);
}

async function loadWeek() {
  state.plan = await api('GET', `/api/weeks/${state.weekKey}`);
  state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
}

async function setPlan(plan, { animate = false } = {}) {
  const before = animate ? tilePositions() : null;
  state.plan = plan;
  state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
  render();
  if (before) slideFrom(before);
}

// Remember where each meal tile is, then after re-rendering slide tiles from
// their old spot to the new one so a move is easy to follow.
function tilePositions() {
  const map = new Map();
  document.querySelectorAll('.meal[data-recipe]').forEach((el) => map.set(`${el.dataset.meal}|${el.dataset.recipe}`, el.getBoundingClientRect()));
  return map;
}
function slideFrom(before) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.meal[data-recipe]').forEach((el) => {
    const old = before.get(`${el.dataset.meal}|${el.dataset.recipe}`);
    if (!old) return;
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

// ---------- rendering ----------

function render() {
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === state.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('#weekbar').hidden = !['plan', 'groceries'].includes(state.tab);
  $('#week-range').textContent = weekRange(state.weekKey);
  $('#week-sub').textContent = relativeWeek(state.weekKey);
  const remaining = state.grocery ? state.grocery.items.filter((i) => !i.checked).length + state.grocery.extras.filter((e) => !e.checked).length : 0;
  const badge = $('#grocery-badge');
  badge.hidden = !remaining;
  badge.textContent = remaining > 99 ? '99+' : remaining;

  const views = { plan: renderPlan, groceries: renderGroceries, recipes: renderRecipes, settings: renderSettings };
  main.innerHTML = views[state.tab]();
  document.title = `${{ plan: 'Plan', groceries: 'Groceries', recipes: 'Recipes', settings: 'Settings' }[state.tab]} · Meal Planner`;
}

function chips(r) {
  const p = r.mainProtein;
  const out = [`<span class="chip">${PROTEIN_EMOJI[p] || ''} ${esc(PROTEIN_LABEL[p] || p)}</span>`];
  out.push(`<span class="chip price ${overBudget(r) ? 'over' : ''}" title="Estimated cost per serving">${money(cost(r))}/serving</span>`);
  if (r.totalMinutes) out.push(`<span class="chip">${icon('clock')}${r.totalMinutes} min</span>`);
  const n = r.nutrition;
  if (n?.kcal) {
    const tip = `Per serving${isHealthy(r) ? ` · healthy (score ${r.healthScore}/100)` : ''}`;
    out.splice(1, 0, `<span class="chip macro ${isHealthy(r) ? 'healthy' : ''}" title="${tip}">${isHealthy(r) ? icon('leaf') : ''}${fmt(n.kcal)} kcal · ${fmt(n.protein ?? 0)}g protein</span>`);
  }
  const hits = avoidHits(r);
  if (hits.length) out.unshift(`<span class="chip warn" title="On your allergies & dislikes list">⚠ ${esc(hits.join(', '))}</span>`);
  return out.join('');
}

function renderPlan() {
  const { plan, settings } = state;
  const enabled = MEALS.filter((m) => settings.meals.includes(m) || plan.slots.some((s) => s.meal === m));
  const filled = plan.slots.filter((s) => s.recipeId && state.byId.has(s.recipeId));
  const locked = plan.slots.filter((s) => s.locked).length;
  const weekCost = filled.reduce((sum, s) => sum + cost(state.byId.get(s.recipeId)) * settings.householdSize, 0);
  const avg = filled.length ? weekCost / filled.length / settings.householdSize : 0;
  const over = settings.maxPricePerServing > 0 && avg > settings.maxPricePerServing;
  const todayKey = isoDate(new Date());
  const thisWeek = state.weekKey === weekStart();
  const start = parseKey(state.weekKey);

  const days = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d);
    const slots = enabled.map((m) => plan.slots.find((s) => s.day === d && s.meal === m)).filter(Boolean);
    days.push(`
      <section class="panel day ${isoDate(date) === todayKey ? 'today' : ''} ${thisWeek && isoDate(date) < todayKey ? 'past' : ''}" data-day="${d}" aria-label="${DAY_NAMES[date.getDay()]}">
        <div class="day-head"><h2>${DAY_NAMES[date.getDay()]}</h2><span>${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
        ${slots.map((s) => `${enabled.length > 1 ? `<div class="meal-label">${s.meal}</div>` : ''}${renderSlot(s)}`).join('')}
        ${dayMacros(slots)}
      </section>`);
  }

  return `
    <div class="toolbar">
      <div class="stats">
        <span><strong>${filled.length}</strong>/${plan.slots.length} meals</span>
        <span><strong>${locked}</strong> locked</span>
        ${weekMacros(filled)}
        <span class="${over ? 'over' : ''}" title="Feeds ${settings.householdSize}"><strong>${money(weekCost)}</strong> est. week · ${money(avg)}/serving</span>
      </div>
      <span class="spacer"></span>
      <button class="btn ghost" data-action="clear-week" title="Clear all unlocked meals">${icon('broom')}<span>Clear</span></button>
      <button class="btn primary lg" data-action="randomize">${icon('dice')}<span>Randomize${locked ? ' unlocked' : ''}</span></button>
    </div>
    ${filled.length === 0 ? `<div class="panel empty" style="margin-bottom:1rem"><h2>Nothing planned yet</h2><p>Hit <b>Randomize</b> to fill the week. Lock the meals you like and randomize again to swap out the rest.</p></div>` : ''}
    <div class="week-grid">${days.join('')}</div>`;
}

// Per-person totals for one day's planned meals, with a calorie split bar.
function dayMacros(slots) {
  const meals = slots.map((s) => s.recipeId && state.byId.get(s.recipeId)).filter((r) => r?.nutrition?.kcal);
  if (!meals.length) return '';
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const r of meals) for (const k of Object.keys(t)) t[k] += r.nutrition[k] || 0;
  const s = state.settings;
  const pk = t.protein * 4;
  const ck = t.carbs * 4;
  const fk = t.fat * 9;
  const sum = pk + ck + fk || 1;
  const pct = (v) => `${((v / sum) * 100).toFixed(1)}%`;
  const target = s.dailyCalories > 0 ? Math.min(100, (t.kcal / s.dailyCalories) * 100) : null;
  const ptarget = s.dailyProtein > 0 ? Math.min(100, (t.protein / s.dailyProtein) * 100) : null;
  const label = meals.length < slots.length ? 'planned meals' : slots.length > 1 ? 'day total' : 'per person';
  return `
    <div class="day-macros" title="Per person, from ${meals.length} planned meal${meals.length > 1 ? 's' : ''} (estimated)">
      <div class="dm-top"><span><b>${fmt(t.kcal)}</b> kcal${s.dailyCalories > 0 ? ` <small>/ ${fmt(s.dailyCalories)}</small>` : ''}</span><small>${label}</small></div>
      ${target != null ? `<div class="meter" aria-hidden="true"><i style="width:${target}%"></i></div>` : ''}
      <div class="macro-bar" aria-hidden="true"><i class="p" style="width:${pct(pk)}"></i><i class="c" style="width:${pct(ck)}"></i><i class="f" style="width:${pct(fk)}"></i></div>
      <div class="dm-row">
        <span><i class="dot p"></i>${fmt(t.protein)}g protein${s.dailyProtein > 0 ? ` <small>/ ${fmt(s.dailyProtein)}</small>` : ''}</span>
        <span><i class="dot c"></i>${fmt(t.carbs)}g carbs</span>
        <span><i class="dot f"></i>${fmt(t.fat)}g fat</span>
      </div>
      ${ptarget != null ? `<div class="meter protein" aria-hidden="true"><i style="width:${ptarget}%"></i></div>` : ''}
    </div>`;
}

function weekMacros(filled) {
  const meals = filled.map((s) => state.byId.get(s.recipeId)).filter((r) => r?.nutrition?.kcal);
  if (!meals.length) return '';
  const avg = (k) => meals.reduce((a, r) => a + (r.nutrition[k] || 0), 0) / meals.length;
  const healthy = meals.filter(isHealthy).length;
  return `<span title="Average per serving"><strong>${fmt(avg('kcal'))}</strong> kcal · <strong>${fmt(avg('protein'))}g</strong> protein avg</span>
        <span><strong>${healthy}</strong> healthy</span>`;
}

function renderSlot(s) {
  const r = s.recipeId && state.byId.get(s.recipeId);
  if (!r) {
    return `
      <div class="meal empty-slot" data-day="${s.day}" data-meal="${s.meal}">
        <span>No ${s.meal} planned</span>
        <div class="row">
          <button class="btn" data-action="reroll" data-slot="${s.id}">${icon('dice')}Random</button>
          <button class="btn" data-action="choose" data-slot="${s.id}">${icon('search')}Choose</button>
        </div>
      </div>`;
  }
  return `
    <article class="meal ${s.locked ? 'locked' : ''}" data-day="${s.day}" data-meal="${s.meal}" data-recipe="${esc(r.id)}">
      <button class="meal-open" data-action="open-recipe" data-id="${esc(r.id)}" data-slot="${s.id}" aria-label="Open ${esc(r.name)}">
        <div class="meal-img">${imgTag(r, 'medium')}${s.locked ? `<span class="lock-flag">${icon('lock')}<span>Locked</span></span>` : ''}</div>
        <div class="meal-body">
          <div class="meal-name">${esc(r.name)}</div>
          <div class="meal-meta">${chips(r)}</div>
        </div>
      </button>
      <button class="icon-btn sm grip" data-drag-handle title="Drag to another day (or use the arrow keys)" aria-label="Move ${esc(r.name)} to another day. Use the arrow keys.">${icon('grip')}</button>
      <div class="meal-actions">
        <button class="icon-btn sm lock" data-action="lock" data-slot="${s.id}" aria-pressed="${s.locked}" title="${s.locked ? 'Unlock (randomizer can change it)' : 'Lock in (randomizer will keep it)'}" aria-label="${s.locked ? 'Unlock' : 'Lock'} ${esc(r.name)}">${icon(s.locked ? 'lock' : 'unlock')}</button>
        <button class="icon-btn sm" data-action="reroll" data-slot="${s.id}" ${s.locked ? 'disabled' : ''} title="Random new recipe" aria-label="Random new recipe">${icon('dice')}</button>
        <button class="icon-btn sm" data-action="choose" data-slot="${s.id}" title="Choose a recipe" aria-label="Choose a recipe">${icon('swap')}</button>
        <button class="icon-btn sm fav push" data-action="fav" data-id="${esc(r.id)}" aria-pressed="${r.favorite}" title="${r.favorite ? 'Remove favorite' : 'Favorite'}" aria-label="Favorite">${icon(r.favorite ? 'heart-fill' : 'heart')}</button>
      </div>
    </article>`;
}

function renderGroceries() {
  const g = state.grocery;
  const total = g.items.length + g.extras.length;
  const done = g.items.filter((i) => i.checked).length + g.extras.filter((e) => e.checked).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const hide = state.hideChecked;
  const groups = new Map();
  for (const item of g.items) {
    if (hide && item.checked) continue;
    if (!groups.has(item.aisle)) groups.set(item.aisle, []);
    groups.get(item.aisle).push(item);
  }
  const extras = g.extras.filter((e) => !(hide && e.checked));

  const itemRow = (i) => `
    <label class="g-item ${i.checked ? 'done' : ''}">
      <input type="checkbox" data-action="check" data-key="${esc(i.key)}" ${i.checked ? 'checked' : ''}>
      <span class="g-box">${icon('check')}</span>
      <span class="g-text">
        <span class="g-name">${esc(i.name)}</span>
        ${i.amount ? `<span class="g-amount">${esc(i.amount)}</span>` : ''}
        <span class="g-for" title="${esc(i.recipes.join(', '))}">${esc(i.recipes.join(' · '))}</span>
      </span>
    </label>`;

  const extraRow = (e) => `
    <label class="g-item ${e.checked ? 'done' : ''}">
      <input type="checkbox" data-action="check-extra" data-id="${esc(e.id)}" ${e.checked ? 'checked' : ''}>
      <span class="g-box">${icon('check')}</span>
      <span class="g-text"><span class="g-name">${esc(e.name)}</span></span>
      <button class="icon-btn sm" data-action="remove-extra" data-id="${esc(e.id)}" aria-label="Remove ${esc(e.name)}">${icon('x')}</button>
    </label>`;

  return `
    <div class="toolbar">
      <div class="stats"><span><strong>${done}</strong>/${total} items</span></div>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <span class="spacer"></span>
      <button class="btn ghost" data-action="toggle-hide" aria-pressed="${hide}">${icon('eye')}${hide ? 'Show checked' : 'Hide checked'}</button>
      <button class="btn ghost" data-action="uncheck-all">${icon('broom')}Uncheck all</button>
      <button class="btn" data-action="copy-list">${icon('copy')}Copy list</button>
    </div>
    <form class="add-item" data-form="add-extra" style="margin-bottom:1rem">
      <input class="input" name="name" placeholder="Add an item (paper towels, snacks…)" autocomplete="off" maxlength="120" aria-label="Add grocery item">
      <button class="btn primary">${icon('plus')}Add</button>
    </form>
    ${total === 0 ? `<div class="panel empty"><h2>Your list is empty</h2><p>Plan some meals for this week and their ingredients show up here automatically.</p><a class="btn primary" href="#plan">${icon('calendar')}Go to plan</a></div>` : ''}
    <div class="aisles">
      ${extras.length ? `<section class="panel aisle"><h3><span>My items</span><span>${extras.length}</span></h3>${extras.map(extraRow).join('')}</section>` : ''}
      ${[...groups].map(([aisle, items]) => `<section class="panel aisle"><h3><span>${esc(aisle)}</span><span>${items.length}</span></h3>${items.map(itemRow).join('')}</section>`).join('')}
    </div>
    ${total && hide && done === total ? `<div class="panel empty"><h2>All done 🎉</h2><p>Everything's checked off.</p></div>` : ''}`;
}

function filteredRecipes() {
  const f = state.recipeFilters;
  const q = f.q.trim().toLowerCase();
  let list = state.recipes.filter((r) => {
    if (f.favorites && !r.favorite) return false;
    if (f.protein && !(r.mainProtein === f.protein || r.proteins.includes(f.protein))) return false;
    if (f.meal === 'other' ? r.mealTypes.length : f.meal && !r.mealTypes.includes(f.meal)) return false;
    if (f.budget && !fitsSettings(r)) return false;
    if (f.healthy && !isHealthy(r)) return false;
    if (f.source && recipeSource(r) !== f.source) return false;
    if (q && !`${r.name} ${r.cuisine} ${r.category} ${r.tags.join(' ')} ${r.source}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    cheap: (a, b) => cost(a) - cost(b),
    pricey: (a, b) => cost(b) - cost(a),
    newest: (a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''),
    quick: (a, b) => (a.totalMinutes || 999) - (b.totalMinutes || 999),
    healthy: (a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0),
    protein: (a, b) => (b.nutrition?.protein ?? 0) - (a.nutrition?.protein ?? 0),
    light: (a, b) => (a.nutrition?.kcal ?? 9999) - (b.nutrition?.kcal ?? 9999),
  };
  list = list.sort(sorters[f.sort] || sorters.name);
  return list;
}

const recipeSource = (r) => r.creator || r.source;
function sourceOptions() {
  const counts = new Map();
  for (const r of state.recipes) counts.set(recipeSource(r), (counts.get(recipeSource(r)) || 0) + 1);
  return [...counts.keys()].sort((a, b) => Number(b.startsWith('@')) - Number(a.startsWith('@')) || a.localeCompare(b));
}

function renderRecipes() {
  const f = state.recipeFilters;
  const list = filteredRecipes();
  const shown = list.slice(0, f.limit);
  const proteins = Object.keys(PROTEIN_LABEL);
  return `
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" type="search" data-filter="q" value="${esc(f.q)}" placeholder="Search ${state.recipes.length} recipes, cuisines, tags…" aria-label="Search recipes"></div>
      <button class="btn primary" data-action="new-recipe">${icon('plus')}New recipe</button>
      <button class="btn" data-action="import-url">${icon('link')}Import link / TikTok</button>
      <button class="btn" data-action="pull-creators">${icon('globe')}Pull from creators</button>
    </div>
    <div class="filters">
      <select class="input" data-filter="source" aria-label="Source">
        <option value="">All sources</option>
        ${sourceOptions().map((o) => `<option value="${esc(o)}" ${f.source === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select>
      <select class="input" data-filter="protein" aria-label="Protein">
        <option value="">All proteins</option>
        ${proteins.map((p) => `<option value="${p}" ${f.protein === p ? 'selected' : ''}>${PROTEIN_EMOJI[p]} ${PROTEIN_LABEL[p]}</option>`).join('')}
      </select>
      <select class="input" data-filter="meal" aria-label="Meal type">
        <option value="">Any meal</option>
        ${MEALS.map((m) => `<option value="${m}" ${f.meal === m ? 'selected' : ''}>${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}
        <option value="other" ${f.meal === 'other' ? 'selected' : ''}>Desserts & drinks</option>
      </select>
      <select class="input" data-filter="sort" aria-label="Sort">
        <option value="name" ${f.sort === 'name' ? 'selected' : ''}>A → Z</option>
        <option value="cheap" ${f.sort === 'cheap' ? 'selected' : ''}>Cheapest first</option>
        <option value="pricey" ${f.sort === 'pricey' ? 'selected' : ''}>Priciest first</option>
        <option value="quick" ${f.sort === 'quick' ? 'selected' : ''}>Quickest first</option>
        <option value="healthy" ${f.sort === 'healthy' ? 'selected' : ''}>Healthiest first</option>
        <option value="protein" ${f.sort === 'protein' ? 'selected' : ''}>Most protein</option>
        <option value="light" ${f.sort === 'light' ? 'selected' : ''}>Fewest calories</option>
        <option value="newest" ${f.sort === 'newest' ? 'selected' : ''}>Newest first</option>
      </select>
      <button class="chip-toggle" data-action="filter-fav" aria-pressed="${f.favorites}">${icon(f.favorites ? 'heart-fill' : 'heart')}Favorites</button>
      <button class="chip-toggle" data-action="filter-healthy" aria-pressed="${Boolean(f.healthy)}">${icon('leaf')}Healthy</button>
      <button class="chip-toggle" data-action="filter-budget" aria-pressed="${f.budget}" title="Only recipes the randomizer is allowed to pick (price, health goals, proteins, allergies & dislikes)">${icon('check')}Fits my settings</button>
    </div>
    <p class="subtle" style="margin:0 0 .8rem">${list.length} recipe${list.length === 1 ? '' : 's'}</p>
    ${list.length ? '' : `<div class="panel empty"><h2>No recipes match</h2><p>Try a different search or filter.</p></div>`}
    <div class="recipe-grid">
      ${shown.map((r) => `
        <article class="panel r-card">
          <button class="meal-open" data-action="open-recipe" data-id="${esc(r.id)}" aria-label="Open ${esc(r.name)}">
            <div class="meal-img">${imgTag(r, 'medium')}</div>
            <div class="meal-body">
              <div class="meal-name">${esc(r.name)}</div>
              <div class="meal-meta">${chips(r)}</div>
              <div class="subtle">${esc([r.cuisine, r.source].filter(Boolean).join(' · '))}</div>
            </div>
          </button>
          <button class="icon-btn fav-float" data-action="fav" data-id="${esc(r.id)}" aria-pressed="${r.favorite}" aria-label="Favorite ${esc(r.name)}">${icon(r.favorite ? 'heart-fill' : 'heart')}</button>
        </article>`).join('')}
    </div>
    ${list.length > shown.length ? `<div class="more"><button class="btn lg" data-action="more">Show more (${list.length - shown.length} left)</button></div>` : ''}`;
}

function renderSettings() {
  const s = state.settings;
  const theme = load('theme', 'dark');
  const proteins = state.meta.proteins;
  return `
    <div class="settings">
      <section class="panel">
        <h2>Household</h2>
        <div class="field">
          <span class="label">People to cook for</span>
          <div class="stepper">
            <button class="icon-btn" data-action="household" data-delta="-1" aria-label="Fewer people">−</button>
            <output>${s.householdSize}</output>
            <button class="icon-btn" data-action="household" data-delta="1" aria-label="More people">${icon('plus')}</button>
          </div>
          <small>Grocery amounts and weekly cost are scaled to this.</small>
        </div>
        <div class="field">
          <span class="label">Meals to plan each day</span>
          <div class="chips">
            ${MEALS.map((m) => `<button class="chip-toggle" data-action="toggle-meal" data-meal="${m}" aria-pressed="${s.meals.includes(m)}">${m}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label for="week-start">Week starts on</label>
          <select id="week-start" class="input" data-setting="weekStartsOn">
            <option value="1" ${s.weekStartsOn === 1 ? 'selected' : ''}>Monday</option>
            <option value="0" ${s.weekStartsOn === 0 ? 'selected' : ''}>Sunday</option>
          </select>
        </div>
      </section>

      <section class="panel">
        <h2>Budget</h2>
        <div class="field">
          <label for="max-price">Target price per serving</label>
          <div class="money"><span>${esc(s.currency)}</span><input id="max-price" class="input" type="number" inputmode="decimal" min="0" step="0.25" data-setting="maxPricePerServing" value="${s.maxPricePerServing || ''}" placeholder="No limit"></div>
          <small>The randomizer only picks recipes at or under this estimated cost (feeds ${s.householdSize}: ${s.maxPricePerServing ? `${money(s.maxPricePerServing * s.householdSize)} per meal` : 'no limit'}). Costs are rough estimates — set your own on any recipe.</small>
        </div>
        <div class="field">
          <label for="currency">Currency symbol</label>
          <input id="currency" class="input" style="max-width:6rem" maxlength="4" data-setting="currency" value="${esc(s.currency)}">
        </div>
      </section>

      <section class="panel">
        <h2>Health &amp; macros</h2>
        <label class="switch"><span><b>Healthier meals</b><br><small class="subtle">Only randomize meals with a good health score (more protein and fiber, sensible calories, less deep-fried and fat-heavy food). The healthiest come up most often.</small></span><input type="checkbox" data-setting="healthFocus" ${s.healthFocus ? 'checked' : ''}></label>
        <div class="field-row">
          <div class="field">
            <label for="max-cal">Max calories per serving</label>
            <input id="max-cal" class="input" type="number" inputmode="numeric" min="0" step="50" data-setting="maxCalories" value="${s.maxCalories || ''}" placeholder="No limit">
          </div>
          <div class="field">
            <label for="min-pro">Min protein per serving</label>
            <div class="money"><input id="min-pro" class="input" type="number" inputmode="numeric" min="0" step="5" data-setting="minProtein" value="${s.minProtein || ''}" placeholder="Any"><span>g</span></div>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="day-cal">Daily calorie target</label>
            <input id="day-cal" class="input" type="number" inputmode="numeric" min="0" step="50" data-setting="dailyCalories" value="${s.dailyCalories || ''}" placeholder="None">
          </div>
          <div class="field">
            <label for="day-pro">Daily protein target</label>
            <div class="money"><input id="day-pro" class="input" type="number" inputmode="numeric" min="0" step="5" data-setting="dailyProtein" value="${s.dailyProtein || ''}" placeholder="None"><span>g</span></div>
          </div>
        </div>
        <small class="subtle">Each day on the plan shows its calories, protein, carbs and fat per person; targets add a progress bar. Macros are estimated from the ingredients unless a recipe publishes its own, so treat them as a guide.</small>
      </section>

      <section class="panel">
        <h2>Proteins to avoid</h2>
        <div class="field">
          <div class="chips">
            ${proteins.map((p) => `<button class="chip-toggle no" data-action="toggle-protein" data-protein="${p}" aria-pressed="${s.excludedProteins.includes(p)}">${PROTEIN_EMOJI[p] || ''} ${PROTEIN_LABEL[p] || p}</button>`).join('')}
          </div>
          <small>Tap anything someone doesn't eat. Recipes containing it are never randomized in. Picking "Vegetarian" skips meat-free meals.</small>
        </div>
      </section>

      <section class="panel">
        <h2>Allergies &amp; dislikes</h2>
        <div class="field">
          <span class="label">Allergies</span>
          <div class="chips">
            ${Object.entries(state.meta.allergens).map(([k, label]) => `<button class="chip-toggle no" data-action="toggle-allergen" data-allergen="${k}" aria-pressed="${s.avoidAllergens.includes(k)}">${esc(label)}</button>`).join('')}
          </div>
          <small>These also catch hidden sources: butter and cheese for dairy, soy sauce and pasta for gluten, fish sauce for fish. Always double-check labels for a serious allergy.</small>
        </div>
        <div class="field">
          <label for="avoid-in">Ingredients we don't eat</label>
          <form class="add-item" data-form="add-avoid">
            <input id="avoid-in" class="input" name="term" placeholder="e.g. mushrooms, olives, cilantro" autocomplete="off" maxlength="40">
            <button class="btn primary">${icon('plus')}Add</button>
          </form>
          ${s.avoidIngredients.length ? `<div class="chips">${s.avoidIngredients.map((t) => `<button class="chip-toggle no" aria-pressed="true" data-action="remove-avoid" data-term="${esc(t)}" title="Remove">${esc(t)} ${icon('x')}</button>`).join('')}</div>` : ''}
          <div class="chips suggest">
            ${['mushrooms', 'olives', 'cilantro', 'coconut', 'eggplant', 'blue cheese', 'anchovies', 'capers'].filter((t) => !s.avoidIngredients.includes(t)).map((t) => `<button class="chip-toggle" data-action="add-avoid-suggestion" data-term="${t}">${icon('plus')}${t}</button>`).join('')}
          </div>
          <small>Recipes with any of these are never randomized in, and are flagged with ⚠ anywhere they appear.</small>
        </div>
      </section>

      <section class="panel">
        <h2>Randomizer & display</h2>
        <label class="switch"><span><b>Prefer favorites</b><br><small class="subtle">Favorited recipes are 3× more likely to be picked.</small></span><input type="checkbox" data-setting="favoritesBoost" ${s.favoritesBoost ? 'checked' : ''}></label>
        <div class="field">
          <label for="theme">Theme (this device)</label>
          <select id="theme" class="input" data-action="theme">
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="auto" ${theme === 'auto' ? 'selected' : ''}>Match system</option>
          </select>
        </div>
      </section>

      <section class="panel">
        <h2>Creators</h2>
        <p class="subtle" style="margin:0">Follow a creator's recipe website and pull their newest recipes into your library. TikTok itself doesn't share recipes with other apps, so for creators without a website, paste a TikTok video link under <b>Import link / TikTok</b>.</p>
        <ul class="creator-list">
          ${s.creators.map((c) => `
            <li>
              <span class="cr-name"><b>${esc(c.name)}</b> <small>${esc(c.handle || '')}</small><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.url.replace(/^https?:\/\/(www\.)?/, ''))}</a></span>
              <button class="btn sm" data-action="pull-creators" data-name="${esc(c.name)}">${icon('download')}Pull</button>
              <button class="icon-btn sm" data-action="unfollow" data-name="${esc(c.name)}" aria-label="Unfollow ${esc(c.name)}">${icon('x')}</button>
            </li>`).join('') || '<li class="subtle">Not following anyone yet.</li>'}
        </ul>
        ${state.meta.suggestedCreators.filter((c) => !s.creators.some((f) => f.name === c.name)).map((c) => `
          <div class="creator-suggest">
            <span><b>${esc(c.name)}</b> <small>${esc(c.handle)}</small><br><small class="subtle">${esc(c.note)}</small></span>
            ${c.url ? `<button class="btn sm" data-action="follow" data-name="${esc(c.name)}">${icon('plus')}Follow</button>` : ''}
          </div>`).join('')}
        <form class="inline-form" data-form="add-creator">
          <input class="input" name="name" placeholder="Creator name" maxlength="40" aria-label="Creator name" required>
          <input class="input" name="url" type="url" placeholder="Their recipe website" aria-label="Creator website" required>
          <button class="btn">${icon('plus')}Follow</button>
        </form>
      </section>

      <section class="panel">
        <h2>Recipes</h2>
        <p class="subtle" style="margin:0">${state.recipes.length} recipes in your library (${state.recipes.filter((r) => r.favorite).length} favorites).</p>
        <div class="modal-actions">
          <button class="btn" data-action="new-recipe">${icon('plus')}New recipe</button>
          <button class="btn" data-action="import-url">${icon('link')}Import link / TikTok</button>
          <button class="btn" data-action="refresh-recipes">${icon('globe')}Pull from recipe databases</button>
        </div>
      </section>
    </div>`;
}

// ---------- modals ----------

function openModal(html) {
  modalBody.innerHTML = `<button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon('x')}</button>${html}`;
  if (!modal.open) modal.showModal();
  modalBody.scrollTop = 0;
}

async function openRecipe(id, slotId) {
  let r;
  try { r = await api('GET', `/api/recipes/${encodeURIComponent(id)}`); } catch (e) { toast(e.message, 'error'); return; }
  const s = state.settings;
  const slotOptions = state.plan.slots.map((slot) => {
    const date = addDays(parseKey(state.weekKey), slot.day);
    const cur = slot.recipeId && state.byId.get(slot.recipeId);
    return `<option value="${slot.id}" ${slot.id === slotId ? 'selected' : ''}>${DAY_NAMES[date.getDay()]} ${slot.meal}${cur ? ` (replace ${esc(cur.name.slice(0, 28))})` : ''}</option>`;
  }).join('');
  const scaleNote = r.servings !== s.householdSize ? `Recipe serves ${r.servings}; your grocery list scales it to ${s.householdSize}.` : `Serves ${r.servings}.`;
  openModal(`
    ${r.image ? `<div class="hero"><img src="${esc(r.image)}" alt="" onerror="this.parentNode.remove()"></div>` : ''}
    <div class="modal-content" data-recipe="${esc(r.id)}">
      <div class="modal-head">
        <h2 id="modal-title">${esc(r.name)}</h2>
        <div class="meal-meta">${chips(r)}${r.cuisine ? `<span class="chip">${esc(r.cuisine)}</span>` : ''}${r.category ? `<span class="chip">${esc(r.category)}</span>` : ''}</div>
        <div class="modal-actions">
          <button class="btn ${r.favorite ? '' : 'primary'}" data-action="fav" data-id="${esc(r.id)}" aria-pressed="${r.favorite}">${icon(r.favorite ? 'heart-fill' : 'heart')}${r.favorite ? 'Favorited' : 'Favorite'}</button>
          ${r.sourceUrl ? `<a class="btn ghost" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(r.creator || r.source)}${/tiktok/i.test(r.sourceUrl) ? ' on TikTok' : ''}</a>` : ''}
          <button class="btn ghost" data-action="edit-recipe" data-id="${esc(r.id)}">${icon('pencil')}Edit</button>
        </div>
      </div>

      <form class="inline-form" data-form="add-to-plan">
        <select class="input" name="slot" aria-label="Day and meal">${slotOptions}</select>
        <button class="btn primary">${icon('calendar')}Add to ${esc(relativeWeek(state.weekKey).toLowerCase())}</button>
      </form>

      ${nutritionPanel(r)}

      <div class="recipe-cols">
        <div>
          <h3>Ingredients</h3>
          <p class="subtle" style="margin:-.3rem 0 .5rem">${scaleNote}</p>
          ${avoidHits(r).length ? `<p class="avoid-note">⚠ Contains ${esc(avoidHits(r).join(', '))}, which is on your allergies &amp; dislikes list.</p>` : ''}
          <ul class="ing-list">${r.ingredients.map((i) => {
            const bad = avoidMatch([i.name]).length;
            return `<li class="${bad ? 'avoid' : ''}"><span class="m">${esc(i.measure)}</span><span>${esc(i.name)}${bad ? ' <b>avoid</b>' : ''}</span></li>`;
          }).join('')}</ul>
        </div>
        <div>
          <h3>Method</h3>
          ${r.instructions.length ? `<ol class="steps">${r.instructions.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : `<p class="subtle">No method included — see the source link.</p>`}
        </div>
      </div>

      <details>
        <summary class="subtle" style="cursor:pointer">Edit price, meal types, or remove</summary>
        <div style="display:grid;gap:1rem;margin-top:1rem">
          <form class="inline-form" data-form="price">
            <label for="cost-in">Price per serving</label>
            <span class="money"><span>${esc(s.currency)}</span><input id="cost-in" class="input" type="number" inputmode="decimal" min="0" step="0.05" name="cost" value="${r.costOverride ?? ''}" placeholder="${r.estimatedCost.toFixed(2)} (estimate)"></span>
            <button class="btn">Save</button>
          </form>
          <div class="field">
            <span class="label">Randomizer can use it for</span>
            <div class="chips">${MEALS.map((m) => `<button class="chip-toggle" data-action="recipe-meal" data-meal="${m}" aria-pressed="${r.mealTypes.includes(m)}">${m}</button>`).join('')}</div>
          </div>
          <div><button class="btn danger" data-action="hide-recipe" data-id="${esc(r.id)}">${icon('trash')}Remove from library</button></div>
        </div>
      </details>
    </div>`);
}

function nutritionPanel(r) {
  const n = r.nutrition;
  if (!n?.kcal) return '';
  const src = { recipe: 'From the recipe', estimate: 'Estimated from the ingredients', rough: 'Rough estimate (some amounts were missing)', manual: 'Entered by you' }[n.source] || 'Estimated';
  const cell = (v, unit, label, cls = '') => `<div class="nut ${cls}"><b>${v == null ? '–' : fmt(v)}<small>${unit}</small></b><span>${label}</span></div>`;
  return `
    <section class="nutrition" aria-label="Nutrition per serving">
      <div class="nut-grid">
        ${cell(n.kcal, '', 'kcal')}
        ${cell(n.protein, 'g', 'protein', 'p')}
        ${cell(n.carbs, 'g', 'carbs', 'c')}
        ${cell(n.fat, 'g', 'fat', 'f')}
        ${cell(n.fiber, 'g', 'fiber')}
        <div class="nut score ${isHealthy(r) ? 'good' : ''}"><b>${r.healthScore ?? '–'}<small>/100</small></b><span>health score</span></div>
      </div>
      <p class="subtle">Per serving · ${src}</p>
    </section>`;
}

function renderPickerList(slot, q, showAll) {
  const query = q.trim().toLowerCase();
  const list = state.recipes.filter((r) => {
    if (query && !`${r.name} ${r.cuisine} ${r.category}`.toLowerCase().includes(query)) return false;
    return showAll || fitsSettings(r, slot.meal);
  }).sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name)).slice(0, 80);
  if (!list.length) return `<p class="subtle">Nothing matches.</p>`;
  return list.map((r) => `
    <button class="pick" data-action="pick" data-id="${esc(r.id)}">
      ${thumb(r, 'small') ? `<img src="${esc(thumb(r, 'small'))}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))">` : '<span class="ph"></span>'}
      <span class="t"><b>${r.favorite ? '♥ ' : ''}${esc(r.name)}</b><span class="meal-meta">${chips(r)}</span></span>
    </button>`).join('');
}

function openPicker(slotId) {
  const slot = state.plan.slots.find((s) => s.id === slotId);
  const date = addDays(parseKey(state.weekKey), slot.day);
  openModal(`
    <div class="modal-content" data-picker="${slotId}">
      <h2 id="modal-title">Choose ${esc(slot.meal)} for ${DAY_NAMES[date.getDay()]}</h2>
      <div class="search">${icon('search')}<input class="input" type="search" data-picker-q placeholder="Search recipes…" aria-label="Search recipes"></div>
      <label class="switch" style="justify-content:flex-start"><input type="checkbox" data-picker-all><span>Show everything (ignore meal type, budget, protein and allergy settings)</span></label>
      <p class="subtle" style="margin:0">Picking a recipe locks it in so the randomizer keeps it.</p>
      <div class="picker-list">${renderPickerList(slot, '', false)}</div>
    </div>`);
  setTimeout(() => $('[data-picker-q]', modalBody)?.focus(), 50);
}

// Recipe editor: new recipes, finishing a TikTok draft, or editing any recipe.
function openEditor(d = {}, id = null) {
  const meals = d.mealTypes || ['lunch', 'dinner'];
  const n = d.nutrition || {};
  const num = (v) => (v == null || v === '' ? '' : esc(v));
  openModal(`
    <form class="modal-content editor" data-form="save-recipe" data-id="${esc(id || '')}">
      <h2 id="modal-title">${id ? 'Edit recipe' : d.sourceUrl ? 'Finish this recipe' : 'New recipe'}</h2>
      ${d.caption ? `<div class="caption-box"><span class="subtle">Caption from ${esc(d.creator || 'TikTok')}</span><p>${esc(d.caption)}</p>${d.sourceUrl ? `<a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('link')}Watch the video</a>` : ''}</div>` : ''}
      <div class="field"><label for="ed-name">Name</label><input id="ed-name" class="input" name="name" required maxlength="120" value="${esc(d.name || '')}"></div>
      <div class="field-row">
        <div class="field"><label for="ed-creator">Creator</label><input id="ed-creator" class="input" name="creator" maxlength="60" placeholder="@handle" value="${esc(d.creator || '')}"></div>
        <div class="field"><label for="ed-serv">Serves</label><input id="ed-serv" class="input" name="servings" type="number" min="1" max="30" value="${esc(d.servings || 4)}"></div>
        <div class="field"><label for="ed-min">Minutes</label><input id="ed-min" class="input" name="totalMinutes" type="number" min="0" max="1440" value="${num(d.totalMinutes)}"></div>
      </div>
      <div class="field">
        <span class="label">Good for</span>
        <div class="chips">${MEALS.map((m) => `<label class="chip-toggle check" data-meal="${m}"><input type="checkbox" name="meal" value="${m}" ${meals.includes(m) ? 'checked' : ''}>${m}</label>`).join('')}</div>
      </div>
      <div class="field"><label for="ed-ing">Ingredients <small class="subtle">one per line, e.g. "500g chicken breast"</small></label><textarea id="ed-ing" class="input" name="ingredientsText" rows="8" required>${esc(d.ingredientsText || '')}</textarea></div>
      <div class="field"><label for="ed-steps">Steps <small class="subtle">one per line</small></label><textarea id="ed-steps" class="input" name="instructionsText" rows="6">${esc(d.instructionsText || '')}</textarea></div>
      <div class="field">
        <span class="label">Macros per serving <small class="subtle">optional; leave empty to estimate from the ingredients</small></span>
        <div class="field-row macros-in">
          <label>kcal<input class="input" name="kcal" type="number" min="0" value="${num(n.kcal ?? n.calories)}"></label>
          <label>Protein g<input class="input" name="protein" type="number" min="0" value="${num(n.protein ?? n.proteinContent)}"></label>
          <label>Carbs g<input class="input" name="carbs" type="number" min="0" value="${num(n.carbs ?? n.carbohydrateContent)}"></label>
          <label>Fat g<input class="input" name="fat" type="number" min="0" value="${num(n.fat ?? n.fatContent)}"></label>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label for="ed-src">Link</label><input id="ed-src" class="input" name="sourceUrl" type="url" value="${esc(d.sourceUrl || '')}"></div>
        <div class="field"><label for="ed-img">Photo URL</label><input id="ed-img" class="input" name="image" type="url" value="${esc(d.image || '')}"></div>
      </div>
      <div class="modal-actions"><button class="btn primary lg">${icon('check')}Save recipe</button><button type="button" class="btn ghost" data-action="close-modal">Cancel</button></div>
    </form>`);
  setTimeout(() => $('#ed-name', modalBody)?.focus(), 50);
}

async function editRecipe(id) {
  const r = await api('GET', `/api/recipes/${encodeURIComponent(id)}`);
  const n = r.nutrition?.source === 'manual' || r.nutrition?.source === 'recipe' ? r.nutrition : {};
  openEditor({
    ...r,
    ingredientsText: r.ingredients.map((i) => `${i.measure} ${i.name}`.trim()).join('\n'),
    instructionsText: r.instructions.join('\n'),
    nutrition: n,
  }, id);
}

function openImport() {
  openModal(`
    <div class="modal-content">
      <h2 id="modal-title">Import a recipe link</h2>
      <p class="subtle" style="margin:0">Paste a recipe page or a TikTok video link. Recipe pages from most sites and creator blogs import complete. For a TikTok, the app grabs the caption, creator and cover image; if the ingredients aren't in the caption, you'll finish it in the editor while you watch. Different versions of a meal you already have are kept as separate recipes.</p>
      <form class="inline-form" data-form="import">
        <input class="input" type="url" name="url" required placeholder="https://www.tiktok.com/@creator/video/… or a recipe page" aria-label="Recipe or TikTok link">
        <button class="btn primary">${icon('download')}Import</button>
      </form>
    </div>`);
  setTimeout(() => $('input[name=url]', modalBody)?.focus(), 50);
}

modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

// ---------- actions ----------

async function updateSettings(patch) {
  state.settings = await api('PUT', '/api/settings', { ...state.settings, ...patch });
  setAvoidRules();
  if ('avoidAllergens' in patch || 'avoidIngredients' in patch) {
    const clash = state.plan.slots.filter((sl) => sl.recipeId && state.byId.has(sl.recipeId) && avoidHits(state.byId.get(sl.recipeId)).length).length;
    if (clash) toast(`${clash} planned meal${clash > 1 ? 's' : ''} this week contain${clash > 1 ? '' : 's'} something on your list. They're marked ⚠ on the plan.`, '', 'clash');
  }
  if ('meals' in patch || 'householdSize' in patch) await loadWeek();
  if ('weekStartsOn' in patch) { state.weekKey = weekStart(parseKey(state.weekKey)); await loadWeek(); }
  render();
}

async function toggleFavorite(id) {
  const r = state.byId.get(id);
  const updated = await api('PATCH', `/api/recipes/${encodeURIComponent(id)}`, { favorite: !r.favorite });
  upsertRecipe(updated);
  toast(updated.favorite ? `♥ Added ${updated.name} to favorites` : 'Removed from favorites');
  render();
  if (modal.open && $('[data-recipe]', modalBody)?.dataset.recipe === id) openRecipe(id);
  else if (modal.open && $('[data-picker]', modalBody)) modal.close();
}

const actions = {
  'week-prev': () => changeWeek(-7),
  'week-next': () => changeWeek(7),
  'week-today': async () => { state.weekKey = weekStart(); await loadWeek(); render(); scrollToToday(); },
  randomize: async (el) => {
    await setPlan(await api('POST', `/api/weeks/${state.weekKey}/randomize`));
    const empty = state.plan.slots.filter((s) => !s.recipeId).length;
    if (empty) toast(`Couldn't fill ${empty} meal${empty > 1 ? 's' : ''} — try loosening your price, health, protein or allergy settings.`, 'error');
  },
  'clear-week': async () => {
    if (!confirm('Clear all unlocked meals for this week?')) return;
    await setPlan(await api('POST', `/api/weeks/${state.weekKey}/clear`));
  },
  reroll: async (el) => setPlan(await api('POST', `/api/weeks/${state.weekKey}/slots/${el.dataset.slot}/reroll`)),
  lock: async (el) => {
    const slot = state.plan.slots.find((s) => s.id === el.dataset.slot);
    await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${slot.id}`, { locked: !slot.locked }));
  },
  choose: (el) => openPicker(el.dataset.slot),
  pick: async (el) => {
    const slotId = $('[data-picker]', modalBody).dataset.picker;
    modal.close();
    await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${slotId}`, { recipeId: el.dataset.id, locked: true }));
    toast('Added and locked in');
  },
  fav: (el) => toggleFavorite(el.dataset.id),
  'open-recipe': (el) => openRecipe(el.dataset.id, el.dataset.slot),
  'close-modal': () => modal.close(),
  'toggle-hide': () => { state.hideChecked = !state.hideChecked; saveLocal('hideChecked', state.hideChecked); render(); },
  'uncheck-all': async () => { state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { uncheckAll: true }); render(); },
  'remove-extra': async (el, e) => {
    e.preventDefault();
    state.grocery = await api('DELETE', `/api/weeks/${state.weekKey}/grocery/extras/${el.dataset.id}`);
    render();
  },
  'copy-list': async () => {
    const g = state.grocery;
    const lines = [`Groceries · ${weekRange(state.weekKey)}`, ''];
    let aisle = null;
    for (const i of g.items.filter((x) => !x.checked)) {
      if (i.aisle !== aisle) { aisle = i.aisle; lines.push('', `${aisle.toUpperCase()}`); }
      lines.push(`☐ ${i.name}${i.amount ? ` — ${i.amount}` : ''}`);
    }
    const extras = g.extras.filter((x) => !x.checked);
    if (extras.length) { lines.push('', 'OTHER'); extras.forEach((e) => lines.push(`☐ ${e.name}`)); }
    const text = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: 'Grocery list', text }); return; } catch { /* fall back to copy */ }
    }
    try { await navigator.clipboard.writeText(text); toast('List copied to clipboard'); } catch { toast('Copy failed — your browser blocked clipboard access', 'error'); }
  },
  more: () => { state.recipeFilters.limit += PAGE * 2; render(); },
  'filter-fav': () => { state.recipeFilters.favorites = !state.recipeFilters.favorites; state.recipeFilters.limit = PAGE; render(); },
  'filter-healthy': () => { state.recipeFilters.healthy = !state.recipeFilters.healthy; state.recipeFilters.limit = PAGE; render(); },
  'filter-budget': () => { state.recipeFilters.budget = !state.recipeFilters.budget; state.recipeFilters.limit = PAGE; render(); },
  'import-url': () => openImport(),
  'new-recipe': () => openEditor(),
  'edit-recipe': (el) => editRecipe(el.dataset.id),
  'pull-creators': async (el) => {
    toast(`Checking ${el.dataset.name || 'your creators'} for new recipes… this can take a minute.`);
    const res = await api('POST', '/api/creators/pull', el.dataset.name ? { name: el.dataset.name } : {});
    setRecipes(await api('GET', '/api/recipes'));
    render();
    const added = res.results.reduce((a, r) => a + r.added, 0);
    const failed = res.results.filter((r) => r.error);
    if (added) toast(`Added ${added} recipe${added > 1 ? 's' : ''}: ${res.results.filter((r) => r.added).map((r) => `${r.added} from ${r.name}`).join(', ')}`);
    else if (!failed.length) toast('No new recipes from your creators right now.');
    failed.forEach((r) => toast(`${r.name}: ${r.error}`, 'error'));
  },
  follow: (el) => {
    const c = state.meta.suggestedCreators.find((x) => x.name === el.dataset.name);
    return updateSettings({ creators: [...state.settings.creators, { name: c.name, handle: c.handle, url: c.url }] });
  },
  unfollow: (el) => updateSettings({ creators: state.settings.creators.filter((c) => c.name !== el.dataset.name) }),
  'refresh-recipes': async () => {
    toast('Pulling recipes from the internet… this can take a minute.');
    const res = await api('POST', '/api/recipes/refresh');
    setRecipes(await api('GET', '/api/recipes'));
    render();
    toast(res.added ? `Added ${res.added} new recipes (${res.total} total)` : `You're up to date — no new recipes found (${res.total} total)`);
  },
  household: (el) => updateSettings({ householdSize: state.settings.householdSize + Number(el.dataset.delta) }),
  'toggle-meal': (el) => {
    const m = el.dataset.meal;
    const meals = state.settings.meals.includes(m) ? state.settings.meals.filter((x) => x !== m) : [...state.settings.meals, m];
    if (!meals.length) { toast('Plan at least one meal a day', 'error'); return; }
    return updateSettings({ meals });
  },
  'toggle-allergen': (el) => {
    const k = el.dataset.allergen;
    const list = state.settings.avoidAllergens;
    return updateSettings({ avoidAllergens: list.includes(k) ? list.filter((x) => x !== k) : [...list, k] });
  },
  'remove-avoid': (el) => updateSettings({ avoidIngredients: state.settings.avoidIngredients.filter((t) => t !== el.dataset.term) }),
  'add-avoid-suggestion': (el) => updateSettings({ avoidIngredients: [...state.settings.avoidIngredients, el.dataset.term] }),
  'toggle-protein': (el) => {
    const p = el.dataset.protein;
    const ex = state.settings.excludedProteins;
    return updateSettings({ excludedProteins: ex.includes(p) ? ex.filter((x) => x !== p) : [...ex, p] });
  },
  'recipe-meal': async (el) => {
    const id = $('[data-recipe]', modalBody).dataset.recipe;
    const r = state.byId.get(id);
    const m = el.dataset.meal;
    const mealTypes = r.mealTypes.includes(m) ? r.mealTypes.filter((x) => x !== m) : [...r.mealTypes, m];
    upsertRecipe(await api('PATCH', `/api/recipes/${encodeURIComponent(id)}`, { mealTypes }));
    el.setAttribute('aria-pressed', mealTypes.includes(m));
  },
  'hide-recipe': async (el) => {
    const r = state.byId.get(el.dataset.id);
    if (!confirm(`Remove "${r.name}" from your library? It will also be taken off any planned weeks.`)) return;
    await api('DELETE', `/api/recipes/${encodeURIComponent(r.id)}`);
    setRecipes(state.recipes.filter((x) => x.id !== r.id));
    modal.close();
    await loadWeek();
    render();
    toast('Recipe removed');
  },
};

async function changeWeek(days) {
  state.weekKey = isoDate(addDays(parseKey(state.weekKey), days));
  await loadWeek();
  render();
}

// ---------- drag meals between days ----------
// Mouse: drag a tile anywhere. Touch: press and hold a tile, or drag the grip
// handle straight away. Keyboard / TV remote: focus the grip and use arrows.

let drag = null;
let suppressClick = false;

async function moveMealTo(meal, from, to) {
  if (from === to || to < 0 || to > 6) return;
  await setPlan(await api('POST', `/api/weeks/${state.weekKey}/move`, { meal, from, to }), { animate: true });
}

function dropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const day = el && el.closest('.day[data-day]');
  return day ? Number(day.dataset.day) : null;
}

function startDrag() {
  const d = drag;
  d.active = true;
  clearTimeout(d.timer);
  const rect = d.tile.getBoundingClientRect();
  d.offsetX = d.x - rect.left;
  d.offsetY = d.y - rect.top;
  d.ghost = d.tile.cloneNode(true);
  d.ghost.classList.add('drag-ghost');
  d.ghost.style.width = `${rect.width}px`;
  document.body.append(d.ghost);
  d.tile.classList.add('dragging');
  document.body.classList.add('is-dragging');
  navigator.vibrate?.(12);
  moveGhost();
  d.raf = requestAnimationFrame(autoScroll);
}

function moveGhost() {
  const d = drag;
  d.ghost.style.transform = `translate(${d.x - d.offsetX}px, ${d.y - d.offsetY}px) rotate(1.5deg) scale(1.03)`;
  const day = dropTargetAt(d.x, d.y);
  if (day === d.overDay) return;
  d.overDay = day;
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
  if (day != null && day !== d.from) {
    document.querySelector(`.day[data-day="${day}"] .meal[data-meal="${d.meal}"]`)?.classList.add('drop-target');
    document.querySelector(`.day[data-day="${day}"]`)?.classList.add('drop-target');
  }
}

// Scroll the page when dragging near the top or bottom edge (phones stack the days).
function autoScroll() {
  if (!drag?.active) return;
  const edge = 90;
  const bottom = innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h')) || 0) * 16;
  let dy = 0;
  if (drag.y < edge) dy = -Math.ceil((edge - drag.y) / 6);
  else if (drag.y > bottom - edge) dy = Math.ceil((drag.y - (bottom - edge)) / 6);
  if (dy) { window.scrollBy(0, dy); moveGhost(); }
  drag.raf = requestAnimationFrame(autoScroll);
}

function endDrag(commit) {
  const d = drag;
  drag = null;
  if (!d) return;
  clearTimeout(d.timer);
  if (!d.active) return;
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  d.tile.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
  if (commit && d.overDay != null && d.overDay !== d.from) busy(null, () => moveMealTo(d.meal, d.from, d.overDay));
}

document.addEventListener('pointerdown', (e) => {
  if (state.tab !== 'plan' || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const tile = e.target.closest('.meal[data-recipe]');
  if (!tile) return;
  const handle = e.target.closest('[data-drag-handle]');
  if (!handle && e.target.closest('.meal-actions')) return; // let the other buttons work normally
  drag = { tile, from: Number(tile.dataset.day), meal: tile.dataset.meal, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType, active: false, overDay: null };
  if (handle) {
    e.preventDefault();
    startDrag();
  } else if (e.pointerType !== 'mouse') {
    drag.timer = setTimeout(() => drag && !drag.active && startDrag(), 380); // press and hold
  }
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (!drag.active) {
    const moved = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    if (drag.type === 'mouse' && moved > 6) startDrag();
    else if (drag.type !== 'mouse' && moved > 10) endDrag(false); // finger moved first: it's a scroll
    return;
  }
  moveGhost();
});
document.addEventListener('pointerup', () => endDrag(true));
document.addEventListener('pointercancel', () => endDrag(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag?.active) endDrag(false); });
// While dragging on a touch screen, stop the page from scrolling under the finger.
document.addEventListener('touchmove', (e) => { if (drag?.active) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => { if (drag) e.preventDefault(); });
// A drag shouldn't also count as a click that opens the recipe.
document.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

document.addEventListener('keydown', (e) => {
  const handle = e.target.closest?.('[data-drag-handle]');
  if (!handle) return;
  const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const tile = handle.closest('.meal');
  const { meal } = tile.dataset;
  const from = Number(tile.dataset.day);
  const to = from + step;
  if (to < 0 || to > 6) return;
  const recipe = tile.dataset.recipe;
  busy(null, async () => {
    await moveMealTo(meal, from, to);
    const moved = state.plan.slots.find((s) => s.meal === meal && s.recipeId === recipe);
    document.querySelector(`.meal[data-day="${moved?.day}"][data-meal="${meal}"] [data-drag-handle]`)?.focus();
  });
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  busy(el.tagName === 'BUTTON' ? el : null, () => fn(el, e));
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'check') {
    busy(null, async () => {
      state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { key: el.dataset.key, checked: el.checked });
      render();
    });
  } else if (el.dataset.action === 'check-extra') {
    busy(null, async () => {
      state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { extraId: el.dataset.id, checked: el.checked });
      render();
    });
  } else if (el.dataset.action === 'theme') {
    saveLocal('theme', el.value);
    document.documentElement.dataset.theme = el.value;
  } else if (el.dataset.setting) {
    const key = el.dataset.setting;
    const value = el.type === 'checkbox' ? el.checked : el.type === 'number' || key === 'weekStartsOn' ? Number(el.value) || 0 : el.value;
    busy(null, () => updateSettings({ [key]: value }).then(() => toast('Saved')));
  } else if (el.dataset.filter) {
    state.recipeFilters[el.dataset.filter] = el.value;
    state.recipeFilters.limit = PAGE;
    render();
  } else if (el.matches('[data-picker-all]')) {
    refreshPicker();
  }
});

let searchTimer;
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.filter === 'q') {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.recipeFilters.q = el.value;
      state.recipeFilters.limit = PAGE;
      const pos = el.selectionStart;
      render();
      const input = $('[data-filter="q"]');
      input.focus();
      input.setSelectionRange(pos, pos);
    }, 180);
  } else if (el.matches('[data-picker-q]')) {
    refreshPicker();
  }
});

function refreshPicker() {
  const wrap = $('[data-picker]', modalBody);
  if (!wrap) return;
  const slot = state.plan.slots.find((s) => s.id === wrap.dataset.picker);
  $('.picker-list', wrap).innerHTML = renderPickerList(slot, $('[data-picker-q]', wrap).value, $('[data-picker-all]', wrap).checked);
}

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const btn = $('button', form);
  const handlers = {
    'add-avoid': async () => {
      const terms = data.term.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (!terms.length) return;
      await updateSettings({ avoidIngredients: [...state.settings.avoidIngredients, ...terms] });
      $('#avoid-in')?.focus();
    },
    'add-extra': async () => {
      if (!data.name.trim()) return;
      state.grocery = await api('POST', `/api/weeks/${state.weekKey}/grocery/extras`, { name: data.name });
      render();
      $('[data-form="add-extra"] input')?.focus();
    },
    import: async () => {
      const res = await api('POST', '/api/recipes/import', { url: data.url });
      if (res.draft) {
        openEditor(res.draft);
        return;
      }
      upsertRecipe(res.recipe);
      toast(res.duplicate ? 'You already have that recipe' : `Imported "${res.recipe.name}"`);
      render();
      openRecipe(res.recipe.id);
    },
    'save-recipe': async () => {
      const fd = new FormData(form);
      const id = form.dataset.id;
      const payload = {
        ...data,
        mealTypes: fd.getAll('meal'),
        nutrition: { kcal: data.kcal, protein: data.protein, carbs: data.carbs, fat: data.fat },
      };
      const saved = await api(id ? 'PUT' : 'POST', id ? `/api/recipes/${encodeURIComponent(id)}` : '/api/recipes', payload);
      upsertRecipe(saved);
      setAvoidRules();
      render();
      toast(id ? 'Recipe saved' : `Added "${saved.name}" to your recipes`);
      openRecipe(saved.id);
    },
    'add-creator': async () => {
      await updateSettings({ creators: [...state.settings.creators, { name: data.name.trim(), url: data.url.trim(), handle: '' }] });
      toast(`Following ${data.name}. Tap Pull to get their recipes.`);
    },
    'add-to-plan': async () => {
      const id = $('[data-recipe]', modalBody).dataset.recipe;
      modal.close();
      await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${data.slot}`, { recipeId: id, locked: true }));
      toast('Added to the plan and locked in');
    },
    price: async () => {
      const id = $('[data-recipe]', modalBody).dataset.recipe;
      const updated = await api('PATCH', `/api/recipes/${encodeURIComponent(id)}`, { costOverride: data.cost === '' ? null : Number(data.cost) });
      upsertRecipe(updated);
      render();
      toast(updated.costOverride ? `Price set to ${money(updated.costOverride)}/serving` : 'Using the estimated price');
      openRecipe(id);
    },
  };
  busy(btn, handlers[form.dataset.form]);
});

// ---------- routing & boot ----------

function route() {
  const tab = location.hash.slice(1) || 'plan';
  state.tab = ['plan', 'groceries', 'recipes', 'settings'].includes(tab) ? tab : 'plan';
  if (modal.open) modal.close();
  render();
  window.scrollTo({ top: 0 });
  scrollToToday();
}
window.addEventListener('hashchange', route);

// When the days are stacked in one column (phones), jump straight to today.
function scrollToToday() {
  const el = state.tab === 'plan' && document.querySelector('.day.today');
  if (!el || el.offsetWidth < main.clientWidth * 0.7 || el.dataset.day === '0') return;
  el.scrollIntoView({ block: 'start' });
}

// Keep devices in sync: refresh when the app comes back into view.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.weekKey && !modal.open) {
    busy(null, async () => { await loadWeek(); render(); });
  }
});

async function boot() {
  main.innerHTML = '<div class="week-grid">' + '<div class="skeleton"></div>'.repeat(7) + '</div>';
  try {
    const [settings, meta, recipes] = await Promise.all([api('GET', '/api/settings'), api('GET', '/api/meta'), api('GET', '/api/recipes')]);
    state.settings = settings;
    state.meta = meta;
    setAvoidRules();
    setRecipes(recipes);
    state.weekKey = weekStart();
    await loadWeek();
    route();
  } catch (e) {
    main.innerHTML = `<div class="panel empty"><h2>Can't reach the server</h2><p>${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Retry</button></div>`;
  }
}

boot();
