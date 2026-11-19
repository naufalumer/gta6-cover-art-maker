// Vice Cover Studio — editor wiring.
// Owns the cover state (photos per panel, layout, caption, lettering, grade,
// export size), renders the live preview through cover.js, and exports PNGs.
// Photos are read with FileReader / object URLs on this machine only.

import { drawCover, panelRects } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');

export const state = {
  layout: 'hero',
  grade: 'sunset',
  lettering: 'gradient',
  letterColor: '#ffffff',
  caption: 'VICE CITY',
  sub: 'Neon nights · Ocean Drive',
  vignette: true,
  grain: false,
  size: '1080x1080',
  panels: [
    { photo: null, zoom: 1, ox: 0, oy: 0, fit: false },
    { photo: null, zoom: 1, ox: 0, oy: 0, fit: false },
    { photo: null, zoom: 1, ox: 0, oy: 0, fit: false },
  ],
};

export const photoLibrary = []; // {name, img}
let activePanel = 0;

export function renderPreview() {
  drawCover(canvas, state);
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function refreshPhotoSelect() {
  const sel = document.getElementById('panelPhoto');
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
      // first photo fills every empty panel; later ones fill the active panel
      if (photoLibrary.length === 1) {
        state.panels.forEach((p) => { p.photo = img; });
      } else if (!state.panels[activePanel].photo) {
        state.panels[activePanel].photo = img;
      }
      refreshPhotoSelect();
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

function syncPanelControls() {
  const p = state.panels[activePanel];
  document.getElementById('zoom').value = Math.round((p.zoom || 1) * 100);
  document.getElementById('zoomVal').textContent = `${Math.round((p.zoom || 1) * 100)}%`;
  document.getElementById('fitToggle').checked = !!p.fit;
  document.querySelectorAll('#panelTabs .panel-tab').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === activePanel);
  });
  refreshPhotoSelect();
}

function bindControls() {
  document.getElementById('photoInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      try { await addPhoto(f, f.name); } catch { setStatus('That file could not be read as a photo.'); }
    }
    if (files.length) setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} loaded. Drag on the preview to position.`);
    e.target.value = '';
  });

  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', async () => {
      await loadSample(b.dataset.sample);
      setStatus(`Sample photo “${b.dataset.sample}” loaded.`);
    });
  });

  document.getElementById('fillAll').addEventListener('click', () => {
    const img = state.panels[activePanel].photo || (photoLibrary[0] && photoLibrary[0].img);
    if (!img) { setStatus('Load a photo first.'); return; }
    state.panels.forEach((p) => { p.photo = img; });
    renderPreview();
    setStatus('One photo now fills all three panels.');
  });

  document.getElementById('layoutRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    state.layout = b.dataset.layout;
    document.querySelectorAll('#layoutRow .layout-btn').forEach((x) => x.classList.toggle('active', x === b));
    renderPreview();
  });

  document.getElementById('panelTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-panel]');
    if (!b) return;
    activePanel = Number(b.dataset.panel);
    syncPanelControls();
  });

  document.getElementById('panelPhoto').addEventListener('change', (e) => {
    const v = e.target.value;
    state.panels[activePanel].photo = v === '' ? null : photoLibrary[Number(v)].img;
    renderPreview();
  });

  document.getElementById('zoom').addEventListener('input', (e) => {
    state.panels[activePanel].zoom = Number(e.target.value) / 100;
    document.getElementById('zoomVal').textContent = `${e.target.value}%`;
    renderPreview();
  });

  document.getElementById('fitToggle').addEventListener('change', (e) => {
    state.panels[activePanel].fit = e.target.checked;
    renderPreview();
  });

  document.getElementById('resetPanel').addEventListener('click', () => {
    const p = state.panels[activePanel];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.fit = false;
    syncPanelControls();
    renderPreview();
    setStatus(`Panel ${activePanel + 1} reset to its default crop.`);
  });

  document.getElementById('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    renderPreview();
  });
  document.getElementById('subCaption').addEventListener('input', (e) => {
    state.sub = e.target.value;
    renderPreview();
  });
  document.getElementById('lettering').addEventListener('change', (e) => {
    state.lettering = e.target.value;
    renderPreview();
  });
  document.getElementById('letterColor').addEventListener('input', (e) => {
    state.letterColor = e.target.value;
    renderPreview();
  });

  document.getElementById('gradeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-grade]');
    if (!b) return;
    state.grade = b.dataset.grade;
    document.querySelectorAll('#gradeRow .grade-btn').forEach((x) => x.classList.toggle('active', x === b));
    renderPreview();
  });

  document.getElementById('vignette').addEventListener('change', (e) => {
    state.vignette = e.target.checked;
    renderPreview();
  });
  document.getElementById('grain').addEventListener('change', (e) => {
    state.grain = e.target.checked;
    renderPreview();
  });

  document.getElementById('sizeRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    state.size = b.dataset.size;
    document.querySelectorAll('#sizeRow .size-btn').forEach((x) => x.classList.toggle('active', x === b));
    const [w, h] = state.size.split('x').map(Number);
    canvas.width = w;
    canvas.height = h;
    renderPreview();
  });

  document.getElementById('export').addEventListener('click', exportCover);
}

// Drag on the preview repositions the photo in the panel under the pointer.
function bindDrag() {
  let drag = null;
  const panelAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const rects = panelRects(state.layout, canvas.width, canvas.height);
    const i = rects.findIndex((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    return i < 0 ? null : { index: i, x, y, rect: rects[i] };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const hit = panelAt(e);
    if (!hit) return;
    activePanel = hit.index;
    syncPanelControls();
    drag = { ...hit, startOx: state.panels[hit.index].ox || 0, startOy: state.panels[hit.index].oy || 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const p = state.panels[drag.index];
    p.ox = drag.startOx + (x - drag.x) / drag.rect.w;
    p.oy = drag.startOy + (y - drag.y) / drag.rect.h;
    renderPreview();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

export function exportCover() {
  const [w, h] = state.size.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
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

bindControls();
bindDrag();
syncPanelControls();
renderPreview();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, { addPhoto, loadSample, state, renderPreview }).catch((err) => {
    console.error(err);
    window.__shotReady = true;
  });
} else {
  window.__shotReady = true;
}
