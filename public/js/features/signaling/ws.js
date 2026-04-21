import { wrap, unwrap } from '../obfuscation/envelope.js';

const NOISE_MIN_MS = 4000;
const NOISE_MAX_MS = 9000;

export class Transport extends EventTarget {
  constructor() {
    super();
    this.ws = null;
    this.handle = null;
    this.authHash = null;
    this.authed = false;
    this.queue = [];
    this.noiseTimer = null;
    this.reconnectDelay = 1000;
    this.shouldReconnect = true;
  }

  connect(handle, authHash) {
    this.handle = handle;
    this.authHash = authHash;
    this.shouldReconnect = true;
    this._open();
  }

  _open() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/api/telemetry/stream`;
    try { this.ws = new WebSocket(url); } catch { return this._scheduleReconnect(); }
    this.ws.addEventListener('open', () => this._onOpen());
    this.ws.addEventListener('message', (e) => this._onMessage(e));
    this.ws.addEventListener('close', () => this._onClose());
    this.ws.addEventListener('error', () => {});
  }

  _onOpen() {
    this.reconnectDelay = 1000;
    this._sendRaw({ type: 'auth', handle: this.handle, authHash: this.authHash });
    this._startNoise();
    this.dispatchEvent(new Event('connecting'));
  }

  _onMessage(ev) {
    let parsed;
    try { parsed = JSON.parse(ev.data); } catch { return; }
    const msg = unwrap(parsed);
    if (!msg) return;
    if (msg.type === 'auth') {
      this.authed = !!msg.ok;
      if (this.authed) {
        this._flushQueue();
        this.dispatchEvent(new CustomEvent('ready', { detail: msg }));
      } else {
        this.dispatchEvent(new Event('auth-failed'));
      }
      return;
    }
    this.dispatchEvent(new CustomEvent('message', { detail: msg }));
  }

  _onClose() {
    this.authed = false;
    this._stopNoise();
    this.dispatchEvent(new Event('disconnected'));
    if (this.shouldReconnect) this._scheduleReconnect();
  }

  _scheduleReconnect() {
    const d = this.reconnectDelay;
    this.reconnectDelay = Math.min(d * 2, 15000);
    setTimeout(() => this._open(), d);
  }

  close() {
    this.shouldReconnect = false;
    this._stopNoise();
    if (this.ws) try { this.ws.close(); } catch {}
  }

  send(msg) {
    if (this.authed) this._sendRaw(msg);
    else this.queue.push(msg);
  }

  relay(to, payload) {
    this.send({ type: 'relay', to, payload });
  }

  _flushQueue() {
    const q = this.queue; this.queue = [];
    for (const m of q) this._sendRaw(m);
  }

  _sendRaw(msg) {
    if (!this.ws || this.ws.readyState !== 1) return;
    try { this.ws.send(JSON.stringify(wrap(msg))); } catch {}
  }

  _startNoise() {
    this._stopNoise();
    const tick = () => {
      if (this.ws && this.ws.readyState === 1) {
        this._sendRaw({ type: 'noise', r: Math.random() });
      }
      const d = NOISE_MIN_MS + Math.random() * (NOISE_MAX_MS - NOISE_MIN_MS);
      this.noiseTimer = setTimeout(tick, d);
    };
    tick();
  }

  _stopNoise() {
    if (this.noiseTimer) clearTimeout(this.noiseTimer);
    this.noiseTimer = null;
  }
}
