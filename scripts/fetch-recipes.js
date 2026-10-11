// Downloads recipes from TheMealDB and DummyJSON into server/seed/recipes.json.
// The seed file ships with the app so it works offline on first boot; the
// "Pull more recipes" button in the app does the same thing at runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllSources } from '../server/lib/sources.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'seed', 'recipes.json');
const recipes = await fetchAllSources((m) => console.warn(m));
recipes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
const stamped = recipes.map((r) => ({ ...r, addedAt: '2026-01-01T00:00:00.000Z' }));
fs.writeFileSync(out, `${JSON.stringify(stamped, null, 1)}\n`);
console.log(`Saved ${recipes.length} recipes to ${path.relative(process.cwd(), out)}`);
