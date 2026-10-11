# Weekly Meal Planner

A self-hostable weekly meal planner for your household. Randomize a week of meals, lock in the ones you like, and get an automatically built grocery list. Works on phones, tablets, laptops, desktops and TVs.

## Features

- **Week by week planning.** Every week has its own plan. Move between weeks with the arrows, or tap the date to jump back to this week.
- **Randomize** fills every unlocked meal. It avoids repeats within a week, and avoids last and next week's meals when it can.
- **Lock** 🔒 a meal you like and the randomizer will keep it. You can also re-roll 🎲 a single meal, or choose one by hand (hand-picked meals are locked automatically).
- **Grocery list tab.** The week's ingredients are merged, scaled to your household size, and sorted by aisle. You can check items off, add your own (paper towels, snacks…), hide checked items, and copy or share the list.
- **840+ recipes are included**, pulled from [TheMealDB](https://www.themealdb.com) and [DummyJSON](https://dummyjson.com/docs/recipes).
  - **Pull more recipes** fetches anything new from those sources.
  - **Import from URL** grabs a recipe from almost any recipe site that publishes standard recipe data (BBC Good Food, blogs, etc.).
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

No `npm install` needed, because there are no dependencies.

```bash
npm start            # http://localhost:3000
```

| Env var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `0.0.0.0` | Interface to bind |
| `DATA_DIR` | `./data` | Where `db.json` is stored |
| `APP_PASSWORD` | _(none)_ | Turns on HTTP basic auth |
| `ALLOW_PRIVATE_IMPORTS` | `false` | Allow "Import from URL" to reach LAN addresses |

If your server reaches the internet through an HTTP proxy, start Node with `NODE_USE_ENV_PROXY=1` (Node 22.21+) so recipe fetching uses `HTTPS_PROXY`.

## Notes

- **Costs are estimates.** They come from a simple per-ingredient price table, so they're good for comparing recipes, not exact. Set your own price on any recipe (open it → *Edit price…*).
- **Protein and allergen detection** reads each recipe's ingredients. Fish sauce, oyster sauce and Worcestershire don't count as fish/shellfish, but anchovies do. If you're avoiding a protein because of an **allergy**, still check the ingredients yourself.
- The bundled recipes live in `server/seed/recipes.json`. You can regenerate them with `npm run fetch-recipes`. New seed recipes are added to an existing database on startup, and your favorites and edits are never overwritten.
- Removing a recipe hides it, so a later refresh won't bring it back.

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
server/lib/sources.js  TheMealDB, DummyJSON, URL import
public/                frontend (vanilla JS, no build step)
```
