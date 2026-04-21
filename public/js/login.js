import { tryLogin, getSession } from './features/auth/auth.js';

const form = document.getElementById('loginForm');
const input = document.getElementById('passphrase');
const msg = document.getElementById('loginMsg');
const btn = document.getElementById('loginBtn');

init();

async function init() {
  const session = await getSession();
  if (session && session.handle) {
    location.replace('/dashboard.html');
  }
}

form.addEventListener('submit', onSubmit);

async function onSubmit(e) {
  e.preventDefault();
  const passphrase = input.value;
  btn.disabled = true;
  showMsg('...', false);
  try {
    await tryLogin(passphrase);
    sessionStorage.setItem('sc.k', passphrase);
    location.href = '/dashboard.html';
  } catch (err) {
    showMsg(err.message || 'ошибка', true);
    btn.disabled = false;
  }
}

function showMsg(text, isError) {
  msg.textContent = text;
  msg.classList.toggle('err', !!isError);
}
