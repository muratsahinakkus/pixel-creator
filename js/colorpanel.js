// Sağ paneldeki renk bölümü: HSV çarkı, hex girişi, palet ve
// "bu tasarımda kullanılan renkler" listesi + renk sayacı.

import * as store from './store.js';
import { state } from './store.js';
import { normalizeHex, hexToHsv, hsvToHex } from './color.js';

const CX = 98, CY = 98;
const R_OUT = 92, R_IN = 70;
const SQ = 49;                 // kare yarı-kenarı

let wheel, wctx, dpr = 1;
let hsv = { h: 12, s: 0.71, v: 1 };
let mode = null;

let $swatch, $hex, $palette, $used, $limit, $warn, $count, $countText;

export function init() {
  $swatch   = document.getElementById('curSwatch');
  $hex      = document.getElementById('hexInput');
  $palette  = document.getElementById('paletteGrid');
  $used     = document.getElementById('usedList');
  $limit    = document.getElementById('limitInput');
  $warn     = document.getElementById('limitWarn');
  $count    = document.getElementById('colorCount');
  $countText = document.getElementById('colorCountText');
  wheel     = document.getElementById('wheel');
  wctx      = wheel.getContext('2d');

  setupWheel();

  $hex.addEventListener('change', applyHexInput);
  $hex.addEventListener('blur', applyHexInput);
  $hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { applyHexInput(); $hex.blur(); } });

  document.getElementById('btnAddSwatch').addEventListener('click', () => {
    store.addToPalette(state.activeColor);
  });
  document.getElementById('btnResetPalette').addEventListener('click', () => {
    store.resetPalette();
  });

  $limit.addEventListener('change', () => {
    const n = Math.max(1, Math.min(64, parseInt($limit.value, 10) || 12));
    $limit.value = n;
    store.setColorLimit(n);
  });

  store.on('color', () => { syncFromActive(); renderCurrent(); renderPalette(); drawWheel(); });
  store.on('palette', renderPalette);
  store.on('pixels', renderUsed);
  store.on('doc', renderUsed);

  syncFromActive();
  renderCurrent();
  renderPalette();
  drawWheel();
}

function syncFromActive() {
  const n = hexToHsv(state.activeColor);
  // Doygunluk 0'ken ton bilgisi kaybolur; çarkın imleci zıplamasın diye eskisini koru.
  hsv = { h: n.s === 0 ? hsv.h : n.h, s: n.s, v: n.v };
}

function renderCurrent() {
  $swatch.style.background = state.activeColor;
  if (document.activeElement !== $hex) $hex.value = state.activeColor;
}

/* ---------- Hex girişi ---------- */

function applyHexInput() {
  const hex = normalizeHex($hex.value);
  if (!hex) { $hex.value = state.activeColor; return; }
  store.setActiveColor(hex);
  $hex.value = hex;
}

/* ---------- HSV çarkı ---------- */

function setupWheel() {
  dpr = window.devicePixelRatio || 1;
  wheel.width = 196 * dpr;
  wheel.height = 196 * dpr;
  wctx.scale(dpr, dpr);

  wheel.addEventListener('pointerdown', (e) => {
    const p = local(e);
    const d = Math.hypot(p.x - CX, p.y - CY);
    if (d >= R_IN - 4) mode = 'hue';
    else if (Math.abs(p.x - CX) <= SQ + 6 && Math.abs(p.y - CY) <= SQ + 6) mode = 'sv';
    else return;
    wheel.setPointerCapture(e.pointerId);
    handle(p);
  });
  wheel.addEventListener('pointermove', (e) => { if (mode) handle(local(e)); });
  wheel.addEventListener('pointerup', () => { mode = null; });
  wheel.addEventListener('pointercancel', () => { mode = null; });
}

function local(e) {
  const r = wheel.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (196 / r.width), y: (e.clientY - r.top) * (196 / r.height) };
}

function handle(p) {
  if (mode === 'hue') {
    let a = Math.atan2(p.y - CY, p.x - CX) * 180 / Math.PI + 90;
    if (a < 0) a += 360;
    hsv.h = a;
  } else {
    hsv.s = clamp01((p.x - (CX - SQ)) / (SQ * 2));
    hsv.v = 1 - clamp01((p.y - (CY - SQ)) / (SQ * 2));
  }
  store.setActiveColor(hsvToHex(hsv.h, hsv.s, hsv.v));
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function drawWheel() {
  wctx.clearRect(0, 0, 196, 196);

  // Ton halkası
  const step = 1.2;
  for (let a = 0; a < 360; a += step) {
    wctx.beginPath();
    wctx.arc(CX, CY, (R_OUT + R_IN) / 2, rad(a - 90), rad(a + step - 90));
    wctx.strokeStyle = `hsl(${a} 100% 50%)`;
    wctx.lineWidth = R_OUT - R_IN;
    wctx.stroke();
  }

  // Halka kenarları
  wctx.lineWidth = 2;
  wctx.strokeStyle = 'rgba(58,46,42,.18)';
  wctx.beginPath(); wctx.arc(CX, CY, R_OUT, 0, Math.PI * 2); wctx.stroke();
  wctx.beginPath(); wctx.arc(CX, CY, R_IN, 0, Math.PI * 2); wctx.stroke();

  // Doygunluk / parlaklık karesi
  const x0 = CX - SQ, y0 = CY - SQ, size = SQ * 2;
  wctx.fillStyle = hsvToHex(hsv.h, 1, 1);
  wctx.fillRect(x0, y0, size, size);

  let g = wctx.createLinearGradient(x0, 0, x0 + size, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  wctx.fillStyle = g;
  wctx.fillRect(x0, y0, size, size);

  g = wctx.createLinearGradient(0, y0, 0, y0 + size);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  wctx.fillStyle = g;
  wctx.fillRect(x0, y0, size, size);

  wctx.strokeStyle = 'rgba(58,46,42,.25)';
  wctx.lineWidth = 2;
  wctx.strokeRect(x0 - 1, y0 - 1, size + 2, size + 2);

  // İmleçler
  const ha = rad(hsv.h - 90);
  const hr = (R_OUT + R_IN) / 2;
  ring(CX + Math.cos(ha) * hr, CY + Math.sin(ha) * hr, 8);
  ring(x0 + hsv.s * size, y0 + (1 - hsv.v) * size, 7);
}

function ring(x, y, r) {
  wctx.beginPath(); wctx.arc(x, y, r, 0, Math.PI * 2);
  wctx.strokeStyle = '#fff'; wctx.lineWidth = 3; wctx.stroke();
  wctx.strokeStyle = 'rgba(58,46,42,.7)'; wctx.lineWidth = 1.5; wctx.stroke();
}

const rad = (deg) => deg * Math.PI / 180;

/* ---------- Palet ---------- */

function renderPalette() {
  $palette.innerHTML = '';
  for (const hex of state.palette) {
    const b = document.createElement('button');
    b.className = 'swatch' + (hex === state.activeColor ? ' active' : '');
    b.style.background = hex;
    b.title = hex;
    b.addEventListener('click', () => store.setActiveColor(hex));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); store.removeFromPalette(hex); });
    $palette.appendChild(b);
  }
}

/* ---------- Kullanılan renkler + sayaç ---------- */

function renderUsed() {
  if (!state.doc) return;
  const used = store.usedColors();

  $countText.textContent = `${used.length} renk`;
  const over = used.length > state.colorLimit;
  $count.classList.toggle('over', over);

  $warn.classList.toggle('hidden', !over);
  if (over) {
    $warn.textContent =
      `${used.length} farklı renk var, limit ${state.colorLimit}. ` +
      `Boyama sayfasında her renk çocuğun seçeceği bir kalem demek — birkaçını birleştirmeyi düşün.`;
  }

  $used.innerHTML = '';
  if (!used.length) {
    const p = document.createElement('p');
    p.className = 'used-empty';
    p.textContent = 'Henüz boyanmış piksel yok.';
    $used.appendChild(p);
    return;
  }

  const total = used.reduce((a, b) => a + b.n, 0);
  for (const { hex, n } of used) {
    const row = document.createElement('button');
    row.className = 'used-row';
    row.title = `${hex} → seçili renge (${state.activeColor}) çevir`;
    row.innerHTML =
      `<span class="used-chip" style="background:${hex}"></span>` +
      `<span class="used-hex">${hex}</span>` +
      `<span class="used-n">${n} · %${Math.round(n / total * 100)}</span>`;
    row.addEventListener('click', () => {
      if (hex === state.activeColor) return;
      store.replaceColor(hex, state.activeColor);
    });
    $used.appendChild(row);
  }
}
