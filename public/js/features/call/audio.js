const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
];

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export class AudioTx {
  constructor(onChunk) {
    this.onChunk = onChunk;
    this.stream = null;
    this.recorder = null;
    this.seq = 0;
  }

  async start() {
    const mime = pickMime();
    if (!mime) throw new Error('MediaRecorder/opus не поддерживается');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.recorder = new MediaRecorder(this.stream, {
      mimeType: mime,
      audioBitsPerSecond: 24000,
    });
    this.recorder.addEventListener('dataavailable', (e) => this._onData(e));
    this.recorder.start(250);
  }

  async _onData(ev) {
    if (!ev.data || ev.data.size === 0) return;
    const buf = new Uint8Array(await ev.data.arrayBuffer());
    this.onChunk(this.seq++, buf);
  }

  stop() {
    try { if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop(); } catch {}
    try { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); } catch {}
    this.recorder = null;
    this.stream = null;
  }
}

export class AudioRx {
  constructor(audioEl) {
    this.audioEl = audioEl;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.queue = [];
    this.pendingBySeq = new Map();
    this.nextSeq = 0;
    this.ready = false;
    this.closed = false;
  }

  start(mime) {
    this.mediaSource = new MediaSource();
    this.audioEl.src = URL.createObjectURL(this.mediaSource);
    this.mediaSource.addEventListener('sourceopen', () => this._onOpen(mime));
  }

  _onOpen(mime) {
    try {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(mime);
      this.sourceBuffer.mode = 'sequence';
      this.sourceBuffer.addEventListener('updateend', () => this._pump());
      this.ready = true;
      this._pump();
    } catch (e) {
      console.warn('sourceBuffer error', e);
    }
  }

  push(seq, chunk) {
    if (this.closed) return;
    if (seq === this.nextSeq) {
      this.queue.push(chunk);
      this.nextSeq++;
      this._drainPending();
    } else if (seq > this.nextSeq) {
      this.pendingBySeq.set(seq, chunk);
    }
    this._pump();
  }

  _drainPending() {
    while (this.pendingBySeq.has(this.nextSeq)) {
      const c = this.pendingBySeq.get(this.nextSeq);
      this.pendingBySeq.delete(this.nextSeq);
      this.queue.push(c);
      this.nextSeq++;
    }
  }

  _pump() {
    if (!this.ready || !this.sourceBuffer || this.sourceBuffer.updating) return;
    if (this.queue.length === 0) return;
    const chunk = this.queue.shift();
    try { this.sourceBuffer.appendBuffer(chunk); } catch {}
  }

  stop() {
    this.closed = true;
    this.queue = [];
    this.pendingBySeq.clear();
    try { if (this.mediaSource && this.mediaSource.readyState === 'open') this.mediaSource.endOfStream(); } catch {}
    try { this.audioEl.pause(); this.audioEl.src = ''; } catch {}
    this.mediaSource = null;
    this.sourceBuffer = null;
  }
}
