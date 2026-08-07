// Görselden başlama: bir PNG/JPG'yi tuval boyutuna indirger, renk sayısını
// median-cut ile azaltır ve önizlemeden sonra tuvale uygular.

import * as store from './store.js';
import { state } from './store.js';
import { rgbToHex } from './color.js';
import { openModal, closeModal, toast } from './modal.js';

export function openImport(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Bu bir görsel dosyası değil.', true);
    return;
  }

  const img = new Image();
  img.onload = () => showDialog(img, file.name);
  img.onerror = () => toast('Görsel açılamadı.', true);
  img.src = URL.createObjectURL(file);
}

function showDialog(img, filename) {
  const d = state.doc;
  const opts = { colors: Math.min(16, state.colorLimit), cover: true, dropWhite: true, dominant: true };

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3>Görselden başla</h3>
    <p class="sub">${escapeHtml(filename)} → ${d.w}×${d.h} piksel</p>
    <div class="import-body">
      <div>
        <p class="import-cap">Kaynak</p>
        <canvas id="impSrc"></canvas>
      </div>
      <div>
        <p class="import-cap">Sonuç</p>
        <canvas id="impOut"></canvas>
      </div>
    </div>
    <div class="slider-row">
      <span>Renk sayısı</span>
      <input type="range" id="impColors" min="2" max="16" value="${opts.colors}">
      <span class="val" id="impColorsVal">${opts.colors}</span>
    </div>
    <label class="check-row"><input type="checkbox" id="impFlat" checked> Düz renkleri koru (çizgi/illüstrasyon için)</label>
    <label class="check-row"><input type="checkbox" id="impCover" checked> Kırparak doldur (kapatırsan görselin tamamı sığdırılır)</label>
    <label class="check-row"><input type="checkbox" id="impWhite" checked> Beyaz/açık arka planı şeffaf yap</label>
    <div class="modal-actions">
      <button class="btn" id="impCancel">Vazgeç</button>
      <button class="btn btn-primary" id="impApply" data-autofocus>Tuvale uygula</button>
    </div>
  `;

  openModal(wrap, { onClose: () => URL.revokeObjectURL(img.src) });

  const $src = wrap.querySelector('#impSrc');
  const $out = wrap.querySelector('#impOut');
  const $colors = wrap.querySelector('#impColors');
  const $colorsVal = wrap.querySelector('#impColorsVal');
  const $cover = wrap.querySelector('#impCover');
  const $white = wrap.querySelector('#impWhite');
  const $flat = wrap.querySelector('#impFlat');

  drawSource($src, img);

  let result = null;

  const refresh = () => {
    opts.colors = parseInt($colors.value, 10);
    opts.cover = $cover.checked;
    opts.dropWhite = $white.checked;
    opts.dominant = $flat.checked;
    $colorsVal.textContent = opts.colors;
    result = pixelize(img, d.w, d.h, opts);
    drawResult($out, result, d.w, d.h);
  };

  $colors.addEventListener('input', refresh);
  [$cover, $white, $flat].forEach((el) => el.addEventListener('change', refresh));
  refresh();

  wrap.querySelector('#impCancel').addEventListener('click', closeModal);
  wrap.querySelector('#impApply').addEventListener('click', () => {
    store.beginEdit();
    for (let i = 0; i < result.length; i++) state.doc.pixels[i] = result[i];
    store.commitEdit();
    for (const c of new Set(result.filter(Boolean))) store.addToPalette(c);
    closeModal();
    toast('Görsel tuvale uygulandı');
  });
}

/* ---------- Önizleme çizimi ---------- */

function drawSource(cv, img) {
  const size = 240;
  const s = Math.min(size / img.width, size / img.height);
  cv.width = Math.max(1, Math.round(img.width * s));
  cv.height = Math.max(1, Math.round(img.height * s));
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
}

function drawResult(cv, pixels, w, h) {
  const cell = Math.max(1, Math.floor(240 / Math.max(w, h)));
  cv.width = w * cell;
  cv.height = h * cell;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Dama deseni
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#F2EAE1' : '#FFFFFF';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = pixels[y * w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

/* ---------- Pikselize + renk indirgeme ---------- */

const CELL = 16;   // her hedef piksel için okunan kaynak örnek karesi

function pixelize(img, w, h, opts) {
  // 1) Görseli, hedef ızgaranın CELL katı çözünürlükte bir tuvale yerleştir.
  //    Böylece her hedef piksele karşılık CELL×CELL kaynak örneği düşüyor.
  const SW = w * CELL, SH = h * CELL;
  const cv = document.createElement('canvas');
  cv.width = SW; cv.height = SH;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const sAspect = img.width / img.height;
  const dAspect = w / h;
  let dw, dh;
  const fitInside = !opts.cover;
  if ((sAspect > dAspect) === fitInside) { dw = SW; dh = SW / sAspect; }
  else { dh = SH; dw = SH * sAspect; }
  ctx.drawImage(img, (SW - dw) / 2, (SH - dh) / 2, dw, dh);

  const data = ctx.getImageData(0, 0, SW, SH).data;

  // 2) Her hücreyi tek bir renge indir.
  //    "dominant" modda hücrenin en çok tekrar eden rengi alınır — düz renkli
  //    illüstrasyonlarda kenar yumuşatmasından gelen ara tonları elemek için.
  //    Kapalı olduğunda hücrenin ortalaması alınır (fotoğraf için daha iyi).
  const samples = [];
  const index = new Int32Array(w * h).fill(-1);

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const c = cellColor(data, SW, cx, cy, opts);
      if (!c) continue;
      index[cy * w + cx] = samples.length;
      samples.push(c);
    }
  }
  if (!samples.length) return new Array(w * h).fill(null);

  // 3) Renkleri indirge. Klasik median-cut piksel sayısına göre çalışır ve
  //    büyük düz alanlar (arka plan, gövde) küçük ama önemli ayrıntıları
  //    (gözler, ağız) yutar. Her rengi sayısının kareköküyle ağırlıklandırınca
  //    küçük renk adacıkları kendi kutusunu alabiliyor.
  const hist = new Map();
  for (const s of samples) {
    const key = (s.r << 16) | (s.g << 8) | s.b;
    const e = hist.get(key);
    if (e) e.n++; else hist.set(key, { r: s.r, g: s.g, b: s.b, n: 1 });
  }
  const weighted = [];
  for (const e of hist.values()) {
    const reps = Math.max(1, Math.round(Math.sqrt(e.n)));
    for (let i = 0; i < reps; i++) weighted.push(e);
  }
  const centroids = medianCut(weighted, opts.colors);
  const out = new Array(w * h).fill(null);
  for (let i = 0; i < w * h; i++) {
    if (index[i] < 0) continue;
    out[i] = rgbToHex(...nearest(samples[index[i]], centroids));
  }
  return out;
}

function cellColor(data, SW, cx, cy, opts) {
  const counts = opts.dominant ? new Map() : null;
  let sr = 0, sg = 0, sb = 0, kept = 0;

  for (let y = 0; y < CELL; y++) {
    const row = (cy * CELL + y) * SW;
    for (let x = 0; x < CELL; x++) {
      const i = (row + cx * CELL + x) * 4;
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (opts.dropWhite && r > 242 && g > 242 && b > 242) continue;
      kept++;
      sr += r; sg += g; sb += b;
      if (counts) {
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        const e = counts.get(key);
        if (e) { e.n++; e.r += r; e.g += g; e.b += b; }
        else counts.set(key, { n: 1, r, g, b });
      }
    }
  }

  // Hücrenin çoğu boş/beyazsa piksel şeffaf kalsın
  if (kept < CELL * CELL * 0.4) return null;

  if (counts) {
    let best = null;
    for (const e of counts.values()) if (!best || e.n > best.n) best = e;
    return round(best.r / best.n, best.g / best.n, best.b / best.n);
  }
  return round(sr / kept, sg / kept, sb / kept);
}

const round = (r, g, b) => ({ r: Math.round(r), g: Math.round(g), b: Math.round(b) });

function nearest(px, centroids) {
  let best = centroids[0], bd = Infinity;
  for (const c of centroids) {
    const d = (c[0] - px.r) ** 2 + (c[1] - px.g) ** 2 + (c[2] - px.b) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function medianCut(samples, k) {
  let boxes = [samples];

  while (boxes.length < k) {
    let bi = -1, bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const r = ranges(boxes[i]);
      const m = Math.max(r.r, r.g, r.b);
      if (m > bestRange) { bestRange = m; bi = i; }
    }
    if (bi < 0 || bestRange <= 0) break;

    const box = boxes[bi];
    const r = ranges(box);
    const ch = r.r >= r.g && r.r >= r.b ? 'r' : (r.g >= r.b ? 'g' : 'b');
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes.filter((b) => b.length).map((b) => {
    let r = 0, g = 0, bl = 0;
    for (const p of b) { r += p.r; g += p.g; bl += p.b; }
    return [r / b.length, g / b.length, bl / b.length];
  });
}

function ranges(box) {
  let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
  for (const p of box) {
    if (p.r < rmin) rmin = p.r; if (p.r > rmax) rmax = p.r;
    if (p.g < gmin) gmin = p.g; if (p.g > gmax) gmax = p.g;
    if (p.b < bmin) bmin = p.b; if (p.b > bmax) bmax = p.b;
  }
  return { r: rmax - rmin, g: gmax - gmin, b: bmax - bmin };
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
