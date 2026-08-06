// Tuval çizimi ve görüntü penceresi (zoom / pan / koordinat dönüşümü).

import { state, on, emit } from './store.js';

const MIN_SCALE = 3;
const MAX_SCALE = 90;

let cv, ctx, stage;
let dpr = 1;

export const view = { scale: 20, ox: 0, oy: 0 };
export let hover = null; // { x, y } — imlecin üstünde olduğu piksel

let dirty = false;
let needsFit = false;

export function init(canvasEl, stageEl) {
  cv = canvasEl;
  stage = stageEl;
  ctx = cv.getContext('2d');

  // Sahne ilk boyanmadan ölçülürse gerçekçi olmayan bir boyut dönebiliyor;
  // o yüzden "sığdır" isteğini bayrakta tutup gerçek ölçü gelince uyguluyoruz.
  const ro = new ResizeObserver(() => {
    resize();
    if (needsFit) fit();
    else { recenterIfFits(); draw(); }
  });
  ro.observe(stage);

  on('pixels', schedule);
  on('doc', () => { resize(); fit(); });

  resize();
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = stage.getBoundingClientRect();
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
}

export function setHover(p) {
  const same = (!p && !hover) || (p && hover && p.x === hover.x && p.y === hover.y);
  if (same) return;
  hover = p;
  schedule();
}

export function schedule() {
  if (dirty) return;
  dirty = true;
  requestAnimationFrame(() => { dirty = false; draw(); });
}

/* ---------- Görüntü penceresi ---------- */

export function fit() {
  const d = state.doc;
  if (!d) return;
  const r = stage.getBoundingClientRect();
  if (r.width < 80 || r.height < 80) { needsFit = true; return; }  // ResizeObserver tekrar çağıracak
  needsFit = false;
  const pad = 48;
  const s = Math.min((r.width - pad) / d.w, (r.height - pad) / d.h);
  view.scale = clampScale(Math.max(MIN_SCALE, Math.floor(s)));
  centerView();
  emitZoom();
  schedule();
}

/** Belge görüntüye tamamen sığıyorsa yeniden ortala — pencere boyu değişince işe yarar. */
function recenterIfFits() {
  const d = state.doc;
  if (!d) return;
  const r = stage.getBoundingClientRect();
  if (d.w * view.scale <= r.width && d.h * view.scale <= r.height) centerView();
}

function centerView() {
  const d = state.doc;
  const r = stage.getBoundingClientRect();
  view.ox = Math.round((r.width - d.w * view.scale) / 2);
  view.oy = Math.round((r.height - d.h * view.scale) / 2);
}

// Ölçek her zaman tam sayı: bir belge pikseli tam olarak N ekran pikseli.
// Kesirli ölçekte kareler eşit genişlikte çıkmaz ve ızgara titrer.
const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(s)));

const nextScale = (s, dir) => {
  const step = Math.max(1, Math.round(s * 0.25));
  return clampScale(dir > 0 ? s + step : s - step);
};

/** Ekrandaki bir noktayı sabit tutarak bir kademe yakınlaştırır (dir: +1 / -1). */
export function zoomAt(clientX, clientY, dir) {
  const r = stage.getBoundingClientRect();
  const px = clientX - r.left;
  const py = clientY - r.top;
  const next = nextScale(view.scale, dir);
  if (next === view.scale) return;
  const k = next / view.scale;
  view.ox = Math.round(px - (px - view.ox) * k);
  view.oy = Math.round(py - (py - view.oy) * k);
  view.scale = next;
  emitZoom();
  schedule();
}

export function zoomStep(dir) {
  const r = stage.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, dir);
}

export function pan(dx, dy) {
  view.ox = Math.round(view.ox + dx);
  view.oy = Math.round(view.oy + dy);
  schedule();
}

function emitZoom() { emit('zoom', view.scale); }

/** Ekran koordinatını piksel koordinatına çevirir (sınır dışı da olabilir). */
export function toDoc(clientX, clientY) {
  const r = stage.getBoundingClientRect();
  return {
    x: Math.floor((clientX - r.left - view.ox) / view.scale),
    y: Math.floor((clientY - r.top - view.oy) / view.scale),
  };
}

/* ---------- Çizim ---------- */

export function draw() {
  const d = state.doc;
  if (!d || !ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = cv.width / dpr, h = cv.height / dpr;
  ctx.clearRect(0, 0, w, h);

  const s = view.scale;
  const ox = view.ox, oy = view.oy;
  const bw = d.w * s, bh = d.h * s;

  // Kağıt gölgesi
  ctx.fillStyle = 'rgba(120, 80, 50, .12)';
  roundRect(ctx, ox - 4, oy - 2, bw + 8, bh + 10, 8);
  ctx.fill();

  // Şeffaflık için dama deseni
  drawChecker(ox, oy, bw, bh);

  // Pikseller
  for (let y = 0; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) {
      const c = d.pixels[y * d.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }

  // Izgara
  if (state.showGrid && s >= 7) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(58, 46, 42, .13)';
    ctx.beginPath();
    for (let x = 1; x < d.w; x++) {
      const px = Math.round(ox + x * s) + .5;
      ctx.moveTo(px, oy); ctx.lineTo(px, oy + bh);
    }
    for (let y = 1; y < d.h; y++) {
      const py = Math.round(oy + y * s) + .5;
      ctx.moveTo(ox, py); ctx.lineTo(ox + bw, py);
    }
    ctx.stroke();
  }

  // Kenarlık
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(58, 46, 42, .35)';
  ctx.strokeRect(ox - 1, oy - 1, bw + 2, bh + 2);

  // Simetri kılavuzları
  if (state.mirrorX || state.mirrorY) {
    ctx.save();
    ctx.strokeStyle = 'rgba(61, 180, 224, .85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    if (state.mirrorX) { ctx.moveTo(ox + bw / 2, oy - 6); ctx.lineTo(ox + bw / 2, oy + bh + 6); }
    if (state.mirrorY) { ctx.moveTo(ox - 6, oy + bh / 2); ctx.lineTo(ox + bw + 6, oy + bh / 2); }
    ctx.stroke();
    ctx.restore();
  }

  // Seçim
  if (state.selection) {
    const sel = state.selection;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#3A2E2A';
    ctx.strokeRect(ox + sel.x * s + 1, oy + sel.y * s + 1, sel.w * s - 2, sel.h * s - 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineDashOffset = 5;
    ctx.strokeRect(ox + sel.x * s + 1, oy + sel.y * s + 1, sel.w * s - 2, sel.h * s - 2);
    ctx.restore();
  }

  // İmleç altındaki piksel
  if (hover && hover.x >= 0 && hover.y >= 0 && hover.x < d.w && hover.y < d.h) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(58, 46, 42, .75)';
    ctx.strokeRect(ox + hover.x * s + 1, oy + hover.y * s + 1, s - 2, s - 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, .9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + hover.x * s + 2.5, oy + hover.y * s + 2.5, s - 5, s - 5);
  }
}

function drawChecker(ox, oy, bw, bh) {
  const c = 8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, bw, bh);
  ctx.clip();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(ox, oy, bw, bh);
  ctx.fillStyle = '#F2EAE1';
  for (let y = 0; y * c < bh; y++) {
    for (let x = 0; x * c < bw; x++) {
      if ((x + y) % 2) ctx.fillRect(ox + x * c, oy + y * c, c, c);
    }
  }
  ctx.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
