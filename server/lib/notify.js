// Phone notifications through ntfy (https://ntfy.sh): a free app for iPhone and
// Android. The server posts to a topic; phones subscribed to that topic get it.
// No accounts or keys, and ntfy can be self-hosted too.

export const DEFAULT_NTFY_SERVER = 'https://ntfy.sh';

export async function sendNotification(settings, { title, message, click, tags = [] }, fetchImpl = fetch) {
  const topic = String(settings.ntfyTopic || '').trim();
  if (!topic) throw new Error('Notifications are off: add an ntfy topic in Settings.');
  const server = String(settings.ntfyServer || DEFAULT_NTFY_SERVER).replace(/\/+$/, '');
  const res = await fetchImpl(`${server}/`, {
    method: 'POST',
    // ntfy reads JSON at the server root; that keeps titles with any characters intact.
    body: JSON.stringify({ topic, title, message, tags, ...(click ? { click } : {}) }),
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ntfy answered ${res.status}`);
}

/** "chicken thighs, salmon and ground beef" */
export function listNames(names) {
  const n = [...new Set(names)];
  return n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}
