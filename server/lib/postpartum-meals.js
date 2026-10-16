// Built-in meals for recovering after birth. Written for this app around the
// nutrients postpartum guidance keeps coming back to: protein for healing,
// iron and B12 to rebuild blood, omega-3 DHA (low-mercury fish), choline
// (eggs), folate (greens, beans), calcium and vitamin D (dairy, salmon),
// fiber, healthy fats and warm, easy-to-digest soups and stews that many
// cultures serve new mothers. Amounts are for 4 servings.
//
// This is everyday food, not medical advice: iron or vitamin D levels, and
// anything about milk supply, are worth checking with a doctor or midwife.
//
// [name, minutes, meal types, easy, why it helps, ingredients, steps]

const B = ['breakfast'];
const LD = ['lunch', 'dinner'];
const BLD = ['breakfast', 'lunch', 'dinner'];

export const POSTPARTUM_MEALS = [
  ['Steak, Eggs & Avocado Bowl', 25, BLD, true, 'Iron, zinc and B12 from steak; choline from eggs; healthy fats and potassium from avocado.', [
    '1.5 lb sirloin steak', '8 eggs', '2 avocados', '4 cups baby spinach', '2 cups cooked rice', '1 tbsp olive oil', '1 tsp salt', '1/2 tsp black pepper', '1 lemon'], [
    'Season the steak with salt and pepper. Sear in a hot oiled skillet 4–5 minutes a side for medium; rest 5 minutes and slice.',
    'In the same pan, wilt the spinach for a minute, then fry or scramble the eggs.',
    'Fill bowls with rice, spinach, steak and eggs. Top with sliced avocado and a squeeze of lemon.',
  ]],
  ['Salmon, Sweet Potato & Broccoli Sheet Pan', 35, LD, true, 'Omega-3 DHA and vitamin D from salmon; vitamin A and fiber from sweet potato; vitamin C and folate from broccoli.', [
    '1.5 lb salmon fillets', '2 sweet potatoes', '1 head broccoli', '3 tbsp olive oil', '1 tsp garlic powder', '1 tsp salt', '1 lemon'], [
    'Heat the oven to 425°F. Cube the sweet potatoes, toss with half the oil and salt, and roast 15 minutes.',
    'Add broccoli florets and the salmon, brush with the rest of the oil and season with garlic powder and salt.',
    'Roast 12–15 more minutes until the salmon flakes. Finish with lemon.',
  ]],
  ['Korean Seaweed Soup with Beef (Miyeok-guk)', 40, LD, false, 'The traditional Korean birthday and postpartum soup: iodine and iron from seaweed, protein and iron from beef, warm and gentle.', [
    '1 oz dried seaweed', '1/2 lb beef brisket', '1 tbsp sesame oil', '3 cloves garlic', '2 tbsp soy sauce', '8 cups water', '1 tsp salt', '2 cups cooked rice'], [
    'Soak the seaweed in water for 20 minutes, drain, squeeze dry and cut into bite-size pieces.',
    'Slice the beef thinly. Sauté beef and minced garlic in the sesame oil until browned, then add the seaweed and stir 2 minutes.',
    'Add the water and soy sauce, bring to a boil and simmer 20–30 minutes. Salt to taste and serve with rice.',
  ]],
  ['Ginger Chicken Soup', 45, LD, false, 'A warming soup served to new mothers across Asia: protein, collagen-rich broth and ginger, easy on digestion.', [
    '2 lb chicken thighs', '3 inch piece ginger', '1 tbsp sesame oil', '8 cups chicken broth', '2 carrots', '4 cups bok choy', '2 green onions', '1 tbsp soy sauce'], [
    'Slice the ginger into thin coins and fry in the sesame oil until fragrant.',
    'Add the chicken, broth and sliced carrots. Simmer 30 minutes until the chicken is tender, then shred it.',
    'Add the bok choy for the last 3 minutes. Season with soy sauce and top with green onions.',
  ]],
  ['Chicken Bone Broth Rice Soup', 40, LD, true, 'Broth for hydration and minerals, chicken for protein, rice and carrots for gentle energy.', [
    '1.5 lb chicken breast', '8 cups bone broth', '1 cup white rice', '2 carrots', '2 celery stalks', '1 onion', '2 cloves garlic', '1 tbsp olive oil', '1 tsp salt', '2 cups baby spinach'], [
    'Soften the diced onion, carrots, celery and garlic in the oil.',
    'Add the broth, rice and whole chicken breasts; simmer 25 minutes.',
    'Shred the chicken back into the pot, stir in the spinach until wilted and season.',
  ]],
  ['Red Lentil & Spinach Dal', 35, LD, true, 'Plant iron, folate, fiber and protein from lentils; more iron and folate from spinach; turmeric and ginger for warmth.', [
    '1.5 cups red lentils', '1 can coconut milk', '4 cups water', '1 onion', '3 cloves garlic', '1 tbsp ginger', '1 tsp turmeric', '1 tsp cumin', '4 cups baby spinach', '2 tbsp olive oil', '1 tsp salt', '2 cups cooked rice'], [
    'Soften the onion, garlic and ginger in the oil; stir in the turmeric and cumin for 30 seconds.',
    'Add rinsed lentils, water and coconut milk. Simmer 20 minutes, stirring, until thick and soft.',
    'Stir in the spinach, season and serve over rice. A squeeze of lemon helps your body absorb the iron.',
  ]],
  ['Beef & Barley Stew', 90, LD, false, 'Iron, zinc and B12 from beef; fiber and slow-release energy from barley; root vegetables for vitamins.', [
    '2 lb beef chuck', '3/4 cup pearl barley', '3 carrots', '2 potatoes', '1 onion', '2 celery stalks', '6 cups beef broth', '2 tbsp tomato paste', '2 tbsp olive oil', '1 tsp thyme', '1 tsp salt'], [
    'Cube and brown the beef in batches in the oil; set aside.',
    'Soften the onion and celery, stir in the tomato paste, then return the beef with the broth, barley and thyme.',
    'Simmer covered 1 hour, add the carrots and potatoes and cook 25 more minutes until tender.',
  ]],
  ['Turkey & Bean Chili', 40, LD, true, 'Lean protein, iron and fiber; beans add folate and magnesium. Makes great leftovers or freezer meals.', [
    '1.5 lb ground turkey', '2 cans kidney beans', '1 can black beans', '1 can diced tomatoes', '1 onion', '1 bell pepper', '2 tbsp chili powder', '1 tsp cumin', '2 cups chicken broth', '1 tbsp olive oil', '1/2 cup Greek yogurt', '1 avocado'], [
    'Brown the turkey with the onion and pepper in the oil.',
    'Add the spices, beans (drained), tomatoes and broth. Simmer 25 minutes.',
    'Serve topped with Greek yogurt and avocado.',
  ]],
  ['Spinach Shakshuka', 30, BLD, true, 'Choline and protein from eggs, folate and iron from spinach, lycopene from tomatoes.', [
    '8 eggs', '1 can crushed tomatoes', '1 onion', '1 bell pepper', '3 cloves garlic', '4 cups baby spinach', '1 tsp cumin', '1 tsp paprika', '2 tbsp olive oil', '1/2 cup feta cheese', '4 slices whole wheat bread'], [
    'Soften the onion, pepper and garlic in the oil, add the spices, then the tomatoes; simmer 10 minutes.',
    'Stir in the spinach. Make 8 wells and crack in the eggs.',
    'Cover and cook 6–8 minutes until the whites set. Top with feta and serve with toast.',
  ]],
  ['Veggie & Cheese Egg Muffins', 30, B, true, 'Grab-and-go protein and choline for one-handed breakfasts; make a batch for the week.', [
    '12 eggs', '1 cup shredded cheddar cheese', '2 cups baby spinach', '1 bell pepper', '1/2 cup milk', '1/2 tsp salt', '1/4 tsp black pepper'], [
    'Heat the oven to 375°F and grease a 12-cup muffin tin.',
    'Whisk the eggs, milk, salt and pepper. Divide chopped spinach, pepper and cheese among the cups and pour the egg over.',
    'Bake 20 minutes until set. Keeps 4 days in the fridge.',
  ]],
  ['Lactation Overnight Oats', 10, B, true, 'Oats, flax and chia for fiber and omega-3 ALA, Greek yogurt for protein and calcium. Oats are a traditional milk-supply food.', [
    '2 cups rolled oats', '2 cups milk', '1 cup Greek yogurt', '2 tbsp ground flaxseed', '2 tbsp chia seeds', '2 tbsp honey', '1 cup blueberries', '1/4 cup walnuts'], [
    'Stir the oats, milk, yogurt, flax, chia and honey together and divide among 4 jars.',
    'Refrigerate overnight.',
    'Top with blueberries and walnuts in the morning.',
  ]],
  ['Greek Yogurt Parfait with Berries & Walnuts', 5, B, true, 'Protein and calcium from yogurt, antioxidants and vitamin C from berries, omega-3 from walnuts.', [
    '4 cups Greek yogurt', '2 cups mixed berries', '1 cup granola', '1/2 cup walnuts', '2 tbsp honey', '2 tbsp ground flaxseed'], [
    'Layer yogurt, berries and granola in 4 glasses.',
    'Top with walnuts, flax and a drizzle of honey.',
  ]],
  ['Peanut Butter Banana Oatmeal', 10, B, true, 'Warm, filling fiber and steady energy; peanut butter adds protein and healthy fats, banana adds potassium.', [
    '2 cups rolled oats', '4 cups milk', '2 bananas', '4 tbsp peanut butter', '2 tbsp ground flaxseed', '1 tsp cinnamon', '1 tbsp honey'], [
    'Simmer the oats in the milk 5 minutes, stirring.',
    'Stir in the flax and cinnamon.',
    'Top with sliced banana, peanut butter and honey.',
  ]],
  ['Smoked Salmon & Avocado Toast with Eggs', 15, B, true, 'Omega-3 DHA from salmon, choline from eggs, fiber from whole grain bread, healthy fats from avocado.', [
    '8 slices whole wheat bread', '2 avocados', '8 oz smoked salmon', '8 eggs', '1 lemon', '1/2 tsp black pepper'], [
    'Toast the bread and mash the avocado with lemon and pepper.',
    'Soft-scramble or poach the eggs.',
    'Spread avocado on the toast and top with salmon and eggs.',
  ]],
  ['Baked Salmon with Quinoa & Asparagus', 30, LD, true, 'Omega-3 DHA and vitamin D from salmon, complete protein and magnesium from quinoa, folate from asparagus.', [
    '1.5 lb salmon fillets', '1.5 cups quinoa', '1 bunch asparagus', '3 tbsp olive oil', '2 cloves garlic', '1 lemon', '1 tsp salt'], [
    'Cook the quinoa in 3 cups of water, 15 minutes.',
    'Lay the salmon and asparagus on a sheet pan, brush with oil, garlic and salt; bake at 400°F for 12–15 minutes.',
    'Serve over quinoa with lemon.',
  ]],
  ['Salmon Patties with Greek Yogurt Dill Sauce', 30, LD, true, 'An easy way to get omega-3s and calcium (canned salmon includes soft bones).', [
    '3 cans salmon', '2 eggs', '1/2 cup panko breadcrumbs', '2 green onions', '1 tbsp Dijon mustard', '2 tbsp olive oil', '1 cup Greek yogurt', '1 tbsp dill', '1 lemon', '4 cups salad greens'], [
    'Mix the drained salmon, eggs, panko, green onions and mustard; shape into 8 patties.',
    'Pan-fry in the oil 3–4 minutes a side until golden.',
    'Stir dill and lemon into the yogurt and serve with the patties and greens.',
  ]],
  ['Beef & Broccoli Stir-Fry', 25, LD, true, 'Iron and B12 from beef, vitamin C from broccoli to help absorb that iron.', [
    '1.5 lb flank steak', '1 head broccoli', '3 tbsp soy sauce', '1 tbsp honey', '1 tbsp cornstarch', '2 cloves garlic', '1 tbsp ginger', '2 tbsp vegetable oil', '3 cups cooked brown rice'], [
    'Slice the beef thinly across the grain and toss with the cornstarch.',
    'Sear the beef in hot oil in batches; set aside. Stir-fry the broccoli with garlic and ginger 3 minutes.',
    'Return the beef with the soy sauce and honey, toss until glossy and serve over brown rice.',
  ]],
  ['Turkey Spinach Meatballs with Marinara', 35, LD, false, 'Lean protein with spinach hidden inside for iron and folate.', [
    '1.5 lb ground turkey', '2 cups baby spinach', '1 egg', '1/2 cup breadcrumbs', '1/2 cup parmesan cheese', '2 cloves garlic', '1 jar marinara sauce', '12 oz whole wheat spaghetti'], [
    'Finely chop the spinach and mix with the turkey, egg, breadcrumbs, parmesan and garlic. Roll into 20 meatballs.',
    'Bake at 400°F for 18 minutes, then simmer in the marinara 5 minutes.',
    'Serve over whole wheat spaghetti.',
  ]],
  ['Sweet Potato & Black Bean Tacos', 30, LD, true, 'Fiber, folate and plant protein from black beans; vitamin A from sweet potato.', [
    '2 sweet potatoes', '2 cans black beans', '8 corn tortillas', '1 avocado', '1 cup Greek yogurt', '1 lime', '1 tsp cumin', '1 tsp chili powder', '2 tbsp olive oil', '2 cups shredded cabbage'], [
    'Cube the sweet potatoes, toss with oil and spices and roast at 425°F for 25 minutes.',
    'Warm the black beans and the tortillas.',
    'Fill the tortillas with sweet potato, beans, cabbage and avocado; top with yogurt and lime.',
  ]],
  ['Chickpea & Spinach Coconut Curry', 30, LD, true, 'Plant protein, iron and folate from chickpeas and spinach; warming spices.', [
    '2 cans chickpeas', '1 can coconut milk', '1 can diced tomatoes', '1 onion', '3 cloves garlic', '1 tbsp ginger', '2 tbsp curry powder', '4 cups baby spinach', '1 tbsp olive oil', '2 cups cooked brown rice'], [
    'Soften the onion, garlic and ginger in the oil, then stir in the curry powder.',
    'Add the chickpeas, tomatoes and coconut milk and simmer 15 minutes.',
    'Wilt in the spinach and serve over brown rice.',
  ]],
  ['Lamb & Lentil Stew', 75, LD, false, 'Iron, zinc and B12 from lamb plus iron and fiber from lentils: a very iron-rich, comforting stew.', [
    '1.5 lb lamb shoulder', '1 cup green lentils', '2 carrots', '1 onion', '3 cloves garlic', '1 can diced tomatoes', '5 cups chicken broth', '1 tsp cumin', '1 tsp cinnamon', '2 tbsp olive oil', '1 tsp salt'], [
    'Brown the cubed lamb in the oil; add the onion, garlic and spices.',
    'Add the tomatoes and broth, cover and simmer 40 minutes.',
    'Add the lentils and carrots and simmer 25 more minutes until tender.',
  ]],
  ['Chicken & Ginger Rice Congee', 60, BLD, false, 'A soft, soothing rice porridge traditionally given after birth: hydrating, gentle and easy to digest.', [
    '1 cup jasmine rice', '10 cups chicken broth', '1 lb chicken thighs', '2 inch piece ginger', '2 green onions', '1 tbsp soy sauce', '1 tsp sesame oil', '4 eggs'], [
    'Simmer the rinsed rice with the broth, whole chicken thighs and sliced ginger for 50 minutes, stirring now and then, until thick and creamy.',
    'Shred the chicken back in. Soft-boil the eggs (7 minutes).',
    'Serve topped with the eggs, green onions, soy sauce and sesame oil.',
  ]],
  ['Shepherd\'s Pie with Sweet Potato Top', 60, LD, false, 'Iron-rich beef with peas and carrots under a vitamin-A sweet potato mash. Freezes well.', [
    '1.5 lb ground beef', '3 sweet potatoes', '1 onion', '2 carrots', '1 cup frozen peas', '2 tbsp tomato paste', '1 cup beef broth', '1 tbsp Worcestershire sauce', '2 tbsp butter', '1/4 cup milk'], [
    'Boil the cubed sweet potatoes 15 minutes and mash with butter and milk.',
    'Brown the beef with the onion and carrots; stir in tomato paste, broth and Worcestershire and simmer 10 minutes, then add the peas.',
    'Spread into a baking dish, top with the mash and bake at 400°F for 20 minutes.',
  ]],
  ['Spinach & Feta Stuffed Chicken', 35, LD, false, 'High-protein chicken with spinach (folate, iron) and feta (calcium).', [
    '4 chicken breasts', '3 cups baby spinach', '1/2 cup feta cheese', '2 oz cream cheese', '2 cloves garlic', '1 tbsp olive oil', '1 tsp paprika', '1 lb green beans'], [
    'Wilt the spinach with the garlic, then mix with feta and cream cheese.',
    'Cut a pocket in each chicken breast, stuff with the spinach mix and season with paprika.',
    'Sear 3 minutes a side, then bake at 400°F for 18 minutes with the green beans alongside.',
  ]],
  ['Steak Fajita Burrito Bowls', 30, LD, true, 'Iron and B12 from steak, fiber from beans and brown rice, vitamin C from peppers.', [
    '1.5 lb flank steak', '2 bell peppers', '1 onion', '1 can black beans', '2 cups cooked brown rice', '1 avocado', '1/2 cup salsa', '1 cup Greek yogurt', '2 tbsp fajita seasoning', '1 tbsp olive oil', '1 lime'], [
    'Rub the steak with half the seasoning and sear 4 minutes a side; rest and slice.',
    'Cook the sliced peppers and onion with the rest of the seasoning.',
    'Build bowls with rice, beans, steak and peppers; top with avocado, salsa, yogurt and lime.',
  ]],
  ['Cottage Cheese Veggie Scramble', 10, B, true, 'Extra protein and calcium from cottage cheese, choline from eggs.', [
    '8 eggs', '1 cup cottage cheese', '2 cups baby spinach', '1 cup cherry tomatoes', '1 tbsp butter', '4 slices whole wheat bread'], [
    'Whisk the eggs with the cottage cheese.',
    'Wilt the spinach and tomatoes in the butter, add the eggs and stir gently until just set.',
    'Serve with toast.',
  ]],
  ['Lemon Salmon Pasta with Peas', 25, LD, true, 'Omega-3s from salmon and folate from peas in a quick weeknight pasta.', [
    '12 oz whole wheat pasta', '1 lb salmon fillets', '2 cups frozen peas', '1 lemon', '1/2 cup parmesan cheese', '2 tbsp olive oil', '2 cloves garlic', '1/2 cup Greek yogurt'], [
    'Cook the pasta, adding the peas for the last 2 minutes. Save a cup of pasta water.',
    'Pan-sear the salmon in the oil with the garlic, 4 minutes a side, then flake.',
    'Toss pasta and peas with lemon zest and juice, yogurt, parmesan and a splash of pasta water; fold in the salmon.',
  ]],
  ['Chicken & Sweet Potato Sheet Pan', 40, LD, true, 'Protein from chicken, vitamin A and fiber from sweet potatoes, folate from Brussels sprouts.', [
    '2 lb chicken thighs', '2 sweet potatoes', '1 lb Brussels sprouts', '3 tbsp olive oil', '1 tsp garlic powder', '1 tsp paprika', '1 tsp salt'], [
    'Heat the oven to 425°F. Toss the cubed sweet potatoes and halved sprouts with oil and salt.',
    'Season the chicken with garlic powder and paprika and nestle it in.',
    'Roast 30–35 minutes until the chicken reaches 165°F.',
  ]],
  ['Sardine & White Bean Salad', 10, LD, true, 'One of the richest sources of omega-3s, vitamin D and calcium, and very low in mercury.', [
    '2 cans sardines', '2 cans cannellini beans', '4 cups salad greens', '1 cup cherry tomatoes', '1/4 red onion', '3 tbsp olive oil', '1 lemon', '4 slices whole wheat bread'], [
    'Toss the drained beans, greens, tomatoes and sliced onion with the oil and lemon.',
    'Top with the sardines.',
    'Serve with toast.',
  ]],
  ['Shrimp & Veggie Fried Brown Rice', 20, LD, true, 'Lean protein and iodine from shrimp, choline from eggs, fiber from brown rice and vegetables.', [
    '1 lb shrimp', '4 cups cooked brown rice', '3 eggs', '2 cups frozen mixed vegetables', '3 tbsp soy sauce', '1 tbsp sesame oil', '2 cloves garlic', '2 green onions'], [
    'Scramble the eggs in half the sesame oil and set aside.',
    'Cook the shrimp and garlic 3 minutes, add the vegetables and rice and stir-fry until hot.',
    'Add the soy sauce, eggs and green onions.',
  ]],
  ['Beef & Vegetable Bone Broth Soup', 45, LD, true, 'Easy to sip while feeding the baby: iron from beef, minerals from broth, vitamins from vegetables.', [
    '1 lb ground beef', '8 cups bone broth', '2 carrots', '2 celery stalks', '1 onion', '2 potatoes', '1 can diced tomatoes', '2 cups baby spinach', '1 tsp thyme', '1 tsp salt'], [
    'Brown the beef with the onion; drain.',
    'Add the broth, tomatoes, diced carrots, celery, potatoes and thyme. Simmer 25 minutes.',
    'Stir in the spinach and season.',
  ]],
  ['Cod with Lemon, Potatoes & Green Beans', 30, LD, true, 'Lean, low-mercury fish for protein and iodine with simple roasted vegetables.', [
    '1.5 lb cod fillets', '1.5 lb baby potatoes', '1 lb green beans', '3 tbsp olive oil', '2 cloves garlic', '1 lemon', '1 tsp salt'], [
    'Roast the halved potatoes with half the oil at 425°F for 15 minutes.',
    'Add the green beans and cod, drizzle with the rest of the oil and garlic, and season.',
    'Roast 12 more minutes until the fish flakes; finish with lemon.',
  ]],
  ['Black Bean & Egg Breakfast Burritos', 20, B, true, 'Protein and choline from eggs, fiber and folate from beans. Wrap in foil and freeze for easy mornings.', [
    '8 eggs', '1 can black beans', '1 cup shredded cheddar cheese', '1/2 cup salsa', '4 large flour tortillas', '1 avocado', '1 tbsp butter'], [
    'Scramble the eggs in the butter.',
    'Warm the beans and tortillas.',
    'Fill the tortillas with eggs, beans, cheese, salsa and avocado and roll up.',
  ]],
  ['Berry Spinach Protein Smoothie', 5, B, true, 'Quick calories and protein for busy mornings: yogurt, spinach, berries, flax and nut butter.', [
    '2 cups Greek yogurt', '2 cups milk', '2 cups frozen berries', '2 cups baby spinach', '2 bananas', '2 tbsp almond butter', '2 tbsp ground flaxseed'], [
    'Blend everything until smooth.',
    'Pour into 4 glasses. Add more milk if it is too thick.',
  ]],
  ['Chicken, Avocado & Quinoa Power Bowl', 25, LD, true, 'Protein from chicken and quinoa, healthy fats from avocado, fiber and folate from greens and chickpeas.', [
    '1.5 lb chicken breast', '1.5 cups quinoa', '1 can chickpeas', '2 avocados', '4 cups salad greens', '1 cucumber', '1/4 cup tahini', '1 lemon', '2 tbsp olive oil', '1 tsp salt'], [
    'Cook the quinoa. Season and pan-sear the chicken in the oil, 6 minutes a side, then slice.',
    'Whisk the tahini with lemon juice and a little water.',
    'Build bowls with greens, quinoa, chickpeas, cucumber, chicken and avocado; drizzle with the tahini dressing.',
  ]],
];

const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function postpartumMealDrafts(parseIngredientLine) {
  return POSTPARTUM_MEALS.map(([name, minutes, mealTypes, easy, benefits, ingredients, steps]) => ({
    id: `postpartum-${slug(name)}`,
    source: 'Postpartum recovery',
    sourceUrl: '',
    name,
    category: mealTypes[0] === 'breakfast' ? 'Breakfast' : '',
    cuisine: '',
    image: '',
    servings: 4,
    totalMinutes: minutes,
    tags: ['Postpartum', ...(easy ? ['Easy'] : [])],
    ingredients: ingredients.map(parseIngredientLine),
    instructions: steps,
    mealTypes,
    easy,
    postpartum: true,
    benefits,
    addedAt: '2026-10-16T00:00:00.000Z',
  }));
}
