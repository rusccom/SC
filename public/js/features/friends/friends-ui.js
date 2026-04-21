import { getAllFriends, removeFriend } from './friends.js';

export class FriendsUI {
  constructor(listEl, onSelect, onRemove) {
    this.listEl = listEl;
    this.onSelect = onSelect;
    this.onRemove = onRemove;
    this.activeHandle = null;
    this.friends = [];
  }

  async refresh() {
    this.friends = await getAllFriends();
    this.render();
  }

  setActive(handle) {
    this.activeHandle = handle;
    this.render();
  }

  setOnline(handle, online) {
    const f = this.friends.find((x) => x.handle === handle);
    if (f) f.online = online;
    this.render();
  }

  incrementUnread(handle) {
    const f = this.friends.find((x) => x.handle === handle);
    if (f && handle !== this.activeHandle) {
      f.unread = (f.unread || 0) + 1;
      this.render();
    }
  }

  clearUnread(handle) {
    const f = this.friends.find((x) => x.handle === handle);
    if (f && f.unread) {
      f.unread = 0;
      this.render();
    }
  }

  render() {
    this.listEl.innerHTML = '';
    for (const f of this.friends) {
      this.listEl.appendChild(this._row(f));
    }
  }

  _row(f) {
    const row = document.createElement('div');
    row.className = 'friend' + (f.online ? ' online' : '') +
      (f.handle === this.activeHandle ? ' active' : '');
    row.innerHTML = `
      <span class="dot"></span>
      <span class="name"></span>
      <span class="unread" style="display:none"></span>
      <button class="del" title="remove">×</button>
    `;
    row.querySelector('.name').textContent = f.handle;
    const u = row.querySelector('.unread');
    if (f.unread) {
      u.textContent = f.unread;
      u.style.display = '';
    }
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('del')) return;
      this.onSelect(f.handle);
    });
    row.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`remove ${f.handle}?`)) return;
      await removeFriend(f.handle);
      await this.refresh();
      if (this.onRemove) this.onRemove(f.handle);
    });
    return row;
  }
}
