// Tuvalde sağ tıkla açılan hızlı renk halkası.
//
// İki kullanım biçimi var:
//  · Bas–sürükle–bırak: sağ tuşu basılı tut, rengin üstüne gel, bırak.
//  · Tıkla–tıkla: sağ tuşa kısa bas, halka açık kalır, sonra renge tıkla.

import { state, setActiveColor } from './store.js';
import { isLight } from './color.js';

const R_IN = 44;
const R_OUT = 92;
const HUB = 34;
const MAX_SEG = 16;

let el = null;
let open = false;
let sticky = false;
let colors = [];
let cx = 0, cy = 0;
let hot = -1;
let openedAt = 0;

export function init() {
  el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('class', 'radial hidden');
  el.setAttribute('width', R_OUT * 2 + 8);
  el.setAttribute('height', R_OUT * 2 + 8);
  document.body.appendChild(el);

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('blur', close);
}

export function openRadial(x, y) {
  colors = pickColors();
  if (!colors.length) return;

  const m = R_OUT + 6;
  cx = Math.max(m, Math.min(window.innerWidth - m, x));
  cy = Math.max(m, Math.min(window.innerHeight - m, y));

  el.style.left = (cx - R_OUT - 4) + 'px';
  el.style.top = (cy - R_OUT - 4) + 'px';
  render();
  el.classList.remove('hidden');
  open = true;
  sticky = false;
  hot = -1;
  openedAt = performance.now();
}

export function close() {
  if (!open) return;
  open = false;
  sticky = false;
  hot = -1;
  el.classList.add('hidden');
}

export const isOpen = () => open;

/** Son kullanılanlar önce, ardından palet — tekrarsız, en fazla 16 renk. */
function pickColors() {
  const seen = new Set();
  const out = [];
  for (const c of [...state.recent, ...state.palette]) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length >= MAX_SEG) break;
  }
  return out;
}

function hitTest(x, y) {
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d < R_IN * 0.75 || d > R_OUT + 26) return -1;
  let a = Math.atan2(dy, dx) * 180 / Math.PI + 90;   // üstten başlat
  if (a < 0) a += 360;
  return Math.floor(a / (360 / colors.length)) % colors.length;
}

function onMove(e) {
  if (!open) return;
  const h = hitTest(e.clientX, e.clientY);
  if (h !== hot) { hot = h; render(); }
}

function onUp(e) {
  if (!open) return;
  hot = hitTest(e.clientX, e.clientY);
  // Kısa bas–bırak: halkayı açık bırak (tıkla–tıkla modu)
  if (!sticky && performance.now() - openedAt < 220 && hot < 0) {
    sticky = true;
    return;
  }
  if (sticky) return;
  commit();
}

function onDown(e) {
  if (!open || !sticky) return;
  e.preventDefault();
  e.stopPropagation();
  hot = hitTest(e.clientX, e.clientY);
  commit();
}

function commit() {
  if (hot >= 0 && colors[hot]) setActiveColor(colors[hot]);
  close();
}

/* ---------- Çizim ---------- */

function render() {
  const n = colors.length;
  const step = 360 / n;
  const c = R_OUT + 4;
  let html = '';

  for (let i = 0; i < n; i++) {
    const a0 = -90 + i * step;
    const a1 = a0 + step;
    const grow = i === hot ? 8 : 0;
    html += `<path class="seg${i === hot ? ' hot' : ''}" fill="${colors[i]}" d="${arc(c, c, R_IN, R_OUT + grow, a0, a1)}"></path>`;
  }

  const cur = state.activeColor;
  html += `<circle class="hub" cx="${c}" cy="${c}" r="${HUB}"></circle>`;
  html += `<circle cx="${c}" cy="${c}" r="${HUB - 8}" fill="${cur}" stroke="rgba(0,0,0,.12)" stroke-width="2"></circle>`;
  if (hot >= 0) {
    const txtFill = isLight(colors[hot]) ? '#3A2E2A' : '#FFFFFF';
    html += `<circle cx="${c}" cy="${c}" r="${HUB - 8}" fill="${colors[hot]}" stroke="rgba(0,0,0,.12)" stroke-width="2"></circle>`;
    html += `<text x="${c}" y="${c + 3.5}" text-anchor="middle" font-size="10" font-weight="700"
             font-family="ui-monospace, Menlo, monospace" fill="${txtFill}">${colors[hot].slice(1)}</text>`;
  }

  el.innerHTML = html;
}

function arc(cx0, cy0, r0, r1, a0, a1) {
  const p = (r, a) => {
    const rad = a * Math.PI / 180;
    return [cx0 + r * Math.cos(rad), cy0 + r * Math.sin(rad)];
  };
  const big = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${big} 0 ${x3} ${y3} Z`;
}
