import { aesEncrypt, aesDecryptText, aesDecryptBytes, randomId, b64e, b64d } from '../crypto/crypto.js';
import { sharedKeyWith } from '../friends/friends.js';
import { AudioTx, AudioRx, pickMime } from './audio.js';

const STATE = {
  IDLE: 'idle',
  OUTGOING: 'outgoing',
  INCOMING: 'incoming',
  ACTIVE: 'active',
};

export class CallManager extends EventTarget {
  constructor(ctx, audioEl) {
    super();
    this.ctx = ctx;
    this.audioEl = audioEl;
    this.state = STATE.IDLE;
    this.peer = null;
    this.callId = null;
    this.mime = null;
    this.tx = null;
    this.rx = null;
  }

  get inCall() { return this.state !== STATE.IDLE; }

  async invite(friend) {
    if (this.inCall) throw new Error('уже в звонке');
    if (!pickMime()) throw new Error('звонки недоступны в этом браузере');
    this.peer = friend;
    this.callId = randomId();
    this.state = STATE.OUTGOING;
    const key = await sharedKeyWith(this.ctx, friend);
    await this._sendSignal(key, {
      action: 'invite', callId: this.callId, mime: pickMime(),
    });
    this._emit('state');
  }

  async accept() {
    if (this.state !== STATE.INCOMING) return;
    const key = await sharedKeyWith(this.ctx, this.peer);
    await this._sendSignal(key, {
      action: 'accept', callId: this.callId, mime: pickMime(),
    });
    await this._startMedia();
    this.state = STATE.ACTIVE;
    this._emit('state');
  }

  async reject() {
    if (this.state !== STATE.INCOMING) return;
    const key = await sharedKeyWith(this.ctx, this.peer);
    await this._sendSignal(key, { action: 'reject', callId: this.callId });
    this._teardown();
  }

  async hangup() {
    if (!this.inCall) return;
    if (this.peer) {
      const key = await sharedKeyWith(this.ctx, this.peer);
      await this._sendSignal(key, { action: 'end', callId: this.callId });
    }
    this._teardown();
  }

  async onIncomingPayload(friend, payload) {
    if (payload.kind === 'call') return await this._onSignal(friend, payload);
    if (payload.kind === 'audio') return await this._onAudio(friend, payload);
  }

  async _onSignal(friend, payload) {
    const key = await sharedKeyWith(this.ctx, friend);
    let sig;
    try { sig = JSON.parse(await aesDecryptText(key, payload.env)); }
    catch { return; }
    if (sig.action === 'invite') return this._handleInvite(friend, sig);
    if (sig.action === 'accept') return this._handleAccept(sig);
    if (sig.action === 'reject') return this._handleReject();
    if (sig.action === 'end') return this._handleEnd();
  }

  async _handleInvite(friend, sig) {
    if (this.inCall) {
      const key = await sharedKeyWith(this.ctx, friend);
      await this._sendSignalTo(friend, key, {
        action: 'reject', callId: sig.callId,
      });
      return;
    }
    this.peer = friend;
    this.callId = sig.callId;
    this.mime = sig.mime;
    this.state = STATE.INCOMING;
    this._emit('state');
  }

  async _handleAccept(sig) {
    if (this.state !== STATE.OUTGOING) return;
    if (sig.callId !== this.callId) return;
    this.mime = sig.mime;
    await this._startMedia();
    this.state = STATE.ACTIVE;
    this._emit('state');
  }

  _handleReject() { this._teardown(); }
  _handleEnd() { this._teardown(); }

  async _onAudio(friend, payload) {
    if (this.state !== STATE.ACTIVE) return;
    if (!this.peer || friend.handle !== this.peer.handle) return;
    if (payload.callId !== this.callId) return;
    const key = await sharedKeyWith(this.ctx, friend);
    try {
      const bytes = await aesDecryptBytes(key, payload.env);
      if (this.rx) this.rx.push(payload.seq, bytes);
    } catch {}
  }

  async _startMedia() {
    const mime = this.mime || pickMime();
    this.rx = new AudioRx(this.audioEl);
    this.rx.start(mime);
    this.tx = new AudioTx((seq, bytes) => this._sendAudio(seq, bytes));
    await this.tx.start();
  }

  async _sendAudio(seq, bytes) {
    if (!this.peer) return;
    const key = await sharedKeyWith(this.ctx, this.peer);
    const env = await aesEncrypt(key, bytes);
    this.ctx.transport.relay(this.peer.handle, {
      kind: 'audio', callId: this.callId, seq, env,
    });
  }

  async _sendSignal(key, sig) {
    await this._sendSignalTo(this.peer, key, sig);
  }

  async _sendSignalTo(friend, key, sig) {
    const env = await aesEncrypt(key, JSON.stringify(sig));
    this.ctx.transport.relay(friend.handle, {
      kind: 'call', callId: sig.callId, env,
    });
  }

  _teardown() {
    try { if (this.tx) this.tx.stop(); } catch {}
    try { if (this.rx) this.rx.stop(); } catch {}
    this.tx = null;
    this.rx = null;
    this.peer = null;
    this.callId = null;
    this.mime = null;
    this.state = STATE.IDLE;
    this._emit('state');
  }

  _emit(name) {
    this.dispatchEvent(new CustomEvent(name, { detail: { state: this.state, peer: this.peer } }));
  }
}

export { STATE as CALL_STATE };
