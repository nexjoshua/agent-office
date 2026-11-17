/* =========================================================
   ainex · Agent Office (3D, anime edition)
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const C = {
  accent: '#a3d4e0', navy: '#13235c', ink: '#0b0e12',
  idle: '#a3d4e0', work: '#fbbf24', ok: '#34d399', err: '#f87171',
};
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/* ---------- 1. Renderer, scene, camera, lights ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('scene').appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.setSize(innerWidth, innerHeight);
Object.assign(labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '5' });
document.body.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.ink);
scene.fog = new THREE.Fog(C.ink, 60, 120);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 250);
const HOME = { pos: new THREE.Vector3(26, 28, 30), target: new THREE.Vector3(0, 0, 0) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.08;
controls.minDistance = 1.5;
controls.maxDistance = 80;

let follow = null, zoomGoal = null, fly = null, NOW = 0, currentFile = '';

scene.add(new THREE.HemisphereLight('#dfe8f2', '#3a3128', 0.6));
const sun = new THREE.DirectionalLight('#fff0db', 2.4);
sun.position.set(16, 30, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 100 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
scene.add(sun);
for (const [x, z] of [[-10, -6], [4.5, -6], [-4, 6], [12, 5.5], [-15, 6]]) {
  const l = new THREE.PointLight('#ffd9a8', 18, 13, 2);
  l.position.set(x, 3.2, z);
  scene.add(l);
}

/* ---------- 2. Helpers ---------- */
const matCache = {};
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
const asMat = (c) => (c && c.isMaterial ? c : (matCache[c] ??= mat(c)));
function put(mesh, x, y, z, parent = scene) {
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const box = (w, h, d, c, x, y, z, p = scene) => put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), asMat(c)), x, y + h / 2, z, p);
const cyl = (r, h, c, x, y, z, p = scene) => put(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), asMat(c)), x, y + h / 2, z, p);
const ball = (r, c, x, y, z, p = scene) => put(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), asMat(c)), x, y, z, p);
const group = (x, z, rotY = 0, p = scene) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; p.add(g); return g; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const rnd = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
function turn(obj, target, k) {
  let d = target - obj.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * k;
}
function canvasTex(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...opts.repeat); }
  const redraw = () => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h); tex.needsUpdate = true; };
  redraw();
  document.fonts?.ready.then(redraw);
  return tex;
}
function plane(w, h, tex, x, y, z, rotY = 0, p = scene, transparent = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  p.add(m);
  return m;
}
function screen(w, h, parent, x, y, z) {
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 200;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  plane(w, h, tex, x, y, z, 0, parent);
  return { ctx: cv.getContext('2d'), tex, W: 320, H: 200 };
}
function arrow(g, x1, y1, x2, y2) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.beginPath(); g.moveTo(x2, y2);
  g.lineTo(x2 - 18 * Math.cos(a - 0.4), y2 - 18 * Math.sin(a - 0.4));
  g.lineTo(x2 - 18 * Math.cos(a + 0.4), y2 - 18 * Math.sin(a + 0.4));
  g.closePath(); g.fill();
}

/* ---------- 3. Textures ---------- */
const wood = canvasTex(1024, 1024, (g, w, h) => {
  const rows = 16, rh = h / rows;
  for (let i = 0; i < rows; i++) {
    const off = rnd(i + 1) * w;
    for (let k = -2; k < 2; k++) {
      const x = off + k * (w / 2);
      g.fillStyle = `hsl(${27 + rnd(i * 3 + k + 5) * 6}, ${30 + rnd(i + k + 9) * 8}%, ${48 + rnd(i * 5 + k * 2 + 3) * 10}%)`;
      g.fillRect(x, i * rh, w / 2, rh);
      g.fillStyle = 'rgba(40,24,10,.35)';
      g.fillRect(x, i * rh, 2, rh);
    }
    g.fillStyle = 'rgba(40,24,10,.4)';
    g.fillRect(0, i * rh, w, 2);
    for (let s = 0; s < 10; s++) {
      g.fillStyle = `rgba(60,35,15,${0.04 + rnd(i * 11 + s) * 0.05})`;
      g.fillRect(0, i * rh + rnd(i * 13 + s) * rh, w, 1.5);
    }
  }
}, { repeat: [5, 3] });

const tiles = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b9b3a8'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
    g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
  }
}, { repeat: [3, 2] });

const dusk = canvasTex(512, 320, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0d1a3d'); gr.addColorStop(0.55, '#2b4c7a'); gr.addColorStop(1, '#a3d4e0');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const bw = 18 + rnd(i) * 40, bh = 60 + rnd(i + 9) * 170, x = rnd(i + 3) * w;
    g.fillStyle = '#0b1222'; g.fillRect(x, h - bh, bw, bh);
    for (let y = h - bh + 8; y < h - 6; y += 12) {
      for (let xx = x + 4; xx < x + bw - 4; xx += 8) {
        if (rnd(xx * 3.1 + y) > 0.6) { g.fillStyle = 'rgba(255,214,150,.85)'; g.fillRect(xx, y, 3, 4); }
      }
    }
  }
});

const logoTex = canvasTex(1024, 300, (g) => {
  g.fillStyle = C.accent; g.font = `800 190px ${FONT}`; g.textBaseline = 'middle';
  g.fillText('ainex', 20, 120);
  g.fillStyle = '#7f8a96'; g.font = `500 44px ${MONO}`;
  g.fillText('SYSTEMS · WEB · AI', 28, 260);
});

const wbTex = canvasTex(1024, 560, (g, w, h) => {
  g.fillStyle = '#f7f8f9'; g.fillRect(0, 0, w, h);
  g.fillStyle = C.navy; g.font = `700 44px ${FONT}`; g.fillText('Lead engine v2', 50, 80);
  g.strokeStyle = '#2f6f86'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(50, 98); g.lineTo(380, 98); g.stroke();
  const nodes = [['Website', 70, 200], ['Yelp', 70, 330], ['CRM', 420, 265], ['AI agent', 700, 170], ['Booked', 700, 360]];
  g.font = `600 30px ${FONT}`;
  for (const [t, x, y] of nodes) {
    g.strokeStyle = C.navy; g.strokeRect(x, y, 210, 80);
    g.fillStyle = C.navy; g.fillText(t, x + 22, y + 52);
  }
  g.strokeStyle = '#2f6f86'; g.fillStyle = '#2f6f86';
  arrow(g, 280, 240, 418, 300); arrow(g, 280, 370, 418, 310);
  arrow(g, 630, 300, 698, 215); arrow(g, 630, 310, 698, 395); arrow(g, 805, 250, 805, 358);
  g.fillStyle = '#fde68a'; g.fillRect(880, 30, 120, 110);
  g.fillStyle = '#5b4a12'; g.font = `700 26px ${FONT}`; g.fillText('24/7', 905, 80);
  g.font = `500 18px ${FONT}`; g.fillText('auto reply', 900, 110);
});

const netTex = canvasTex(512, 64, (g, w, h) => {
  g.strokeStyle = 'rgba(20,24,28,.9)'; g.lineWidth = 2;
  for (let x = 0; x <= w; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});

const artTex = canvasTex(300, 400, (g, w, h) => {
  g.fillStyle = '#0f1a33'; g.fillRect(0, 0, w, h);
  g.fillStyle = C.accent; g.beginPath(); g.arc(w * 0.62, h * 0.38, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.navy; g.fillRect(40, h * 0.55, w - 80, 120);
  g.strokeStyle = '#e9e4dc'; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40);
});

const posterTex = canvasTex(400, 260, (g) => {
  g.fillStyle = '#120507'; g.fillRect(0, 0, 400, 260);
  g.fillStyle = '#b91c1c'; g.font = `800 58px ${FONT}`; g.fillText('CROSSFIRE', 26, 140);
  g.fillStyle = '#6b7280'; g.font = `600 18px ${MONO}`; g.fillText('SEARCH & DESTROY', 30, 180);
});

/* ---------- 4. Room shell (36 x 22 m) ---------- */
const W = 36, D = 22, X0 = -W / 2, Z0 = -D / 2, AISLE = -1.5;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat('#0d1116', { roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true; scene.add(ground);
box(W + 0.6, 0.35, D + 0.6, '#151a20', 0, -0.36, 0);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const wallM = mat('#e9e4dc', { roughness: 0.9 });
box(W + 0.3, 3.4, 0.3, wallM, 0, 0, Z0 - 0.15);
box(0.3, 3.4, D, wallM, X0 - 0.15, 0, 0);
box(W, 0.14, 0.04, '#2a2f36', 0, 0, Z0 + 0.02);
box(0.04, 0.14, D, '#2a2f36', X0 + 0.02, 0, 0);
box(W, 0.05, 0.03, mat(C.accent, { emissive: C.accent, emissiveIntensity: 1.5 }), 0, 3.25, Z0 + 0.03);

function windowAt(x, z, rotY, w = 2.6) {
  const g = group(x, z, rotY);
  plane(w, 1.5, dusk, 0, 1.85, 0.005, 0, g);
  box(w + 0.16, 0.08, 0.12, '#1d2228', 0, 1.06, 0.02, g);
  box(w + 0.16, 0.08, 0.12, '#1d2228', 0, 2.6, 0.02, g);
  for (const s of [-1, 1]) box(0.08, 1.62, 0.12, '#1d2228', s * (w / 2 + 0.04), 1.06, 0.02, g);
  box(0.05, 1.5, 0.06, '#1d2228', 0, 1.1, 0.03, g);
  box(w + 0.3, 0.05, 0.22, '#d8d2c8', 0, 1.02, 0.1, g);
}
windowAt(-2.2, Z0, 0);
windowAt(8.6, Z0, 0);
windowAt(15.8, Z0, 0, 2.2);
windowAt(X0, 1.2, Math.PI / 2);

plane(4.2, 1.23, logoTex, -10, 2.45, Z0 + 0.02, 0, scene, true);
box(0.95, 1.25, 0.04, '#1a1d22', 1.9, 1.3, Z0 + 0.02);
plane(0.85, 1.13, artTex, 1.9, 1.925, Z0 + 0.045);

const glassM = mat('#bfe3ec', { transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1 });
box(0.06, 2.6, 6.8, glassM, 0.6, 0, -7.6).castShadow = false;
box(0.1, 0.06, 6.8, '#1d2228', 0.6, 0, -7.6);
box(0.1, 0.06, 6.8, '#1d2228', 0.6, 2.6, -7.6);

/* ---------- 5. Furniture ---------- */
function officeChair(x, z, rotY, color = '#1f252c', tall = false) {
  const g = group(x, z, rotY);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Group();
    leg.rotation.y = (i * Math.PI * 2) / 5;
    g.add(leg);
    box(0.045, 0.035, 0.3, '#121418', 0, 0.05, 0.15, leg);
    ball(0.032, '#121418', 0, 0.032, 0.29, leg);
  }
  cyl(0.028, 0.4, '#2b3037', 0, 0.06, 0, g);
  box(0.52, 0.08, 0.5, color, 0, 0.46, 0, g);
  box(0.48, tall ? 0.85 : 0.6, 0.07, color, 0, 0.58, -0.27, g);
  for (const s of [-1, 1]) {
    box(0.04, 0.2, 0.04, '#121418', s * 0.27, 0.54, -0.02, g);
    box(0.07, 0.03, 0.26, '#2b3037', s * 0.27, 0.74, -0.02, g);
  }
}
function workDesk(x, z) {
  const g = group(x, z);
  box(1.9, 0.05, 0.85, '#e7e2da', 0, 0.72, 0, g);
  for (const s of [-1, 1]) box(0.05, 0.72, 0.75, '#1a1d22', s * 0.9, 0, 0, g);
  box(0.22, 0.015, 0.16, '#1a1d22', 0, 0.77, -0.2, g);
  box(0.04, 0.32, 0.04, '#1a1d22', 0, 0.77, -0.24, g);
  box(1.05, 0.62, 0.04, '#0e1013', 0, 0.98, -0.22, g);
  const scr = screen(0.99, 0.56, g, 0, 1.29, -0.198);
  box(0.46, 0.02, 0.15, '#2a2f36', 0, 0.77, 0.12, g);
  box(0.07, 0.025, 0.11, '#2a2f36', 0.38, 0.77, 0.13, g);
  cyl(0.045, 0.1, '#f6f4ef', -0.72, 0.77, 0.05, g);
  cyl(0.06, 0.1, '#e9e4dc', 0.75, 0.77, -0.28, g);
  ball(0.09, '#3f7d4e', 0.75, 0.95, -0.28, g);
  officeChair(x, z + 0.88, Math.PI);
  return scr;
}
function diningChair(x, z, rotY) {
  const g = group(x, z, rotY);
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(0.035, 0.46, 0.035, '#1a1d22', lx, 0, lz, g);
  box(0.46, 0.05, 0.46, '#c9a27a', 0, 0.46, 0, g);
  box(0.46, 0.45, 0.035, '#c9a27a', 0, 0.55, -0.21, g);
}
function couch(x, z, rotY, w, color, cushion) {
  const g = group(x, z, rotY);
  for (const [lx, lz] of [[-w / 2 + 0.12, -0.36], [w / 2 - 0.12, -0.36], [-w / 2 + 0.12, 0.36], [w / 2 - 0.12, 0.36]]) cyl(0.03, 0.08, '#111317', lx, 0, lz, g);
  box(w, 0.42, 0.92, color, 0, 0.08, 0, g);
  box(w, 0.5, 0.22, color, 0, 0.5, -0.35, g);
  for (const s of [-1, 1]) box(0.22, 0.3, 0.92, color, s * (w / 2 - 0.11), 0.5, 0, g);
  const cw = (w - 0.44) / 2;
  for (const s of [-1, 1]) {
    box(cw - 0.03, 0.12, 0.68, cushion, (s * cw) / 2, 0.5, 0.08, g);
    box(cw - 0.05, 0.42, 0.14, cushion, (s * cw) / 2, 0.62, -0.18, g);
  }
}
function armchair(x, z, rotY, color, cushion) {
  const g = group(x, z, rotY);
  box(0.95, 0.4, 0.85, color, 0, 0.06, 0, g);
  box(0.95, 0.55, 0.2, color, 0, 0.46, -0.33, g);
  for (const s of [-1, 1]) box(0.16, 0.26, 0.85, color, s * 0.395, 0.46, 0, g);
  box(0.62, 0.1, 0.62, cushion, 0, 0.46, 0.05, g);
}
function plant(x, z, s = 1) {
  cyl(0.22 * s, 0.42 * s, '#e9e4dc', x, 0, z);
  const greens = ['#2f6b3f', '#3f7d4e', '#4f8f5a'];
  for (let i = 0; i < 7; i++) {
    const b = ball(0.18 * s, greens[i % 3], x + (rnd(i + x) - 0.5) * 0.45 * s, (0.6 + rnd(i + z) * 0.6) * s, z + (rnd(i * 2 + x) - 0.5) * 0.45 * s);
    b.scale.y = 1.3;
  }
}
function beanbag(x, z, color) {
  const b = ball(0.7, color, x, 0.36, z);
  b.scale.set(1.15, 0.6, 1.15);
}

// Lounge
box(5.2, 0.012, 4.2, '#25313d', 4.5, 0, -8.6);
box(2.4, 0.45, 0.45, '#1a1d22', 4.5, 0, -10.6);
box(2.7, 1.55, 0.06, '#0a0b0d', 4.5, 1.15, -10.9);
const tvScreen = screen(2.6, 1.46, scene, 4.5, 1.925, -10.865);
box(0.11, 0.42, 0.3, '#f4f5f7', 5.5, 0.45, -10.6);
box(0.115, 0.4, 0.06, '#15171a', 5.5, 0.46, -10.6);
box(1.2, 0.08, 0.1, '#111317', 4.5, 0.45, -10.45);
couch(4.5, -7.75, Math.PI, 3.2, '#2a3846', '#34465a');
cyl(0.25, 0.55, '#1a1d22', 2.1, 0, -7.75);
cyl(0.02, 0.3, '#1a1d22', 2.1, 0.55, -7.75);
put(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 24, 1, true),
  mat('#f4e9d8', { emissive: '#ffd9a8', emissiveIntensity: 0.6, side: THREE.DoubleSide })), 2.1, 0.92, -7.75);

// Gaming station
const rgbMat = mat('#111111', { emissive: '#ff00ff', emissiveIntensity: 1.4 });
const pcScreen = (() => {
  const g = group(10.5, -10.25);
  box(1.6, 0.05, 0.7, '#111317', 0, 0.72, 0, g);
  for (const s of [-1, 1]) box(0.05, 0.72, 0.6, '#111317', s * 0.76, 0, 0, g);
  box(0.2, 0.015, 0.15, '#111317', 0, 0.77, -0.18, g);
  box(0.04, 0.2, 0.04, '#111317', 0, 0.77, -0.2, g);
  box(1.2, 0.6, 0.05, '#0a0b0d', 0, 0.95, -0.18, g);
  const scr = screen(1.14, 0.54, g, 0, 1.25, -0.153);
  box(0.5, 0.02, 0.16, rgbMat, 0, 0.77, 0.08, g);
  box(0.22, 0.5, 0.46, '#0f1114', 0.95, 0, 0, g);
  box(0.01, 0.4, 0.02, rgbMat, 0.84, 0.05, 0.22, g);
  return scr;
})();
officeChair(10.5, -9.37, Math.PI, '#6e1d2a', true);
plane(1.4, 0.91, posterTex, 10.5, 2.1, Z0 + 0.02);

// Treadmill
(() => {
  const g = group(15.8, -9.5, Math.PI);
  box(0.8, 0.18, 1.9, '#1b1e23', 0, 0, 0, g);
  box(0.62, 0.02, 1.7, '#0d0f12', 0, 0.18, 0.05, g);
  for (const s of [-1, 1]) box(0.05, 1.05, 0.05, '#2b3037', s * 0.36, 0.18, 0.85, g);
  box(0.78, 0.06, 0.25, '#2b3037', 0, 1.2, 0.8, g);
  box(0.3, 0.15, 0.02, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.8 }), 0, 1.22, 0.67, g);
})();

// Nap corner
beanbag(13, -5.6, '#2d4f6b');
beanbag(14.7, -6.9, C.navy);

// Whiteboard
(() => {
  const g = group(X0 + 0.05, -4.5, Math.PI / 2);
  box(2.6, 1.45, 0.04, '#cfd3d8', 0, 1.0, 0, g);
  plane(2.5, 1.37, wbTex, 0, 1.725, 0.025, 0, g);
  box(1.2, 0.03, 0.08, '#9aa1a9', 0, 0.98, 0.06, g);
})();

// Library
cyl(1.7, 0.012, '#4a3a30', -15, 0, 5.9);
(() => {
  const shelf = group(X0 + 0.2, 6, Math.PI / 2);
  const wd = '#2a2118';
  box(3.2, 2.4, 0.04, wd, 0, 0, -0.17, shelf);
  for (const s of [-1, 1]) box(0.05, 2.4, 0.38, wd, s * 1.575, 0, 0, shelf);
  for (let r = 0; r < 6; r++) box(3.2, 0.04, 0.38, wd, 0, r * 0.47, 0, shelf);
  const BOOKS = ['#13235c', '#2f6f86', '#a3d4e0', '#7c2d12', '#e9e4dc', '#1f2937', '#b45309', '#3f6212'];
  for (let r = 0; r < 5; r++) {
    let bx = -1.5;
    while (bx < 1.42) {
      const bw = 0.05 + rnd(bx * 31 + r) * 0.06, bh = 0.26 + rnd(bx * 17 + r * 3) * 0.14;
      if (rnd(bx * 7 + r) > 0.92) { bx += 0.18; continue; }
      box(bw, bh, 0.26, BOOKS[Math.floor(rnd(bx * 13 + r * 5) * BOOKS.length)], bx + bw / 2, r * 0.47 + 0.04, 0.02, shelf);
      bx += bw + 0.006;
    }
  }
})();
armchair(-15, 5.6, 0, '#6b4f3a', '#8a6a52');
cyl(0.22, 0.5, '#2a2118', -14.1, 0, 4.9);
cyl(0.04, 0.09, '#f6f4ef', -14.1, 0.5, 4.9);
cyl(0.16, 0.03, '#121418', -16.3, 0, 4.6);
cyl(0.015, 1.55, '#121418', -16.3, 0.03, 4.6);
put(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 24, 1, true),
  mat('#f4e9d8', { emissive: '#ffd9a8', emissiveIntensity: 0.6, side: THREE.DoubleSide })), -16.3, 1.62, 4.6);

// Kitchen + dining
const kitchenFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.4), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35 }));
kitchenFloor.rotation.x = -Math.PI / 2;
kitchenFloor.position.set(-5.6, 0.006, 8.0);
kitchenFloor.receiveShadow = true;
scene.add(kitchenFloor);
box(3.0, 0.9, 1.0, '#e9e6e0', -6, 0, 7.6);
box(3.2, 0.06, 1.1, '#2a2f36', -6, 0.9, 7.6);
box(0.38, 0.46, 0.32, '#1b1e23', -6.6, 0.96, 7.32);
box(0.12, 0.04, 0.04, mat(C.accent, { emissive: C.accent, emissiveIntensity: 1 }), -6.6, 1.3, 7.15);
cyl(0.04, 0.09, '#f6f4ef', -6.6, 0.96, 7.18);
cyl(0.16, 0.07, '#e9e4dc', -5.2, 0.96, 7.6);
for (let i = 0; i < 4; i++) ball(0.045, '#f59e0b', -5.2 + Math.cos(i * 1.6) * 0.07, 1.05, 7.6 + Math.sin(i * 1.6) * 0.07);
for (const x of [-6.8, -5.2]) { cyl(0.025, 0.68, '#9aa1a9', x, 0, 8.55); cyl(0.2, 0.05, '#2a2f36', x, 0.68, 8.55); }
box(0.9, 2.0, 0.75, mat('#d6d9dd', { metalness: 0.6, roughness: 0.3 }), -9.3, 0, 9.5);
box(0.03, 0.6, 0.03, '#9aa1a9', -8.95, 1.1, 9.1);
cyl(0.75, 0.04, '#e7e2da', -2, 0.74, 4.8);
cyl(0.06, 0.74, '#1a1d22', -2, 0, 4.8);
cyl(0.35, 0.03, '#1a1d22', -2, 0, 4.8);
cyl(0.12, 0.07, '#f4f1ea', -2, 0.78, 4.42);
cyl(0.1, 0.02, '#e3b04b', -2, 0.84, 4.42);
diningChair(-2, 3.95, 0);
diningChair(-2, 5.65, Math.PI);
diningChair(-2.85, 4.8, Math.PI / 2);

// Pickleball court
const COURT = { x: 12.25, z: 5.5, len: 9.2, wid: 5.4 };
box(10.8, 0.02, 7.2, '#1d3a36', COURT.x, 0, COURT.z);
box(COURT.len, 0.022, COURT.wid, '#2c6a86', COURT.x, 0, COURT.z);
const lineM = mat('#f2f4f6', { roughness: 0.5 });
const courtLine = (w, d, x, z) => box(w, 0.006, d, lineM, x, 0.022, z);
courtLine(COURT.len, 0.05, COURT.x, COURT.z - COURT.wid / 2);
courtLine(COURT.len, 0.05, COURT.x, COURT.z + COURT.wid / 2);
courtLine(0.05, COURT.wid, COURT.x - COURT.len / 2, COURT.z);
courtLine(0.05, COURT.wid, COURT.x + COURT.len / 2, COURT.z);
const KZ = 1.46, HALF = COURT.len / 2 - KZ;
courtLine(0.05, COURT.wid, COURT.x - KZ, COURT.z);
courtLine(0.05, COURT.wid, COURT.x + KZ, COURT.z);
courtLine(HALF, 0.05, COURT.x - KZ - HALF / 2, COURT.z);
courtLine(HALF, 0.05, COURT.x + KZ + HALF / 2, COURT.z);
for (const s of [-1, 1]) cyl(0.035, 0.95, '#d9dde2', COURT.x, 0, COURT.z + s * (COURT.wid / 2 + 0.3));
const net = plane(COURT.wid + 0.6, 0.78, netTex, COURT.x, 0.52, COURT.z, Math.PI / 2, scene, true);
net.material.side = THREE.DoubleSide;
net.material.alphaTest = 0.2;
box(0.02, 0.06, COURT.wid + 0.6, '#f4f5f7', COURT.x, 0.86, COURT.z);
box(2.4, 0.07, 0.45, '#c9a27a', COURT.x, 0.42, 9.6);
for (const s of [-1, 1]) box(0.06, 0.42, 0.4, '#1a1d22', COURT.x + s * 1.1, 0, 9.6);

// Plants
for (const [x, z, s] of [[-17.3, -10.3, 1.2], [-0.3, -10.3, 1], [7.4, -10.4, 0.9], [17.3, -10.3, 1.2], [-17.3, 10.3, 1.2],
  [-11.5, 10.0, 1], [2.2, 10.0, 1], [17.3, 10.3, 1.2], [1.6, -3.6, 0.9]]) plant(x, z, s);

/* ---------- 6. Activities ---------- */
const ACTIVITIES = [
  { id: 'ps5', where: 'the lounge', label: 'Playing PS5', x: 3.81, z: -7.8, rot: Math.PI, pose: 'sit', seat: 0.62, anim: 'controller',
    via: [[7, AISLE], [7, -8.9], [3.81, -8.9]], min: 60, max: 120, lines: ['One more race.', 'This track is tough.', 'Almost took first place.'] },
  { id: 'ps5b', where: 'the lounge', label: 'Playing PS5', x: 5.19, z: -7.8, rot: Math.PI, pose: 'sit', seat: 0.62, anim: 'controller',
    via: [[7, AISLE], [7, -8.9], [5.19, -8.9]], min: 60, max: 120, lines: ['Co-op time.', 'Cover me.', 'We got this round.'] },
  { id: 'crossfire', where: 'the gaming PC', label: 'Playing Crossfire', x: 10.5, z: -9.37, rot: Math.PI, pose: 'sit', seat: 0.54, anim: 'mouse',
    min: 60, max: 120, lines: ['Headshot.', 'Clutch round.', 'Holding the B site.'] },
  { id: 'treadmill', where: 'the treadmill', label: 'On the treadmill', x: 15.8, z: -9.45, y: 0.2, rot: Math.PI, pose: 'stand', anim: 'run',
    min: 50, max: 90, lines: ['Getting my steps in.', 'Ten more minutes.'] },
  { id: 'nap', where: 'the nap corner', label: 'Taking a nap', x: 13.21, z: -5.39, rot: Math.PI / 4, pose: 'lie', anim: 'sleep',
    min: 80, max: 150, lines: ['zzz...', 'Five more minutes...'] },
  { id: 'read', where: 'the library', label: 'Reading a book', x: -15, z: 5.6, rot: 0, pose: 'sit', seat: 0.56, anim: 'read',
    via: [[-13.4, AISLE], [-13.4, 6.7], [-15, 6.7]], min: 70, max: 130, lines: ['This chapter is good.', 'Learning something new.'] },
  { id: 'coffee', where: 'the kitchen', label: 'Making coffee', x: -6.6, z: 6.68, rot: 0, pose: 'stand', anim: 'barista',
    min: 25, max: 45, lines: ['Kape muna.', 'Fresh brew coming up.'] },
  { id: 'eat', where: 'the dining table', label: 'Having merienda', x: -2, z: 3.95, rot: 0, pose: 'sit', seat: 0.51, anim: 'eat',
    min: 50, max: 90, lines: ['Pancit break.', 'Merienda time.'] },
  { id: 'window', where: 'the window', label: 'Coffee by the window', x: -2.2, z: -10.35, rot: Math.PI, pose: 'stand', anim: 'drink',
    min: 35, max: 60, lines: ['Nice view tonight.', 'Taking a breather.'] },
  { id: 'whiteboard', where: 'the whiteboard', label: 'Planning on the whiteboard', x: -17.4, z: -4.5, rot: -Math.PI / 2, pose: 'stand', anim: 'write',
    min: 45, max: 80, lines: ['Mapping the next workflow.', 'Lead, CRM, booked.'] },
];
const COURT_SPOTS = [
  { id: 'court-a', kind: 'pickleball', label: 'Playing pickleball', x: 8.9, z: COURT.z, rot: Math.PI / 2, pose: 'stand', anim: 'pickleball' },
  { id: 'court-b', kind: 'pickleball', label: 'Playing pickleball', x: 15.6, z: COURT.z, rot: -Math.PI / 2, pose: 'stand', anim: 'pickleball' },
];

/* ---------- 7. Anime characters ---------- */
const toonGrad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, ...o });
const INK = new THREE.MeshBasicMaterial({ color: '#2a1d1d', side: THREE.BackSide });

function drawFace(g, look, state) {
  const cx0 = 256, ey = 288, dx = 86, f = look.type === 'female';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = 'rgba(255,128,140,0.30)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx0 + s * 112, 352, 32, 13, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = look.hair;
  g.lineWidth = f ? 6 : 8;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx0 + s * (dx + 40), 214);
    g.quadraticCurveTo(cx0 + s * dx, 196, cx0 + s * (dx - 34), 206);
    g.stroke();
  }
  for (const s of [-1, 1]) {
    const cx = cx0 + s * dx;
    if (state === 'closed') {
      g.strokeStyle = '#2a1712'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(cx - 42, ey - 2); g.quadraticCurveTo(cx, ey + 22, cx + 42, ey - 2); g.stroke();
      if (f) { g.lineWidth = 5; g.beginPath(); g.moveTo(cx + s * 42, ey - 2); g.lineTo(cx + s * 54, ey - 10); g.stroke(); }
      continue;
    }
    const top = ey - (f ? 58 : 50), bot = ey + (f ? 58 : 48);
    const almond = new Path2D();
    almond.moveTo(cx - 44, ey - 16);
    almond.quadraticCurveTo(cx, top, cx + 44, ey - 18);
    almond.quadraticCurveTo(cx + 4, bot, cx - 44, ey - 16);
    g.save();
    g.fillStyle = '#fbfbff';
    g.fill(almond);
    g.clip(almond);
    const ir = g.createLinearGradient(0, ey - 40, 0, ey + 44);
    ir.addColorStop(0, look.eyes[0]);
    ir.addColorStop(1, look.eyes[1]);
    g.fillStyle = ir;
    g.beginPath(); g.ellipse(cx + s * 3, ey + 6, f ? 29 : 26, f ? 40 : 36, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(20,10,30,.9)';
    g.beginPath(); g.ellipse(cx + s * 3, ey + 8, 12, 19, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.arc(cx - 10 + s * 3, ey - 10, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 12 + s * 3, ey + 22, 4.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(cx - 50, ey - 60, 100, 26);
    g.restore();
    g.strokeStyle = '#21130f';
    g.lineWidth = f ? 12 : 10;
    g.beginPath(); g.moveTo(cx - 46, ey - 14); g.quadraticCurveTo(cx, top - 2, cx + 46, ey - 16); g.stroke();
    g.lineWidth = f ? 7 : 5;
    g.beginPath(); g.moveTo(cx + s * 44, ey - 16); g.lineTo(cx + s * (f ? 60 : 54), ey - (f ? 30 : 24)); g.stroke();
    if (f) { g.beginPath(); g.moveTo(cx + s * 34, ey - 34); g.lineTo(cx + s * 46, ey - 46); g.stroke(); }
    g.strokeStyle = 'rgba(70,35,30,.55)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - 24, ey + (f ? 46 : 40)); g.quadraticCurveTo(cx + 2, ey + (f ? 54 : 46), cx + 26, ey + (f ? 44 : 38)); g.stroke();
  }
  g.strokeStyle = 'rgba(160,95,85,.55)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(260, 352); g.lineTo(253, 364); g.stroke();
  if (state === 'talk') {
    g.fillStyle = '#7a2a30'; g.beginPath(); g.ellipse(256, 414, 15, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e58a8f'; g.beginPath(); g.ellipse(256, 420, 9, 4, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.strokeStyle = '#a24a4a'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(240, 410); g.quadraticCurveTo(256, 420, 272, 410); g.stroke();
  }
}

function makeCharacter(look) {
  const female = look.type === 'female';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinM = toon(look.skin);
  const hairM = toon(look.hair);
  const shirtM = toon(look.shirt || '#f6f7f9');
  const pantsM = toon(look.pants || '#121418');
  const dressM = toon(look.dress || C.navy, { side: THREE.DoubleSide });
  const shoeM = toon('#15161a');

  const part = (geo, m, parent, x = 0, y = 0, z = 0, ol = 0.05) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    if (ol) {
      const o = new THREE.Mesh(geo, INK);
      o.scale.setScalar(1 + ol);
      mesh.add(o);
    }
    parent.add(mesh);
    return mesh;
  };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);

  // Legs
  const legM = female ? skinM : pantsM;
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(0.1 * s, 0.9, 0); body.add(hip);
    part(cap(female ? 0.072 : 0.082, 0.28), legM, hip, 0, -0.22, 0, 0.07);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    part(cap(female ? 0.056 : 0.068, 0.3), legM, knee, 0, -0.21, 0, 0.08);
    part(new THREE.BoxGeometry(female ? 0.085 : 0.11, 0.07, female ? 0.22 : 0.27), shoeM, knee, 0, -0.42, 0.05, 0.06);
    return { hip, knee };
  });

  // Torso + outfit
  part(cap(0.18, 0.36), female ? dressM : shirtM, body, 0, 1.2, 0, 0.04).scale.set(1.1, 1, 0.8);
  let skirt = null;
  if (female) {
    skirt = part(new THREE.CylinderGeometry(0.19, 0.35, 0.56, 32, 1, true), dressM, body, 0, 0.67, 0, 0);
    part(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 32), toon(C.accent), body, 0, 0.95, 0, 0).scale.set(1.08, 1, 0.84);
  } else {
    part(cap(0.16, 0.08), pantsM, body, 0, 0.9, 0, 0.04).scale.set(1.1, 1, 0.84);
    part(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 32), toon('#0d0e10'), body, 0, 0.95, 0, 0).scale.set(1.08, 1, 0.84);
    part(new THREE.BoxGeometry(0.05, 0.035, 0.02), toon('#c9ccd1'), body, 0, 0.95, 0.16, 0);
    for (const s of [-1, 1]) {
      part(new THREE.BoxGeometry(0.08, 0.05, 0.02), shirtM, body, 0.045 * s, 1.53, 0.1, 0).rotation.z = 0.5 * s;
    }
    const tieM = toon(look.tie || C.navy);
    part(new THREE.BoxGeometry(0.05, 0.045, 0.03), tieM, body, 0, 1.5, 0.12, 0.08);
    part(new THREE.BoxGeometry(0.065, 0.4, 0.015), tieM, body, 0, 1.27, 0.152, 0.06).rotation.x = -0.1;
  }

  // Neck + head (slightly larger, anime proportions)
  part(cap(0.052, 0.08), skinM, body, 0, 1.63, 0, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.66, 0);
  head.scale.setScalar(1.12);
  body.add(head);
  const skull = part(new THREE.SphereGeometry(0.16, 40, 30), skinM, head, 0, 0.13, 0, 0.035);
  skull.scale.set(0.92, 1.1, 0.96);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.033, 12, 10), skinM, head, 0.142 * s, 0.12, -0.01, 0).scale.set(0.45, 1, 0.75);

  // Painted anime face (open / closed / talking)
  const faceTex = {};
  for (const st of ['open', 'closed', 'talk']) faceTex[st] = canvasTex(512, 512, (g) => drawFace(g, look, st));
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex.open, transparent: true, depthWrite: false });
  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.162, 40, 30, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.75, 1.5), faceMat);
  facePatch.position.copy(skull.position);
  facePatch.scale.copy(skull.scale);
  head.add(facePatch);

  // Hair
  const strand = (ang, by, bz, len, r, rx, rz = 0) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = ang;
    head.add(pivot);
    const m = part(new THREE.ConeGeometry(r, len, 10), hairM, pivot,
      0, by + (Math.cos(rx) * len) / 2, bz + (Math.sin(rx) * len) / 2, 0.06);
    m.rotation.set(rx, 0, rz);
    return m;
  };
  const hcap = part(new THREE.SphereGeometry(0.172, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairM, head, 0, 0.135, -0.004, 0.03);
  hcap.scale.set(0.96, 1.12, 1.03);
  hcap.rotation.x = -0.35;

  if (female) {
    [-0.62, -0.36, -0.12, 0.12, 0.36, 0.62].forEach((a, i) => strand(a, 0.27, 0.105, 0.1 + (i % 2) * 0.02, 0.045, Math.PI - 0.6));
    for (const s of [-1, 1]) part(cap(0.035, 0.3), hairM, head, 0.13 * s, 0.0, 0.05, 0.06).rotation.z = 0.08 * s;
    part(cap(0.15, 0.36), hairM, head, 0, -0.07, -0.085, 0.03).scale.set(1.18, 1, 0.55);
    const bow = part(new THREE.BoxGeometry(0.1, 0.045, 0.03), toon(look.ribbon || C.accent), head, 0.11, 0.27, -0.05, 0.1);
    bow.rotation.z = 0.4;
  } else if (look.style === 'quiff') {
    [-0.35, 0, 0.35].forEach((a) => strand(a, 0.27, 0.08, 0.14, 0.06, 0.55));
    [-0.7, -0.2, 0.3, 0.8].forEach((a) => strand(a, 0.29, -0.02, 0.13, 0.055, -0.9));
    for (const s of [-1, 1]) strand(1.2 * s, 0.2, 0.1, 0.1, 0.04, Math.PI - 0.3);
  } else {
    [-0.5, -0.2, 0.1, 0.4].forEach((a) => strand(a, 0.27, 0.105, 0.1, 0.045, Math.PI - 0.55));
    for (let i = 0; i < 8; i++) strand(-2.6 + i * 0.75, 0.28, 0.0, 0.13, 0.05, -0.5 - rnd(i + 3) * 0.6, (rnd(i) - 0.5) * 0.6);
    for (const s of [-1, 1]) strand(1.25 * s, 0.2, 0.1, 0.1, 0.04, Math.PI - 0.35);
  }

  // Arms
  const sleeveM = female ? skinM : shirtM;
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(0.255 * s, 1.47, 0); body.add(sh);
    part(new THREE.SphereGeometry(0.064, 16, 12), female ? dressM : shirtM, sh, 0, 0, 0, 0.05);
    part(cap(0.05, 0.2), sleeveM, sh, 0, -0.15, 0, 0.08);
    if (female) part(new THREE.CylinderGeometry(0.062, 0.066, 0.11, 16), dressM, sh, 0, -0.05, 0, 0.05);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    part(cap(0.043, 0.18), sleeveM, el, 0, -0.13, 0, 0.09);
    if (!female) part(new THREE.CylinderGeometry(0.047, 0.047, 0.035, 14), shirtM, el, 0, -0.235, 0, 0.06);
    part(new THREE.SphereGeometry(0.046, 14, 10), skinM, el, 0, -0.29, 0, 0.08).scale.set(0.8, 1.15, 0.6);
    return { sh, el };
  });

  // Props
  const hand = arms[1].el;
  const controller = part(new THREE.BoxGeometry(0.19, 0.045, 0.1), toon('#1d2430'), body, 0, 1.13, 0.38, 0.06);
  const cup = part(new THREE.CylinderGeometry(0.042, 0.037, 0.1, 18), toon('#f6f4ef'), hand, 0, -0.33, 0.05, 0.06);
  const marker = part(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 8), toon(C.navy), hand, 0, -0.32, 0.03, 0);
  const book = new THREE.Group(); book.position.set(0, 1.12, 0.36); book.rotation.x = -2.45; body.add(book);
  part(new THREE.BoxGeometry(0.26, 0.34, 0.02), toon(C.navy), book, 0, 0, 0, 0.04);
  part(new THREE.BoxGeometry(0.24, 0.32, 0.03), toon('#f3efe6'), book, 0, 0, 0.012, 0);
  const paddle = new THREE.Group(); paddle.position.y = -0.3; paddle.rotation.y = Math.PI / 2; hand.add(paddle);
  part(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 10), toon('#111111'), paddle, 0, -0.06, 0, 0);
  const paddleFace = part(new THREE.BoxGeometry(0.19, 0.24, 0.016), toon(C.navy), paddle, 0, -0.24, 0, 0.05);

  // Plumbob + label
  const plumbob = new THREE.Mesh(new THREE.OctahedronGeometry(0.085),
    new THREE.MeshStandardMaterial({ color: C.idle, emissive: C.idle, emissiveIntensity: 0.8, roughness: 0.25, transparent: true, opacity: 0.9 }));
  plumbob.scale.y = 1.8;
  root.add(plumbob);
  const div = document.createElement('div');
  div.className = 'label3d';
  div.innerHTML = '<div class="bubble"></div><div class="name"></div>';
  const label = new CSS2DObject(div);
  root.add(label);

  return { root, body, head, legs, arms, skirt, controller, cup, marker, book, paddle, paddleFace, plumbob, label,
    face: { mat: faceMat, tex: faceTex, current: 'open' },
    bubble: div.querySelector('.bubble'), name: div.querySelector('.name') };
}

/* Anime portrait for the team panel (SVG) */
function avatarSVG(id, look) {
  const f = look.type === 'female';
  const hair = look.hair, skin = look.skin, [e1, e2] = look.eyes;
  const eye = (cx) => `
    <clipPath id="${id}c${cx}"><path d="M${cx - 6.5} 49.5 Q${cx} 43 ${cx + 6.5} 49.3 Q${cx} 57 ${cx - 6.5} 49.5Z"/></clipPath>
    <path d="M${cx - 6.5} 49.5 Q${cx} 43 ${cx + 6.5} 49.3 Q${cx} 57 ${cx - 6.5} 49.5Z" fill="#fbfbff"/>
    <g clip-path="url(#${id}c${cx})">
      <ellipse cx="${cx}" cy="50.6" rx="${f ? 4.5 : 4.1}" ry="${f ? 5.6 : 5.1}" fill="url(#${id}ir)"/>
      <ellipse cx="${cx}" cy="51" rx="1.9" ry="2.8" fill="#1b1020"/>
      <circle cx="${cx - 1.6}" cy="48" r="1.5" fill="#fff"/>
      <circle cx="${cx + 1.8}" cy="52.8" r="0.8" fill="#fff"/>
    </g>
    <path d="M${cx - 7} 49 Q${cx} 41.6 ${cx + 7} 48.8" fill="none" stroke="#21130f" stroke-width="${f ? 2.2 : 1.8}" stroke-linecap="round"/>`;
  const back = f
    ? `<path d="M27 46 Q24 18 50 17 Q76 18 73 46 L78 92 Q64 86 62 74 L38 74 Q36 86 22 92 Z" fill="${hair}"/>`
    : '';
  const front = f
    ? `<path d="M29 45 Q28 20 50 19 Q72 20 71 45 L68 41 Q66 33 61 31 Q60 38 56 41 Q55 33 50 30 Q47 36 43 41 Q41 34 38 31 Q34 36 33 42 Z" fill="${hair}"/>
       <path d="M29 44 Q27 58 30 70 L33 69 Q31 57 33 45 Z M71 44 Q73 58 70 70 L67 69 Q69 57 67 45 Z" fill="${hair}"/>
       <path d="M64 27 L70 23 L71 30 Z M64 27 L59 22 L58 29 Z" fill="${look.ribbon || C.accent}"/>`
    : look.style === 'quiff'
      ? `<path d="M30 47 Q27 25 40 19 Q46 9 58 11 Q66 12 64 18 Q72 22 70 47 L67 39 Q64 31 57 30 Q52 27 45 30 Q37 32 33 40 Z" fill="${hair}"/>`
      : `<path d="M29 47 Q26 22 44 17 L42 12 L50 16 L56 10 L58 17 Q74 20 71 47 L68 40 L64 34 L60 40 L56 33 L51 39 L46 32 L42 39 L37 34 L33 41 Z" fill="${hair}"/>`;
  const outfit = f
    ? `<path d="M14 100 Q16 80 34 76 L66 76 Q84 80 86 100 Z" fill="${look.dress || C.navy}"/>
       <path d="M42 76 Q50 87 58 76 Z" fill="${skin}"/>`
    : `<path d="M14 100 Q16 80 34 76 L66 76 Q84 80 86 100 Z" fill="${look.shirt || '#f6f7f9'}"/>
       <path d="M42 76 L50 85 L58 76" fill="none" stroke="#c9ced5" stroke-width="1.2"/>
       <path d="M48.2 80 L51.8 80 L53.5 100 L46.5 100 Z" fill="${look.tie || C.navy}"/>
       <rect x="47.6" y="77.5" width="4.8" height="3.4" rx="1" fill="${look.tie || C.navy}"/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a2a44"/><stop offset="1" stop-color="#0d1420"/></linearGradient>
      <linearGradient id="${id}ir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e1}"/><stop offset="1" stop-color="${e2}"/></linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#${id}bg)"/>
    ${back}
    ${outfit}
    <rect x="45" y="64" width="10" height="13" fill="${skin}"/>
    <ellipse cx="31" cy="51" rx="2.4" ry="4" fill="${skin}"/>
    <ellipse cx="69" cy="51" rx="2.4" ry="4" fill="${skin}"/>
    <path d="M31 46 Q31 24 50 24 Q69 24 69 46 Q69 62 50 71 Q31 62 31 46Z" fill="${skin}"/>
    <ellipse cx="38.5" cy="57.5" rx="3.6" ry="1.5" fill="#ff8a95" opacity=".35"/>
    <ellipse cx="61.5" cy="57.5" rx="3.6" ry="1.5" fill="#ff8a95" opacity=".35"/>
    ${eye(42)}${eye(58)}
    <path d="M36.5 42.5 Q41 40 45.5 41.5 M54.5 41.5 Q59 40 63.5 42.5" fill="none" stroke="${hair}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M50.6 56 L49.6 57.8" stroke="rgba(150,90,80,.7)" stroke-width=".9" stroke-linecap="round"/>
    <path d="M47.5 62.5 Q50 64 52.5 62.5" fill="none" stroke="#9a4a48" stroke-width="1.1" stroke-linecap="round"/>
    ${front}
  </svg>`;
}

/* ---------- 8. Agent brain ---------- */
const WALK = 1.35, ACCEL = 1.8, DECEL = 1.6;
const game = { active: false, ready: false, players: [], end: 0 };

class Agent {
  constructor(cfg) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.c = makeCharacter(cfg.look);
    this.c.name.textContent = cfg.name.toUpperCase();
    scene.add(this.c.root);
    this.screen = workDesk(cfg.desk, -9.2);
    this.deskSpot = { id: 'desk-' + cfg.id, where: 'their desk', label: 'At their desk', x: cfg.desk, z: -8.32, rot: Math.PI,
      pose: 'sit', seat: 0.54, anim: 'browse', min: 40, max: 80,
      lines: ['Clearing my inbox.', "Reviewing yesterday's notes.", 'Quick check on the CRM.'] };
    this.spot = this.act = this.deskSpot;
    this.pose = 'sit';
    this.anim = 'browse';
    this.c.root.position.set(this.spot.x, 0, this.spot.z);
    this.c.root.rotation.y = Math.PI;
    this.state = 'idle';
    this.path = [];
    this.moving = false;
    this.speed = 0;
    this.phase = 0;
    this.t = Math.random() * 10;
    this.actStart = 0;
    this.actDur = rand(8, 20);
    this.nextChat = rand(25, 40);
    this.latV = 0;
    this.swingT = 0;
    this.courtZ = COURT.z;
    this.blinkAt = rand(2, 5);
    this.talkUntil = 0;
    this.c.root.traverse((o) => (o.userData.agent = this));
  }
  say(text, ms = 4500) {
    this.c.bubble.textContent = text;
    this.c.bubble.classList.add('show');
    this.talkUntil = NOW + Math.min(2.6, 0.5 + text.length * 0.05);
    clearTimeout(this.sayT);
    if (ms) this.sayT = setTimeout(() => this.c.bubble.classList.remove('show'), ms);
  }
  mood(color) {
    this.c.plumbob.material.color.set(color);
    this.c.plumbob.material.emissive.set(color);
  }
  setPanel(text, cls = '') {
    if (!this.panel) return;
    this.panel.querySelector('.st em').textContent = text;
    this.panel.className = `member ${cls}${follow === this ? ' focused' : ''}`;
  }
  goTo(spot) {
    const p = this.c.root.position;
    p.y = 0;
    const out = !this.moving && this.spot?.via ? [...this.spot.via].reverse() : [[p.x, AISLE]];
    const inn = spot.via ?? [[spot.x, AISLE]];
    this.path = [...out, ...inn, [spot.x, spot.z]].map(([x, z]) => new THREE.Vector2(x, z));
    this.spot = spot;
    this.moving = true;
    return new Promise((res) => (this.arrive = res));
  }
  chooseNext() {
    if (this.state !== 'idle' || this.moving) return;
    if (!game.active && Math.random() < 0.3) {
      const partner = agents.find((o) => o !== this && o.state === 'idle' && !o.moving && o.act && o.act.kind !== 'pickleball' && NOW - o.actStart > 20);
      if (partner) return startPickleball(this, partner);
    }
    const taken = new Set(agents.filter((o) => o !== this).map((o) => o.spot?.id));
    const pool = [...ACTIVITIES, this.deskSpot].filter((s) => !taken.has(s.id) && s.id !== this.act?.id);
    this.doActivity(pick(pool));
  }
  async doActivity(spot) {
    this.act = spot;
    this.mood(C.idle);
    this.setPanel('Heading to ' + spot.where);
    if (spot === this.deskSpot) this.deskSpot.anim = 'browse';
    await this.goTo(spot);
    if (this.state !== 'idle' || this.spot !== spot) return;
    this.actStart = NOW;
    this.actDur = rand(spot.min, spot.max);
    this.nextChat = NOW + rand(22, 40);
    this.setPanel(spot.label);
    if (Math.random() < 0.7) this.say(pick(spot.lines));
  }
  async startWork(msg) {
    if (game.players.includes(this)) endGame();
    this.state = 'working';
    this.act = this.deskSpot;
    this.mood(C.work);
    this.setPanel('Working', 'working');
    this.say('On it.', 2000);
    this.deskSpot.anim = 'type';
    if (this.spot === this.deskSpot && !this.moving) { this.pose = 'sit'; this.anim = 'type'; }
    else await this.goTo(this.deskSpot);
    if (this.state === 'working') this.say(msg, 0);
  }
  endWork(text, error = false) {
    this.state = 'idle';
    this.deskSpot.anim = 'browse';
    if (!this.moving && this.spot === this.deskSpot) this.anim = 'browse';
    this.act = this.deskSpot;
    this.actStart = NOW;
    this.actDur = rand(20, 40);
    this.mood(error ? C.err : C.ok);
    setTimeout(() => { if (this.state === 'idle') this.mood(C.idle); }, 8000);
    this.setPanel(error ? 'Hit a problem' : 'Finished', error ? 'error' : 'done');
    this.say(text, 6000);
  }
  courtStep(dt) {
    const r = this.c.root;
    const target = game.ready && game.players.includes(this) ? this.courtZ : this.spot.z;
    const v = THREE.MathUtils.clamp((target - r.position.z) * 4, -2.6, 2.6);
    this.latV = THREE.MathUtils.lerp(this.latV, v, Math.min(1, dt * 8));
    r.position.z += this.latV * dt;
  }
  update(dt) {
    const r = this.c.root;
    if (this.swingT > 0) this.swingT -= dt;
    if (this.moving) {
      const tgt = this.path[0];
      const dx = tgt.x - r.position.x, dz = tgt.y - r.position.z, d = Math.hypot(dx, dz);
      let remain = d;
      for (let i = 1; i < this.path.length; i++) remain += this.path[i].distanceTo(this.path[i - 1]);
      const vmax = Math.min(WALK, Math.sqrt(2 * DECEL * remain) + 0.2);
      this.speed = Math.min(vmax, this.speed + ACCEL * dt);
      if (d < 0.03) {
        this.path.shift();
        if (!this.path.length) {
          this.moving = false;
          this.speed = 0;
          r.position.set(this.spot.x, this.spot.y ?? 0, this.spot.z);
          this.pose = this.spot.pose;
          this.anim = this.spot.anim;
          this.arrive?.();
        }
      } else {
        const s = Math.min(d, this.speed * dt);
        r.position.x += (dx / d) * s;
        r.position.z += (dz / d) * s;
        turn(r, Math.atan2(dx, dz), Math.min(1, dt * 7));
      }
      this.phase += dt * this.speed * 5.4;
    } else {
      if (this.spot) turn(r, this.spot.rot, Math.min(1, dt * 5));
      if (this.anim === 'run') this.phase += dt * 9;
      if (this.anim === 'pickleball') this.courtStep(dt);
      if (this.state === 'idle' && this.act && this.act.kind !== 'pickleball') {
        if (NOW - this.actStart > this.actDur) this.chooseNext();
        else if (NOW > this.nextChat) {
          this.nextChat = NOW + rand(22, 40);
          if (Math.random() < 0.45) this.say(pick(this.act.lines));
        }
      }
    }
    this.animate(dt);
  }
  animate(dt) {
    const c = this.c;
    const t = (this.t += dt);
    const pose = this.moving ? 'stand' : this.pose;
    const anim = this.moving ? 'walk' : this.anim;
    let hipY = 0.9, rx = 0, ry = 0, rz = 0, headX = 0, headY = 0;
    let hip = [0, 0], knee = [0, 0], sh = [0.05, 0.05], el = [-0.12, -0.12], shZ = [-0.06, 0.06];
    if (pose === 'sit') { hipY = (this.spot?.seat ?? 0.54) + 0.08; sh = [-0.25, -0.25]; el = [-0.75, -0.75]; }
    if (pose === 'lie') { hipY = 0.72; rx = -1.15; sh = [-0.25, -0.25]; el = [-1.0, -1.0]; headX = 0.35; }

    switch (anim) {
      case 'walk':
      case 'run': {
        const s = Math.sin(this.phase), run = anim === 'run';
        const amp = run ? 0.55 : 0.45;
        hip = [s * amp, -s * amp];
        knee = [Math.max(0, -s) * (run ? 1.2 : 0.9), Math.max(0, s) * (run ? 1.2 : 0.9)];
        sh = [-s * 0.35, s * 0.35];
        el = run ? [-1.2, -1.2] : [-0.25, -0.25];
        hipY += Math.abs(Math.cos(this.phase)) * (run ? 0.05 : 0.03);
        rx = run ? 0.08 : 0;
        break;
      }
      case 'browse':
        sh = [-0.35, -0.45]; el = [-1.15, -1.2 + Math.sin(t * 3) * 0.04]; rx = 0.06; headX = 0.12; headY = Math.sin(t * 0.4) * 0.15;
        break;
      case 'type':
        sh = [-0.45, -0.45]; el = [-1.25 + Math.sin(t * 22) * 0.08, -1.25 + Math.cos(t * 19) * 0.08]; rx = 0.12; headX = 0.15;
        break;
      case 'controller':
        sh = [-0.55, -0.55]; el = [-1.35 + Math.sin(t * 12) * 0.05, -1.35 + Math.sin(t * 15) * 0.05];
        rz = Math.sin(t * 1.8) * 0.05; rx = 0.1; headX = 0.05;
        break;
      case 'mouse':
        sh = [-0.45, -0.5]; el = [-1.25, -1.2 + Math.sin(t * 25) * 0.08]; rx = 0.15; headX = 0.08;
        break;
      case 'eat': {
        const p = Math.pow((Math.sin(t * 1.4) + 1) / 2, 3);
        sh = [-0.4, -0.35 - p * 0.55]; el = [-0.9, -0.8 - p * 1.5]; rx = 0.12; headX = 0.15;
        break;
      }
      case 'drink': {
        const p = Math.pow(Math.max(0, Math.sin(t * 0.6)), 4);
        sh = [0.05, -0.35 - p * 0.45]; el = [-0.12, -1.3 - p * 0.85]; headX = -p * 0.25;
        break;
      }
      case 'barista':
        sh = [-0.8, -0.85]; el = [-0.5 + Math.sin(t * 1.5) * 0.15, -0.45]; headX = 0.25; rx = 0.05;
        break;
      case 'read':
        sh = [-0.5, -0.5]; el = [-1.4, -1.4]; headX = 0.35; rx = 0.05;
        break;
      case 'write':
        sh = [0.05, -1.75 + Math.sin(t * 2.2) * 0.1]; el = [-0.12, -0.35 + Math.cos(t * 2.2) * 0.1];
        shZ = [-0.06, 0.15 + Math.sin(t * 1.1) * 0.12]; headX = -0.1;
        break;
      case 'sleep':
        hipY += Math.sin(t * 1.1) * 0.008; headX = 0.35 + Math.sin(t * 0.3) * 0.03;
        break;
      case 'pickleball': {
        hipY = 0.84 + Math.sin(t * 4) * 0.008; hip = [-0.35, -0.35]; knee = [0.6, 0.6]; rx = 0.15;
        sh = [-0.4, -0.55]; el = [-0.9, -0.7];
        if (Math.abs(this.latV) > 0.2) {
          const s = Math.sin(t * 14);
          hip = [-0.35 + s * 0.2, -0.35 - s * 0.2];
          knee = [0.6 + Math.max(0, s) * 0.3, 0.6 + Math.max(0, -s) * 0.3];
        }
        if (this.swingT > 0) {
          const p = 1 - this.swingT / 0.35;
          sh[1] = 0.6 - p * 2.0; el[1] = -0.5 + p * 0.2; ry = 0.5 - p * 1.0;
        }
        break;
      }
      default:
        if (pose === 'stand') { hipY += Math.sin(t * 1.6) * 0.005; headY = Math.sin(t * 0.3) * 0.2; }
    }
    if (pose === 'sit' || pose === 'lie') {
      const h = -Math.PI / 2 - rx, k = pose === 'lie' ? 1.25 : Math.PI / 2;
      hip = [h, h]; knee = [k, k];
    }

    c.legs.forEach((l, i) => { l.hip.rotation.x = hip[i]; l.knee.rotation.x = knee[i]; });
    c.arms.forEach((a, i) => { a.sh.rotation.x = sh[i]; a.el.rotation.x = el[i]; a.sh.rotation.z = shZ[i]; });
    c.body.rotation.set(rx, ry, rz);
    c.body.position.set(0, hipY - 0.9 * Math.cos(rx), -0.9 * Math.sin(rx));
    const k = Math.min(1, dt * 4);
    c.head.rotation.x += (headX - c.head.rotation.x) * k;
    c.head.rotation.y += (headY - c.head.rotation.y) * k;
    if (c.skirt) {
      const target = pose === 'stand' ? 1 : 0.42;
      c.skirt.scale.y += (target - c.skirt.scale.y) * Math.min(1, dt * 8);
      c.skirt.position.y = 0.95 - 0.28 * c.skirt.scale.y;
    }

    // Face: blink, talk, sleep
    let face = 'open';
    if (anim === 'sleep') face = 'closed';
    else {
      if (NOW > this.blinkAt) {
        if (NOW > this.blinkAt + 0.13) this.blinkAt = NOW + rand(2.5, 5.5);
        else face = 'closed';
      }
      if (face === 'open' && NOW < this.talkUntil && Math.floor(NOW * 7) % 2 === 0) face = 'talk';
    }
    if (c.face.current !== face) {
      c.face.mat.map = c.face.tex[face];
      c.face.current = face;
    }

    const still = this.moving ? null : this.anim;
    c.controller.visible = still === 'controller';
    c.cup.visible = still === 'drink';
    c.book.visible = still === 'read';
    c.marker.visible = still === 'write';
    c.paddle.visible = still === 'pickleball' || (this.moving && this.spot?.kind === 'pickleball');
    const top = pose === 'lie' ? 1.5 : pose === 'sit' ? 2.2 : 2.5;
    c.plumbob.position.y = top + Math.sin(t * 2.5) * 0.04;
    c.plumbob.rotation.y += dt * 1.6;
    c.label.position.y = top + 0.45;
  }
}

/* ---------- 9. Pickleball ---------- */
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mat('#e6f04a', { roughness: 0.6 }));
ballMesh.castShadow = true;
ballMesh.visible = false;
scene.add(ballMesh);
const rally = { from: 0, t: 0, dur: 1.3, a: new THREE.Vector3(), land: new THREE.Vector3(), b: new THREE.Vector3(),
  hits: 0, max: 6, pause: 0, swung: false, last: false };

function startPickleball(a, b) {
  game.active = true;
  game.ready = false;
  game.players = [a, b];
  [a, b].forEach((p, i) => {
    p.act = COURT_SPOTS[i];
    p.mood(C.idle);
    p.setPanel('Heading to the court');
    p.goTo(COURT_SPOTS[i]).then(checkReady);
  });
  a.say("Pickleball? Let's play.", 3500);
  setTimeout(() => { if (game.players.includes(b)) b.say("You're on.", 3000); }, 1500);
}
function checkReady() {
  if (!game.active || game.ready) return;
  if (game.players.every((p) => p.state === 'idle' && !p.moving && p.spot?.kind === 'pickleball')) {
    game.ready = true;
    game.end = NOW + rand(70, 120);
    game.players.forEach((p) => { p.actStart = NOW; p.setPanel('Playing pickleball'); p.courtZ = COURT.z; });
    rally.pause = 1.5;
    rally.from = 0;
  }
}
function endGame() {
  if (!game.active) return;
  const ps = game.players;
  game.active = false;
  game.ready = false;
  game.players = [];
  ballMesh.visible = false;
  ps.forEach((p, i) => {
    if (p.state !== 'idle') return;
    p.act = null;
    p.say(pick(['Good game.', 'Rematch later?', 'That was fun.']), 3500);
    setTimeout(() => { if (p.state === 'idle' && !p.moving && p.spot?.kind === 'pickleball') p.chooseNext(); }, 3000 + i * 2500);
  });
}
function serve() {
  const hitter = game.players[rally.from], recv = game.players[1 - rally.from];
  hitter.c.paddleFace.getWorldPosition(rally.a);
  rally.a.y = Math.max(rally.a.y, 0.7);
  const dir = recv.spot.x < COURT.x ? 1 : -1;
  recv.courtZ = COURT.z + rand(-1.6, 1.6);
  rally.last = rally.hits >= rally.max;
  if (rally.last) rally.b.set(recv.spot.x - dir * 1.4, 0.05, recv.courtZ + rand(-1, 1));
  else rally.b.set(recv.spot.x + dir * 0.4, 0.95, recv.courtZ - dir * 0.3);
  rally.land.lerpVectors(rally.a, rally.b, rally.last ? 0.62 : 0.74);
  rally.land.y = 0.05;
  rally.t = 0;
  rally.dur = rand(1.15, 1.5);
  rally.swung = false;
  hitter.swingT = 0.35;
  ballMesh.visible = true;
}
function updateBall(dt) {
  if (!game.ready) return;
  if (rally.pause > 0) {
    rally.pause -= dt;
    if (rally.pause <= 0) {
      if (NOW > game.end) return endGame();
      rally.hits = 0;
      rally.max = 3 + Math.floor(Math.random() * 9);
      rally.from = Math.random() < 0.5 ? 0 : 1;
      serve();
    }
    return;
  }
  rally.t += dt / rally.dur;
  const u = Math.min(rally.t, 1), k = rally.last ? 0.62 : 0.74;
  if (u < k) {
    const s = u / k;
    ballMesh.position.lerpVectors(rally.a, rally.land, s);
    ballMesh.position.y = THREE.MathUtils.lerp(rally.a.y, 0.05, s) + 4 * s * (1 - s);
  } else {
    const s = (u - k) / (1 - k);
    ballMesh.position.lerpVectors(rally.land, rally.b, s);
    ballMesh.position.y = THREE.MathUtils.lerp(0.05, rally.b.y, s) + 0.35 * 4 * s * (1 - s);
  }
  const recv = game.players[1 - rally.from];
  if (!rally.swung && u > 0.84) {
    rally.swung = true;
    if (!rally.last || Math.random() < 0.5) recv.swingT = 0.35;
  }
  if (u >= 1) {
    if (!rally.last) {
      rally.hits++;
      rally.from = 1 - rally.from;
      serve();
    } else {
      rally.pause = 2.6;
      game.players.forEach((p) => (p.courtZ = COURT.z));
      if (Math.random() < 0.6) pick(game.players).say(pick(['Nice shot.', 'Out!', 'So close.', 'Point.', 'Good rally.']), 2500);
    }
  }
}

/* ---------- 10. The team ---------- */
const AGENT_CFG = [
  { id: 'transcriber', name: 'Aira', role: 'Transcriber', task: 'TRANSCRIBING', desk: -14,
    look: { type: 'female', skin: '#f6dccb', hair: '#3b2320', eyes: ['#3a2a6b', '#9a86ea'], dress: C.navy, ribbon: C.accent } },
  { id: 'summarizer', name: 'Joshua', role: 'Summarizer', task: 'SUMMARIZING', desk: -10,
    look: { type: 'male', style: 'quiff', skin: '#f1d2bc', hair: '#15121a', eyes: ['#14213f', '#5b8fd6'],
      shirt: '#f6f7f9', pants: '#121418', tie: C.navy } },
  { id: 'slides', name: 'Jojo', role: 'Slide designer', task: 'BUILDING SLIDES', desk: -6,
    look: { type: 'male', style: 'messy', skin: '#efcfb6', hair: '#5a3a26', eyes: ['#3b2414', '#d29a52'],
      shirt: '#f6f7f9', pants: '#121418', tie: '#2f6f86' } },
];
const agents = AGENT_CFG.map((cfg) => new Agent(cfg));
const byId = Object.fromEntries(agents.map((a) => [a.id, a]));

const teamEl = document.getElementById('team');
agents.forEach((a, i) => {
  const b = document.createElement('button');
  b.className = 'member';
  b.innerHTML = `<span class="av">${avatarSVG('av' + i, a.cfg.look)}</span>` +
    `<span class="who"><b>${a.cfg.name}</b><small>${a.cfg.role}</small></span>` +
    '<span class="st"><i class="dot"></i><em>At their desk</em></span>';
  b.onclick = () => focusAgent(a);
  teamEl.appendChild(b);
  a.panel = b;
});

/* ---------- 11. Camera follow ---------- */
function focusAgent(a) {
  follow = a;
  zoomGoal = 4.5;
  fly = null;
  agents.forEach((x) => x.panel.classList.toggle('focused', x === a));
}
function overview() {
  follow = null;
  zoomGoal = null;
  fly = { pos: HOME.pos.clone(), target: HOME.target.clone() };
  agents.forEach((x) => x.panel.classList.remove('focused'));
}
document.getElementById('overview').onclick = overview;
addEventListener('keydown', (e) => { if (e.key === 'Escape') overview(); });
controls.addEventListener('start', () => { fly = null; zoomGoal = null; });

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(agents.map((a) => a.c.root), true)[0];
  if (hit && hit.object.userData.agent) focusAgent(hit.object.userData.agent);
});

/* ---------- 12. Live screens ---------- */
const playing = (ids) => agents.some((a) => ids.includes(a.spot?.id) && !a.moving && a.state === 'idle');

function drawDesk(a) {
  const { ctx: g, tex, W: w, H: h } = a.screen;
  const t = NOW;
  g.fillStyle = '#0b0e12';
  g.fillRect(0, 0, w, h);
  const here = !a.moving && a.spot === a.deskSpot;
  if (a.state === 'working' && here) {
    g.fillStyle = '#121820'; g.fillRect(0, 0, w, 26);
    g.fillStyle = C.accent; g.font = `600 12px ${MONO}`; g.fillText(a.cfg.task, 12, 17);
    g.fillStyle = '#5b6672'; g.fillText(currentFile.slice(0, 20), 160, 17);
    const off = (t * 26) % 14, base = Math.floor((t * 26) / 14);
    g.save(); g.beginPath(); g.rect(0, 30, w, h - 50); g.clip();
    for (let i = 0; i < 13; i++) {
      const y = 38 + i * 14 - off;
      g.fillStyle = '#3a4450'; g.fillRect(12, y, 34, 5);
      g.fillStyle = (base + i) % 5 ? '#8794a1' : C.accent;
      g.fillRect(54, y, 40 + rnd(base + i) * 200, 5);
    }
    g.restore();
    g.fillStyle = '#1b222b'; g.fillRect(12, h - 14, w - 24, 4);
    const px = ((t * 0.5) % 1) * (w - 24);
    g.fillStyle = C.accent; g.fillRect(12 + px, h - 14, Math.min(60, w - 24 - px), 4);
  } else if (here) {
    g.fillStyle = '#121820'; g.fillRect(0, 0, 90, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = i === 1 ? C.accent : '#2b3440'; g.fillRect(12, 18 + i * 22, 60, 6); }
    const sel = Math.floor(t / 4) % 7;
    for (let i = 0; i < 7; i++) {
      const y = 16 + i * 26;
      g.fillStyle = i === sel ? '#16202a' : '#0f1419'; g.fillRect(100, y, w - 112, 22);
      g.fillStyle = i === sel ? C.accent : '#6b7682'; g.fillRect(110, y + 6, 60 + rnd(i) * 60, 4);
      g.fillStyle = '#3a4450'; g.fillRect(110, y + 13, 100 + rnd(i + 9) * 80, 3);
    }
  } else {
    g.fillStyle = C.accent; g.font = `800 34px ${FONT}`; g.textAlign = 'center';
    g.fillText('ainex', w / 2 + Math.sin(t * 0.5) * 60, h / 2 + 12 + Math.cos(t * 0.37) * 40);
    g.textAlign = 'left';
  }
  tex.needsUpdate = true;
}
function drawTV() {
  const { ctx: g, tex, W: w, H: h } = tvScreen;
  if (!playing(['ps5', 'ps5b'])) { g.fillStyle = '#050608'; g.fillRect(0, 0, w, h); tex.needsUpdate = true; return; }
  const t = NOW;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0d1a3d'); sky.addColorStop(0.5, '#3d6b9a'); sky.addColorStop(0.5, '#2b3138'); sky.addColorStop(1, '#0d0f12');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1f24';
  g.beginPath(); g.moveTo(w / 2 - 10, h / 2); g.lineTo(w / 2 + 10, h / 2); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = '#e6e9ec';
  for (let i = 0; i < 7; i++) {
    const kk = (t * 1.4 + i / 7) % 1, lw = 2 + kk * 10;
    g.fillRect(w / 2 - lw / 2, h / 2 + (kk * kk * h) / 2, lw, 2 + kk * 10);
  }
  const cx = w / 2 + Math.sin(t * 1.3) * 60;
  g.fillStyle = '#c0392b'; g.fillRect(cx - 30, h - 52, 60, 22);
  g.fillStyle = '#7f1d1d'; g.fillRect(cx - 22, h - 64, 44, 14);
  g.fillStyle = '#0a0a0a'; g.fillRect(cx - 28, h - 32, 12, 8); g.fillRect(cx + 16, h - 32, 12, 8);
  g.fillStyle = '#ffffff'; g.font = `700 13px ${MONO}`;
  g.fillText('LAP 2/3', 12, 20); g.fillText('POS 1', w - 64, 20);
  tex.needsUpdate = true;
}
function drawFPS() {
  const { ctx: g, tex, W: w, H: h } = pcScreen;
  if (!playing(['crossfire'])) {
    g.fillStyle = '#07080a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a1620'; g.font = `800 26px ${FONT}`; g.textAlign = 'center';
    g.fillText('CROSSFIRE', w / 2, h / 2 + 9); g.textAlign = 'left';
    tex.needsUpdate = true;
    return;
  }
  const t = NOW;
  g.fillStyle = '#8d97a3'; g.fillRect(0, 0, w, h * 0.45);
  g.fillStyle = '#7a6545'; g.fillRect(0, h * 0.45, w, h * 0.55);
  g.fillStyle = '#4b4f55'; g.fillRect(24, 40, 70, 60); g.fillRect(210, 26, 90, 74); g.fillRect(120, 60, 40, 30);
  const ex = w / 2 + Math.sin(t * 1.2) * 110;
  g.fillStyle = '#26303a'; g.fillRect(ex - 7, 72, 14, 30);
  g.beginPath(); g.arc(ex, 66, 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1b1d20';
  g.beginPath(); g.moveTo(w - 120, h); g.lineTo(w - 70, h - 70); g.lineTo(w - 40, h - 62); g.lineTo(w - 60, h); g.fill();
  const cy = h / 2 - 10;
  g.strokeStyle = '#4ade80'; g.lineWidth = 2; g.beginPath();
  g.moveTo(w / 2 - 12, cy); g.lineTo(w / 2 - 4, cy); g.moveTo(w / 2 + 4, cy); g.lineTo(w / 2 + 12, cy);
  g.moveTo(w / 2, cy - 12); g.lineTo(w / 2, cy - 4); g.moveTo(w / 2, cy + 4); g.lineTo(w / 2, cy + 12);
  g.stroke();
  if (Math.abs(ex - w / 2) < 8) {
    g.fillStyle = '#fbbf24'; g.font = `800 20px ${FONT}`; g.textAlign = 'center';
    g.fillText('HEADSHOT', w / 2, h / 2 + 40); g.textAlign = 'left';
  }
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(w - 96, h - 30, 88, 22);
  g.fillStyle = '#e5e7eb'; g.font = `600 12px ${MONO}`;
  g.fillText('24 / 90', w - 82, h - 15); g.fillText('HP 100', 10, h - 15);
  tex.needsUpdate = true;
}

/* ---------- 13. Main loop ---------- */
const clock = new THREE.Clock();
let screenTimer = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  NOW = clock.elapsedTime;
  agents.forEach((a) => a.update(dt));
  updateBall(dt);

  if (follow) {
    const p = follow.c.root.position;
    const delta = new THREE.Vector3(p.x, 1.4, p.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
    controls.target.add(delta);
    camera.position.add(delta);
    if (zoomGoal) {
      const dist = camera.position.distanceTo(controls.target);
      if (dist > zoomGoal + 0.05) camera.position.lerp(controls.target, Math.min(1, dt * 2) * (1 - zoomGoal / dist));
      else zoomGoal = null;
    }
  }
  if (fly) {
    camera.position.lerp(fly.pos, Math.min(1, dt * 3));
    controls.target.lerp(fly.target, Math.min(1, dt * 3));
    if (camera.position.distanceTo(fly.pos) < 0.05) fly = null;
  }
  controls.update();

  rgbMat.emissive.setHSL((NOW * 0.12) % 1, 1, 0.5);
  if ((screenTimer += dt) > 0.1) {
    screenTimer = 0;
    agents.forEach(drawDesk);
    drawTV();
    drawFPS();
  }
  renderer.render(scene, camera);
  labels.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labels.setSize(innerWidth, innerHeight);
});

/* ---------- 14. Server events + uploads ---------- */
const statusEl = document.getElementById('status');
const setStatus = (t) => (statusEl.textContent = t);
let busy = false;

const WORK_MSG = {
  transcriber: 'Transcribing every word...',
  summarizer: 'Writing the summary...',
  slides: 'Designing the slides...',
};
const ICON = {
  transcriber: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
  summarizer: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h13"/></svg>',
  slides: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/></svg>',
  download: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
};
const FILES = { transcriber: ['Transcript', '.docx'], summarizer: ['Summary', '.docx'], slides: ['Slide deck', '.pptx'] };

function jobCard(jobId, name = 'Meeting') {
  document.querySelector('#results .empty')?.remove();
  let card = document.getElementById('job-' + jobId);
  if (!card) {
    card = document.createElement('div');
    card.className = 'job';
    card.id = 'job-' + jobId;
    card.innerHTML = '<h3></h3><div class="links"></div>';
    card.querySelector('h3').textContent = name;
    document.getElementById('results').prepend(card);
  }
  return card;
}

const es = new EventSource('/events');
es.onmessage = (e) => {
  const ev = JSON.parse(e.data);
  const a = byId[ev.agent];
  if (ev.type === 'status' && a) {
    if (ev.state === 'working') a.startWork(WORK_MSG[a.id]);
    if (ev.state === 'done') {
      a.endWork('Done. Your file is ready.');
      const [label, ext] = FILES[a.id];
      jobCard(ev.jobId).querySelector('.links').insertAdjacentHTML('beforeend',
        `<a class="file" href="${ev.url}" download>${ICON[a.id]}<span class="grow">${label}<small>${ext}</small></span>${ICON.download}</a>`);
    }
    if (ev.state === 'error') a.endWork('I hit a problem: ' + String(ev.msg).slice(0, 50), true);
  }
  if (ev.type === 'complete') {
    busy = false;
    setStatus('All files are ready. Drop another recording anytime.');
  }
};

async function handleFile(file) {
  if (!file) return;
  if (busy) return setStatus('The team is still working on the last file. Please wait.');
  if (!/^(audio|video)\//.test(file.type)) return setStatus('That file is not audio. Try MP3, M4A, WAV or MP4.');
  if (file.size > 25 * 1024 * 1024) return setStatus('That file is over 25 MB. Compress it first.');
  busy = true;
  currentFile = file.name;
  setStatus(`Got ${file.name}. Briefing the team...`);
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    jobCard(data.jobId, file.name);
  } catch (err) {
    busy = false;
    setStatus('Upload failed: ' + err.message);
  }
}

const drop = document.getElementById('drop');
let dragDepth = 0;
addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; drop.classList.add('show'); });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.classList.remove('show'); } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  drop.classList.remove('show');
  handleFile(e.dataTransfer.files[0]);
});
document.getElementById('picker').addEventListener('change', (e) => handleFile(e.target.files[0]));