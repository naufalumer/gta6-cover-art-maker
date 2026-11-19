// Vice Cover Studio — cover renderer.
// Draws the multi-panel GTA-style poster onto a canvas: photo panels with
// white poster gutters, a colour grade, original vector decor (sun disc,
// palm silhouettes, skyline) and a bold caption block.
// All decor is drawn in code; no outside artwork is used.

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#ff9a3d', '#ff5e7a', '#b13a8f'],
    wash: 'rgba(255, 94, 122, 0.28)',
    deep: 'rgba(46, 16, 68, 0.55)',
    accent: '#ffb347',
  },
  neon: {
    label: 'Neon Night',
    sky: ['#ff2ea6', '#7b2ff7', '#00e5ff'],
    wash: 'rgba(255, 46, 166, 0.30)',
    deep: 'rgba(10, 8, 48, 0.60)',
    accent: '#00e5ff',
  },
  pastel: {
    label: 'Pastel Day',
    sky: ['#ffd9a0', '#ffb3c7', '#a8d8ff'],
    wash: 'rgba(255, 179, 199, 0.22)',
    deep: 'rgba(90, 60, 90, 0.30)',
    accent: '#ff8fb3',
  },
};

export const LAYOUTS = {
  hero: { label: 'Hero + two sides' },
  strip: { label: 'Three-column strip' },
  top: { label: 'Big top + bottom strip' },
};

// Panel rectangles as fractions of the photo area (above the caption band).
export function panelRects(layout, w, h) {
  const band = h * 0.20; // caption band height
  const top = 0;
  const ph = h - band;
  if (layout === 'strip') {
    return [
      { x: 0, y: top, w: w / 3, h: ph },
      { x: w / 3, y: top, w: w / 3, h: ph },
      { x: (2 * w) / 3, y: top, w: w / 3, h: ph },
    ];
  }
  if (layout === 'top') {
    return [
      { x: 0, y: top, w, h: ph * 0.68 },
      { x: 0, y: top + ph * 0.68, w: w / 2, h: ph * 0.32 },
      { x: w / 2, y: top + ph * 0.68, w: w / 2, h: ph * 0.32 },
    ];
  }
  // hero: big left panel, two stacked on the right
  return [
    { x: 0, y: top, w: w * 0.62, h: ph },
    { x: w * 0.62, y: top, w: w * 0.38, h: ph / 2 },
    { x: w * 0.62, y: top + ph / 2, w: w * 0.38, h: ph / 2 },
  ];
}

function drawPhotoCover(ctx, img, rect, panel) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  const fit = panel.fit === 'fit';
  let scale = fit
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

function drawSunDisc(ctx, cx, cy, r, grade) {
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, grade.sky[0]);
  g.addColorStop(0.55, grade.sky[1]);
  g.addColorStop(1, grade.sky[2]);
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // horizontal slats cut across the lower half, sunset-poster style
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i++) {
    const y = cy + r * (0.08 + i * 0.2);
    ctx.fillRect(cx - r, y, r * 2, r * 0.055);
  }
  ctx.restore();
}

function drawPalm(ctx, x, y, s, lean) {
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
  // fronds
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

function drawSkyline(ctx, w, y, h, color) {
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

function drawGrain(ctx, w, h, amount) {
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

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,4,20,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Caption lettering: auto-fit heavy system font, with fill / outline / glow / gradient styles.
export function drawCaption(ctx, state, w, h) {
  const band = h * 0.20;
  const bandY = h - band;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.sub || '').trim();
  // caption band: deep gradient + skyline silhouette along its top edge
  const bg = ctx.createLinearGradient(0, bandY, 0, h);
  bg.addColorStop(0, grade.sky[2]);
  bg.addColorStop(0.5, grade.sky[1]);
  bg.addColorStop(1, '#160a24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY, w, band);
  drawSkyline(ctx, w, bandY + 2, band * 0.42, 'rgba(20,8,31,0.85)');
  // thin accent rule
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandY, w, Math.max(3, h * 0.004));

  if (!text) return;
  const maxW = w * 0.88;
  let size = band * 0.52;
  const font = (s) => `900 ${s}px 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxW && size > 14) {
    size -= 2;
    ctx.font = font(size);
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
    const tg = ctx.createLinearGradient(0, cy - size, 0, cy + size * 0.15);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.55, grade.sky[0]);
    tg.addColorStop(1, grade.sky[1]);
    ctx.fillStyle = tg;
  } else if (style === 'outline') {
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = state.letterColor || '#ffffff';
  }
  if (style === 'outline') {
    ctx.lineWidth = Math.max(2, size * 0.09);
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
    const letters = sub.toUpperCase().split('').join(' ');
    ctx.fillText(letters, w / 2, bandY + band * 0.88);
  }
}

// Full cover: panels, grade wash, decor, caption band, frame.
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(state.layout || 'hero', w, h);
  const gutter = Math.max(4, Math.round(w * 0.008));
  rects.forEach((r, i) => {
    const p = (state.panels && state.panels[i]) || {};
    const img = p.photo || null;
    const inner = {
      x: r.x + (i === 0 || state.layout === 'top' ? gutter : gutter / 2),
      y: r.y + gutter / 2,
      w: r.w - gutter,
      h: r.h - gutter,
    };
    if (state.layout === 'hero' && i === 0) inner.w = r.w - gutter * 1.5;
    drawPhotoCover(ctx, img, inner, p);
    if (!img) {
      // empty panel: sunset sky placeholder so the poster never looks blank
      const g = ctx.createLinearGradient(inner.x, inner.y, inner.x, inner.y + inner.h);
      g.addColorStop(0, grade.sky[0]);
      g.addColorStop(1, grade.sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
      drawSunDisc(ctx, inner.x + inner.w * 0.5, inner.y + inner.h * 0.38, Math.min(inner.w, inner.h) * 0.22, grade);
    }
  });

  // grade wash over the photo area only
  const photoH = h * 0.8;
  const wash = ctx.createLinearGradient(0, 0, 0, photoH);
  wash.addColorStop(0, 'rgba(255,255,255,0.05)');
  wash.addColorStop(0.7, grade.wash);
  wash.addColorStop(1, grade.deep);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, photoH);

  // Sun disc sitting on the horizon at the foot of the photo area, so the
  // sun never covers a face in a panel.
  const photoH2 = h * 0.8;
  const sunX = w * 0.25;
  const sunY = photoH2;
  drawSunDisc(ctx, sunX, sunY - Math.min(w, h) * 0.02, Math.min(w, h) * 0.085, grade);

  // white poster gutters between panels
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = gutter;
  rects.forEach((r) => {
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });
  // outer frame
  ctx.lineWidth = Math.max(6, Math.round(w * 0.012));
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  drawCaption(ctx, state, w, h);

  // palm silhouettes flanking the caption band
  const ps = Math.min(w, h) * 0.0011;
  drawPalm(ctx, w * 0.045, h * 0.995, ps, -0.18);
  drawPalm(ctx, w * 0.955, h * 0.995, ps, 0.18);

  if (state.vignette !== false) drawVignette(ctx, w, h);
  if (state.grain) drawGrain(ctx, w, h, 0.05);
}
