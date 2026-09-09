// Uygulama durumu: belge modeli, palet, seçim ve geri/ileri al yığını.
//
// Belge çok küçük (en fazla 21x21 = 441 piksel) olduğu için pikselleri
// düz bir dizide hex string olarak tutuyoruz; boş piksel = null.
// Bu sayede geri alma işlemi basit bir dizi kopyası, renk sayımı da
// tek geçişte hallolan bir işlem oluyor.

const bus = new EventTarget();

export function on(type, fn) {
  bus.addEventListener(type, (e) => fn(e.detail));
}

export function emit(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

export const SIZES = [12, 16, 20, 21];

export const DEFAULT_PALETTE = [
  '#FFFFFF', '#D8D8D8', '#9A9A9A', '#5A5A5A', '#2B2B2B', '#FFE486', '#FFC93C', '#F0A500',
  '#FFD9A8', '#F0995B', '#C1663A', '#7A3B1E', '#FFC0B4', '#FF9A8B', '#FF6B4A', '#B3261E',
  '#FFB8D2', '#FF7BAC', '#C2185B', '#D9B3F2', '#A66BD6', '#5B2E8C', '#B8E6A0', '#7BC96F',
  '#2F7A3D', '#8FDCF5', '#3DB4E0', '#1E6FA8', '#A8E6D8', '#38B49A', '#0E7C66', '#FFF7EE',
];

const MAX_HISTORY = 120;

export const state = {
  doc: null,          // { w, h, name, pixels: (string|null)[] }
  tool: 'pencil',
  activeColor: '#FF6B4A',
  palette: DEFAULT_PALETTE.slice(),
  recent: [],
  mirrorX: false,
  mirrorY: false,
  showGrid: true,
  // İki seçim türü var: dikdörtgen (taşınabilir) ve maske (dağınık hücreler,
  // "aynı rengi seç" aracının ürettiği — taşınmaz, boyanır/silinir).
  selection: null,    // { kind:'rect', x, y, w, h } | { kind:'mask', cells:Set<number>, color }
  colorLimit: 12,
  // Arkadaki referans görsel. x/y/w belge-piksel biriminde tutulur, böylece
  // yakınlaştırma ve kaydırmada tuvale sabit kalır. img serileştirilmez.
  reference: null,    // { src, img, aspect, x, y, w, opacity, visible }
};

let past = [];
let future = [];
let pending = null;

/* ---------- Belge ---------- */

export function newDoc(w, h, name) {
  state.doc = {
    w, h,
    name: name || `pixel-${w}x${h}`,
    pixels: new Array(w * h).fill(null),
  };
  state.selection = null;
  past = []; future = []; pending = null;
  emit('doc');
  emit('history');
  emit('selection');
  emit('pixels');
}

export function loadDoc(doc) {
  state.doc = doc;
  state.selection = null;
  past = []; future = []; pending = null;
  emit('doc');
  emit('history');
  emit('selection');
  emit('pixels');
}

export function inBounds(x, y) {
  const d = state.doc;
  return x >= 0 && y >= 0 && x < d.w && y < d.h;
}

export function getPixel(x, y) {
  if (!inBounds(x, y)) return null;
  return state.doc.pixels[y * state.doc.w + x];
}

/** Tek piksel yazar. Simetri uygulanmaz — onu tools.js yapar. */
export function setPixel(x, y, color) {
  if (!inBounds(x, y)) return false;
  const i = y * state.doc.w + x;
  if (state.doc.pixels[i] === color) return false;
  state.doc.pixels[i] = color;
  return true;
}

export function clearDoc() {
  beginEdit();
  state.doc.pixels.fill(null);
  commitEdit();
}

/* ---------- Geri / ileri al ---------- */

export function beginEdit() {
  if (pending) return;
  pending = state.doc.pixels.slice();
}

export function commitEdit() {
  if (!pending) return;
  const changed = pending.some((v, i) => v !== state.doc.pixels[i]);
  if (changed) {
    past.push(pending);
    if (past.length > MAX_HISTORY) past.shift();
    future.length = 0;
    emit('history');
  }
  pending = null;
  emit('pixels');
}

/** Şekil araçlarının canlı önizlemesi: her hareket öncesi başlangıca dön. */
export function restorePending() {
  if (!pending) return;
  state.doc.pixels = pending.slice();
}

export function cancelEdit() {
  if (!pending) return;
  state.doc.pixels = pending;
  pending = null;
  emit('pixels');
}

export function undo() {
  if (!past.length) return;
  future.push(state.doc.pixels.slice());
  state.doc.pixels = past.pop();
  emit('pixels');
  emit('history');
}

export function redo() {
  if (!future.length) return;
  past.push(state.doc.pixels.slice());
  state.doc.pixels = future.pop();
  emit('pixels');
  emit('history');
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

/* ---------- Renk ---------- */

export function setActiveColor(hex) {
  if (!hex || hex === state.activeColor) return;
  state.activeColor = hex;
  state.recent = [hex, ...state.recent.filter((c) => c !== hex)].slice(0, 12);
  emit('color');
}

export function addToPalette(hex) {
  if (state.palette.includes(hex)) return false;
  state.palette.push(hex);
  emit('palette');
  return true;
}

export function removeFromPalette(hex) {
  const i = state.palette.indexOf(hex);
  if (i < 0) return;
  state.palette.splice(i, 1);
  emit('palette');
}

export function resetPalette() {
  state.palette = DEFAULT_PALETTE.slice();
  emit('palette');
}

/** Tasarımda geçen renkler, çok kullanılandan aza doğru: [{ hex, n }] */
export function usedColors() {
  const counts = new Map();
  for (const c of state.doc.pixels) {
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([hex, n]) => ({ hex, n }))
    .sort((a, b) => b.n - a.n);
}

/** Bir rengin bütün piksellerini başka bir renge çevirir. */
export function replaceColor(from, to) {
  beginEdit();
  const px = state.doc.pixels;
  for (let i = 0; i < px.length; i++) if (px[i] === from) px[i] = to;
  commitEdit();
}

/* ---------- Referans görsel ---------- */

export function setReference(ref) {
  state.reference = ref;
  emit('reference');
}

export function updateReference(patch) {
  if (!state.reference) return;
  Object.assign(state.reference, patch);
  emit('reference');
}

export function clearReference() {
  state.reference = null;
  emit('reference');
}

/** Görseli tuvale tamamen sığdıran genişlik (belge-piksel biriminde). */
export function referenceFitWidth() {
  const r = state.reference;
  const d = state.doc;
  if (!r || !d) return 0;
  return r.aspect >= d.w / d.h ? d.w : d.h * r.aspect;
}

/** Görseli tuvale sığdırıp ortalar. */
export function fitReference() {
  const r = state.reference;
  const d = state.doc;
  if (!r || !d) return;
  const w = referenceFitWidth();
  const h = w / r.aspect;
  Object.assign(r, { x: (d.w - w) / 2, y: (d.h - h) / 2, w });
  emit('reference');
}

/* ---------- Ayar bayrakları ---------- */

export function setTool(tool) {
  if (state.tool === tool) return;
  state.tool = tool;
  if (tool !== 'select' && tool !== 'samecolor') {
    state.selection = null;
    emit('selection');
  }
  emit('tool');
  emit('pixels');
}

export function toggle(key) {
  state[key] = !state[key];
  emit('flags');
  emit('pixels');
}

export function setSelection(sel) {
  state.selection = sel;
  emit('selection');
  emit('pixels');
}

export function setMaskSelection(cells, color) {
  setSelection(cells && cells.size ? { kind: 'mask', cells, color } : null);
}

/** Seçimin kapsadığı piksel indeksleri — her iki seçim türü için de çalışır. */
export function selectionIndices() {
  const sel = state.selection;
  const d = state.doc;
  if (!sel || !d) return [];
  if (sel.kind === 'mask') return [...sel.cells];
  const out = [];
  for (let y = sel.y; y < sel.y + sel.h; y++) {
    for (let x = sel.x; x < sel.x + sel.w; x++) {
      if (x >= 0 && y >= 0 && x < d.w && y < d.h) out.push(y * d.w + x);
    }
  }
  return out;
}

/** Tuvalde verilen renkteki bütün hücrelerin indeksleri. */
export function cellsWithColor(color) {
  const cells = new Set();
  const px = state.doc.pixels;
  for (let i = 0; i < px.length; i++) if (px[i] === color) cells.add(i);
  return cells;
}

export function setColorLimit(n) {
  state.colorLimit = n;
  emit('pixels');
}
