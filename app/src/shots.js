// Fixed scenes for the screenshots: ?shot=cover shows the exported cover
// alone, filling the viewport; ?shot=editor shows the editor with sample
// photos loaded. Query knobs: photo (boulevard|pier), photo2, caption,
// sub, layout, grade, size (1080x1080|1080x1350|1920x1080), lettering.
// window.__shotReady is set once the scene has painted.
import { drawCover } from './cover.js';

// Mark the button of one control group (layout, grade or size) as active.
function markGroupActive(group, value) {
  document.querySelectorAll(`[data-${group}]`).forEach((b) => {
    b.classList.toggle('active', b.dataset[group] === value);
  });
}

// Per-layout crops, tuned so faces stay in frame: narrow strip panels and
// short top panels need no zoom and a downward nudge to show the top of a
// square photo; the hero layout can crop tighter.
function cropsFor(layout) {
  if (layout === 'grid') {
    return [[1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]];
  }
  if (layout === 'strip') {
    return [[1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]];
  }
  if (layout === 'top') {
    return [[1.0, 0, 0.85], [1.0, 0, 1.1], [1.0, 0, 1.1]];
  }
  return [[1.05, 0, 0], [1.25, 0, -0.06], [1.15, 0, 0]];
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
  markGroupActive('layout', layout);
  markGroupActive('grade', grade);
  markGroupActive('size', size);
  document.getElementById('caption').value = caption;
  document.getElementById('subCaption').value = sub;
  document.getElementById('lettering').value = lettering;

  const [w, h] = size.split('x').map(Number);
  const canvas = document.getElementById('cover');
  canvas.width = w;
  canvas.height = h;

  if (layout === 'grid') {
    // Vice Grid: nine distinct panel illustrations, one per cell, in order.
    await api.loadGridPanels();
  } else {
    // Load the sample photos, then place them: the hero panel gets the
    // main photo, the side panels get the second photo (or the same one).
    const main = await api.loadSample(query.get('photo') || 'pier');
    const secondName = query.get('photo2') || (query.get('photo') === 'pier' ? 'boulevard' : 'pier');
    const second = await api.loadSample(secondName);
    state.panels[0].photo = main;
    state.panels[1].photo = second;
    state.panels[2].photo = query.get('same') ? main : second;
  }
  cropsFor(layout).forEach(([zoom, ox, oy], i) => {
    state.panels[i].zoom = zoom;
    state.panels[i].ox = ox;
    state.panels[i].oy = oy;
  });

  if (shot === 'cover') document.body.classList.add('shot-cover');
  // Wait for Pricedown (the GTA display font) so the caption and the VI
  // logo render in it, not in the fallback stack.
  try { await document.fonts.load('40px Pricedown'); } catch { /* fall back to the system stack */ }
  try { await document.fonts.ready; } catch { /* fall back */ }
  drawCover(canvas, state);
  renderPreview();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
