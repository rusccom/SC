import { wrap, unwrap } from '../obfuscation/envelope.js';

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.3',
      'X-Requested-With': 'metrics-sdk',
    },
    body: JSON.stringify(wrap(body)),
    credentials: 'omit',
    cache: 'no-store',
  });
  const env = await res.json();
  return unwrap(env);
}

export async function apiRegister(handle, authHash, encPubKey, sigPubKey) {
  const data = await postJson('/api/metrics/collect', {
    handle, authHash, encPubKey, sigPubKey,
  });
  return data || { ok: false };
}

export async function apiLookup(handle, authHash, target) {
  const data = await postJson('/api/metrics/query', {
    handle, authHash, target,
  });
  return data || { found: false };
}

export async function apiConfig() {
  const res = await fetch('/api/config', { cache: 'no-store' });
  return unwrap(await res.json());
}
