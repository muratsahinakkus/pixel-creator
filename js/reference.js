// Arkaya referans görsel: tuvalin altına yerleşen, üzerinden çizilebilen altlık.
//
// Görsel piksellere çevrilmez (o iş importer.js'te); sadece dama deseninin
// üstünde, piksellerin altında gösterilir. Konum ve ölçek belge-piksel
// biriminde tutulur, böylece yakınlaştırma/kaydırmada tuvale sabit kalır.

import * as store from './store.js';
import { state } from './store.js';
import { toast } from './modal.js';

/** Gömülürken görselin uzun kenarı bu değere indirilir. */
const MAX_EDGE = 1200;

let $panel, $pick, $file, $remove, $controls, $hint;
let $opacity, $opacityVal, $scale, $x, $y, $toggle, $fit;

export function init() {
  $panel     = document.getElementById('refPanel');
  $pick      = document.getElementById('refPick');
  $file      = document.getElementById('refFile');
  $remove    = document.getElementById('refRemove');
  $controls  = document.getElementById('refControls');
  $hint      = document.getElementById('refHint');
  $opacity   = document.getElementById('refOpacity');
  $opacityVal = document.getElementById('refOpacityVal');
  $scale     = document.getElementById('refScale');
  $x         = document.getElementById('refX');
  $y         = document.getElementById('refY');
  $toggle    = document.getElementById('refToggle');
  $fit       = document.getElementById('refFit');

  $pick.addEventListener('click', () => $file.click());
  $file.addEventListener('change', () => {
    const f = $file.files[0];
    if (f) load(f);
    $file.value = '';
  });

  $remove.addEventListener('click', () => {
    store.clearReference();
    toast('Referans görsel kaldırıldı');
  });

  $opacity.addEventListener('input', () => {
    store.updateReference({ opacity: parseInt($opacity.value, 10) / 100 });
  });

  $scale.addEventListener('change', () => {
    const pct = Math.max(5, Math.min(2000, parseFloat($scale.value) || 100));
    const fitW = store.referenceFitWidth();
    if (!fitW) return;
    resizeAroundCenter(fitW * pct / 100);
  });

  $x.addEventListener('change', () => store.updateReference({ x: parseFloat($x.value) || 0 }));
  $y.addEventListener('change', () => store.updateReference({ y: parseFloat($y.value) || 0 }));

  $toggle.addEventListener('click', () => {
    store.updateReference({ visible: !state.reference.visible });
  });

  $fit.addEventListener('click', store.fitReference);

  store.on('reference', sync);
  store.on('doc', sync);
  sync();
}

/** Ölçeği merkez sabit kalacak şekilde değiştirir. */
function resizeAroundCenter(newW) {
  const r = state.reference;
  if (!r) return;
  const h = r.w / r.aspect;
  const nh = newW / r.aspect;
  store.updateReference({
    x: r.x + (r.w - newW) / 2,
    y: r.y + (h - nh) / 2,
    w: newW,
  });
}

function sync() {
  const r = state.reference;
  const has = !!r;
  $controls.classList.toggle('hidden', !has);
  $remove.classList.toggle('hidden', !has);
  $pick.textContent = has ? 'Görseli değiştir' : 'Görsel seç';
  $hint.textContent = has
    ? 'Araç çubuğundaki referans aracıyla tuvalde sürükle, tekerlekle ölçekle.'
    : 'Üzerinden çizmek için tuvalin arkasına bir görsel koy.';
  if (!has) return;

  $opacity.value = Math.round(r.opacity * 100);
  $opacityVal.textContent = `${Math.round(r.opacity * 100)}%`;
  const fitW = store.referenceFitWidth();
  $scale.value = fitW ? Math.round(r.w / fitW * 100) : 100;
  $x.value = round1(r.x);
  $y.value = round1(r.y);
  $toggle.textContent = r.visible ? 'Gizle' : 'Göster';
  $toggle.classList.toggle('btn-primary', !r.visible);
}

const round1 = (v) => Math.round(v * 10) / 10;

/* ---------- Görsel yükleme ---------- */

async function load(file) {
  if (!file.type.startsWith('image/')) {
    toast('Bu bir görsel dosyası değil.', true);
    return;
  }
  try {
    const src = await shrinkToDataURL(file);
    await hydrate({ src, opacity: state.reference ? state.reference.opacity : 0.5, visible: true });
    toast('Referans görsel eklendi');
  } catch {
    toast('Görsel açılamadı.', true);
  }
}

/**
 * Görseli MAX_EDGE'e indirip data URL'e çevirir. Saydamlık varsa PNG,
 * yoksa JPEG — fotoğraf referanslarında dosyayı belirgin şekilde küçültüyor.
 */
async function shrinkToDataURL(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * k));
    const h = Math.max(1, Math.round(img.height * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return hasAlpha(ctx, w, h) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasAlpha(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/**
 * Kaydedilmiş referans verisini canlı hâle getirir (proje dosyası ve
 * otomatik kayıttan geri yüklerken de bu kullanılıyor).
 */
export async function hydrate(data) {
  if (!data || !data.src) return;
  const img = await loadImage(data.src);
  store.setReference({
    src: data.src,
    img,
    aspect: img.width / img.height,
    x: 0, y: 0, w: 0,
    opacity: typeof data.opacity === 'number' ? data.opacity : 0.5,
    visible: data.visible !== false,
  });
  if (typeof data.w === 'number' && data.w > 0) {
    store.updateReference({ x: data.x || 0, y: data.y || 0, w: data.w });
  } else {
    store.fitReference();
  }
}

/** Diske yazılacak hâli — img gibi serileştirilemeyen alanlar dışarıda kalır. */
export function serialize() {
  const r = state.reference;
  if (!r) return null;
  return { src: r.src, x: r.x, y: r.y, w: r.w, opacity: r.opacity, visible: r.visible };
}
