// Üst bar, araç çubuğu, durum çubuğu, kısayollar ve dosya işlemleri.

import * as store from './store.js';
import { state, SIZES } from './store.js';
import * as render from './render.js';
import * as tools from './tools.js';
import * as storage from './storage.js';
import { openImport } from './importer.js';
import { hydrate as hydrateReference, serialize as serializeReference } from './reference.js';
import { openModal, closeModal, isModalOpen, toast } from './modal.js';
import { toSVG, toPNGBlob, toProject, parseProject, download, downloadText, GAP } from './exporters.js';

const EXPORT_SCALE = 32;   // dışa aktarımda 1 piksel = 32 px

export function init() {
  wireToolbar();
  wireTopbar();
  wireStatusbar();
  wireShortcuts();
  wireDropzone();
  syncToolbar();
  syncStatus();

  store.on('tool', syncToolbar);
  store.on('flags', syncToolbar);
  store.on('history', syncStatus);
  store.on('doc', syncStatus);
  store.on('zoom', syncStatus);
  store.on('coords', (p) => {
    const inside = p.x >= 0 && p.y >= 0 && p.x < state.doc.w && p.y < state.doc.h;
    document.getElementById('coords').textContent = inside ? `${p.x}, ${p.y}` : '–, –';
  });

  const hint = document.getElementById('stageHint');
  setTimeout(() => hint.classList.add('gone'), 7000);
  document.getElementById('board').addEventListener('contextmenu', () => hint.classList.add('gone'));
}

/* ---------- Araç çubuğu ---------- */

function wireToolbar() {
  document.querySelectorAll('.tool[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => store.setTool(btn.dataset.tool));
  });
  document.getElementById('tglMirrorX').addEventListener('click', () => store.toggle('mirrorX'));
  document.getElementById('tglMirrorY').addEventListener('click', () => store.toggle('mirrorY'));
  document.getElementById('tglGrid').addEventListener('click', () => store.toggle('showGrid'));
  document.getElementById('btnClear').addEventListener('click', clearCanvas);
}

function clearCanvas() {
  if (!state.doc.pixels.some(Boolean)) { toast('Tuval zaten boş'); return; }
  store.clearDoc();
  toast('Tuval temizlendi — Ctrl+Z ile geri alabilirsin');
}

function syncToolbar() {
  document.querySelectorAll('.tool[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === state.tool);
  });
  document.getElementById('tglMirrorX').classList.toggle('active', state.mirrorX);
  document.getElementById('tglMirrorY').classList.toggle('active', state.mirrorY);
  document.getElementById('tglGrid').classList.toggle('active', state.showGrid);
}

/* ---------- Üst bar ---------- */

function wireTopbar() {
  document.getElementById('btnNew').addEventListener('click', () => openNewDialog());

  const fileProject = document.getElementById('fileProject');
  document.getElementById('btnOpen').addEventListener('click', () => fileProject.click());
  fileProject.addEventListener('change', () => {
    const f = fileProject.files[0];
    if (f) readProject(f);
    fileProject.value = '';
  });

  document.getElementById('btnSave').addEventListener('click', saveProject);

  const fileImage = document.getElementById('fileImage');
  document.getElementById('btnImport').addEventListener('click', () => fileImage.click());
  fileImage.addEventListener('change', () => {
    const f = fileImage.files[0];
    if (f) openImport(f);
    fileImage.value = '';
  });

  document.getElementById('btnExportSvg').addEventListener('click', () => exportSVG(0));
  document.getElementById('btnExportPng').addEventListener('click', () => exportPNG(0));
  document.getElementById('btnExportSvgGap').addEventListener('click', () => exportSVG(GAP));
  document.getElementById('btnExportPngGap').addEventListener('click', () => exportPNG(GAP));
}

function syncStatus() {
  document.getElementById('btnUndo').disabled = !store.canUndo();
  document.getElementById('btnRedo').disabled = !store.canRedo();
  if (state.doc) document.getElementById('docSize').textContent = `${state.doc.w} × ${state.doc.h}`;
  document.getElementById('zoomLabel').textContent = `${render.view.scale}×`;
}

/* ---------- Durum çubuğu ---------- */

function wireStatusbar() {
  document.getElementById('btnUndo').addEventListener('click', store.undo);
  document.getElementById('btnRedo').addEventListener('click', store.redo);
  document.getElementById('btnZoomIn').addEventListener('click', () => render.zoomStep(1));
  document.getElementById('btnZoomOut').addEventListener('click', () => render.zoomStep(-1));
  document.getElementById('btnZoomFit').addEventListener('click', render.fit);
}

/* ---------- Yeni tasarım ---------- */

export function openNewDialog(force = false) {
  const dirty = !force && state.doc && state.doc.pixels.some(Boolean);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3>Yeni tasarım</h3>
    <p class="sub">Boyama sayfası için tuval boyutunu seç.</p>
    ${dirty ? '<p class="warn" style="margin:0 0 16px">Açık olan çalışman kapanacak. Saklamak istiyorsan önce <b>Kaydet</b> de.</p>' : ''}
    <div class="size-grid">
      ${SIZES.map((s, i) => `
        <button class="size-card${i === 1 ? ' sel' : ''}" data-size="${s}">
          <span class="grid-mini" style="background-image:
            linear-gradient(to right, #E4D2C0 1px, transparent 1px),
            linear-gradient(to bottom, #E4D2C0 1px, transparent 1px);
            background-size: ${(46 / s).toFixed(2)}px ${(46 / s).toFixed(2)}px;"></span>
          <span class="label">${s} × ${s}</span>
        </button>`).join('')}
    </div>
    <label class="field" style="margin-bottom:16px">
      <span style="white-space:nowrap">DOSYA ADI</span>
      <input type="text" id="newName" value="pixel-16x16" data-autofocus>
    </label>
    <div class="modal-actions">
      ${force ? '' : '<button class="btn" id="newCancel">Vazgeç</button>'}
      <button class="btn btn-primary" id="newOk">Oluştur</button>
    </div>
  `;

  openModal(wrap, { dismissible: !force });

  let size = SIZES[1];
  const $name = wrap.querySelector('#newName');

  wrap.querySelectorAll('.size-card').forEach((card) => {
    card.addEventListener('click', () => {
      wrap.querySelectorAll('.size-card').forEach((c) => c.classList.remove('sel'));
      card.classList.add('sel');
      const prev = `pixel-${size}x${size}`;
      size = parseInt(card.dataset.size, 10);
      if ($name.value === prev || !$name.value) $name.value = `pixel-${size}x${size}`;
    });
  });

  const cancel = wrap.querySelector('#newCancel');
  if (cancel) cancel.addEventListener('click', closeModal);

  wrap.querySelector('#newOk').addEventListener('click', () => {
    store.newDoc(size, size, $name.value.trim() || `pixel-${size}x${size}`);
    storage.clearDoc();
    closeModal();
  });
}

/* ---------- Dosya ---------- */

/**
 * İndirme öncesi dosya adı sorar. Onaylanan ad belgeye de yazılır, böylece
 * bir sonraki indirmede kutu son kullanılan adla açılır.
 * İptal edilirse null döner ve indirme yapılmaz.
 */
function askFilename(title, ext, current) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      closeModal();
      resolve(value);
    };

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <h3>${title}</h3>
      <p class="sub">Dosya adını yazıp indir.</p>
      <div class="name-row">
        <input type="text" id="dlName" spellcheck="false" data-autofocus>
        <span class="name-ext">.${ext}</span>
      </div>
      <div class="modal-actions">
        <button class="btn" id="dlCancel">Vazgeç</button>
        <button class="btn btn-primary" id="dlOk">İndir</button>
      </div>
    `;

    const $name = wrap.querySelector('#dlName');
    $name.value = current;

    openModal(wrap, { onClose: () => finish(null) });
    $name.select();

    const ok = () => finish(cleanFilename($name.value, ext));
    wrap.querySelector('#dlOk').addEventListener('click', ok);
    wrap.querySelector('#dlCancel').addEventListener('click', () => finish(null));
    $name.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  });
}

/** Dosya adında kullanılamayan karakterleri temizler, fazladan uzantıyı atar. */
function cleanFilename(value, ext) {
  const name = (value || '')
    .trim()
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(new RegExp(`\\.${ext}$`, 'i'), '')
    .trim();
  return name || state.doc.name;
}

async function saveProject() {
  const name = await askFilename('Proje dosyası kaydet', 'json', state.doc.name);
  if (!name) return;
  state.doc.name = name;
  downloadText(`${name}.json`, toProject(state.doc, state.palette, serializeReference()), 'application/json');
  toast('Proje dosyası indirildi');
}

function readProject(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const { doc, palette, reference } = parseProject(fr.result);
      store.loadDoc(doc);
      if (palette && palette.length) { state.palette = palette; store.emit('palette'); }
      if (reference) hydrateReference(reference);
      else store.clearReference();
      toast(`${doc.name} açıldı`);
    } catch (err) {
      toast(err.message || 'Dosya okunamadı', true);
    }
  };
  fr.readAsText(file);
}

async function exportSVG(gap = 0) {
  const label = gap ? `Aralıklı SVG indir (${gap}px boşluk)` : 'SVG indir';
  const name = await askFilename(label, 'svg', state.doc.name);
  if (!name) return;
  state.doc.name = name;
  downloadText(`${name}.svg`, toSVG(state.doc, { scale: EXPORT_SCALE, gap }), 'image/svg+xml');
  toast(gap ? `Aralıklı SVG indirildi (${gap}px boşluk)` : 'SVG indirildi — her piksel ayrı bir kare');
}

async function exportPNG(gap = 0) {
  const label = gap ? `Aralıklı PNG indir (${gap}px boşluk)` : 'PNG indir';
  const name = await askFilename(label, 'png', state.doc.name);
  if (!name) return;
  state.doc.name = name;
  const blob = await toPNGBlob(state.doc, EXPORT_SCALE, gap);
  download(`${name}.png`, blob);
  const px = state.doc.w * (EXPORT_SCALE + gap) + gap;
  toast(`PNG indirildi (${px}px)`);
}

/* ---------- Görsel sürükle-bırak ---------- */

function wireDropzone() {
  const stage = document.getElementById('stage');
  const zone = document.getElementById('dropzone');
  let depth = 0;

  const hasFile = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    depth++;
    zone.classList.add('on');
  });
  window.addEventListener('dragover', (e) => { if (hasFile(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) zone.classList.remove('on');
  });
  window.addEventListener('drop', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    depth = 0;
    zone.classList.remove('on');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.name.toLowerCase().endsWith('.json')) readProject(f);
    else openImport(f);
  });
}

/* ---------- Kısayollar ---------- */

const TOOL_KEYS = {
  b: 'pencil', e: 'eraser', g: 'bucket', i: 'eyedropper',
  l: 'line', r: 'rect', o: 'ellipse', m: 'select', h: 'hand', k: 'reference',
};

function wireShortcuts() {
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;

    // Modal açıkken kısayollar üst üste modal açmasın
    if (isModalOpen()) return;

    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? store.redo() : store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
    if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); openNewDialog(); return; }
    if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); store.toggle('showGrid'); return; }
    if (mod) return;

    if (isModalOpen()) return;

    if (e.shiftKey && e.key.toLowerCase() === 'h') { store.toggle('mirrorX'); return; }
    if (e.shiftKey && e.key.toLowerCase() === 'v') { store.toggle('mirrorY'); return; }

    const key = e.key.toLowerCase();
    if (TOOL_KEYS[key]) { store.setTool(TOOL_KEYS[key]); return; }

    if (key === '0') { render.fit(); return; }
    if (key === '+' || key === '=') { render.zoomStep(1); return; }
    if (key === '-') { render.zoomStep(-1); return; }

    if (e.shiftKey && (key === 'delete' || key === 'backspace')) { e.preventDefault(); clearCanvas(); return; }
    if (key === 'delete' || key === 'backspace') { e.preventDefault(); tools.deleteSelection(); return; }
    if (key === 'enter') { tools.fillSelection(); return; }
    if (key === 'escape') { store.setSelection(null); return; }
  });
}
