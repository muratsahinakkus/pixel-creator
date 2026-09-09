// Dışa aktarma: SVG (her piksel bir <rect>), PNG ve .json proje dosyası.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG'de boyanmamış hücrelerin dolgusu — Figma'da tıklanıp boyanabilsin diye. */
export const EMPTY_FILL = '#E6E6E6';

/** Aralıklı çıktıda kareler arasındaki ve dış kenardaki boşluk (px). */
export const GAP = 4;

/**
 * Her hücre için bir <rect> üretir; Figma'ya yapıştırıldığında her kare ayrı
 * bir obje olur. Boyanmamış hücreler emptyFill ile gelir (null verilirse hiç
 * yazılmaz).
 *
 * gap = 0 → kareler bitişik, viewBox piksel biriminde (1 birim = 1 piksel).
 * gap > 0 → kareler arasında ve dış kenarda gap kadar boşluk. Boşlukların tam
 *           sayı kalması için koordinatlar gerçek px cinsinden yazılır.
 */
export function toSVG(doc, opts = {}) {
  const scale = opts.scale || 32;
  const gap = opts.gap || 0;
  const emptyFill = 'emptyFill' in opts ? opts.emptyFill : EMPTY_FILL;
  const background = opts.background || null;

  const unit = gap > 0 ? scale : 1;   // bir karenin kenarı
  const step = unit + gap;            // iki karenin sol kenarları arası
  const vbW = doc.w * step + gap;     // dış kenardaki pay dahil
  const vbH = doc.h * step + gap;
  const pxW = gap > 0 ? vbW : doc.w * scale;
  const pxH = gap > 0 ? vbH : doc.h * scale;

  const lines = [];
  lines.push(
    `<svg xmlns="${SVG_NS}" width="${pxW}" height="${pxH}" ` +
    `viewBox="0 0 ${vbW} ${vbH}" shape-rendering="crispEdges">`
  );
  lines.push(`  <title>${escapeXml(doc.name)}</title>`);
  if (background) {
    lines.push(`  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="${background}"/>`);
  }
  lines.push(`  <g id="pixels">`);
  for (let y = 0; y < doc.h; y++) {
    for (let x = 0; x < doc.w; x++) {
      const fill = doc.pixels[y * doc.w + x] || emptyFill;
      if (!fill) continue;
      lines.push(
        `    <rect x="${gap + x * step}" y="${gap + y * step}" ` +
        `width="${unit}" height="${unit}" fill="${fill}"/>`
      );
    }
  }
  lines.push(`  </g>`);
  lines.push(`</svg>`);
  return lines.join('\n');
}

/** PNG'de boyanmamış hücreler şeffaf kalır — gri dolgu yalnızca SVG'ye özel. */
export function toPNGBlob(doc, scale, gap = 0) {
  const step = scale + gap;
  const cv = document.createElement('canvas');
  cv.width = doc.w * step + gap;
  cv.height = doc.h * step + gap;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < doc.h; y++) {
    for (let x = 0; x < doc.w; x++) {
      const c = doc.pixels[y * doc.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(gap + x * step, gap + y * step, scale, scale);
    }
  }
  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

export function toProject(doc, palette) {
  return JSON.stringify({
    format: 'pixel-creator',
    version: 1,
    name: doc.name,
    width: doc.w,
    height: doc.h,
    palette,
    pixels: doc.pixels,
  }, null, 2);
}

export function parseProject(text) {
  const j = JSON.parse(text);
  if (j.format !== 'pixel-creator') throw new Error('Bu bir Pixel Creator proje dosyası değil.');
  if (!Number.isInteger(j.width) || !Number.isInteger(j.height)) throw new Error('Boyut bilgisi bozuk.');
  if (!Array.isArray(j.pixels) || j.pixels.length !== j.width * j.height) {
    throw new Error('Piksel verisi boyutla uyuşmuyor.');
  }
  return {
    doc: {
      w: j.width,
      h: j.height,
      name: j.name || `pixel-${j.width}x${j.height}`,
      pixels: j.pixels.map((c) => (typeof c === 'string' ? c.toUpperCase() : null)),
    },
    palette: Array.isArray(j.palette) ? j.palette : null,
  };
}

/* ---------- İndirme ---------- */

export function downloadText(filename, text, mime) {
  download(filename, new Blob([text], { type: mime }));
}

export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
