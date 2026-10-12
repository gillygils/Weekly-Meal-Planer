// Fridge life of raw meat and fish, and which planned meals need their meat
// frozen after shopping (then thawed in the fridge the day before).
//
// Days are the upper end of the USDA FoodKeeper guidance for the refrigerator
// (40°F / 4°C): raw poultry, ground meat, fish and shellfish 1-2 days; steaks,
// chops and roasts 3-5 days; bacon and hot dogs about a week.

// Words that mean it isn't raw meat at all ("chicken broth", "canned tuna").
const NOT_RAW = /\b(broth|stock|bouillon|powder|seasoning|soup|sauce|gravy|base|flavou?r|extract|fat|grease|oil|lard|tallow|canned|tinned|jerky|cooked|grilled|rotisserie|smoked salmon|hot smoked|salt cod|salted|dried|cubes?|paste|dressing|tomato(es)?|prosciutto|parma|serrano|beans?|artichokes?|palm|lettuce|celery|romaine)\b/;

const RULES = [
  { kind: 'ground meat', days: 2, re: /\b(ground (beef|pork|turkey|chicken|lamb|veal|meat|bison)|mince|minced (beef|pork|meat|lamb|turkey|chicken|steak)|beef mince|pork mince|hamburger|burger patt(y|ies)|meatballs?)\b/ },
  { kind: 'offal', days: 2, re: /\b(liver|kidneys?|hearts?|tripe|sweetbreads)\b/ },
  { kind: 'shellfish', days: 2, re: /\b(shrimp|prawns?|scallops?|crab|lobster|mussels?|clams?|squid|calamari|octopus|crawfish|crayfish)\b/ },
  { kind: 'fish', days: 2, re: /\b(salmon|cod|tilapia|halibut|haddock|trout|catfish|mahi[- ]?mahi|snapper|sea bass|swordfish|pollock|sole|flounder|mackerel|fish fillets?|white fish|tuna steaks?|ahi)\b/ },
  { kind: 'cured meat', days: 7, re: /\b(bacon|hot dogs?|frankfurters?|kielbasa|smoked sausage|andouille|pepperoni|salami)\b/ },
  { kind: 'deli meat', days: 5, re: /\b(deli|lunch meat|sliced (turkey|ham|chicken)|ham)\b/ },
  { kind: 'sausage', days: 2, re: /\b(sausages?|chorizo|bratwursts?|brats)\b/ },
  { kind: 'poultry', days: 2, re: /\b(chicken|turkey|duck|cornish hens?|poultry|wings|drumsticks?)\b/ },
  { kind: 'beef, pork or lamb', days: 4, re: /\b(beef|steaks?|sirloin|ribeye|rib-eye|flank|skirt|chuck|brisket|pork|chops?|tenderloin|loin|ribs|lamb|veal|venison|bison|goat|mutton|roast|short rib|oxtail)\b/ },
];

/** Fridge life for a raw ingredient name, or null when it isn't perishable meat or fish. */
export function fridgeLife(name) {
  const n = String(name || '').toLowerCase();
  if (NOT_RAW.test(n)) return null;
  for (const r of RULES) if (r.re.test(n)) return { kind: r.kind, days: r.days };
  return null;
}

const DAY_MS = 86400000;
const toDay = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const addDaysIso = (iso, n) => new Date(toDay(iso) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((toDay(b) - toDay(a)) / DAY_MS);

/**
 * Freeze and thaw plan for a week.
 *  - Meat bought on `shoppedOn` that a meal uses after its fridge life is up
 *    should be frozen when you get home ("freeze").
 *  - Meat that's frozen (frozen after shopping, or kept in the pantry's
 *    freezer) has to move to the fridge the day before ("thawOn").
 *
 * plan: { key, slots: [{ id, day, meal, recipeId, off }] }
 * shoppedOn: "YYYY-MM-DD" (actual or assumed shopping day)
 * freezerMatch(name): pantry item in the freezer that covers this ingredient, if any
 */
export function freshnessPlan({ plan, byId, shoppedOn, freezerMatch = () => null }) {
  const tasks = [];
  for (const s of plan.slots || []) {
    const r = !s.off && s.recipeId && byId.get(s.recipeId);
    if (!r) continue;
    const date = addDaysIso(plan.key, s.day);
    const items = new Map();
    for (const ing of r.ingredients || []) {
      const life = fridgeLife(ing.name);
      if (!life) continue;
      // Bought frozen ("frozen prawns") or kept in the pantry's freezer: it only needs thawing.
      const fromFreezer = /\bfrozen\b/i.test(ing.name) ? { name: ing.name } : freezerMatch(ing.name);
      const age = daysBetween(shoppedOn, date);
      let why = null;
      if (fromFreezer) why = 'freezer';
      else if (age >= 0 && age > life.days) why = 'freeze';
      if (!why) continue;
      const label = ing.name.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!items.has(label)) items.set(label, { name: label, kind: life.kind, days: life.days, why, freezerItem: fromFreezer?.name || null });
    }
    if (!items.size) continue;
    tasks.push({ slotId: s.id, day: s.day, meal: s.meal, date, recipe: r.name, recipeId: r.id, thawOn: addDaysIso(date, -1), items: [...items.values()] });
  }
  return tasks;
}

/** Local date (YYYY-MM-DD) and hour in a time zone. */
export function localNow(timeZone, now = new Date()) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}
