// Vice Cover Studio — the editor.
// Holds the cover state (one photo per panel, layout, caption, lettering,
// grade, export size), paints the live preview through cover.js, and
// exports PNGs. Photos are read with FileReader and object URLs on this
// machine only; nothing is ever uploaded.

import { drawCover, panelRects } from './cover.js';
import { runShot } from './shots.js';

const preview = document.getElementById('cover');
const statusLine = document.getElementById('status');

// One fresh panel: no photo yet, no crop, no offset, cover-fit off.
function freshPanel() {
  return { photo: null, zoom: 1, ox: 0, oy: 0, fit: false };
}

export const state = {
  layout: 'grid',
  grade: 'sunset',
  lettering: 'gradient',
  letterColor: '#ffffff',
  caption: 'VICE CITY',
  sub: 'Neon nights · Ocean Drive',
  vignette: true,
  grain: false,
  size: '1080x1080',
  panels: Array.from({ length: 9 }, freshPanel),
};

// Every photo the editor knows about: {name, img}, in load order.
export const photoLibrary = [];
let activePanel = 0;

// The nine Vice Grid panels, in grid order (row by row). Each one is a
// distinct GTA-style illustration in app/panels/, generated for this entry.
export const GRID_PANELS = ['heli', 'couple', 'bike', 'car', 'city', 'gunman', 'gator', 'flamingo', 'boat'];

function byId(id) {
  return document.getElementById(id);
}

// Panel tabs: 9 for the Vice Grid, 3 for the other layouts.
function makePanelTabs(n) {
  const tabs = byId('panelTabs');
  tabs.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.panel = String(i);
    b.className = 'panel-tab' + (i === activePanel ? ' active' : '');
    b.textContent = `Panel ${i + 1}`;
    tabs.appendChild(b);
  }
  if (activePanel >= n) { activePanel = 0; syncPanelInputs(); }
}

export function renderPreview() {
  drawCover(preview, state);
}

function showStatus(msg) {
  statusLine.textContent = msg;
}

function refreshPhotoMenu() {
  const sel = byId('panelPhoto');
  const current = state.panels[activePanel].photo;
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— empty panel —';
  sel.appendChild(none);
  photoLibrary.forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = entry.name;
    if (entry.img === current) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!current) sel.value = '';
}

export function addPhoto(fileOrUrl, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      photoLibrary.push({ name: name || 'photo', img });
      // The first photo fills every panel; later ones fill the active
      // panel, but only when it is still empty.
      if (photoLibrary.length === 1) {
        state.panels.forEach((p) => { p.photo = img; });
      } else if (!state.panels[activePanel].photo) {
        state.panels[activePanel].photo = img;
      }
      refreshPhotoMenu();
      renderPreview();
      resolve(img);
    };
    img.onerror = () => reject(new Error('could not load photo'));
    if (typeof fileOrUrl === 'string') img.src = fileOrUrl;
    else img.src = URL.createObjectURL(fileOrUrl);
  });
}

export function loadSample(name) {
  return addPhoto(`samples/${name}.jpg`, name);
}

export function loadPanel(name) {
  return addPhoto(`panels/${name}.png`, name);
}

// Load all nine Vice Grid panels and place one in each grid cell.
export async function loadGridPanels() {
  for (let i = 0; i < GRID_PANELS.length; i++) {
    const name = GRID_PANELS[i];
    const existing = photoLibrary.find((e) => e.name === name);
    const img = existing ? existing.img : await loadPanel(name);
    state.panels[i].photo = img;
    state.panels[i].zoom = 1;
    state.panels[i].ox = 0;
    state.panels[i].oy = 0;
    state.panels[i].fit = false;
  }
  refreshPhotoMenu();
  renderPreview();
}

function syncPanelInputs() {
  const p = state.panels[activePanel];
  byId('zoom').value = Math.round((p.zoom || 1) * 100);
  byId('zoomVal').textContent = `${Math.round((p.zoom || 1) * 100)}%`;
  byId('fitToggle').checked = !!p.fit;
  document.querySelectorAll('#panelTabs .panel-tab').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === activePanel);
  });
  refreshPhotoMenu();
}

function markActiveIn(rowId, selector, match) {
  document.querySelectorAll(`#${rowId} ${selector}`).forEach((x) => {
    x.classList.toggle('active', match(x));
  });
}

function wireControls() {
  byId('photoInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      try { await addPhoto(f, f.name); } catch { showStatus('That file could not be read as a photo.'); }
    }
    if (files.length) showStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded. Drag on the preview to position.`);
    e.target.value = '';
  });

  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', async () => {
      await loadSample(b.dataset.sample);
      showStatus(`Sample photo “${b.dataset.sample}” loaded.`);
    });
  });

  byId('fillAll').addEventListener('click', () => {
    const img = state.panels[activePanel].photo || (photoLibrary[0] && photoLibrary[0].img);
    if (!img) { showStatus('Load a photo first.'); return; }
    state.panels.forEach((p) => { p.photo = img; });
    renderPreview();
    showStatus('One photo now fills every panel.');
  });

  byId('loadGrid').addEventListener('click', async () => {
    state.layout = 'grid';
    markActiveIn('layoutRow', '.layout-btn', (x) => x.dataset.layout === 'grid');
    makePanelTabs(9);
    await loadGridPanels();
    showStatus('Vice Grid loaded — nine distinct panels.');
  });

  byId('layoutRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    state.layout = b.dataset.layout;
    markActiveIn('layoutRow', '.layout-btn', (x) => x === b);
    makePanelTabs(state.layout === 'grid' ? 9 : 3);
    renderPreview();
  });

  byId('panelTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-panel]');
    if (!b) return;
    activePanel = Number(b.dataset.panel);
    syncPanelInputs();
  });

  byId('panelPhoto').addEventListener('change', (e) => {
    const v = e.target.value;
    state.panels[activePanel].photo = v === '' ? null : photoLibrary[Number(v)].img;
    renderPreview();
  });

  byId('zoom').addEventListener('input', (e) => {
    state.panels[activePanel].zoom = Number(e.target.value) / 100;
    byId('zoomVal').textContent = `${e.target.value}%`;
    renderPreview();
  });

  byId('fitToggle').addEventListener('change', (e) => {
    state.panels[activePanel].fit = e.target.checked;
    renderPreview();
  });

  byId('resetPanel').addEventListener('click', () => {
    const p = state.panels[activePanel];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.fit = false;
    syncPanelInputs();
    renderPreview();
    showStatus(`Panel ${activePanel + 1} reset to its default crop.`);
  });

  byId('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    renderPreview();
  });
  byId('subCaption').addEventListener('input', (e) => {
    state.sub = e.target.value;
    renderPreview();
  });
  byId('lettering').addEventListener('change', (e) => {
    state.lettering = e.target.value;
    renderPreview();
  });
  byId('letterColor').addEventListener('input', (e) => {
    state.letterColor = e.target.value;
    renderPreview();
  });

  byId('gradeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-grade]');
    if (!b) return;
    state.grade = b.dataset.grade;
    markActiveIn('gradeRow', '.grade-btn', (x) => x === b);
    renderPreview();
  });

  byId('vignette').addEventListener('change', (e) => {
    state.vignette = e.target.checked;
    renderPreview();
  });
  byId('grain').addEventListener('change', (e) => {
    state.grain = e.target.checked;
    renderPreview();
  });

  byId('sizeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    state.size = b.dataset.size;
    markActiveIn('sizeRow', '.size-btn', (x) => x === b);
    const [w, h] = state.size.split('x').map(Number);
    preview.width = w;
    preview.height = h;
    renderPreview();
  });

  byId('export').addEventListener('click', exportCover);
}

// Dragging on the preview repositions the photo in the panel under the
// pointer, and selects that panel.
function wireDrag() {
  let drag = null;
  const panelAt = (e) => {
    const r = preview.getBoundingClientRect();
    const x = (e.clientX - r.left) * (preview.width / r.width);
    const y = (e.clientY - r.top) * (preview.height / r.height);
    const rects = panelRects(state.layout, preview.width, preview.height);
    const i = rects.findIndex((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    return i < 0 ? null : { index: i, x, y, rect: rects[i] };
  };
  preview.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e);
    if (!hit) return;
    activePanel = hit.index;
    syncPanelInputs();
    drag = { ...hit, startOx: state.panels[hit.index].ox || 0, startOy: state.panels[hit.index].oy || 0 };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = preview.getBoundingClientRect();
    const x = (e.clientX - r.left) * (preview.width / r.width);
    const y = (e.clientY - r.top) * (preview.height / r.height);
    const p = state.panels[drag.index];
    p.ox = drag.startOx + (x - drag.x) / drag.rect.w;
    p.oy = drag.startOy + (y - drag.y) / drag.rect.h;
    renderPreview();
  });
  const end = () => { drag = null; };
  preview.addEventListener('pointerup', end);
  preview.addEventListener('pointercancel', end);
}

export function exportCover() {
  const [w, h] = state.size.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      if (!blob) { showStatus('Export failed — try again.'); resolve(null); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-cover-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      showStatus(`Exported ${w} × ${h} PNG.`);
      resolve(blob);
    }, 'image/png');
  });
}

makePanelTabs(state.layout === 'grid' ? 9 : 3);
wireControls();
wireDrag();
syncPanelInputs();
renderPreview();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, { addPhoto, loadSample, loadPanel, loadGridPanels, state, renderPreview }).catch((err) => {
    console.error(err);
    window.__shotReady = true;
  });
} else {
  window.__shotReady = true;
}
