// Fixed scenes for screenshots: ?shot=cover shows the exported cover alone,
// full viewport; ?shot=editor shows the editor with sample photos loaded.
// Query knobs: photo (boulevard|pier), photo2, caption, sub, layout, grade,
// size (1080x1080|1080x1350|1920x1080), lettering. window.__shotReady is set
// once the scene has painted.
import { drawCover } from './cover.js';

function setActive(group, value) {
  document.querySelectorAll(`[data-${group}]`).forEach((b) => {
    b.classList.toggle('active', b.dataset[group] === value);
  });
}

export async function runShot(shot, query, api) {
  const { state, renderPreview } = api;
  const layout = query.get('layout') || 'hero';
  const grade = query.get('grade') || 'sunset';
  const size = query.get('size') || '1080x1080';
  const caption = query.get('caption') || 'VICE CITY';
  const sub = query.get('sub') || 'Neon nights · Ocean Drive';
  const lettering = query.get('lettering') || 'gradient';

  state.layout = layout;
  state.grade = grade;
  state.size = size;
  state.caption = caption;
  state.sub = sub;
  state.lettering = lettering;
  setActive('layout', layout);
  setActive('grade', grade);
  setActive('size', size);
  document.getElementById('caption').value = caption;
  document.getElementById('subCaption').value = sub;
  document.getElementById('lettering').value = lettering;

  const [w, h] = size.split('x').map(Number);
  const canvas = document.getElementById('cover');
  canvas.width = w;
  canvas.height = h;

  if (layout === 'grid') {
    // Vice Grid: nine distinct panel illustrations, one per cell, in grid order.
    await api.loadGridPanels();
  } else {
    // Load the sample photos, then place them: hero gets the main photo,
    // the side panels get the second photo (or the same one again).
    const main = await api.loadSample(query.get('photo') || 'pier');
    const secondName = query.get('photo2') || (query.get('photo') === 'pier' ? 'boulevard' : 'pier');
    const second = await api.loadSample(secondName);
    state.panels[0].photo = main;
    state.panels[1].photo = second;
    state.panels[2].photo = query.get('same') ? main : second;
  }
  // Crops tuned per layout so faces stay in frame: narrow strip panels and
  // short strip panels need no zoom and a downward nudge to show the top
  // of a square photo; the hero layout can crop tighter.
  const crops = {
    grid: [[1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]],
    strip: [[1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]],
    top: [[1.0, 0, 0.85], [1.0, 0, 1.1], [1.0, 0, 1.1]],
    hero: [[1.05, 0, 0], [1.25, 0, -0.06], [1.15, 0, 0]],
  };
  const crop = crops[layout] || crops.hero;
  crop.forEach(([zoom, ox, oy], i) => {
    state.panels[i].zoom = zoom;
    state.panels[i].ox = ox;
    state.panels[i].oy = oy;
  });

  if (shot === 'cover') document.body.classList.add('shot-cover');
  // Wait for Pricedown (the GTA display font) so the caption and VI logo render in it.
  try { await document.fonts.load('40px Pricedown'); } catch { /* fall back to the system stack */ }
  try { await document.fonts.ready; } catch { /* fall back */ }
  drawCover(canvas, state);
  renderPreview();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
