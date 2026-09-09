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
  const opts = { colors: Math.min(16, state.colorLimit), cover: false, dropWhite: true, dominant: true };

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
    <label class="check-row"><input type="checkbox" id="impCover" checked> Kırparak doldur (varsayılan: tamamını sığdır)</label>
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

// Kaynak görselden okunacak en fazla piksel. Bunun üstünde küçültmek
// zorundayız; altında kaynak olduğu gibi okunur.
const MAX_SOURCE_PIXELS = 12e6;

// Bir hücrenin renk alması için gereken en az dolu örnek oranı.
const MIN_COVERAGE = 0.4;

// Baskın rengin hücrede tutması gereken en az pay. Altına düşerse oylama
// güvenilmez sayılıp hücrenin ortasındaki örnek kullanılır.
const MIN_CONSENSUS = 0.2;

function pixelize(img, w, h, opts) {
  const src = readSource(img);
  const box = gridBox(src.w, src.h, w, h, opts.cover);

  // Her hücreyi tek bir renge indir. "dominant" modda hücredeki en çok
  // tekrar eden GERÇEK kaynak rengi alınır (ortalama alınmaz), böylece zaten
  // piksel olan görsellerde renkler birebir korunuyor. Kapalıyken hücre
  // ortalaması alınır — fotoğraflarda daha yumuşak sonuç veriyor.
  const samples = [];
  const index = new Int32Array(w * h).fill(-1);

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const c = cellColor(src, box, cx, cy, w, h, opts);
      if (!c) continue;
      index[cy * w + cx] = samples.length;
      samples.push(c);
    }
  }
  if (!samples.length) return new Array(w * h).fill(null);

  const out = new Array(w * h).fill(null);

  // Sonuç istenen renk sayısına zaten sığıyorsa hiç indirgeme yapma.
  // Piksel görselinden gelen palet aynen çıkar.
  const distinct = new Set(samples.map(keyOf));
  if (distinct.size <= opts.colors) {
    for (let i = 0; i < w * h; i++) {
      if (index[i] < 0) continue;
      const c = samples[index[i]];
      out[i] = rgbToHex(c.r, c.g, c.b);
    }
    return out;
  }

  // Renkleri indirge. Klasik median-cut piksel sayısına göre çalışır ve büyük
  // düz alanlar (arka plan, gövde) küçük ama önemli ayrıntıları (gözler, ağız)
  // yutar. Her rengi sayısının kareköküyle ağırlıklandırınca küçük renk
  // adacıkları kendi kutusunu alabiliyor.
  const hist = new Map();
  for (const s of samples) {
    const key = keyOf(s);
    const e = hist.get(key);
    if (e) e.n++; else hist.set(key, { r: s.r, g: s.g, b: s.b, n: 1 });
  }
  const weighted = [];
  for (const e of hist.values()) {
    const reps = Math.max(1, Math.round(Math.sqrt(e.n)));
    for (let i = 0; i < reps; i++) weighted.push(e);
  }
  const centroids = medianCut(weighted, opts.colors);
  for (let i = 0; i < w * h; i++) {
    if (index[i] < 0) continue;
    out[i] = rgbToHex(...nearest(samples[index[i]], centroids));
  }
  return out;
}

/**
 * Kaynağı kendi çözünürlüğünde okur. Araya bir ölçekleme koymak piksel
 * sınırlarını bulanıklaştırıyor ve zaten piksel olan görsellerde renkleri
 * kaydırıyor; o yüzden sadece çok büyük görsellerde küçültüyoruz.
 */
function readSource(img) {
  let w = img.width, h = img.height;
  const total = w * h;
  const shrink = total > MAX_SOURCE_PIXELS;
  if (shrink) {
    const k = Math.sqrt(MAX_SOURCE_PIXELS / total);
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = shrink;
  if (shrink) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

/**
 * Hedef ızgaranın kaynak üzerindeki karşılığı.
 * cover: ızgara oranındaki en büyük kutu görselin İÇİNE oturur (kırpar).
 * contain: kutu görseli SARAR (kenarlarda boşluk kalır).
 */
function gridBox(sw, sh, w, h, cover) {
  const sAspect = sw / sh;
  const dAspect = w / h;
  let dw, dh;
  if (cover ? sAspect > dAspect : sAspect <= dAspect) {
    dh = sh; dw = sh * dAspect;
  } else {
    dw = sw; dh = sw / dAspect;
  }
  return { ox: (sw - dw) / 2, oy: (sh - dh) / 2, dw, dh };
}

function cellColor(src, box, cx, cy, w, h, opts) {
  const cw = box.dw / w;
  const ch = box.dh / h;

  let x0 = Math.round(box.ox + cx * cw);
  let x1 = Math.round(box.ox + (cx + 1) * cw);
  let y0 = Math.round(box.oy + cy * ch);
  let y1 = Math.round(box.oy + (cy + 1) * ch);
  // Hedef ızgara kaynaktan daha ince olabilir: hücreye tek kaynak pikseli düşsün.
  if (x1 <= x0) { x0 = Math.floor(box.ox + (cx + 0.5) * cw); x1 = x0 + 1; }
  if (y1 <= y0) { y0 = Math.floor(box.oy + (cy + 0.5) * ch); y1 = y0 + 1; }

  const slots = (x1 - x0) * (y1 - y0);
  const counts = opts.dominant ? new Map() : null;
  let sr = 0, sg = 0, sb = 0, kept = 0;

  const xa = Math.max(0, x0), xb = Math.min(src.w, x1);
  const ya = Math.max(0, y0), yb = Math.min(src.h, y1);

  // Hücrenin ortasındaki örnek: bulanık kaynaklarda en az kirlenmiş nokta.
  const mid = pixelAt(src, (xa + xb - 1) >> 1, (ya + yb - 1) >> 1, opts);

  for (let y = ya; y < yb; y++) {
    const row = y * src.w;
    for (let x = xa; x < xb; x++) {
      const i = (row + x) * 4;
      if (src.data[i + 3] < 128) continue;
      const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
      if (opts.dropWhite && r > 242 && g > 242 && b > 242) continue;
      kept++;
      sr += r; sg += g; sb += b;
      if (counts) {
        const key = (r << 16) | (g << 8) | b;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  // Hücrenin çoğu şeffaf/beyazsa (ya da ızgara görselin dışına taşıyorsa) boş kalsın
  if (kept < slots * MIN_COVERAGE) return null;

  if (counts) {
    let bestKey = -1, bestN = -1;
    for (const [key, n] of counts) if (n > bestN) { bestN = n; bestKey = key; }
    // Kazanan hücrenin anlamlı bir kısmını temsil etmiyorsa oylamanın değeri
    // yok (kaynak bulanık kaydedilmiş, her örnek farklı): kazanan yalnızca
    // tarama sırasına göre köşedeki örnek olur. Böyle durumlarda hücrenin
    // ortasındaki örneği alıyoruz — bulanıklıktan en az etkilenen nokta.
    if (mid && bestN < kept * MIN_CONSENSUS) return mid;
    return { r: (bestKey >> 16) & 255, g: (bestKey >> 8) & 255, b: bestKey & 255 };
  }
  return { r: Math.round(sr / kept), g: Math.round(sg / kept), b: Math.round(sb / kept) };
}

/** Tek bir kaynak pikselini okur; şeffaf ya da elenmişse null. */
function pixelAt(src, x, y, opts) {
  if (x < 0 || y < 0 || x >= src.w || y >= src.h) return null;
  const i = (y * src.w + x) * 4;
  if (src.data[i + 3] < 128) return null;
  const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
  if (opts.dropWhite && r > 242 && g > 242 && b > 242) return null;
  return { r, g, b };
}

const keyOf = (c) => (c.r << 16) | (c.g << 8) | c.b;

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
