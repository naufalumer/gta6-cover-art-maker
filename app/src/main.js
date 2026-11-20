// main.js — the editor wiring for Vice Cover Studio.
//
// Owns the app state (nine panel slots, layout, grade, caption, size),
// loads the default panel photos, wires every control to the live preview,
// and exports the finished cover as a PNG. Photos are read on the person's
// own machine with FileReader and never leave it.

import { renderCover, PANEL_NAMES, GRADES, LAYOUTS, SIZES, paletteFor } from './cover.js';
import { readShotParams, applyShotToState } from './shots.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// The photo library: every picture a panel can show. The nine default
// panels first, then the two samples, then anything the person uploads.
const library = [];
let librarySeq = 0;

function addPhoto(label, img) {
  const entry = { id: `photo-${librarySeq++}`, label, img };
  library.push(entry);
  return entry;
}

function photoById(id) {
  return library.find((p) => p.id === id) || null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

// One slot per panel: which library photo it shows, at what zoom, and
// whether the photo is fitted inside the cell or cropped to fill it.
function freshSlots() {
  return PANEL_NAMES.map((name, i) => ({
    photoId: `default-${name}`,
    zoom: 100,
    fit: false,
    index: i,
  }));
}

const state = {
  layout: 'grid',
  grade: 'sunset',
  caption: 'VICE CITY',
  sub: 'Nine panels · One night',
  size: SIZES[0],
  selected: 0,
  slots: freshSlots(),
};

const canvas = $('coverCanvas');
let renderQueued = false;

function currentImages() {
  return state.slots.map((slot) => {
    const photo = photoById(slot.photoId);
    return photo ? photo.img : null;
  });
}

function currentPanels() {
  return state.slots.map((slot) => ({ zoom: slot.zoom, fit: slot.fit }));
}

function draw() {
  renderCover(canvas, {
    images: currentImages(),
    panels: currentPanels(),
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    sub: state.sub,
    size: state.size,
  });
  $('sizeNote').textContent = `${state.size.width} × ${state.size.height} · ${state.slots.filter((s) => photoById(s.photoId)).length}/9 panels filled`;
}

function queueDraw() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    draw();
  });
}

function refreshPanelControls() {
  const slot = state.slots[state.selected];
  const select = $('panelPhoto');
  select.innerHTML = '';
  for (const photo of library) {
    const opt = document.createElement('option');
    opt.value = photo.id;
    opt.textContent = photo.label;
    if (photo.id === slot.photoId) opt.selected = true;
    select.appendChild(opt);
  }
  $('zoom').value = slot.zoom;
  $('zoomVal').textContent = `${slot.zoom}%`;
  $('fitToggle').checked = slot.fit;
  $$('.panel-tab').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.panel) === state.selected);
    const filled = !!photoById(state.slots[Number(btn.dataset.panel)].photoId);
    btn.classList.toggle('empty', !filled);
  });
  $('panelTitle').textContent = `Panel ${state.selected + 1} — ${PANEL_NAMES[state.selected]}`;
}

function selectPanel(i) {
  state.selected = i;
  refreshPanelControls();
  queueDraw();
}

async function loadDefaults() {
  const jobs = PANEL_NAMES.map(async (name) => {
    const img = await loadImage(`./panels/${name}.png`);
    return { name, img };
  });
  const loaded = await Promise.all(jobs);
  for (const { name, img } of loaded) {
    const entry = addPhoto(`Panel · ${name}`, img);
    entry.id = `default-${name}`;
  }
  const samples = [
    ['boulevard', './samples/boulevard.jpg', 'Sample · Boulevard'],
    ['pier', './samples/pier.jpg', 'Sample · Pier'],
  ];
  for (const [key, src, label] of samples) {
    const img = await loadImage(src);
    const entry = addPhoto(label, img);
    entry.id = `sample-${key}`;
  }
}

function wireControls() {
  $('photoInput').addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    let slot = state.selected;
    for (const file of files) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      const entry = addPhoto(`Upload · ${file.name}`, img);
      state.slots[slot].photoId = entry.id;
      slot = (slot + 1) % 9;
    }
    ev.target.value = '';
    refreshPanelControls();
    queueDraw();
  });

  $('sampleBoulevard').addEventListener('click', () => {
    state.slots[state.selected].photoId = 'sample-boulevard';
    refreshPanelControls();
    queueDraw();
  });
  $('samplePier').addEventListener('click', () => {
    state.slots[state.selected].photoId = 'sample-pier';
    refreshPanelControls();
    queueDraw();
  });

  $('loadGrid').addEventListener('click', () => {
    state.slots = freshSlots();
    refreshPanelControls();
    queueDraw();
  });
  $('fillAll').addEventListener('click', () => {
    const photoId = state.slots[state.selected].photoId;
    for (const slot of state.slots) slot.photoId = photoId;
    refreshPanelControls();
    queueDraw();
  });

  $$('.layout-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.layout = btn.dataset.layout;
      $$('.layout-btn').forEach((b) => b.classList.toggle('active', b === btn));
      queueDraw();
    });
  });

  $$('.panel-tab').forEach((btn) => {
    btn.addEventListener('click', () => selectPanel(Number(btn.dataset.panel)));
  });

  $('panelPhoto').addEventListener('change', (ev) => {
    state.slots[state.selected].photoId = ev.target.value;
    refreshPanelControls();
    queueDraw();
  });
  $('zoom').addEventListener('input', (ev) => {
    state.slots[state.selected].zoom = Number(ev.target.value);
    $('zoomVal').textContent = `${ev.target.value}%`;
    queueDraw();
  });
  $('fitToggle').addEventListener('change', (ev) => {
    state.slots[state.selected].fit = ev.target.checked;
    queueDraw();
  });
  $('resetPanel').addEventListener('click', () => {
    const fresh = freshSlots()[state.selected];
    state.slots[state.selected] = fresh;
    refreshPanelControls();
    queueDraw();
  });

  $('caption').addEventListener('input', (ev) => {
    state.caption = ev.target.value;
    queueDraw();
  });
  $('sub').addEventListener('input', (ev) => {
    state.sub = ev.target.value;
    queueDraw();
  });
  $('grade').addEventListener('change', (ev) => {
    state.grade = ev.target.value;
    document.body.dataset.grade = ev.target.value;
    queueDraw();
  });
  $('size').addEventListener('change', (ev) => {
    state.size = SIZES.find((s) => s.label === ev.target.value) || SIZES[0];
    queueDraw();
  });

  $('exportBtn').addEventListener('click', () => {
    const off = document.createElement('canvas');
    renderCover(off, {
      images: currentImages(),
      panels: currentPanels(),
      layout: state.layout,
      grade: state.grade,
      caption: state.caption,
      sub: state.sub,
      size: state.size,
    });
    off.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vice-cover-${state.size.width}x${state.size.height}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      $('exportNote').textContent = `Exported ${state.size.width} × ${state.size.height} PNG — share it.`;
    }, 'image/png');
  });
}

function fillSelects() {
  const grade = $('grade');
  for (const g of GRADES) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g[0].toUpperCase() + g.slice(1);
    grade.appendChild(opt);
  }
  const size = $('size');
  for (const s of SIZES) {
    const opt = document.createElement('option');
    opt.value = s.label;
    opt.textContent = s.label;
    size.appendChild(opt);
  }
  const tabs = $('panelTabs');
  PANEL_NAMES.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `panel-tab${i === 0 ? ' active' : ''}`;
    btn.dataset.panel = String(i);
    btn.textContent = `${i + 1} · ${name}`;
    tabs.appendChild(btn);
  });
  const layouts = $('layoutRow');
  for (const name of LAYOUTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `layout-btn${name === 'grid' ? ' active' : ''}`;
    btn.dataset.layout = name;
    btn.textContent = name[0].toUpperCase() + name.slice(1);
    layouts.appendChild(btn);
  }
}

async function boot() {
  fillSelects();
  wireControls();
  try {
    await loadDefaults();
  } catch (err) {
    $('exportNote').textContent = `Some default panels failed to load: ${err.message}`;
  }
  // A ?shot= visit (screenshots) overrides the editor state from the URL.
  const shot = readShotParams();
  if (shot) {
    applyShotToState(state, shot);
    if (shot.mode === 'cover') document.body.classList.add('shot-cover');
    $('caption').value = state.caption;
    $('sub').value = state.sub;
    $('grade').value = state.grade;
    $('size').value = state.size.label;
    $$('.layout-btn').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  }
  document.body.dataset.grade = state.grade;
  refreshPanelControls();
  draw();
  // The display font arrives after the first paint: redraw once it is in.
  if (document.fonts) {
    document.fonts.load('100px Pricedown').then(draw).catch(() => {});
    document.fonts.ready.then(draw).catch(() => {});
  }
  window.__vice = { state, draw, paletteFor };
  window.__viceReady = true;
}

boot();
