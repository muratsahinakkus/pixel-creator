// Tarayıcı yerel kaydı: kaza koruması. Asıl arşivleme .json export ile yapılır.

import { state, on } from './store.js';

const KEY_DOC = 'pixelcreator:autosave:v1';
const KEY_PREFS = 'pixelcreator:prefs:v1';

let timer = null;

export function init() {
  on('pixels', schedule);
  on('doc', schedule);
  on('palette', savePrefs);
  on('flags', savePrefs);
  on('color', savePrefs);
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(saveDoc, 400);
}

function saveDoc() {
  if (!state.doc) return;
  try {
    localStorage.setItem(KEY_DOC, JSON.stringify({
      name: state.doc.name,
      w: state.doc.w,
      h: state.doc.h,
      pixels: state.doc.pixels,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* kota dolu — sessizce geç */ }
}

export function loadDoc() {
  try {
    const raw = localStorage.getItem(KEY_DOC);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.pixels) || j.pixels.length !== j.w * j.h) return null;
    return { w: j.w, h: j.h, name: j.name, pixels: j.pixels };
  } catch {
    return null;
  }
}

export function clearDoc() {
  try { localStorage.removeItem(KEY_DOC); } catch { /* yoksay */ }
}

function savePrefs() {
  try {
    localStorage.setItem(KEY_PREFS, JSON.stringify({
      palette: state.palette,
      activeColor: state.activeColor,
      mirrorX: state.mirrorX,
      mirrorY: state.mirrorY,
      showGrid: state.showGrid,
      colorLimit: state.colorLimit,
    }));
  } catch { /* yoksay */ }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY_PREFS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
