// Basit modal ve bildirim (toast) yardımcıları.

let root, toasts;
let onCloseCb = null;

function ensure() {
  if (!root) root = document.getElementById('modalRoot');
  if (!toasts) toasts = document.getElementById('toasts');
}

export function openModal(node, opts = {}) {
  ensure();
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'modal';
  box.appendChild(node);
  root.appendChild(box);
  root.classList.remove('hidden');
  onCloseCb = opts.onClose || null;

  root.onpointerdown = (e) => {
    if (e.target === root && opts.dismissible !== false) closeModal();
  };
  document.addEventListener('keydown', escHandler);

  const auto = box.querySelector('[data-autofocus]');
  if (auto) auto.focus();
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  ensure();
  if (root.classList.contains('hidden')) return;
  root.classList.add('hidden');
  root.innerHTML = '';
  document.removeEventListener('keydown', escHandler);
  const cb = onCloseCb;
  onCloseCb = null;
  if (cb) cb();
}

export const isModalOpen = () => {
  ensure();
  return !root.classList.contains('hidden');
};

export function toast(message, bad = false) {
  ensure();
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = message;
  toasts.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, 2400);
}
