// Ingredient reference data: nutrition, unit weights and typical US prices.
// Used to estimate each recipe's macros and each grocery item's cost.
//
// Nutrition is per 100 g (roughly USDA FoodData Central values, raw unless noted).
// Prices are rough US supermarket averages; they're estimates, and every price
// can be replaced with a real one in the app's price book.
//
// Entry: [match words, kcal, protein, carbs, fat, fiber, options]
// options:
//   cup   grams per US cup (for volume -> weight); default 240 (water-like)
//   each  grams per item (for counts like "2 onions")
//   buy   [size, unit, price, label]: how it's sold. unit is 'g', 'ml' or 'each'.
//   loose true when sold by weight (pay for exactly what you need, e.g. meat)
//   pantry true for staples most kitchens already have (spices, oil, sauces)

const LB = 453.6;

const DB = [
  // ---- Meat & poultry ----
  [['chicken breast', 'chicken breasts', 'chicken fillet', 'chicken tender', 'chicken'], 120, 22.5, 0, 2.6, 0, { each: 200, buy: [LB, 'g', 4.2, 'per lb'], loose: true }],
  [['chicken thigh', 'chicken thighs', 'chicken leg', 'chicken drumstick', 'chicken wing', 'whole chicken'], 177, 19.7, 0, 10.9, 0, { each: 120, buy: [LB, 'g', 3.3, 'per lb'], loose: true }],
  [['ground beef', 'minced beef', 'beef mince', 'mince', 'minced meat', 'hamburger'], 254, 17.2, 0, 20, 0, { buy: [LB, 'g', 5.7, 'per lb'], loose: true }],
  [['lean ground beef', 'lean beef mince', 'extra lean'], 176, 20, 0, 10, 0, { buy: [LB, 'g', 6.8, 'per lb'], loose: true }],
  [['beef', 'stewing beef', 'braising steak', 'chuck', 'brisket', 'beef shin', 'oxtail', 'short rib'], 220, 19, 0, 15, 0, { buy: [LB, 'g', 7.5, 'per lb'], loose: true }],
  [['steak', 'sirloin', 'ribeye', 'rib eye', 'flank steak', 'skirt steak', 'beef fillet', 'tenderloin', 'flat iron'], 190, 21, 0, 11, 0, { each: 250, buy: [LB, 'g', 11.5, 'per lb'], loose: true }],
  [['pork', 'pork loin', 'pork chop', 'pork shoulder', 'pork belly', 'pork tenderloin', 'ground pork', 'pork mince'], 220, 18.5, 0, 15.5, 0, { each: 180, buy: [LB, 'g', 4.3, 'per lb'], loose: true }],
  [['bacon', 'streaky bacon', 'back bacon', 'lardons', 'pancetta'], 417, 13, 1.4, 40, 0, { each: 15, buy: [340, 'g', 6.5, '12 oz pack'] }],
  [['ham', 'gammon', 'prosciutto'], 145, 21, 1.5, 6, 0, { each: 25, buy: [227, 'g', 4.5, '8 oz pack'] }],
  [['sausage', 'sausages', 'chorizo', 'italian sausage', 'kielbasa', 'bratwurst'], 300, 13, 2.5, 26, 0, { each: 75, buy: [LB, 'g', 5.2, '1 lb pack'] }],
  [['chicken sausage', 'turkey sausage'], 170, 16, 3, 10, 0, { each: 75, buy: [340, 'g', 5.5, '12 oz pack'] }],
  [['salami', 'pepperoni'], 400, 22, 1, 34, 0, { buy: [170, 'g', 4.5, '6 oz pack'] }],
  [['lamb', 'lamb shoulder', 'lamb leg', 'lamb chop', 'ground lamb', 'lamb mince', 'mutton', 'goat'], 282, 16.6, 0, 23.4, 0, { each: 150, buy: [LB, 'g', 10, 'per lb'], loose: true }],
  [['turkey', 'turkey breast'], 115, 23.7, 0, 1.5, 0, { buy: [LB, 'g', 6, 'per lb'], loose: true }],
  [['ground turkey', 'turkey mince'], 150, 19.7, 0, 8.3, 0, { buy: [LB, 'g', 4.8, '1 lb pack'] }],
  [['duck', 'duck breast'], 200, 19, 0, 13, 0, { each: 200, buy: [LB, 'g', 9, 'per lb'], loose: true }],
  [['veal'], 150, 20, 0, 7, 0, { buy: [LB, 'g', 14, 'per lb'], loose: true }],
  [['meatball', 'meatballs'], 240, 15, 8, 16, 0.5, { each: 30, buy: [LB, 'g', 6, '1 lb pack'] }],

  // ---- Fish & seafood ----
  [['salmon', 'salmon fillet', 'smoked salmon'], 208, 20, 0, 13, 0, { each: 170, buy: [LB, 'g', 11, 'per lb'], loose: true }],
  [['cod', 'haddock', 'white fish', 'pollock', 'tilapia', 'hake', 'sea bass', 'snapper', 'halibut', 'fish', 'fish fillet', 'catfish', 'sole', 'plaice', 'trout', 'mackerel'], 90, 19, 0, 1, 0, { each: 150, buy: [LB, 'g', 9, 'per lb'], loose: true }],
  [['tuna', 'canned tuna', 'tinned tuna', 'tuna steak'], 116, 25.5, 0, 1, 0, { each: 140, buy: [142, 'g', 1.6, '5 oz can'] }],
  [['shrimp', 'prawn', 'prawns', 'king prawn'], 85, 20, 0, 0.5, 0, { each: 12, buy: [LB, 'g', 9.5, '1 lb bag'] }],
  [['scallop', 'crab', 'lobster', 'mussel', 'clam', 'squid', 'calamari', 'octopus'], 90, 16, 3, 1, 0, { buy: [LB, 'g', 13, 'per lb'], loose: true }],
  [['anchovy', 'anchovies'], 210, 25, 0, 11, 0, { each: 4, canG: 56, buy: [56, 'g', 2.5, '2 oz tin'], pantry: true }],
  [['sardine', 'sardines', 'canned sardines'], 208, 24.6, 0, 11.5, 0, { each: 25, canG: 106, buy: [106, 'g', 1.8, '3.75 oz can'] }],

  // ---- Dairy & eggs ----
  [['egg', 'eggs'], 143, 12.6, 0.7, 9.5, 0, { each: 50, cup: 243, buy: [12, 'each', 3.4, 'dozen'] }],
  [['egg white', 'egg whites', 'liquid egg white'], 52, 10.9, 0.7, 0.2, 0, { each: 33, cup: 243, buy: [454, 'ml', 4, '16 oz carton'] }],
  [['milk', 'whole milk', 'skimmed milk', 'semi-skimmed milk', '2% milk'], 50, 3.4, 4.9, 2, 0, { cup: 244, buy: [3785, 'ml', 4, 'gallon'] }],
  [['almond milk', 'oat milk', 'soy milk', 'soya milk'], 25, 0.7, 2, 1.2, 0.3, { cup: 240, buy: [1890, 'ml', 3.5, 'half gallon'] }],
  [['butter', 'unsalted butter', 'salted butter'], 717, 0.9, 0.1, 81, 0, { cup: 227, each: 113, buy: [454, 'g', 5, '1 lb'] }],
  [['ghee'], 900, 0, 0, 100, 0, { cup: 205, buy: [340, 'g', 9, 'jar'], pantry: true }],
  [['heavy cream', 'double cream', 'whipping cream', 'cream', 'single cream', 'light cream', 'half and half'], 340, 2.8, 2.7, 36, 0, { cup: 238, buy: [473, 'ml', 3.8, 'pint'] }],
  [['sour cream', 'creme fraiche', 'crème fraîche'], 198, 2.4, 4.6, 19, 0, { cup: 230, buy: [454, 'g', 2.6, '16 oz tub'] }],
  [['greek yogurt', 'greek yoghurt', '0% greek yogurt', 'nonfat greek yogurt', 'skyr'], 59, 10.3, 3.6, 0.4, 0, { cup: 245, buy: [907, 'g', 6, '32 oz tub'] }],
  [['yogurt', 'yoghurt', 'natural yogurt', 'plain yogurt'], 61, 3.5, 4.7, 3.3, 0, { cup: 245, buy: [907, 'g', 3.9, '32 oz tub'] }],
  [['cottage cheese'], 98, 11, 3.4, 4.3, 0, { cup: 226, buy: [454, 'g', 3.5, '16 oz tub'] }],
  [['cream cheese'], 342, 6, 4, 34, 0, { cup: 232, buy: [227, 'g', 2.6, '8 oz block'] }],
  [['cheddar', 'cheese', 'cheddar cheese', 'shredded cheese', 'grated cheese', 'monterey jack', 'colby', 'gouda', 'swiss cheese', 'american cheese'], 403, 25, 1.3, 33, 0, { cup: 113, each: 21, buy: [227, 'g', 3.3, '8 oz'] }],
  [['mozzarella', 'fresh mozzarella', 'low moisture mozzarella'], 280, 28, 3, 17, 0, { cup: 113, buy: [227, 'g', 3.3, '8 oz'] }],
  [['parmesan', 'parmigiano', 'parmigiano reggiano', 'pecorino', 'grana padano'], 431, 38, 4, 29, 0, { cup: 100, buy: [142, 'g', 5, '5 oz'] }],
  [['feta', 'goat cheese', "goat's cheese", 'halloumi', 'paneer', 'ricotta', 'mascarpone', 'blue cheese', 'gorgonzola', 'brie'], 265, 14, 4, 21, 0, { cup: 150, buy: [170, 'g', 4.5, '6 oz'] }],

  // ---- Produce ----
  [['onion', 'onions', 'yellow onion', 'white onion', 'red onion', 'brown onion'], 40, 1.1, 9.3, 0.1, 1.7, { each: 110, cup: 160, buy: [1, 'each', 0.9, 'each'] }],
  [['shallot', 'shallots'], 72, 2.5, 17, 0.1, 3.2, { each: 25, cup: 160, buy: [1, 'each', 0.6, 'each'] }],
  [['spring onion', 'green onion', 'scallion', 'scallions'], 32, 1.8, 7.3, 0.2, 2.6, { each: 15, cup: 100, buy: [6, 'each', 1, 'bunch'] }],
  [['garlic', 'garlic clove', 'garlic cloves', 'minced garlic', 'garlic paste'], 149, 6.4, 33, 0.5, 2.1, { each: 5, cup: 136, buy: [1, 'each', 0.6, 'head (~10 cloves)'] }],
  [['ginger', 'fresh ginger', 'ginger root', 'ginger paste', 'ginger garlic paste'], 80, 1.8, 18, 0.8, 2, { each: 15, cup: 96, buy: [100, 'g', 1.2, 'piece'] }],
  [['potato', 'potatoes', 'russet potato', 'yukon gold', 'new potatoes', 'baby potatoes'], 77, 2, 17.5, 0.1, 2.2, { each: 210, cup: 150, buy: [2268, 'g', 4.5, '5 lb bag'] }],
  [['sweet potato', 'sweet potatoes', 'yam'], 86, 1.6, 20, 0.1, 3, { each: 200, cup: 133, buy: [LB, 'g', 1.4, 'per lb'], loose: true }],
  [['carrot', 'carrots'], 41, 0.9, 9.6, 0.2, 2.8, { each: 60, cup: 128, buy: [907, 'g', 1.6, '2 lb bag'] }],
  [['celery', 'celery stalk', 'celery stick'], 16, 0.7, 3, 0.2, 1.6, { each: 40, cup: 101, buy: [450, 'g', 2, 'bunch'] }],
  [['tomato', 'tomatoes', 'cherry tomato', 'cherry tomatoes', 'plum tomato', 'roma tomato', 'grape tomatoes'], 18, 0.9, 3.9, 0.2, 1.2, { each: 120, cup: 180, buy: [LB, 'g', 2, 'per lb'], loose: true }],
  [['bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'capsicum', 'red bell pepper', 'green bell pepper', 'peppers'], 26, 1, 6, 0.3, 2.1, { each: 150, cup: 150, buy: [1, 'each', 1.3, 'each'] }],
  [['chilli', 'chili', 'chillies', 'chile', 'jalapeno', 'jalapeño', 'green chilli', 'red chilli', 'serrano', 'bird eye chilli', 'scotch bonnet'], 40, 1.9, 9, 0.4, 1.5, { each: 15, cup: 90, buy: [1, 'each', 0.25, 'each'] }],
  [['zucchini', 'courgette', 'courgettes', 'summer squash'], 17, 1.2, 3.1, 0.3, 1, { each: 200, cup: 124, buy: [1, 'each', 1.2, 'each'] }],
  [['eggplant', 'aubergine', 'aubergines'], 25, 1, 6, 0.2, 3, { each: 450, cup: 82, buy: [1, 'each', 1.8, 'each'] }],
  [['broccoli', 'broccoli florets', 'tenderstem broccoli'], 34, 2.8, 6.6, 0.4, 2.6, { each: 300, cup: 91, buy: [LB, 'g', 2.2, 'crown (~1 lb)'] }],
  [['cauliflower', 'cauliflower florets', 'riced cauliflower', 'cauliflower rice'], 25, 1.9, 5, 0.3, 2, { each: 600, cup: 107, buy: [1, 'each', 3.3, 'head'] }],
  [['spinach', 'baby spinach'], 23, 2.9, 3.6, 0.4, 2.2, { cup: 30, buy: [142, 'g', 3, '5 oz bag'] }],
  [['kale', 'cavolo nero', 'chard', 'collard greens', 'greens'], 35, 2.9, 4.4, 1.5, 4.1, { cup: 21, buy: [1, 'each', 2.2, 'bunch'] }],
  [['lettuce', 'romaine', 'iceberg', 'salad leaves', 'mixed greens', 'rocket', 'arugula', 'little gem', 'spring mix'], 15, 1.4, 2.9, 0.2, 1.3, { each: 300, cup: 47, buy: [1, 'each', 2.5, 'head / bag'] }],
  [['cabbage', 'red cabbage', 'napa cabbage', 'savoy cabbage', 'bok choy', 'pak choi', 'coleslaw mix'], 25, 1.3, 5.8, 0.1, 2.5, { each: 900, cup: 89, buy: [1, 'each', 2.5, 'head'] }],
  [['cucumber', 'cucumbers'], 15, 0.7, 3.6, 0.1, 0.5, { each: 300, cup: 119, buy: [1, 'each', 0.9, 'each'] }],
  [['mushroom', 'mushrooms', 'button mushroom', 'chestnut mushroom', 'cremini', 'portobello', 'shiitake', 'oyster mushroom'], 22, 3.1, 3.3, 0.3, 1, { each: 18, cup: 70, buy: [227, 'g', 2.5, '8 oz pack'] }],
  [['corn', 'sweetcorn', 'sweet corn', 'corn kernels', 'corn on the cob'], 86, 3.3, 19, 1.4, 2, { each: 100, cup: 154, buy: [1, 'each', 0.6, 'ear / can'] }],
  [['peas', 'green peas', 'frozen peas', 'garden peas', 'petit pois'], 81, 5.4, 14.5, 0.4, 5.1, { cup: 145, buy: [340, 'g', 1.8, '12 oz bag'] }],
  [['green beans', 'french beans', 'string beans', 'runner beans', 'snap peas', 'mange tout', 'snow peas'], 31, 1.8, 7, 0.2, 2.7, { cup: 110, buy: [LB, 'g', 2.5, 'per lb'], loose: true }],
  [['asparagus'], 20, 2.2, 3.9, 0.1, 2.1, { each: 16, cup: 134, buy: [LB, 'g', 3.5, 'bunch (~1 lb)'] }],
  [['leek', 'leeks'], 61, 1.5, 14, 0.3, 1.8, { each: 90, cup: 89, buy: [1, 'each', 1.5, 'each'] }],
  [['butternut squash', 'squash', 'pumpkin', 'acorn squash'], 45, 1, 11.7, 0.1, 2, { each: 1000, cup: 140, buy: [1, 'each', 3.5, 'each'] }],
  [['avocado', 'avocados'], 160, 2, 8.5, 14.7, 6.7, { each: 150, cup: 150, buy: [1, 'each', 1.3, 'each'] }],
  [['lemon', 'lemons', 'lemon juice', 'lemon zest'], 29, 1.1, 9.3, 0.3, 2.8, { each: 60, cup: 244, buy: [1, 'each', 0.7, 'each'] }],
  [['lime', 'limes', 'lime juice', 'lime zest'], 30, 0.7, 10.5, 0.2, 2.8, { each: 45, cup: 246, buy: [1, 'each', 0.4, 'each'] }],
  [['orange', 'oranges', 'orange juice', 'orange zest'], 47, 0.9, 11.8, 0.1, 2.4, { each: 140, cup: 248, buy: [1, 'each', 0.9, 'each'] }],
  [['apple', 'apples'], 52, 0.3, 13.8, 0.2, 2.4, { each: 180, cup: 125, buy: [1, 'each', 0.9, 'each'] }],
  [['banana', 'bananas'], 89, 1.1, 22.8, 0.3, 2.6, { each: 118, cup: 150, buy: [1, 'each', 0.3, 'each'] }],
  [['berries', 'strawberries', 'strawberry', 'blueberries', 'raspberries', 'blackberries', 'mixed berries', 'frozen berries'], 45, 0.8, 11, 0.4, 2.5, { cup: 148, buy: [454, 'g', 4.2, '1 lb pack'] }],
  [['mango', 'pineapple', 'peach', 'pear', 'grapes', 'kiwi', 'cherries', 'melon', 'watermelon', 'papaya'], 55, 0.7, 14, 0.3, 1.8, { each: 200, cup: 165, buy: [1, 'each', 1.8, 'each'] }],
  [['raisins', 'sultanas', 'dates', 'dried apricots', 'dried cranberries', 'prunes'], 300, 3, 75, 0.5, 5, { cup: 160, buy: [340, 'g', 3.5, '12 oz bag'], pantry: true }],
  [['parsley', 'coriander', 'cilantro', 'basil', 'mint', 'dill', 'chives', 'fresh herbs', 'tarragon'], 36, 3, 6, 0.8, 3.3, { cup: 30, each: 30, buy: [1, 'each', 1.2, 'bunch'] }],
  [['thyme', 'rosemary', 'sage', 'oregano leaves', 'bay leaf', 'bay leaves', 'curry leaves', 'kaffir lime leaves', 'lemongrass'], 100, 4, 20, 2, 10, { cup: 40, each: 15, buy: [1, 'each', 2, 'pack'], pantry: true }],

  // ---- Grains, pasta, bread ----
  [['rice', 'white rice', 'basmati rice', 'jasmine rice', 'long grain rice', 'arborio rice', 'risotto rice', 'sushi rice'], 360, 6.6, 79, 0.6, 1.3, { cup: 185, buy: [907, 'g', 2.8, '2 lb bag'] }],
  [['brown rice', 'wild rice'], 367, 7.5, 76, 2.7, 3.4, { cup: 190, buy: [907, 'g', 3, '2 lb bag'] }],
  [['cooked rice', 'microwave rice', 'leftover rice', 'cooked brown rice', 'cooked white rice', 'cooked jasmine rice', 'cooked basmati rice'], 130, 2.7, 28, 0.3, 0.4, { cup: 158, buy: [250, 'g', 1.8, 'pouch'] }],
  [['pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'linguine', 'fettuccine', 'tagliatelle', 'macaroni', 'farfalle', 'orzo', 'lasagne sheets', 'lasagna noodles', 'lasagne', 'lasagna', 'shells', 'orecchiette', 'pappardelle', 'conchiglie', 'ziti', 'bucatini'], 371, 13, 75, 1.5, 3.2, { cup: 100, buy: [454, 'g', 1.6, '1 lb box'] }],
  [['protein pasta', 'chickpea pasta', 'lentil pasta'], 350, 20, 55, 6, 8, { cup: 100, buy: [227, 'g', 2.8, '8 oz box'] }],
  [['egg noodles', 'noodles', 'ramen', 'udon', 'soba', 'lo mein', 'chow mein noodles', 'rice noodles', 'vermicelli', 'glass noodles', 'rice vermicelli', 'instant ramen'], 360, 10, 75, 2, 2.5, { each: 85, cup: 100, buy: [340, 'g', 2.2, 'pack'] }],
  [['couscous', 'bulgur', 'bulghur', 'quinoa', 'pearl barley', 'barley', 'farro', 'freekeh', 'millet', 'polenta', 'cornmeal', 'grits'], 365, 12, 70, 3, 6, { cup: 175, buy: [454, 'g', 3.5, '1 lb'] }],
  [['oats', 'rolled oats', 'porridge oats', 'oatmeal', 'quick oats'], 379, 13, 68, 6.5, 10, { cup: 81, buy: [1190, 'g', 4.5, '42 oz canister'] }],
  [['bread', 'sliced bread', 'white bread', 'wholemeal bread', 'sourdough', 'whole wheat bread', 'toast'], 265, 9, 49, 3.2, 2.7, { each: 30, cup: 45, buy: [567, 'g', 3, 'loaf'] }],
  [['bun', 'buns', 'burger bun', 'hamburger bun', 'brioche bun', 'roll', 'rolls', 'hot dog bun', 'bagel', 'english muffin', 'baguette', 'ciabatta', 'croissant'], 280, 9, 50, 4.5, 2, { each: 60, buy: [8, 'each', 3.2, '8 pack'] }],
  [['tortilla', 'tortillas', 'wrap', 'wraps', 'flour tortilla', 'corn tortilla', 'flatbread', 'pita', 'pitta', 'naan', 'chapati', 'roti', 'taco shell', 'low carb tortilla', 'high protein tortilla'], 300, 8, 50, 7, 3.5, { each: 45, buy: [10, 'each', 3.3, '10 pack'] }],
  [['breadcrumbs', 'panko', 'bread crumbs', 'crackers', 'crushed crackers'], 395, 13, 72, 5.3, 4.5, { cup: 108, buy: [227, 'g', 2.5, '8 oz'], pantry: true }],
  [['pizza dough', 'puff pastry', 'shortcrust pastry', 'pastry', 'filo pastry', 'phyllo', 'pie crust', 'dough'], 370, 7, 45, 18, 2, { buy: [454, 'g', 4, 'pack'] }],

  // ---- Beans, legumes, tofu ----
  [['chickpeas', 'chickpea', 'garbanzo beans'], 139, 7, 22.5, 2.1, 6, { cup: 164, each: 400, buy: [425, 'g', 1.2, '15 oz can'] }],
  [['black beans', 'kidney beans', 'pinto beans', 'cannellini beans', 'white beans', 'butter beans', 'borlotti beans', 'haricot beans', 'navy beans', 'beans', 'mixed beans', 'refried beans', 'baked beans', 'lima beans'], 120, 7.5, 21, 0.5, 6.5, { cup: 172, each: 400, buy: [425, 'g', 1.2, '15 oz can'] }],
  [['lentils', 'red lentils', 'green lentils', 'brown lentils', 'puy lentils', 'split peas', 'dal', 'yellow split peas', 'masoor dal', 'toor dal', 'chana dal'], 352, 24.6, 63, 1.1, 10.7, { cup: 192, buy: [454, 'g', 1.8, '1 lb bag'] }],
  [['edamame'], 121, 11.9, 8.9, 5.2, 5.2, { cup: 155, buy: [340, 'g', 2.8, '12 oz bag'] }],
  [['tofu', 'firm tofu', 'extra firm tofu', 'silken tofu'], 144, 15.8, 2.8, 8.7, 2.3, { cup: 250, each: 400, buy: [397, 'g', 2.5, '14 oz block'] }],
  [['tempeh', 'seitan'], 192, 20, 7.6, 10.8, 0, { buy: [227, 'g', 3.3, '8 oz'] }],

  // ---- Canned, jarred, sauces ----
  [['tinned tomatoes', 'canned tomatoes', 'chopped tomatoes', 'diced tomatoes', 'crushed tomatoes', 'plum tomatoes', 'whole peeled tomatoes', 'passata', 'tomato sauce', 'tomato puree', 'marinara', 'pasta sauce'], 32, 1.6, 7, 0.3, 1.9, { cup: 245, each: 400, buy: [411, 'g', 1.3, '14.5 oz can'] }],
  [['tomato paste', 'tomato purée concentrate', 'double concentrate tomato'], 82, 4.3, 19, 0.5, 4.1, { cup: 262, buy: [170, 'g', 1, '6 oz can'], pantry: true }],
  [['coconut milk', 'coconut cream', 'light coconut milk'], 197, 2, 2.8, 21, 0, { cup: 240, each: 400, buy: [400, 'ml', 2, '13.5 oz can'] }],
  [['chicken stock', 'chicken broth', 'beef stock', 'beef broth', 'vegetable stock', 'vegetable broth', 'stock', 'broth', 'bone broth', 'fish stock'], 6, 0.6, 0.5, 0.2, 0, { cup: 240, buy: [946, 'ml', 2.5, '32 oz carton'] }],
  [['stock cube', 'bouillon cube', 'bouillon', 'stock pot', 'chicken bouillon'], 200, 10, 15, 10, 0, { each: 10, buy: [8, 'each', 2, 'box of 8'], pantry: true }],
  [['soy sauce', 'light soy sauce', 'dark soy sauce', 'low sodium soy sauce', 'tamari', 'coconut aminos'], 53, 8, 4.9, 0.6, 0.8, { cup: 255, buy: [296, 'ml', 3, '10 oz bottle'], pantry: true }],
  [['fish sauce', 'oyster sauce', 'hoisin sauce', 'hoisin', 'teriyaki sauce', 'sweet chili sauce', 'sweet chilli sauce', 'bbq sauce', 'barbecue sauce', 'worcestershire', 'worcestershire sauce', 'ketchup', 'buffalo sauce', 'hot sauce', 'sriracha', 'gochujang', 'chili garlic sauce', 'sambal', 'enchilada sauce', 'salsa', 'pesto', 'curry paste', 'red curry paste', 'green curry paste', 'harissa', 'miso', 'miso paste', 'chilli oil', 'chili oil', 'chili crisp'], 150, 3, 28, 3, 1, { cup: 270, buy: [300, 'ml', 3.2, 'bottle / jar'], pantry: true }],
  [['mayonnaise', 'mayo', 'light mayo'], 680, 1, 0.6, 75, 0, { cup: 220, buy: [887, 'ml', 4.5, '30 oz jar'], pantry: true }],
  [['mustard', 'dijon mustard', 'wholegrain mustard', 'yellow mustard'], 66, 4.4, 5.8, 4, 4, { cup: 250, buy: [227, 'g', 2, 'jar'], pantry: true }],
  [['vinegar', 'rice vinegar', 'white wine vinegar', 'red wine vinegar', 'cider vinegar', 'apple cider vinegar', 'balsamic vinegar', 'balsamic', 'malt vinegar', 'sherry vinegar'], 20, 0, 1, 0, 0, { cup: 240, buy: [473, 'ml', 2.5, '16 oz bottle'], pantry: true }],
  [['olives', 'black olives', 'green olives', 'kalamata olives', 'capers', 'pickles', 'gherkins', 'jalapenos in jar', 'pickled jalapenos', 'sun-dried tomatoes', 'roasted red peppers', 'artichoke hearts'], 145, 1, 4, 15, 3.3, { cup: 135, buy: [170, 'g', 3, 'jar'] }],
  [['peanut butter', 'almond butter', 'nut butter', 'tahini', 'powdered peanut butter', 'pb2'], 590, 25, 20, 50, 6, { cup: 258, buy: [454, 'g', 3.5, '16 oz jar'], pantry: true }],
  [['jam', 'jelly', 'preserves', 'marmalade'], 250, 0.4, 65, 0.1, 1, { cup: 320, buy: [340, 'g', 3.3, 'jar'], pantry: true }],

  // ---- Oils, baking, sweeteners ----
  [['olive oil', 'extra virgin olive oil', 'vegetable oil', 'sunflower oil', 'canola oil', 'rapeseed oil', 'avocado oil', 'coconut oil', 'sesame oil', 'peanut oil', 'groundnut oil', 'oil', 'cooking spray', 'cooking oil'], 884, 0, 0, 100, 0, { cup: 218, buy: [500, 'ml', 7, 'bottle'], pantry: true }],
  [['flour', 'plain flour', 'all-purpose flour', 'all purpose flour', 'self-raising flour', 'self raising flour', 'bread flour', 'wholemeal flour', 'whole wheat flour', 'almond flour', 'coconut flour', 'rice flour', 'gram flour', 'chickpea flour'], 364, 10, 76, 1, 2.7, { cup: 125, buy: [2268, 'g', 3.5, '5 lb bag'], pantry: true }],
  [['cornstarch', 'cornflour', 'corn starch', 'arrowroot', 'potato starch', 'tapioca starch'], 381, 0.3, 91, 0.1, 0.9, { cup: 128, buy: [454, 'g', 2, '16 oz box'], pantry: true }],
  [['sugar', 'white sugar', 'caster sugar', 'granulated sugar', 'brown sugar', 'light brown sugar', 'dark brown sugar', 'icing sugar', 'powdered sugar', 'demerara sugar', 'muscovado', 'palm sugar', 'jaggery', 'coconut sugar'], 387, 0, 100, 0, 0, { cup: 200, buy: [1814, 'g', 3.8, '4 lb bag'], pantry: true }],
  [['honey', 'maple syrup', 'golden syrup', 'agave', 'agave syrup', 'molasses', 'treacle', 'corn syrup', 'date syrup', 'sugar free syrup'], 304, 0.3, 82, 0, 0.2, { cup: 340, buy: [340, 'g', 5, '12 oz'], pantry: true }],
  [['baking powder', 'baking soda', 'bicarbonate of soda', 'yeast', 'dried yeast', 'instant yeast', 'cream of tartar'], 50, 0, 25, 0, 0, { cup: 220, buy: [227, 'g', 2.2, 'tin'], pantry: true }],
  [['vanilla', 'vanilla extract', 'vanilla essence', 'almond extract'], 288, 0, 13, 0, 0, { cup: 208, buy: [59, 'ml', 5, '2 oz bottle'], pantry: true }],
  [['cocoa', 'cocoa powder', 'cacao'], 228, 19.6, 58, 13.7, 37, { cup: 86, buy: [227, 'g', 4, 'tin'], pantry: true }],
  [['chocolate', 'dark chocolate', 'chocolate chips', 'milk chocolate', 'white chocolate'], 546, 4.9, 61, 31, 7, { cup: 170, buy: [340, 'g', 3.8, '12 oz bag'] }],
  [['protein powder', 'whey protein', 'whey', 'casein', 'protein scoop'], 380, 78, 8, 5, 1, { each: 31, cup: 120, buy: [907, 'g', 30, '2 lb tub'], pantry: true }],
  [['sweetener', 'stevia', 'erythritol', 'monk fruit', 'zero calorie sweetener', 'splenda', 'allulose'], 0, 0, 0, 0, 0, { cup: 200, buy: [340, 'g', 6, 'bag'], pantry: true }],

  // ---- Nuts & seeds ----
  [['almonds', 'almond', 'cashews', 'cashew', 'walnuts', 'walnut', 'pecans', 'pistachios', 'hazelnuts', 'peanuts', 'pine nuts', 'macadamia', 'mixed nuts', 'flaked almonds', 'slivered almonds'], 600, 19, 20, 52, 9, { each: 1.3, cup: 140, buy: [227, 'g', 5, '8 oz bag'], pantry: true }],
  [['sesame seeds', 'chia seeds', 'flaxseed', 'flax seeds', 'pumpkin seeds', 'sunflower seeds', 'hemp seeds', 'poppy seeds', 'pepitas'], 560, 20, 22, 46, 15, { cup: 145, buy: [227, 'g', 4, 'bag'], pantry: true }],
  [['desiccated coconut', 'shredded coconut', 'coconut flakes'], 660, 6.9, 24, 64, 16, { cup: 93, buy: [198, 'g', 3, 'bag'], pantry: true }],

  // ---- Spices & seasonings (pantry) ----
  [['salt', 'sea salt', 'kosher salt', 'table salt', 'flaky salt'], 0, 0, 0, 0, 0, { cup: 290, buy: [737, 'g', 1.5, 'canister'], pantry: true }],
  [['black pepper', 'pepper', 'ground black pepper', 'white pepper', 'peppercorns', 'salt and pepper', 'cracked black pepper'], 250, 10, 64, 3.3, 25, { cup: 110, buy: [85, 'g', 4, 'jar'], pantry: true }],
  [['cumin', 'ground cumin', 'cumin seeds', 'paprika', 'smoked paprika', 'sweet paprika', 'turmeric', 'ground turmeric', 'cinnamon', 'ground cinnamon', 'cinnamon stick', 'nutmeg', 'ground coriander', 'coriander seeds', 'garam masala', 'curry powder', 'chili powder', 'chilli powder', 'chilli flakes', 'chili flakes', 'red pepper flakes', 'cayenne', 'cayenne pepper', 'cloves', 'ground cloves', 'cardamom', 'cardamom pods', 'allspice', 'star anise', 'fennel seeds', 'mustard seeds', 'oregano', 'dried oregano', 'dried thyme', 'dried basil', 'italian seasoning', 'mixed herbs', 'herbes de provence', 'garlic powder', 'onion powder', 'ginger powder', 'ground ginger', 'cajun seasoning', 'taco seasoning', 'chinese five spice', 'five spice', 'za\'atar', 'sumac', 'saffron', 'fenugreek', 'kasuri methi', 'chaat masala', 'tandoori masala', 'everything bagel seasoning', 'old bay', 'seasoning', 'spice', 'spices', 'msg', 'dried parsley', 'dill weed', 'dried rosemary', 'fajita seasoning'], 300, 12, 55, 10, 30, { each: 28, cup: 100, buy: [60, 'g', 3, 'jar'], pantry: true }],

  // ---- Convenience foods ----
  [['hot dog', 'hot dogs', 'frankfurter', 'frankfurters', 'wiener'], 290, 10.5, 2.5, 26, 0, { each: 45, buy: [8, 'each', 4, '8 pack'] }],
  [['kielbasa', 'smoked sausage', 'polish sausage'], 300, 12, 3, 27, 0, { each: 400, buy: [397, 'g', 4.5, '14 oz link'] }],
  [['alfredo sauce', 'jar alfredo sauce'], 150, 2.5, 4, 14, 0, { cup: 250, each: 425, buy: [425, 'g', 3.5, '15 oz jar'] }],
  [['pizza sauce'], 50, 2, 9, 1, 2, { cup: 250, buy: [397, 'g', 2.3, '14 oz jar'] }],
  [['ranch dressing', 'ranch', 'caesar dressing', 'dressing', 'honey mustard', 'thousand island', 'blue cheese dressing', 'italian dressing'], 450, 1, 6, 47, 0, { cup: 240, buy: [473, 'ml', 3.5, '16 oz bottle'], pantry: true }],
  [['relish', 'pickle relish', 'sweet relish'], 130, 0.5, 35, 0.5, 1, { cup: 245, buy: [296, 'ml', 2.5, 'jar'], pantry: true }],
  [['french fries', 'frozen french fries', 'fries', 'tater tots', 'hash browns'], 150, 2.5, 24, 5, 2.5, { cup: 80, buy: [907, 'g', 3.5, '2 lb bag'] }],
  [['stir fry vegetables', 'frozen stir fry vegetables', 'mixed vegetables', 'frozen vegetables', 'peas and carrots', 'frozen peas and carrots'], 45, 2.5, 8, 0.3, 3, { cup: 130, buy: [340, 'g', 2.3, '12 oz bag'] }],
  [['pierogies', 'pierogi', 'frozen pierogies', 'potstickers', 'dumplings'], 200, 5, 32, 5, 1.5, { each: 40, buy: [454, 'g', 3.5, '16 oz box'] }],
  [['pancake mix', 'waffle mix', 'biscuit mix', 'bisquick'], 360, 8, 72, 4, 2, { cup: 120, buy: [907, 'g', 3.5, '32 oz box'], pantry: true }],
  [['granola', 'cereal'], 470, 10, 64, 20, 6, { cup: 120, buy: [340, 'g', 4, 'bag'] }],
  [['tomato soup', 'condensed tomato soup', 'cream of mushroom soup', 'cream of chicken soup'], 75, 1.5, 15, 1, 1, { cup: 250, each: 305, buy: [305, 'g', 1.3, '10.75 oz can'] }],
  [['shaved steak', 'sliced steak'], 190, 21, 0, 11, 0, { buy: [LB, 'g', 8.5, 'per lb'], loose: true }],
  [['tortilla chips', 'corn chips'], 490, 7, 63, 23, 5, { cup: 28, buy: [369, 'g', 4, '13 oz bag'] }],

  // ---- Drinks / misc ----
  [['water', 'ice', 'boiling water', 'cold water', 'warm water', 'hot water', 'ice cubes'], 0, 0, 0, 0, 0, { cup: 240, free: true }],
  [['white wine', 'red wine', 'wine', 'dry white wine', 'shaoxing wine', 'mirin', 'sake', 'sherry', 'cooking wine', 'beer', 'rum', 'brandy', 'vodka', 'whisky', 'whiskey', 'bourbon', 'tequila', 'marsala'], 85, 0.1, 2.6, 0, 0, { cup: 240, buy: [750, 'ml', 9, 'bottle'], pantry: true }],
];

// ---------- lookup ----------

const ENTRIES = DB.map(([words, kcal, protein, carbs, fat, fiber, opts]) => ({
  words, n: { kcal, protein, carbs, fat, fiber }, ...opts,
}));

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const WORD_RES = new Map();
function hasWord(text, w) {
  let re = WORD_RES.get(w);
  if (!re) {
    re = new RegExp(`(^|[^a-z])${escapeRe(w)}(s|es)?([^a-z]|$)`);
    WORD_RES.set(w, re);
  }
  return re.test(text);
}

const lookupCache = new Map();
/** Find the reference entry for an ingredient name (longest matching phrase wins). */
export function lookupIngredient(name) {
  const n = String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9%' -]/g, ' ').replace(/\s+/g, ' ').trim();
  if (lookupCache.has(n)) return lookupCache.get(n);
  let best = null;
  let bestLen = 0;
  for (const e of ENTRIES) {
    for (const w of e.words) {
      if (w.length > bestLen && hasWord(n, w)) {
        best = e;
        bestLen = w.length;
      }
    }
  }
  lookupCache.set(n, best);
  return best;
}

// ---------- quantities ----------

const VOLUME_ML = { tsp: 4.93, tbsp: 14.79, cup: 236.6, pint: 473, quart: 946, ml: 1 };
const COUNT_GRAMS = { clove: 5, slice: 30, can: 400, stick: 113, bunch: 60, head: 50, stalk: 40, fillet: 150, piece: 100, handful: 30, sprig: 1, pinch: 0.4, dash: 0.6, pack: 250 };

/** Convert a parsed quantity to grams for a given ingredient entry (null if unknown). */
export function toGrams(qty, unit, entry) {
  if (qty == null || !(qty > 0)) return null;
  if (unit === 'g') return qty;
  if (unit === 'oz') return qty * 28.35;
  if (VOLUME_ML[unit]) return (qty * VOLUME_ML[unit] / 236.6) * (entry?.cup || 240);
  if (unit === '' || unit === 'piece') return qty * (entry?.each || (unit === 'piece' ? 100 : 50));
  if (unit === 'clove') return qty * (entry?.words.includes('garlic') ? 5 : entry?.each || 5);
  if (unit === 'can') return qty * (entry?.canG || (entry?.each && entry.each >= 150 ? entry.each : 400));
  if (unit === 'pack' && entry?.each) return qty * entry.each;
  if (unit === 'loaf') return qty * 450;
  if (unit === 'jar') return qty * (entry?.each && entry.each >= 150 ? entry.each : 680);
  if (unit === 'stick' && entry?.words.includes('butter')) return qty * 113;
  if (COUNT_GRAMS[unit]) return qty * (unit === 'slice' && entry?.each ? entry.each : COUNT_GRAMS[unit]);
  return null;
}

/** How much of the ingredient's "buy unit" a quantity represents (grams, ml or count). */
export function toBuyUnits(qty, unit, entry) {
  if (!entry?.buy || qty == null || !(qty > 0)) return null;
  const buyUnit = entry.buy[1];
  if (buyUnit === 'each') {
    // Garlic is bought by the head (~10 cloves) but recipes count cloves.
    if (entry.words.includes('garlic') && (unit === 'clove' || unit === '')) return qty / 10;
    if (['', 'piece', 'head', 'bunch', 'fillet', 'pack', 'stalk', 'jar', 'loaf'].includes(unit)) return qty;
    if (unit === 'sprig' || unit === 'handful') return qty / 8; // a bunch has plenty
    const g = toGrams(qty, unit, entry);
    return g != null && entry.each ? g / entry.each : null;
  }
  if (buyUnit === 'ml') {
    if (VOLUME_ML[unit]) return qty * VOLUME_ML[unit];
    const g = toGrams(qty, unit, entry);
    return g != null ? (g / (entry.cup || 240)) * 236.6 : null;
  }
  return toGrams(qty, unit, entry);
}
