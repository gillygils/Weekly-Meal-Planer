// Store price comparison and the cheapest way to shop for the week.
//
// No grocery chain offers a public price API for Meijer, Aldi, Walmart or Target,
// so prices start as estimates: a typical US price for the package size you'll
// need, adjusted by the store's usual price level. Any price (and aisle) the
// household enters is saved in the price book and used from then on.
import { lookupIngredient, toBuyUnits } from './ingredients.js';
import { estimateIngredientCost } from './recipes.js';

// level: rough price level vs. the US average, in percent (adjustable in Settings).
// aisles: the store numbers its aisles, so it's worth noting where things are.
export const STORES = {
  aldi: { name: 'Aldi', level: -22, aisles: false },
  lidl: { name: 'Lidl', level: -18, aisles: false },
  walmart: { name: 'Walmart', level: -12, aisles: true },
  costco: { name: 'Costco', level: -15, aisles: true },
  meijer: { name: 'Meijer', level: -5, aisles: true },
  'trader-joes': { name: "Trader Joe's", level: -5, aisles: false },
  heb: { name: 'H-E-B', level: -8, aisles: true },
  kroger: { name: 'Kroger', level: 0, aisles: true },
  target: { name: 'Target', level: 3, aisles: true },
  wegmans: { name: 'Wegmans', level: 2, aisles: true },
  hyvee: { name: 'Hy-Vee', level: 4, aisles: true },
  safeway: { name: 'Safeway', level: 10, aisles: true },
  publix: { name: 'Publix', level: 12, aisles: true },
  sprouts: { name: 'Sprouts', level: 12, aisles: true },
  'whole-foods': { name: 'Whole Foods', level: 25, aisles: true },
};

const LB = 453.6;

export function storeLevel(key, settings) {
  const custom = settings.storeLevels?.[key];
  return custom != null ? custom : STORES[key]?.level ?? 0;
}

const round = (n) => Math.round(n * 100) / 100;

/** How much of an item to buy: packages (or pounds for loose items) and the baseline cost. */
export function purchaseFor(item) {
  const entry = lookupIngredient(item.key) || lookupIngredient(item.name);
  if (entry?.free) return null;
  if (!entry?.buy) {
    // Unknown ingredient: fall back to the rough per-recipe cost estimate.
    const n = Math.max(1, item.recipes?.length || 1);
    return { units: 1, unitLabel: 'item', qtyText: '1', base: round(estimateIngredientCost(item.name) * n), pantry: false, known: false };
  }
  const [size, , price, label] = entry.buy;
  let need = 0;
  for (const [unit, qty] of Object.entries(item.totals || {})) {
    const u = toBuyUnits(qty, unit, entry);
    if (u != null) need += u;
  }
  if (entry.loose) {
    const lbs = need > 0 ? Math.max(0.25, need / LB) : 1;
    const qty = Math.ceil(lbs * 4 - 0.1) / 4; // up to the next quarter pound
    return { units: qty, unitLabel: 'per lb', qtyText: `${qty} lb`, base: round(qty * price * (size === LB ? 1 : LB / size)), pantry: Boolean(entry.pantry), known: true };
  }
  const packs = need > 0 ? Math.max(1, Math.ceil(need / size - 0.08)) : 1;
  return { units: packs, unitLabel: label, qtyText: `${packs} × ${label}`, base: round(packs * price), pantry: Boolean(entry.pantry), known: true };
}

/**
 * Price every grocery item at the chosen stores and work out the cheapest plan.
 * priceBook: { [store]: { [itemKey]: { price, aisle } } } where price is per unitLabel.
 */
export function priceGroceryList(items, settings, priceBook = {}) {
  const stores = (settings.stores || []).filter((k) => STORES[k]).slice(0, 2);
  const priced = [];
  for (const item of items) {
    const buy = purchaseFor(item);
    if (!buy) continue;
    const at = {};
    for (const key of stores) {
      const saved = priceBook[key]?.[item.key];
      const real = saved?.price > 0;
      const unitPrice = real ? saved.price : round((buy.base / buy.units) * (1 + storeLevel(key, settings) / 100));
      at[key] = { cost: round(unitPrice * buy.units), unitPrice, real, aisle: saved?.aisle || '' };
    }
    let best = null;
    if (stores.length === 2) {
      const [a, b] = stores;
      const diff = at[a].cost - at[b].cost;
      best = Math.abs(diff) < 0.01 ? null : diff < 0 ? a : b;
    }
    priced.push({ ...item, buy, at, best, pantry: buy.pantry });
  }

  // Items you already have aren't bought; ticked items are in the cart, so they still count.
  const counted = priced.filter((p) => !p.have && (settings.countPantry || !p.pantry));
  const totals = Object.fromEntries(stores.map((k) => [k, round(counted.reduce((a, p) => a + p.at[k].cost, 0))]));
  let plan = null;
  if (stores.length === 2) {
    const [a, b] = stores;
    const pick = (p) => (p.at[a].cost <= p.at[b].cost ? a : b);
    const split = round(counted.reduce((a2, p) => a2 + p.at[pick(p)].cost, 0));
    const cheapest = totals[a] <= totals[b] ? a : b;
    const savings = round(totals[cheapest] - split);
    const threshold = settings.tripThreshold ?? 5;
    const splitWorthIt = savings >= threshold && counted.some((p) => pick(p) === a) && counted.some((p) => pick(p) === b);
    const trips = splitWorthIt
      ? stores.map((k) => ({ store: k, items: counted.filter((p) => pick(p) === k).map((p) => p.key), total: round(counted.filter((p) => pick(p) === k).reduce((s, p) => s + p.at[k].cost, 0)) }))
      : [{ store: cheapest, items: counted.map((p) => p.key), total: totals[cheapest] }];
    plan = { cheapest, split, savings, threshold, splitWorthIt, trips, total: splitWorthIt ? split : totals[cheapest] };
  }
  const realCount = priced.reduce((n, p) => n + stores.filter((k) => p.at[k].real).length, 0);
  return { stores: stores.map((k) => ({ key: k, ...STORES[k], level: storeLevel(k, settings) })), items: priced, totals, plan, realCount, slots: priced.length * stores.length };
}
