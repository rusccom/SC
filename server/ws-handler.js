import { verifyAuth, enqueue, drain } from './store.js';
import { wrap, unwrap } from './obfuscate.js';

const sessions = new Map();

export function handleWebSocket(ws) {
  ws._authed = false;
  ws._handle = null;
  ws.on('message', (raw) => { onMessage(ws, raw).catch(() => {}); });
  ws.on('close', () => onClose(ws));
  ws.on('error', () => {});
}

async function onMessage(ws, raw) {
  let parsed;
  try { parsed = JSON.parse(raw.toString()); } catch { return; }
  const msg = unwrap(parsed);
  if (!msg || typeof msg.type !== 'string') return;
  await route(ws, msg);
}

function onClose(ws) {
  if (!ws._handle) return;
  const current = sessions.get(ws._handle);
  if (current === ws) {
    sessions.delete(ws._handle);
    broadcastPresence(ws._handle, false);
  }
}

async function route(ws, msg) {
  const handlers = {
    auth: handleAuth,
    relay: handleRelay,
    presence: handlePresence,
    ping: handlePing,
    noise: () => {},
  };
  const h = handlers[msg.type];
  if (h) await h(ws, msg);
}

async function handleAuth(ws, msg) {
  const { handle, authHash } = msg;
  let ok = false;
  try { ok = await verifyAuth(handle, authHash); }
  catch (e) { console.error('[ws] verifyAuth', e.message); }
  if (!ok) {
    send(ws, { type: 'auth', ok: false });
    return;
  }
  const prior = sessions.get(handle);
  if (prior && prior !== ws) try { prior.close(); } catch {}
  ws._authed = true;
  ws._handle = handle;
  sessions.set(handle, ws);
  let pending = [];
  try { pending = await drain(handle); }
  catch (e) { console.error('[ws] drain', e.message); }
  send(ws, { type: 'auth', ok: true, pending });
  broadcastPresence(handle, true);
}

function handlePresence(ws, msg) {
  if (!ws._authed) return;
  const target = msg.target;
  const online = sessions.has(target);
  send(ws, { type: 'presence', target, online });
}

async function handleRelay(ws, msg) {
  if (!ws._authed) return;
  const { to, payload } = msg;
  if (!to || !payload) return;
  const env = { from: ws._handle, payload, ts: Date.now() };
  const target = sessions.get(to);
  if (target && target.readyState === 1) {
    send(target, { type: 'relay', ...env });
    return;
  }
  const kind = payload && payload.kind;
  if (kind === 'audio' || kind === 'call') return;
  try {
    await enqueue(to, env);
    send(ws, { type: 'relay.queued', to, mid: payload.mid });
  } catch (e) {
    console.error('[ws] enqueue', e.message);
  }
}

function handlePing(ws) {
  send(ws, { type: 'pong', ts: Date.now() });
}

function broadcastPresence(handle, online) {
  for (const [h, peerWs] of sessions) {
    if (h === handle) continue;
    send(peerWs, { type: 'presence', target: handle, online });
  }
}

function send(ws, obj) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(wrap(obj))); } catch {}
}
