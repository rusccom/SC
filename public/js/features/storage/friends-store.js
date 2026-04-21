import { dbGet, dbPut, dbDelete, dbGetAll, dbGetRange } from './db.js';

export async function listFriends() {
  const arr = await dbGetAll('friends');
  return arr.sort((a, b) => (b.added || 0) - (a.added || 0));
}

export async function getFriend(handle) {
  return await dbGet('friends', handle);
}

export async function saveFriend(friend) {
  await dbPut('friends', friend.handle, friend);
}

export async function deleteFriend(handle) {
  await dbDelete('friends', handle);
}

export async function saveMessage(peer, msg) {
  const key = `${peer}:${pad(msg.ts)}:${msg.id}`;
  await dbPut('messages', key, { ...msg, peer });
}

export async function loadMessages(peer) {
  return await dbGetRange('messages', `${peer}:`);
}

function pad(n) {
  return String(n).padStart(16, '0');
}
