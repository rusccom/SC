import { getSession, logout } from './features/auth/auth.js';
import { deriveIdentity } from './features/crypto/identity.js';
import { loadIdentity } from './features/storage/vault.js';
import { Transport } from './features/signaling/ws.js';
import { FriendsUI } from './features/friends/friends-ui.js';
import { addFriend, getAllFriends, getFriend } from './features/friends/friends.js';
import { sendText, decryptIncoming, loadHistory } from './features/chat/chat.js';
import { ChatUI } from './features/chat/chat-ui.js';
import { CallManager } from './features/call/call.js';
import { CallUI } from './features/call/call-ui.js';

const $ = (id) => document.getElementById(id);

main().catch((e) => {
  console.error(e);
  alert('init error: ' + (e.message || e));
});

async function main() {
  const session = await getSession();
  if (!session || !session.handle) { location.replace('/'); return; }

  const passphrase = sessionStorage.getItem('sc.k');
  if (!passphrase) { location.replace('/'); return; }
  const id = await deriveIdentity(passphrase);
  if (id.handle !== session.handle) { await logout(); return; }
  const identity = await loadIdentity(session.handle, id.vaultKey);
  if (!identity) { await logout(); return; }

  const ctx = { session, identity, transport: null };
  setupUi(ctx);

  const transport = new Transport();
  ctx.transport = transport;
  wireTransport(ctx);
  transport.connect(session.handle, session.authHash);
}

function setupUi(ctx) {
  $('meHandle').textContent = ctx.session.handle;
  $('meHandle').addEventListener('click', () => copyHandle(ctx.session.handle));
  $('logoutBtn').addEventListener('click', () => logout());

  const chatUi = new ChatUI(
    $('chatTitle'), $('chatBody'),
    $('chatForm'), $('chatInput'), $('chatSend'),
    (text) => onSend(ctx, text)
  );
  const friendsUi = new FriendsUI(
    $('friendsList'),
    (handle) => openChat(ctx, handle),
    (handle) => { if (ctx.activePeer && ctx.activePeer.handle === handle) chatUi.clear(); }
  );
  const callMgr = new CallManager(ctx);
  const callUi = new CallUI(callMgr, {
    overlay: $('callOverlay'),
    peer: $('callPeer'),
    status: $('callStatus'),
    timer: $('callTimer'),
    accept: $('callAccept'),
    reject: $('callReject'),
    hangup: $('callHangup'),
  });

  ctx.chatUi = chatUi;
  ctx.friendsUi = friendsUi;
  ctx.callMgr = callMgr;
  ctx.callUi = callUi;
  ctx.activePeer = null;

  $('addFriendBtn').addEventListener('click', () => onAddFriend(ctx));
  $('friendHandle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAddFriend(ctx);
  });
  $('callBtn').addEventListener('click', () => onCallClick(ctx));
  friendsUi.refresh();
}

function wireTransport(ctx) {
  const t = ctx.transport;
  t.addEventListener('connecting', () => setStatus('connecting'));
  t.addEventListener('ready', async (e) => {
    setStatus('online');
    if (e.detail && Array.isArray(e.detail.pending)) {
      for (const env of e.detail.pending) await routeInbound(ctx, env);
    }
    await refreshFriendsOnline(ctx);
  });
  t.addEventListener('disconnected', () => setStatus('offline'));
  t.addEventListener('auth-failed', () => {
    alert('auth rejected');
    logout();
  });
  t.addEventListener('message', async (e) => {
    const msg = e.detail;
    if (msg.type === 'presence') {
      ctx.friendsUi.setOnline(msg.target, !!msg.online);
    } else if (msg.type === 'relay') {
      await routeInbound(ctx, msg);
    }
  });
}

async function routeInbound(ctx, env) {
  const from = env.from;
  const friend = await getFriend(from);
  if (!friend) return;
  const payload = env.payload;
  if (!payload) return;
  if (payload.kind === 'chat') {
    const msg = await decryptIncoming(ctx, friend, payload);
    if (!msg) return;
    if (ctx.activePeer && ctx.activePeer.handle === from) {
      ctx.chatUi.append(msg);
    } else {
      ctx.friendsUi.incrementUnread(from);
    }
  } else if (payload.kind === 'call' || payload.kind === 'audio') {
    await ctx.callMgr.onIncomingPayload(friend, payload);
  }
}

async function openChat(ctx, handle) {
  const friend = await getFriend(handle);
  if (!friend) return;
  ctx.activePeer = friend;
  ctx.friendsUi.setActive(handle);
  ctx.friendsUi.clearUnread(handle);
  ctx.chatUi.open(friend);
  const history = await loadHistory(handle);
  ctx.chatUi.renderHistory(history);
  $('callBtn').disabled = false;
}

async function onSend(ctx, text) {
  if (!ctx.activePeer) return;
  try {
    const msg = await sendText(ctx, ctx.activePeer, text);
    ctx.chatUi.append(msg);
  } catch (e) {
    ctx.chatUi.system('send failed: ' + (e.message || e));
  }
}

async function onAddFriend(ctx) {
  const input = $('friendHandle');
  const handle = input.value.trim();
  if (!handle) return;
  try {
    await addFriend(ctx, handle);
    input.value = '';
    await ctx.friendsUi.refresh();
  } catch (e) {
    alert(e.message || 'ошибка добавления');
  }
}

async function onCallClick(ctx) {
  if (!ctx.activePeer) return;
  try {
    if (ctx.callMgr.inCall) await ctx.callMgr.hangup();
    else await ctx.callMgr.invite(ctx.activePeer);
  } catch (e) {
    alert(e.message || 'call error');
  }
}

async function refreshFriendsOnline(ctx) {
  const friends = await getAllFriends();
  for (const f of friends) {
    ctx.transport.send({ type: 'presence', target: f.handle });
  }
}

function copyHandle(handle) {
  navigator.clipboard.writeText(handle).catch(() => {});
}

function setStatus(state) {
  const el = $('meStatus');
  el.textContent = state;
  el.classList.remove('online', 'connecting');
  if (state === 'online') el.classList.add('online');
  if (state === 'connecting') el.classList.add('connecting');
}
