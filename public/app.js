// Weekly Meal Planner frontend. No framework, no build step.
import { createAvoidMatcher, recoveryGroups } from './lib/recipes.js';
import { PANTRY_CATALOG, CATALOG_GROUPS, suggestPantry } from './lib/pantry-catalog.js';

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
  groceryView: load('groceryView', 'list'),
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

async function api(method, url, body, retried = false) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  // Session ran out (24h) while the app was open: ask for the PIN, then carry on.
  if (res.status === 401 && !url.startsWith('/api/auth/') && !retried) {
    await requirePin();
    return api(method, url, body, true);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- PIN lock ----------

let pinPromise = null;
/** Show the PIN screen until the device is signed in (or a PIN is created). */
function requirePin() {
  pinPromise ||= (async () => {
    const st = await fetch('/api/auth/status', { credentials: 'same-origin' }).then((r) => r.json());
    if (!st.authed) await pinScreen(st.pinSet ? 'login' : 'setup');
  })().finally(() => { pinPromise = null; });
  return pinPromise;
}

function pinScreen(mode) {
  return new Promise((resolve) => {
    if (modal.open) modal.close();
    const el = document.createElement('div');
    el.className = 'pin-lock';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'lock-title');
    document.body.append(el);
    document.body.classList.add('locked');
    let step = mode; // 'setup' -> 'confirm', or 'login'
    let pin = '';
    let first = '';
    let error = '';
    let busyNow = false;
    let lastKey = '1';
    let typing = false; // true after digits from a keyboard, false after arrows/taps
    const titles = {
      setup: ['Create a PIN', 'Pick 4 to 8 digits. Everyone in the house will use it, and each device asks for it once a day.'],
      confirm: ['Enter it again', 'Just to make sure.'],
      login: ['Enter your PIN', 'Each device asks once every 24 hours.'],
    };
    const draw = () => {
      const [title, sub] = titles[step];
      const dots = Math.max(step === 'login' ? 4 : 4, pin.length + (pin.length < 8 ? 1 : 0));
      el.innerHTML = `
        <div class="lock-card">
          <svg class="lock-logo" aria-hidden="true"><use href="#i-logo"/></svg>
          <h1 id="lock-title">${title}</h1>
          <p class="subtle">${sub}</p>
          <div class="pin-dots" aria-label="${pin.length} digits entered">${Array.from({ length: Math.min(8, dots) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('')}</div>
          <p class="pin-error" role="alert">${esc(error)}</p>
          <div class="keypad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join('')}
            <button type="button" data-k="back" aria-label="Delete">${icon('chevron-left')}</button>
            <button type="button" data-k="0">0</button>
            <button type="button" data-k="ok" class="ok" aria-label="Done" ${pin.length < 4 || busyNow ? 'disabled' : ''}>${icon('check')}</button>
          </div>
          ${step === 'login' ? '<p class="subtle lock-help">Forgot it? Whoever runs the server can reset it (see the README).</p>' : ''}
        </div>`;
      // Keep focus where it was, so a TV remote or keyboard can keep going.
      if (!matchMedia('(pointer: coarse)').matches) (el.querySelector(`[data-k="${lastKey}"]:not([disabled])`) || el.querySelector('[data-k="1"]')).focus({ preventScroll: true });
    };
    const finish = () => {
      el.remove();
      document.body.classList.remove('locked');
      document.removeEventListener('keydown', onKey, true);
      resolve();
    };
    const submit = async () => {
      if (pin.length < 4 || busyNow) return;
      error = '';
      if (step === 'setup') { first = pin; pin = ''; step = 'confirm'; return draw(); }
      if (step === 'confirm' && pin !== first) { error = "Those didn't match. Start again."; pin = ''; first = ''; step = 'setup'; return draw(); }
      busyNow = true;
      draw();
      const res = await fetch(step === 'login' ? '/api/auth/login' : '/api/auth/setup', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      busyNow = false;
      if (res.ok) {
        if (step === 'confirm') toast('PIN set. Each device will ask for it once a day.');
        return finish();
      }
      error = data.error || 'Something went wrong';
      pin = '';
      el.querySelector('.lock-card')?.classList.add('shake');
      draw();
    };
    const press = (k) => {
      if (busyNow) return;
      if (k === 'back') pin = pin.slice(0, -1);
      else if (k === 'ok') return submit();
      else if (/^\d$/.test(k) && pin.length < 8) pin += k;
      error = '';
      draw();
    };
    const onKey = (e) => {
      // Arrow keys / Enter on a focused key are handled by the browser (TV remotes).
      if (e.target.closest?.('[data-k]') && (e.key === ' ' || (e.key === 'Enter' && !typing))) return;
      const keys = [...el.querySelectorAll('[data-k]')];
      const at = keys.indexOf(document.activeElement);
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
      if (step && at !== -1) {
        const next = keys[Math.min(keys.length - 1, Math.max(0, at + step))];
        lastKey = next.dataset.k;
        typing = false;
        next.focus();
        e.preventDefault();
        return;
      }
      if (/^\d$/.test(e.key)) { typing = true; press(e.key); }
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') press('ok');
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { lastKey = b.dataset.k; typing = false; press(b.dataset.k); } });
    document.addEventListener('keydown', onKey, true);
    draw();
  });
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
const isEasy = (r) => Boolean(r.easy ?? r.easyFlag);
const isRecovery = (r) => Boolean(r.postpartum ?? r.recoveryFlag);
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

// A picture for recipes without a photo: the dish and its main ingredients as
// emoji on a color picked from the name (so each dish keeps its own look).
const DISH_ART = [
  [/\b(soup|stew|chili|chilli|congee|dal|curry|broth|miyeok)\b/, '🍲'], [/\bsalad\b/, '🥗'], [/\btacos?\b/, '🌮'],
  [/\b(burritos?|wraps?|fajitas?)\b/, '🌯'], [/\bpizza\b/, '🍕'], [/\b(burgers?|sliders?)\b/, '🍔'],
  [/\b(sandwich(es)?|subs?|melts?|blt|toast)\b/, '🥪'], [/\bpancakes?\b/, '🥞'], [/\bsmoothie\b/, '🥤'],
  [/\b(oats|oatmeal|parfait|porridge|granola)\b/, '🥣'], [/\b(pasta|spaghetti|mac|lasagna|penne)\b/, '🍝'],
  [/\b(ramen|noodles?|lo mein|pho)\b/, '🍜'], [/\b(fried rice|bowls?|stir[- ]fry)\b/, '🍛'], [/\b(shakshuka|frittata|scramble|omelet(te)?|egg muffins)\b/, '🍳'],
  [/\bquesadillas?\b/, '🧀'], [/\bnachos\b/, '🌽'],
];
const INGREDIENT_ART = [
  [/\b(steak|beef|sirloin|brisket|flank)\b/, '🥩'], [/\b(salmon|cod|sardines?|fish|tuna|trout|tilapia)\b/, '🐟'], [/\b(shrimp|prawns?)\b/, '🍤'],
  [/\b(chicken|turkey|drumsticks?)\b/, '🍗'], [/\b(bacon|ham|pork|sausage|hot dogs?|kielbasa)\b/, '🥓'], [/\blamb\b/, '🍖'],
  [/\beggs?\b/, '🥚'], [/\b(lentils?|beans|chickpeas?)\b/, '🫘'], [/\bavocados?\b/, '🥑'], [/\bsweet potato(es)?\b/, '🍠'],
  [/\bbroccoli\b/, '🥦'], [/\b(spinach|kale|bok choy|greens|lettuce|cabbage)\b/, '🥬'], [/\b(potato(es)?|fries)\b/, '🥔'],
  [/\b(rice|quinoa|barley)\b/, '🍚'], [/\b(tomato(es)?|marinara)\b/, '🍅'], [/\b(bell peppers?)\b/, '🫑'], [/\bcorn\b/, '🌽'],
  [/\bcarrots?\b/, '🥕'], [/\bmushrooms?\b/, '🍄'], [/\b(cheese|cheddar|feta|parmesan|mozzarella)\b/, '🧀'],
  [/\b(bread|tortillas?|buns?)\b/, '🍞'], [/\b(berries|blueberries|strawberries)\b/, '🫐'], [/\bbananas?\b/, '🍌'],
  [/\b(lemons?|limes?)\b/, '🍋'], [/\bginger\b/, '🫚'], [/\b(yogurt|milk)\b/, '🥛'], [/\basparagus\b/, '🌱'],
];
function dishArt(r) {
  const name = String(r.name || '').toLowerCase();
  const ings = (r.ingredientNames || (r.ingredients || []).map((i) => i.name)).map((n) => String(n).toLowerCase());
  const icons = [];
  const add = (e) => { if (e && !icons.includes(e)) icons.push(e); };
  add(DISH_ART.find(([re]) => re.test(name))?.[1]);
  // Main ingredients: ones named in the title first, then the rest of the list.
  for (const [re, e] of INGREDIENT_ART) if (re.test(name)) add(e);
  for (const [re, e] of INGREDIENT_ART) if (ings.some((n) => re.test(n))) add(e);
  if (!icons.length) add(PROTEIN_EMOJI[r.mainProtein] || '🍽️');
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const [big, ...small] = icons.slice(0, 3);
  return `<span class="ph-art" style="--h:${h}" aria-hidden="true"><b>${big}</b>${small.length ? `<i>${small.join('')}</i>` : ''}</span>`;
}

function imgTag(r, size) {
  const src = thumb(r, size);
  // The art sits behind the photo and shows through if it is missing or fails to load.
  const ph = dishArt(r);
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

/** Number of things still to buy, on the Groceries tab. */
function updateBadge() {
  const remaining = state.grocery ? state.grocery.items.filter((i) => !i.checked && !i.have).length + state.grocery.extras.filter((e) => !e.checked).length : 0;
  const badge = $('#grocery-badge');
  badge.hidden = !remaining;
  badge.textContent = remaining > 99 ? '99+' : remaining;
}

function render() {
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === state.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('#weekbar').hidden = !['plan', 'groceries'].includes(state.tab);
  $('#week-range').textContent = weekRange(state.weekKey);
  $('#week-sub').textContent = relativeWeek(state.weekKey);
  updateBadge();

  const views = { plan: renderPlan, groceries: renderGroceries, pantry: renderPantry, recipes: renderRecipes, settings: renderSettings };
  main.innerHTML = views[state.tab]();
  document.title = `${{ plan: 'Plan', groceries: 'Groceries', pantry: 'Pantry', recipes: 'Recipes', settings: 'Settings' }[state.tab]} · Meal Planner`;
}

function chips(r) {
  const p = r.mainProtein;
  const out = [`<span class="chip">${PROTEIN_EMOJI[p] || ''} ${esc(PROTEIN_LABEL[p] || p)}</span>`];
  out.push(`<span class="chip price ${overBudget(r) ? 'over' : ''}" title="Estimated cost per serving">${money(cost(r))}/serving</span>`);
  if (r.totalMinutes) out.push(`<span class="chip">${icon('clock')}${r.totalMinutes} min</span>`);
  if (isEasy(r)) out.push(`<span class="chip easy" title="Easy: few ingredients, little effort">${icon('bolt')}Easy</span>`);
  if (isRecovery(r) && (state.settings.postpartumMode || state.tab === 'recipes')) out.push(`<span class="chip recovery" title="Good for postpartum recovery">${icon('sprout')}Recovery</span>`);
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
  const active = plan.slots.filter((s) => !s.off);
  const filled = active.filter((s) => s.recipeId && state.byId.has(s.recipeId));
  const locked = active.filter((s) => s.locked).length;
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
        <div class="day-head">
          <h2>${DAY_NAMES[date.getDay()]}${(settings.easyDays || []).includes(date.getDay()) && slots.some((s) => !s.off) ? ` <span class="easy-pill" title="Easy meals day (Settings)">${icon('bolt')}Easy</span>` : ''}</h2>
          <span class="dh-right">${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            ${slots.some((s) => !s.locked && !s.off) ? `<button class="icon-btn sm day-dice" data-action="reroll-day" data-day="${d}" title="New recipes for ${DAY_NAMES[date.getDay()]} (locked meals stay)" aria-label="Randomize ${DAY_NAMES[date.getDay()]}'s unlocked meals">${icon('dice')}</button>` : ''}
          </span>
        </div>
        ${slots.map((s) => `${enabled.length > 1 ? `<div class="meal-label">${s.meal}</div>` : ''}${renderSlot(s)}`).join('')}
        ${thawTonight(isoDate(date)).map((t) => `<div class="thaw-note">${icon('snow')}<span><b>Tonight:</b> move ${esc(nameList(t.items.map((i) => i.name)))} to the fridge for ${esc(longDay(t.date))}</span></div>`).join('')}
        ${dayMacros(slots.filter((s) => !s.off))}
      </section>`);
  }

  return `
    <div class="toolbar">
      <div class="stats">
        <span><strong>${filled.length}</strong>/${active.length} meals</span>
        <span><strong>${locked}</strong> locked</span>
        ${weekMacros(filled)}
        <span class="${over ? 'over' : ''}" title="Feeds ${settings.householdSize}"><strong>${money(weekCost)}</strong> est. week · ${money(avg)}/serving</span>
      </div>
      <span class="spacer"></span>
      <button class="btn ghost" data-action="clear-week" title="Clear all unlocked meals">${icon('broom')}<span>Clear</span></button>
      <button class="btn primary lg" data-action="randomize">${icon('dice')}<span>Randomize${locked ? ' unlocked' : ''}</span></button>
    </div>
    ${filled.length === 0 ? `<div class="panel empty" style="margin-bottom:1rem"><h2>Nothing planned yet</h2><p>Hit <b>Randomize</b> to fill the week. Lock the meals you like and randomize again to swap out the rest.</p></div>` : ''}
    ${thawTonight(isoDate(new Date())).length ? `<div class="panel thaw-banner">${icon('snow')}<div><b>Tonight: move to the fridge to thaw</b>${thawTonight(isoDate(new Date())).map((t) => `<span>${esc(nameList(t.items.map((i) => i.name)))} for ${esc(longDay(t.date))}'s ${esc(t.recipe)}</span>`).join('')}</div></div>` : ''}
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
  if (!slots.length) return '';
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

// ---- Freezer & thaw (meat that would sit in the fridge too long) ----
const freshTasks = () => (state.settings.freezeAlerts && state.grocery?.freshness?.tasks) || [];
const shortDay = (iso) => parseKey(iso).toLocaleDateString(undefined, { weekday: 'short' });
const longDay = (iso) => parseKey(iso).toLocaleDateString(undefined, { weekday: 'long' });
const nameList = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** "❄ Freeze chicken thighs after shopping" or "Thaw ground beef Monday night" on a meal card. */
function freezeNote(s) {
  const t = freshTasks().find((x) => x.slotId === s.id);
  if (!t) return '';
  const freeze = t.items.filter((i) => i.why === 'freeze').map((i) => i.name);
  const frozen = t.items.filter((i) => i.why !== 'freeze').map((i) => i.name);
  const all = nameList([...freeze, ...frozen]);
  const title = freeze.length
    ? `${nameList(freeze)} only keeps ${t.items.find((i) => i.why === 'freeze').days} days in the fridge (USDA). Freeze it when you get home and thaw it in the fridge ${longDay(t.thawOn)} night.`
    : `Move it from the freezer to the fridge ${longDay(t.thawOn)} night to thaw.`;
  return `<div class="freeze-note" title="${esc(title)}">${icon('snow')}<span>${freeze.length ? `Freeze ${esc(nameList(freeze))}` : 'From the freezer'} · thaw ${esc(shortDay(t.thawOn))} night</span></div>`;
}

/** Tonight's thaw jobs for a given date. */
const thawTonight = (iso) => freshTasks().filter((t) => t.thawOn === iso);

function renderSlot(s) {
  if (s.off) {
    const oneOff = s.skip === true;
    return `
      <div class="meal off-slot" data-day="${s.day}" data-meal="${s.meal}">
        ${icon('moon')}
        <b>Fend for yourself</b>
        <span>${oneOff ? 'Skipped this week' : `No ${s.meal} on ${DAY_NAMES[(parseKey(state.weekKey).getDay() + s.day) % 7]}s`}</span>
        <button class="btn sm ghost" data-action="skip-slot" data-slot="${s.id}" data-skip="${oneOff ? 'null' : 'false'}" title="Plan ${s.meal} for this day anyway">${icon('plus')}Plan anyway</button>
      </div>`;
  }
  const r = s.recipeId && state.byId.get(s.recipeId);
  if (!r) {
    return `
      <div class="meal empty-slot" data-day="${s.day}" data-meal="${s.meal}">
        <span>No ${s.meal} planned</span>
        <div class="row">
          <button class="btn" data-action="reroll" data-slot="${s.id}">${icon('dice')}Random</button>
          <button class="btn" data-action="choose" data-slot="${s.id}">${icon('search')}Choose</button>
          <button class="btn ghost" data-action="skip-slot" data-slot="${s.id}" data-skip="true" title="Fend for yourself this time">${icon('moon')}Skip</button>
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
          ${freezeNote(s)}
        </div>
      </button>
      <button class="icon-btn sm grip" data-drag-handle title="Drag to another day (or use the arrow keys)" aria-label="Move ${esc(r.name)} to another day. Use the arrow keys.">${icon('grip')}</button>
      <div class="meal-actions">
        <button class="icon-btn sm lock" data-action="lock" data-slot="${s.id}" aria-pressed="${s.locked}" title="${s.locked ? 'Unlock (randomizer can change it)' : 'Lock in (randomizer will keep it)'}" aria-label="${s.locked ? 'Unlock' : 'Lock'} ${esc(r.name)}">${icon(s.locked ? 'lock' : 'unlock')}</button>
        <button class="icon-btn sm" data-action="reroll" data-slot="${s.id}" ${s.locked ? 'disabled' : ''} title="New recipe for just this meal" aria-label="New recipe for just this meal">${icon('dice')}</button>
        <button class="icon-btn sm" data-action="choose" data-slot="${s.id}" title="Choose a recipe" aria-label="Choose a recipe">${icon('swap')}</button>
        <button class="icon-btn sm" data-action="carry-slot" data-slot="${s.id}" title="Didn't get to it? Add to next week" aria-label="Add ${esc(r.name)} to next week">${icon('next-week')}</button>
        <button class="icon-btn sm fav push" data-action="fav" data-id="${esc(r.id)}" aria-pressed="${r.favorite}" title="${r.favorite ? 'Remove favorite' : 'Favorite'}" aria-label="Favorite">${icon(r.favorite ? 'heart-fill' : 'heart')}</button>
      </div>
    </article>`;
}

function renderGroceries() {
  // Store prices and the shopping plan are optional extras (Settings → Stores & prices).
  if (!state.settings.showPriceTabs) return renderGroceryList();
  const views = [['list', 'List', 'cart'], ['compare', 'Prices', 'tag'], ['plan', 'Shop plan', 'route']];
  const body = { list: renderGroceryList, compare: renderPriceCompare, plan: renderShoppingPlan }[state.groceryView] || renderGroceryList;
  const current = body === renderGroceryList ? 'list' : state.groceryView;
  return `
    <div class="segmented" role="tablist" aria-label="Grocery view">
      ${views.map(([k, label, ic]) => `<button role="tab" aria-selected="${current === k}" data-action="grocery-view" data-view="${k}">${icon(ic)}<span>${label}</span></button>`).join('')}
    </div>
    ${body()}`;
}

// ---- Prices ----
const storeName = (k) => state.meta.stores[k]?.name || k;
function bestPrice(i) {
  const at = i.price?.at;
  if (!at) return null;
  const keys = Object.keys(at);
  if (!keys.length) return null;
  const k = i.price.best || keys.reduce((a, b) => (at[a].cost <= at[b].cost ? a : b));
  return { store: k, ...at[k] };
}
const qtyText = (buy) => (buy.unitLabel === 'each' ? `${buy.units}` : buy.unitLabel === 'per lb' ? `${buy.units} lb` : buy.qtyText);
function priceCell(i, k) {
  const p = i.price.at[k];
  const s = state.meta.stores[k];
  return `<button class="pc ${p.real ? 'real' : 'est'} ${i.price.best === k ? 'best' : ''}" data-action="edit-price" data-key="${esc(i.key)}" data-store="${k}" title="${p.real ? 'Your price' : 'Estimate'} · tap to enter what it costs at ${esc(s.name)}">
    <b>${money(p.cost)}</b><small>${p.real ? `${icon('check')}yours` : 'est.'}</small>
    ${s.aisles ? `<span class="aisle-tag ${p.aisle ? '' : 'empty'}">${p.aisle ? `Aisle ${esc(p.aisle)}` : '+ aisle'}</span>` : p.aisle ? `<span class="aisle-tag">${esc(p.aisle)}</span>` : ''}
  </button>`;
}

function priceSummary() {
  const pr = state.grocery.pricing;
  if (!pr.stores.length) return `<div class="panel empty"><h2>Pick your stores</h2><p>Choose the two stores you shop at to compare prices.</p><a class="btn primary" href="#settings">${icon('sliders')}Choose stores</a></div>`;
  return '';
}

function renderPriceCompare() {
  const g = state.grocery;
  const pr = g.pricing;
  const none = priceSummary();
  if (none) return none;
  const items = g.items.filter((i) => i.price && !i.have);
  const [a, b] = pr.stores.map((s) => s.key);
  const pantry = items.filter((i) => i.price.pantry);
  const main = items.filter((i) => !i.price.pantry);
  const groups = new Map();
  for (const i of main) {
    if (!groups.has(i.aisle)) groups.set(i.aisle, []);
    groups.get(i.aisle).push(i);
  }
  const row = (i) => `
    <div class="pr-row ${i.checked ? 'done' : ''}">
      <label class="pr-item pr-check"><input type="checkbox" data-action="check" data-key="${esc(i.key)}" ${i.checked ? 'checked' : ''}><span class="g-box">${icon('check')}</span><span><b>${esc(i.name)}</b><small>${esc(qtyText(i.price.buy))}${i.amount ? ` · needs ${esc(i.amount)}` : ''}</small></span></label>
      ${pr.stores.map((s) => priceCell(i, s.key)).join('')}
      ${b ? `<div class="pr-best">${i.price.best ? `<span class="store-chip s-${i.price.best === a ? 'a' : 'b'}">${esc(storeName(i.price.best))}</span><small>saves ${money(Math.abs(i.price.at[a].cost - i.price.at[b].cost))}</small>` : '<small>same</small>'}</div>` : ''}
    </div>`;
  const section = (title, list, note = '') => list.length ? `
    <section class="panel pr-section">
      <h3><span>${esc(title)}</span>${note ? `<small>${note}</small>` : ''}</h3>
      ${list.map(row).join('')}
    </section>` : '';
  return `<div class="pr-wrap ${b ? '' : 'one'}">
    <div class="pr-head panel">
      <div class="pr-row pr-cols">
        <div class="pr-item"><b>${items.length} items</b><small>${pr.realCount ? `${pr.realCount} prices are yours` : 'All prices are estimates so far'}</small></div>
        ${pr.stores.map((s, n) => `<div class="pc-head s-${n ? 'b' : 'a'}"><b>${esc(s.name)}</b><span>${money(pr.totals[s.key])}</span></div>`).join('')}
        ${b ? `<div class="pc-head best"><b>Cheapest</b><span>${money(pr.plan.split)}</span></div>` : ''}
      </div>
    </div>
    <p class="subtle pr-note">${icon('tag')} Tap any price to enter what it really costs (and its aisle). Your prices are saved and replace estimates from then on. Estimates use typical US prices for the package size you need, adjusted by each store's usual price level.${state.settings.countPantry ? '' : ' Spices and staples (oil, flour, sauces) are left out of the totals, and so is anything in your pantry.'}</p>
    ${[...groups].map(([aisle, list]) => section(aisle, list)).join('')}
    ${section('Spices & staples', pantry, state.settings.countPantry ? '' : 'not in totals')}
  </div>`;
}

function renderShoppingPlan() {
  const g = state.grocery;
  const pr = g.pricing;
  const none = priceSummary();
  if (none) return none;
  if (pr.stores.length < 2) return `<div class="panel empty"><h2>Add a second store</h2><p>Pick two stores in Settings to see whether splitting your shop saves money.</p><a class="btn primary" href="#settings">${icon('sliders')}Choose stores</a></div>`;
  const plan = pr.plan;
  const byKey = new Map(g.items.map((i) => [i.key, i]));
  const [a, b] = pr.stores.map((s) => s.key);
  const option = (label, total, active, extra = '') => `
    <div class="plan-opt ${active ? 'active' : ''}">
      <span>${label}</span><b>${money(total)}</b>${extra}
      ${active ? `<span class="plan-badge">${icon('check')}Best plan</span>` : ''}
    </div>`;
  const aisleNum = (p) => { const m = /\d+/.exec(p.aisle || ''); return m ? Number(m[0]) : 999; };
  const trip = (t, n) => {
    const s = state.meta.stores[t.store];
    const items = t.items.map((k) => byKey.get(k)).filter(Boolean)
      .map((i) => ({ i, p: i.price.at[t.store] }))
      .sort((x, y) => aisleNum(x.p) - aisleNum(y.p) || x.i.aisle.localeCompare(y.i.aisle) || x.i.name.localeCompare(y.i.name));
    return `
      <section class="panel trip">
        <h3><span class="store-chip s-${t.store === a ? 'a' : 'b'}">${n + 1}. ${esc(s.name)}</span><b>${money(t.total)}</b></h3>
        ${s.aisles ? `<p class="subtle">Sorted by aisle where you've saved one; tap a price to add the aisle.</p>` : ''}
        ${items.map(({ i, p }) => `
          <div class="trip-row ${i.checked ? 'done' : ''}">
            <label class="g-item"><input type="checkbox" data-action="check" data-key="${esc(i.key)}" ${i.checked ? 'checked' : ''}><span class="g-box">${icon('check')}</span>
              <span class="g-text"><span class="g-name">${esc(i.name)}</span><span class="g-for">${esc(qtyText(i.price.buy))} · ${p.aisle ? `Aisle ${esc(p.aisle)}` : esc(i.aisle)}</span></span></label>
            <button class="pc ${p.real ? 'real' : 'est'}" data-action="edit-price" data-key="${esc(i.key)}" data-store="${t.store}"><b>${money(p.cost)}</b><small>${p.real ? 'yours' : 'est.'}</small></button>
          </div>`).join('')}
      </section>`;
  };
  const verdict = plan.splitWorthIt
    ? `Split your shop: get ${plan.trips[0].items.length} items at ${esc(storeName(plan.trips[0].store))} and ${plan.trips[1].items.length} at ${esc(storeName(plan.trips[1].store))} to save <b>${money(plan.savings)}</b>.`
    : plan.savings > 0
      ? `Shop everything at <b>${esc(storeName(plan.cheapest))}</b>. Splitting would only save ${money(plan.savings)}, under your ${money(plan.threshold)} limit for a second trip.`
      : `Shop everything at <b>${esc(storeName(plan.cheapest))}</b>. It's the cheapest for every item${pr.realCount ? '' : ' at the estimated prices'}.`;
  return `
    <div class="plan-opts">
      ${option(`All at ${esc(storeName(a))}`, pr.totals[a], !plan.splitWorthIt && plan.cheapest === a)}
      ${option(`All at ${esc(storeName(b))}`, pr.totals[b], !plan.splitWorthIt && plan.cheapest === b)}
      ${option('Split between both', plan.split, plan.splitWorthIt, `<small>saves ${money(plan.savings)}</small>`)}
    </div>
    <p class="plan-verdict panel">${verdict}</p>
    ${pr.realCount ? '' : `<p class="subtle pr-note">${icon('tag')} These are estimates, so one store tends to win everything. Enter real prices as you shop (tap any price) and the plan will start finding the real bargains at each store.</p>`}
    ${plan.trips.map(trip).join('')}`;
}

function openPriceEditor(key, storeKey) {
  const i = state.grocery.items.find((x) => x.key === key);
  const p = i.price.at[storeKey];
  const s = state.meta.stores[storeKey];
  const unit = i.price.buy.unitLabel;
  openModal(`
    <form class="modal-content" data-form="save-price" data-key="${esc(key)}" data-store="${storeKey}">
      <h2 id="modal-title">${esc(i.name)} at ${esc(s.name)}</h2>
      <p class="subtle" style="margin:0">You need ${esc(qtyText(i.price.buy))}${i.amount ? ` (recipes call for ${esc(i.amount)})` : ''}. ${p.real ? 'This is the price you saved.' : `Estimated at ${money(p.unitPrice)} ${unit === 'per lb' ? 'per lb' : `for ${esc(unit)}`}.`}</p>
      <div class="field-row">
        <div class="field"><label for="pe-price">Price ${unit === 'per lb' ? 'per lb' : unit === 'each' ? 'each' : `for ${esc(unit)}`}</label>
          <div class="money"><span>${esc(state.settings.currency)}</span><input id="pe-price" class="input" name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${p.real ? p.unitPrice : ''}" placeholder="${p.unitPrice.toFixed(2)}"></div></div>
        <div class="field"><label for="pe-aisle">Aisle</label><input id="pe-aisle" class="input" name="aisle" maxlength="30" value="${esc(p.aisle)}" placeholder="${s.aisles ? 'e.g. 12' : 'optional'}"></div>
      </div>
      <p class="subtle" style="margin:0">Saved for ${esc(s.name)} and used every week from now on.</p>
      <div class="modal-actions">
        <button class="btn primary">${icon('check')}Save</button>
        ${p.real || p.aisle ? `<button type="button" class="btn ghost" data-action="clear-price" data-key="${esc(key)}" data-store="${storeKey}">Use estimate</button>` : ''}
      </div>
    </form>`);
  setTimeout(() => $('#pe-price', modalBody)?.focus(), 50);
}

const placeFor = (aisle) => (/Spices/.test(aisle) ? 'spices' : /Meat|Frozen/.test(aisle) ? 'freezer' : /Dairy|Produce/.test(aisle) ? 'fridge' : 'pantry');
const PLACE_LABEL = { pantry: 'Pantry', spices: 'Spices', fridge: 'Fridge', freezer: 'Freezer' };

/** When you shopped, and what to freeze when you unpack. */
function shoppingPanel() {
  const f = state.grocery.freshness;
  if (!state.settings.freezeAlerts || !f) return '';
  const freeze = f.tasks.flatMap((t) => t.items.filter((i) => i.why === 'freeze').map((i) => ({ ...i, date: t.date, recipe: t.recipe })));
  if (!freeze.length && f.assumed) return '';
  return `
    <section class="panel shop-panel">
      <div class="shop-date">
        ${icon('calendar')}
        <label for="shopped-on">${f.assumed ? 'Shopping on' : 'Shopped on'}</label>
        <input id="shopped-on" class="input" type="date" data-action="shopped-on" value="${esc(f.shoppedOn)}">
        <small class="subtle">${f.assumed ? 'Guessed. It sets itself when you tick off most of the list.' : 'From when you ticked off the list. Change it if that’s off.'}</small>
      </div>
      ${freeze.length ? `
        <div class="freeze-list">
          <b>${icon('snow')}${f.assumed ? 'Freeze when you get home' : 'Freeze these'}</b>
          <ul>${freeze.map((i) => `<li><span>${esc(i.name)}</span><small>${esc(longDay(i.date))}: ${esc(i.recipe)} · keeps ${i.days} days in the fridge</small></li>`).join('')}</ul>
          <small class="subtle">You'll see a reminder on the plan (and on your phone, if notifications are on) the night before to move each one to the fridge to thaw.</small>
        </div>` : ''}
    </section>`;
}

function renderGroceryList() {
  const g = state.grocery;
  const need = g.items.filter((i) => !i.have);
  const have = g.items.filter((i) => i.have);
  const toBuy = need.filter((i) => !i.checked);
  const inCart = need.filter((i) => i.checked);
  const extrasToBuy = g.extras.filter((e) => !e.checked);
  const extrasInCart = g.extras.filter((e) => e.checked);
  const total = need.length + g.extras.length;
  const done = inCart.length + extrasInCart.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const groups = new Map();
  for (const item of toBuy) {
    if (!groups.has(item.aisle)) groups.set(item.aisle, []);
    groups.get(item.aisle).push(item);
  }

  const itemRow = (i) => `
    <label class="g-item ${i.checked ? 'done' : ''}">
      <input type="checkbox" data-action="check" data-key="${esc(i.key)}" ${i.checked ? 'checked' : ''} aria-label="${esc(i.name)} in the cart">
      <span class="g-box">${icon('check')}</span>
      <span class="g-text">
        <span class="g-name">${esc(i.name)}</span>
        ${i.amount ? `<span class="g-amount">${esc(i.amount)}</span>` : ''}
        <span class="g-for" title="${esc(i.recipes.join(', '))}">${i.freezeFor && state.settings.freezeAlerts ? `<b class="freeze-tag">${icon('snow')}Freeze for ${esc(i.freezeFor.map(shortDay).join(', '))}</b> · ` : ''}${i.low ? `<b class="low-tag">${icon('alert')}Running low</b>${i.recipes.length ? ' · ' : ''}` : ''}${esc(i.recipes.join(' · '))}</span>
      </span>
      ${bestPrice(i) && !i.price.pantry ? `<span class="g-price"><b>${money(bestPrice(i).cost)}</b><small>${esc(storeName(bestPrice(i).store))}</small></span>` : ''}
      ${i.checked || i.low ? '' : `<button class="icon-btn sm have-btn" data-action="have-it" data-name="${esc(i.name)}" data-where="${placeFor(i.aisle)}" title="I already have this (adds it to your pantry)" aria-label="I already have ${esc(i.name)}">${icon('jar')}</button>`}
    </label>`;

  const extraRow = (e) => `
    <label class="g-item ${e.checked ? 'done' : ''}">
      <input type="checkbox" data-action="check-extra" data-id="${esc(e.id)}" ${e.checked ? 'checked' : ''} aria-label="${esc(e.name)} in the cart">
      <span class="g-box">${icon('check')}</span>
      <span class="g-text"><span class="g-name">${esc(e.name)}</span></span>
      <button class="icon-btn sm" data-action="remove-extra" data-id="${esc(e.id)}" aria-label="Remove ${esc(e.name)}">${icon('x')}</button>
    </label>`;

  const haveRow = (i) => `
    <div class="g-item have">
      <span class="g-box on">${icon('check')}</span>
      <span class="g-text">
        <span class="g-name">${esc(i.name)}</span>
        <span class="g-for">${PLACE_LABEL[i.have.where] || 'Pantry'}: ${esc(i.have.name)}${i.amount ? ` · recipes need ${esc(i.amount)}` : ''}</span>
      </span>
      <button class="btn sm ghost" data-action="need-anyway" data-key="${esc(i.key)}" title="You're out: put it back on the list this week">Need to buy</button>
    </div>`;

  const cartOpen = !state.hideChecked;
  return `
    <div class="toolbar">
      <div class="stats"><span><strong>${done}</strong> of ${total} in the cart</span>${have.length ? `<span><strong>${have.length}</strong> already have</span>` : ''}</div>
      <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <span class="spacer"></span>
      <button class="btn ghost" data-action="uncheck-all">${icon('broom')}Empty cart</button>
      <button class="btn" data-action="copy-list">${icon('copy')}Copy list</button>
    </div>
    <form class="add-item" data-form="add-extra" style="margin-bottom:1rem">
      <input class="input" name="name" placeholder="Add an item (paper towels, snacks…)" autocomplete="off" maxlength="120" aria-label="Add grocery item">
      <button class="btn primary">${icon('plus')}Add</button>
    </form>
    ${shoppingPanel()}
    ${total + have.length === 0 ? `<div class="panel empty"><h2>Your list is empty</h2><p>Plan some meals for this week and their ingredients show up here automatically.</p><a class="btn primary" href="#plan">${icon('calendar')}Go to plan</a></div>` : ''}
    ${total && !toBuy.length && !extrasToBuy.length ? `<div class="panel empty" style="margin-bottom:1rem"><h2>Everything's in the cart 🎉</h2><p>Nothing left to grab.</p></div>` : ''}
    <div class="aisles">
      ${extrasToBuy.length ? `<section class="panel aisle"><h3><span>My items</span><span>${extrasToBuy.length}</span></h3>${extrasToBuy.map(extraRow).join('')}</section>` : ''}
      ${[...groups].map(([aisle, items]) => `<section class="panel aisle"><h3><span>${esc(aisle)}</span><span>${items.length}</span></h3>${items.map(itemRow).join('')}</section>`).join('')}
    </div>
    ${done ? `
      <section class="panel aisle cart-section">
        <h3><button class="linkish" data-action="toggle-hide" aria-expanded="${cartOpen}">${icon('cart')}<span>In the cart</span></button><span>${done}</span></h3>
        ${cartOpen ? [...extrasInCart.map(extraRow), ...inCart.map(itemRow)].join('') : ''}
      </section>` : ''}
    ${have.length ? `
      <section class="panel aisle have-section">
        <h3><span>${icon('jar')}Already have</span><span>${have.length}</span></h3>
        <p class="subtle">These match your pantry, so they're left off the list and out of the price totals.</p>
        ${have.map(haveRow).join('')}
        <a class="btn sm ghost" href="#pantry">${icon('jar')}Manage pantry</a>
      </section>` : ''}`;
}

function renderPantry() {
  const pantry = state.pantry;
  if (!pantry) {
    busy(null, async () => { state.pantry = await api('GET', '/api/pantry'); render(); });
    return '<div class="skeleton"></div>';
  }
  const used = new Map();
  for (const i of state.grocery.items) if (i.have) used.set(i.have.id, [...(used.get(i.have.id) || []), i.name]);
  const byPlace = new Map(pantry.places.map((p) => [p, []]));
  for (const it of pantry.items) byPlace.get(it.where)?.push(it);
  const names = new Set(pantry.items.map((p) => p.name.toLowerCase()));
  const staples = pantry.staples.filter(([n]) => !names.has(n));
  return `
    <section class="panel pantry-add">
      <h2>What do you already have?</h2>
      <p class="subtle">Anything listed here is checked off the grocery list automatically whenever a meal needs it: spices, rice, meat in the freezer, anything. "Rice" covers basmati or jasmine; "chicken" covers breasts or thighs. Remove things when you run out.</p>
      <form class="inline-form" data-form="add-pantry">
        <div class="typeahead">
          <input id="pantry-in" class="input" name="name" placeholder="Start typing: cumin, olive oil, rice…" autocomplete="off" maxlength="200"
            aria-label="Item you have" role="combobox" aria-autocomplete="list" aria-controls="pantry-suggest" aria-expanded="false" required>
          <ul id="pantry-suggest" class="suggest-list" role="listbox" hidden></ul>
        </div>
        <select class="input" name="where" aria-label="Where it is">
          <option value="auto">Auto place</option>
          ${pantry.places.map((p) => `<option value="${p}">${PLACE_LABEL[p]}</option>`).join('')}
        </select>
        <button class="btn primary">${icon('plus')}Add</button>
      </form>
      <div class="scan-btns">
        <button class="btn" data-action="browse-pantry">${icon('book')}Browse the list</button>
        <button class="btn" data-action="scan-open" data-mode="photo">${icon('camera')}Scan a shelf</button>
        <button class="btn ghost" data-action="scan-open" data-mode="barcode">${icon('barcode')}Scan barcodes</button>
      </div>
      ${staples.length ? `<div class="chips suggest"><span class="subtle">Common staples:</span>${staples.map(([n, w]) => `<button class="chip-toggle" data-action="add-staple" data-name="${esc(n)}" data-where="${w}">${icon('plus')}${esc(n)}</button>`).join('')}</div>` : ''}
    </section>
    <div class="pantry-grid">
      ${[...byPlace].map(([place, items]) => `
        <section class="panel aisle">
          <h3><span>${PLACE_LABEL[place]}</span><span>${items.length}</span></h3>
          ${items.length ? items.sort((a, b) => a.name.localeCompare(b.name)).map((it) => `
            <div class="g-item pantry-item ${it.low ? 'is-low' : ''}">
              <span class="g-text"><span class="g-name">${esc(it.name)}</span>${it.low ? `<span class="g-for low-note">${icon('alert')}Running low · on your grocery list</span>` : used.has(it.id) ? `<span class="g-for used">Covers this week: ${esc(used.get(it.id).join(', '))}</span>` : ''}</span>
              ${lowButton(it.name, it)}
              <button class="icon-btn sm" data-action="remove-pantry" data-id="${esc(it.id)}" aria-label="Remove ${esc(it.name)} (used up)" title="Used up">${icon('x')}</button>
            </div>`).join('') : '<p class="subtle" style="margin:.2rem .7rem .6rem">Nothing here yet.</p>'}
        </section>`).join('')}
    </div>`;
}

// ---------- pantry type-ahead and "browse the list" ----------

const typeahead = { items: [], active: -1 };
const pantryHave = () => new Set((state.pantry?.items || []).map((p) => p.name.toLowerCase()));

/** The comma-separated part being typed right now. */
function currentToken(input) {
  const before = input.value.slice(0, input.selectionStart ?? input.value.length);
  return before.slice(before.lastIndexOf(',') + 1).trim();
}

function updateTypeahead(input) {
  const list = $('#pantry-suggest');
  if (!list) return;
  const token = currentToken(input);
  typeahead.items = token.length ? suggestPantry(token, { have: pantryHave(), limit: 7 }) : [];
  // Highlight the first suggestion unless what's typed already is that item.
  typeahead.active = typeahead.items.length && typeahead.items[0].name !== token.toLowerCase() ? 0 : -1;
  drawTypeahead(input);
}

function drawTypeahead(input) {
  const list = $('#pantry-suggest');
  const open = typeahead.items.length > 0;
  list.hidden = !open;
  input.setAttribute('aria-expanded', String(open));
  list.innerHTML = typeahead.items.map((it, i) => `
    <li id="sugg-${i}" role="option" aria-selected="${i === typeahead.active}" data-sugg="${i}">
      <span>${esc(it.name)}</span><small>${PLACE_LABEL[it.where]}</small>
    </li>`).join('');
  if (typeahead.active >= 0) input.setAttribute('aria-activedescendant', `sugg-${typeahead.active}`);
  else input.removeAttribute('aria-activedescendant');
}

/** Put the chosen suggestion in place of the word being typed, ready for the next one. */
function acceptSuggestion(input, i) {
  const it = typeahead.items[i];
  if (!it) return;
  const pos = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, pos);
  const start = before.lastIndexOf(',') + 1;
  const after = input.value.slice(pos).replace(/^[^,]*,?\s*/, '');
  const head = input.value.slice(0, start).replace(/\s*$/, start ? ' ' : '');
  input.value = `${head}${it.name}, ${after}`;
  const caret = head.length + it.name.length + 2;
  input.setSelectionRange(caret, caret);
  typeahead.items = [];
  drawTypeahead(input);
  input.focus();
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'pantry-in') updateTypeahead(e.target);
  else if (e.target.id === 'ntfy-topic') { const b = $('[data-action="ntfy-test"]'); if (b) b.disabled = !e.target.value.trim(); }
  else if (e.target.matches('[data-browse-q]')) { browse.q = e.target.value; refreshBrowse(); }
});
document.addEventListener('keydown', (e) => {
  const input = e.target;
  if (input.id !== 'pantry-in' || !typeahead.items.length) return;
  const n = typeahead.items.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const a = typeahead.active;
    typeahead.active = e.key === 'ArrowDown' ? (a + 1) % n : a <= 0 ? n - 1 : a - 1;
    drawTypeahead(input);
  } else if ((e.key === 'Enter' || e.key === 'Tab') && typeahead.active >= 0) {
    e.preventDefault();
    acceptSuggestion(input, typeahead.active);
  } else if (e.key === 'Escape') {
    typeahead.items = [];
    drawTypeahead(input);
  }
});
// pointerdown (not click) so the input keeps focus and the phone keyboard stays up.
document.addEventListener('pointerdown', (e) => {
  const li = e.target.closest('[data-sugg]');
  if (li) {
    e.preventDefault();
    acceptSuggestion($('#pantry-in'), Number(li.dataset.sugg));
  } else if (!e.target.closest('.typeahead') && $('#pantry-suggest') && !$('#pantry-suggest').hidden) {
    typeahead.items = [];
    drawTypeahead($('#pantry-in'));
  }
});

const browse = { picked: new Set(), q: '' };

function openBrowse() {
  browse.picked = new Set();
  browse.q = '';
  openModal(`
    <div class="modal-content browse">
      <div class="modal-head">
        <h2 id="modal-title">What do you have?</h2>
        <p class="subtle">Tap everything in your cupboards, spice rack, fridge and freezer, then add them all at once.</p>
        <input class="input" type="search" data-browse-q placeholder="Filter, e.g. paprika" aria-label="Filter the list" autocomplete="off">
      </div>
      <div class="browse-groups">${renderBrowseGroups()}</div>
      <div class="browse-foot"><button class="btn primary" data-action="browse-add" disabled>${icon('plus')}Add 0 items</button></div>
    </div>`);
}

function renderBrowseGroups() {
  const have = pantryHave();
  const q = browse.q.trim().toLowerCase();
  const html = CATALOG_GROUPS.map((g) => {
    const items = PANTRY_CATALOG.filter((i) => i.group === g && (!q || [i.name, ...i.also].some((n) => n.includes(q))));
    if (!items.length) return '';
    return `
      <section class="browse-group">
        <h3>${esc(g)}</h3>
        <div class="chips">${items.map((i) => {
          const owned = have.has(i.name);
          const on = owned || browse.picked.has(i.name);
          return `<button class="chip-toggle" data-action="browse-pick" data-name="${esc(i.name)}" aria-pressed="${on}" ${owned ? 'disabled title="Already in your pantry"' : ''}>${on ? icon('check') : ''}${esc(i.name)}</button>`;
        }).join('')}</div>
      </section>`;
  }).join('');
  return html || '<p class="subtle">Nothing matches. Close this and type it in instead.</p>';
}

function refreshBrowse() {
  const box = $('.browse-groups', modalBody);
  if (box) box.innerHTML = renderBrowseGroups();
  refreshBrowseButton();
}

function refreshBrowseButton() {
  const btn = $('[data-action="browse-add"]', modalBody);
  if (btn) {
    const n = browse.picked.size;
    btn.disabled = !n;
    btn.innerHTML = `${icon('plus')}Add ${n} item${n === 1 ? '' : 's'}`;
  }
}

// ---------- camera scanning (pantry) ----------

// A photo of a shelf is read on the server by Claude; barcodes are read in the
// browser and looked up on Open Food Facts. Either way you review the list first.
const scan = { mode: 'photo', caps: null, results: [], codes: new Set(), stream: null, timer: null, status: '' };

async function openScan(mode) {
  scan.mode = mode;
  scan.results = [];
  scan.codes = new Set();
  scan.status = '';
  scan.caps ||= await api('GET', '/api/pantry/scan');
  drawScan();
  if (mode === 'barcode' && 'BarcodeDetector' in window) startBarcodeCamera();
}

function drawScan() {
  const photo = scan.mode === 'photo';
  const live = 'BarcodeDetector' in window;
  openModal(`
    <div class="modal-content scan">
      <div class="modal-head">
        <h2 id="modal-title">${photo ? 'Scan a shelf' : 'Scan barcodes'}</h2>
        <div class="segmented" role="tablist">
          <button data-action="scan-mode" data-mode="photo" role="tab" aria-selected="${photo}">${icon('camera')}Photo</button>
          <button data-action="scan-mode" data-mode="barcode" role="tab" aria-selected="${!photo}">${icon('barcode')}Barcode</button>
        </div>
      </div>
      ${photo ? (scan.caps.photo ? `
        <p class="subtle">Take a photo of your spice rack, a pantry shelf or your oils with the labels facing the camera. A few photos of different shelves works too. You'll check the list before anything is added.</p>
        <label class="btn primary scan-shoot">${icon('camera')}Take or choose photos
          <input type="file" accept="image/*" capture="environment" multiple data-scan-photo hidden>
        </label>` : `
        <p class="subtle">Photo scanning reads labels with Claude, which needs an Anthropic API key on your server. Add <code>ANTHROPIC_API_KEY</code> to the server's environment and restart it (the README has the steps). Barcode scanning works without a key.</p>`) : `
        <p class="subtle">Point the camera at a barcode. Each one is looked up on Open Food Facts and added to the list below.${live ? '' : ' This browser can\'t read barcodes from the camera (Safari can\'t yet), so type the number under the barcode instead.'}</p>
        ${live ? '<div class="scan-video"><video playsinline muted autoplay></video><span class="scan-aim"></span></div>' : ''}
        <form class="inline-form" data-form="scan-code">
          <input class="input" name="code" inputmode="numeric" pattern="[0-9]{6,14}" placeholder="Barcode number, e.g. 052100002064" aria-label="Barcode number" required>
          <button class="btn">${icon('search')}Look up</button>
        </form>`}
      <p class="scan-status subtle" aria-live="polite">${esc(scan.status)}</p>
      <form data-form="save-scan" class="scan-results">${renderScanResults()}</form>
    </div>`);
}

function renderScanResults() {
  if (!scan.results.length) return '';
  const n = scan.results.filter((r) => r.checked).length;
  return `
    <h3>Found ${scan.results.length} item${scan.results.length === 1 ? '' : 's'}</h3>
    <p class="subtle">Untick anything that's wrong and fix any names. Items you already have are unticked.</p>
    ${scan.results.map((r, i) => `
      <div class="scan-row">
        <input type="checkbox" class="g-box" data-scan-i="${i}" data-field="checked" ${r.checked ? 'checked' : ''} aria-label="Add ${esc(r.name)}">
        <input class="input" data-scan-i="${i}" data-field="name" value="${esc(r.name)}" maxlength="60" aria-label="Name">
        <select class="input" data-scan-i="${i}" data-field="where" aria-label="Where it goes">
          ${Object.entries(PLACE_LABEL).map(([k, v]) => `<option value="${k}" ${k === r.where ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        ${r.have ? '<span class="chip">Already have</span>' : ''}
      </div>`).join('')}
    <button class="btn primary" ${n ? '' : 'disabled'}>${icon('plus')}Add ${n} to pantry</button>`;
}

function refreshScan() {
  const box = $('.scan-results', modalBody);
  if (box) box.innerHTML = renderScanResults();
  const st = $('.scan-status', modalBody);
  if (st) st.textContent = scan.status;
}

function addScanResults(items) {
  const known = new Set(scan.results.map((r) => r.name));
  for (const it of items) {
    if (known.has(it.name)) continue;
    known.add(it.name);
    scan.results.push({ ...it, checked: !it.have });
  }
  refreshScan();
}

/** Shrink a photo to what the model reads anyway (1568 px long side), as base64 JPEG. */
async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

async function scanPhotoFiles(files) {
  const list = [...files].slice(0, 4);
  if (!list.length) return;
  scan.status = `Reading ${list.length === 1 ? 'the photo' : `${list.length} photos`}… this takes a few seconds.`;
  refreshScan();
  $('.scan-shoot', modalBody)?.classList.add('busy');
  try {
    const images = await Promise.all(list.map(shrinkPhoto));
    const { items } = await api('POST', '/api/pantry/scan', { images });
    scan.status = items.length ? '' : "Couldn't spot any food labels. Try closer, with the labels facing the camera.";
    addScanResults(items);
  } catch (e) {
    scan.status = e.message;
    refreshScan();
  } finally {
    $('.scan-shoot', modalBody)?.classList.remove('busy');
  }
}

async function lookupCode(code) {
  if (scan.codes.has(code)) return;
  scan.codes.add(code);
  navigator.vibrate?.(60);
  scan.status = `Looking up ${code}…`;
  refreshScan();
  try {
    const found = await api('GET', `/api/pantry/barcode/${encodeURIComponent(code)}`);
    scan.status = `Found ${found.name}${found.brand ? ` (${found.brand})` : ''}.`;
    addScanResults([found]);
  } catch (e) {
    scan.status = e.message;
    refreshScan();
  }
}

async function startBarcodeCamera() {
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch {
    scan.status = 'The camera is blocked. Allow camera access for this site, or type the barcode number.';
    refreshScan();
    return;
  }
  const video = $('.scan-video video', modalBody);
  if (!video || !modal.open) return stopCamera();
  video.srcObject = scan.stream;
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  scan.timer = setInterval(async () => {
    if (video.readyState < 2) return;
    try {
      for (const b of await detector.detect(video)) lookupCode(b.rawValue);
    } catch { /* frame not ready */ }
  }, 350);
}

function stopCamera() {
  clearInterval(scan.timer);
  scan.timer = null;
  scan.stream?.getTracks().forEach((t) => t.stop());
  scan.stream = null;
}

modal.addEventListener('close', stopCamera);

function filteredRecipes() {
  const f = state.recipeFilters;
  const q = f.q.trim().toLowerCase();
  let list = state.recipes.filter((r) => {
    if (f.favorites && !r.favorite) return false;
    if (f.protein && !(r.mainProtein === f.protein || r.proteins.includes(f.protein))) return false;
    if (f.meal === 'other' ? r.mealTypes.length : f.meal && !r.mealTypes.includes(f.meal)) return false;
    if (f.budget && !fitsSettings(r)) return false;
    if (f.healthy && !isHealthy(r)) return false;
    if (f.easy && !isEasy(r)) return false;
    if (f.recovery && !isRecovery(r)) return false;
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
      <button class="chip-toggle" data-action="filter-easy" aria-pressed="${Boolean(f.easy)}">${icon('bolt')}Easy</button>
      <button class="chip-toggle" data-action="filter-recovery" aria-pressed="${Boolean(f.recovery)}">${icon('sprout')}Postpartum recovery</button>
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

const weekOrder = () => Array.from({ length: 7 }, (_, i) => (state.settings.weekStartsOn + i) % 7);

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
          <span class="label">Days you need each meal</span>
          <div class="meal-days" role="grid">
            <span></span>${weekOrder().map((d) => `<span class="md-head">${DAY_NAMES[d].slice(0, 3)}</span>`).join('')}
            ${MEALS.filter((m) => s.meals.includes(m)).map((m) => `
              <span class="md-meal">${m}</span>
              ${weekOrder().map((d) => {
                const on = (s.mealDays?.[m] || [0, 1, 2, 3, 4, 5, 6]).includes(d);
                return `<button class="md-cell" data-action="toggle-meal-day" data-meal="${m}" data-weekday="${d}" aria-pressed="${on}" aria-label="${m} on ${DAY_NAMES[d]}: ${on ? 'planned' : 'fend for yourself'}">${on ? icon('check') : icon('moon')}</button>`;
              }).join('')}`).join('')}
            <span class="md-meal md-easy">${icon('bolt')}Easy</span>
            ${weekOrder().map((d) => {
              const on = (s.easyDays || []).includes(d);
              return `<button class="md-cell easy" data-action="toggle-easy-day" data-weekday="${d}" aria-pressed="${on}" aria-label="Easy meals on ${DAY_NAMES[d]}: ${on ? 'yes' : 'no'}">${on ? icon('bolt') : ''}</button>`;
            }).join('')}
          </div>
          <small>Tap a day to turn that meal off, like dinner on nights you work. Those become "fend for yourself": no recipe, nothing on the grocery list. You can also skip a single meal from the plan. The ⚡ row marks easy-meal days.</small>
          <label class="switch"><span><b>Easy meals on weekends</b><br><small class="subtle">Saturday and Sunday get quick, low-effort meals (grilled cheese, tacos, wraps…). Locked meals are never changed. Pick other easy days in the bottom row above.</small></span><input type="checkbox" data-action="easy-weekends" ${[0, 6].every((d) => (s.easyDays || []).includes(d)) ? 'checked' : ''}></label>
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
        <h2>Stores &amp; prices</h2>
        <div class="field-row">
          ${[0, 1].map((n) => `
            <div class="field">
              <label for="store-${n}">${n ? 'Second store' : 'Main store'}</label>
              <select id="store-${n}" class="input" data-store-idx="${n}">
                ${n ? '<option value="">None</option>' : ''}
                ${Object.entries(state.meta.stores).map(([k, st]) => `<option value="${k}" ${s.stores[n] === k ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
        <div class="field-row">
          ${s.stores.map((k) => `
            <div class="field">
              <label for="lvl-${k}">${esc(storeName(k))} price level</label>
              <div class="money"><input id="lvl-${k}" class="input" type="number" min="-60" max="100" step="1" data-store-level="${k}" value="${s.storeLevels[k] ?? state.meta.stores[k].level}"><span>% vs. average</span></div>
            </div>`).join('')}
        </div>
        <div class="field">
          <label for="trip">Worth a second trip if it saves at least</label>
          <div class="money"><span>${esc(s.currency)}</span><input id="trip" class="input" type="number" min="0" step="1" data-setting="tripThreshold" value="${s.tripThreshold}"></div>
        </div>
        <label class="switch"><span><b>Show Prices and Shop plan tabs</b><br><small class="subtle">Compare your two stores item by item and plan the cheapest trip, on the Groceries tab. Meal costs per serving don't depend on these.</small></span><input type="checkbox" data-setting="showPriceTabs" ${s.showPriceTabs ? 'checked' : ''}></label>
        <label class="switch"><span><b>Count spices &amp; staples</b><br><small class="subtle">Include spices, oils and sauces in price totals and the shopping plan.</small></span><input type="checkbox" data-setting="countPantry" ${s.countPantry ? 'checked' : ''}></label>
        <small class="subtle">Meijer, Aldi, Walmart and Target don't publish prices for other apps to use, so the app starts with estimates (typical US prices adjusted by each store's usual price level, which you can tune above). Tap any price on the Groceries tab to save the real one and the aisle; your prices are remembered and used every week.</small>
      </section>

      <section class="panel">
        <h2>Health &amp; macros</h2>
        <label class="switch"><span><b>Postpartum recovery</b><br><small class="subtle">Favor meals that help you recover after birth: protein, iron and B12 (beef, lentils, greens), omega-3s from low-mercury fish, choline from eggs, calcium, fiber and warm soups. Works with easy days: those get meals that are easy <i>and</i> good for recovery. ${state.recipes.filter(isRecovery).length} recipes qualify. Everyday food, not medical advice; if you're breastfeeding you need roughly 330–400 extra calories a day.</small></span><input type="checkbox" data-setting="postpartumMode" ${s.postpartumMode ? 'checked' : ''}></label>
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
        <h2>PIN &amp; security</h2>
        <p class="subtle" style="margin:0">Every device has to enter the PIN once every 24 hours.</p>
        <form class="field-row" data-form="change-pin" autocomplete="off">
          <div class="field"><label for="pin-cur">Current PIN</label><input id="pin-cur" class="input" name="current" type="password" inputmode="numeric" pattern="\\d{4,8}" maxlength="8" required></div>
          <div class="field"><label for="pin-new">New PIN</label><input id="pin-new" class="input" name="pin" type="password" inputmode="numeric" pattern="\\d{4,8}" maxlength="8" required></div>
          <div class="field" style="align-self:end"><button class="btn">Change PIN</button></div>
        </form>
        <div class="modal-actions">
          <button class="btn" data-action="lock-now">${icon('lock')}Lock this device</button>
          <button class="btn danger" data-action="signout-all">Sign out all devices</button>
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

      <section class="panel notify-setup">
        <h2>Freezer &amp; thaw reminders</h2>
        <label class="switch"><span><b>Warn about meat that won't keep</b><br><small class="subtle">Raw chicken, ground meat and fish keep 1–2 days in the fridge; steaks and chops 3–5 (USDA). Meals later in the week get a ❄ to freeze it after shopping, plus a reminder to thaw it the night before.</small></span><input type="checkbox" data-setting="freezeAlerts" ${s.freezeAlerts ? 'checked' : ''}></label>
        <div class="field">
          <label for="thaw-hour">Thaw reminder time</label>
          <select id="thaw-hour" class="input" data-setting="thawHour">
            ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === s.thawHour ? 'selected' : ''}>${new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })} the day before</option>`).join('')}
          </select>
        </div>
        <h3>Phone notifications</h3>
        <p class="subtle" style="margin:0">Reminders go to your phone through <b>ntfy</b>, a free notification app (no account needed).</p>
        <ol class="steps-list">
          <li>Install <b>ntfy</b> from the App Store or Google Play.</li>
          <li>Pick a topic name below (or tap <b>Make one</b>). Anyone who knows it can see the reminders, so keep it hard to guess.</li>
          <li>In the ntfy app tap <b>+</b>, enter the same topic and subscribe. Do it on each phone that should get reminders.</li>
          <li>Tap <b>Send a test</b>.</li>
        </ol>
        <div class="inline-form">
          <input id="ntfy-topic" class="input" data-setting="ntfyTopic" value="${esc(s.ntfyTopic)}" placeholder="Topic, e.g. mealweek-k3x9q2" aria-label="ntfy topic" autocomplete="off" spellcheck="false">
          <button class="btn" data-action="ntfy-make">${icon('dice')}Make one</button>
          <button class="btn primary" data-action="ntfy-test" ${s.ntfyTopic ? '' : 'disabled'}>Send a test</button>
        </div>
        <details>
          <summary class="subtle">Using your own ntfy server?</summary>
          <div class="field"><label for="ntfy-server">ntfy server</label><input id="ntfy-server" class="input" data-setting="ntfyServer" value="${esc(s.ntfyServer)}" placeholder="https://ntfy.sh"></div>
        </details>
      </section>

      <section class="panel share-setup">
        <h2>Share recipes from TikTok &amp; other apps</h2>
        <p class="subtle" style="margin:0">Add "Meal Planner" to your phone's share menu, then in TikTok (or Safari, Instagram…) tap <b>Share → More → Meal Planner</b> and the recipe is imported.</p>
        <details>
          <summary><b>iPhone</b>: make a one-time Shortcut (about 2 minutes)</summary>
          <ol>
            <li>Open the <b>Shortcuts</b> app and tap <b>+</b> to make a new shortcut.</li>
            <li>Tap the <b>ⓘ</b> button at the bottom and turn on <b>Show in Share Sheet</b>. At the top, tap <b>Images and 18 more</b> and leave only <b>URLs</b> and <b>Text</b> ticked.</li>
            <li>Add the action <b>URL Encode</b>; it fills in <i>Shortcut Input</i> by itself.</li>
            <li>Add the action <b>URL</b> and paste this, then tap after the <code>=</code> and pick the <i>URL Encoded Text</i> variable:
              <div class="copy-row"><code>${esc(location.origin)}/share?text=</code><button class="btn sm" data-action="copy-text" data-text="${esc(location.origin)}/share?text=">${icon('copy')}Copy</button></div></li>
            <li>Add the action <b>Open URLs</b>.</li>
            <li>Name the shortcut <b>Meal Planner</b> and tap Done.</li>
          </ol>
          <p class="subtle">In TikTok, tap <b>Share → More</b>; "Meal Planner" is in the list of actions. Tap <b>Edit Actions</b> there to add it to your favorites so it's near the top. It opens the app in Safari, which asks for your PIN once a day like any other device.</p>
        </details>
        <details>
          <summary><b>Android</b>: install the app</summary>
          <p class="subtle">In Chrome, open the menu (⋮) and tap <b>Add to Home screen → Install</b>. "Meals" then shows up in the share menu of TikTok and other apps.</p>
        </details>
      </section>
    </div>`;
}

// ---------- modals ----------

function openModal(html) {
  modalBody.innerHTML = `<button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon('x')}</button>${html}`;
  if (!modal.open) modal.showModal();
  modalBody.scrollTop = 0;
}

/** The "running low" triangle for an ingredient (or pantry item). */
function lowButton(name, have) {
  const low = Boolean(have?.low);
  const label = low ? `${name} is running low (on your grocery list). Tap to undo.` : `Running low on ${name}? Tap to add it to your grocery list.`;
  return `<button class="icon-btn xs low-btn" data-action="mark-low" data-name="${esc(name)}" ${have ? `data-id="${esc(have.id)}"` : ''} aria-pressed="${low}" title="${esc(label)}" aria-label="${esc(label)}">${icon('alert')}</button>`;
}

/** Where a meal goes next week: the same day and meal if it's free, else another open slot for that meal. */
function carrySlot(fromSlot, nextPlan) {
  const open = nextPlan.slots.filter((x) => !x.off && !x.locked).sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  return open.find((x) => x.day === fromSlot.day && x.meal === fromSlot.meal)
    || open.find((x) => x.meal === fromSlot.meal && !x.recipeId) || open.find((x) => x.meal === fromSlot.meal) || open[0] || null;
}

/** One tap from the meal card: add it to next week (locked in). */
async function carryToNextWeek(slotId) {
  const from = state.plan.slots.find((x) => x.id === slotId);
  if (!from?.recipeId) return;
  const nextKey = isoDate(addDays(parseKey(state.weekKey), 7));
  const target = carrySlot(from, await api('GET', `/api/weeks/${nextKey}`));
  if (!target) throw new Error("Every meal next week is locked. Unlock one first.");
  await api('PATCH', `/api/weeks/${nextKey}/slots/${target.id}`, { recipeId: from.recipeId, locked: true });
  const day = DAY_NAMES[addDays(parseKey(nextKey), target.day).getDay()];
  toast(`Added to next ${day} ${target.meal} and locked in. Open the meal to pick a different day.`, '', 'carry');
}

/** "Didn't get to it? Add to next week": same day and meal by default, locked in. */
function carryOverForm(r, fromSlot, nextPlan, nextKey) {
  const usable = nextPlan.slots.filter((x) => !x.off).sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  const pick = carrySlot(fromSlot, nextPlan);
  if (!pick) return '';
  const options = usable.map((x) => {
    const label = `${DAY_NAMES[addDays(parseKey(nextKey), x.day).getDay()]} ${x.meal}`;
    const cur = x.recipeId && state.byId.get(x.recipeId);
    if (x.locked) return `<option value="${x.id}" disabled>${label} (locked${cur ? `: ${esc(cur.name.slice(0, 24))}` : ''})</option>`;
    return `<option value="${x.id}" ${x === pick ? 'selected' : ''}>${label}${cur ? ` (replace ${esc(cur.name.slice(0, 26))})` : ' (open)'}</option>`;
  }).join('');
  return `
      <form class="inline-form carry-form" data-form="carry-next" data-week="${nextKey}">
        <span class="carry-label">Didn't get to it?</span>
        <select class="input" name="slot" aria-label="Day and meal next week">${options}</select>
        <button class="btn">${icon('chevron-right')}Add to next week</button>
      </form>`;
}

async function openRecipe(id, slotId) {
  let r;
  // Opened from a meal on the plan: also load next week, so it can be carried over if you don't get to it.
  const fromSlot = slotId && state.plan.slots.find((x) => x.id === slotId && x.recipeId === id);
  const nextKey = isoDate(addDays(parseKey(state.weekKey), 7));
  let nextPlan = null;
  try {
    [r, nextPlan] = await Promise.all([api('GET', `/api/recipes/${encodeURIComponent(id)}`), fromSlot ? api('GET', `/api/weeks/${nextKey}`) : null]);
  } catch (e) { toast(e.message, 'error'); return; }
  const s = state.settings;
  const target = defaultSlotFor(r, slotId);
  const usable = state.plan.slots.filter((slot) => !slot.off).sort((a, b) => a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  const slotOptions = usable.map((slot) => {
    const date = addDays(parseKey(state.weekKey), slot.day);
    const cur = slot.recipeId && state.byId.get(slot.recipeId);
    const label = `${DAY_NAMES[date.getDay()]} ${slot.meal}`;
    // Locked meals can't be replaced from here; unlock them on the plan first.
    if (slot.locked) return `<option value="${slot.id}" disabled>${label} (locked${cur ? `: ${esc(cur.name.slice(0, 24))}` : ''})</option>`;
    return `<option value="${slot.id}" ${slot.id === target?.id ? 'selected' : ''}>${label}${cur ? ` (replace ${esc(cur.name.slice(0, 26))})` : ' (open)'}</option>`;
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
          ${slotId ? `<button class="btn ghost" data-action="skip-slot" data-slot="${esc(slotId)}" data-skip="true" title="Make this a fend-for-yourself meal">${icon('moon')}Skip this meal</button>` : ''}
        </div>
      </div>

      ${target ? `
      <form class="inline-form" data-form="add-to-plan">
        <select class="input" name="slot" aria-label="Day and meal">${slotOptions}</select>
        <button class="btn primary">${icon('calendar')}Add to ${esc(relativeWeek(state.weekKey).toLowerCase())}</button>
      </form>` : `<p class="subtle">Every meal ${esc(relativeWeek(state.weekKey).toLowerCase())} is locked. Unlock one on the plan to swap this recipe in.</p>`}
      ${nextPlan ? carryOverForm(r, fromSlot, nextPlan, nextKey) : ''}

      ${nutritionPanel(r)}
      ${recoveryNote(r)}

      <div class="recipe-cols">
        <div>
          <h3>Ingredients</h3>
          <p class="subtle" style="margin:-.3rem 0 .5rem">${scaleNote}</p>
          ${avoidHits(r).length ? `<p class="avoid-note">⚠ Contains ${esc(avoidHits(r).join(', '))}, which is on your allergies &amp; dislikes list.</p>` : ''}
          <ul class="ing-list">${r.ingredients.map((i, n) => {
            const bad = avoidMatch([i.name]).length;
            return `<li class="${bad ? 'avoid' : ''}"><span class="m">${esc(i.measure)}</span><span class="ing-name">${esc(i.name)}${bad ? ' <b>avoid</b>' : ''}</span>${lowButton(i.name, r.pantry?.[n])}</li>`;
          }).join('')}</ul>
          <p class="subtle low-hint">${icon('alert')} Tap the triangle on anything you're running low on and it goes on your grocery list.</p>
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

/**
 * Best slot to drop a recipe into: the one it was opened from, otherwise the
 * first open (empty, unlocked) meal it suits, starting from today. Never a
 * locked meal or a "fend for yourself" one.
 */
function defaultSlotFor(r, slotId) {
  const open = state.plan.slots.filter((s) => !s.off && !s.locked);
  const from = open.find((s) => s.id === slotId);
  if (from) return from;
  const start = parseKey(state.weekKey);
  const today = Math.max(0, Math.round((parseKey(isoDate(new Date())) - start) / 864e5));
  const suits = (s) => !r.mealTypes?.length || r.mealTypes.includes(s.meal);
  const score = (s) => (s.recipeId ? 4 : 0) + (suits(s) ? 0 : 2) + (s.day >= today ? 0 : 1);
  return [...open].sort((a, b) => score(a) - score(b) || a.day - b.day || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))[0] || null;
}

/** Why a recipe is good for postpartum recovery. */
function recoveryNote(r) {
  if (!isRecovery(r)) return '';
  const groups = recoveryGroups(r.ingredients.map((i) => i.name));
  const text = r.benefits || (groups.length ? `Protein-rich, with ${nameList(groups)}.` : 'Protein-rich and nutrient-dense.');
  return `<p class="recovery-note">${icon('sprout')}<span><b>Postpartum recovery:</b> ${esc(text)}</span></p>`;
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
        <div class="chips">${MEALS.map((m) => `<label class="chip-toggle check" data-meal="${m}"><input type="checkbox" name="meal" value="${m}" ${meals.includes(m) ? 'checked' : ''}>${m}</label>`).join('')}
          <label class="chip-toggle check"><input type="checkbox" name="easy" value="1" ${d.easy ?? d.easyFlag ? 'checked' : ''}>${icon('bolt')}Easy meal</label></div>
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

/** Import a recipe page or TikTok link: finished recipes open, TikTok captions open in the editor to finish. */
async function importRecipeLink(url) {
  const res = await api('POST', '/api/recipes/import', { url });
  if (res.draft) {
    openEditor(res.draft);
    return;
  }
  upsertRecipe(res.recipe);
  toast(res.duplicate ? 'You already have that recipe' : `Imported "${res.recipe.name}"`);
  render();
  openRecipe(res.recipe.id);
}

/**
 * Links shared to the app: Android's share sheet (installed app) and the iPhone
 * Shortcut both open /share?url=…, or ?text=… with the link somewhere in the text.
 */
async function importShared() {
  if (location.pathname !== '/share') return;
  const q = new URLSearchParams(location.search);
  const link = ['url', 'text', 'title'].map((k) => q.get(k) || '').join(' ').match(/https?:\/\/\S+/)?.[0];
  history.replaceState(null, '', '/#recipes');
  route();
  if (!link) {
    toast("That share didn't include a link", 'error');
    return;
  }
  toast('Importing the shared recipe…', '', 'import');
  try {
    await importRecipeLink(link.replace(/[).,!?]+$/, ''));
  } catch (e) {
    openImport(link);
    toast(e.message, 'error');
  }
}

function openImport(prefill = '') {
  openModal(`
    <div class="modal-content">
      <h2 id="modal-title">Import a recipe link</h2>
      <p class="subtle" style="margin:0">Paste a recipe page or a TikTok video link. Recipe pages from most sites and creator blogs import complete. For a TikTok, the app grabs the caption, creator and cover image; if the ingredients aren't in the caption, you'll finish it in the editor while you watch. Different versions of a meal you already have are kept as separate recipes.</p>
      <form class="inline-form" data-form="import">
        <input class="input" type="url" name="url" required value="${esc(prefill)}" placeholder="https://www.tiktok.com/@creator/video/… or a recipe page" aria-label="Recipe or TikTok link">
        <button class="btn primary">${icon('download')}Import</button>
      </form>
    </div>`);
  setTimeout(() => $('input[name=url]', modalBody)?.focus(), 50);
}

modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

// ---------- actions ----------

// Change the easy days, then swap this week's unlocked meals on those days for easy ones.
async function setEasyDays(days) {
  const added = days.filter((d) => !(state.settings.easyDays || []).includes(d));
  await updateSettings({ easyDays: days });
  if (!added.length) return;
  const res = await api('POST', `/api/weeks/${state.weekKey}/apply-easy`);
  await setPlan(res);
  toast(res.changed ? `Swapped in ${res.changed} easy meal${res.changed > 1 ? 's' : ''} (locked meals untouched)` : 'Easy days saved', '', 'easy');
}

async function updateSettings(patch) {
  state.settings = await api('PUT', '/api/settings', { ...state.settings, ...patch });
  setAvoidRules();
  if ('avoidAllergens' in patch || 'avoidIngredients' in patch) {
    const clash = state.plan.slots.filter((sl) => sl.recipeId && state.byId.has(sl.recipeId) && avoidHits(state.byId.get(sl.recipeId)).length).length;
    if (clash) toast(`${clash} planned meal${clash > 1 ? 's' : ''} this week contain${clash > 1 ? '' : 's'} something on your list. They're marked ⚠ on the plan.`, '', 'clash');
  }
  if (['meals', 'mealDays', 'householdSize', 'stores', 'storeLevels', 'tripThreshold', 'countPantry', 'freezeAlerts'].some((k) => k in patch)) await loadWeek();
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
    const empty = state.plan.slots.filter((s) => !s.recipeId && !s.off).length;
    if (empty) toast(`Couldn't fill ${empty} meal${empty > 1 ? 's' : ''} — try loosening your price, health, protein or allergy settings.`, 'error');
  },
  'clear-week': async () => {
    if (!confirm('Clear all unlocked meals for this week?')) return;
    await setPlan(await api('POST', `/api/weeks/${state.weekKey}/clear`));
  },
  reroll: async (el) => setPlan(await api('POST', `/api/weeks/${state.weekKey}/slots/${el.dataset.slot}/reroll`)),
  'reroll-day': async (el) => {
    await setPlan(await api('POST', `/api/weeks/${state.weekKey}/days/${el.dataset.day}/reroll`));
    const name = DAY_NAMES[addDays(parseKey(state.weekKey), Number(el.dataset.day)).getDay()];
    toast(`New picks for ${name}`, '', 'reroll');
  },
  lock: async (el) => {
    const slot = state.plan.slots.find((s) => s.id === el.dataset.slot);
    await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${slot.id}`, { locked: !slot.locked }));
  },
  choose: (el) => openPicker(el.dataset.slot),
  pick: async (el) => {
    const slotId = $('[data-picker]', modalBody).dataset.picker;
    modal.close();
    await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${slotId}`, { recipeId: el.dataset.id, locked: true, replaceLocked: true }));
    toast('Added and locked in');
  },
  fav: (el) => toggleFavorite(el.dataset.id),
  'open-recipe': (el) => openRecipe(el.dataset.id, el.dataset.slot),
  'close-modal': () => modal.close(),
  'scan-open': (el) => openScan(el.dataset.mode),
  'carry-slot': (el) => carryToNextWeek(el.dataset.slot),
  'browse-pantry': () => openBrowse(),
  'browse-pick': (el) => {
    const n = el.dataset.name;
    if (browse.picked.has(n)) browse.picked.delete(n); else browse.picked.add(n);
    const on = browse.picked.has(n);
    el.setAttribute('aria-pressed', String(on));
    el.innerHTML = `${on ? icon('check') : ''}${esc(n)}`;
    refreshBrowseButton();
  },
  'browse-add': async () => {
    const items = PANTRY_CATALOG.filter((i) => browse.picked.has(i.name)).map(({ name, where }) => ({ name, where }));
    if (!items.length) return;
    state.pantry = await api('POST', '/api/pantry', { items });
    state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
    modal.close();
    render();
    toast(`Added ${items.length} item${items.length === 1 ? '' : 's'} to your pantry`, '', 'pantry');
  },
  'scan-mode': (el) => { stopCamera(); return openScan(el.dataset.mode); },
  'grocery-view': (el) => { state.groceryView = el.dataset.view; saveLocal('groceryView', state.groceryView); render(); },
  'edit-price': (el, e) => { e.preventDefault(); openPriceEditor(el.dataset.key, el.dataset.store); },
  'clear-price': async (el) => {
    await api('PUT', '/api/prices', { store: el.dataset.store, key: el.dataset.key, price: 0, aisle: '' });
    modal.close();
    state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
    render();
    toast('Back to the estimated price');
  },
  'have-it': async (el, e) => {
    e.preventDefault();
    state.pantry = await api('POST', '/api/pantry', { name: el.dataset.name, where: el.dataset.where });
    state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
    render();
    toast(`Added ${el.dataset.name} to your ${PLACE_LABEL[el.dataset.where].toLowerCase()}`, '', 'pantry');
  },
  'need-anyway': async (el) => {
    state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { needAnyway: el.dataset.key, value: true });
    render();
    toast('Back on the list for this week', '', 'pantry');
  },
  'add-staple': async (el) => {
    state.pantry = await api('POST', '/api/pantry', { name: el.dataset.name, where: el.dataset.where });
    state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
    render();
  },
  'mark-low': async (el) => {
    const low = el.getAttribute('aria-pressed') !== 'true';
    const res = await api('POST', '/api/pantry/low', { name: el.dataset.name, id: el.dataset.id, low });
    const { item, ...pantry } = res;
    state.pantry = pantry;
    state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
    if (modal.open && el.closest('.ing-list')) {
      // Update the triangles in the open recipe without redrawing it (keeps your scroll position).
      for (const b of modalBody.querySelectorAll('.ing-list .low-btn')) {
        if (b === el || (item && b.dataset.id === item.id)) b.outerHTML = lowButton(b.dataset.name, item && { id: item.id, low: item.low });
      }
      updateBadge();
    } else {
      render();
    }
    const n = item?.name || el.dataset.name;
    const nice = n.charAt(0).toUpperCase() + n.slice(1);
    toast(low ? `${nice} is running low: added to your grocery list` : `${nice} isn't marked low anymore`, '', 'low');
  },
  'remove-pantry': async (el) => {
    state.pantry = await api('DELETE', `/api/pantry/${encodeURIComponent(el.dataset.id)}`);
    state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
    render();
  },
  'toggle-hide': () => { state.hideChecked = !state.hideChecked; saveLocal('hideChecked', state.hideChecked); render(); },
  'uncheck-all': async () => { state.pantry = null; state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { uncheckAll: true }); render(); },
  'remove-extra': async (el, e) => {
    e.preventDefault();
    state.grocery = await api('DELETE', `/api/weeks/${state.weekKey}/grocery/extras/${el.dataset.id}`);
    render();
  },
  'ntfy-make': async () => {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    await updateSettings({ ntfyTopic: `mealweek-${id}` });
    render();
    toast('Topic made. Subscribe to it in the ntfy app, then send a test.');
  },
  'ntfy-test': async () => {
    // Save a topic that was just typed in before testing it.
    const typed = $('#ntfy-topic')?.value.trim();
    if (typed && typed !== state.settings.ntfyTopic) state.settings = await api('PUT', '/api/settings', { ...state.settings, ntfyTopic: typed });
    await api('POST', '/api/notify/test');
    toast('Sent! It should show up on your phone in a few seconds.');
  },
  'copy-text': async (el) => {
    try { await navigator.clipboard.writeText(el.dataset.text); toast('Copied'); } catch { toast('Copy failed — your browser blocked clipboard access', 'error'); }
  },
  'copy-list': async () => {
    const g = state.grocery;
    const lines = [`Groceries · ${weekRange(state.weekKey)}`, ''];
    let aisle = null;
    for (const i of g.items.filter((x) => !x.checked && !x.have)) {
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
  'filter-easy': () => { state.recipeFilters.easy = !state.recipeFilters.easy; state.recipeFilters.limit = PAGE; render(); },
  'filter-recovery': () => { state.recipeFilters.recovery = !state.recipeFilters.recovery; state.recipeFilters.limit = PAGE; render(); },
  'filter-healthy': () => { state.recipeFilters.healthy = !state.recipeFilters.healthy; state.recipeFilters.limit = PAGE; render(); },
  'filter-budget': () => { state.recipeFilters.budget = !state.recipeFilters.budget; state.recipeFilters.limit = PAGE; render(); },
  'import-url': () => openImport(),
  'skip-slot': async (el) => {
    const skip = el.dataset.skip === 'null' ? null : el.dataset.skip === 'true';
    if (modal.open) modal.close();
    await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${el.dataset.slot}`, { skip }));
    toast(skip ? 'Marked as fend for yourself' : 'Back on the plan');
  },
  'toggle-easy-day': (el) => {
    const d = Number(el.dataset.weekday);
    const cur = state.settings.easyDays || [];
    return setEasyDays(cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  },
  'toggle-meal-day': (el) => {
    const { meal } = el.dataset;
    const day = Number(el.dataset.weekday);
    const cur = state.settings.mealDays?.[meal] || [0, 1, 2, 3, 4, 5, 6];
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
    return updateSettings({ mealDays: { ...state.settings.mealDays, [meal]: next } });
  },
  'lock-now': async () => {
    await api('POST', '/api/auth/logout');
    await requirePin();
    route();
  },
  'signout-all': async () => {
    if (!confirm('Sign out every device? Everyone will need the PIN again.')) return;
    await api('POST', '/api/auth/signout-all');
    await requirePin();
    route();
  },
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
  let day = dropTargetAt(d.x, d.y);
  if (day != null && document.querySelector(`.day[data-day="${day}"] .off-slot[data-meal="${d.meal}"]`)) day = null;
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
  // Skip over "fend for yourself" days.
  let to = from + step;
  while (to >= 0 && to <= 6 && state.plan.slots.find((x) => x.meal === meal && x.day === to)?.off) to += step;
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
      // Ticking a running-low item restocks it, which changes the pantry too.
      if (state.grocery.items.find((i) => i.key === el.dataset.key)?.low) state.pantry = null;
      state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { key: el.dataset.key, checked: el.checked, today: isoDate(new Date()) });
      if (el.checked && !state.grocery.freshness?.assumed && state.grocery.freshness?.shoppedOn === isoDate(new Date()) && !state.shopToastShown?.[state.weekKey]) {
        state.shopToastShown = { ...state.shopToastShown, [state.weekKey]: true };
        const n = freshTasks().flatMap((t) => t.items.filter((i) => i.why === 'freeze')).length;
        if (n) toast(`Shopping done! ${n} item${n > 1 ? 's' : ''} to freeze when you unpack (see the top of the list)`, '', 'shop');
      }
      render();
    });
  } else if (el.dataset.action === 'check-extra') {
    busy(null, async () => {
      state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { extraId: el.dataset.id, checked: el.checked });
      render();
    });
  } else if (el.dataset.action === 'easy-weekends') {
    const cur = (state.settings.easyDays || []).filter((d) => d !== 0 && d !== 6);
    busy(null, () => setEasyDays(el.checked ? [...cur, 0, 6] : cur));
  } else if (el.dataset.action === 'theme') {
    saveLocal('theme', el.value);
    document.documentElement.dataset.theme = el.value;
  } else if (el.dataset.storeIdx != null) {
    const stores = [...state.settings.stores];
    stores[Number(el.dataset.storeIdx)] = el.value;
    busy(null, () => updateSettings({ stores: stores.filter(Boolean) }));
  } else if (el.dataset.storeLevel) {
    busy(null, () => updateSettings({ storeLevels: { ...state.settings.storeLevels, [el.dataset.storeLevel]: el.value } }));
  } else if (el.dataset.setting) {
    const key = el.dataset.setting;
    const value = el.type === 'checkbox' ? el.checked : el.type === 'number' || key === 'weekStartsOn' ? Number(el.value) || 0 : el.value;
    const saved = key === 'postpartumMode' && value ? 'Postpartum recovery is on. Tap Randomize to fill your unlocked meals with recovery recipes.' : 'Saved';
    busy(null, () => updateSettings({ [key]: value }).then(() => toast(saved)));
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
  } else if (el.dataset.action === 'shopped-on') {
    busy(null, async () => {
      state.grocery = await api('PATCH', `/api/weeks/${state.weekKey}/grocery`, { shoppedOn: el.value || null });
      render();
    });
  } else if (el.matches('[data-picker-q]')) {
    refreshPicker();
  } else if (el.matches('[data-scan-photo]')) {
    scanPhotoFiles(el.files);
    el.value = '';
  } else if (el.matches('[data-scan-i]')) {
    const r = scan.results[Number(el.dataset.scanI)];
    if (!r) return;
    r[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (el.type === 'checkbox') refreshScan();
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
    'scan-code': async () => {
      await lookupCode(data.code.trim());
      form.reset();
    },
    'save-scan': async () => {
      const items = scan.results.filter((r) => r.checked && r.name);
      if (!items.length) return;
      state.pantry = await api('POST', '/api/pantry', { items: items.map(({ name, where }) => ({ name, where })) });
      state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
      modal.close();
      render();
      toast(`Added ${items.length} item${items.length === 1 ? '' : 's'} to your pantry`, '', 'pantry');
    },
    'add-pantry': async () => {
      typeahead.items = [];
      state.pantry = await api('POST', '/api/pantry', { name: data.name, where: data.where });
      state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
      render();
      $('#pantry-in')?.focus();
    },
    'add-extra': async () => {
      if (!data.name.trim()) return;
      state.grocery = await api('POST', `/api/weeks/${state.weekKey}/grocery/extras`, { name: data.name });
      render();
      $('[data-form="add-extra"] input')?.focus();
    },
    import: () => importRecipeLink(data.url),
    'change-pin': async () => {
      await api('POST', '/api/auth/change', { current: data.current, pin: data.pin });
      form.reset();
      toast('PIN changed. Other devices will need the new one.');
    },
    'save-recipe': async () => {
      const fd = new FormData(form);
      const id = form.dataset.id;
      const payload = {
        ...data,
        mealTypes: fd.getAll('meal'),
        easy: fd.get('easy') === '1',
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
    'save-price': async () => {
      await api('PUT', '/api/prices', { store: form.dataset.store, key: form.dataset.key, price: data.price === '' ? 0 : Number(data.price), aisle: data.aisle });
      modal.close();
      state.grocery = await api('GET', `/api/weeks/${state.weekKey}/grocery`);
      render();
      toast(`Saved for ${storeName(form.dataset.store)}`, '', 'price');
    },
    'carry-next': async () => {
      const id = $('[data-recipe]', modalBody).dataset.recipe;
      const week = form.dataset.week;
      const next = await api('PATCH', `/api/weeks/${week}/slots/${data.slot}`, { recipeId: id, locked: true });
      modal.close();
      const slot = next.slots.find((x) => x.id === data.slot);
      const day = slot ? DAY_NAMES[addDays(parseKey(week), slot.day).getDay()] : '';
      toast(`Added to next ${day} ${slot?.meal || ''} and locked in`);
    },
    'add-to-plan': async () => {
      const id = $('[data-recipe]', modalBody).dataset.recipe;
      modal.close();
      await setPlan(await api('PATCH', `/api/weeks/${state.weekKey}/slots/${data.slot}`, { recipeId: id, locked: true }));
      const slot = state.plan.slots.find((x) => x.id === data.slot);
      const day = slot ? DAY_NAMES[addDays(parseKey(state.weekKey), slot.day).getDay()] : '';
      toast(`Added to ${day} ${slot?.meal || ''} and locked in`);
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
  state.tab = ['plan', 'groceries', 'pantry', 'recipes', 'settings'].includes(tab) ? tab : 'plan';
  if (modal.open) modal.close();
  render();
  window.scrollTo({ top: 0 });
  scrollToToday();
}
window.addEventListener('hashchange', route);
// The logo goes to the plan; when you're already there it scrolls back to the top.
document.querySelector('.brand').addEventListener('click', (e) => {
  if (state.tab !== 'plan') return;
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

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
    await requirePin();
    const [settings, meta, recipes] = await Promise.all([api('GET', '/api/settings'), api('GET', '/api/meta'), api('GET', '/api/recipes')]);
    state.settings = settings;
    state.meta = meta;
    // Reminder times follow this household's clock.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && settings.timeZone !== tz) api('PUT', '/api/settings', { timeZone: tz }).then((x) => { state.settings = x; }).catch(() => {});
    setAvoidRules();
    setRecipes(recipes);
    state.weekKey = weekStart();
    await loadWeek();
    route();
    await importShared();
  } catch (e) {
    main.innerHTML = `<div class="panel empty"><h2>Can't reach the server</h2><p>${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Retry</button></div>`;
  }
}

boot();
