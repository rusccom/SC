const enc = new TextEncoder();
const dec = new TextDecoder();

export async function generateKeypair(algo) {
  const params = { name: algo, namedCurve: 'P-256' };
  const usages = algo === 'ECDH' ? ['deriveBits', 'deriveKey'] : ['sign'];
  return crypto.subtle.generateKey(params, true, usages);
}

export async function exportJwk(key) {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importPublic(jwk, algo) {
  const params = { name: algo, namedCurve: 'P-256' };
  const usages = algo === 'ECDSA' ? ['verify'] : [];
  return crypto.subtle.importKey('jwk', jwk, params, true, usages);
}

export async function importPrivate(jwk, algo) {
  const params = { name: algo, namedCurve: 'P-256' };
  const usages = algo === 'ECDH' ? ['deriveBits', 'deriveKey'] : ['sign'];
  return crypto.subtle.importKey('jwk', jwk, params, true, usages);
}

export async function deriveSharedKey(myPriv, theirPub) {
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPub }, myPriv, 256
  );
  return crypto.subtle.importKey(
    'raw', bits, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function aesEncrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext;
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf);
  return { iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}

export async function aesDecryptText(key, envelope) {
  const bytes = await aesDecryptBytes(key, envelope);
  return dec.decode(bytes);
}

export async function aesDecryptBytes(key, envelope) {
  const iv = b64d(envelope.iv);
  const ct = b64d(envelope.ct);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new Uint8Array(pt);
}

export async function sign(key, data) {
  const buf = typeof data === 'string' ? enc.encode(data) : data;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, buf
  );
  return b64e(new Uint8Array(sig));
}

export async function verify(key, data, sigB64) {
  const buf = typeof data === 'string' ? enc.encode(data) : data;
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key, b64d(sigB64), buf
  );
}

export function b64e(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function b64d(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return b64e(bytes).replace(/[+/=]/g, '').slice(0, 16);
}
