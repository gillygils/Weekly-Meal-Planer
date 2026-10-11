// Recipe normalization helpers: protein detection, meal-type mapping and
// rough cost estimation. Shared by the seed script and the server.

export const PROTEINS = [
  'chicken', 'beef', 'pork', 'lamb', 'goat', 'turkey', 'duck',
  'fish', 'shellfish', 'egg', 'tofu', 'legumes',
];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

// Word patterns per protein. `not` lists phrases that look like a match but aren't.
const PROTEIN_RULES = {
  chicken: { words: ['chicken'], not: ['chicken stock', 'chicken broth', 'chicken bouillon', 'chicken stock cube'] },
  beef: { words: ['beef', 'steak', 'brisket', 'veal', 'oxtail', 'minced meat', 'mince', 'sirloin', 'ribeye', 'meatball'], not: ['beef stock', 'beef broth', 'beef bouillon', 'beef stock cube', 'beef gravy', 'pork mince', 'lamb mince', 'turkey mince', 'chicken mince', 'tuna steak', 'salmon steak'] },
  pork: { words: ['pork', 'bacon', 'ham', 'sausage', 'chorizo', 'prosciutto', 'pancetta', 'salami', 'pepperoni', 'lardons', 'gammon', 'spare ribs'], not: ['chicken sausage', 'turkey sausage', 'vegetarian sausage', 'turkey bacon', 'hamburger bun', 'graham'] },
  lamb: { words: ['lamb', 'mutton'], not: ["lamb's lettuce"] },
  goat: { words: ['goat'], not: ['goat cheese', 'goats cheese', "goat's cheese", 'goat milk'] },
  turkey: { words: ['turkey'], not: [] },
  duck: { words: ['duck'], not: ['duck sauce'] },
  fish: { words: ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'mackerel', 'sardine', 'anchov*', 'tilapia', 'trout', 'sea bass', 'seabass', 'halibut', 'swordfish', 'monkfish', 'snapper', 'herring', 'pilchard', 'kipper', 'pollock', 'catfish', 'sole', 'plaice', 'bream'], not: ['fish sauce', 'fishcake sauce', 'worcestershire'] },
  shellfish: { words: ['shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'clam', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'crayfish', 'langoustine'], not: ['oyster sauce', 'oyster mushroom', 'crab apple'] },
  egg: { words: ['egg'], not: ['eggplant', 'egg noodle', 'egg roll wrapper'] },
  tofu: { words: ['tofu', 'tempeh', 'seitan'], not: [] },
  legumes: { words: ['lentil', 'chickpea', 'black bean', 'kidney bean', 'cannellini', 'pinto bean', 'butter bean', 'borlotti', 'haricot', 'garbanzo', 'split pea', 'edamame', 'baked beans', 'refried beans'], not: [] },
};

const CATEGORY_PROTEIN = {
  beef: 'beef', chicken: 'chicken', pork: 'pork', lamb: 'lamb', goat: 'goat', seafood: 'fish',
};

const MAIN_PRIORITY = ['beef', 'chicken', 'pork', 'lamb', 'goat', 'turkey', 'duck', 'fish', 'shellfish', 'tofu', 'legumes', 'egg'];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word match allowing plurals ("egg" matches "eggs" but not "eggplant").
// A trailing "*" makes it a prefix match ("anchov*" matches "anchovies").
export function containsWord(text, word) {
  const stem = word.endsWith('*');
  const w = escapeRe(stem ? word.slice(0, -1) : word);
  return new RegExp(`(^|[^a-z])${w}${stem ? '' : '(s|es)?([^a-z]|$)'}`, 'i').test(text);
}

export function detectProteins(ingredientNames, category = '', recipeName = '') {
  const found = new Set();
  const texts = [...ingredientNames, recipeName].map((t) => String(t || '').toLowerCase());
  for (const [protein, rule] of Object.entries(PROTEIN_RULES)) {
    for (const raw of texts) {
      let text = raw;
      for (const n of rule.not) text = text.split(n).join(' ');
      if (rule.words.some((w) => containsWord(text, w))) {
        found.add(protein);
        break;
      }
    }
  }
  const cat = String(category || '').toLowerCase();
  if (CATEGORY_PROTEIN[cat]) found.add(CATEGORY_PROTEIN[cat]);
  // "Seafood" category with only shellfish detected shouldn't force fish.
  if (cat === 'seafood' && found.has('shellfish') && !hasFishIngredient(texts)) found.delete('fish');
  return MAIN_PRIORITY.filter((p) => found.has(p));
}

function hasFishIngredient(texts) {
  const rule = PROTEIN_RULES.fish;
  return texts.some((raw) => {
    let text = raw;
    for (const n of rule.not) text = text.split(n).join(' ');
    return rule.words.some((w) => containsWord(text, w));
  });
}

export function mainProtein(proteins, category = '') {
  const cat = String(category || '').toLowerCase();
  if (CATEGORY_PROTEIN[cat] && proteins.includes(CATEGORY_PROTEIN[cat])) return CATEGORY_PROTEIN[cat];
  if (cat === 'seafood' && proteins.includes('shellfish')) return 'shellfish';
  const meaty = proteins.filter((p) => p !== 'egg');
  if (meaty.length) return meaty[0];
  if (proteins.includes('egg')) return 'egg';
  return 'vegetarian';
}

const DESSERT_NAME = /\b(cake|cakes|cupcakes?|cookies?|brownies?|muffins?|cheesecake|fudge|crumble|mousse|pavlova|trifle|sorbet|ice cream|flapjacks?|macarons?|tiramisu|smoothie|milkshake|lemonade)\b/i;

export function mealTypesFor(category = '', hints = [], name = '') {
  const all = [category, ...hints].map((c) => String(c || '').toLowerCase());
  if (all.some((c) => c.includes('dessert') || c.includes('beverage') || c.includes('drink'))) return [];
  if (DESSERT_NAME.test(name)) return [];
  if (all.some((c) => c.includes('breakfast') || c.includes('brunch'))) return ['breakfast'];
  if (all.some((c) => ['side', 'side dish', 'starter', 'appetizer', 'snack'].includes(c))) return ['lunch'];
  if (all.some((c) => c === 'lunch') && !all.some((c) => c === 'dinner')) return ['lunch', 'dinner'];
  return ['lunch', 'dinner'];
}

// Rough USD cost of the amount of each ingredient a typical 4-serving recipe uses.
// Intentionally simple: it's an estimate to steer the randomizer, editable per recipe.
const COST_TABLE = [
  [['saffron'], 4],
  [['lobster'], 18], [['steak', 'sirloin', 'ribeye', 'fillet of beef', 'beef fillet', 'tenderloin'], 14],
  [['lamb', 'mutton', 'goat'], 11], [['duck'], 11], [['veal'], 12],
  [['scallop', 'crab', 'langoustine'], 12], [['shrimp', 'prawn', 'squid', 'calamari', 'octopus', 'mussel', 'clam', 'oyster'], 9],
  [['salmon', 'halibut', 'swordfish', 'sea bass', 'monkfish', 'trout', 'snapper', 'tuna steak'], 11],
  [['cod', 'haddock', 'tilapia', 'pollock', 'fish', 'mackerel', 'sole', 'plaice', 'catfish'], 8],
  [['beef', 'brisket', 'oxtail', 'mince'], 8], [['pork', 'gammon', 'ham'], 6], [['chicken'], 6], [['turkey'], 7],
  [['bacon', 'chorizo', 'pancetta', 'prosciutto', 'salami', 'sausage', 'pepperoni', 'lardons'], 4],
  [['tuna', 'sardine', 'anchov*', 'pilchard'], 2.5],
  [['parmesan', 'parmigiano', 'gruyere', 'feta', 'mozzarella', 'cheddar', 'cheese', 'halloumi', 'ricotta', 'mascarpone', 'paneer'], 3],
  [['cream', 'creme fraiche', 'crème fraîche', 'sour cream', 'yogurt', 'yoghurt'], 1.8],
  [['butter'], 0.8], [['milk'], 0.8], [['egg'], 1.2],
  [['tofu', 'tempeh', 'seitan'], 2.5],
  [['pine nut', 'cashew', 'almond', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'peanut'], 2],
  [['wine', 'sherry', 'brandy', 'rum', 'beer', 'vodka', 'whisky', 'cognac', 'port'], 2.5],
  [['avocado', 'mushroom', 'asparagus', 'berries', 'raspberr*', 'strawberr*', 'blueberr*', 'mango'], 2],
  [['rice', 'pasta', 'spaghetti', 'noodle', 'couscous', 'quinoa', 'lentil', 'chickpea', 'bean', 'potato', 'bread', 'tortilla', 'flour', 'oats', 'polenta'], 1],
  [['tomato', 'pepper', 'zucchini', 'courgette', 'aubergine', 'eggplant', 'spinach', 'broccoli', 'cauliflower', 'cabbage', 'kale', 'lettuce', 'cucumber', 'carrot', 'celery', 'leek', 'squash', 'pumpkin', 'corn', 'peas', 'green bean', 'apple', 'lemon', 'lime', 'orange', 'banana'], 0.9],
  [['onion', 'shallot', 'garlic', 'ginger', 'chilli', 'chili', 'scallion', 'spring onion'], 0.4],
  [['stock', 'broth', 'bouillon'], 0.8],
  [['coconut milk', 'coconut cream', 'passata', 'tinned tomato', 'chopped tomato', 'tomato puree', 'tomato paste'], 1],
  [['basil', 'parsley', 'coriander', 'cilantro', 'mint', 'dill', 'thyme', 'rosemary', 'sage', 'oregano', 'tarragon', 'chives'], 0.6],
  [['salt', 'pepper', 'water', 'ice'], 0.05],
  [['oil', 'vinegar', 'sugar', 'honey', 'soy sauce', 'sauce', 'mustard', 'ketchup', 'mayonnaise', 'paste'], 0.4],
  [['cumin', 'paprika', 'turmeric', 'cinnamon', 'nutmeg', 'clove', 'cardamom', 'coriander seed', 'garam masala', 'curry powder', 'chilli powder', 'cayenne', 'bay lea*', 'spice', 'seed', 'powder', 'baking', 'yeast', 'vanilla', 'extract'], 0.25],
];

export function estimateIngredientCost(name) {
  const n = String(name || '').toLowerCase();
  if (/^(salt|black pepper|pepper|water|ice)\b/.test(n)) return 0.05;
  for (const [words, cost] of COST_TABLE) {
    if (words.some((w) => containsWord(n, w))) return cost;
  }
  return 0.7;
}

export function estimateCostPerServing(ingredients, servings = 4) {
  const total = ingredients.reduce((sum, i) => sum + estimateIngredientCost(i.name), 0);
  const perServing = total / Math.max(1, servings || 4);
  return Math.round(Math.max(0.75, perServing) * 100) / 100;
}

export function cleanText(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitInstructions(text) {
  return String(text || '')
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter((l) => l && !/^step\s*\d*$/i.test(l));
}

// Finalize a recipe object: fill derived fields consistently.
export function finalizeRecipe(r) {
  const ingredients = (r.ingredients || [])
    .map((i) => ({ name: cleanText(i.name), measure: cleanText(i.measure) }))
    .filter((i) => i.name);
  const servings = Number(r.servings) > 0 ? Math.round(Number(r.servings)) : 4;
  const proteins = detectProteins(ingredients.map((i) => i.name), r.category, r.name);
  return {
    id: r.id,
    source: r.source,
    sourceUrl: r.sourceUrl || '',
    name: cleanText(r.name),
    category: r.category || '',
    cuisine: r.cuisine || '',
    image: r.image || '',
    servings,
    totalMinutes: Number(r.totalMinutes) > 0 ? Math.round(Number(r.totalMinutes)) : null,
    tags: (r.tags || []).filter(Boolean),
    ingredients,
    instructions: (r.instructions || []).map(cleanText).filter(Boolean),
    proteins,
    mainProtein: mainProtein(proteins, r.category),
    mealTypes: r.mealTypes || mealTypesFor(r.category, r.tags, r.name),
    estimatedCost: estimateCostPerServing(ingredients, servings),
    costOverride: null,
    favorite: false,
    addedAt: r.addedAt || new Date().toISOString(),
    reportedNutrition: r.reportedNutrition || null,
    servingsEstimated: Boolean(r.servingsEstimated),
    creator: r.creator || '',
  };
}

export function recipeCost(r) {
  return r.costOverride ?? r.estimatedCost;
}

// ---------- Allergies & dislikes ----------

// Allergen groups are stricter than "proteins to avoid": they also catch
// hidden sources like fish sauce, butter or soy sauce (which contains wheat).
export const ALLERGEN_GROUPS = {
  peanuts: { label: 'Peanuts', words: ['peanut', 'groundnut', 'satay'], not: [] },
  treenuts: { label: 'Tree nuts', words: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pine nut', 'brazil nut', 'chestnut', 'praline', 'marzipan', 'nutella', 'frangipane'], not: ['water chestnut'] },
  dairy: { label: 'Dairy', words: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'ghee', 'creme fraiche', 'crème fraîche', 'mascarpone', 'ricotta', 'parmesan', 'parmigiano', 'mozzarella', 'cheddar', 'feta', 'paneer', 'buttermilk', 'custard', 'whey', 'halloumi', 'gruyere', 'gruyère', 'brie', 'camembert', 'quark', 'kefir', 'condensed milk', 'evaporated milk', 'ice cream'], not: ['coconut milk', 'coconut cream', 'almond milk', 'oat milk', 'soy milk', 'soya milk', 'rice milk', 'peanut butter', 'almond butter', 'cashew butter', 'nut butter', 'butter bean', 'butternut', 'cream of tartar', 'vegan cheese', 'dairy-free', 'cocoa butter', 'butterfly', 'butterhead'] },
  gluten: { label: 'Gluten / wheat', words: ['flour', 'bread', 'breadcrumb', 'panko', 'pasta', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'tagliatelle', 'macaroni', 'lasagne', 'lasagna', 'noodle', 'couscous', 'wheat', 'barley', 'rye', 'semolina', 'bulgur', 'bulghur', 'seitan', 'pastry', 'pizza dough', 'dough', 'tortilla', 'pita', 'naan', 'bun', 'baguette', 'brioche', 'croissant', 'cracker', 'biscuit', 'crouton', 'soy sauce', 'beer', 'malt', 'farro', 'spelt', 'orzo', 'gnocchi', 'udon', 'ramen', 'filo', 'phyllo', 'wonton', 'dumpling wrapper'], not: ['rice flour', 'corn flour', 'cornflour', 'almond flour', 'coconut flour', 'chickpea flour', 'gram flour', 'buckwheat flour', 'potato flour', 'tapioca flour', 'gluten-free', 'gluten free', 'rice noodle', 'glass noodle', 'rice vermicelli', 'corn tortilla', 'buckwheat', 'tamari'] },
  eggs: { label: 'Eggs', words: ['egg', 'mayonnaise', 'mayo', 'meringue', 'aioli'], not: ['eggplant', 'egg replacer', 'vegan mayo'] },
  soy: { label: 'Soy', words: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari', 'soybean'], not: [] },
  sesame: { label: 'Sesame', words: ['sesame', 'tahini', 'halva', 'halvah', 'za\'atar', 'zaatar'], not: [] },
  fish: { label: 'Fish', words: [...PROTEIN_RULES.fish.words, 'fish sauce', 'worcestershire', 'caesar dressing', 'dashi', 'bonito'], not: [] },
  shellfish: { label: 'Shellfish', words: [...PROTEIN_RULES.shellfish.words, 'oyster sauce', 'shrimp paste', 'prawn cracker'], not: ['oyster mushroom', 'crab apple'] },
  mustard: { label: 'Mustard', words: ['mustard'], not: [] },
  celery: { label: 'Celery', words: ['celery', 'celeriac'], not: [] },
};

// Common alternative names, so "cilantro" also catches "coriander", etc.
const SYNONYMS = [
  ['cilantro', 'coriander'], ['eggplant', 'aubergine'], ['zucchini', 'courgette'], ['shrimp', 'prawn'],
  ['scallion', 'spring onion', 'green onion'], ['bell pepper', 'capsicum'], ['arugula', 'rocket'],
  ['chickpea', 'garbanzo'], ['chili', 'chilli', 'chile'], ['ground beef', 'minced beef', 'beef mince'],
];

function singular(t) {
  if (/ies$/.test(t)) return `${t.slice(0, -3)}*`; // berries -> berr* (berry, berries)
  if (/oes$/.test(t)) return t.slice(0, -2); // tomatoes -> tomato
  if (/[^s]s$/.test(t) && t.length > 3) return t.slice(0, -1); // mushrooms -> mushroom
  return t;
}

function expandTerm(term) {
  const t = term.toLowerCase().trim().replace(/\s+/g, ' ');
  const base = singular(t);
  const group = SYNONYMS.find((g) => g.includes(t) || g.includes(base));
  return group || [base];
}

/**
 * Build a function that returns which avoided things (allergen labels or
 * custom ingredients) appear in a list of ingredient names.
 */
export function createAvoidMatcher(settings = {}) {
  const rules = [];
  for (const key of settings.avoidAllergens || []) {
    const g = ALLERGEN_GROUPS[key];
    if (g) rules.push({ label: g.label, words: g.words, not: g.not });
  }
  for (const term of settings.avoidIngredients || []) {
    if (term && term.trim()) rules.push({ label: term.trim(), words: expandTerm(term), not: [] });
  }
  if (!rules.length) return () => [];
  return (names) => {
    const hits = [];
    const texts = names.map((n) => String(n || '').toLowerCase());
    for (const rule of rules) {
      const hit = texts.some((raw) => {
        let text = raw;
        for (const n of rule.not) text = text.split(n).join(' ');
        return rule.words.some((w) => containsWord(text, w));
      });
      if (hit) hits.push(rule.label);
    }
    return hits;
  };
}
