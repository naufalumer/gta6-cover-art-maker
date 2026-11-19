// Fixed scenes for the screenshots: ?shot=cover shows the exported cover
// alone, filling the viewport; ?shot=editor shows the editor with sample
// photos loaded. Query knobs: photo (boulevard|pier), photo2, caption,
// sub, layout, grade, size (1080x1080|1080x1350|1920x1080), lettering.
// window.__shotReady is set once the scene has painted.
import { renderCover } from './cover.js';

// Mark the button of one control group (layout, grade or size) as active.
function highlightGroup(group, value) {
  document.querySelectorAll(`[data-${group}]`).forEach((b) => {
    b.classList.toggle('active', b.dataset[group] === value);
  });
}

// Per-layout crops, tuned so faces stay in frame: narrow strip panels and
// short top panels need no zoom and a downward nudge to show the top of a
// square photo; the hero layout can crop tighter.
const CROP_TABLE = {
  grid: Array.from({ length: 9 }, () => [1.0, 0, 0]),
  strip: [[1.0, 0, 0], [1.0, 0, 0], [1.0, 0, 0]],
  top: [[1.0, 0, 0.85], [1.0, 0, 1.1], [1.0, 0, 1.1]],
  hero: [[1.05, 0, 0], [1.25, 0, -0.06], [1.15, 0, 0]],
};

function cropsFor(layout) {
  return CROP_TABLE[layout] || CROP_TABLE.hero;
}

export async function stageShot(shot, query, api) {
  const { studio, paintPreview } = api;
  const layout = query.get('layout') || 'hero';
  const grade = query.get('grade') || 'sunset';
  const size = query.get('size') || '1080x1080';
  const caption = query.get('caption') || 'VICE CITY';
  const sub = query.get('sub') || 'Neon nights · Ocean Drive';
  const lettering = query.get('lettering') || 'gradient';

  studio.layout = layout;
  studio.grade = grade;
  studio.size = size;
  studio.caption = caption;
  studio.sub = sub;
  studio.lettering = lettering;
  highlightGroup('layout', layout);
  highlightGroup('grade', grade);
  highlightGroup('size', size);
  document.getElementById('caption').value = caption;
  document.getElementById('subCaption').value = sub;
  document.getElementById('lettering').value = lettering;

  const [w, h] = size.split('x').map(Number);
  const canvas = document.getElementById('cover');
  canvas.width = w;
  canvas.height = h;

  if (layout === 'grid') {
    // Vice Grid: nine distinct panel illustrations, one per cell, in order.
    await api.fillGrid();
  } else {
    // Load the sample photos, then place them: the hero panel gets the
    // main photo, the side panels get the second photo (or the same one).
    const main = await api.fetchSample(query.get('photo') || 'pier');
    const secondName = query.get('photo2') || (query.get('photo') === 'pier' ? 'boulevard' : 'pier');
    const second = await api.fetchSample(secondName);
    studio.panels[0].photo = main;
    studio.panels[1].photo = second;
    studio.panels[2].photo = query.get('same') ? main : second;
  }
  for (let i = 0; i < cropsFor(layout).length; i++) {
    const [zoom, ox, oy] = cropsFor(layout)[i];
    studio.panels[i].zoom = zoom;
    studio.panels[i].ox = ox;
    studio.panels[i].oy = oy;
  }

  if (shot === 'cover') document.body.classList.add('shot-cover');
  // Wait for Pricedown (the GTA display font) so the caption and the VI
  // logo render in it, not in the fallback stack.
  try { await document.fonts.load('40px Pricedown'); } catch { /* fall back to the system stack */ }
  try { await document.fonts.ready; } catch { /* fall back */ }
  renderCover(canvas, studio);
  paintPreview();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
