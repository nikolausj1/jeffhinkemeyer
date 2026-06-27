// Spam / abuse guards for the guest book — all automated, no human moderation.

const crypto = require('crypto');

function tokenSecret() {
  return process.env.GUESTBOOK_TOKEN_SECRET || 'dev-token-secret-change-me';
}

// A short HMAC token issued when the page loads. Submissions must echo a recent,
// valid token, so a bot that POSTs straight to the API (without loading the page)
// is rejected. The timestamp also powers the time-trap below.
function issueToken() {
  const ts = Date.now();
  const sig = crypto.createHmac('sha256', tokenSecret()).update(String(ts)).digest('hex').slice(0, 32);
  return `${ts}.${sig}`;
}

function verifyToken(token, maxAgeMs = 1000 * 60 * 60 * 8) { // valid for 8 hours
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [tsStr, sig] = token.split('.');
  const ts = Number(tsStr);
  if (!ts || !sig) return false;
  const age = Date.now() - ts;
  if (age < 0 || age > maxAgeMs) return false;
  const expect = crypto.createHmac('sha256', tokenSecret()).update(tsStr).digest('hex').slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
  } catch { return false; }
}

function tokenAgeMs(token) {
  const ts = Number(String(token || '').split('.')[0]);
  return ts ? Date.now() - ts : 0;
}

// Link detection — the most common spam payload. Block rather than strip so a
// link-laden message is rejected outright.
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ru|cn|xyz|info|biz|top|link|shop|click|live|online)\b)/i;
function hasLink(text) {
  return LINK_RE.test(String(text || ''));
}

// Basic profanity / slur backstop. Not exhaustive — it's the automated net that
// catches obvious abuse; the kill switch + delete handle anything that slips by.
const BANNED = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'bastard', 'dick', 'pussy', 'cock',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'spic', 'chink', 'kike', 'wetback',
  'whore', 'slut', 'rape', 'porn', 'sex', 'nazi',
];
function normalizeForMatch(text) {
  // collapse common letter-substitutions used to evade filters
  return String(text || '')
    .toLowerCase()
    .replace(/[@4]/g, 'a').replace(/[1!|]/g, 'i').replace(/[0]/g, 'o')
    .replace(/[3]/g, 'e').replace(/[5$]/g, 's').replace(/[7]/g, 't')
    .replace(/[^a-z]/g, '');
}
function containsProfanity(text) {
  const norm = normalizeForMatch(text);
  const lower = String(text || '').toLowerCase();
  return BANNED.some((w) => norm.includes(w) || new RegExp(`\\b${w}\\b`, 'i').test(lower));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

module.exports = {
  issueToken, verifyToken, tokenAgeMs, hasLink, containsProfanity, escapeHtml,
};
