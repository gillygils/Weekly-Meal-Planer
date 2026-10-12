// Common US pantry items (no brands) for type-ahead suggestions and the
// "browse the list" screen. Each entry is "name|other name|other name": the
// first is what gets saved, the rest only help it come up while typing.
// Shared with the browser, so this file has no imports.

const GROUPS = [
  ['Spices', 'spices', [
    'allspice', 'anise seed', 'annatto|achiote', 'caraway seeds|caraway', 'cardamom|cardamon', 'celery seed', 'celery salt',
    'chili powder|chile powder', 'chipotle powder|chipotle chili powder', 'cinnamon|ground cinnamon', 'cinnamon sticks',
    'cloves|ground cloves', 'whole cloves', 'ground coriander|coriander', 'coriander seeds', 'cumin|ground cumin', 'cumin seeds',
    'curry powder', 'fennel seeds|fennel seed', 'fenugreek', 'garlic powder', 'granulated garlic', 'garlic salt', 'ground ginger|ginger',
    'juniper berries', 'mace', 'mustard powder|dry mustard|ground mustard', 'mustard seeds|yellow mustard seed|brown mustard seed',
    'nutmeg|ground nutmeg', 'whole nutmeg', 'onion powder', 'dried minced onion|minced onion|onion flakes', 'onion salt',
    'paprika|sweet paprika', 'smoked paprika|pimenton', 'hot paprika', 'poppy seeds', 'saffron', 'sesame seeds|white sesame seeds',
    'black sesame seeds', 'star anise', 'sumac', 'turmeric|ground turmeric', 'vanilla bean', 'pumpkin pie spice', 'apple pie spice',
    'cayenne pepper|cayenne|ground red pepper', 'red pepper flakes|crushed red pepper|chili flakes|chilli flakes',
    'ancho chili powder|ancho powder', 'guajillo chiles|dried guajillo', 'ancho chiles|dried ancho', 'chiles de arbol|arbol chiles',
    'dried chipotle peppers', 'aleppo pepper', 'gochugaru|korean chili flakes', 'kashmiri chili powder',
    'white pepper', 'pink peppercorns', 'szechuan peppercorns|sichuan peppercorns', 'lemon pepper', 'msg|monosodium glutamate',
  ]],
  ['Dried herbs', 'spices', [
    'dried basil|basil leaves', 'bay leaves|bay leaf', 'dried chives', 'dried cilantro', 'dried dill|dill weed', 'dried marjoram|marjoram',
    'dried mint', 'dried oregano|oregano', 'mexican oregano', 'dried parsley|parsley flakes', 'dried rosemary|rosemary',
    'dried sage|rubbed sage|ground sage', 'dried tarragon|tarragon', 'dried thyme|thyme leaves', 'herbes de provence',
    'dried lavender', 'dried lemongrass', 'kaffir lime leaves|makrut lime leaves', 'savory|summer savory',
  ]],
  ['Seasoning blends', 'spices', [
    'italian seasoning', 'taco seasoning', 'fajita seasoning', 'cajun seasoning', 'creole seasoning', 'seafood seasoning|old bay seasoning',
    'poultry seasoning', 'steak seasoning|montreal steak seasoning', 'chicken seasoning', 'everything bagel seasoning',
    'garam masala', 'chinese five spice|five spice powder', 'jerk seasoning', 'ranch seasoning|ranch mix', 'adobo seasoning',
    'sazon', 'za\'atar|zaatar', 'ras el hanout', 'berbere', 'tandoori masala', 'chaat masala', 'shichimi togarashi|togarashi',
    'furikake', 'greek seasoning', 'lemon herb seasoning', 'seasoned salt|season salt', 'bbq rub|dry rub', 'blackening seasoning',
    'pizza seasoning', 'chili seasoning', 'onion soup mix', 'italian dressing mix', 'gravy mix', 'brown gravy mix',
  ]],
  ['Salt & pepper', 'spices', [
    'salt|table salt', 'kosher salt', 'sea salt', 'flaky sea salt|maldon salt|finishing salt', 'himalayan pink salt|pink salt',
    'black pepper|ground black pepper|pepper', 'black peppercorns|peppercorns', 'smoked salt', 'truffle salt',
  ]],
  ['Oils & cooking fats', 'pantry', [
    'olive oil', 'extra virgin olive oil|evoo', 'light olive oil', 'vegetable oil', 'canola oil', 'avocado oil', 'coconut oil',
    'peanut oil', 'sesame oil|toasted sesame oil', 'sunflower oil', 'grapeseed oil', 'corn oil', 'safflower oil', 'chili oil|chili crisp',
    'truffle oil', 'cooking spray|nonstick spray|pam', 'shortening|vegetable shortening|crisco', 'lard', 'bacon grease|bacon fat',
    'beef tallow|tallow', 'duck fat',
  ]],
  ['Butter & dairy', 'fridge', [
    'butter', 'salted butter', 'unsalted butter', 'european butter|cultured butter', 'whipped butter', 'plant butter|vegan butter',
    'margarine', 'ghee|clarified butter', 'milk|whole milk', '2% milk', 'skim milk', 'half and half|half & half', 'heavy cream|heavy whipping cream',
    'buttermilk', 'sour cream', 'cream cheese', 'plain yogurt', 'greek yogurt', 'eggs', 'parmesan cheese|parmesan', 'shredded mozzarella|mozzarella',
    'shredded cheddar|cheddar cheese|cheddar', 'monterey jack', 'pepper jack', 'swiss cheese', 'provolone', 'feta cheese|feta',
    'ricotta', 'cottage cheese', 'american cheese', 'almond milk', 'oat milk', 'coconut milk beverage',
  ]],
  ['Vinegars', 'pantry', [
    'white vinegar|distilled vinegar', 'apple cider vinegar|cider vinegar', 'red wine vinegar', 'white wine vinegar', 'balsamic vinegar',
    'balsamic glaze', 'rice vinegar|rice wine vinegar', 'seasoned rice vinegar', 'sherry vinegar', 'malt vinegar', 'champagne vinegar',
  ]],
  ['Sauces & condiments', 'pantry', [
    'ketchup', 'yellow mustard|mustard', 'dijon mustard', 'whole grain mustard', 'spicy brown mustard', 'honey mustard', 'mayonnaise|mayo',
    'hot sauce', 'sriracha', 'buffalo sauce|wing sauce', 'bbq sauce|barbecue sauce', 'worcestershire sauce', 'steak sauce',
    'soy sauce', 'low sodium soy sauce', 'tamari', 'coconut aminos', 'teriyaki sauce', 'hoisin sauce', 'oyster sauce', 'fish sauce',
    'sweet chili sauce', 'gochujang', 'miso paste|white miso', 'sambal oelek', 'chili garlic sauce', 'curry paste|red curry paste',
    'green curry paste', 'tahini', 'peanut butter', 'almond butter', 'salsa', 'salsa verde', 'enchilada sauce', 'pasta sauce|marinara|spaghetti sauce',
    'alfredo sauce', 'pesto', 'pizza sauce', 'tomato paste', 'tomato sauce', 'ranch dressing|ranch', 'italian dressing', 'caesar dressing',
    'blue cheese dressing', 'thousand island dressing', 'vinaigrette', 'relish|sweet relish', 'pickles|dill pickles', 'capers', 'olives|black olives',
    'kalamata olives', 'green olives', 'pepperoncini', 'jalapenos|pickled jalapenos', 'roasted red peppers', 'sun-dried tomatoes|sun dried tomatoes',
    'horseradish', 'tartar sauce', 'cocktail sauce', 'chipotle peppers in adobo|chipotles in adobo', 'liquid smoke', 'anchovy paste',
    'jam|jelly|preserves', 'maple syrup', 'pancake syrup',
  ]],
  ['Broths & stocks', 'pantry', [
    'chicken broth|chicken stock', 'beef broth|beef stock', 'vegetable broth|vegetable stock', 'bone broth', 'chicken bouillon|bouillon cubes',
    'beef bouillon', 'bouillon base|better than bouillon', 'cream of mushroom soup', 'cream of chicken soup', 'tomato soup',
  ]],
  ['Baking', 'pantry', [
    'all-purpose flour|flour|ap flour', 'bread flour', 'whole wheat flour', 'self-rising flour', 'cake flour', 'almond flour', 'cornmeal',
    'masa harina', 'cornstarch|corn starch', 'arrowroot', 'baking soda', 'baking powder', 'active dry yeast|yeast', 'instant yeast',
    'cream of tartar', 'vanilla extract|vanilla', 'almond extract', 'peppermint extract', 'lemon extract', 'cocoa powder|unsweetened cocoa',
    'chocolate chips|semi-sweet chocolate chips', 'white chocolate chips', 'baking chocolate', 'sprinkles', 'food coloring',
    'shredded coconut|coconut flakes', 'panko|panko breadcrumbs', 'breadcrumbs|bread crumbs|italian breadcrumbs', 'pancake mix|bisquick',
    'cake mix', 'brownie mix', 'gelatin|unflavored gelatin', 'powdered milk', 'evaporated milk', 'sweetened condensed milk',
  ]],
  ['Sweeteners', 'pantry', [
    'sugar|white sugar|granulated sugar', 'brown sugar|light brown sugar', 'dark brown sugar', 'powdered sugar|confectioners sugar|icing sugar',
    'honey', 'molasses', 'agave|agave nectar', 'corn syrup|light corn syrup', 'stevia', 'monk fruit sweetener', 'coconut sugar', 'turbinado sugar|raw sugar',
  ]],
  ['Rice, grains & pasta', 'pantry', [
    'white rice|long grain rice', 'brown rice', 'jasmine rice', 'basmati rice', 'arborio rice', 'sushi rice', 'wild rice', 'instant rice|minute rice',
    'quinoa', 'couscous', 'farro', 'barley|pearl barley', 'oats|rolled oats|old fashioned oats', 'quick oats', 'steel cut oats', 'grits',
    'spaghetti', 'penne', 'elbow macaroni|macaroni', 'rotini', 'fettuccine', 'linguine', 'angel hair', 'lasagna noodles', 'egg noodles',
    'orzo', 'shells|pasta shells', 'bow tie pasta|farfalle', 'rigatoni', 'ziti', 'ramen noodles|instant ramen', 'rice noodles',
    'udon noodles', 'soba noodles', 'lo mein noodles', 'flour tortillas', 'corn tortillas', 'taco shells', 'bread|sandwich bread',
    'hamburger buns', 'hot dog buns', 'pita', 'naan', 'crackers', 'tortilla chips',
  ]],
  ['Canned & jarred', 'pantry', [
    'diced tomatoes|canned tomatoes', 'crushed tomatoes', 'whole peeled tomatoes|san marzano tomatoes', 'fire-roasted tomatoes',
    'diced tomatoes and green chiles|rotel', 'green chiles|diced green chiles', 'black beans', 'pinto beans', 'kidney beans', 'cannellini beans',
    'great northern beans', 'chickpeas|garbanzo beans', 'refried beans', 'baked beans', 'lentils', 'split peas', 'corn|canned corn',
    'green beans', 'peas', 'coconut milk', 'coconut cream', 'pumpkin puree', 'tuna|canned tuna', 'canned chicken', 'salmon|canned salmon',
    'artichoke hearts', 'water chestnuts', 'bamboo shoots', 'mushrooms|canned mushrooms', 'pineapple|canned pineapple', 'mandarin oranges',
    'applesauce',
  ]],
  ['Nuts, seeds & dried fruit', 'pantry', [
    'almonds', 'sliced almonds', 'walnuts', 'pecans', 'cashews', 'peanuts', 'pine nuts', 'pistachios', 'sunflower seeds', 'pumpkin seeds|pepitas',
    'chia seeds', 'flax seeds|flaxseed', 'hemp seeds', 'raisins', 'dried cranberries|craisins', 'dates', 'dried apricots',
  ]],
  ['Fridge staples', 'fridge', [
    'garlic|fresh garlic', 'minced garlic|jarred garlic', 'ginger paste', 'lemon juice', 'lime juice', 'tofu',
    'bacon', 'deli ham', 'deli turkey', 'hot dogs', 'pepperoni', 'hummus', 'salsa fresca|pico de gallo',
  ]],
  ['Freezer staples', 'freezer', [
    'chicken breasts|frozen chicken breasts', 'chicken thighs', 'chicken tenders', 'ground beef', 'ground turkey', 'ground pork', 'italian sausage',
    'pork chops', 'pork tenderloin', 'steak', 'shrimp|frozen shrimp', 'salmon fillets', 'tilapia', 'cod', 'meatballs|frozen meatballs',
    'frozen peas', 'frozen corn', 'frozen broccoli', 'frozen mixed vegetables|mixed vegetables', 'frozen spinach', 'stir-fry vegetables',
    'frozen berries', 'frozen fries|french fries', 'tater tots', 'frozen pizza', 'pie crust', 'puff pastry', 'ice cream',
  ]],
];

const PLACE_OF_GROUP = Object.fromEntries(GROUPS.map(([g, place]) => [g, place]));

/** [{ name, also: [...], group, where }] */
export const PANTRY_CATALOG = GROUPS.flatMap(([group, where, items]) => items.map((entry) => {
  const [name, ...also] = entry.split('|');
  return { name, also, group, where };
}));

export const CATALOG_GROUPS = GROUPS.map(([g]) => g);
export const groupPlace = (g) => PLACE_OF_GROUP[g] || 'pantry';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%&' ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Suggestions for what's typed so far: names that start with it first, then
 * names with a word that starts with it, then other names (e.g. "evoo").
 * Things already in the pantry (`have`, lowercase names) are left out.
 */
export function suggestPantry(query, { have = new Set(), limit = 8 } = {}) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const item of PANTRY_CATALOG) {
    if (have.has(item.name)) continue;
    let best = Infinity;
    for (const [i, label] of [item.name, ...item.also].entries()) {
      const l = norm(label);
      const rank = l.startsWith(q) ? 0 : l.split(' ').some((w) => w.startsWith(q)) ? 1 : l.includes(q) ? 2 : Infinity;
      // Other names count slightly less, so "pepper" puts "black pepper" before "white pepper" etc. by name.
      if (rank < Infinity) best = Math.min(best, rank * 2 + (i ? 1 : 0));
    }
    if (best < Infinity) scored.push([best, item.name.length, item]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].name.localeCompare(b[2].name));
  return scored.slice(0, limit).map(([, , item]) => item);
}
