const EVENT_NAMES = ['pageview', 'click', 'beacon', 'heartbeat', 'timing'];
const PATHS = ['/dashboard', '/settings', '/reports', '/home', '/api/data'];
const enc = new TextEncoder();
const dec = new TextDecoder();

export function wrap(payload) {
  const json = JSON.stringify(payload);
  const b64 = bytesToB64(enc.encode(json));
  return {
    ts: Date.now(),
    v: '1.0.3',
    sid: randHex(8),
    events: fakeEvents(),
    beacon: b64,
    _pad: randB64(96 + Math.floor(Math.random() * 768)),
  };
}

export function unwrap(envelope) {
  try {
    if (!envelope || typeof envelope.beacon !== 'string') return null;
    return JSON.parse(dec.decode(b64ToBytes(envelope.beacon)));
  } catch { return null; }
}

function fakeEvents() {
  const n = 1 + Math.floor(Math.random() * 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      name: EVENT_NAMES[Math.floor(Math.random() * EVENT_NAMES.length)],
      ts: Date.now() - Math.floor(Math.random() * 5000),
      props: { path: PATHS[Math.floor(Math.random() * PATHS.length)] },
    });
  }
  return out;
}

function randHex(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function randB64(n) {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(n)));
}

function bytesToB64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function b64ToBytes(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
