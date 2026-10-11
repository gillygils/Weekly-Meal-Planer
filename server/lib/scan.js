// Scanning the pantry with a camera:
//  - a photo of a shelf or spice rack is read by Claude (needs ANTHROPIC_API_KEY)
//  - a barcode is looked up on Open Food Facts (free, no key)
import { normalizeIngredientName, aisleFor } from './grocery.js';

export const SCAN_MODEL = 'claude-opus-5-5';
const PLACES = ['pantry', 'spices', 'fridge', 'freezer'];

export const aiScanEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let sdk = null;
async function anthropic() {
  // Loaded on first use so the rest of the app runs even without `npm install`.
  if (!sdk) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    sdk = { Anthropic, client: new Anthropic({ maxRetries: 1, timeout: 90_000 }) };
  }
  return sdk;
}

const PROMPT = `This is a photo of food someone has at home: a pantry shelf, spice rack, fridge, freezer or cooking oils.
List every food item you can identify so it can be added to their meal-planner pantry.

- Use the plain ingredient name a recipe would use, lowercase, without brand or size: "ground cumin" -> "cumin", "McCormick Garlic Powder" -> "garlic powder", "Bertolli Extra Virgin Olive Oil" -> "olive oil", "Kroger Long Grain White Rice" -> "white rice".
- Read labels carefully. Only include an item when you can actually read or clearly recognize it; leave out anything you would be guessing at.
- "where" is spices for dried herbs, spices and seasoning blends; fridge or freezer if the photo is clearly inside one; otherwise pantry (oils, vinegars, sauces, grains, cans, baking goods).
- List each item once, and skip anything that isn't food.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          where: { type: 'string', enum: PLACES },
        },
        required: ['name', 'where'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

export class ScanError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Read the items in one or more photos (base64 JPEG/PNG/WebP). Returns [{ name, where }]. */
export async function scanPhotos(images) {
  if (!aiScanEnabled()) throw new ScanError(501, 'Photo scanning needs an Anthropic API key on the server (see README).');
  let Anthropic, client;
  try {
    ({ Anthropic, client } = await anthropic());
  } catch {
    throw new ScanError(501, 'Photo scanning needs the Anthropic SDK: run `npm install --omit=dev` in the app folder and restart.');
  }
  let response;
  try {
    response = await client.beta.messages.create({
      model: SCAN_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } })),
          { type: 'text', text: PROMPT },
        ],
      }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ScanError(502, 'The Anthropic API key on the server was rejected.');
    if (err instanceof Anthropic.RateLimitError) throw new ScanError(429, 'Too many scans right now. Try again in a minute.');
    if (err instanceof Anthropic.BadRequestError) throw new ScanError(400, `The photo couldn't be read: ${err.message}`);
    if (err instanceof Anthropic.APIError) throw new ScanError(502, `Photo scanning failed (${err.status ?? 'network'}). Try again.`);
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new ScanError(422, "That photo couldn't be scanned. Try another one.");
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ScanError(502, 'Photo scanning returned something unexpected. Try again.');
  }
  return cleanItems(parsed.items);
}

export function cleanItems(items) {
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const name = String(it?.name || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
    const key = normalizeIngredientName(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, where: PLACES.includes(it.where) ? it.where : 'pantry' });
  }
  return out.slice(0, 100);
}

// Words on packaging that aren't part of the ingredient's name.
const PACKAGING = /\b(organic|natural|pure|premium|original|classic|all[- ]natural|100%?|fine|coarse|ground|whole|imported|value|family size|grinder|non[- ]gmo|gluten[- ]free|kosher|seasoning salt free)\b/gi;

/** Turn an Open Food Facts product into a pantry-style name, e.g. "McCormick Ground Cumin" -> "cumin". */
export function productToName(product) {
  let name = String(product.product_name_en || product.product_name || product.generic_name_en || product.generic_name || '').trim();
  for (const brand of String(product.brands || '').split(',').map((b) => b.trim()).filter(Boolean)) {
    name = name.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('s)?\\b`, 'ig'), '');
  }
  name = name.replace(/\([^)]*\)/g, '').replace(/\b\d+(\.\d+)?\s*(oz|fl oz|g|kg|ml|l|lb|ct)\b/gi, '').replace(PACKAGING, '');
  name = name.replace(/\s+/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '').toLowerCase();
  return name.slice(0, 60);
}

export function placeForProduct(product, name = productToName(product)) {
  const cats = (product.categories_tags || []).join(' ');
  if (/frozen/.test(cats)) return 'freezer';
  if (/spice|herb|seasoning|condiment-salt|salts|peppers-ground/.test(cats) || /Spices/.test(aisleFor(name))) return 'spices';
  if (/dairies|dairy|fresh-meat|eggs|yogurt|cheese/.test(cats)) return 'fridge';
  return 'pantry';
}

/** Look up a barcode on Open Food Facts. Returns { code, name, where, brand } or null. */
export async function lookupBarcode(code, fetchImpl = fetch) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,generic_name,generic_name_en,brands,categories_tags`;
  const res = await fetchImpl(url, {
    headers: { 'user-agent': 'WeeklyMealPlanner/1.0 (self-hosted meal planner)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new ScanError(502, `The barcode lookup failed (${res.status}). Try again.`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const name = productToName(data.product);
  if (!name) return null;
  return { code, name, where: placeForProduct(data.product, name), brand: String(data.product.brands || '').split(',')[0].trim() };
}
