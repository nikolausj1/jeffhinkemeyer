// Storage for the guest book.
// Uses Upstash Redis (Vercel KV) in production; falls back to a local JSON file
// under /tmp for local `vercel dev` testing when no Redis credentials are present.

const fs = require('fs');
const path = require('path');

const MESSAGES_KEY = 'guestbook:messages';
const FLAGS_KEY = 'guestbook:flags';

function redisUrl() {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
}
function redisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
}
function usingRedis() {
  return !!(redisUrl() && redisToken());
}

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const { Redis } = require('@upstash/redis');
  _redis = new Redis({ url: redisUrl(), token: redisToken() });
  return _redis;
}

// ---- local file fallback (dev only) -------------------------------------
const FILE = path.join('/tmp', 'jeff-guestbook-dev.json');
function readFile() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { messages: [], flags: {}, rate: {} }; }
}
function writeFile(d) {
  try { fs.writeFileSync(FILE, JSON.stringify(d)); } catch (e) { /* ignore */ }
}

// Upstash may auto-deserialize JSON members; handle both string and object.
function parseMember(x) {
  if (x && typeof x === 'object') return x;
  try { return JSON.parse(x); } catch { return null; }
}

// ---- messages -----------------------------------------------------------
async function addMessage(msg) {
  if (usingRedis()) {
    await getRedis().zadd(MESSAGES_KEY, { score: msg.ts, member: JSON.stringify(msg) });
  } else {
    const d = readFile(); d.messages.push(msg); writeFile(d);
  }
}

async function listMessages() {
  if (usingRedis()) {
    const raw = await getRedis().zrange(MESSAGES_KEY, 0, -1); // ascending by ts
    return raw.map(parseMember).filter(Boolean);
  }
  return readFile().messages.slice().sort((a, b) => a.ts - b.ts);
}

async function deleteMessage(id) {
  if (usingRedis()) {
    const raw = await getRedis().zrange(MESSAGES_KEY, 0, -1);
    for (const x of raw) {
      const m = parseMember(x);
      if (m && m.id === id) {
        // remove by the exact stored member representation
        await getRedis().zrem(MESSAGES_KEY, typeof x === 'string' ? x : JSON.stringify(x));
      }
    }
  } else {
    const d = readFile(); d.messages = d.messages.filter((m) => m.id !== id); writeFile(d);
  }
}

// ---- flags (hidden / closed) -------------------------------------------
async function getFlags() {
  if (usingRedis()) {
    const f = (await getRedis().hgetall(FLAGS_KEY)) || {};
    return { hidden: f.hidden === '1' || f.hidden === 1 || f.hidden === true,
             closed: f.closed === '1' || f.closed === 1 || f.closed === true };
  }
  const f = readFile().flags || {};
  return { hidden: !!f.hidden, closed: !!f.closed };
}

async function setFlag(name, value) {
  if (usingRedis()) {
    await getRedis().hset(FLAGS_KEY, { [name]: value ? '1' : '0' });
  } else {
    const d = readFile(); d.flags = d.flags || {}; d.flags[name] = !!value; writeFile(d);
  }
}

// ---- rate limiting ------------------------------------------------------
// Returns true if allowed, false if over the limit.
async function rateLimit(key, limit, windowSec) {
  if (usingRedis()) {
    const k = `rl:${key}`;
    const n = await getRedis().incr(k);
    if (n === 1) await getRedis().expire(k, windowSec);
    return n <= limit;
  }
  const d = readFile(); d.rate = d.rate || {};
  const now = Date.now();
  const entry = d.rate[key] || { count: 0, reset: now + windowSec * 1000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowSec * 1000; }
  entry.count += 1;
  d.rate[key] = entry; writeFile(d);
  return entry.count <= limit;
}

module.exports = {
  addMessage, listMessages, deleteMessage, getFlags, setFlag, rateLimit, usingRedis,
};
