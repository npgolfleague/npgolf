// Attempt limits for login, sign-up and password reset. Counts are kept in
// memory (one app process) and reset when the app restarts.

const MAX_KEYS = 20000;

const isPrivateAddress = (ip) => {
  const addr = String(ip || '').replace(/^::ffff:/, '');
  return addr === '::1' || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr) || /^f[cd]/i.test(addr);
};

// The visitor's address. The site is reached through the Cloudflare tunnel, so
// every connection comes from the tunnel container; Cloudflare puts the real
// address in CF-Connecting-IP. That header is only believed on a connection
// from a private address (the tunnel), never from the open internet.
const clientIp = (req) => {
  const socketIp = req.socket?.remoteAddress || 'unknown';
  const forwarded = req.get('cf-connecting-ip');
  return forwarded && isPrivateAddress(socketIp) ? forwarded.trim().slice(0, 64) : socketIp;
};

class Limiter {
  constructor({ max, windowMs, now = Date.now }) {
    Object.assign(this, { max, windowMs, now });
    this.hits = new Map();
  }

  entry(key) {
    const e = this.hits.get(key);
    if (e && e.resetAt <= this.now()) {
      this.hits.delete(key);
      return null;
    }
    return e || null;
  }

  // Seconds to wait, or 0 when another attempt is allowed.
  blockedFor(key) {
    const e = this.entry(key);
    return e && e.count >= this.max ? Math.max(1, Math.ceil((e.resetAt - this.now()) / 1000)) : 0;
  }

  hit(key) {
    const e = this.entry(key);
    if (e) {
      e.count += 1;
      return;
    }
    if (this.hits.size >= MAX_KEYS) this.sweep();
    this.hits.set(key, { count: 1, resetAt: this.now() + this.windowMs });
  }

  // Drop expired keys; if an attacker has filled the map, drop the oldest half.
  sweep() {
    for (const [key, e] of this.hits) if (e.resetAt <= this.now()) this.hits.delete(key);
    if (this.hits.size < MAX_KEYS) return;
    let drop = Math.floor(MAX_KEYS / 2);
    for (const key of this.hits.keys()) {
      if (drop-- <= 0) break;
      this.hits.delete(key);
    }
  }

  clear(key) {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }
}

const tooMany = (res, seconds) => {
  const minutes = Math.ceil(seconds / 60);
  res.set('Retry-After', String(seconds));
  return res.status(429).json({ error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
};

// Counts every request from an address.
const limitByIp = (limiter) => (req, res, next) => {
  const key = clientIp(req);
  const wait = limiter.blockedFor(key);
  if (wait) return tooMany(res, wait);
  limiter.hit(key);
  return next();
};

module.exports = { Limiter, clientIp, limitByIp, tooMany };
