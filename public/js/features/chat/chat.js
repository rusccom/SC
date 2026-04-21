import { aesEncrypt, aesDecryptText, randomId } from '../crypto/crypto.js';
import { sharedKeyWith } from '../friends/friends.js';
import { saveMessage, loadMessages } from '../storage/friends-store.js';

export async function sendText(ctx, friend, text) {
  const key = await sharedKeyWith(ctx, friend);
  const id = randomId();
  const ts = Date.now();
  const envelope = await aesEncrypt(key, JSON.stringify({
    kind: 'text', id, ts, text,
  }));
  ctx.transport.relay(friend.handle, {
    kind: 'chat',
    mid: id,
    env: envelope,
  });
  const msg = { id, ts, text, outgoing: true };
  await saveMessage(friend.handle, msg);
  return msg;
}

export async function decryptIncoming(ctx, friend, payload) {
  const key = await sharedKeyWith(ctx, friend);
  const raw = await aesDecryptText(key, payload.env);
  const parsed = JSON.parse(raw);
  if (parsed.kind !== 'text') return null;
  const msg = {
    id: parsed.id,
    ts: parsed.ts || Date.now(),
    text: String(parsed.text || ''),
    outgoing: false,
  };
  await saveMessage(friend.handle, msg);
  return msg;
}

export async function loadHistory(handle) {
  return await loadMessages(handle);
}
