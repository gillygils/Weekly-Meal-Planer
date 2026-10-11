// PIN lock: the household sets a PIN once, then each device has to enter it
// again every 24 hours. Wrong guesses are rate limited per device and overall.
import crypto from 'node:crypto';

export const SESSION_HOURS = 24;
export const PIN_RE = /^\d{4,8}$/;
export const COOKIE = 'mp_session';

export function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return { salt, hash };
}

export function verifyPin(pin, auth) {
  if (!auth?.hash || !PIN_RE.test(String(pin))) return false;
  const { hash } = hashPin(pin, auth.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(auth.hash, 'hex'));
}

const tokenId = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** Create a session; only a hash of the token is stored. */
export function createSession(auth, now = Date.now()) {
  const token = crypto.randomBytes(32).toString('base64url');
  auth.sessions ||= {};
  auth.sessions[tokenId(token)] = now + SESSION_HOURS * 3600 * 1000;
  return token;
}

export function sessionValid(auth, token, now = Date.now()) {
  if (!token || !auth?.sessions) return false;
  const exp = auth.sessions[tokenId(token)];
  return Boolean(exp && exp > now);
}

export function endSession(auth, token) {
  if (auth?.sessions && token) delete auth.sessions[tokenId(token)];
}

export function pruneSessions(auth, now = Date.now()) {
  for (const [id, exp] of Object.entries(auth?.sessions || {})) if (exp <= now) delete auth.sessions[id];
}

export function readCookie(req, name = COOKIE) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

function isHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https' || /https/.test(String(req.headers['cf-visitor'] || ''));
}

export function sessionCookie(req, token) {
  const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_HOURS * 3600}`];
  if (isHttps(req)) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearCookie(req) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
}

export function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown').trim();
}

/**
 * Wrong-PIN throttle. Each device gets 5 free tries, then waits 30s, 60s, 2m…
 * (up to an hour). Across all devices, 30 wrong PINs in an hour locks
 * everyone out for 15 minutes, so a 4-digit PIN can't be brute-forced.
 */
export class Throttle {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.byIp = new Map();
    this.recent = [];
    this.globalUntil = 0;
  }

  /** Seconds to wait before another try is allowed (0 = go ahead). */
  wait(ip) {
    const t = this.now();
    const g = Math.max(0, this.globalUntil - t);
    const e = this.byIp.get(ip);
    const own = e ? Math.max(0, e.until - t) : 0;
    return Math.ceil(Math.max(g, own) / 1000);
  }

  fail(ip) {
    const t = this.now();
    const e = this.byIp.get(ip) || { fails: 0, until: 0 };
    e.fails++;
    if (e.fails >= 5) e.until = t + Math.min(3600, 30 * 2 ** (e.fails - 5)) * 1000;
    this.byIp.set(ip, e);
    this.recent = this.recent.filter((x) => x > t - 3600 * 1000);
    this.recent.push(t);
    if (this.recent.length >= 30) this.globalUntil = t + 15 * 60 * 1000;
  }

  succeed(ip) {
    this.byIp.delete(ip);
  }
}
