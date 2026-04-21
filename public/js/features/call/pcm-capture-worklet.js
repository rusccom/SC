const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 320;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.readIdx = 0;
    this.prevLast = 0;
    this.chunk = new Int16Array(CHUNK_SAMPLES);
    this.chunkLen = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    while (this.readIdx < ch.length) {
      this._emit(this._interp(ch));
      this.readIdx += this.ratio;
    }
    this.readIdx -= ch.length;
    this.prevLast = ch[ch.length - 1];
    return true;
  }

  _interp(ch) {
    const idx = this.readIdx;
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const s0 = i0 >= 0 ? ch[i0] : this.prevLast;
    const s1 = (i0 + 1) < ch.length ? ch[i0 + 1] : ch[ch.length - 1];
    return s0 * (1 - frac) + s1 * frac;
  }

  _emit(sample) {
    const c = sample > 1 ? 1 : sample < -1 ? -1 : sample;
    this.chunk[this.chunkLen++] = (c * 32767) | 0;
    if (this.chunkLen < CHUNK_SAMPLES) return;
    const copy = new Int16Array(this.chunk);
    this.port.postMessage(copy.buffer, [copy.buffer]);
    this.chunkLen = 0;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
