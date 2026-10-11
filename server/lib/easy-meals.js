// A built-in set of easy, low-effort home meals (grilled cheese, quesadillas,
// tacos…). Written for this app; amounts are for 4 servings so the grocery
// list, prices and macros work like any other recipe.
//
// [name, minutes, meal types, ingredients, steps]

const B = ['breakfast'];
const LD = ['lunch', 'dinner'];

export const EASY_MEALS = [
  ['Grilled Cheese Sandwiches', 15, LD, ['8 slices bread', '8 slices cheddar cheese', '4 tbsp butter'], [
    'Butter one side of each slice of bread.',
    'Put 4 slices butter-side down in a skillet over medium-low heat, top each with 2 slices of cheese and another slice of bread, butter-side up.',
    'Cook 3–4 minutes a side until golden and the cheese has melted.',
  ]],
  ['Grilled Cheese & Tomato Soup', 20, LD, ['8 slices bread', '8 slices cheddar cheese', '4 tbsp butter', '2 cans tomato soup', '1 cup milk'], [
    'Warm the soup with the milk in a saucepan, stirring now and then.',
    'Butter the bread, make 4 cheese sandwiches and cook in a skillet over medium-low heat, 3–4 minutes a side.',
    'Cut the sandwiches into strips for dipping.',
  ]],
  ['Cheese Quesadillas', 15, LD, ['8 flour tortillas', '3 cups shredded cheese', '1 tbsp butter', '1/2 cup salsa', '1/2 cup sour cream'], [
    'Sprinkle cheese over half of each tortilla and fold it over.',
    'Cook in a lightly buttered skillet over medium heat, 2–3 minutes a side, until crisp and melted.',
    'Cut into wedges and serve with salsa and sour cream.',
  ]],
  ['Chicken Quesadillas', 20, LD, ['8 flour tortillas', '3 cups cooked chicken', '2 cups shredded cheese', '1 tsp taco seasoning', '1/2 cup salsa', '1/2 cup sour cream'], [
    'Shred the chicken (rotisserie chicken works great) and toss with the taco seasoning.',
    'Fill half of each tortilla with chicken and cheese, fold and cook in a skillet over medium heat until crisp, 2–3 minutes a side.',
    'Serve with salsa and sour cream.',
  ]],
  ['Black Bean Quesadillas', 20, LD, ['8 flour tortillas', '1 can black beans', '2 cups shredded cheese', '1 cup corn', '1 tsp cumin', '1/2 cup salsa'], [
    'Drain and rinse the beans, then mash roughly with the corn and cumin.',
    'Spread over half of each tortilla, top with cheese and fold.',
    'Cook in a skillet over medium heat until golden, 2–3 minutes a side. Serve with salsa.',
  ]],
  ['Ground Beef Tacos', 20, LD, ['1 lb ground beef', '1 packet taco seasoning', '8 taco shells', '1 cup shredded cheese', '2 cups shredded lettuce', '2 tomatoes', '1/2 cup sour cream'], [
    'Brown the beef in a skillet, breaking it up, and drain any fat.',
    'Stir in the taco seasoning and 2/3 cup water; simmer 5 minutes.',
    'Warm the shells, then fill with beef, cheese, lettuce, diced tomato and sour cream.',
  ]],
  ['Taco Salad', 20, LD, ['1 lb ground beef', '1 packet taco seasoning', '1 head romaine lettuce', '1 can black beans', '1 cup shredded cheese', '2 tomatoes', '2 cups tortilla chips', '1/2 cup salsa'], [
    'Brown the beef, drain, then add the seasoning and 2/3 cup water and simmer 5 minutes.',
    'Chop the lettuce and tomatoes; drain and rinse the beans.',
    'Pile lettuce into bowls and top with beef, beans, cheese, tomato, crushed chips and salsa.',
  ]],
  ['Beef & Bean Nachos', 20, LD, ['1 lb ground beef', '1 packet taco seasoning', '1 bag tortilla chips', '1 can refried beans', '2 cups shredded cheese', '1 jalapeno', '1/2 cup salsa', '1/2 cup sour cream'], [
    'Heat the oven to 400°F. Brown the beef, drain and stir in the seasoning with a splash of water.',
    'Spread chips on a sheet pan, dot with refried beans and beef, then cover with cheese and sliced jalapeño.',
    'Bake 8–10 minutes until the cheese melts. Top with salsa and sour cream.',
  ]],
  ['Spaghetti with Meat Sauce', 25, LD, ['1 lb spaghetti', '1 lb ground beef', '1 jar marinara', '1/2 cup grated parmesan'], [
    'Cook the spaghetti in salted water according to the package.',
    'Meanwhile brown the beef in a large pan and drain; pour in the marinara and simmer 10 minutes.',
    'Toss with the drained pasta and serve with parmesan.',
  ]],
  ['Stovetop Mac and Cheese', 20, LD, ['1 lb macaroni', '3 tbsp butter', '3 tbsp flour', '2 1/2 cups milk', '3 cups shredded cheddar cheese', '1/2 tsp salt'], [
    'Boil the macaroni until just tender and drain.',
    'Melt the butter in the same pot, whisk in the flour for a minute, then slowly whisk in the milk until thick.',
    'Off the heat stir in the cheese and salt until smooth, then fold in the pasta.',
  ]],
  ['Buttered Noodles with Parmesan', 15, LD, ['1 lb egg noodles', '4 tbsp butter', '1 cup grated parmesan', '1/2 tsp black pepper'], [
    'Cook the noodles according to the package and drain, saving a splash of water.',
    'Toss with butter, parmesan, pepper and a little pasta water until glossy.',
  ]],
  ['Pesto Pasta with Chicken', 20, LD, ['1 lb pasta', '2 cups cooked chicken', '1 jar pesto', '1 cup cherry tomatoes', '1/2 cup grated parmesan'], [
    'Cook the pasta and drain, saving 1/2 cup of the water.',
    'Toss the pasta with pesto, shredded chicken, halved tomatoes and enough pasta water to loosen.',
    'Top with parmesan.',
  ]],
  ['Chicken Alfredo', 25, LD, ['1 lb fettuccine', '2 chicken breasts', '1 jar alfredo sauce', '1 cup broccoli florets', '1/4 cup grated parmesan'], [
    'Cook the fettuccine; add the broccoli for the last 3 minutes, then drain.',
    'Season and cook the chicken in a skillet until done, about 6 minutes a side, then slice.',
    'Warm the alfredo sauce, toss with the pasta, broccoli and chicken and top with parmesan.',
  ]],
  ['Baked Ziti', 35, LD, ['1 lb ziti', '1 jar marinara', '1 cup ricotta', '2 cups shredded mozzarella', '1/2 cup grated parmesan'], [
    'Heat the oven to 400°F. Cook the ziti 2 minutes less than the package says and drain.',
    'Mix with the marinara and ricotta and spread in a baking dish.',
    'Top with mozzarella and parmesan and bake 15–20 minutes until bubbly.',
  ]],
  ['Cheese Tortellini with Marinara', 15, LD, ['20 oz cheese tortellini', '1 jar marinara', '1/2 cup grated parmesan'], [
    'Cook the tortellini according to the package and drain.',
    'Warm the marinara and toss with the tortellini. Top with parmesan.',
  ]],
  ['Garlic Butter Shrimp Pasta', 20, LD, ['1 lb spaghetti', '1 lb shrimp', '4 tbsp butter', '4 cloves garlic', '1 lemon', '2 tbsp parsley'], [
    'Cook the spaghetti and drain, saving a splash of water.',
    'Melt the butter, cook the garlic 1 minute, then add the shrimp and cook until pink, 3–4 minutes.',
    'Toss with the pasta, lemon juice, parsley and a little pasta water.',
  ]],
  ['Classic Hamburgers', 20, LD, ['1 1/2 lb ground beef', '4 burger buns', '4 slices cheddar cheese', '1 tomato', '4 lettuce leaves', '2 tbsp ketchup', '1 tbsp mustard'], [
    'Shape the beef into 4 patties, a little wider than the buns, and season with salt and pepper.',
    'Cook in a hot skillet or grill 4 minutes a side; add cheese for the last minute.',
    'Serve on toasted buns with lettuce, tomato, ketchup and mustard.',
  ]],
  ['Hot Dogs', 10, LD, ['8 hot dogs', '8 hot dog buns', '2 tbsp ketchup', '2 tbsp mustard', '1/2 cup relish'], [
    'Grill or pan-fry the hot dogs until browned, about 5 minutes.',
    'Serve in warm buns with ketchup, mustard and relish.',
  ]],
  ['Sloppy Joes', 20, LD, ['1 lb ground beef', '1 onion', '1 cup ketchup', '1 tbsp brown sugar', '1 tbsp worcestershire sauce', '1 tsp mustard', '4 burger buns'], [
    'Brown the beef with the diced onion and drain.',
    'Stir in the ketchup, brown sugar, Worcestershire and mustard and simmer 10 minutes.',
    'Spoon onto toasted buns.',
  ]],
  ['BLT Sandwiches', 15, LD, ['12 slices bacon', '8 slices bread', '2 tomatoes', '8 lettuce leaves', '4 tbsp mayonnaise'], [
    'Cook the bacon until crisp and drain on paper towels.',
    'Toast the bread and spread with mayonnaise.',
    'Layer lettuce, sliced tomato and bacon between the slices.',
  ]],
  ['Tuna Melts', 15, LD, ['2 cans tuna', '1/3 cup mayonnaise', '1 celery stalk', '8 slices bread', '8 slices cheddar cheese', '2 tbsp butter'], [
    'Mix the drained tuna with mayonnaise and finely chopped celery.',
    'Spread on 4 slices of bread, add cheese and top with the remaining bread.',
    'Butter the outsides and cook in a skillet until golden and melted, 3–4 minutes a side.',
  ]],
  ['Chicken Salad Sandwiches', 15, LD, ['3 cups cooked chicken', '1/2 cup mayonnaise', '1 celery stalk', '1/2 cup grapes', '8 slices bread', '4 lettuce leaves'], [
    'Chop the chicken, celery and halved grapes and mix with the mayonnaise, salt and pepper.',
    'Pile onto bread with lettuce.',
  ]],
  ['Egg Salad Sandwiches', 20, LD, ['8 eggs', '1/3 cup mayonnaise', '1 tsp mustard', '8 slices bread', '4 lettuce leaves'], [
    'Hard-boil the eggs (10 minutes), cool in cold water and peel.',
    'Chop and mix with mayonnaise, mustard, salt and pepper.',
    'Spread on bread with lettuce.',
  ]],
  ['Ham & Cheese Sliders', 25, LD, ['12 slider rolls', '12 oz sliced ham', '8 slices swiss cheese', '4 tbsp butter', '1 tsp dijon mustard'], [
    'Heat the oven to 350°F. Slice the whole slab of rolls in half and set the bottom in a baking dish.',
    'Layer ham and cheese, add the tops, then brush with melted butter mixed with the mustard.',
    'Cover with foil and bake 15 minutes, uncovering for the last 5.',
  ]],
  ['Turkey & Cheese Wraps', 10, LD, ['4 large tortillas', '12 oz sliced turkey', '4 slices cheddar cheese', '2 cups spinach', '1 tomato', '4 tbsp mayonnaise'], [
    'Spread each tortilla with mayonnaise.',
    'Layer turkey, cheese, spinach and sliced tomato, then roll up tightly and cut in half.',
  ]],
  ['Chicken Caesar Wraps', 15, LD, ['4 large tortillas', '3 cups cooked chicken', '1 head romaine lettuce', '1/2 cup caesar dressing', '1/2 cup grated parmesan'], [
    'Chop the lettuce and chicken and toss with the dressing and parmesan.',
    'Divide among the tortillas, roll up and cut in half.',
  ]],
  ['Buffalo Chicken Wraps', 15, LD, ['4 large tortillas', '3 cups cooked chicken', '1/3 cup buffalo sauce', '2 cups shredded lettuce', '1/2 cup shredded cheese', '1/4 cup ranch dressing'], [
    'Toss the shredded chicken with buffalo sauce and warm it through.',
    'Fill the tortillas with lettuce, chicken, cheese and a drizzle of ranch, then roll up.',
  ]],
  ['Philly Cheesesteak Sandwiches', 20, LD, ['1 lb shaved steak', '1 onion', '1 green pepper', '8 slices provolone cheese', '4 hoagie rolls', '1 tbsp oil'], [
    'Cook the sliced onion and pepper in oil until soft, then push aside.',
    'Add the steak, season and cook 2–3 minutes, breaking it up. Mix with the veg and top with cheese to melt.',
    'Pile into toasted rolls.',
  ]],
  ['Meatball Subs', 25, LD, ['24 frozen meatballs', '1 jar marinara', '4 hoagie rolls', '8 slices provolone cheese'], [
    'Simmer the meatballs in the marinara for 15 minutes until hot through.',
    'Spoon into split rolls, top with cheese and broil 1–2 minutes to melt.',
  ]],
  ['French Bread Pizza', 20, LD, ['1 loaf french bread', '1 cup pizza sauce', '2 cups shredded mozzarella', '3 oz pepperoni'], [
    'Heat the oven to 425°F. Split the bread lengthwise and cut each half in two.',
    'Spread with sauce, top with mozzarella and pepperoni.',
    'Bake 10–12 minutes until the cheese bubbles.',
  ]],
  ['English Muffin Pizzas', 15, LD, ['6 english muffins', '3/4 cup pizza sauce', '1 1/2 cups shredded mozzarella', '3 oz pepperoni'], [
    'Heat the oven to 400°F. Split and lightly toast the muffins.',
    'Top with sauce, cheese and pepperoni and bake 8–10 minutes.',
  ]],
  ['Chicken Tenders & Fries', 30, LD, ['2 lb frozen chicken tenders', '2 lb frozen french fries', '1/2 cup honey mustard', '1/2 cup ketchup'], [
    'Bake the tenders and fries on two sheet pans according to the packages (or air fry in batches).',
    'Serve with honey mustard and ketchup.',
  ]],
  ['Sheet Pan Sausage & Veggies', 30, LD, ['14 oz smoked sausage', '1 lb baby potatoes', '2 cups broccoli florets', '1 bell pepper', '2 tbsp olive oil', '1 tsp italian seasoning'], [
    'Heat the oven to 425°F. Halve the potatoes and chop the pepper; slice the sausage.',
    'Toss everything with oil, seasoning, salt and pepper on a sheet pan.',
    'Roast 25 minutes, stirring once, until the potatoes are tender.',
  ]],
  ['Sheet Pan Chicken Fajitas', 30, LD, ['1 1/2 lb chicken breast', '2 bell peppers', '1 onion', '2 tbsp olive oil', '1 packet fajita seasoning', '8 flour tortillas', '1/2 cup sour cream'], [
    'Heat the oven to 425°F. Slice the chicken, peppers and onion.',
    'Toss with oil and seasoning on a sheet pan and roast 20 minutes.',
    'Serve in warm tortillas with sour cream.',
  ]],
  ['Teriyaki Chicken Rice Bowls', 25, LD, ['1 1/2 lb chicken thighs', '1/2 cup teriyaki sauce', '2 cups rice', '12 oz frozen stir fry vegetables', '1 tbsp sesame seeds'], [
    'Cook the rice.',
    'Cut the chicken into bites and cook in a hot skillet until browned and done, about 8 minutes.',
    'Add the vegetables for 4 minutes, then the teriyaki sauce, and toss until glossy. Serve over rice with sesame seeds.',
  ]],
  ['Egg Fried Rice', 15, LD, ['4 cups cooked rice', '4 eggs', '1 cup frozen peas', '3 green onions', '3 tbsp soy sauce', '2 tbsp oil'], [
    'Heat the oil in a large skillet, scramble the eggs and set aside.',
    'Fry the cold rice and peas over high heat for 4–5 minutes.',
    'Stir in the eggs, soy sauce and sliced green onions.',
  ]],
  ['Chicken Fried Rice', 20, LD, ['4 cups cooked rice', '2 cups cooked chicken', '3 eggs', '1 1/2 cups frozen peas and carrots', '3 tbsp soy sauce', '2 tbsp oil', '3 green onions'], [
    'Scramble the eggs in the oil and set aside.',
    'Fry the rice with the vegetables and chopped chicken over high heat for 5 minutes.',
    'Stir in the eggs, soy sauce and green onions.',
  ]],
  ['Upgraded Ramen', 15, LD, ['4 packs instant ramen', '4 eggs', '2 cups spinach', '3 green onions', '1 tbsp soy sauce'], [
    'Soft-boil the eggs for 7 minutes, then cool and peel.',
    'Cook the noodles with half the seasoning packets, adding the spinach for the last minute.',
    'Serve topped with halved eggs, green onions and a splash of soy sauce.',
  ]],
  ['Quick Chicken Noodle Soup', 25, LD, ['8 cups chicken broth', '3 cups cooked chicken', '2 carrots', '2 celery stalks', '2 cups egg noodles', '1 tsp dried thyme'], [
    'Simmer the broth with sliced carrots, celery and thyme for 10 minutes.',
    'Add the noodles and cook 6–7 minutes.',
    'Stir in the shredded chicken and season with salt and pepper.',
  ]],
  ['Easy Beef Chili', 35, LD, ['1 lb ground beef', '1 onion', '1 can kidney beans', '1 can black beans', '1 can diced tomatoes', '1 can tomato sauce', '2 tbsp chili powder', '1 tsp cumin', '1 cup shredded cheese'], [
    'Brown the beef with the diced onion and drain.',
    'Add the drained beans, tomatoes, sauce and spices; simmer 20 minutes.',
    'Serve topped with cheese.',
  ]],
  ['Loaded Baked Potatoes', 15, LD, ['4 russet potatoes', '1 cup shredded cheddar cheese', '6 slices bacon', '1/2 cup sour cream', '3 green onions', '2 tbsp butter'], [
    'Prick the potatoes and microwave 10–12 minutes, turning halfway, until soft (or bake 1 hour at 400°F).',
    'Cook and crumble the bacon.',
    'Split the potatoes and fill with butter, cheese, bacon, sour cream and green onions.',
  ]],
  ['Pierogies & Kielbasa', 25, LD, ['16 oz frozen pierogies', '14 oz kielbasa', '1 onion', '2 tbsp butter', '1/2 cup sour cream'], [
    'Boil the pierogies 3 minutes and drain.',
    'Brown the sliced kielbasa and onion in butter, then add the pierogies and crisp them up, 5 minutes.',
    'Serve with sour cream.',
  ]],
  ['Grilled Chicken Salad', 25, LD, ['1 1/2 lb chicken breast', '1 tbsp olive oil', '2 heads romaine lettuce', '1 cucumber', '1 cup cherry tomatoes', '1/2 cup shredded cheese', '1/2 cup ranch dressing'], [
    'Season the chicken and cook in oil in a skillet or on a grill, 6 minutes a side; rest and slice.',
    'Chop the lettuce, cucumber and tomatoes.',
    'Top the salad with chicken and cheese and serve with dressing.',
  ]],
  ['Quick Red Beans and Rice', 30, LD, ['14 oz smoked sausage', '1 onion', '1 green pepper', '2 cans kidney beans', '1 cup chicken broth', '1 tsp cajun seasoning', '2 cups rice'], [
    'Cook the rice.',
    'Brown the sliced sausage with the diced onion and pepper.',
    'Add the beans, broth and Cajun seasoning and simmer 10 minutes, mashing a few beans to thicken. Serve over rice.',
  ]],
  ['Breakfast for Dinner: Pancakes & Bacon', 25, LD, ['2 cups pancake mix', '1 1/2 cups milk', '2 eggs', '12 slices bacon', '1/2 cup maple syrup', '2 tbsp butter'], [
    'Cook the bacon in the oven at 400°F for 15–18 minutes.',
    'Whisk the pancake mix with milk and eggs and cook 1/4-cup scoops on a buttered griddle until bubbles form, then flip.',
    'Serve with syrup and bacon.',
  ]],
  // Breakfast
  ['Scrambled Eggs on Toast', 10, B, ['8 eggs', '2 tbsp butter', '1/4 cup milk', '4 slices bread'], [
    'Whisk the eggs with milk, salt and pepper.',
    'Cook in butter over low heat, stirring gently, until just set.',
    'Serve on buttered toast.',
  ]],
  ['Cheese Omelettes', 15, B, ['8 eggs', '1 cup shredded cheese', '2 tbsp butter', '2 green onions'], [
    'Whisk 2 eggs per omelette with a pinch of salt.',
    'Pour into a buttered nonstick pan over medium heat, tilting to set the edges.',
    'Add cheese and green onion, fold and slide onto a plate. Repeat.',
  ]],
  ['Breakfast Burritos', 20, B, ['8 eggs', '8 oz breakfast sausage', '4 large tortillas', '1 cup shredded cheese', '1/2 cup salsa'], [
    'Brown the sausage, breaking it up, then add the whisked eggs and scramble.',
    'Fill the tortillas with eggs, cheese and salsa and roll up.',
  ]],
  ['French Toast', 20, B, ['8 slices bread', '4 eggs', '1 cup milk', '1 tsp cinnamon', '1 tsp vanilla', '2 tbsp butter', '1/2 cup maple syrup'], [
    'Whisk the eggs, milk, cinnamon and vanilla.',
    'Dip each slice of bread and cook in butter over medium heat, 2–3 minutes a side.',
    'Serve with syrup.',
  ]],
  ['Overnight Oats', 5, B, ['2 cups rolled oats', '2 cups milk', '1 cup greek yogurt', '2 tbsp honey', '1 cup berries'], [
    'Mix the oats, milk, yogurt and honey and divide among 4 jars.',
    'Refrigerate overnight and top with berries in the morning.',
  ]],
  ['Yogurt Parfaits', 5, B, ['3 cups greek yogurt', '1 cup granola', '2 cups berries', '2 tbsp honey'], [
    'Layer yogurt, berries and granola in glasses and drizzle with honey.',
  ]],
  ['Peanut Butter Banana Toast', 5, B, ['4 slices bread', '4 tbsp peanut butter', '2 bananas', '1 tbsp honey'], [
    'Toast the bread and spread with peanut butter.',
    'Top with sliced banana and a drizzle of honey.',
  ]],
  ['Bagels with Cream Cheese', 5, B, ['4 bagels', '8 oz cream cheese', '1 cucumber', '1 tomato'], [
    'Split and toast the bagels.',
    'Spread with cream cheese and top with sliced cucumber and tomato.',
  ]],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Turn the table above into recipe drafts for finalizeRecipe(). */
export function easyMealDrafts(parseIngredientLine) {
  return EASY_MEALS.map(([name, minutes, mealTypes, ingredients, steps]) => ({
    id: `easy-${slug(name)}`,
    source: 'Easy meals',
    sourceUrl: '',
    name,
    category: mealTypes[0] === 'breakfast' ? 'Breakfast' : 'Easy',
    cuisine: '',
    image: '',
    servings: 4,
    totalMinutes: minutes,
    tags: ['Easy'],
    ingredients: ingredients.map(parseIngredientLine),
    instructions: steps,
    mealTypes,
    easy: true,
    addedAt: '2026-10-01T00:00:00.000Z',
  }));
}
