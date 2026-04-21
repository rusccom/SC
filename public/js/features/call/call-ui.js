import { CALL_STATE } from './call.js';

export class CallUI {
  constructor(mgr, nodes) {
    this.mgr = mgr;
    this.overlay = nodes.overlay;
    this.peerEl = nodes.peer;
    this.statusEl = nodes.status;
    this.timerEl = nodes.timer;
    this.acceptBtn = nodes.accept;
    this.rejectBtn = nodes.reject;
    this.hangupBtn = nodes.hangup;
    this.startedAt = 0;
    this.timerHandle = null;
    this.acceptBtn.addEventListener('click', () => mgr.accept());
    this.rejectBtn.addEventListener('click', () => mgr.reject());
    this.hangupBtn.addEventListener('click', () => mgr.hangup());
    mgr.addEventListener('state', () => this._update());
    this._update();
  }

  _update() {
    const s = this.mgr.state;
    if (s === CALL_STATE.IDLE) return this._hide();
    this.overlay.classList.remove('hidden');
    this.peerEl.textContent = this.mgr.peer ? this.mgr.peer.handle : '';
    if (s === CALL_STATE.INCOMING) this._renderIncoming();
    else if (s === CALL_STATE.OUTGOING) this._renderOutgoing();
    else if (s === CALL_STATE.ACTIVE) this._renderActive();
  }

  _renderIncoming() {
    this.statusEl.textContent = 'incoming...';
    this.timerEl.textContent = '';
    this.acceptBtn.classList.remove('hidden');
    this.rejectBtn.classList.remove('hidden');
    this.hangupBtn.classList.add('hidden');
    this._stopTimer();
  }

  _renderOutgoing() {
    this.statusEl.textContent = 'calling...';
    this.timerEl.textContent = '';
    this.acceptBtn.classList.add('hidden');
    this.rejectBtn.classList.add('hidden');
    this.hangupBtn.classList.remove('hidden');
    this._stopTimer();
  }

  _renderActive() {
    this.statusEl.textContent = 'connected';
    this.acceptBtn.classList.add('hidden');
    this.rejectBtn.classList.add('hidden');
    this.hangupBtn.classList.remove('hidden');
    if (!this.timerHandle) {
      this.startedAt = Date.now();
      this.timerHandle = setInterval(() => this._tickTimer(), 500);
      this._tickTimer();
    }
  }

  _tickTimer() {
    const s = Math.floor((Date.now() - this.startedAt) / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    this.timerEl.textContent = `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  _stopTimer() {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = null;
  }

  _hide() {
    this.overlay.classList.add('hidden');
    this._stopTimer();
    this.timerEl.textContent = '';
  }
}
