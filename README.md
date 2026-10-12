# Weekly Meal Planner

A self-hostable weekly meal planner for your household. Randomize a week of meals, lock in the ones you like, and get an automatically built grocery list. Works on phones, tablets, laptops, desktops and TVs.

## Features

- **Week by week planning.** Every week has its own plan. Move between weeks with the arrows, or tap the date to jump back to this week.
- **Randomize** fills every unlocked meal. It avoids repeats within a week, and avoids last and next week's meals when it can. Versions of the same dish (Chicken Alfredo, Fettuccine Alfredo…) count as one, and it remembers the last 40 meals it showed you that week, so clicking 🎲 again keeps bringing up something new.
- **Lock** 🔒 a meal you like and the randomizer will keep it. You can also re-roll 🎲 a single meal, or choose one by hand (hand-picked meals are locked automatically).
- **Drag meals between days.** Drag a meal onto another day and the two meals swap places. Every other day stays the same, and each meal keeps its own lock.
  - Mouse: drag the tile.
  - Phone or tablet: press and hold the tile, or drag the ⠿ handle on its photo.
  - Keyboard or TV remote: focus the handle and use the arrow keys.
- **Macros and healthier meals.** Every recipe shows calories, protein, carbs, fat and fiber per serving, plus a 0–100 health score.
  - Each day on the plan shows its total per person, with a protein/carbs/fat bar and optional daily calorie and protein targets.
  - **Healthier meals** mode only randomizes recipes with a good health score and favors the healthiest. You can also cap calories or require a minimum amount of protein per serving.
  - Macros come from the recipe itself when it publishes them; otherwise they're estimated from the ingredients.
- **Grocery list tab.** The week's ingredients are merged, scaled to your household size, and sorted by aisle. Tick items as they go in the cart (they move to an "In the cart" section), add your own items (paper towels, snacks…), and copy or share the list.
- **Pantry tab ("already have").** List what's in your pantry, spice rack, fridge and freezer. Grocery items you already have are moved to "Already have" automatically and left out of price totals.
  - "Rice" covers basmati rice and "chicken" covers chicken thighs, but "chicken" doesn't cover chicken stock.
  - Tap the jar on any list item to add it to the pantry. Tap **Need to buy** when you've run out.
  - **Running low ⚠:** tap the triangle next to any ingredient in a recipe (or any pantry item) and it goes on the grocery list, even if no meal this week needs it. Ticking it off in the cart counts as restocked.
  - **Suggestions as you type** from a built-in list of about 450 common US pantry items: spices, dried herbs, seasoning blends, oils and fats, butter and dairy, vinegars, sauces, baking goods, grains, canned goods and freezer staples. "Auto place" files each one in the right spot (cumin → Spices, butter → Fridge).
  - **Browse the list** to tick everything you have in one go, which is handy when setting up.
  - Matching knows that garlic salt isn't salt, brown sugar isn't sugar and ground ginger isn't fresh ginger, while stock and broth (or chili flakes and red pepper flakes) count as the same thing.
  - **Scan a shelf:** take a photo of your spice rack, a pantry shelf or your oils and Claude reads the labels into a list (needs an Anthropic API key, see [Photo scanning](#photo-scanning)). You check and fix the list before anything is added.
  - **Scan barcodes:** point the camera at barcodes and each product is looked up on [Open Food Facts](https://world.openfoodfacts.org) (free, no key). Live camera scanning works in Chrome on Android; on iPhone, type the number under the barcode or use photo scanning.
- **Store prices and the cheapest shop** (optional: turn on *Show Prices and Shop plan tabs* in Settings → Stores & prices). Pick the two stores you use (Meijer, Aldi, Walmart, Target, Kroger, Costco and more). Meal costs per serving don't depend on these tabs.
  - **Compare prices:** each item's price at both stores, and which one is cheaper.
  - **Shopping plan:** compares "all at store A", "all at store B" and splitting the trip. A split is only recommended when it saves at least the amount you set. Each store gets its own list, sorted by aisle.
  - Tap any price to enter the real price and aisle. It's saved and used every week from then on.
  - Prices start as estimates (see Notes): typical US prices for the package size you need, adjusted by each store's usual price level, which you can tune.
- **840+ recipes are included**, pulled from [TheMealDB](https://www.themealdb.com) and [DummyJSON](https://dummyjson.com/docs/recipes).
  - **Pull from recipe databases** fetches anything new from those sources.
  - **Import link / TikTok** grabs a recipe from almost any recipe page, including creator blogs without standard recipe data.
  - **TikTok videos:** paste a video link and the app pulls in the caption, creator and cover image. If the caption has the ingredients, it imports straight away. Otherwise the recipe editor opens so you can finish it while you watch.
  - **Creators:** follow a creator's recipe website and pull in their newest recipes. Hunt4Shredz and AmateurProChef are set up by default. Chef Zealand and Aussie Fitness don't post free recipes online, so save their TikToks by link.
  - **New recipe / Edit:** type in your own recipes or fix any recipe, with optional macros.
  - Different versions of the same dish are kept as separate recipes, so "Lasagne" can be a different recipe from week to week.
- **Favorites** ♥. Favorited recipes are 3× more likely to be randomized (you can turn this off). You can filter the recipe library to favorites only.
- **Target price per serving.** The randomizer only picks recipes at or under your target. Each recipe gets an estimated cost, and you can set your own price on any recipe.
- **Proteins to avoid.** Mark fish, shellfish, pork, beef, etc. and the randomizer will never pick a recipe containing them.
- **Allergies & dislikes.** Turn on allergen groups (peanuts, tree nuts, dairy, gluten/wheat, eggs, soy, sesame, fish, shellfish, mustard, celery) and list any ingredients you just don't eat (mushrooms, olives…).
  - The randomizer never picks those recipes.
  - Anything already planned that contains them is flagged with ⚠, and the matching ingredients are highlighted in the recipe.
  - Allergen groups catch hidden sources too, like butter for dairy or soy sauce for gluten.
  - Common alternative names are matched as well (cilantro/coriander, eggplant/aubergine, shrimp/prawn…).
- **Meals per day.** Plan breakfast, lunch and/or dinner (dinner only by default).
- **Easy meals.** About 50 low-effort meals are built in (grilled cheese, quesadillas, tacos, sloppy joes, wraps, fried rice, breakfast burritos…), and any short, quick recipe counts as easy too. Filter by **Easy** on the Recipes tab, or tick **Easy meal** on your own recipes.
  - **Easy meals on weekends** (Settings) makes the randomizer pick easy meals on Saturday and Sunday. Use the ⚡ row in the days grid to choose other easy days.
  - Turning it on swaps this week's unlocked meals on those days for easy ones. Locked meals are never changed.
- **Meal days.** In Settings, switch off any meal on any weekday (e.g. no dinner on Wednesdays). Those become "fend for yourself": nothing is planned and nothing goes on the grocery list. You can also skip a single meal, or plan one anyway, for just this week from the plan.
- **PIN lock.** You set a PIN (4–8 digits) the first time you open the app; after that each device asks for it once every 24 hours. Wrong guesses are slowed down (5 tries, then waits that grow), so a PIN can't be guessed. Change the PIN, lock a device or sign out every device in Settings.
- **Responsive, modern UI.** It scales smoothly from phone to 4K TV, has a black, dark grey and orange theme (a light theme is available in Settings), can be installed to a phone's home screen (PWA), and can be driven with a keyboard or TV remote.
- **Shared by the whole household.** Data lives on the server, so every device sees the same plan.

## Run it

### Docker (recommended)

```bash
docker compose up -d --build
```

Then open `http://<your-server>:3000`. Data is stored in `./data/db.json` (a single file, so backups are easy).

To require a password, set `APP_PASSWORD` in `docker-compose.yml`. Any username works.

### Plain Node.js (18+)

```bash
npm install --omit=dev   # only needed for photo scanning (the Anthropic SDK)
npm start                # http://localhost:3000
```

Everything except photo scanning runs without `npm install`.

| Env var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `0.0.0.0` | Interface to bind |
| `DATA_DIR` | `./data` | Where `db.json` is stored |
| `APP_PASSWORD` | _(none)_ | Turns on HTTP basic auth |
| `ALLOW_PRIVATE_IMPORTS` | `false` | Allow "Import from URL" to reach LAN addresses |
| `ANTHROPIC_API_KEY` | _(none)_ | Turns on photo scanning for the pantry |

If your server reaches the internet through an HTTP proxy, start Node with `NODE_USE_ENV_PROXY=1` (Node 22.21+) so recipe fetching uses `HTTPS_PROXY`.

### Photo scanning

Photo scanning sends the photo to Claude (`claude-opus-5-5`) to read the labels. It needs an API key from [console.anthropic.com](https://console.anthropic.com) and costs about 1–2 cents per photo. Photos are shrunk in the browser first (1568 pixels on the long side) and are not stored.

For the systemd setup, keep the key in a file only root can read:

```bash
cd /opt/meal-planner && npm install --omit=dev
echo 'ANTHROPIC_API_KEY=sk-ant-...' > /etc/meal-planner.env && chmod 600 /etc/meal-planner.env
systemctl edit meal-planner      # add these two lines, then save:
#   [Service]
#   EnvironmentFile=/etc/meal-planner.env
systemctl restart meal-planner
```

With Docker, add `ANTHROPIC_API_KEY` under `environment:` in `docker-compose.yml`. The request uses Anthropic's server-side fallback, so if a photo is ever declined by a safety check it's retried on another model automatically. The app allows up to 30 photo scans an hour.

## Notes

- **Costs are estimates.** Meijer, Aldi, Walmart and Target don't publish prices for other apps, so store prices start from typical US prices for each package size, adjusted by a rough price level per store (Settings → Stores & prices).
  - Estimates are good for comparing, not exact. With estimates alone one store usually wins everything; the split plan gets useful as you enter real prices.
  - Tap a price on the Groceries tab to save the real one and its aisle. You can also set your own cost per serving on any recipe (open it → *Edit price…*).
- **Macros are estimates** unless the recipe publishes its own. They're calculated from the ingredient amounts using standard nutrition values. When TheMealDB doesn't say how many a recipe serves, servings are estimated from the total amount of food.
- **TikTok** doesn't let other apps read creators' videos or recipes, so the app uses TikTok's public embed info for a single video link (caption, creator, cover). Cover images from TikTok expire after a while; a placeholder shows instead.
- **Creator websites** are read one page at a time with a pause between pages, following each site's robots.txt.
- **Protein and allergen detection** reads each recipe's ingredients. Fish sauce, oyster sauce and Worcestershire don't count as fish/shellfish, but anchovies do. If you're avoiding a protein because of an **allergy**, still check the ingredients yourself.
- The bundled recipes live in `server/seed/recipes.json`. You can regenerate them with `npm run fetch-recipes`. New seed recipes are added to an existing database on startup, and your favorites and edits are never overwritten.
- Removing a recipe hides it, so a later refresh won't bring it back.

## Forgot the PIN?

On the server, create a file named `reset-pin` in the data folder and restart the app. The PIN is cleared, and the next visit asks you to set a new one:

```bash
touch /var/lib/meal-planner/reset-pin && systemctl restart meal-planner   # plain Node / systemd
touch ./data/reset-pin && docker compose restart                          # Docker
```

## Development

```bash
npm run dev   # restarts on file changes
npm test
```

Project layout:

```
server/index.js        HTTP server + REST API
server/store.js        JSON-file storage
server/lib/planner.js  randomizer
server/lib/grocery.js  ingredient parsing + grocery list
server/lib/recipes.js  protein / meal-type / cost detection
server/lib/sources.js  TheMealDB, DummyJSON, URL / TikTok import, creator websites
server/lib/nutrition.js macros + health score
server/lib/ingredients.js ingredient nutrition, weights and typical prices
server/lib/pricing.js  store price comparison + cheapest shopping plan
server/lib/custom.js   recipes added or edited by hand
public/                frontend (vanilla JS, no build step)
```
