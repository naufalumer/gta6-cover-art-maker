// Vice Cover Studio — the editor.
// Keeps the cover state (one photo per panel, layout, caption, lettering,
// grade, export size), paints the live preview through cover.js, and
// exports PNGs. Photos are read with FileReader and object URLs on this
// machine only; nothing is ever uploaded.

import { renderCover, layoutCells } from './cover.js';
import { stageShot } from './shots.js';

const canvasEl = document.getElementById('cover');
const statusEl = document.getElementById('status');

// One fresh panel: no photo yet, no crop, no offset, cover-fit off.
function blankPanel() {
  return { photo: null, zoom: 1, ox: 0, oy: 0, fit: false };
}

export const studio = {
  layout: 'grid',
  grade: 'sunset',
  lettering: 'gradient',
  letterColor: '#ffffff',
  caption: 'VICE CITY',
  sub: 'Neon nights · Ocean Drive',
  vignette: true,
  grain: false,
  size: '1080x1080',
  panels: Array.from({ length: 9 }, blankPanel),
};

// Every photo the editor knows about: {name, img}, in load order.
export const library = [];
let selectedPanel = 0;

// The nine Vice Grid panels, in grid order (row by row). Each one is a
// distinct GTA-style illustration in app/panels/, generated for this entry.
export const GRID_ART = ['heli', 'couple', 'bike', 'car', 'city', 'gunman', 'gator', 'flamingo', 'boat'];

function el(id) {
  return document.getElementById(id);
}

// Small helper: bind a listener on one element by id.
function on(id, event, fn) {
  el(id).addEventListener(event, fn);
}

// Panel tabs: 9 for the Vice Grid, 3 for the other layouts.
function buildPanelTabs(n) {
  const tabs = el('panelTabs');
  tabs.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.panel = String(i);
    b.className = 'panel-tab' + (i === selectedPanel ? ' active' : '');
    b.textContent = `Panel ${i + 1}`;
    tabs.appendChild(b);
  }
  if (selectedPanel >= n) { selectedPanel = 0; syncPanelControls(); }
}

export function paintPreview() {
  renderCover(canvasEl, studio);
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function syncPhotoMenu() {
  const sel = el('panelPhoto');
  const current = studio.panels[selectedPanel].photo;
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— empty panel —';
  sel.appendChild(none);
  library.forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = entry.name;
    if (entry.img === current) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!current) sel.value = '';
}

export function ingestPhoto(fileOrUrl, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      library.push({ name: name || 'photo', img });
      // The first photo fills every panel; later ones fill the active
      // panel, but only when it is still empty.
      if (library.length === 1) {
        for (const p of studio.panels) p.photo = img;
      } else if (!studio.panels[selectedPanel].photo) {
        studio.panels[selectedPanel].photo = img;
      }
      syncPhotoMenu();
      paintPreview();
      resolve(img);
    };
    img.onerror = () => reject(new Error('could not load photo'));
    if (typeof fileOrUrl === 'string') img.src = fileOrUrl;
    else img.src = URL.createObjectURL(fileOrUrl);
  });
}

export function fetchSample(name) {
  return ingestPhoto(`samples/${name}.jpg`, name);
}

export function fetchPanelArt(name) {
  return ingestPhoto(`panels/${name}.png`, name);
}

// Load all nine Vice Grid panels and place one in each grid cell.
export async function fillGrid() {
  for (let i = 0; i < GRID_ART.length; i++) {
    const name = GRID_ART[i];
    const existing = library.find((e) => e.name === name);
    const img = existing ? existing.img : await fetchPanelArt(name);
    studio.panels[i].photo = img;
    studio.panels[i].zoom = 1;
    studio.panels[i].ox = 0;
    studio.panels[i].oy = 0;
    studio.panels[i].fit = false;
  }
  syncPhotoMenu();
  paintPreview();
}

function syncPanelControls() {
  const p = studio.panels[selectedPanel];
  el('zoom').value = Math.round((p.zoom || 1) * 100);
  el('zoomVal').textContent = `${Math.round((p.zoom || 1) * 100)}%`;
  el('fitToggle').checked = !!p.fit;
  document.querySelectorAll('#panelTabs .panel-tab').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === selectedPanel);
  });
  syncPhotoMenu();
}

function markSelected(rowId, selector, match) {
  document.querySelectorAll(`#${rowId} ${selector}`).forEach((x) => {
    x.classList.toggle('active', match(x));
  });
}

function bindControls() {
  on('photoInput', 'change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      try { await ingestPhoto(f, f.name); } catch { setStatus('That file could not be read as a photo.'); }
    }
    if (files.length) setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded. Drag on the preview to position.`);
    e.target.value = '';
  });

  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', async () => {
      await fetchSample(b.dataset.sample);
      setStatus(`Sample photo “${b.dataset.sample}” loaded.`);
    });
  });

  on('fillAll', 'click', () => {
    const img = studio.panels[selectedPanel].photo || (library[0] && library[0].img);
    if (!img) { setStatus('Load a photo first.'); return; }
    for (const p of studio.panels) p.photo = img;
    paintPreview();
    setStatus('One photo now fills every panel.');
  });

  on('loadGrid', 'click', async () => {
    studio.layout = 'grid';
    markSelected('layoutRow', '.layout-btn', (x) => x.dataset.layout === 'grid');
    buildPanelTabs(9);
    await fillGrid();
    setStatus('Vice Grid loaded — nine distinct panels.');
  });

  el('layoutRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    studio.layout = b.dataset.layout;
    markSelected('layoutRow', '.layout-btn', (x) => x === b);
    buildPanelTabs(studio.layout === 'grid' ? 9 : 3);
    paintPreview();
  });

  el('panelTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-panel]');
    if (!b) return;
    selectedPanel = Number(b.dataset.panel);
    syncPanelControls();
  });

  on('panelPhoto', 'change', (e) => {
    const v = e.target.value;
    studio.panels[selectedPanel].photo = v === '' ? null : library[Number(v)].img;
    paintPreview();
  });

  on('zoom', 'input', (e) => {
    studio.panels[selectedPanel].zoom = Number(e.target.value) / 100;
    el('zoomVal').textContent = `${e.target.value}%`;
    paintPreview();
  });

  on('fitToggle', 'change', (e) => {
    studio.panels[selectedPanel].fit = e.target.checked;
    paintPreview();
  });

  on('resetPanel', 'click', () => {
    const p = studio.panels[selectedPanel];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.fit = false;
    syncPanelControls();
    paintPreview();
    setStatus(`Panel ${selectedPanel + 1} reset to its default crop.`);
  });

  on('caption', 'input', (e) => {
    studio.caption = e.target.value;
    paintPreview();
  });
  on('subCaption', 'input', (e) => {
    studio.sub = e.target.value;
    paintPreview();
  });
  on('lettering', 'change', (e) => {
    studio.lettering = e.target.value;
    paintPreview();
  });
  on('letterColor', 'input', (e) => {
    studio.letterColor = e.target.value;
    paintPreview();
  });

  el('gradeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-grade]');
    if (!b) return;
    studio.grade = b.dataset.grade;
    markSelected('gradeRow', '.grade-btn', (x) => x === b);
    paintPreview();
  });

  on('vignette', 'change', (e) => {
    studio.vignette = e.target.checked;
    paintPreview();
  });
  on('grain', 'change', (e) => {
    studio.grain = e.target.checked;
    paintPreview();
  });

  el('sizeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    studio.size = b.dataset.size;
    markSelected('sizeRow', '.size-btn', (x) => x === b);
    const [w, h] = studio.size.split('x').map(Number);
    canvasEl.width = w;
    canvasEl.height = h;
    paintPreview();
  });

  on('export', 'click', downloadCover);
}

// Dragging on the preview repositions the photo in the panel under the
// pointer, and selects that panel.
function bindDrag() {
  let drag = null;
  const panelAt = (e) => {
    const r = canvasEl.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvasEl.width / r.width);
    const y = (e.clientY - r.top) * (canvasEl.height / r.height);
    const rects = layoutCells(studio.layout, canvasEl.width, canvasEl.height);
    const i = rects.findIndex((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    return i < 0 ? null : { index: i, x, y, rect: rects[i] };
  };
  canvasEl.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e);
    if (!hit) return;
    selectedPanel = hit.index;
    syncPanelControls();
    drag = { ...hit, startOx: studio.panels[hit.index].ox || 0, startOy: studio.panels[hit.index].oy || 0 };
    canvasEl.setPointerCapture(e.pointerId);
  });
  canvasEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvasEl.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvasEl.width / r.width);
    const y = (e.clientY - r.top) * (canvasEl.height / r.height);
    const p = studio.panels[drag.index];
    p.ox = drag.startOx + (x - drag.x) / drag.rect.w;
    p.oy = drag.startOy + (y - drag.y) / drag.rect.h;
    paintPreview();
  });
  const end = () => { drag = null; };
  canvasEl.addEventListener('pointerup', end);
  canvasEl.addEventListener('pointercancel', end);
}

export function downloadCover() {
  const [w, h] = studio.size.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off, studio);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      if (!blob) { setStatus('Export failed — try again.'); resolve(null); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-cover-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStatus(`Exported ${w} × ${h} PNG.`);
      resolve(blob);
    }, 'image/png');
  });
}

buildPanelTabs(studio.layout === 'grid' ? 9 : 3);
bindControls();
bindDrag();
syncPanelControls();
paintPreview();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot, params, { ingestPhoto, fetchSample, fetchPanelArt, fillGrid, studio, paintPreview }).catch((err) => {
    console.error(err);
    window.__shotReady = true;
  });
} else {
  window.__shotReady = true;
}
