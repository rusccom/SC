import { registerOrLogin, verifyAuth, lookupUser } from './store.js';
import { wrap, unwrap } from './obfuscate.js';

export function registerRoutes(app) {
  app.get('/api/config', handleConfig);
  app.post('/api/metrics/collect', handleRegister);
  app.post('/api/metrics/query', handleLookup);
}

function handleConfig(_req, res) {
  res.json(wrap({
    version: '1.0.3',
    features: { beacon: true, rum: true, diagnostics: true },
    sample_rate: 1.0,
    flush_interval_ms: 5000,
  }));
}

async function handleRegister(req, res) {
  const data = unwrap(req.body);
  if (!data) return res.status(400).json(wrap({ ok: false }));
  const { handle, authHash, encPubKey, sigPubKey } = data;
  try {
    const ok = await registerOrLogin(handle, authHash, encPubKey, sigPubKey);
    res.json(wrap({ ok }));
  } catch (e) {
    console.error('[routes] register', e.message);
    res.status(500).json(wrap({ ok: false }));
  }
}

async function handleLookup(req, res) {
  const data = unwrap(req.body);
  if (!data) return res.status(400).json(wrap({ found: false }));
  const { handle, authHash, target } = data;
  try {
    if (!(await verifyAuth(handle, authHash))) {
      return res.status(401).json(wrap({ found: false }));
    }
    const user = await lookupUser(String(target || '').trim());
    if (!user) return res.json(wrap({ found: false }));
    res.json(wrap({ found: true, ...user }));
  } catch (e) {
    console.error('[routes] lookup', e.message);
    res.status(500).json(wrap({ found: false }));
  }
}
