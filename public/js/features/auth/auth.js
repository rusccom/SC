import { deriveIdentity } from '../crypto/identity.js';
import { generateKeypair, exportJwk } from '../crypto/crypto.js';
import { apiRegister } from '../signaling/http.js';
import { saveIdentity, loadIdentity, saveSession, loadSession, clearSession } from '../storage/vault.js';

export async function tryLogin(passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('не менее 8 символов');
  }
  const id = await deriveIdentity(passphrase);
  let idData = await loadIdentity(id.handle, id.vaultKey);
  if (!idData) {
    idData = await createIdentity(id);
  }
  const res = await apiRegister(
    id.handle, id.authHash, idData.encPubJwk, idData.sigPubJwk
  );
  if (!res || !res.ok) throw new Error('отклонено сервером');
  await saveSession({
    handle: id.handle,
    authHash: id.authHash,
    ts: Date.now(),
  });
  return { handle: id.handle };
}

async function createIdentity(id) {
  const encKeys = await generateKeypair('ECDH');
  const sigKeys = await generateKeypair('ECDSA');
  await saveIdentity(id.handle, id.vaultKey, encKeys, sigKeys);
  return {
    encKeys, sigKeys,
    encPubJwk: await exportJwk(encKeys.publicKey),
    sigPubJwk: await exportJwk(sigKeys.publicKey),
  };
}

export async function getSession() {
  return await loadSession();
}

export async function logout() {
  try { sessionStorage.removeItem('sc.k'); } catch {}
  await clearSession();
  location.href = '/';
}
