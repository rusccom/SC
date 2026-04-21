export class ChatUI {
  constructor(titleEl, bodyEl, form, input, sendBtn, onSend) {
    this.titleEl = titleEl;
    this.bodyEl = bodyEl;
    this.input = input;
    this.sendBtn = sendBtn;
    this.onSend = onSend;
    this.peer = null;
    form.addEventListener('submit', (e) => this._submit(e));
  }

  open(peer) {
    this.peer = peer;
    this.titleEl.textContent = peer ? peer.handle : '—';
    this.input.disabled = !peer;
    this.sendBtn.disabled = !peer;
    this.bodyEl.innerHTML = '';
  }

  clear() {
    this.peer = null;
    this.titleEl.textContent = '—';
    this.input.disabled = true;
    this.sendBtn.disabled = true;
    this.bodyEl.innerHTML = '';
  }

  renderHistory(messages) {
    this.bodyEl.innerHTML = '';
    const sorted = [...messages].sort((a, b) => a.ts - b.ts);
    for (const m of sorted) this.append(m);
  }

  append(msg) {
    const el = document.createElement('div');
    el.className = 'msg ' + (msg.outgoing ? 'out' : 'in');
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = formatTime(msg.ts);
    el.textContent = msg.text;
    el.appendChild(t);
    this.bodyEl.appendChild(el);
    this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
  }

  system(text) {
    const el = document.createElement('div');
    el.className = 'msg system';
    el.textContent = text;
    this.bodyEl.appendChild(el);
    this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
  }

  _submit(e) {
    e.preventDefault();
    const text = this.input.value.trim();
    if (!text || !this.peer) return;
    this.input.value = '';
    this.onSend(text);
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
