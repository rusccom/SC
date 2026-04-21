import { apiLookup } from '../signaling/http.js';
import { importPublic, deriveSharedKey } from '../crypto/crypto.js';
import {
  listFriends, getFriend, saveFriend, deleteFriend,
} from '../storage/friends-store.js';

const sharedKeyCache = new Map();

export async function addFriend(ctx, targetHandle) {
  const clean = (targetHandle || '').trim();
  if (!clean) throw new Error('пустой id');
  if (clean === ctx.session.handle) throw new Error('это вы сами');
  const existing = await getFriend(clean);
  if (existing) throw new Error('уже в списке');
  const res = await apiLookup(
    ctx.session.handle, ctx.session.authHash, clean
  );
  if (!res || !res.found) throw new Error('не найден');
  const friend = {
    handle: clean,
    encPubJwk: res.encPubKey,
    sigPubJwk: res.sigPubKey,
    added: Date.now(),
    online: false,
    unread: 0,
  };
  await saveFriend(friend);
  return friend;
}

export async function removeFriend(handle) {
  sharedKeyCache.delete(handle);
  await deleteFriend(handle);
}

export async function refreshFriend(ctx, handle) {
  const res = await apiLookup(
    ctx.session.handle, ctx.session.authHash, handle
  );
  if (!res || !res.found) return null;
  const cur = await getFriend(handle);
  if (!cur) return null;
  const changed =
    JSON.stringify(cur.encPubJwk) !== JSON.stringify(res.encPubKey);
  if (changed) {
    cur.encPubJwk = res.encPubKey;
    cur.sigPubJwk = res.sigPubKey;
    cur.keyChangedAt = Date.now();
    sharedKeyCache.delete(handle);
    await saveFriend(cur);
  }
  return cur;
}

export async function updateFriend(friend) {
  await saveFriend(friend);
}

export async function getAllFriends() {
  return await listFriends();
}

export async function sharedKeyWith(ctx, friend) {
  const cached = sharedKeyCache.get(friend.handle);
  if (cached) return cached;
  const theirPub = await importPublic(friend.encPubJwk, 'ECDH');
  const key = await deriveSharedKey(ctx.identity.encKeys.privateKey, theirPub);
  sharedKeyCache.set(friend.handle, key);
  return key;
}

export function dropSharedKey(handle) {
  sharedKeyCache.delete(handle);
}
