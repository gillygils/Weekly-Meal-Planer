// Ingredient parsing and grocery-list aggregation.
import { containsWord } from './recipes.js';

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2 };

// unit alias -> [canonical unit, multiplier into the canonical unit]
const UNITS = {
  g: ['g', 1], gr: ['g', 1], gram: ['g', 1], grams: ['g', 1], kg: ['g', 1000], kilogram: ['g', 1000], kilograms: ['g', 1000],
  mg: ['g', 0.001],
  ml: ['ml', 1], millilitre: ['ml', 1], milliliter: ['ml', 1], millilitres: ['ml', 1], milliliters: ['ml', 1],
  cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000], litre: ['ml', 1000], liter: ['ml', 1000], litres: ['ml', 1000], liters: ['ml', 1000],
  oz: ['oz', 1], ounce: ['oz', 1], ounces: ['oz', 1], lb: ['oz', 16], lbs: ['oz', 16], pound: ['oz', 16], pounds: ['oz', 16],
  tsp: ['tsp', 1], teaspoon: ['tsp', 1], teaspoons: ['tsp', 1], t: ['tsp', 1],
  tbsp: ['tbsp', 1], tbs: ['tbsp', 1], tblsp: ['tbsp', 1], tablespoon: ['tbsp', 1], tablespoons: ['tbsp', 1], tbls: ['tbsp', 1],
  cup: ['cup', 1], cups: ['cup', 1], c: ['cup', 1],
  pint: ['pint', 1], pints: ['pint', 1], quart: ['quart', 1], quarts: ['quart', 1],
  clove: ['clove', 1], cloves: ['clove', 1],
  can: ['can', 1], cans: ['can', 1], tin: ['can', 1], tins: ['can', 1],
  slice: ['slice', 1], slices: ['slice', 1],
  bunch: ['bunch', 1], bunches: ['bunch', 1],
  handful: ['handful', 1], handfuls: ['handful', 1],
  sprig: ['sprig', 1], sprigs: ['sprig', 1],
  stick: ['stick', 1], sticks: ['stick', 1],
  pinch: ['pinch', 1], pinches: ['pinch', 1], dash: ['dash', 1],
  packet: ['pack', 1], packets: ['pack', 1], pack: ['pack', 1], packs: ['pack', 1], package: ['pack', 1], packages: ['pack', 1], pkg: ['pack', 1],
  head: ['head', 1], heads: ['head', 1], loaf: ['loaf', 1], loaves: ['loaf', 1], jar: ['jar', 1], jars: ['jar', 1], bag: ['pack', 1], bags: ['pack', 1], box: ['pack', 1], boxes: ['pack', 1], stalk: ['stalk', 1], stalks: ['stalk', 1],
  fillet: ['fillet', 1], fillets: ['fillet', 1], piece: ['piece', 1], pieces: ['piece', 1],
};

const SIZE_WORDS = new Set(['large', 'medium', 'small', 'big', 'whole', 'heaped', 'heaping', 'level', 'rounded', 'generous', 'x']);

function parseNumberToken(tok) {
  if (!tok) return null;
  if (FRACTIONS[tok] != null) return FRACTIONS[tok];
  const mixedUni = /^(\d+)([½¼¾⅓⅔⅛⅜⅝⅞⅕])$/.exec(tok);
  if (mixedUni) return Number(mixedUni[1]) + FRACTIONS[mixedUni[2]];
  const frac = /^(\d+)\/(\d+)$/.exec(tok);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  if (/^\d+(\.\d+)?$/.test(tok)) return Number(tok);
  if (/^\d+,\d+$/.test(tok)) return Number(tok.replace(',', '.'));
  return null;
}

// Parse a measure string like "1 1/2 cups", "200g", "2 large", "To taste".
export function parseMeasure(measure) {
  let s = String(measure || '').trim().toLowerCase()
    .replace(/([a-z.)])\s*\/.*$/, '$1') // "650g/1lb 8oz" -> keep the first measure
    .replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞⅕])/g, '$1 $2')
    .replace(/(\d)\s*-\s*\d+(\.\d+)?/g, '$1') // ranges: take the low end
    .replace(/(\d)([a-z])/g, '$1 $2');
  const tokens = s.split(/\s+/).filter(Boolean);
  let qty = null;
  let i = 0;
  while (i < tokens.length) {
    const n = parseNumberToken(tokens[i]);
    if (n == null) break;
    qty = (qty || 0) + n;
    i++;
  }
  // "1 x 400g tin" -> use the inner measure, multiplied
  if (qty != null && tokens[i] === 'x' && parseNumberToken(tokens[i + 1]) != null) {
    const inner = parseMeasure(tokens.slice(i + 1).join(' '));
    if (inner.qty != null) return { qty: qty * inner.qty, unit: inner.unit, note: inner.note };
  }
  while (i < tokens.length && SIZE_WORDS.has(tokens[i])) i++;
  let unit = '';
  if (qty != null && i < tokens.length) {
    const word = tokens[i].replace(/[.,]$/, '');
    if (UNITS[word]) {
      unit = UNITS[word][0];
      qty *= UNITS[word][1];
      i++;
    }
  }
  const note = tokens.slice(i).join(' ').replace(/^of\s+/, '');
  return { qty, unit, note: qty == null ? String(measure || '').trim() : note };
}

// Split a free-text ingredient line ("2 cups chopped onion") into {measure, name}.
export function parseIngredientLine(line) {
  const text = String(line || '').replace(/[\u200b\ufeff]/g, '').replace(/^[-•*▢☐✓·]\s*/, '').replace(/\s+/g, ' ').trim();
  // Quantity at the end: "Chicken breast, 800g" / "Greek yogurt - 0.75 cup".
  const tail = /^(.+?)\s*[,:–-]\s*((?:[\d½¼¾⅓⅔⅛][\d\s./½¼¾⅓⅔⅛]*)\s*(?:[a-z]+\.?)?(?:\s+[a-z]+)?)$/i.exec(text);
  if (tail && parseMeasure(tail[2]).qty != null && (parseMeasure(tail[2]).unit || /^\S+$/.test(tail[2].trim()))) {
    return { measure: tail[2].trim(), name: tail[1].trim() };
  }
  if (/^\d+\s*%/.test(text)) return { measure: '', name: text }; // "0% Greek yogurt" is not a quantity
  const m = /^((?:[\d½¼¾⅓⅔⅛⅜⅝⅞⅕][\d\s./,½¼¾⅓⅔⅛⅜⅝⅞⅕-]*)(?:\s*x\s*\d+\s*\w+)?)\s*(.*)$/i.exec(text);
  if (!m) return { measure: '', name: text };
  let rest = m[2];
  let measure = m[1].trim();
  const words = rest.split(' ');
  let used = 0;
  while (used < words.length && SIZE_WORDS.has(words[used].toLowerCase())) used++;
  // Up to two unit words, e.g. "400g can chopped tomatoes".
  for (let n = 0; n < 2 && UNITS[(words[used] || '').toLowerCase().replace(/[.,]$/, '')]; n++) used++;
  if (used) {
    measure = `${measure} ${words.slice(0, used).join(' ')}`;
    rest = words.slice(used).join(' ');
  }
  rest = rest.replace(/^\([^)]*\)\s*/, '').replace(/^of\s+/i, ''); // "1.5 lbs (680 grams) steak"
  return { measure, name: rest || text };
}

const STRIP_WORDS = /\b(fresh|freshly|chopped|finely|roughly|diced|minced|sliced|grated|crushed|ground|large|medium|small|boneless|skinless|organic|peeled|thinly|to taste|optional|for serving|for garnish)\b/g;

const SINGULAR_EXCEPTIONS = new Set(['asparagus', 'hummus', 'couscous', 'molasses', 'swiss', 'grass', 'citrus', 'octopus', 'peas', 'oats', 'lentils', 'chickpeas', 'noodles', 'brussels', 'greens', 'sprouts', 'oats', 'leaves', 'chives']);

export function normalizeIngredientName(name) {
  let n = String(name || '').toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(',')[0]
    // The spice isn't the fresh root or leaf, so keep "ground" on these two.
    .replace(/\bground (ginger|coriander)\b/g, 'ground_$1')
    .replace(STRIP_WORDS, ' ')
    .replace(/\bground_/g, 'ground ')
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = n.split(' ');
  const last = words[words.length - 1] || '';
  if (!SINGULAR_EXCEPTIONS.has(last) && last.length > 3) {
    if (/(tomato|potato)es$/.test(last)) words[words.length - 1] = last.slice(0, -2);
    else if (/ies$/.test(last)) words[words.length - 1] = `${last.slice(0, -3)}y`;
    else if (/[^su]s$/.test(last)) words[words.length - 1] = last.slice(0, -1);
  }
  n = words.join(' ').trim();
  return n || String(name || '').toLowerCase().trim();
}

const AISLES = [
  ['Meat & Seafood', ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'goat', 'turkey', 'duck', 'bacon', 'ham', 'sausage', 'chorizo', 'steak', 'mince', 'veal', 'brisket', 'salmon', 'tuna', 'cod', 'haddock', 'fish', 'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'scallop', 'squid', 'anchov*', 'sardine', 'mackerel', 'trout', 'prosciutto', 'pancetta', 'salami', 'pepperoni', 'oxtail', 'gammon']],
  ['Dairy & Eggs', ['milk', 'cream', 'butter', 'cheese', 'parmesan', 'mozzarella', 'cheddar', 'feta', 'yogurt', 'yoghurt', 'egg', 'creme fraiche', 'ricotta', 'mascarpone', 'halloumi', 'paneer', 'ghee']],
  ['Produce', ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery', 'pepper', 'chilli', 'chili', 'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower', 'zucchini', 'courgette', 'aubergine', 'eggplant', 'mushroom', 'leek', 'shallot', 'scallion', 'spring onion', 'ginger', 'lemon', 'lime', 'orange', 'apple', 'banana', 'avocado', 'cucumber', 'squash', 'pumpkin', 'corn', 'pea', 'bean sprout', 'green bean', 'asparagus', 'basil', 'parsley', 'coriander', 'cilantro', 'mint', 'dill', 'thyme', 'rosemary', 'sage', 'chive', 'berr*', 'raspberr*', 'strawberr*', 'blueberr*', 'mango', 'pineapple', 'grape', 'radish', 'beetroot', 'sweet potato', 'fennel', 'lemongrass', 'herb', 'eggplant', 'salad', 'rocket', 'arugula']],
  ['Bakery', ['bread', 'bun', 'roll', 'baguette', 'tortilla', 'pita', 'naan', 'wrap', 'croissant', 'bagel', 'brioche']],
  ['Pasta, Rice & Grains', ['pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni', 'lasagne', 'lasagna', 'noodle', 'egg noodle', 'rice', 'rice noodle', 'couscous', 'quinoa', 'oats', 'barley', 'bulgur', 'polenta', 'semolina']],
  ['Canned & Jarred', ['tinned*', 'canned*', 'chopped tomato', 'passata', 'tomato puree', 'tomato paste', 'coconut milk', 'stock', 'broth', 'bouillon', 'chicken stock', 'beef stock', 'vegetable stock', 'chicken broth', 'beef broth', 'stock cube', 'tinned tomato', 'canned tomato', 'plum tomato', 'baked bean', 'kidney bean', 'black bean', 'bean', 'chickpea', 'lentil', 'olive', 'caper', 'pickle']],
  ['Spices & Seasonings', ['salt', 'black pepper', 'salt and pepper', 'garlic powder', 'onion powder', 'ginger powder', 'ground ginger', 'chilli flake', 'chili flake', 'red pepper flake', 'powder', 'cumin', 'paprika', 'turmeric', 'cinnamon', 'nutmeg', 'clove', 'cardamom', 'garam masala', 'curry', 'cayenne', 'chilli powder', 'chili powder', 'oregano', 'bay lea*', 'spice', 'seed', 'saffron', 'allspice', 'star anise', 'vanilla', 'seasoning']],
  ['Baking', ['flour', 'sugar', 'baking', 'yeast', 'cocoa', 'chocolate', 'cornstarch', 'cornflour', 'honey', 'syrup', 'gelatin', 'brown sugar', 'caster sugar', 'icing sugar', 'chocolate chip', 'baking powder']],
  ['Oils, Sauces & Condiments', ['oil', 'olive oil', 'vegetable oil', 'sesame oil', 'vinegar', 'fish sauce', 'oyster sauce', 'sauce', 'ketchup', 'mustard', 'mayonnaise', 'mayo', 'soy', 'paste', 'dressing', 'salsa', 'jam', 'worcestershire', 'sriracha', 'tahini', 'pesto']],
  ['Frozen', ['frozen*', 'ice cream', 'frozen pea']],
  ['Drinks', ['wine', 'beer', 'juice', 'rum', 'vodka', 'brandy', 'sherry', 'water', 'coffee', 'tea']],
  ['Nuts & Snacks', ['almond', 'cashew', 'walnut', 'pecan', 'peanut', 'pistachio', 'hazelnut', 'pine nut', 'peanut butter', 'raisin', 'sultana', 'nut', 'crisps', 'chips']],
];

export const AISLE_ORDER = [...AISLES.map(([a]) => a), 'Other'];

const SPICE_NAME = new RegExp([
  String.raw`\b(salt|seeds?|peppercorns?|seasoning|spice|rub|masala)$`,
  String.raw`\b(chili|chilli|red pepper|parsley|onion) flakes?$`,
  String.raw`\b(white|lemon|aleppo|cayenne) pepper$`,
  String.raw`^(ground (ginger|coriander)|granulated garlic|dried (minced )?onion)$`,
  String.raw`^dried (basil|parsley|cilantro|mint|dill|thyme|rosemary|sage|chives?|marjoram|tarragon|oregano|lemongrass|lavender|chiles?|chilies|chipotle( peppers?)?)$`,
  String.raw`\b(sumac|fenugreek|mace|juniper|annatto|achiote|gochugaru|za'atar|zaatar|ras el hanout|berbere|furikake|togarashi|herbes de provence|msg|sazon|guajillo|ancho chiles?|chiles de arbol|marjoram|tarragon|savory)\b`,
].join('|'));

export function aisleFor(name) {
  // The longest matching phrase wins, so "olive oil" beats "olive" and
  // "coconut milk" beats "milk". Ties go to the earlier aisle.
  const n = String(name || '').toLowerCase();
  if (/^(pepper|salt|salt and pepper|salt & pepper)$/.test(n)) return 'Spices & Seasonings';
  // "Garlic salt", "celery seed", "lemon pepper", "dried thyme": what it ends in (or being a dried herb) decides,
  // not the longest word in it.
  if (SPICE_NAME.test(n)) return 'Spices & Seasonings';
  let best = 'Other';
  let bestLen = 0;
  for (const [aisle, words] of AISLES) {
    for (const w of words) {
      if (w.length > bestLen && containsWord(n, w)) {
        best = aisle;
        bestLen = w.length;
      }
    }
  }
  return best;
}

const NICE_FRACTIONS = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];

export function formatQty(qty, unit) {
  let q = qty;
  let u = unit;
  if (u === 'g' && q >= 1000) { q /= 1000; u = 'kg'; }
  if (u === 'ml' && q >= 1000) { q /= 1000; u = 'l'; }
  if (u === 'oz' && q >= 16) { q /= 16; u = 'lb'; }
  if (u === 'tsp' && q >= 3 && Math.abs(q / 3 - Math.round(q / 3)) < 0.01) { q /= 3; u = 'tbsp'; }
  let text;
  if (u === 'g' || u === 'ml') {
    text = String(Math.round(q / 5) * 5 || Math.round(q));
  } else if (u === 'kg' || u === 'l') {
    text = String(Math.round(q * 10) / 10);
  } else {
    const whole = Math.floor(q);
    const frac = q - whole;
    const nice = NICE_FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.04);
    if (frac < 0.04) text = String(whole || (q > 0 ? '<1' : 0));
    else if (frac > 0.96) text = String(whole + 1);
    else if (nice) text = whole ? `${whole} ${nice[1]}` : nice[1];
    else text = String(Math.round(q * 10) / 10);
  }
  const plural = q > 1 && ['cup', 'clove', 'can', 'slice', 'bunch', 'sprig', 'stick', 'pinch', 'pack', 'head', 'stalk', 'fillet', 'piece', 'handful', 'pint', 'quart'].includes(u);
  const unitText = u ? ` ${u}${plural ? (u.endsWith('ch') || u.endsWith('sh') ? 'es' : 's') : ''}` : '';
  return `${text}${unitText}`;
}

/**
 * Build the grocery list for a week.
 * @param slots   [{recipeId, day, meal}]
 * @param recipes Map id -> recipe
 * @param householdSize people to cook for (scales ingredient quantities)
 */
export function buildGroceryList(slots, recipes, householdSize = 4) {
  const items = new Map();
  for (const slot of slots) {
    const recipe = slot.recipeId && recipes.get(slot.recipeId);
    if (!recipe) continue;
    const scale = householdSize / (recipe.servings || 4);
    for (const ing of recipe.ingredients) {
      const key = normalizeIngredientName(ing.name);
      if (!key) continue;
      let item = items.get(key);
      if (!item) {
        const display = ing.name.replace(/\(.*?\)/g, '').split(',')[0].replace(/\s+/g, ' ').trim() || ing.name.trim();
        item = { key, name: display, aisle: aisleFor(key), totals: {}, notes: new Set(), recipes: new Set() };
        items.set(key, item);
      }
      item.recipes.add(recipe.name);
      const { qty, unit, note } = parseMeasure(ing.measure);
      if (qty != null && qty > 0) {
        item.totals[unit] = (item.totals[unit] || 0) + qty * scale;
      } else if (note) {
        item.notes.add(note.toLowerCase());
      }
    }
  }
  const list = [...items.values()].map((i) => {
    const amounts = Object.entries(i.totals).map(([u, q]) => formatQty(q, u));
    const notes = [...i.notes].filter((n) => !amounts.length || !/^(to taste|as needed|as required|garnish|to serve|for frying|drizzle|splash|dash|pinch)$/.test(n));
    return {
      key: i.key,
      name: i.name.charAt(0).toUpperCase() + i.name.slice(1),
      aisle: i.aisle,
      amount: [...amounts, ...notes].join(' + '),
      recipes: [...i.recipes],
      totals: i.totals,
    };
  });
  list.sort((a, b) => AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) || a.name.localeCompare(b.name));
  return list;
}
