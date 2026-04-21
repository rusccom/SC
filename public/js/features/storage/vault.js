import { aesEncrypt, aesDecryptText, exportJwk, importPrivate, importPublic } from '../crypto/crypto.js';
import { dbGet, dbPut, dbDelete } from './db.js';

export async function saveIdentity(handle, vaultKey, encKeys, sigKeys) {
  const encPrivJwk = await exportJwk(encKeys.privateKey);
  const sigPrivJwk = await exportJwk(sigKeys.privateKey);
  const encPubJwk = await exportJwk(encKeys.publicKey);
  const sigPubJwk = await exportJwk(sigKeys.publicKey);
  const encPrivCt = await aesEncrypt(vaultKey, JSON.stringify(encPrivJwk));
  const sigPrivCt = await aesEncrypt(vaultKey, JSON.stringify(sigPrivJwk));
  await dbPut('identity', handle, {
    encPrivCt, sigPrivCt,
    encPubJwk, sigPubJwk,
    updated: Date.now(),
  });
}

export async function loadIdentity(handle, vaultKey) {
  const rec = await dbGet('identity', handle);
  if (!rec) return null;
  try {
    const encPrivJwk = JSON.parse(await aesDecryptText(vaultKey, rec.encPrivCt));
    const sigPrivJwk = JSON.parse(await aesDecryptText(vaultKey, rec.sigPrivCt));
    const encPriv = await importPrivate(encPrivJwk, 'ECDH');
    const sigPriv = await importPrivate(sigPrivJwk, 'ECDSA');
    const encPub = await importPublic(rec.encPubJwk, 'ECDH');
    const sigPub = await importPublic(rec.sigPubJwk, 'ECDSA');
    return {
      encKeys: { privateKey: encPriv, publicKey: encPub },
      sigKeys: { privateKey: sigPriv, publicKey: sigPub },
      encPubJwk: rec.encPubJwk,
      sigPubJwk: rec.sigPubJwk,
    };
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  await dbPut('session', 'current', session);
}

export async function loadSession() {
  return (await dbGet('session', 'current')) || null;
}

export async function clearSession() {
  await dbDelete('session', 'current');
}
