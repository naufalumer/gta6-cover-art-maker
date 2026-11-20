// cover.js — the canvas renderer for Vice Cover Studio.
//
// Paints a GTA-style multi-panel poster cover onto a canvas from a plain
// state object: nine panel photos, a layout, a colour grade, a caption, a
// subtitle and an output size. Everything is drawn with the 2D canvas API,
// no libraries, no network. The grain uses a seeded generator so two renders
// of the same state are pixel-identical.

export const PANEL_NAMES = [
  'heli',
  'couple',
  'bike',
  'car',
  'city',
  'gunman',
  'gator',
  'flamingo',
  'boat',
];

export const GRADES = ['sunset', 'neon', 'pastel'];
export const LAYOUTS = ['grid', 'hero', 'strip', 'top'];
export const SIZES = [
  { label: '1080 x 1080', width: 1080, height: 1080 },
  { label: '1080 x 1350', width: 1080, height: 1350 },
  { label: '1920 x 1080', width: 1920, height: 1080 },
];

// A palette is the whole look of a cover: the sky behind the panels, the
// caption band, the accent lines and the sun.
export const PALETTES = {
  sunset: {
    skyTop: '#2b0a4e',
    skyMid: '#b83a6e',
    skyBot: '#ff7e3d',
    bandTop: '#1c0b2e',
    bandBot: '#0e0518',
    accent: '#ffd166',
    sunCore: '#fff3b0',
    sunEdge: '#ff9a3d',
    ink: '#fff7ea',
    subInk: '#ffd9a0',
    frame: '#ffcf5c',
  },
  neon: {
    skyTop: '#07031a',
    skyMid: '#3b0f66',
    skyBot: '#ff2e88',
    bandTop: '#120826',
    bandBot: '#06030f',
    accent: '#00e5ff',
    sunCore: '#ffe9f6',
    sunEdge: '#ff5da2',
    ink: '#f2fbff',
    subInk: '#9beeff',
    frame: '#00e5ff',
  },
  pastel: {
    skyTop: '#8ec9ee',
    skyMid: '#ffd9a0',
    skyBot: '#ffe9c9',
    bandTop: '#274060',
    bandBot: '#16283e',
    accent: '#ff8c42',
    sunCore: '#fffbe8',
    sunEdge: '#ffd166',
    ink: '#fffaf0',
    subInk: '#ffe3b3',
    frame: '#ffffff',
  },
};

export function paletteFor(grade) {
  return PALETTES[grade] || PALETTES.sunset;
}

// A tiny deterministic generator: the same seed always yields the same
// grain, so a cover renders identically every time.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(x, y, w, h) {
  return { x, y, width: w, height: h };
}

// Where each of the nine panels goes for a layout, as rectangles inside a
// canvas of w by h. Every layout shows all nine panels and looks clearly
// different from the others.
export function layoutCells(layout, w, h) {
  const m = Math.max(4, Math.round(w * 0.012));
  const cells = [];
  if (layout === 'hero') {
    // A 4 by 3 unit grid: the feature panel takes the top-left 2 by 2 block,
    // the other eight fill the rest one unit each.
    const uw = (w - m * 5) / 4;
    const uh = (h - m * 4) / 3;
    cells.push(rect(m, m, uw * 2 + m, uh * 2 + m));
    cells.push(rect(m + (uw + m) * 2, m, uw, uh));
    cells.push(rect(m + (uw + m) * 3, m, uw, uh));
    cells.push(rect(m + (uw + m) * 2, m + uh + m, uw, uh));
    cells.push(rect(m + (uw + m) * 3, m + uh + m, uw, uh));
    for (let c = 0; c < 4; c++) {
      cells.push(rect(m + (uw + m) * c, m + (uh + m) * 2, uw, uh));
    }
    return cells;
  }
  if (layout === 'strip') {
    // One wide horizontal band of nine tall, thin panels across the middle,
    // with caption bands above and below it.
    const topBand = h * 0.18;
    const botBand = h * 0.16;
    const bandY = topBand + m;
    const bandH = h - topBand - botBand - m * 2;
    const pw = (w - m * 10) / 9;
    for (let i = 0; i < 9; i++) {
      cells.push(rect(m + (pw + m) * i, bandY, pw, bandH));
    }
    return cells;
  }
  if (layout === 'top') {
    // A tall top row of three panels, then a 3 by 2 grid underneath.
    const topH = h * 0.34;
    const tw = (w - m * 4) / 3;
    for (let c = 0; c < 3; c++) {
      cells.push(rect(m + (tw + m) * c, m, tw, topH));
    }
    const gy = m + topH + m;
    const gh = (h - m - gy - m) / 2;
    const cw = (w - m * 4) / 3;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        cells.push(rect(m + (cw + m) * c, gy + (gh + m) * r, cw, gh));
      }
    }
    return cells;
  }
  // grid: a busy 3 by 3 wall of equal panels.
  const cw = (w - m * 4) / 3;
  const ch = (h - m * 4) / 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push(rect(m + (cw + m) * c, m + (ch + m) * r, cw, ch));
    }
  }
  return cells;
}

// Draw one photo into its cell, honouring the panel's zoom and fit mode.
// Cover crops to fill the cell; contain letterboxes the whole photo in.
function drawPanelPhoto(ctx, img, cell, panel) {
  const zoom = (panel && panel.zoom ? panel.zoom : 100) / 100;
  const contain = !!(panel && panel.fit);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  let scale;
  if (contain) {
    scale = Math.min(cell.width / iw, cell.height / ih) * zoom;
  } else {
    scale = Math.max(cell.width / iw, cell.height / ih) * zoom;
  }
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = cell.x + (cell.width - dw) / 2;
  const dy = cell.y + (cell.height - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cell.x, cell.y, cell.width, cell.height);
  ctx.clip();
  if (contain) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  // A hairline frame keeps neighbouring panels distinct.
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(1, cell.width * 0.004);
  ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
  ctx.restore();
}

function verticalGradient(ctx, x, y, h, stops) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function paintSunDisc(ctx, cx, cy, r, palette) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, palette.sunCore);
  g.addColorStop(0.55, palette.sunEdge);
  g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Two palm silhouettes leaning in from the bottom corners.
function paintPalmTree(ctx, x, y, s, lean, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -70, -4, -140);
  ctx.stroke();
  ctx.lineWidth = 5;
  const fronds = [-2.6, -1.9, -1.2, -0.5, 0.2, 0.9, 1.6, 2.3];
  for (const a of fronds) {
    ctx.beginPath();
    ctx.moveTo(-4, -140);
    ctx.quadraticCurveTo(-4 + Math.sin(a) * 55, -140 - Math.cos(a) * 18 - 22, -4 + Math.sin(a) * 95, -140 - Math.cos(a) * 30 + 26);
    ctx.stroke();
  }
  ctx.restore();
}

// A jagged skyline silhouette, drawn as dark blocks along a baseline.
function paintSkyline(ctx, w, baseline, h, color, seed) {
  const rand = seededRandom(seed);
  ctx.save();
  ctx.fillStyle = color;
  let x = -10;
  while (x < w + 10) {
    const bw = 18 + rand() * 46;
    const bh = h * (0.25 + rand() * 0.75);
    ctx.fillRect(x, baseline - bh, bw, bh);
    if (rand() > 0.6) {
      ctx.fillRect(x + bw * 0.3, baseline - bh - h * 0.22, bw * 0.22, h * 0.22);
    }
    x += bw + 2 + rand() * 8;
  }
  ctx.restore();
}

function paintGrain(ctx, w, h, amount) {
  const rand = seededRandom(20261120);
  const n = Math.floor((w * h) / 9000) * amount;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#000000';
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function paintVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// The caption band along the bottom: skyline behind the lettering, the
// caption in Pricedown, the subtitle smaller beneath it.
function paintCaptionBand(ctx, state, w, h, palette, bandY, bandH) {
  ctx.save();
  ctx.fillStyle = verticalGradient(ctx, 0, bandY, bandH, [
    [0, palette.bandTop],
    [1, palette.bandBot],
  ]);
  ctx.fillRect(0, bandY, w, bandH);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, bandY, w, Math.max(2, h * 0.004));
  paintSkyline(ctx, w, bandY + 2, bandH * 0.5, 'rgba(8,2,18,0.85)', 77);
  const pad = w * 0.04;
  const caption = (state.caption || 'VICE CITY').toUpperCase();
  ctx.fillStyle = palette.ink;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = Math.max(2, h * 0.006);
  ctx.shadowOffsetY = Math.max(1, h * 0.002);
  ctx.font = `${Math.round(bandH * 0.52)}px Pricedown, 'Arial Black', sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(caption, pad, bandY + bandH * (state.sub ? 0.38 : 0.52), w - pad * 2);
  if (state.sub) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.subInk;
    ctx.font = `700 ${Math.round(bandH * 0.2)}px Arial, sans-serif`;
    ctx.fillText(state.sub, pad, bandY + bandH * 0.8, w - pad * 2);
  }
  ctx.restore();
}

// The big gradient VI mark in the middle of the cover.
function paintVILogo(ctx, w, h, palette, sizeFactor) {
  const size = h * sizeFactor;
  const g = ctx.createLinearGradient(w / 2, h * 0.5 - size * 0.45, w / 2, h * 0.5 + size * 0.45);
  g.addColorStop(0, '#ffb347');
  g.addColorStop(0.5, '#ff2e88');
  g.addColorStop(1, '#7b2fff');
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.font = `${Math.round(size)}px Pricedown, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a2e';
  ctx.lineWidth = Math.max(3, size * 0.035);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.max(4, size * 0.04);
  ctx.shadowOffsetY = Math.max(2, size * 0.015);
  ctx.strokeText('VI', w / 2, h * 0.44);
  ctx.fillStyle = g;
  ctx.fillText('VI', w / 2, h * 0.44);
  ctx.restore();
}

// Paint a whole cover. state: { images, panels, layout, grade, caption,
// sub, size: {width, height} }. images is an array of nine Image objects
// (or null for an empty slot); panels is an array of nine {zoom, fit}.
export function renderCover(canvas, state) {
  const size = state.size || { width: 1080, height: 1080 };
  const w = size.width;
  const h = size.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const palette = paletteFor(state.grade);
  const layout = state.layout || 'grid';

  // Sky: the backdrop every layout sits on.
  ctx.fillStyle = verticalGradient(ctx, 0, 0, h, [
    [0, palette.skyTop],
    [0.55, palette.skyMid],
    [1, palette.skyBot],
  ]);
  ctx.fillRect(0, 0, w, h);

  const cells = layoutCells(layout, w, h);
  const images = state.images || [];
  const panels = state.panels || [];
  for (let i = 0; i < 9; i++) {
    const img = images[i];
    if (img) drawPanelPhoto(ctx, img, cells[i], panels[i] || { zoom: 100, fit: false });
  }

  // Sunset glow over the panels, palms leaning in from the corners.
  if (layout !== 'strip') {
    paintSunDisc(ctx, w * 0.82, h * 0.13, h * 0.12, palette);
  }
  const palmScale = h / 900;
  paintPalmTree(ctx, w * 0.03, h * 0.99, palmScale, -0.16, 'rgba(10,4,20,0.9)');
  paintPalmTree(ctx, w * 0.97, h * 0.99, palmScale, 0.16, 'rgba(10,4,20,0.9)');

  // The VI mark: full-size over the grid, smaller where bands dominate.
  if (layout === 'strip') {
    paintVILogo(ctx, w, h, palette, 0.2);
  } else if (layout === 'hero') {
    paintVILogo(ctx, w, h, palette, 0.34);
  } else if (layout === 'top') {
    paintVILogo(ctx, w, h, palette, 0.3);
  } else {
    paintVILogo(ctx, w, h, palette, 0.42);
  }

  // Caption bands: one along the bottom everywhere; the strip layout also
  // carries its caption in the top band.
  if (layout === 'strip') {
    const topBand = h * 0.18;
    ctx.save();
    ctx.fillStyle = verticalGradient(ctx, 0, 0, topBand, [
      [0, palette.bandTop],
      [1, palette.bandBot],
    ]);
    ctx.fillRect(0, 0, w, topBand);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, topBand - Math.max(2, h * 0.004), w, Math.max(2, h * 0.004));
    const pad = w * 0.04;
    ctx.fillStyle = palette.ink;
    ctx.font = `${Math.round(topBand * 0.42)}px Pricedown, 'Arial Black', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText((state.caption || 'VICE CITY').toUpperCase(), pad, topBand * 0.5, w - pad * 2);
    ctx.restore();
    paintCaptionBand(ctx, { caption: state.sub || 'NINE PANELS · ONE NIGHT', sub: '' }, w, h, palette, h * 0.84, h * 0.16);
  } else {
    paintCaptionBand(ctx, state, w, h, palette, h * 0.85, h * 0.15);
  }

  paintGrain(ctx, w, h, 1);
  paintVignette(ctx, w, h);

  // A thin frame holds the poster together.
  ctx.save();
  ctx.strokeStyle = palette.frame;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
  return canvas;
}
