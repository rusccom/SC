import crypto from 'crypto';

const EVENT_NAMES = ['pageview', 'click', 'beacon', 'heartbeat', 'timing'];

export function wrap(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  const padLen = 96 + Math.floor(Math.random() * 768);
  const pad = crypto.randomBytes(padLen).toString('base64');
  return {
    ts: Date.now(),
    v: '1.0.3',
    sid: crypto.randomBytes(8).toString('hex'),
    events: fakeEvents(),
    beacon: b64,
    _pad: pad,
  };
}

export function unwrap(envelope) {
  try {
    if (!envelope || typeof envelope.beacon !== 'string') return null;
    const json = Buffer.from(envelope.beacon, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function fakeEvents() {
  const n = 1 + Math.floor(Math.random() * 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      name: EVENT_NAMES[Math.floor(Math.random() * EVENT_NAMES.length)],
      ts: Date.now() - Math.floor(Math.random() * 5000),
      props: { path: randomPath(), ref: '' },
    });
  }
  return out;
}

function randomPath() {
  const paths = ['/dashboard', '/settings', '/reports', '/home', '/api/data'];
  return paths[Math.floor(Math.random() * paths.length)];
}
