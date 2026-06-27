// Guest book API.
//   GET  -> { messages, token, hidden }   (public list + a fresh form token)
//   POST -> submit a message (auto-published after passing automated guards)

const store = require('../lib/store');
const g = require('../lib/guards');

const MAX_NAME = 60;
const MAX_MESSAGE = 600;

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const [messages, flags] = await Promise.all([store.listMessages(), store.getFlags()]);
      const list = flags.hidden ? [] : messages.map((m) => ({
        id: m.id, name: m.name, message: m.message, ts: m.ts,
      }));
      return res.status(200).json({ messages: list, token: g.issueToken(), hidden: flags.hidden });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};

      const flags = await store.getFlags();
      if (flags.closed) {
        return res.status(403).json({ error: 'The guest book is closed. Thank you.' });
      }

      // Honeypot: real users never fill this hidden field. Silently accept-and-drop.
      if (body.website) return res.status(200).json({ ok: true });

      // Token: must have loaded the page recently.
      if (!g.verifyToken(body.token)) {
        return res.status(400).json({ error: 'Please reload the page and try again.' });
      }
      // Time-trap: a real person takes a few seconds to write something.
      if (g.tokenAgeMs(body.token) < 2500) {
        return res.status(400).json({ error: 'That was a little too quick — please try again.' });
      }

      let name = String(body.name || '').trim();
      let message = String(body.message || '').trim();
      if (!name || !message) {
        return res.status(400).json({ error: 'Please enter your name and a message.' });
      }
      if (name.length > MAX_NAME) name = name.slice(0, MAX_NAME);
      if (message.length > MAX_MESSAGE) {
        return res.status(400).json({ error: `Please keep your message under ${MAX_MESSAGE} characters.` });
      }
      if (g.hasLink(name) || g.hasLink(message)) {
        return res.status(400).json({ error: 'Links aren’t allowed in messages.' });
      }
      if (g.containsProfanity(name) || g.containsProfanity(message)) {
        return res.status(400).json({ error: 'Please keep your message respectful.' });
      }

      // Rate limit: max 5 posts per 2 minutes per IP.
      const allowed = await store.rateLimit(`gb:${getIp(req)}`, 5, 120);
      if (!allowed) {
        return res.status(429).json({ error: 'You’re posting too quickly — give it a minute.' });
      }

      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name, message, ts: Date.now(),
      };
      await store.addMessage(msg);
      return res.status(200).json({ ok: true, message: { id: msg.id, name: msg.name, message: msg.message, ts: msg.ts } });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
