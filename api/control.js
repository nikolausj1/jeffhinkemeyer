// Guest book control API (your emergency brake — no per-message approval).
//   GET  ?key=SECRET            -> { messages, flags }   (full list incl. for deletes)
//   POST ?key=SECRET { action } -> action: 'delete' (id), 'hide' (value), 'close' (value)
// Protected by the ADMIN_SECRET env var. Used only by exception during the event.

const store = require('../lib/store');

function authorized(req) {
  const secret = process.env.ADMIN_SECRET || 'dev-admin-secret';
  const provided = (req.query && req.query.key)
    || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
    || '';
  return secret && provided && provided === secret;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const [messages, flags] = await Promise.all([store.listMessages(), store.getFlags()]);
      return res.status(200).json({ messages: messages.sort((a, b) => b.ts - a.ts), flags });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};

      if (body.action === 'delete' && body.id) {
        await store.deleteMessage(String(body.id));
        return res.status(200).json({ ok: true });
      }
      if (body.action === 'hide') {
        await store.setFlag('hidden', !!body.value);
        return res.status(200).json({ ok: true, hidden: !!body.value });
      }
      if (body.action === 'close') {
        await store.setFlag('closed', !!body.value);
        return res.status(200).json({ ok: true, closed: !!body.value });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
