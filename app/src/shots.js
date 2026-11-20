// shots.js — the screenshot mode for Vice Cover Studio.
//
// When the page opens with a ?shot= query, this module reads the requested
// cover (or editor) setup out of the URL so a headless browser can render
// exactly the frame a screenshot needs: caption, subtitle, layout, grade
// and output size. main.js applies the result during boot. With no ?shot=
// in the URL the module does nothing and the editor opens normally.

import { SIZES, LAYOUTS, GRADES } from './cover.js';

function parseSize(text) {
  if (!text) return null;
  const m = /^(\d+)x(\d+)$/.exec(text.trim());
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  const known = SIZES.find((s) => s.width === width && s.height === height);
  if (known) return known;
  return { label: `${width} x ${height}`, width, height };
}

// Read the shot request out of the URL. Returns null for a plain visit.
export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const layout = q.get('layout');
  const grade = q.get('grade');
  return {
    mode: shot,
    caption: q.get('caption') || undefined,
    sub: q.get('sub') || undefined,
    layout: layout && LAYOUTS.includes(layout) ? layout : undefined,
    grade: grade && GRADES.includes(grade) ? grade : undefined,
    size: parseSize(q.get('size')),
  };
}

// Copy a shot request onto the editor state. Only fields the URL names
// change; everything else keeps the editor's defaults.
export function applyShotToState(state, params) {
  if (!params) return state;
  if (params.caption !== undefined) state.caption = params.caption;
  if (params.sub !== undefined) state.sub = params.sub;
  if (params.layout) state.layout = params.layout;
  if (params.grade) state.grade = params.grade;
  if (params.size) state.size = params.size;
  return state;
}
