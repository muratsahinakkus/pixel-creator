// SVG açma: daha önce indirilmiş bir SVG'yi (ve Figma'da düzenlenip yeniden
// export edilmiş hâlini) tekrar piksel ızgarasına oturtur.
//
// Yaklaşım: dosyadaki eksen hizalı bütün kareleri topla, aralarındaki en küçük
// adımdan ızgara çözünürlüğünü çıkar, sonra her kareyi hücreye yaz. Böylece
// hem bizim çıktımız (bitişik ve aralıklı) hem de Figma'nın <rect> yerine
// <path> üreten, komşu kareleri birleştiren çıktısı okunabiliyor.

import { rgbToHex } from './color.js';
import { EMPTY_FILL } from './exporters.js';

const MAX_SIDE = 128;

// Bir karenin ızgaraya oturduğunu kabul etmek için izin verilen kayma (adımın
// oranı olarak). Gerçek çıktılarda kayma sıfıra yakın; gevşek bir tolerans
// düzensiz dosyaları da "çözülmüş" gibi gösteriyor.
const ON_GRID_TOL = 0.15;

// Bu orandan fazlası oturmuyorsa dosya ızgara değildir; yaklaşık bir sonuç
// üretmek yerine hata veriyoruz.
const MAX_OFF_GRID = 0.1;
const SKIP_TAGS = new Set(['defs', 'clippath', 'mask', 'title', 'desc', 'style', 'metadata', 'filter']);

/**
 * @returns {{ doc, info }} info: { cols, rows, unit, gap, shapes, skipped }
 * @throws  Anlamlı bir hata mesajıyla — ızgara çözülemediğinde sessizce
 *          yanlış bir sonuç üretmek yerine kullanıcıya söylüyoruz.
 */
export function parseSVG(text, name) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Dosya geçerli bir SVG değil.');
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') throw new Error('Dosya geçerli bir SVG değil.');

  const rules = collectStyleRules(doc);
  const shapes = [];
  collect(root, [1, 0, 0, 1, 0, 0], null, shapes, rules);
  if (!shapes.length) throw new Error('SVG içinde kare bulunamadı — bu dosya piksel ızgarası değil.');

  const grid = inferGrid(shapes);
  const pixels = new Array(grid.cols * grid.rows).fill(null);
  let skipped = 0;

  // Belge sırası boyama sırasıdır: sonraki şekil öncekinin üstünü kapatır.
  for (const s of shapes) {
    const col = Math.round((s.x - grid.minX) / grid.pitch);
    const row = Math.round((s.y - grid.minY) / grid.pitch);
    const dx = Math.abs((s.x - grid.minX) - col * grid.pitch);
    const dy = Math.abs((s.y - grid.minY) - row * grid.pitch);
    if (dx > grid.pitch * ON_GRID_TOL || dy > grid.pitch * ON_GRID_TOL) { skipped++; continue; }

    const cols = Math.max(1, Math.round((s.w + grid.gap) / grid.pitch));
    const rows = Math.max(1, Math.round((s.h + grid.gap) / grid.pitch));
    for (let r = row; r < row + rows; r++) {
      for (let c = col; c < col + cols; c++) {
        if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
        pixels[r * grid.cols + c] = s.hex;
      }
    }
  }

  if (skipped > shapes.length * MAX_OFF_GRID) {
    throw new Error(
      `Izgara çözülemedi — ${shapes.length} karenin ${skipped} tanesi düzenli bir ızgaraya oturmuyor.`
    );
  }

  return {
    doc: {
      w: grid.cols,
      h: grid.rows,
      name: (name || 'svg').replace(/\.svg$/i, ''),
      pixels,
    },
    info: { cols: grid.cols, rows: grid.rows, unit: grid.unit, gap: grid.gap, shapes: shapes.length, skipped },
  };
}

/* ---------- Ağacı gez ---------- */

function collect(node, ctm, inheritedFill, out, rules) {
  for (const el of node.children) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;

    const css = cssFor(el, rules);
    if (isInvisible(el, css)) continue;

    const tAttr = el.getAttribute('transform');
    const m = tAttr ? mul(ctm, parseTransform(tAttr)) : ctm;
    const fill = fillOf(el, css) || inheritedFill;

    if (tag === 'g' || tag === 'svg' || tag === 'a') {
      collect(el, m, fill, out, rules);
      continue;
    }

    const rects = shapeToRects(el, tag);
    if (!rects || !rects.length) continue;

    // Hiçbir yerde fill belirtilmemişse SVG varsayılanı siyahtır.
    const hex = toHex(fill || '#000000');
    if (hex === null) continue;                    // fill="none" vb.
    const color = hex === EMPTY_FILL ? null : hex; // gri = boş hücre

    for (const r of rects) {
      const b = transformRect(r, m);
      if (b.w > 0 && b.h > 0) out.push({ ...b, hex: color });
    }
  }
}

/* ---------- <style> blokları ---------- */

/**
 * Illustrator (ve bazı Figma ayarları) renkleri fill attribute'u yerine
 * <defs><style> içindeki CSS sınıflarına yazıyor: .st0 { fill: #ffe486; }
 * Bu bloklar okunmazsa her şekil siyaha düşer.
 *
 * Basit seçiciler destekleniyor: .sinif, #kimlik, etiket, etiket.sinif ve
 * bunların virgülle ayrılmış listeleri. Daha karmaşık seçiciler atlanır.
 */
function collectStyleRules(doc) {
  const rules = [];
  for (const node of doc.querySelectorAll('style')) {
    const css = (node.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const decls = parseDecls(m[2]);
      if (!decls) continue;
      const selectors = m[1].split(',').map((t) => t.trim()).filter(Boolean);
      for (const sel of selectors) {
        const parsed = parseSelector(sel);
        if (parsed) rules.push({ ...parsed, decls });
      }
    }
  }
  return rules;
}

function parseDecls(body) {
  const out = {};
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k === 'fill' || k === 'display' || k === 'opacity' || k === 'fill-opacity') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function parseSelector(sel) {
  const m = /^([a-zA-Z][\w-]*)?(?:\.([\w-]+))?$/.exec(sel);
  if (m && (m[1] || m[2])) return { tag: m[1] ? m[1].toLowerCase() : null, cls: m[2] || null, id: null };
  const idm = /^#([\w-]+)$/.exec(sel);
  if (idm) return { tag: null, cls: null, id: idm[1] };
  return null;   // desteklenmeyen seçici
}

/** Elemana uyan kuralları belge sırasıyla birleştirir (sonraki kazanır). */
function cssFor(el, rules) {
  if (!rules || !rules.length) return null;
  const tag = el.tagName.toLowerCase();
  const id = el.getAttribute('id');
  const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  let out = null;
  for (const r of rules) {
    if (r.id && r.id !== id) continue;
    if (r.cls && !classes.includes(r.cls)) continue;
    if (r.tag && r.tag !== tag) continue;
    out = { ...(out || {}), ...r.decls };
  }
  return out;
}

function isInvisible(el, css) {
  const zero = (v) => v !== null && v !== undefined && parseFloat(v) === 0;
  if (zero(el.getAttribute('opacity')) || zero(el.getAttribute('fill-opacity'))) return true;
  if (css && (zero(css.opacity) || zero(css['fill-opacity']))) return true;
  if (css && /^\s*none\s*$/i.test(css.display || '')) return true;
  const style = el.getAttribute('style') || '';
  if (/display\s*:\s*none/.test(style)) return true;
  return el.getAttribute('display') === 'none';
}

/**
 * Öncelik sırası SVG/CSS kurallarına göre: satır içi style > <style> bloğundaki
 * kural > fill attribute'u. (SVG'de sunum attribute'u en düşük önceliklidir.)
 */
function fillOf(el, css) {
  const style = el.getAttribute('style');
  if (style) {
    const m = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
    if (m) return m[1].trim();
  }
  if (css && css.fill) return css.fill;
  return el.getAttribute('fill');
}

/* ---------- Şekilleri kareye indir ---------- */

function shapeToRects(el, tag) {
  const num = (a) => parseFloat(el.getAttribute(a) || '0') || 0;

  if (tag === 'rect') {
    return [{ x: num('x'), y: num('y'), w: num('width'), h: num('height') }];
  }
  if (tag === 'path') {
    return pathToRects(el.getAttribute('d') || '');
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const n = (el.getAttribute('points') || '').match(/-?\d*\.?\d+/g);
    if (!n) return null;
    const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([+n[i], +n[i + 1]]);
    const r = pointsToRect(pts);
    return r ? [r] : null;
  }
  return null;   // circle, ellipse, text, image — ızgara pikseli değil
}

/**
 * Bir path'i alt yollara ayırıp her birini eksen hizalı kareye çevirmeyi dener.
 * Figma tek bir path içinde aynı renkteki bütün kareleri birleştirebiliyor,
 * o yüzden alt yol başına bir kare üretiyoruz.
 */
function pathToRects(d) {
  if (!d || /[CcSsQqTtAa]/.test(d)) return null;   // eğri varsa kare değil

  const out = [];
  let sub = null;
  let x = 0, y = 0, sx = 0, sy = 0;

  const re = /([MmLlHhVvZz])([^MmLlHhVvZz]*)/g;
  let g;
  while ((g = re.exec(d))) {
    const cmd = g[1];
    const n = (g[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);

    if (cmd === 'M' || cmd === 'm') {
      if (sub && sub.length) out.push(sub);
      sub = [];
      for (let i = 0; i + 1 < n.length; i += 2) {
        if (cmd === 'M') { x = n[i]; y = n[i + 1]; } else { x += n[i]; y += n[i + 1]; }
        sub.push([x, y]);
      }
      if (sub.length) { sx = sub[0][0]; sy = sub[0][1]; }
      continue;
    }
    if (!sub) return null;

    if (cmd === 'L' || cmd === 'l') {
      for (let i = 0; i + 1 < n.length; i += 2) {
        if (cmd === 'L') { x = n[i]; y = n[i + 1]; } else { x += n[i]; y += n[i + 1]; }
        sub.push([x, y]);
      }
    } else if (cmd === 'H' || cmd === 'h') {
      for (const v of n) { x = cmd === 'H' ? v : x + v; sub.push([x, y]); }
    } else if (cmd === 'V' || cmd === 'v') {
      for (const v of n) { y = cmd === 'V' ? v : y + v; sub.push([x, y]); }
    } else {           // Z / z
      x = sx; y = sy;
    }
  }
  if (sub && sub.length) out.push(sub);

  const rects = [];
  for (const pts of out) {
    const r = pointsToRect(pts);
    if (r) rects.push(r);
  }
  return rects.length ? rects : null;
}

/** Noktalar eksen hizalı bir dikdörtgen oluşturuyorsa onu döndürür. */
function pointsToRect(pts) {
  const uniq = [];
  for (const p of pts) {
    if (!uniq.some((q) => near(q[0], p[0]) && near(q[1], p[1]))) uniq.push(p);
  }
  if (uniq.length !== 4) return null;

  const xs = [...new Set(uniq.map((p) => round4(p[0])))];
  const ys = [...new Set(uniq.map((p) => round4(p[1])))];
  if (xs.length !== 2 || ys.length !== 2) return null;

  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* ---------- Dönüşümler ---------- */

function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0];
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi;
  let g;
  while ((g = re.exec(str))) {
    const n = g[2].split(/[\s,]+/).filter(Boolean).map(Number);
    const kind = g[1].toLowerCase();
    let t;
    if (kind === 'matrix') t = n.slice(0, 6);
    else if (kind === 'translate') t = [1, 0, 0, 1, n[0] || 0, n[1] || 0];
    else if (kind === 'scale') t = [n[0] || 1, 0, 0, (n.length > 1 ? n[1] : n[0]) || 1, 0, 0];
    else {
      const deg = ((n[0] || 0) % 360 + 360) % 360;
      if (deg > 0.01) throw new Error('SVG döndürülmüş içerik barındırıyor, ızgaraya oturtamıyorum.');
      t = [1, 0, 0, 1, 0, 0];
    }
    m = mul(m, t);
  }
  return m;
}

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

function transformRect(r, m) {
  const pt = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const corners = [pt(r.x, r.y), pt(r.x + r.w, r.y), pt(r.x, r.y + r.h), pt(r.x + r.w, r.y + r.h)];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* ---------- Izgara çıkarımı ---------- */

function inferGrid(shapes) {
  const minX = Math.min(...shapes.map((s) => s.x));
  const minY = Math.min(...shapes.map((s) => s.y));
  const maxR = Math.max(...shapes.map((s) => s.x + s.w));
  const maxB = Math.max(...shapes.map((s) => s.y + s.h));

  // Tek hücrenin kenarı: en küçük kare. Birleştirilmiş kareler olsa bile
  // dosyada neredeyse her zaman en az bir tek hücre bulunuyor.
  const unit = Math.min(...shapes.map((s) => Math.min(s.w, s.h)));
  if (!(unit > 0)) throw new Error('SVG içindeki kareler ölçüsüz — ızgara çözülemedi.');

  // Adım: kare başlangıçları arasındaki en küçük pozitif fark. Birleştirilmiş
  // kareler bu farkın katı olduğu için en küçüğü doğru adımı veriyor.
  // Hücre kenarından küçük farklar (üst üste binen şekiller) elenir.
  const gaps = [minGap(shapes.map((s) => s.x)), minGap(shapes.map((s) => s.y))]
    .filter((v) => v !== null && v >= unit - 1e-4);
  const step = gaps.length ? Math.min(...gaps) : unit;
  const gap = step - unit;

  const cols = Math.round((maxR - minX + gap) / step);
  const rows = Math.round((maxB - minY + gap) / step);

  if (!(cols >= 1 && rows >= 1)) throw new Error('Izgara çözülemedi.');
  if (cols > MAX_SIDE || rows > MAX_SIDE) {
    throw new Error(`Izgara çok büyük (${cols}×${rows}) — en fazla ${MAX_SIDE}×${MAX_SIDE} açılabiliyor.`);
  }

  return { minX, minY, unit, pitch: step, gap, cols, rows };
}

/** Sıralı benzersiz değerler arasındaki en küçük pozitif fark. */
function minGap(values) {
  const v = [...new Set(values.map(round4))].sort((a, b) => a - b);
  let best = Infinity;
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1];
    if (d > 1e-4 && d < best) best = d;
  }
  return Number.isFinite(best) ? best : null;
}

/* ---------- Renk ---------- */

let probe = null;
function probeCtx() {
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  return probe;
}

/** CSS rengini '#RRGGBB'ye çevirir; şeffaf/geçersizse null. */
function toHex(css) {
  if (!css) return null;
  const s = String(css).trim().toLowerCase();
  if (!s || s === 'none' || s === 'transparent' || s.startsWith('url(')) return null;

  const ctx = probeCtx();
  ctx.fillStyle = '#010203'; ctx.fillStyle = s;
  const a = ctx.fillStyle;
  ctx.fillStyle = '#040506'; ctx.fillStyle = s;
  if (a !== ctx.fillStyle) return null;            // tarayıcı çözemedi

  if (a.startsWith('#')) return a.toUpperCase();
  const m = a.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((v) => parseFloat(v));
  if (p.length > 3 && p[3] === 0) return null;
  return rgbToHex(p[0], p[1], p[2]);
}

const round4 = (v) => Math.round(v * 10000) / 10000;
const near = (a, b) => Math.abs(a - b) < 1e-4;
