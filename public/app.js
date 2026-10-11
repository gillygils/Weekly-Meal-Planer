// Weekly Meal Planner frontend. No framework, no build step.

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

function toast(message, type = '') {
  const el = document.createElement('div');
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

async function setPlan(plan) {
  state.plan = plan;
  state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
  render();
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
  const start = parseKey(state.weekKey);

  const days = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d);
    const slots = enabled.map((m) => plan.slots.find((s) => s.day === d && s.meal === m)).filter(Boolean);
    days.push(`
      <section class="panel day ${isoDate(date) === todayKey ? 'today' : ''}" aria-label="${DAY_NAMES[date.getDay()]}">
        <div class="day-head"><h2>${DAY_NAMES[date.getDay()]}</h2><span>${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
        ${slots.map((s) => `${enabled.length > 1 ? `<div class="meal-label">${s.meal}</div>` : ''}${renderSlot(s)}`).join('')}
      </section>`);
  }

  return `
    <div class="toolbar">
      <div class="stats">
        <span><strong>${filled.length}</strong>/${plan.slots.length} meals</span>
        <span><strong>${locked}</strong> locked</span>
        <span class="${over ? 'over' : ''}" title="Feeds ${settings.householdSize}"><strong>${money(weekCost)}</strong> est. week · ${money(avg)}/serving</span>
      </div>
      <span class="spacer"></span>
      <button class="btn ghost" data-action="clear-week" title="Clear all unlocked meals">${icon('broom')}<span>Clear</span></button>
      <button class="btn primary lg" data-action="randomize">${icon('dice')}<span>Randomize${locked ? ' unlocked' : ''}</span></button>
    </div>
    ${filled.length === 0 ? `<div class="panel empty" style="margin-bottom:1rem"><h2>Nothing planned yet</h2><p>Hit <b>Randomize</b> to fill the week. Lock the meals you like and randomize again to swap out the rest.</p></div>` : ''}
    <div class="week-grid">${days.join('')}</div>`;
}

function renderSlot(s) {
  const r = s.recipeId && state.byId.get(s.recipeId);
  if (!r) {
    return `
      <div class="meal empty-slot">
        <span>No ${s.meal} planned</span>
        <div class="row">
          <button class="btn" data-action="reroll" data-slot="${s.id}">${icon('dice')}Random</button>
          <button class="btn" data-action="choose" data-slot="${s.id}">${icon('search')}Choose</button>
        </div>
      </div>`;
  }
  return `
    <article class="meal ${s.locked ? 'locked' : ''}">
      <button class="meal-open" data-action="open-recipe" data-id="${esc(r.id)}" data-slot="${s.id}" aria-label="Open ${esc(r.name)}">
        <div class="meal-img">${imgTag(r, 'medium')}${s.locked ? `<span class="lock-flag">${icon('lock')}<span>Locked</span></span>` : ''}</div>
        <div class="meal-body">
          <div class="meal-name">${esc(r.name)}</div>
          <div class="meal-meta">${chips(r)}</div>
        </div>
      </button>
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
  const excluded = state.settings.excludedProteins;
  let list = state.recipes.filter((r) => {
    if (f.favorites && !r.favorite) return false;
    if (f.protein && !(r.mainProtein === f.protein || r.proteins.includes(f.protein))) return false;
    if (f.meal === 'other' ? r.mealTypes.length : f.meal && !r.mealTypes.includes(f.meal)) return false;
    if (f.budget && (overBudget(r) || r.proteins.some((p) => excluded.includes(p)) || (excluded.includes('vegetarian') && r.mainProtein === 'vegetarian'))) return false;
    if (q && !`${r.name} ${r.cuisine} ${r.category} ${r.tags.join(' ')} ${r.source}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    cheap: (a, b) => cost(a) - cost(b),
    pricey: (a, b) => cost(b) - cost(a),
    newest: (a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''),
    quick: (a, b) => (a.totalMinutes || 999) - (b.totalMinutes || 999),
  };
  list = list.sort(sorters[f.sort] || sorters.name);
  return list;
}

function renderRecipes() {
  const f = state.recipeFilters;
  const list = filteredRecipes();
  const shown = list.slice(0, f.limit);
  const proteins = Object.keys(PROTEIN_LABEL);
  return `
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" type="search" data-filter="q" value="${esc(f.q)}" placeholder="Search ${state.recipes.length} recipes, cuisines, tags…" aria-label="Search recipes"></div>
      <button class="btn" data-action="import-url">${icon('link')}Import from URL</button>
      <button class="btn" data-action="refresh-recipes">${icon('globe')}Pull more recipes</button>
    </div>
    <div class="filters">
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
        <option value="newest" ${f.sort === 'newest' ? 'selected' : ''}>Newest first</option>
      </select>
      <button class="chip-toggle" data-action="filter-fav" aria-pressed="${f.favorites}">${icon(f.favorites ? 'heart-fill' : 'heart')}Favorites</button>
      <button class="chip-toggle" data-action="filter-budget" aria-pressed="${f.budget}" title="Only recipes the randomizer is allowed to pick (price + protein settings)">${icon('check')}Fits my settings</button>
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
  const theme = load('theme', 'auto');
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
        <h2>Proteins to avoid</h2>
        <div class="field">
          <div class="chips">
            ${proteins.map((p) => `<button class="chip-toggle no" data-action="toggle-protein" data-protein="${p}" aria-pressed="${s.excludedProteins.includes(p)}">${PROTEIN_EMOJI[p] || ''} ${PROTEIN_LABEL[p] || p}</button>`).join('')}
          </div>
          <small>Tap anything someone doesn't eat. Recipes containing it are never randomized in. Picking "Vegetarian" skips meat-free meals.</small>
        </div>
      </section>

      <section class="panel">
        <h2>Randomizer & display</h2>
        <label class="switch"><span><b>Prefer favorites</b><br><small class="subtle">Favorited recipes are 3× more likely to be picked.</small></span><input type="checkbox" data-setting="favoritesBoost" ${s.favoritesBoost ? 'checked' : ''}></label>
        <div class="field">
          <label for="theme">Theme (this device)</label>
          <select id="theme" class="input" data-action="theme">
            <option value="auto" ${theme === 'auto' ? 'selected' : ''}>Match system</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
      </section>

      <section class="panel">
        <h2>Recipes</h2>
        <p class="subtle" style="margin:0">${state.recipes.length} recipes in your library (${state.recipes.filter((r) => r.favorite).length} favorites).</p>
        <div class="modal-actions">
          <button class="btn" data-action="refresh-recipes">${icon('globe')}Pull more recipes</button>
          <button class="btn" data-action="import-url">${icon('link')}Import from URL</button>
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
          ${r.sourceUrl ? `<a class="btn ghost" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(r.source)}</a>` : ''}
        </div>
      </div>

      <form class="inline-form" data-form="add-to-plan">
        <select class="input" name="slot" aria-label="Day and meal">${slotOptions}</select>
        <button class="btn primary">${icon('calendar')}Add to ${esc(relativeWeek(state.weekKey).toLowerCase())}</button>
      </form>

      <div class="recipe-cols">
        <div>
          <h3>Ingredients</h3>
          <p class="subtle" style="margin:-.3rem 0 .5rem">${scaleNote}</p>
          <ul class="ing-list">${r.ingredients.map((i) => `<li><span class="m">${esc(i.measure)}</span><span>${esc(i.name)}</span></li>`).join('')}</ul>
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

function renderPickerList(slot, q, showAll) {
  const s = state.settings;
  const excluded = s.excludedProteins;
  const query = q.trim().toLowerCase();
  const list = state.recipes.filter((r) => {
    if (query && !`${r.name} ${r.cuisine} ${r.category}`.toLowerCase().includes(query)) return false;
    if (showAll) return true;
    if (!r.mealTypes.includes(slot.meal)) return false;
    if (overBudget(r)) return false;
    if (r.proteins.some((p) => excluded.includes(p))) return false;
    if (excluded.includes('vegetarian') && r.mainProtein === 'vegetarian') return false;
    return true;
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
      <label class="switch" style="justify-content:flex-start"><input type="checkbox" data-picker-all><span>Show everything (ignore meal type, budget and protein settings)</span></label>
      <p class="subtle" style="margin:0">Picking a recipe locks it in so the randomizer keeps it.</p>
      <div class="picker-list">${renderPickerList(slot, '', false)}</div>
    </div>`);
  setTimeout(() => $('[data-picker-q]', modalBody)?.focus(), 50);
}

function openImport() {
  openModal(`
    <div class="modal-content">
      <h2 id="modal-title">Import a recipe from the web</h2>
      <p class="subtle" style="margin:0">Paste a link to a recipe page. Works with most recipe sites (AllRecipes, BBC Good Food, Serious Eats, NYT Cooking, Food Network, blogs…). It's fine to import different versions of a meal you already have — each one is its own recipe.</p>
      <form class="inline-form" data-form="import">
        <input class="input" type="url" name="url" required placeholder="https://www.example.com/best-lasagna" aria-label="Recipe URL">
        <button class="btn primary">${icon('download')}Import</button>
      </form>
    </div>`);
  setTimeout(() => $('input[name=url]', modalBody)?.focus(), 50);
}

modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

// ---------- actions ----------

async function updateSettings(patch) {
  state.settings = await api('PUT', '/api/settings', { ...state.settings, ...patch });
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
  'week-today': () => { state.weekKey = weekStart(); return loadWeek().then(render); },
  randomize: async (el) => {
    await setPlan(await api('POST', `/api/weeks/${state.weekKey}/randomize`));
    const empty = state.plan.slots.filter((s) => !s.recipeId).length;
    if (empty) toast(`Couldn't fill ${empty} meal${empty > 1 ? 's' : ''} — try loosening your price or protein settings.`, 'error');
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
  'filter-budget': () => { state.recipeFilters.budget = !state.recipeFilters.budget; state.recipeFilters.limit = PAGE; render(); },
  'import-url': () => openImport(),
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
    if (el.value === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = el.value;
  } else if (el.dataset.setting) {
    const key = el.dataset.setting;
    const value = el.type === 'checkbox' ? el.checked : key === 'weekStartsOn' ? Number(el.value) : key === 'maxPricePerServing' ? Number(el.value) || 0 : el.value;
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
    'add-extra': async () => {
      if (!data.name.trim()) return;
      state.grocery = await api('POST', `/api/weeks/${state.weekKey}/grocery/extras`, { name: data.name });
      render();
      $('[data-form="add-extra"] input')?.focus();
    },
    import: async () => {
      const res = await api('POST', '/api/recipes/import', { url: data.url });
      upsertRecipe(res.recipe);
      toast(res.duplicate ? 'You already have that recipe' : `Imported "${res.recipe.name}"`);
      render();
      openRecipe(res.recipe.id);
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
}
window.addEventListener('hashchange', route);

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
    setRecipes(recipes);
    state.weekKey = weekStart();
    await loadWeek();
    route();
  } catch (e) {
    main.innerHTML = `<div class="panel empty"><h2>Can't reach the server</h2><p>${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Retry</button></div>`;
  }
}

boot();
