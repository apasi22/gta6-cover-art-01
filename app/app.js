'use strict';
/* Vice Cover Studio — multi-panel GTA-style cover art maker.
   Everything runs offline: photos are read on the user's own machine,
   never uploaded. Rendering is canvas only, system fonts only. */

// ---------- deterministic random (seeded, so exports are stable) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- sizes, grades, layouts ----------
const SIZES = {
  wide: [1920, 1080],
  portrait: [1080, 1350],
  square: [1080, 1080],
};

const GRADES = {
  sunset: {
    sky: [[0, '#160a2e'], [0.45, '#7b1e5b'], [0.78, '#ff5e3a'], [1, '#ffb347']],
    sun: ['#fff3b0', '#ff9a3c', '#ff2e63'],
    accent: '#ff2e63',
    accent2: '#00e5ff',
    tint: 'rgba(255,110,60,0.16)',
    scrim: 'rgba(12,4,24,0.88)',
    frame: '#ff2e63',
    titleTop: '#ffffff',
    titleMid: '#ffe9a8',
    titleBot: '#ff7a3c',
  },
  neon: {
    sky: [[0, '#050510'], [0.5, '#1b0b3b'], [0.8, '#7a1e6e'], [1, '#ff2e88']],
    sun: ['#aefcff', '#00e5ff', '#ff2e88'],
    accent: '#00e5ff',
    accent2: '#ff2e88',
    tint: 'rgba(0,229,255,0.13)',
    scrim: 'rgba(4,4,20,0.88)',
    frame: '#00e5ff',
    titleTop: '#ffffff',
    titleMid: '#aefcff',
    titleBot: '#ff2e88',
  },
  midnight: {
    sky: [[0, '#020617'], [0.55, '#0f1e3d'], [1, '#3b2a6b']],
    sun: ['#ffe9a8', '#f5c542', '#8b5cf6'],
    accent: '#f5c542',
    accent2: '#8b5cf6',
    tint: 'rgba(139,92,246,0.15)',
    scrim: 'rgba(2,6,23,0.9)',
    frame: '#f5c542',
    titleTop: '#ffffff',
    titleMid: '#ffe9a8',
    titleBot: '#b79cff',
  },
  vivid: {
    sky: [[0, '#1a0533'], [0.38, '#8b1e6b'], [0.68, '#ff2e63'], [0.88, '#ff7a3c'], [1, '#ffb347']],
    sun: ['#fff7c0', '#ffb347', '#ff2e63'],
    accent: '#ff2e63',
    accent2: '#00e5ff',
    tint: 'rgba(255,46,99,0.2)',
    // Strong stylized photo filter (Vivid): high saturation + contrast so
    // photos read like the reference's vibrant illustrated panels.
    photoFilter: 'saturate(1.8) contrast(1.35) brightness(1.06)',
    scrim: 'rgba(16,4,32,0.88)',
    frame: '#ff2e63',
    titleTop: '#ffffff',
    titleMid: '#ffd166',
    titleBot: '#ff2e63',
  },
};

/* Layout slots live in panel-area space (x/y/w/h in 0..1). The panel area
   is the whole cover (full-bleed, y=0..1); the caption band overlays its
   bottom. */
const LAYOUTS = {
  hero: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.5 },
    { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
  ],
  quad: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  strip: [
    { x: 0, y: 0, w: 1, h: 0.6 },
    { x: 0, y: 0.6, w: 1 / 3, h: 0.4 },
    { x: 1 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
    { x: 2 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
  ],
  poster: [
    { x: 0, y: 0, w: 0.42, h: 1 },
    { x: 0.42, y: 0, w: 0.58, h: 0.55 },
    { x: 0.42, y: 0.55, w: 0.58, h: 0.45 },
  ],
  /* GTA Collage (round 10): exactly 9 panels — one per sample photo, so no
     photo ever repeats. The 7-panel version was replaced because the user
     sent a new reference ("VICE CITY Miami Sunset") and asked for the same
     name and the same shape: a dense multi-panel collage like the
     reference, with the top entries' photos plus the reference's own
     panels (jet ski, cash, neon street, nightclub). A tall hero on the
     left, four stacked panels in the center column and four in the right
     column; the big "VICE CITY Miami Sunset" title overlaps the bottom
     row, like the reference. */
  collage: [
    { x: 0, y: 0, w: 0.3, h: 1 },
    { x: 0.3, y: 0, w: 0.35, h: 0.25 },
    { x: 0.3, y: 0.25, w: 0.35, h: 0.25 },
    { x: 0.3, y: 0.5, w: 0.35, h: 0.25 },
    { x: 0.3, y: 0.75, w: 0.35, h: 0.25 },
    { x: 0.65, y: 0, w: 0.35, h: 0.25 },
    { x: 0.65, y: 0.25, w: 0.35, h: 0.25 },
    { x: 0.65, y: 0.5, w: 0.35, h: 0.25 },
    { x: 0.65, y: 0.75, w: 0.35, h: 0.25 },
  ],
};

/* The 9 sample photos (round 10): the same photos the leaderboard's top
   entries use, cropped from the screenshots the user sent, plus the panels
   of the "VICE CITY Miami Sunset" reference the user sent. The user
   ordered these exact photos ("gunakan foto yg ada di sana"). Five come
   from the top entries' covers: the curly-haired woman, the orange
   Corvette, the older man with a fishing hat, the helicopter over the
   city at sunset, the speedboat. Four come from the reference cover:
   jet skis at sunset, a hand holding cash + poker chips, the neon street
   with sports cars, the nightclub. Panel i shows photo i. */
const SAMPLES = [
  { name: 'Woman', src: 'samples/woman.jpg' },
  { name: 'Helicopter', src: 'samples/heli.jpg' },
  { name: 'Old Man', src: 'samples/man.jpg' },
  { name: 'Jet Ski', src: 'samples/jetski.jpg' },
  { name: 'Cash', src: 'samples/cash.jpg' },
  { name: 'Neon Street', src: 'samples/neon.jpg' },
  { name: 'Speedboat', src: 'samples/speedboat.jpg' },
  { name: 'Nightclub', src: 'samples/nightclub.jpg' },
  { name: 'Corvette', src: 'samples/car.jpg' },
];

// ---------- state ----------
const state = {
  photos: [], // { id, name, img }
  layout: 'collage',
  grade: 'vivid',
  title: 'VICE CITY',
  subtitle: 'LEONIDA \u2022 EST. 2026',
  size: 'wide',
  panels: [], // { photoId, zoom, ox, oy } — one per layout slot
  selectedPanel: 0,
  nextPhotoId: 1,
};

/* Varied default crops per panel slot, so panels do not all show the same
   crop of the same photo. Panel i shows photo i, so crop i is tuned for
   that photo: the hero woman's face is upper-center (oy low); the
   helicopter sits in the upper sky (oy low); the old man's face is
   upper-center; the jet ski and cash are wide strips, so they need
   little zoom; the neon street's cars sit low (oy high); the speedboat
   is centered; the nightclub's DJ is center; the Corvette sits low. */
const PANEL_CROPS = [
  { zoom: 1.0, ox: 0.5, oy: 0.5 },
  { zoom: 1.35, ox: 0.5, oy: 0.25 },
  { zoom: 1.3, ox: 0.5, oy: 0.3 },
  { zoom: 1.15, ox: 0.5, oy: 0.5 },
  { zoom: 1.15, ox: 0.55, oy: 0.5 },
  { zoom: 1.35, ox: 0.5, oy: 0.6 },
  { zoom: 1.3, ox: 0.5, oy: 0.5 },
  { zoom: 1.3, ox: 0.5, oy: 0.45 },
  { zoom: 1.35, ox: 0.5, oy: 0.55 },
];

function defaultPanels() {
  const n = LAYOUTS[state.layout].length;
  const keep = state.panels;
  const out = [];
  for (let i = 0; i < n; i++) {
    const old = keep[i];
    const crop = PANEL_CROPS[i % PANEL_CROPS.length];
    // A panel with no photo yet takes the next photo in turn (panel i
    // gets photo i % photos), so the collage shows different photos in
    // different panels instead of one photo everywhere.
    const fallback = state.photos.length ? state.photos[i % state.photos.length].id : null;
    out.push({
      photoId: old && old.photoId != null ? old.photoId : fallback,
      zoom: old ? old.zoom : crop.zoom,
      ox: old ? old.ox : crop.ox,
      oy: old ? old.oy : crop.oy,
    });
  }
  return out;
}

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const preview = $('preview');
const previewCtx = preview.getContext('2d');

// ---------- photo loading ----------
function addPhotoImage(img, name) {
  const photo = { id: state.nextPhotoId++, name, img };
  state.photos.push(photo);
  if (state.panels.length === 0) state.panels = defaultPanels();
  // A photo that arrives while panels are empty fills those panels.
  for (const p of state.panels) {
    if (p.photoId == null) p.photoId = photo.id;
  }
  refreshPhotoUI();
  renderPreview();
  return photo;
}

function loadSample(index) {
  const sample = SAMPLES[index];
  const img = new Image();
  img.onload = () => addPhotoImage(img, sample.name);
  img.onerror = () => note('Could not load the sample photo.');
  img.src = sample.src;
}

/* Load all samples in order (one after the other, so the photo order is
   deterministic), then spread the panels across the photos: panel i shows
   photo i % photos, so the collage uses all seven illustrations instead of
   repeating one. A photo that arrives while panels are empty still fills
   those panels (addPhotoImage), but the final spread below overwrites
   that with the varied assignment. */
function loadAllSamples() {
  let next = 0;
  const loadNext = () => {
    if (next >= SAMPLES.length) {
      if (state.photos.length) {
        state.panels = state.panels.map((p, i) => ({
          zoom: p.zoom, ox: p.ox, oy: p.oy,
          photoId: state.photos[i % state.photos.length].id,
        }));
        refreshPhotoUI();
        renderPreview();
      }
      return;
    }
    const sample = SAMPLES[next];
    const img = new Image();
    img.onload = () => { addPhotoImage(img, sample.name); next++; loadNext(); };
    img.onerror = () => { note('Could not load the sample photo.'); next++; loadNext(); };
    img.src = sample.src;
  };
  loadNext();
}

function loadUserFiles(files) {
  for (const file of files) {
    if (!file.type || file.type.indexOf('image/') !== 0) continue;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => addPhotoImage(img, file.name || 'Your photo');
    img.onerror = () => note('Could not read that file as an image.');
    img.src = url;
  }
}

// ---------- ui refresh ----------
function refreshPhotoUI() {
  const thumbs = $('thumbs');
  thumbs.innerHTML = '';
  for (const p of state.photos) {
    const t = document.createElement('img');
    t.src = p.img.src;
    t.alt = p.name;
    t.title = p.name;
    t.addEventListener('click', () => {
      state.panels[state.selectedPanel].photoId = p.id;
      refreshPhotoUI();
      renderPreview();
    });
    if (state.panels[state.selectedPanel] && state.panels[state.selectedPanel].photoId === p.id) {
      t.classList.add('sel');
    }
    thumbs.appendChild(t);
  }
  const photoSelect = $('photoSelect');
  photoSelect.innerHTML = '';
  for (const p of state.photos) {
    const o = document.createElement('option');
    o.value = String(p.id);
    o.textContent = p.name;
    photoSelect.appendChild(o);
  }
  const panel = state.panels[state.selectedPanel];
  if (panel) {
    photoSelect.value = panel.photoId === null ? '' : String(panel.photoId);
    $('zoomRange').value = String(panel.zoom);
    $('oxRange').value = String(panel.ox);
    $('oyRange').value = String(panel.oy);
  }
  const panelSelect = $('panelSelect');
  panelSelect.innerHTML = '';
  state.panels.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = 'Panel ' + (i + 1);
    panelSelect.appendChild(o);
  });
  panelSelect.value = String(state.selectedPanel);
}

function refreshActiveButtons() {
  for (const b of document.querySelectorAll('#layouts button')) {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  }
  for (const b of document.querySelectorAll('#grades button')) {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  }
  for (const b of document.querySelectorAll('#sizes button')) {
    b.classList.toggle('active', b.dataset.size === state.size);
  }
}

function note(text) {
  $('exportNote').textContent = text;
}

// ---------- events ----------
$('fileInput').addEventListener('change', (e) => {
  loadUserFiles(e.target.files);
  e.target.value = '';
});
document.querySelectorAll('.samples button').forEach((b) => {
  b.addEventListener('click', () => loadSample(Number(b.dataset.sample)));
});

document.querySelectorAll('#layouts button').forEach((b) => {
  b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    state.panels = defaultPanels();
    state.selectedPanel = 0;
    refreshPhotoUI();
    refreshActiveButtons();
    renderPreview();
  });
});
document.querySelectorAll('#grades button').forEach((b) => {
  b.addEventListener('click', () => {
    state.grade = b.dataset.grade;
    refreshActiveButtons();
    renderPreview();
  });
});
document.querySelectorAll('#sizes button').forEach((b) => {
  b.addEventListener('click', () => {
    state.size = b.dataset.size;
    refreshActiveButtons();
    renderPreview();
  });
});
$('panelSelect').addEventListener('change', (e) => {
  state.selectedPanel = Number(e.target.value);
  refreshPhotoUI();
  renderPreview();
});
$('photoSelect').addEventListener('change', (e) => {
  state.panels[state.selectedPanel].photoId = Number(e.target.value);
  refreshPhotoUI();
  renderPreview();
});
$('zoomRange').addEventListener('input', (e) => {
  state.panels[state.selectedPanel].zoom = Number(e.target.value);
  renderPreview();
});
$('oxRange').addEventListener('input', (e) => {
  state.panels[state.selectedPanel].ox = Number(e.target.value);
  renderPreview();
});
$('oyRange').addEventListener('input', (e) => {
  state.panels[state.selectedPanel].oy = Number(e.target.value);
  renderPreview();
});
$('fillAll').addEventListener('click', () => {
  const id = state.panels[state.selectedPanel].photoId;
  for (const p of state.panels) p.photoId = id;
  refreshPhotoUI();
  renderPreview();
});
$('titleInput').addEventListener('input', (e) => {
  state.title = e.target.value.toUpperCase();
  renderPreview();
});
$('subtitleInput').addEventListener('input', (e) => {
  state.subtitle = e.target.value.toUpperCase();
  renderPreview();
});
$('exportBtn').addEventListener('click', exportCover);

// Click a panel in the preview to select it.
preview.addEventListener('click', (e) => {
  const r = preview.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  const rects = panelRects(preview.width, preview.height);
  for (let i = 0; i < rects.length; i++) {
    const p = rects[i];
    if (x >= p.x / preview.width && x <= (p.x + p.w) / preview.width &&
        y >= p.y / preview.height && y <= (p.y + p.h) / preview.height) {
      state.selectedPanel = i;
      refreshPhotoUI();
      renderPreview();
      return;
    }
  }
});

// ---------- geometry ----------
// Panels are full-bleed: they fill the whole cover from y=0 to y=1.0.
// (Round 8: the top sky strip with its skyline + slatted sun was removed
// at the user's request — the user said it looked bad and cut the photos.)

function panelRects(W, H) {
  const areaY = 0;
  const areaH = H;
  const gap = Math.max(2, Math.round(W * 0.006));
  return LAYOUTS[state.layout].map((s) => {
    const x = s.x * W + (s.x === 0 ? gap : gap / 2);
    const y = areaY + s.y * areaH + (s.y === 0 ? gap : gap / 2);
    const w = s.w * W - (s.x === 0 || s.x + s.w === 1 ? gap * 1.5 : gap);
    const h = s.h * areaH - (s.y === 0 || s.y + s.h === 1 ? gap * 1.5 : gap);
    return { x, y, w, h };
  });
}

function photoById(id) {
  return state.photos.find((p) => p.id === id) || null;
}

// ---------- drawing helpers ----------
function drawPhotoInto(ctx, img, rect, zoom, ox, oy) {
  const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const dx = rect.x + (rect.w - dw) * ox;
  const dy = rect.y + (rect.h - dh) * oy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// (Round 8: the top sky strip — drawSky, drawSun, drawSkyline — was
// removed at the user's request. The cover is full-bleed now: the photo
// panels start at y=0 and no skyline or slatted sun cuts the photos.)

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.lineCap = 'round';
  // Trunk, leaning slightly.
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.55, x + s * 0.16, y - s * 0.95);
  ctx.stroke();
  const topX = x + s * 0.16;
  const topY = y - s * 0.95;
  // Fronds drooping out from the crown.
  for (let i = 0; i < 6; i++) {
    const a = (-0.15 - i * 0.32) * Math.PI;
    const len = s * (0.55 + (i % 2) * 0.12);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + s * 0.22;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.5, topY + Math.sin(a) * len * 0.3 - s * 0.08,
      ex, ey);
    ctx.lineWidth = Math.max(1.5, s * 0.035);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitle(ctx, W, H, grade) {
  // Round 10: the cover's name, like the "VICE CITY Miami Sunset"
  // reference the user sent ("nama sama, bentuk sama"). The title is the
  // caption the app draws — huge gradient letters at the bottom center,
  // with the pink "Miami Sunset" script under it and the gold "VOL. 06"
  // seal at its top-left. The central "VI Vice City" badge is gone (the
  // user asked for the same name as the reference instead). The title
  // comes from state.title (default "VICE CITY", editable in the editor);
  // the script line is the reference's tagline and always reads
  // "Miami Sunset" while a title is shown.
  const text = (state.title || '').toUpperCase();
  const cx = W * 0.62;
  const maxW = W * 0.55;
  let size = H * 0.14;
  let bandY = 0;
  if (text) {
    const font = (s) => `900 ${s}px "Arial Black","DejaVu Sans",sans-serif`;
    ctx.font = font(size);
    while (ctx.measureText(text).width > maxW && size > 12) {
      size *= 0.94;
      ctx.font = font(size);
    }
    bandY = H * 0.84;
    // Gradient: yellow top -> orange -> pink bottom (the reference).
    const grad = ctx.createLinearGradient(0, bandY - size, 0, bandY);
    grad.addColorStop(0, '#ffe45c');
    grad.addColorStop(0.5, '#ffb13c');
    grad.addColorStop(1, '#ff2e63');
    ctx.save();
    ctx.translate(cx, bandY);
    ctx.transform(1, 0, -0.04, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.1);
    ctx.strokeStyle = '#14081f';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeText(text, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(text, 0, 0);
    ctx.restore();

    // Gold "VOL. 06" seal at the title's top-left, like the reference.
    drawVolSeal(ctx, W, H);

    // "Miami Sunset": pink script under the title. No script font is
    // installed, so the closest system look is the rounded DejaVu bold
    // italic, sheared for a flowing slant (the same treatment the old
    // "Vice City" script used).
    const scFont = (s) => `italic 700 ${s}px "DejaVu Sans",sans-serif`;
    let scSize = H * 0.065;
    ctx.font = scFont(scSize);
    while (ctx.measureText('Miami Sunset').width > W * 0.5 && scSize > 12) {
      scSize *= 0.94;
      ctx.font = scFont(scSize);
    }
    const scY = bandY + scSize * 0.95;
    const scGrad = ctx.createLinearGradient(0, scY - scSize, 0, scY);
    scGrad.addColorStop(0, '#ff9ae2');
    scGrad.addColorStop(0.5, '#ff7ad0');
    scGrad.addColorStop(1, '#ff9a5c');
    ctx.save();
    ctx.translate(cx, scY);
    ctx.transform(1, 0, -0.28, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, scSize * 0.07);
    ctx.strokeStyle = '#241026';
    ctx.strokeText('Miami Sunset', 0, 0);
    ctx.fillStyle = scGrad;
    ctx.fillText('Miami Sunset', 0, 0);
    ctx.restore();
  }

  // Subtitle: a tiny tracked-out line at the very bottom edge, under the
  // script (it no longer sits on a chip in the title band, because the
  // big title fills that band now).
  const sub = (state.subtitle || '').toUpperCase();
  if (sub) {
    const spaced = sub.split('').join('\u2009');
    const subSize = Math.max(9, H * 0.018);
    ctx.save();
    ctx.font = `700 ${subSize}px "Helvetica Neue",Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = grade.accent2;
    ctx.fillText(spaced, W / 2, H * 0.985);
    ctx.restore();
  }
}

// Gold "VOL. 06" seal at the title's top-left (the reference's badge).
function drawVolSeal(ctx, W, H) {
  const r = Math.max(10, H * 0.048);
  const sx = W * 0.30;
  const sy = H * 0.72;
  ctx.save();
  const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
  g.addColorStop(0, '#ffe27a');
  g.addColorStop(0.7, '#f5b81f');
  g.addColorStop(1, '#c8891a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = '#8a5c10';
  ctx.stroke();
  ctx.fillStyle = '#3a2405';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${r * 0.34}px "Helvetica Neue",Arial,sans-serif`;
  ctx.fillText('VOL.', sx, sy - r * 0.28);
  ctx.font = `900 ${r * 0.52}px "Helvetica Neue",Arial,sans-serif`;
  ctx.fillText('06', sx, sy + r * 0.3);
  ctx.restore();
}

// Five gold stars in a dark chip at the top-left corner (the reference).
function drawStars(ctx, W, H) {
  const s = Math.max(10, H * 0.032);
  const pad = s * 0.45;
  const w = s * 5 + pad * 2 + s * 0.8;
  const h = s * 1.7;
  const x = W * 0.015;
  const y = H * 0.02;
  ctx.save();
  ctx.fillStyle = 'rgba(20,8,31,0.78)';
  roundRect(ctx, x, y, w, h, h * 0.35);
  ctx.fill();
  ctx.fillStyle = '#ffd94d';
  ctx.font = `${s}px "DejaVu Sans",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★★★★★', x + w / 2, y + h / 2 + s * 0.05);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGrain(ctx, W, H) {
  const rand = mulberry32(42);
  const n = Math.floor((W * H) / 2600);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

// (Round 10: the central "VI Vice City" badge was retired. The user sent
// the "VICE CITY Miami Sunset" reference and asked for the same name and
// the same shape, so the cover now carries the big "VICE CITY" title +
// "Miami Sunset" script at the bottom (drawTitle) instead of a central
// badge. The DejaVu bold-italic script treatment lives on in drawTitle.)

// ---------- the cover ----------
function renderCover(ctx, W, H, st, opts) {
  const grade = GRADES[st.grade];
  const markSelected = !opts || opts.markSelected !== false;
  // Photo panels fill the whole cover edge to edge (full-bleed). There is
  // no sky strip on top any more (removed in round 8): the panels start at
  // y=0, so the photos are never cut by a skyline/sun band. A flat dark
  // backing sits behind the panels so the thin gutters between them read
  // as clean collage gutters.
  ctx.fillStyle = '#14081f';
  ctx.fillRect(0, 0, W, H);

  // Photo panels.
  const rects = panelRects(W, H);
  for (let i = 0; i < rects.length; i++) {
    const p = st.panels[i];
    const r = rects[i];
    if (p && p.photoId !== null) {
      const photo = photoById(p.photoId);
      if (photo) {
        // Stylize the photo (Vivid grade): saturate + contrast, then reset.
        ctx.filter = grade.photoFilter || 'none';
        drawPhotoInto(ctx, photo.img, r, p.zoom, p.ox, p.oy);
        ctx.filter = 'none';
      } else {
        ctx.fillStyle = '#241636';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    } else {
      ctx.fillStyle = '#241636';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Warm grade tint over the photo.
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grade.tint;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    // Thin inner border + (preview only) selected-panel marker.
    ctx.save();
    const selected = markSelected && i === st.selectedPanel;
    ctx.strokeStyle = selected ? grade.accent2 : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = selected ? Math.max(2, W * 0.002) : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.restore();
  }

  // Five gold stars at the top-left corner (the reference's chip).
  drawStars(ctx, W, H);

  // Caption scrim across the bottom. Round 10: much lighter and lower
  // than before — the big "VICE CITY" title carries its own thick dark
  // outline, so the scrim only needs to give the "Miami Sunset" script
  // and the tiny subtitle line a little contrast. The old 0.88 scrim
  // blacked out the bottom-row panels (cash, Corvette) almost entirely.
  const scrim = ctx.createLinearGradient(0, H * 0.78, 0, H);
  scrim.addColorStop(0, 'rgba(12,4,24,0)');
  scrim.addColorStop(0.6, 'rgba(12,4,24,0.30)');
  scrim.addColorStop(1, 'rgba(12,4,24,0.45)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  // Palm silhouettes at the bottom corners, behind the title.
  ctx.save();
  ctx.globalAlpha = 0.5;
  drawPalm(ctx, W * 0.015, H * 0.99, H * 0.2, grade.accent2);
  drawPalm(ctx, W * 0.985, H * 0.99, H * 0.17, grade.accent2);
  ctx.restore();

  drawTitle(ctx, W, H, grade);

  // Neon frame.
  ctx.save();
  ctx.strokeStyle = grade.frame;
  ctx.lineWidth = Math.max(3, W * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  const inset = Math.max(3, W * 0.004) + Math.max(3, W * 0.002);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.restore();

  drawGrain(ctx, W, H);
}

// ---------- preview ----------
function renderPreview() {
  const [w, h] = SIZES[state.size];
  const maxW = 960;
  const maxH = 620;
  const scale = Math.min(maxW / w, maxH / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  if (preview.width !== pw || preview.height !== ph) {
    preview.width = pw;
    preview.height = ph;
  }
  renderCover(previewCtx, pw, ph, state);
}

// ---------- export ----------
function exportCover() {
  const [W, H] = SIZES[state.size];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  renderCover(c.getContext('2d'), W, H, state, { markSelected: false });
  c.toBlob((blob) => {
    if (!blob) { note('Export failed. Try again.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vice-cover-' + state.size + '-' + W + 'x' + H + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    note('Exported ' + W + ' × ' + H + ' PNG.');
  }, 'image/png');
}

// Testing / automation hook (also used to take the entry's screenshots).
window.CoverStudio = {
  state,
  renderCover,
  renderPreview,
  exportPNGDataURL(sizeKey) {
    const [W, H] = SIZES[sizeKey];
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    renderCover(c.getContext('2d'), W, H, state, { markSelected: false });
    return c.toDataURL('image/png');
  },
  exportJPEGDataURL(sizeKey, maxSide, quality) {
    const [W, H] = SIZES[sizeKey];
    const scale = Math.min(1, maxSide / Math.max(W, H));
    const tw = Math.round(W * scale);
    const th = Math.round(H * scale);
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    renderCover(src.getContext('2d'), W, H, state, { markSelected: false });
    const out = document.createElement('canvas');
    out.width = tw;
    out.height = th;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(src, 0, 0, tw, th);
    return { dataUrl: out.toDataURL('image/jpeg', quality || 0.88), width: tw, height: th };
  },
};

// ---------- init ----------
state.panels = defaultPanels();
refreshPhotoUI();
refreshActiveButtons();
renderPreview();
loadAllSamples();
