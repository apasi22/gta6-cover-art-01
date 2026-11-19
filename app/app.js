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
   sits below a sky strip; the caption band overlays its bottom. */
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
  collage: [
    { x: 0, y: 0, w: 0.3, h: 0.65 },
    { x: 0.3, y: 0, w: 0.38, h: 0.23 },
    { x: 0.68, y: 0, w: 0.32, h: 0.28 },
    { x: 0.68, y: 0.28, w: 0.32, h: 0.27 },
    { x: 0, y: 0.65, w: 0.3, h: 0.35 },
    { x: 0.3, y: 0.57, w: 0.19, h: 0.43 },
    { x: 0.49, y: 0.57, w: 0.19, h: 0.43 },
    { x: 0.68, y: 0.55, w: 0.32, h: 0.45 },
    // Center pair fills the middle (x 0.30-0.68, y 0.23-0.57) so the
    // collage covers the whole cover; the badge overlaps these panels.
    { x: 0.3, y: 0.23, w: 0.19, h: 0.34 },
    { x: 0.49, y: 0.23, w: 0.19, h: 0.34 },
  ],
};

/* The user's own 7 illustrated photos (their own artwork, supplied by the
   user) — these are the only sample photos; the kit's Boulevard/Pier
   samples were removed at the user's request. */
const SAMPLES = [
  { name: 'Marina Man', src: 'samples/marina-man.jpg' },
  { name: 'Heli City', src: 'samples/heli-city.jpg' },
  { name: 'Bike Sunset', src: 'samples/bike-sunset.jpg' },
  { name: 'Collage', src: 'samples/collage.jpg' },
  { name: 'Beach Sunset', src: 'samples/beach-sunset.jpg' },
  { name: 'Vice Bay Woman', src: 'samples/woman-vicebay.jpg' },
  { name: 'Speedboats', src: 'samples/speedboats.jpg' },
];

// ---------- state ----------
const state = {
  photos: [], // { id, name, img }
  layout: 'collage',
  grade: 'vivid',
  title: '',
  subtitle: 'LEONIDA \u2022 EST. 2026',
  size: 'wide',
  panels: [], // { photoId, zoom, ox, oy } — one per layout slot
  selectedPanel: 0,
  nextPhotoId: 1,
};

/* Varied default crops per panel slot, so panels do not all show the same
   crop of the same photo. Portraits (Marina Man, Heli City, Beach Sunset,
   Vice Bay Woman) have their subjects near the top, so oy stays low for
   them; landscape shots (Bike Sunset, Speedboats) and the Collage sit
   nearer the middle. The center pair (slots 8-9) crops toward the outer
   edges, where the badge does not cover them. */
const PANEL_CROPS = [
  { zoom: 1.35, ox: 0.32, oy: 0.5 },
  { zoom: 1.4, ox: 0.6, oy: 0.18 },
  { zoom: 1.45, ox: 0.5, oy: 0.2 },
  { zoom: 1.25, ox: 0.68, oy: 0.2 },
  { zoom: 1.3, ox: 0.42, oy: 0.5 },
  { zoom: 1.2, ox: 0.55, oy: 0.6 },
  { zoom: 1.4, ox: 0.65, oy: 0.45 },
  { zoom: 1.25, ox: 0.35, oy: 0.55 },
  { zoom: 1.5, ox: 0.25, oy: 0.18 },
  { zoom: 1.5, ox: 0.75, oy: 0.18 },
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
const SKY_H = 0.12; // sky strip height, as a fraction of canvas height

function panelRects(W, H) {
  const areaY = H * SKY_H;
  const areaH = H - areaY;
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

function drawSky(ctx, W, H, grade) {
  const g = ctx.createLinearGradient(0, 0, 0, H * SKY_H + H * 0.12);
  for (const [stop, color] of grade.sky) g.addColorStop(stop, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * SKY_H + H * 0.12);
}

function drawSun(ctx, W, H, grade) {
  const r = H * SKY_H * 0.8;
  const cx = W * 0.5;
  const cy = H * SKY_H * 0.55;
  const g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
  g.addColorStop(0, grade.sun[0]);
  g.addColorStop(0.55, grade.sun[1]);
  g.addColorStop(1, grade.sun[2]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Slat cuts across the sun's lower half, filled with the sky gradient
  // so they read as gaps.
  const sky = ctx.createLinearGradient(0, 0, 0, H * SKY_H + H * 0.12);
  for (const [stop, color] of grade.sky) sky.addColorStop(stop, color);
  ctx.fillStyle = sky;
  let y = cy + r * 0.05;
  let band = r * 0.06;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, band);
    y += band + r * 0.16;
    band *= 1.35;
  }
  ctx.restore();
}

function drawSkyline(ctx, W, H, grade) {
  const rand = mulberry32(7);
  const base = H * SKY_H;
  const dark = '#14081f';
  ctx.fillStyle = dark;
  let x = 0;
  while (x < W) {
    const bw = W * (0.03 + rand() * 0.05);
    const bh = H * SKY_H * (0.25 + rand() * 0.6);
    ctx.fillRect(x, base - bh, bw, bh);
    // Antenna on some towers.
    if (rand() < 0.3) ctx.fillRect(x + bw / 2 - 1, base - bh - H * 0.03, 2, H * 0.03);
    // Lit windows.
    ctx.fillStyle = grade.accent2;
    const cols = Math.max(1, Math.floor(bw / (W * 0.012)));
    const rows = Math.max(1, Math.floor(bh / (H * 0.025)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.22) {
          ctx.fillRect(x + 3 + c * (W * 0.012), base - bh + 4 + r * (H * 0.025), 2.5, 3.5);
        }
      }
    }
    ctx.fillStyle = dark;
    x += bw + W * 0.004;
  }
}

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
  // The bottom title is optional: the default is empty, so a fresh cover
  // has no white title line at the bottom (the user asked to remove it).
  // If the user types a title in the editor it is drawn as before.
  const text = (state.title || '').toUpperCase();
  const maxW = W * 0.92;
  const bandY = H * 0.86;
  let size = H * 0.115;
  if (text) {
    const font = (s) => `900 ${s}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
    ctx.font = font(size);
    while (ctx.measureText(text).width > maxW && size > 12) {
      size *= 0.94;
      ctx.font = font(size);
    }
    const grad = ctx.createLinearGradient(0, bandY - size, 0, bandY);
    grad.addColorStop(0, grade.titleTop);
    grad.addColorStop(0.55, grade.titleMid);
    grad.addColorStop(1, grade.titleBot);
    ctx.save();
    ctx.translate(W / 2, bandY);
    ctx.transform(1, 0, -0.06, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.085);
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
  }

  // Subtitle on a tracked-out line under the title. With no title the chip
  // sits centred on the title band instead, so it does not float low.
  const sub = (state.subtitle || '').toUpperCase();
  if (sub) {
    const spaced = sub.split('').join('\u2009');
    const subSize = Math.max(10, H * 0.026);
    ctx.save();
    ctx.font = `700 ${subSize}px "Helvetica Neue",Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(spaced).width;
    const pad = subSize * 0.9;
    const chipY = text ? bandY + size * 0.12 : bandY - subSize * 0.95;
    ctx.fillStyle = 'rgba(20,8,31,0.72)';
    roundRect(ctx, W / 2 - w / 2 - pad, chipY, w + pad * 2, subSize * 1.9, subSize * 0.5);
    ctx.fill();
    ctx.fillStyle = grade.accent2;
    ctx.fillText(spaced, W / 2, chipY + subSize * 0.42);
    ctx.restore();
  }
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

// ---------- central logo: "VI" + "Vice City", like the user's reference ----------
// Text-only logo, no diamond/background shape: a huge "VI" in a pink ->
// orange gradient with a thick black outer outline and a white inner
// outline, and "Vice City" beneath it in a pink script-style italic with
// the same double outline. Original lettering in system fonts only — the
// "VI" is the generic Roman numeral 6 and "Vice City" is plain text, not
// Rockstar's mark. (The reference reads "Vice VII", an AI typo; the user
// asked for "Vice City".) Font match, checked against the reference
// close-up: "VI" uses Noto Sans Black (the heaviest sans installed —
// much thicker and blockier than the old Arial Black fallback, like the
// reference's massive letters), and "Vice City" uses Noto Serif Display
// Black Italic (the heaviest italic installed, strongly sheared so it
// reads as a bold flowing script). No script/cursive font is installed
// on this system (checked fc-list thoroughly), so this is the closest
// system-font match to the reference's script.
function drawBadge(ctx, W, H, grade) {
  const cx = W * 0.5;
  const cy = H * 0.46;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = Math.max(12, W * 0.018);
  ctx.shadowOffsetY = Math.max(5, H * 0.01);

  // Double-outlined text: thick black outer ring, white inner ring,
  // gradient fill — the reference logo's look. Reads clearly where it
  // overlaps the center panels' photos.
  function logoText(text, x, y, font, size, fill) {
    ctx.font = font(size);
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.strokeStyle = '#14081f';
    ctx.strokeText(text, x, y);
    ctx.lineWidth = Math.max(1.5, size * 0.05);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  // "VI": huge and wide, like the reference. Sized by height, then
  // stretched horizontally; clamped so it never exceeds 66% of the width.
  const viFont = (s) => `900 ${s}px "Noto Sans Black","Noto Sans",sans-serif`;
  let viSize = H * 0.30;
  ctx.font = viFont(viSize);
  const viNatural = ctx.measureText('VI').width;
  const viStretch = 1.6;
  const viMaxW = W * 0.66;
  if (viNatural * viStretch > viMaxW) viSize *= viMaxW / (viNatural * viStretch);
  const viTop = cy - H * 0.10;
  const viGrad = ctx.createLinearGradient(0, viTop - viSize * 0.5, 0, viTop + viSize * 0.5);
  viGrad.addColorStop(0, '#ff5ce1');
  viGrad.addColorStop(0.5, '#ff7ad9');
  viGrad.addColorStop(0.75, '#ff9a3c');
  viGrad.addColorStop(1, '#ffc93c');
  ctx.save();
  ctx.translate(cx, viTop);
  ctx.transform(viStretch, 0, 0, 1, 0, 0);
  logoText('VI', 0, 0, viFont, viSize, viGrad);
  ctx.restore();

  // "Vice City": script-style pink italic beneath "VI", slightly wider
  // than the "VI" (like the reference). No script font is installed, so
  // the closest system look is the heaviest italic serif available
  // (Noto Serif Display Black Italic), sheared further for a flowing,
  // handwritten slant.
  const vcFont = (s) => `italic 900 ${s}px "Noto Serif Display",serif`;
  let vcSize = H * 0.115;
  ctx.font = vcFont(vcSize);
  while (ctx.measureText('Vice City').width > W * 0.62 && vcSize > 12) {
    vcSize *= 0.94;
    ctx.font = vcFont(vcSize);
  }
  const vcY = viTop + viSize * 0.36 + vcSize * 0.30;
  const vcGrad = ctx.createLinearGradient(0, vcY - vcSize * 0.5, 0, vcY + vcSize * 0.5);
  vcGrad.addColorStop(0, '#ff9ae2');
  vcGrad.addColorStop(1, '#ff5ce1');
  ctx.save();
  ctx.translate(cx, vcY);
  ctx.transform(1, 0, -0.22, 1, 0, 0);
  logoText('Vice City', 0, 0, vcFont, vcSize, vcGrad);
  ctx.restore();

  ctx.restore();
}

// ---------- the cover ----------
function renderCover(ctx, W, H, st, opts) {
  const grade = GRADES[st.grade];
  const markSelected = !opts || opts.markSelected !== false;
  // Sky + skyline behind everything; the sun is drawn over the skyline so
  // it stays clearly visible (never hidden behind the buildings).
  drawSky(ctx, W, H, grade);
  drawSkyline(ctx, W, H, grade);
  drawSun(ctx, W, H, grade);

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

  // Central badge over the collage (collage layout only).
  if (st.layout === 'collage') drawBadge(ctx, W, H, grade);

  // Caption scrim across the bottom.
  const scrim = ctx.createLinearGradient(0, H * 0.62, 0, H);
  scrim.addColorStop(0, 'rgba(12,4,24,0)');
  scrim.addColorStop(0.55, grade.scrim);
  scrim.addColorStop(1, grade.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

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
