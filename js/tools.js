// Araçlar ve tuval üzerindeki fare/kalem etkileşimi.

import * as store from './store.js';
import { state } from './store.js';
import * as render from './render.js';
import { openRadial } from './radial.js';
import { toast } from './modal.js';

let cv, stage;
let drag = null;
let spaceDown = false;
let altDown = false;

export function init(canvasEl, stageEl) {
  cv = canvasEl;
  stage = stageEl;

  cv.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  cv.addEventListener('pointerleave', () => { if (!drag) render.setHover(null); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', onWheel, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isTyping(e)) { spaceDown = true; updateCursor(); e.preventDefault(); }
    if (e.key === 'Alt') { altDown = true; updateCursor(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spaceDown = false; updateCursor(); }
    if (e.key === 'Alt') { altDown = false; updateCursor(); }
  });
  window.addEventListener('blur', () => { spaceDown = false; altDown = false; updateCursor(); });

  store.on('tool', updateCursor);
}

const isTyping = (e) => e.target instanceof HTMLElement &&
  (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

function updateCursor() {
  cv.classList.toggle('pan-ready', spaceDown || state.tool === 'hand' || state.tool === 'reference');
  cv.classList.toggle('picking', altDown || state.tool === 'eyedropper');
}

/* ---------- Simetri farkında yazma ---------- */

function plot(x, y, color) {
  const d = state.doc;
  store.setPixel(x, y, color);
  if (state.mirrorX) store.setPixel(d.w - 1 - x, y, color);
  if (state.mirrorY) store.setPixel(x, d.h - 1 - y, color);
  if (state.mirrorX && state.mirrorY) store.setPixel(d.w - 1 - x, d.h - 1 - y, color);
}

/* ---------- Olaylar ---------- */

function onDown(e) {
  if (!state.doc) return;
  const p = render.toDoc(e.clientX, e.clientY);

  // Sağ tık → hızlı renk halkası
  if (e.button === 2) {
    e.preventDefault();
    openRadial(e.clientX, e.clientY);
    return;
  }

  // Orta tık / Space / el aracı → kaydır
  if (e.button === 1 || spaceDown || state.tool === 'hand') {
    e.preventDefault();
    drag = { mode: 'pan', lx: e.clientX, ly: e.clientY };
    cv.setPointerCapture(e.pointerId);
    cv.classList.add('panning');
    return;
  }

  if (e.button !== 0) return;
  cv.setPointerCapture(e.pointerId);

  // Alt = geçici pipet
  const tool = altDown ? 'eyedropper' : state.tool;

  if (tool === 'eyedropper') { pick(p); return; }

  if (tool === 'select') { startSelect(p); return; }

  if (tool === 'samecolor') { selectSameColor(p); return; }

  if (tool === 'reference') { startReferenceDrag(e); return; }

  if (!store.inBounds(p.x, p.y) && tool === 'bucket') return;

  store.beginEdit();

  if (tool === 'pencil')      { drag = { mode: 'draw', color: state.activeColor, last: p }; plot(p.x, p.y, state.activeColor); }
  else if (tool === 'eraser') { drag = { mode: 'draw', color: null, last: p };              plot(p.x, p.y, null); }
  else if (tool === 'bucket') { drag = { mode: 'once' }; bucket(p.x, p.y, state.activeColor); }
  else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
    drag = { mode: 'shape', shape: tool, start: p, end: p, shift: e.shiftKey, fill: e.altKey };
    drawShape(drag);
  }

  store.emit('pixels');
}

function onMove(e) {
  if (!state.doc) return;
  const p = render.toDoc(e.clientX, e.clientY);
  render.setHover(p);
  store.emit('coords', p);

  if (!drag) return;

  if (drag.mode === 'pan') {
    render.pan(e.clientX - drag.lx, e.clientY - drag.ly);
    drag.lx = e.clientX; drag.ly = e.clientY;
    return;
  }

  if (drag.mode === 'reference') {
    const f = render.toDocFloat(e.clientX, e.clientY);
    store.updateReference({
      x: drag.refX + (f.x - drag.startX),
      y: drag.refY + (f.y - drag.startY),
    });
    return;
  }

  if (drag.mode === 'draw') {
    line(drag.last, p, (x, y) => plot(x, y, drag.color));
    drag.last = p;
    store.emit('pixels');
    return;
  }

  if (drag.mode === 'shape') {
    drag.end = p;
    drag.shift = e.shiftKey;
    drag.fill = e.altKey;
    store.restorePending();
    drawShape(drag);
    store.emit('pixels');
    return;
  }

  if (drag.mode === 'newSel') {
    store.setSelection({ kind: 'rect', ...rectFrom(drag.start, p) });
    return;
  }

  if (drag.mode === 'moveSel') {
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    store.restorePending();
    stampFloating(drag, dx, dy);
    store.setSelection({ kind: 'rect', x: drag.orig.x + dx, y: drag.orig.y + dy, w: drag.orig.w, h: drag.orig.h });
    store.emit('pixels');
  }
}

function onUp(e) {
  if (!drag) return;
  const mode = drag.mode;
  drag = null;
  cv.classList.remove('panning');

  if (mode === 'pan' || mode === 'newSel' || mode === 'reference') return;
  store.commitEdit();
}

function onWheel(e) {
  e.preventDefault();
  // Referans modunda tekerlek görüntüyü değil referans görselini ölçekler.
  if (state.tool === 'reference' && state.reference) {
    scaleReference(e);
    return;
  }
  render.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1 : -1);
}

/* ---------- Araç davranışları ---------- */

function pick(p) {
  const c = store.getPixel(p.x, p.y);
  if (c) store.setActiveColor(c);
}

function bucket(sx, sy, color) {
  const d = state.doc;
  const target = store.getPixel(sx, sy);
  if (target === color) return;
  const stack = [[sx, sy]];
  const seen = new Uint8Array(d.w * d.h);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= d.w || y >= d.h) continue;
    const i = y * d.w + x;
    if (seen[i]) continue;
    if (d.pixels[i] !== target) continue;
    seen[i] = 1;
    d.pixels[i] = color;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  // Simetri: aynayı ayrı bir dolgu olarak uygula
  if (state.mirrorX) mirrorFill(sx, sy, color, true, false);
  if (state.mirrorY) mirrorFill(sx, sy, color, false, true);
  if (state.mirrorX && state.mirrorY) mirrorFill(sx, sy, color, true, true);
}

function mirrorFill(sx, sy, color, mx, my) {
  const d = state.doc;
  const x = mx ? d.w - 1 - sx : sx;
  const y = my ? d.h - 1 - sy : sy;
  const target = store.getPixel(x, y);
  if (target === color) return;
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= d.w || cy >= d.h) continue;
    const i = cy * d.w + cx;
    if (d.pixels[i] !== target) continue;
    d.pixels[i] = color;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

function drawShape(g) {
  const color = state.activeColor;
  let { start, end } = g;

  if (g.shift) {
    // Kare / daire / 45° kilitli çizgi
    const dx = end.x - start.x, dy = end.y - start.y;
    if (g.shape === 'line') {
      if (Math.abs(dx) > Math.abs(dy) * 2) end = { x: end.x, y: start.y };
      else if (Math.abs(dy) > Math.abs(dx) * 2) end = { x: start.x, y: end.y };
      else {
        const m = Math.min(Math.abs(dx), Math.abs(dy));
        end = { x: start.x + Math.sign(dx) * m, y: start.y + Math.sign(dy) * m };
      }
    } else {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      end = { x: start.x + Math.sign(dx || 1) * m, y: start.y + Math.sign(dy || 1) * m };
    }
  }

  if (g.shape === 'line') { line(start, end, (x, y) => plot(x, y, color)); return; }

  const r = rectFrom(start, end);
  if (g.shape === 'rect') {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
        if (g.fill || edge) plot(x, y, color);
      }
    }
  } else {
    ellipse(r, g.fill, (x, y) => plot(x, y, color));
  }
}

/* ---------- Referans görsel ---------- */

function startReferenceDrag(e) {
  if (!state.reference) {
    toast('Önce sağ panelden bir referans görseli seç');
    return;
  }
  const f = render.toDocFloat(e.clientX, e.clientY);
  drag = {
    mode: 'reference',
    startX: f.x, startY: f.y,
    refX: state.reference.x, refY: state.reference.y,
  };
}

/** İmlecin altındaki nokta sabit kalacak şekilde ölçekler. */
function scaleReference(e) {
  const r = state.reference;
  const f = render.toDocFloat(e.clientX, e.clientY);
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
  const w = Math.max(0.5, Math.min(state.doc.w * 20, r.w * factor));
  const k = w / r.w;
  store.updateReference({
    x: f.x - (f.x - r.x) * k,
    y: f.y - (f.y - r.y) * k,
    w,
  });
}

/* ---------- Seçim ---------- */

function startSelect(p) {
  const sel = state.selection;
  const inside = sel && sel.kind === 'rect' &&
    p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h;

  if (inside) {
    store.beginEdit();
    const data = [];
    for (let y = 0; y < sel.h; y++) {
      for (let x = 0; x < sel.w; x++) data.push(store.getPixel(sel.x + x, sel.y + y));
    }
    drag = { mode: 'moveSel', start: p, orig: { ...sel }, data };
    stampFloating(drag, 0, 0);
    store.emit('pixels');
  } else {
    store.setSelection(null);
    drag = { mode: 'newSel', start: p };
  }
}

/** Taşınan bloğu kaynağından kaldırıp yeni konumuna basar. */
function stampFloating(g, dx, dy) {
  const o = g.orig;
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) store.setPixel(o.x + x, o.y + y, null);
  }
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      const c = g.data[y * o.w + x];
      if (c !== null) store.setPixel(o.x + x + dx, o.y + y + dy, c);
    }
  }
}

export function deleteSelection() {
  const idx = store.selectionIndices();
  if (!idx.length) return;
  store.beginEdit();
  for (const i of idx) state.doc.pixels[i] = null;
  store.commitEdit();
}

export function fillSelection() {
  const idx = store.selectionIndices();
  if (!idx.length) return;
  store.beginEdit();
  for (const i of idx) state.doc.pixels[i] = state.activeColor;
  store.commitEdit();
  // Maske aynı hücreleri göstermeye devam ediyor; rengini güncel tut.
  if (state.selection && state.selection.kind === 'mask') {
    state.selection.color = state.activeColor;
    store.emit('selection');
  }
}

/* ---------- Aynı rengi seç ---------- */

function selectSameColor(p) {
  const color = store.getPixel(p.x, p.y);
  if (!color) {
    store.setSelection(null);
    toast('Boş hücre — aynı renk seçmek için boyalı bir piksele tıkla');
    return;
  }
  const cells = store.cellsWithColor(color);
  store.setMaskSelection(cells, color);
  toast(`${cells.size} piksel seçildi · ${color}`);
}

/* ---------- Geometri yardımcıları ---------- */

function rectFrom(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

/** Bresenham */
function line(a, b, put) {
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Küçük ızgaralarda düzgün duran, örnekleme tabanlı elips. */
function ellipse(r, filled, put) {
  const cx = r.x + (r.w - 1) / 2;
  const cy = r.y + (r.h - 1) / 2;
  const rx = r.w / 2, ry = r.h / 2;

  const inside = (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1.0;
  };

  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!inside(x, y)) continue;
      if (filled) { put(x, y); continue; }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) put(x, y);
    }
  }
}
