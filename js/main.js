// Başlangıç: modülleri bağla, son çalışmayı geri yükle, yoksa yeni tasarım sor.

import * as store from './store.js';
import { state } from './store.js';
import * as render from './render.js';
import * as tools from './tools.js';
import * as radial from './radial.js';
import * as colorpanel from './colorpanel.js';
import * as reference from './reference.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import { toast } from './modal.js';

const board = document.getElementById('board');
const stage = document.getElementById('stage');

// Tercihleri (palet, seçili renk, bayraklar) geri yükle
const prefs = storage.loadPrefs();
if (prefs) {
  if (Array.isArray(prefs.palette) && prefs.palette.length) state.palette = prefs.palette;
  if (prefs.activeColor) state.activeColor = prefs.activeColor;
  state.mirrorX = !!prefs.mirrorX;
  state.mirrorY = !!prefs.mirrorY;
  state.showGrid = prefs.showGrid !== false;
  if (prefs.colorLimit) {
    state.colorLimit = prefs.colorLimit;
    document.getElementById('limitInput').value = prefs.colorLimit;
  }
}

render.init(board, stage);
tools.init(board, stage);
radial.init();
colorpanel.init();
reference.init();
storage.init(reference.serialize);
ui.init();

// Son çalışma varsa devam et, yoksa boyut seçtir
const savedRef = storage.loadReference();
if (savedRef) reference.hydrate(savedRef);

const saved = storage.loadDoc();
if (saved) {
  store.loadDoc(saved);
  render.fit();
  toast('Son çalışman geri yüklendi');
} else {
  ui.openNewDialog(true);
}
