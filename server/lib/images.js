// Recipe photos from other sites (TikTok covers, creator blogs), fetched once by
// the server and kept in DATA_DIR/images. The app then shows them from its own
// address, so browser tracker blocking can't hide them and TikTok's expiring
// cover links keep working.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertPublicUrl } from './sources.js';

const MAX_BYTES = 8 * 1024 * 1024;
// SVG can carry scripts, so it is never served from the app's own address.
const ALLOWED = /^image\/(jpeg|png|webp|gif|avif)$/;
// Image hosts that refuse unfamiliar clients still serve an ordinary browser.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const pending = new Map();

/** Path and type of the cached copy of `url`, downloading it the first time. */
export function cachedImage(url, dir, fetchImpl = fetch) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  const file = path.join(dir, key);
  const meta = `${file}.type`;
  if (fs.existsSync(file) && fs.existsSync(meta)) return Promise.resolve({ file, type: fs.readFileSync(meta, 'utf8') });
  // Several cards asking for the same photo at once share one download.
  if (!pending.has(key)) {
    pending.set(key, download(url, fetchImpl).then(({ type, bytes }) => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${file}.tmp`, bytes);
      fs.renameSync(`${file}.tmp`, file);
      fs.writeFileSync(meta, type);
      return { file, type };
    }).finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

async function download(raw, fetchImpl) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    // Every hop is checked, so a redirect can't point the server at your own network.
    await assertPublicUrl(url);
    const res = await fetchImpl(url, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/*;q=0.8' }, signal: AbortSignal.timeout(15000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url).href;
      continue;
    }
    if (!res.ok) throw new Error(`Image request failed (${res.status})`);
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.test(type)) throw new Error('Not a supported image');
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('Image too large');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error('Image too large');
    return { type, bytes };
  }
  throw new Error('Too many redirects');
}
