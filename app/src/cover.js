// Vice Cover Studio — the poster renderer.
// Paints a multi-panel GTA-style cover onto a canvas: the photos sit in
// white-guttered panels, a Vice City colour grade washes over them, and the
// code draws its own decor — a slatted sun disc, palm silhouettes, a
// skyline — plus a bold caption block in Pricedown lettering. No outside
// artwork is used anywhere; every picture on the poster is either a photo
// the user supplied or vector art drawn here.

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

// Colour grades: three skies, a translucent wash, a deep shade and an accent.
export const GRADES = {
  sunset: {
    sky: ['#ff9a3d', '#ff5e7a', '#b13a8f'],
    wash: 'rgba(255, 94, 122, 0.28)',
    deep: 'rgba(46, 16, 68, 0.55)',
    accent: '#ffb347',
    label: 'Vice Sunset',
  },
  neon: {
    sky: ['#ff2ea6', '#7b2ff7', '#00e5ff'],
    wash: 'rgba(255, 46, 166, 0.30)',
    deep: 'rgba(10, 8, 48, 0.60)',
    accent: '#00e5ff',
    label: 'Neon Night',
  },
  pastel: {
    sky: ['#ffd9a0', '#ffb3c7', '#a8d8ff'],
    wash: 'rgba(255, 179, 199, 0.22)',
    deep: 'rgba(90, 60, 90, 0.30)',
    accent: '#ff8fb3',
    label: 'Pastel Day',
  },
};

// The four cover layouts the editor offers.
export const LAYOUTS = {
  grid: { label: 'Vice Grid (3×3)' },
  hero: { label: 'Hero + two sides' },
  strip: { label: 'Three-column strip' },
  top: { label: 'Big top + bottom strip' },
};

// Draw one photo into a panel rect, honouring the panel's crop: zoom, fit
// (whole photo, no crop) and drag offsets, all relative to the rect.
function paintPhoto(ctx, img, rect, panel) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  let scale = panel.fit === 'fit'
    ? Math.min(rect.w / iw, rect.h / ih)
    : Math.max(rect.w / iw, rect.h / ih);
  scale *= zoom;
  const pw = iw * scale;
  const ph = ih * scale;
  const cx = rect.x + rect.w / 2 + (panel.ox || 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (panel.oy || 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = '#1a1024';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

// Sunset-poster sun: a gradient disc with horizontal slats cut across its
// lower half.
function paintSun(ctx, cx, cy, r, grade) {
  const g = linear(ctx, cx, cy - r, cx, cy + r, [
    [0, grade.sky[0]],
    [0.55, grade.sky[1]],
    [1, grade.sky[2]],
  ]);
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i++) {
    const y = cy + r * (0.08 + i * 0.2);
    ctx.fillRect(cx - r, y, r * 2, r * 0.055);
  }
  ctx.restore();
}

// A palm silhouette: one curved trunk and seven drooping fronds.
function paintPalm(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(lean);
  ctx.strokeStyle = '#14081f';
  ctx.fillStyle = '#14081f';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -70, 6, -150);
  ctx.stroke();
  ctx.lineWidth = 6;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.15 - (i / 6) * Math.PI * 0.75;
    const len = 88 - Math.abs(i - 3) * 9;
    ctx.beginPath();
    ctx.moveTo(6, -150);
    ctx.quadraticCurveTo(
      6 + Math.cos(a) * len * 0.6, -150 + Math.sin(a) * len * 0.6 - 18,
      6 + Math.cos(a) * len, -150 + Math.sin(a) * len + 26,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// A deterministic skyline: same seed, same buildings, every render.
function paintSkyline(ctx, w, y, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  let x = 0;
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (x < w) {
    const bw = w * (0.03 + rand() * 0.05);
    const bh = h * (0.35 + rand() * 0.65);
    ctx.fillRect(x, y - bh, bw, bh);
    if (rand() > 0.6) ctx.fillRect(x + bw * 0.3, y - bh - h * 0.18, bw * 0.4, h * 0.18);
    x += bw + w * 0.008;
  }
  ctx.restore();
}

// Sparse monochrome grain: one random grey value per 3px block.
function paintGrain(ctx, w, h, amount) {
  const step = 3;
  ctx.save();
  ctx.globalAlpha = amount;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = Math.floor(Math.random() * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}

// A soft dark falloff toward the corners.
function paintVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,4,20,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Panel rectangles as fractions of the photo area (the strip above the
// caption band). The grid is nine equal cells, row by row.
export function panelRects(layout, w, h) {
  const bandH = h * 0.20;
  const areaH = h - bandH;
  if (layout === 'grid') {
    const cellW = w / 3;
    const cellH = areaH / 3;
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      cells.push({ x: col * cellW, y: row * cellH, w: cellW, h: cellH });
    }
    return cells;
  }
  if (layout === 'strip') {
    return [
      { x: 0, y: 0, w: w / 3, h: areaH },
      { x: w / 3, y: 0, w: w / 3, h: areaH },
      { x: (2 * w) / 3, y: 0, w: w / 3, h: areaH },
    ];
  }
  if (layout === 'top') {
    return [
      { x: 0, y: 0, w, h: areaH * 0.68 },
      { x: 0, y: areaH * 0.68, w: w / 2, h: areaH * 0.32 },
      { x: w / 2, y: areaH * 0.68, w: w / 2, h: areaH * 0.32 },
    ];
  }
  // hero: one big panel on the left, two stacked on the right
  return [
    { x: 0, y: 0, w: w * 0.62, h: areaH },
    { x: w * 0.62, y: 0, w: w * 0.38, h: areaH / 2 },
    { x: w * 0.62, y: areaH / 2, w: w * 0.38, h: areaH / 2 },
  ];
}

// The photo rect inside a cell: inset by the white poster gutter. Cells on
// the poster's left edge take a full gutter; the rest share one.
function cellFrame(rect, index, layout, gutter) {
  const atLeftEdge = layout === 'grid' ? index % 3 === 0 : (index === 0 || layout === 'top');
  const frame = {
    x: rect.x + (atLeftEdge ? gutter : gutter / 2),
    y: rect.y + gutter / 2,
    w: rect.w - gutter,
    h: rect.h - gutter,
  };
  if (layout === 'hero' && index === 0) frame.w = rect.w - gutter * 1.5;
  return frame;
}

// Caption lettering in the bottom band: heavy Pricedown (vendored in
// app/fonts/, heavy system stack as fallback), auto-fit to the band width,
// with fill / outline / glow / gradient styles.
export function drawCaption(ctx, state, w, h) {
  const band = h * 0.20;
  const bandY = h - band;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.sub || '').trim();
  // The band itself: a deep gradient with a skyline silhouette on its top edge.
  const bg = linear(ctx, 0, bandY, 0, h, [
    [0, grade.sky[2]],
    [0.5, grade.sky[1]],
    [1, '#160a24'],
  ]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY, w, band);
  paintSkyline(ctx, w, bandY + 2, band * 0.42, 'rgba(20,8,31,0.85)');
  // Thin accent rule along the top of the band.
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandY, w, Math.max(3, h * 0.004));

  if (!text) return;
  const maxW = w * 0.88;
  const displayFont = (s) => `${s}px Pricedown, 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
  let size = band * 0.52;
  ctx.font = displayFont(size);
  while (ctx.measureText(text).width > maxW && size > 14) {
    size -= 2;
    ctx.font = displayFont(size);
  }
  const cy = bandY + band * 0.52 + size * 0.36;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const style = state.lettering || 'gradient';
  ctx.save();
  if (style === 'glow') {
    ctx.shadowColor = grade.sky[0];
    ctx.shadowBlur = size * 0.45;
  } else if (style === 'shadow') {
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.07;
  }
  if (style === 'gradient') {
    ctx.fillStyle = linear(ctx, 0, cy - size, 0, cy + size * 0.15, [
      [0, '#ffffff'],
      [0.55, grade.sky[0]],
      [1, grade.sky[1]],
    ]);
  } else if (style === 'outline') {
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = state.letterColor || '#ffffff';
  }
  // A thick dark outline first: the GTA logo feel, readable over any photo.
  ctx.lineWidth = Math.max(3, size * 0.12);
  ctx.strokeStyle = '#14081f';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, w / 2, cy);
  if (style === 'outline') {
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = grade.sky[1];
    ctx.strokeText(text, w / 2, cy);
  }
  ctx.fillText(text, w / 2, cy);
  ctx.restore();

  if (sub) {
    const subSize = Math.max(12, band * 0.16);
    ctx.font = `700 ${subSize}px 'Arial Narrow', Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    const letters = sub.toUpperCase().split('').join('\u200A');
    ctx.fillText(letters, w / 2, bandY + band * 0.88);
  }
}

// The central VI logo for the grid layout: a big gradient "VI" in
// Pricedown with "grand theft auto" stacked inside it, in the manner of
// the official GTA VI cover. It sits over the middle of the photo area so
// the busy grid stays busy around it.
export function drawVILogo(ctx, w, h, grade) {
  const photoH = h * 0.80;
  const cx = w / 2;
  const cy = photoH * 0.46;
  const size = Math.min(w, photoH) * 0.42;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Drop shadow under the whole logo.
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.04;
  // The big VI: diagonal gradient fill, thick white outline.
  const vg = linear(ctx, cx - size * 0.5, cy - size * 0.5, cx + size * 0.5, cy + size * 0.5, [
    [0, '#7b2ff7'],
    [0.5, '#ff2ea6'],
    [1, '#ff9a3d'],
  ]);
  ctx.font = `${size}px Pricedown, 'Arial Black', sans-serif`;
  ctx.lineWidth = Math.max(4, size * 0.07);
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.fillStyle = vg;
  ctx.strokeText('VI', cx, cy);
  ctx.fillText('VI', cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // "grand theft auto", stacked inside the VI, white with a dark outline.
  const lines = ['grand', 'theft', 'auto'];
  const ls = size * 0.185;
  ctx.font = `${ls}px Pricedown, 'Arial Black', sans-serif`;
  ctx.lineWidth = Math.max(2, ls * 0.14);
  ctx.strokeStyle = '#14081f';
  ctx.fillStyle = '#ffffff';
  const lh = ls * 1.02;
  const y0 = cy - lh;
  lines.forEach((line, i) => {
    const y = y0 + i * lh;
    ctx.strokeText(line, cx, y);
    ctx.fillText(line, cx, y);
  });
  ctx.restore();
}

// The full cover: panels, grade wash, decor, caption band, frame.
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = state.layout || 'hero';
  const photoH = h * 0.8;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, w, h);

  const cells = panelRects(layout, w, h);
  const gutter = Math.max(4, Math.round(w * 0.008));
  cells.forEach((cell, i) => {
    const panel = (state.panels && state.panels[i]) || {};
    const frame = cellFrame(cell, i, layout, gutter);
    paintPhoto(ctx, panel.photo || null, frame, panel);
    if (!panel.photo) {
      // An empty panel gets a sunset-sky placeholder so the poster is
      // never blank, with a small sun of its own.
      const g = linear(ctx, frame.x, frame.y, frame.x, frame.y + frame.h, [
        [0, grade.sky[0]],
        [1, grade.sky[2]],
      ]);
      ctx.fillStyle = g;
      ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
      paintSun(ctx, frame.x + frame.w * 0.5, frame.y + frame.h * 0.38, Math.min(frame.w, frame.h) * 0.22, grade);
    }
  });

  // The grade wash over the photo area only.
  const wash = linear(ctx, 0, 0, 0, photoH, [
    [0, 'rgba(255,255,255,0.05)'],
    [0.7, grade.wash],
    [1, grade.deep],
  ]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, photoH);

  // A sun disc on the horizon at the foot of the photo area, so the sun
  // never covers a face in a panel. Skipped for the grid: the busy panels
  // already fill the photo area, and the VI logo owns the middle.
  if (layout !== 'grid') {
    paintSun(ctx, w * 0.25, photoH - Math.min(w, h) * 0.02, Math.min(w, h) * 0.085, grade);
  }

  // White poster gutters between the panels, then the outer frame.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = gutter;
  cells.forEach((cell) => {
    ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
  });
  const frameW = Math.max(6, Math.round(w * 0.012));
  ctx.lineWidth = frameW;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(frameW / 2, frameW / 2, w - frameW, h - frameW);

  // The central VI logo over the busy grid (the official-cover look).
  if (layout === 'grid') drawVILogo(ctx, w, h, grade);

  drawCaption(ctx, state, w, h);

  // Palm silhouettes flanking the caption band.
  const palmScale = Math.min(w, h) * 0.0011;
  paintPalm(ctx, w * 0.045, h * 0.995, palmScale, -0.18);
  paintPalm(ctx, w * 0.955, h * 0.995, palmScale, 0.18);

  if (state.vignette !== false) paintVignette(ctx, w, h);
  if (state.grain) paintGrain(ctx, w, h, 0.05);
}
