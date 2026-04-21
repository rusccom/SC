const SAMPLE_RATE = 16000;
const WORKLET_URL = '/js/features/call/pcm-capture-worklet.js';

export function canUseAudio() {
  return typeof AudioContext !== 'undefined' ||
    typeof webkitAudioContext !== 'undefined';
}

function createCtx() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  return new Ctor();
}

export class AudioTx {
  constructor(onChunk) {
    this.onChunk = onChunk;
    this.stream = null;
    this.ctx = null;
    this.source = null;
    this.node = null;
    this.silentGain = null;
    this.seq = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });
    this.ctx = createCtx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    await this.ctx.audioWorklet.addModule(WORKLET_URL);
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');
    this.node.port.onmessage = (e) => this._onChunk(e.data);
    this.silentGain = this.ctx.createGain();
    this.silentGain.gain.value = 0;
    this.source.connect(this.node);
    this.node.connect(this.silentGain);
    this.silentGain.connect(this.ctx.destination);
  }

  _onChunk(buffer) {
    if (!buffer) return;
    this.onChunk(this.seq++, new Uint8Array(buffer));
  }

  stop() {
    try { if (this.node) this.node.port.onmessage = null; } catch {}
    try { if (this.node) this.node.disconnect(); } catch {}
    try { if (this.source) this.source.disconnect(); } catch {}
    try { if (this.silentGain) this.silentGain.disconnect(); } catch {}
    try { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { if (this.ctx) this.ctx.close(); } catch {}
    this.node = null;
    this.source = null;
    this.silentGain = null;
    this.stream = null;
    this.ctx = null;
  }
}

export class AudioRx {
  constructor() {
    this.ctx = null;
    this.nextPlayTime = 0;
    this.pendingBySeq = new Map();
    this.nextSeq = 0;
    this.closed = false;
  }

  async start() {
    if (this.ctx) return;
    this.ctx = createCtx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.nextPlayTime = this.ctx.currentTime + 0.08;
  }

  push(seq, bytes) {
    if (this.closed || !this.ctx) return;
    if (seq < this.nextSeq) return;
    if (seq === this.nextSeq) {
      this._play(bytes);
      this.nextSeq++;
      this._drainPending();
    } else {
      if (this.pendingBySeq.size > 40) this._flushPending();
      this.pendingBySeq.set(seq, bytes);
    }
  }

  _drainPending() {
    while (this.pendingBySeq.has(this.nextSeq)) {
      const b = this.pendingBySeq.get(this.nextSeq);
      this.pendingBySeq.delete(this.nextSeq);
      this._play(b);
      this.nextSeq++;
    }
  }

  _flushPending() {
    const sorted = [...this.pendingBySeq.entries()].sort((a, b) => a[0] - b[0]);
    for (const [seq, b] of sorted) {
      this._play(b);
      this.nextSeq = seq + 1;
    }
    this.pendingBySeq.clear();
  }

  _play(bytes) {
    const int16 = new Int16Array(
      bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1
    );
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32767;
    const buf = this.ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buf.copyToChannel(float32, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const when = Math.max(this.nextPlayTime, now + 0.005);
    src.start(when);
    this.nextPlayTime = when + buf.duration;
    if (this.nextPlayTime - now > 0.8) {
      this.nextPlayTime = now + 0.08;
    }
  }

  stop() {
    this.closed = true;
    this.pendingBySeq.clear();
    try { if (this.ctx) this.ctx.close(); } catch {}
    this.ctx = null;
  }
}
