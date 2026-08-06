// Dışa aktarma: SVG (her piksel bir <rect>), PNG ve .json proje dosyası.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Her dolu piksel için bir <rect> üretir. Figma'ya yapıştırıldığında
 * her kare ayrı bir obje olarak gelir; viewBox piksel birimindedir,
 * yani ölçekleme her zaman keskin kalır.
 */
export function toSVG(doc, opts = {}) {
  const scale = opts.scale || 32;
  const background = opts.background || null;

  const lines = [];
  lines.push(
    `<svg xmlns="${SVG_NS}" width="${doc.w * scale}" height="${doc.h * scale}" ` +
    `viewBox="0 0 ${doc.w} ${doc.h}" shape-rendering="crispEdges">`
  );
  lines.push(`  <title>${escapeXml(doc.name)}</title>`);
  if (background) {
    lines.push(`  <rect x="0" y="0" width="${doc.w}" height="${doc.h}" fill="${background}"/>`);
  }
  lines.push(`  <g id="pixels">`);
  for (let y = 0; y < doc.h; y++) {
    for (let x = 0; x < doc.w; x++) {
      const c = doc.pixels[y * doc.w + x];
      if (!c) continue;
      lines.push(`    <rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`);
    }
  }
  lines.push(`  </g>`);
  lines.push(`</svg>`);
  return lines.join('\n');
}

export function toPNGBlob(doc, scale) {
  const cv = document.createElement('canvas');
  cv.width = doc.w * scale;
  cv.height = doc.h * scale;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < doc.h; y++) {
    for (let x = 0; x < doc.w; x++) {
      const c = doc.pixels[y * doc.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
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
