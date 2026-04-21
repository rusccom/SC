import { b64e } from './crypto.js';

const enc = new TextEncoder();

export async function deriveIdentity(passphrase) {
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']
  );
  const handle = await derivePart(material, 'sc:handle:v1', 150000, 128);
  const authBits = await derivePart(material, 'sc:auth:v1', 200000, 256);
  const vaultBits = await derivePart(material, 'sc:vault:v1', 250000, 256);
  const vaultKey = await crypto.subtle.importKey(
    'raw', vaultBits, { name: 'AES-GCM', length: 256 }, false,
    ['encrypt', 'decrypt']
  );
  return {
    handle: toHex(new Uint8Array(handle)).slice(0, 24),
    authHash: b64e(new Uint8Array(authBits)),
    vaultKey,
  };
}

async function derivePart(material, salt, iters, bits) {
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: iters,
      hash: 'SHA-256',
    },
    material, bits
  );
}

function toHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
