/* =========================================================
   ainex · Agent Office — House Edition (chibi team)
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
scene.fog = new THREE.Fog(C.ink, 80, 160);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 300);
const HOME = { pos: new THREE.Vector3(30, 36, 36), target: new THREE.Vector3(5.5, 0, 0) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.08;
controls.minDistance = 1.5;
controls.maxDistance = 100;

let follow = null, zoomGoal = null, fly = null, NOW = 0, currentFile = '';

scene.add(new THREE.HemisphereLight('#dfe8f2', '#3a3128', 0.65));
const sun = new THREE.DirectionalLight('#fff0db', 2.4);
sun.position.set(22, 32, 20);
sun.target.position.set(5.5, 0, 0);
scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 110 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
scene.add(sun);
for (const [x, z] of [[-10, -5], [0.5, -6], [7.5, -5.5], [12.5, -5.5], [-12, 5.5], [-5, 6], [1.5, 5.5], [7, 6], [12.5, 6], [21.5, -3]]) {
  const l = new THREE.PointLight('#ffd9a8', 12, 9.5, 2);
  l.position.set(x, 2.5, z);
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
const rug = (w, d, c, x, z) => box(w, 0.012, d, c, x, 0.004, z);
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
  }
}, { repeat: [4, 3] });

function tileTex(base, line, rep) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = line; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
    }
  }, { repeat: rep });
}
const kitchenTiles = tileTex('#d8d4cc', '#b9b3a8', [6.5, 4.4]);
const bathTiles = tileTex('#cfe3ea', '#9fbfca', [2.5, 4.4]);

const grass = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#35602f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `hsl(${95 + rnd(i) * 30}, ${35 + rnd(i + 1) * 20}%, ${20 + rnd(i + 2) * 16}%)`;
    g.fillRect(rnd(i + 3) * w, rnd(i + 4) * h, 2, 3 + rnd(i + 5) * 3);
  }
}, { repeat: [5, 8] });

const deckTex = canvasTex(256, 256, (g, w) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(28, 32%, ${34 + rnd(i + 40) * 8}%)`; g.fillRect(0, i * 32, w, 32);
    g.fillStyle = 'rgba(30,18,8,.5)'; g.fillRect(0, i * 32, w, 2);
  }
});

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
  g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(w * 0.3, h * 0.3, 26, 0, Math.PI * 2); g.fill();
});

const posterTex = canvasTex(400, 260, (g) => {
  g.fillStyle = '#120507'; g.fillRect(0, 0, 400, 260);
  g.fillStyle = '#b91c1c'; g.font = `800 58px ${FONT}`; g.fillText('CROSSFIRE', 26, 140);
  g.fillStyle = '#6b7280'; g.font = `600 18px ${MONO}`; g.fillText('SEARCH & DESTROY', 30, 180);
});

const gymPosterTex = canvasTex(300, 400, (g, w, h) => {
  g.fillStyle = '#101418'; g.fillRect(0, 0, w, h);
  g.fillStyle = C.accent; g.font = `800 56px ${FONT}`; g.textAlign = 'center';
  g.fillText('NO', w / 2, 150); g.fillText('DAYS', w / 2, 215); g.fillText('OFF', w / 2, 280);
  g.fillStyle = '#6b7280'; g.font = `600 18px ${MONO}`; g.fillText('AINEX FITNESS', w / 2, 340);
});

/* ---------- 4. House shell ---------- */
const X0 = -15, X1 = 15, Z0 = -10, Z1 = 10, GX = 28, AISLE = 0;
const HW = X1 - X0, HD = Z1 - Z0;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#0d1116', { roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true; scene.add(ground);
box(GX - X0 + 0.6, 0.35, HD + 0.6, '#151a20', (X0 + GX) / 2, -0.36, 0);

function floorPatch(w, d, x, z, m, y = 0.003) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
  f.rotation.x = -Math.PI / 2; f.position.set(x, y, z); f.receiveShadow = true; scene.add(f);
  return f;
}
floorPatch(HW, HD, 0, 0, new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }), 0);
floorPatch(13, 8.8, -2.5, 5.6, new THREE.MeshStandardMaterial({ map: kitchenTiles, roughness: 0.35 }));
floorPatch(5, 8.8, 12.5, 5.6, new THREE.MeshStandardMaterial({ map: bathTiles, roughness: 0.3 }));
floorPatch(5, 8.8, 12.5, -5.6, mat('#22262b', { roughness: 0.95 }));
floorPatch(GX - X1, HD, (X1 + GX) / 2, 0, new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));

const wallM = mat('#e9e4dc', { roughness: 0.9 });
const partM = mat('#f1ebe2', { roughness: 0.9 });
const capM = mat('#2a2f36');
box(HW + 0.3, 3.2, 0.3, wallM, 0, 0, Z0 - 0.15);
box(0.3, 3.2, HD, wallM, X0 - 0.15, 0, 0);
box(HW, 0.12, 0.04, '#2a2f36', 0, 0, Z0 + 0.02);
box(0.04, 0.12, HD, '#2a2f36', X0 + 0.02, 0, 0);
box(HW, 0.05, 0.03, mat(C.accent, { emissive: C.accent, emissiveIntensity: 1.5 }), 0, 3.05, Z0 + 0.03);
// Cutaway outer walls (south + east, with the back door)
const LOW = 0.45;
box(HW + 0.3, LOW, 0.3, wallM, 0, 0, Z1 + 0.15);
box(0.3, LOW, 8.8, wallM, X1 + 0.15, 0, -5.6);
box(0.3, LOW, 8.8, wallM, X1 + 0.15, 0, 5.6);

const PH = 1.3;
function wallX(x, z1, z2) { const L = z2 - z1, m = (z1 + z2) / 2; box(0.14, PH, L, partM, x, 0, m); box(0.18, 0.05, L, capM, x, PH, m); }
function wallZ(z, x1, x2) { const L = x2 - x1, m = (x1 + x2) / 2; box(L, PH, 0.14, partM, m, 0, z); box(L, 0.05, 0.18, capM, m, PH, z); }
// North rooms
wallX(-4, -10, -3.5);
wallX(5, -10, -1.2); wallX(10, -10, -1.2);
wallZ(-1.2, 5, 6.8); wallZ(-1.2, 8.2, 10); wallZ(-1.2, 10, 11.8); wallZ(-1.2, 13.2, 15);
// South rooms
wallX(-9, 1.2, 10);
wallZ(1.2, -15, -12.7); wallZ(1.2, -11.3, -9);
wallX(4, 1.2, 10); wallX(10, 1.2, 10);
wallZ(1.2, 4, 6.3); wallZ(1.2, 7.7, 10); wallZ(1.2, 10, 11.8); wallZ(1.2, 13.2, 15);

function windowAt(x, z, rotY, w = 2.6) {
  const g = group(x, z, rotY);
  plane(w, 1.5, dusk, 0, 1.85, 0.005, 0, g);
  box(w + 0.16, 0.08, 0.12, '#1d2228', 0, 1.06, 0.02, g);
  box(w + 0.16, 0.08, 0.12, '#1d2228', 0, 2.6, 0.02, g);
  for (const s of [-1, 1]) box(0.08, 1.62, 0.12, '#1d2228', s * (w / 2 + 0.04), 1.06, 0.02, g);
  box(0.05, 1.5, 0.06, '#1d2228', 0, 1.1, 0.03, g);
  box(w + 0.3, 0.05, 0.22, '#d8d2c8', 0, 1.02, 0.1, g);
}
windowAt(-11.5, Z0, 0);
windowAt(3.4, Z0, 0, 1.4);
windowAt(X0, -8.4, Math.PI / 2, 1.8);
windowAt(X0, 8.6, Math.PI / 2, 2.2);
plane(4.2, 1.23, logoTex, -6.4, 2.45, Z0 + 0.02, 0, scene, true);

/* ---------- 5. Furniture ---------- */
const shadeM = mat('#f4e9d8', { emissive: '#ffd9a8', emissiveIntensity: 0.6, side: THREE.DoubleSide });
const whiteM = mat('#f4f5f7', { roughness: 0.3 });
const steelM = mat('#d6d9dd', { metalness: 0.6, roughness: 0.3 });
const mirrorM = mat('#c7d6de', { metalness: 0.9, roughness: 0.08 });

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
  box(0.36, 0.3, 0.12, '#f59e0b', -w / 2 + 0.45, 0.62, -0.1, g).rotation.z = 0.2;
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
function floorLamp(x, z) {
  cyl(0.16, 0.03, '#121418', x, 0, z);
  cyl(0.015, 1.55, '#121418', x, 0.03, z);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 24, 1, true), shadeM), x, 1.62, z);
}
function tableLamp(x, y, z) {
  cyl(0.06, 0.03, '#1a1d22', x, y, z);
  cyl(0.012, 0.22, '#1a1d22', x, y + 0.03, z);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.13, 20, 1, true), shadeM), x, y + 0.3, z);
}
function tree(x, z, s = 1) {
  cyl(0.14 * s, 1.5 * s, '#5a3e2b', x, 0, z);
  for (let i = 0; i < 6; i++) {
    ball((0.55 + rnd(i + x) * 0.3) * s, ['#2f6b3f', '#3f7d4e', '#356e3c'][i % 3],
      x + (rnd(i * 3 + z) - 0.5) * 1.0 * s, (1.7 + rnd(i + 5) * 0.8) * s, z + (rnd(i * 7 + x) - 0.5) * 1.0 * s);
  }
}

// ── Office (north-west, open to the hallway)
rug(10.4, 4.6, '#1d2834', -9.3, -6.9);
(() => {
  const g = group(X0 + 0.05, -5, Math.PI / 2);
  box(2.6, 1.45, 0.04, '#cfd3d8', 0, 1.0, 0, g);
  plane(2.5, 1.37, wbTex, 0, 1.725, 0.025, 0, g);
  box(1.2, 0.03, 0.08, '#9aa1a9', 0, 0.98, 0.06, g);
})();
box(0.35, 1.0, 0.35, '#e9e4dc', -4.6, 0, -9.4);
cyl(0.13, 0.42, mat('#a3d4e0', { transparent: true, opacity: 0.6, roughness: 0.1 }), -4.6, 1.0, -9.4);
box(0.55, 0.7, 0.45, '#d6d9dd', -4.55, 0, -6.6);
box(0.5, 0.1, 0.4, '#2a2f36', -4.55, 0.7, -6.6);
box(0.5, 1.1, 0.6, '#9aa1a9', -14.6, 0, -2.6);
plant(-14.4, -9.4, 1);
plant(-4.6, -3.0, 0.8);

// ── Living room
rug(5.6, 4.6, '#25313d', 0.5, -6.8);
box(2.4, 0.45, 0.45, '#1a1d22', 0.5, 0, -9.6);
box(2.7, 1.55, 0.06, '#0a0b0d', 0.5, 1.15, -9.85);
const tvScreen = screen(2.6, 1.46, scene, 0.5, 1.925, -9.815);
box(0.11, 0.42, 0.3, '#f4f5f7', 1.5, 0.45, -9.6);
box(0.115, 0.4, 0.06, '#15171a', 1.5, 0.46, -9.6);
couch(0.5, -5.4, Math.PI, 3.2, '#2a3846', '#34465a');
box(1.2, 0.05, 0.55, '#c9a27a', 0.5, 0.36, -7.35);
for (const [lx, lz] of [[-0.05, -7.6], [1.05, -7.6], [-0.05, -7.1], [1.05, -7.1]]) box(0.04, 0.36, 0.04, '#1a1d22', lx, 0, lz);
cyl(0.045, 0.1, '#f6f4ef', 0.2, 0.41, -7.35);
box(0.25, 0.04, 0.18, C.navy, 0.8, 0.41, -7.3);
armchair(-3.0, -7, Math.PI / 2, '#6b4f3a', '#8a6a52');
floorLamp(3.9, -5.5);
plant(4.4, -9.4, 0.9);

// ── Game room
rug(4.4, 4.0, '#2a1a3a', 7.5, -6.2);
const rgbMat = mat('#111111', { emissive: '#ff00ff', emissiveIntensity: 1.4 });
const pcScreen = (() => {
  const g = group(6.5, -9.35);
  box(1.6, 0.05, 0.7, '#111317', 0, 0.72, 0, g);
  for (const s of [-1, 1]) box(0.05, 0.72, 0.6, '#111317', s * 0.76, 0, 0, g);
  box(0.2, 0.015, 0.15, '#111317', 0, 0.77, -0.18, g);
  box(0.04, 0.2, 0.04, '#111317', 0, 0.77, -0.2, g);
  box(1.2, 0.6, 0.05, '#0a0b0d', 0, 0.95, -0.18, g);
  const scr = screen(1.14, 0.54, g, 0, 1.25, -0.153);
  box(0.5, 0.02, 0.16, rgbMat, 0, 0.77, 0.08, g);
  box(0.22, 0.5, 0.46, '#0f1114', -1.0, 0, 0, g);
  box(0.01, 0.4, 0.02, rgbMat, -0.89, 0.05, 0.22, g);
  return scr;
})();
officeChair(6.5, -8.47, Math.PI, '#6e1d2a', true);
plane(1.4, 0.91, posterTex, 6.5, 2.1, Z0 + 0.02);
const arcadeScreen = (() => {
  const g = group(8.9, -9.4);
  box(0.8, 1.15, 0.6, '#1b1530', 0, 0, 0, g);
  box(0.8, 0.55, 0.45, '#1b1530', 0, 1.15, -0.075, g);
  box(0.66, 0.5, 0.02, '#000000', 0, 1.17, 0.15, g);
  const scr = screen(0.62, 0.46, g, 0, 1.42, 0.165);
  box(0.8, 0.16, 0.5, rgbMat, 0, 1.7, -0.05, g);
  box(0.8, 0.06, 0.3, '#2b2140', 0, 0.95, 0.42, g);
  cyl(0.012, 0.08, '#111111', -0.15, 1.01, 0.45, g);
  ball(0.03, '#e11d48', -0.15, 1.1, 0.45, g);
  ['#fbbf24', '#34d399', '#60a5fa'].forEach((c, i) => cyl(0.025, 0.02, c, 0.05 + i * 0.09, 1.01, 0.45, g));
  return scr;
})();
beanbag(8.8, -3.4, '#6d28d9');

// ── Home gym
(() => {
  const g = group(14.2, -8.3, Math.PI);
  box(0.8, 0.18, 1.9, '#1b1e23', 0, 0, 0, g);
  box(0.62, 0.02, 1.7, '#0d0f12', 0, 0.18, 0.05, g);
  for (const s of [-1, 1]) box(0.05, 1.05, 0.05, '#2b3037', s * 0.36, 0.18, 0.85, g);
  box(0.78, 0.06, 0.25, '#2b3037', 0, 1.2, 0.8, g);
  box(0.3, 0.15, 0.02, mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.8 }), 0, 1.22, 0.67, g);
})();
(() => {
  const g = group(11.4, -9.55);
  for (const s of [-1, 1]) box(0.05, 0.9, 0.35, '#2b3037', s * 0.78, 0, 0, g);
  for (const y of [0.3, 0.7]) {
    box(1.6, 0.04, 0.36, '#2b3037', 0, y, 0, g);
    for (let i = 0; i < 4; i++) {
      const dx = -0.6 + i * 0.4;
      box(0.2, 0.02, 0.02, '#9aa1a9', dx, y + 0.07, 0, g);
      for (const e of [-0.1, 0.1]) ball(0.045, '#15171a', dx + e, y + 0.08, 0, g);
    }
  }
})();
rug(0.7, 1.8, '#2f6f86', 12.4, -4.9);
ball(0.12, '#15171a', 14.5, 0.12, -3.2); ball(0.1, '#b91c1c', 14.1, 0.1, -3.2);
(() => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.95), mirrorM);
  m.position.set(10.09, 0.72, -6.2); m.rotation.y = Math.PI / 2; scene.add(m);
})();
plane(0.75, 1.0, gymPosterTex, 12.6, 1.9, Z0 + 0.02);

// ── Library
rug(4.6, 4.4, '#4a3a30', -12, 5.6);
(() => {
  const shelf = group(X0 + 0.2, 5.5, Math.PI / 2);
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
armchair(-13, 4.5, Math.PI, '#6b4f3a', '#8a6a52');
cyl(0.22, 0.5, '#2a2118', -14.2, 0, 3.6);
tableLamp(-14.2, 0.5, 3.6);
(() => { // upright piano
  box(1.5, 1.1, 0.45, '#111214', -11, 0, 9.55);
  box(1.4, 0.05, 0.26, '#f4f4f2', -11, 0.72, 9.2);
  for (let i = 0; i < 9; i++) box(0.035, 0.03, 0.14, '#111214', -11.6 + i * 0.15, 0.77, 9.15);
  box(0.9, 0.46, 0.36, '#111214', -11, 0, 8.45);
})();
(() => { // easel
  const g = group(-10.4, 6.5, Math.PI);
  for (const s of [-1, 1]) { const l = box(0.04, 1.6, 0.04, '#8a6a4f', s * 0.3, 0, 0, g); l.rotation.z = -0.12 * s; }
  box(0.04, 1.5, 0.04, '#8a6a4f', 0, 0, -0.35, g).rotation.x = 0.25;
  box(0.8, 0.04, 0.08, '#8a6a4f', 0, 0.75, 0.05, g);
  box(0.72, 0.92, 0.03, '#f4f1ea', 0, 0.79, 0.04, g);
  plane(0.66, 0.86, artTex, 0, 1.25, 0.06, 0, g);
})();
plant(-9.6, 9.4, 0.9);

// ── Kitchen
box(0.9, 2.0, 0.75, steelM, -8.5, 0, 9.5);
box(0.03, 0.6, 0.03, '#9aa1a9', -8.15, 1.1, 9.1);
box(5.6, 0.88, 0.9, '#e9e6e0', -5.2, 0, 9.5);
box(5.7, 0.05, 0.95, '#2a2f36', -5.2, 0.88, 9.5);
box(0.38, 0.46, 0.32, '#1b1e23', -7.4, 0.93, 9.7);
box(0.12, 0.04, 0.04, mat(C.accent, { emissive: C.accent, emissiveIntensity: 1 }), -7.4, 1.27, 9.53);
cyl(0.04, 0.09, '#f6f4ef', -7.4, 0.93, 9.55);
box(0.7, 0.02, 0.55, '#111111', -4.4, 0.93, 9.5);
cyl(0.15, 0.16, '#9aa1a9', -4.5, 0.95, 9.45);
cyl(0.1, 0.05, '#2a2f36', -4.15, 0.95, 9.6);
box(0.6, 0.03, 0.42, '#c9ccd1', -3.0, 0.92, 9.5);
cyl(0.015, 0.28, '#c9ccd1', -3.0, 0.93, 9.8);
for (let i = 0; i < 3; i++) cyl(0.11, 0.015, '#f4f1ea', -2.65, 0.93 + i * 0.02, 9.4);
box(1.4, 0.88, 0.8, '#2f3b47', -5.8, 0, 6.0);
box(1.5, 0.05, 0.9, '#f4f1ea', -5.8, 0.88, 6.0);
cyl(0.16, 0.07, '#e9e4dc', -5.8, 0.93, 6.0);
for (let i = 0; i < 4; i++) ball(0.045, '#f59e0b', -5.8 + Math.cos(i * 1.6) * 0.07, 1.02, 6.0 + Math.sin(i * 1.6) * 0.07);
for (const x of [-6.2, -5.4]) { cyl(0.025, 0.68, '#9aa1a9', x, 0, 5.2); cyl(0.2, 0.05, '#2a2f36', x, 0.68, 5.2); }

// ── Dining
cyl(0.75, 0.04, '#e7e2da', 1.5, 0.74, 5.5);
cyl(0.06, 0.74, '#1a1d22', 1.5, 0, 5.5);
cyl(0.35, 0.03, '#1a1d22', 1.5, 0, 5.5);
cyl(0.12, 0.07, '#f4f1ea', 1.5, 0.78, 5.12);
cyl(0.1, 0.02, '#e3b04b', 1.5, 0.84, 5.12);
cyl(0.06, 0.2, mat('#a3d4e0', { transparent: true, opacity: 0.5 }), 1.6, 0.78, 5.7);
diningChair(1.5, 4.65, 0);
diningChair(1.5, 6.35, Math.PI);
diningChair(0.65, 5.5, Math.PI / 2);
diningChair(2.35, 5.5, -Math.PI / 2);
plant(-0.5, 9.4, 0.9);
plant(3.5, 9.4, 0.8);

// ── Bedroom
rug(3.4, 2.4, '#3b4a6b', 7.6, 5.6);
(() => {
  const g = group(8, 8.25);
  box(1.7, 0.3, 2.65, '#3a2c22', 0, 0.08, 0, g);
  box(1.6, 0.2, 2.55, '#f4f1ea', 0, 0.38, 0, g);
  box(1.64, 0.06, 1.5, C.navy, 0, 0.56, -0.5, g);
  box(1.7, 1.0, 0.1, '#3a2c22', 0, 0.08, 1.33, g);
  for (const s of [-1, 1]) box(0.6, 0.14, 0.36, '#ffffff', s * 0.38, 0.58, 1.0, g);
  ball(0.12, '#f9a8d4', 0.55, 0.72, 0.6, g);
})();
for (const x of [6.75, 9.3]) { box(0.45, 0.5, 0.4, '#3a2c22', x, 0, 9.5); tableLamp(x, 0.5, 9.5); }
box(0.6, 2.0, 1.4, '#e7e2da', 4.42, 0, 6.6);
box(0.02, 1.8, 0.02, '#9aa1a9', 4.73, 0.1, 6.6);

// ── Bathroom
box(1.8, 0.55, 0.85, whiteM, 11.2, 0, 8.6);
box(1.6, 0.02, 0.65, mat('#a3d4e0', { transparent: true, opacity: 0.7, roughness: 0.1 }), 11.2, 0.5, 8.6);
box(0.4, 0.4, 0.5, whiteM, 14.4, 0, 9.45);
box(0.45, 0.5, 0.2, whiteM, 14.4, 0.35, 9.85);
box(0.55, 0.85, 1.0, '#e9e4dc', 10.4, 0, 3.6);
box(0.6, 0.04, 1.05, '#2a2f36', 10.4, 0.85, 3.6);
cyl(0.18, 0.05, whiteM, 10.45, 0.89, 3.6);
box(0.05, 0.7, 0.5, '#1d2228', 10.2, 0.89, 3.6);
(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.62), mirrorM); m.position.set(10.23, 1.24, 3.6); m.rotation.y = Math.PI / 2; scene.add(m); })();
rug(0.9, 0.6, '#a3d4e0', 11.2, 7.8);
plant(14.5, 2.0, 0.7);

// ── Hallway
rug(29, 1.4, '#3a2f2a', 0, 0);
box(0.4, 1.7, 0.05, '#2a2f36', 14.6, 0, -1.05);
for (const [c, dx] of [['#b45309', -0.1], [C.navy, 0.1]]) box(0.18, 0.5, 0.08, c, 14.6 + dx, 1.1, -1.0);
box(0.9, 0.4, 0.35, '#8a6a4f', 14.3, 0, 0.95);
rug(0.9, 0.6, '#5a4632', 15.8, 0);

// ── Backyard
box(3.0, 0.08, 3.2, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.8 }), 16.8, 0, -0.4);
cyl(0.45, 0.04, '#e9e4dc', 16.2, 0.72, -1.4);
cyl(0.04, 0.72, '#1a1d22', 16.2, 0.08, -1.4);
cyl(0.02, 1.6, '#1a1d22', 16.2, 0.76, -1.4);
put(new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.4, 8, 1, true), mat('#f4f1ea', { side: THREE.DoubleSide })), 16.2, 2.5, -1.4);
for (const x of [18.5, 21.5, 24.5]) {
  box(2.4, 0.35, 1.0, '#6b4f3a', x, 0, -8.5);
  box(2.25, 0.02, 0.85, '#3b2a1f', x, 0.35, -8.5);
  for (let i = 0; i < 7; i++) {
    const px = x - 1 + i * 0.33;
    ball(0.12, '#3f7d4e', px, 0.48, -8.5 + (rnd(i + x) - 0.5) * 0.4);
    ball(0.05, ['#f472b6', '#fbbf24', '#f87171', '#e9d5ff'][i % 4], px, 0.62, -8.5 + (rnd(i + x) - 0.5) * 0.4);
  }
}
box(0.8, 0.85, 0.5, '#1b1e23', 19.3, 0, -4.8);
box(0.85, 0.12, 0.55, '#2b3037', 19.3, 0.85, -4.8);
box(0.3, 0.02, 0.4, '#7a2a30', 19.3, 0.97, -4.8);
for (const x of [24.4, 26.9]) cyl(0.06, 1.4, '#5a3e2b', x, 0, -4.5);
box(2.1, 0.06, 0.8, '#d97757', 25.65, 0.57, -4.5);
for (const s of [-1, 1]) { const r = box(0.03, 0.03, 0.75, '#c9a27a', 25.65 + s * 1.1, 0.95, -4.5); r.rotation.z = 0.9 * s; }
tree(27.2, -9, 1.1); tree(16.4, 9.2, 0.9); tree(27.3, -1.5, 0.8);
for (let z = -9.6; z <= 9.6; z += 1.6) plant(15.7, z, 0.55);
(() => { // fence
  const fM = '#c9b79c';
  for (let x = 15.6; x <= GX; x += 1.2) { box(0.08, 0.9, 0.08, fM, x, 0, -10.1); box(0.08, 0.9, 0.08, fM, x, 0, 10.1); }
  for (let z = -10; z <= 10; z += 1.2) box(0.08, 0.9, 0.08, fM, GX, 0, z);
  for (const y of [0.35, 0.75]) {
    box(GX - 15.4, 0.06, 0.04, fM, (GX + 15.4) / 2, y, -10.1);
    box(GX - 15.4, 0.06, 0.04, fM, (GX + 15.4) / 2, y, 10.1);
    box(0.04, 0.06, 20.2, fM, GX, y, 0);
  }
})();

// Pickleball court
const COURT = { x: 22, z: 5, len: 9.2, wid: 5.4 };
box(10.4, 0.02, 6.6, '#1d3a36', COURT.x, 0, COURT.z);
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
box(2.4, 0.07, 0.45, '#c9a27a', COURT.x, 0.42, 9.2);
for (const s of [-1, 1]) box(0.06, 0.42, 0.4, '#1a1d22', COURT.x + s * 1.1, 0, 9.2);

/* ---------- 6. Activities ---------- */
const OUT = [15, AISLE];
const ACTIVITIES = [
  { id: 'ps5', where: 'the living room', label: 'Playing PS5', x: -0.19, z: -5.45, rot: Math.PI, pose: 'sit', seat: 0.62, anim: 'controller',
    via: [[2.6, AISLE], [2.6, -6.5], [-0.19, -6.5]], min: 60, max: 120, lines: ['One more race.', 'This track is tough.', 'Almost took first.'] },
  { id: 'ps5b', where: 'the living room', label: 'Playing PS5', x: 1.19, z: -5.45, rot: Math.PI, pose: 'sit', seat: 0.62, anim: 'controller',
    via: [[2.6, AISLE], [2.6, -6.5], [1.19, -6.5]], min: 60, max: 120, lines: ['Co-op time.', 'Cover me.', 'We got this round.'] },
  { id: 'guitar', where: 'the living room', label: 'Playing guitar', x: -3.0, z: -7, rot: Math.PI / 2, pose: 'sit', seat: 0.56, anim: 'guitar',
    via: [[-1.9, AISLE], [-1.9, -7]], min: 50, max: 90, lines: ['New chord unlocked.', 'Wonderwall? Kidding.', 'Just jamming.'] },
  { id: 'crossfire', where: 'the game room', label: 'Playing Crossfire', x: 6.5, z: -8.47, rot: Math.PI, pose: 'sit', seat: 0.54, anim: 'mouse',
    via: [[7.5, AISLE], [7.5, -7.4], [6.5, -7.4]], min: 60, max: 120, lines: ['Headshot.', 'Clutch round.', 'Holding B site.'] },
  { id: 'arcade', where: 'the game room', label: 'On the arcade machine', x: 8.9, z: -8.55, rot: Math.PI, pose: 'stand', anim: 'arcade',
    via: [[7.5, AISLE], [7.5, -7.4], [8.9, -7.4]], min: 45, max: 90, lines: ['High score incoming.', 'One more coin.'] },
  { id: 'treadmill', where: 'the gym', label: 'On the treadmill', x: 14.2, z: -8.25, y: 0.2, rot: Math.PI, pose: 'stand', anim: 'run',
    via: [[12.5, AISLE], [12.5, -3], [14.2, -6.6]], min: 50, max: 90, lines: ['Getting my steps in.', 'Ten more minutes.'] },
  { id: 'weights', where: 'the gym', label: 'Lifting weights', x: 11.4, z: -8.4, rot: Math.PI, pose: 'stand', anim: 'lift',
    via: [[12.5, AISLE], [12.5, -3], [11.4, -6.6]], min: 40, max: 70, lines: ['Arm day.', 'Two more reps.'] },
  { id: 'yoga', where: 'the gym', label: 'Doing yoga', x: 12.4, z: -4.9, rot: Math.PI, pose: 'stand', anim: 'stretch',
    via: [[12.5, AISLE], [12.5, -3]], min: 40, max: 70, lines: ['Deep breaths.', 'Stretching it out.'] },
  { id: 'nap', where: 'the bedroom', label: 'Taking a nap', x: 8, z: 8.0, rot: Math.PI, pose: 'bed', seat: 0.6, anim: 'sleep',
    via: [[7, AISLE], [7, 3], [6.4, 8]], min: 80, max: 150, lines: ['zzz...', 'Five more minutes...'] },
  { id: 'read', where: 'the library', label: 'Reading a book', x: -13, z: 4.5, rot: Math.PI, pose: 'sit', seat: 0.56, anim: 'read',
    via: [[-12, AISLE], [-12, 3]], min: 70, max: 130, lines: ['This chapter is good.', 'Learning something new.'] },
  { id: 'piano', where: 'the library', label: 'Playing piano', x: -11, z: 8.5, rot: 0, pose: 'sit', seat: 0.5, anim: 'piano',
    via: [[-12, AISLE], [-12, 3]], min: 50, max: 90, lines: ['Practicing scales.', 'A little Chopin.'] },
  { id: 'paint', where: 'the library', label: 'Painting', x: -10.4, z: 5.6, rot: 0, pose: 'stand', anim: 'paint',
    via: [[-12, AISLE], [-12, 3]], min: 50, max: 90, lines: ['Needs more blue.', 'Happy little trees.'] },
  { id: 'coffee', where: 'the kitchen', label: 'Making coffee', x: -7.4, z: 8.55, rot: 0, pose: 'stand', anim: 'barista',
    min: 25, max: 45, lines: ['Kape muna.', 'Fresh brew coming up.'] },
  { id: 'cook', where: 'the kitchen', label: 'Cooking', x: -4.4, z: 8.55, rot: 0, pose: 'stand', anim: 'cook',
    min: 40, max: 70, lines: ['Adobo for everyone.', 'Smells good, right?'] },
  { id: 'dishes', where: 'the kitchen', label: 'Washing dishes', x: -3.0, z: 8.55, rot: 0, pose: 'stand', anim: 'wash',
    min: 30, max: 50, lines: ['Clean kitchen, clear mind.', 'Almost done.'] },
  { id: 'eat', where: 'the dining table', label: 'Having merienda', x: 1.5, z: 4.65, rot: 0, pose: 'sit', seat: 0.51, anim: 'eat',
    min: 50, max: 90, lines: ['Pancit break.', 'Merienda time.'] },
  { id: 'whiteboard', where: 'the whiteboard', label: 'Planning on the whiteboard', x: -14.4, z: -5, rot: -Math.PI / 2, pose: 'stand', anim: 'write',
    min: 45, max: 80, lines: ['Mapping the next workflow.', 'Lead, CRM, booked.'] },
  { id: 'cooler', where: 'the water cooler', label: 'At the water cooler', x: -4.6, z: -8.6, rot: Math.PI, pose: 'stand', anim: 'drink',
    min: 25, max: 45, lines: ['Hydration check.', 'Quick break.'] },
  { id: 'vanity', where: 'the bathroom', label: 'Freshening up', x: 11.0, z: 3.6, rot: -Math.PI / 2, pose: 'stand', anim: 'wash',
    via: [[12.5, AISLE], [12.5, 3]], min: 20, max: 35, lines: ['Looking sharp.', 'Hair check.'] },
  { id: 'garden', where: 'the garden', label: 'Watering plants', x: 21.5, z: -7.55, rot: Math.PI, pose: 'stand', anim: 'water',
    via: [OUT, [21.5, AISLE]], min: 40, max: 70, lines: ['The tomatoes are growing.', 'Drink up, plants.'] },
  { id: 'grill', where: 'the BBQ', label: 'Grilling', x: 19.3, z: -4.0, rot: Math.PI, pose: 'stand', anim: 'cook',
    via: [OUT, [19.3, AISLE]], min: 45, max: 80, lines: ['Inihaw time.', 'Medium or well done?'] },
  { id: 'hammock', where: 'the hammock', label: 'Relaxing in the hammock', x: 25.65, z: -4.5, rot: Math.PI / 2, pose: 'lie', anim: 'sleep',
    via: [OUT, [25.65, AISLE], [25.65, -3.4]], min: 70, max: 130, lines: ['Peak relaxation.', 'Do not disturb.'] },
  { id: 'patio', where: 'the deck', label: 'Coffee on the deck', x: 17.9, z: -1.5, rot: Math.PI / 2, pose: 'stand', anim: 'drink',
    via: [OUT], min: 35, max: 60, lines: ['Nice night out.', 'Taking a breather.'] },
];
const COURT_SPOTS = [
  { id: 'court-a', kind: 'pickleball', label: 'Playing pickleball', x: 18.6, z: COURT.z, rot: Math.PI / 2, pose: 'stand', anim: 'pickleball',
    via: [OUT, [18.6, AISLE]] },
  { id: 'court-b', kind: 'pickleball', label: 'Playing pickleball', x: 25.4, z: COURT.z, rot: -Math.PI / 2, pose: 'stand', anim: 'pickleball',
    via: [OUT, [25.4, AISLE]] },
];

/* ---------- 7. Chibi characters ---------- */
const toonGrad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, ...o });
const INK = new THREE.MeshBasicMaterial({ color: '#2a1d1d', side: THREE.BackSide });

function drawFace(g, look, state) {
  const cx0 = 256, ey = 296, dx = 94, f = look.type === 'female';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.fillStyle = 'rgba(255,128,140,0.32)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx0 + s * 120, 372, 30, 13, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = look.brow || '#2a1a14';
  g.lineWidth = f ? 11 : 15;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx0 + s * (dx + 40), 222);
    g.quadraticCurveTo(cx0 + s * dx, 196, cx0 + s * (dx - 38), 210);
    g.stroke();
  }
  for (const s of [-1, 1]) {
    const cx = cx0 + s * dx;
    if (state === 'closed') {
      g.strokeStyle = '#2a1712'; g.lineWidth = 10;
      g.beginPath(); g.moveTo(cx - 40, ey); g.quadraticCurveTo(cx, ey + 24, cx + 40, ey); g.stroke();
      continue;
    }
    const rx = f ? 38 : 36, ry = f ? 46 : 43;
    const ir = g.createLinearGradient(0, ey - ry, 0, ey + ry);
    ir.addColorStop(0, look.eyes[0]);
    ir.addColorStop(1, look.eyes[1]);
    g.fillStyle = ir;
    g.beginPath(); g.ellipse(cx, ey + 3, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(10,6,6,.85)';
    g.beginPath(); g.ellipse(cx, ey + 6, rx * 0.5, ry * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx - 13, ey - 14, 13, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 14, ey + 20, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1b100c';
    g.lineWidth = f ? 13 : 11;
    g.beginPath(); g.moveTo(cx - rx - 8, ey - 4); g.quadraticCurveTo(cx, ey - ry - 22, cx + rx + 8, ey - 6); g.stroke();
    if (f) { g.lineWidth = 6; g.beginPath(); g.moveTo(cx + s * (rx + 6), ey - 8); g.lineTo(cx + s * (rx + 20), ey - 20); g.stroke(); }
  }
  g.strokeStyle = 'rgba(170,100,90,.55)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(258, 362); g.lineTo(252, 372); g.stroke();
  if (state === 'talk') {
    g.fillStyle = '#7a2a30'; g.beginPath(); g.ellipse(256, 418, 16, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e58a8f'; g.beginPath(); g.ellipse(256, 424, 9, 4, 0, 0, Math.PI * 2); g.fill();
  } else if (look.smile === 'open') {
    const m = new Path2D();
    m.moveTo(222, 404); m.quadraticCurveTo(256, 452, 290, 404); m.closePath();
    g.save(); g.fillStyle = '#7a2a30'; g.fill(m); g.clip(m);
    g.fillStyle = '#ffffff'; g.fillRect(215, 400, 80, 11);
    g.fillStyle = '#e58a8f'; g.beginPath(); g.ellipse(256, 434, 16, 7, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  } else {
    g.strokeStyle = '#a24a4a'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(236, 410); g.quadraticCurveTo(256, 424, 276, 410); g.stroke();
  }
}

function holoTex(kind) {
  return canvasTex(420, 300, (g, w, h) => {
    g.fillStyle = 'rgba(40,140,220,0.25)';
    g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 18); g.fill();
    g.shadowColor = '#3fb7ff'; g.shadowBlur = 18;
    g.strokeStyle = '#8fe0ff'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 18); g.stroke();
    g.fillStyle = '#c8f1ff';
    if (kind === 'wave') {
      for (let i = 0; i < 56; i++) {
        const a = (Math.abs(Math.sin(i * 0.37)) * 0.7 + Math.abs(Math.sin(i * 0.11)) * 0.3) * 160 + 8;
        g.fillRect(50 + i * 5.8, h / 2 - a / 2, 3, a);
      }
    } else if (kind === 'check') {
      for (let r = 0; r < 4; r++) {
        const y = 62 + r * 54;
        g.fillRect(50, y - 6, 200, 12);
        g.strokeStyle = '#c8f1ff'; g.lineWidth = 5;
        g.beginPath(); g.arc(320, y, 20, 0, Math.PI * 2); g.stroke();
        if (r < 3) { g.beginPath(); g.moveTo(309, y); g.lineTo(318, y + 9); g.lineTo(333, y - 9); g.stroke(); }
      }
    } else {
      g.fillRect(50, 60, 150, 10); g.fillRect(50, 84, 110, 10); g.fillRect(50, 108, 130, 10);
      [60, 100, 140, 190].forEach((bh, i) => g.fillRect(200 + i * 46, h - 50 - bh, 32, bh));
    }
  });
}

function makeCharacter(look, holoKind) {
  const female = look.type === 'female';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinM = toon(look.skin);
  const hairM = toon(look.hair);
  const shirtM = toon(look.shirt || '#f6f7f9');
  const pantsM = toon(look.pants || '#121418');
  const dressM = toon(look.dress || C.navy, { side: THREE.DoubleSide });
  const shoeM = toon('#f4f5f7');
  const soleM = toon('#c9ccd1');

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

  // Legs + white sneakers
  const legM = female ? skinM : pantsM;
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(0.1 * s, 0.9, 0); body.add(hip);
    part(cap(female ? 0.072 : 0.085, 0.28), legM, hip, 0, -0.22, 0, 0.07);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    part(cap(female ? 0.058 : 0.072, 0.3), legM, knee, 0, -0.21, 0, 0.08);
    part(new THREE.BoxGeometry(female ? 0.1 : 0.12, 0.08, female ? 0.24 : 0.28), shoeM, knee, 0, -0.41, 0.05, 0.06);
    part(new THREE.BoxGeometry(female ? 0.105 : 0.125, 0.025, female ? 0.245 : 0.285), soleM, knee, 0, -0.455, 0.05, 0);
    return { hip, knee };
  });

  // Torso + outfit
  part(cap(0.18, 0.36), female ? dressM : shirtM, body, 0, 1.2, 0, 0.04).scale.set(1.1, 1, 0.8);
  let skirt = null;
  if (female) {
    skirt = part(new THREE.CylinderGeometry(0.19, 0.37, 0.5, 32, 1, true), dressM, body, 0, 0.7, 0, 0);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.1, 0.05, 0.02), toon('#0e1a52'), body, 0.05 * s, 1.53, 0.11, 0).rotation.z = 0.5 * s;
  } else {
    part(cap(0.16, 0.08), pantsM, body, 0, 0.9, 0, 0.04).scale.set(1.1, 1, 0.84);
    part(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 32), toon('#0d0e10'), body, 0, 0.95, 0, 0).scale.set(1.08, 1, 0.84);
    part(new THREE.BoxGeometry(0.06, 0.04, 0.02), toon('#c9ccd1'), body, 0, 0.95, 0.16, 0);
    for (const s of [-1, 1]) {
      part(new THREE.BoxGeometry(0.08, 0.05, 0.02), shirtM, body, 0.045 * s, 1.53, 0.1, 0).rotation.z = 0.5 * s;
    }
    const tieM = toon(look.tie || C.navy);
    part(new THREE.BoxGeometry(0.05, 0.045, 0.03), tieM, body, 0, 1.5, 0.12, 0.08);
    part(new THREE.BoxGeometry(0.065, 0.4, 0.015), tieM, body, 0, 1.27, 0.152, 0.06).rotation.x = -0.1;
  }

  // Neck + big chibi head
  part(cap(0.05, 0.06), skinM, body, 0, 1.6, 0, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  head.scale.setScalar(1.65);
  body.add(head);
  const skull = part(new THREE.SphereGeometry(0.16, 40, 30), skinM, head, 0, 0.13, 0, 0.035);
  skull.scale.set(0.92, 1.1, 0.96);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.033, 12, 10), skinM, head, 0.142 * s, 0.12, -0.01, 0).scale.set(0.45, 1, 0.75);

  const faceTex = {};
  for (const st of ['open', 'closed', 'talk']) faceTex[st] = canvasTex(512, 512, (g) => drawFace(g, look, st));
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex.open, transparent: true, depthWrite: false });
  const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.162, 40, 30, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.75, 1.5), faceMat);
  facePatch.position.copy(skull.position);
  facePatch.scale.copy(skull.scale);
  head.add(facePatch);

  // Round glasses
  const frameM = toon('#1a1416');
  const lensM = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.12, depthWrite: false });
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0045, 8, 28), frameM);
    ring.position.set(0.049 * s, 0.11, 0.163);
    ring.rotation.y = 0.28 * s;
    head.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.034, 24), lensM);
    lens.position.copy(ring.position);
    lens.rotation.y = ring.rotation.y;
    head.add(lens);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.152), frameM);
    arm.position.set(0.1235 * s, 0.115, 0.0865);
    arm.rotation.y = -0.5 * s;
    head.add(arm);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), frameM);
  bridge.position.set(0, 0.118, 0.172);
  head.add(bridge);

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
    [-0.55, -0.3, -0.05, 0.2, 0.42].forEach((a, i) => strand(a, 0.27, 0.11, 0.1 + (i % 2) * 0.02, 0.048, Math.PI - 0.55, 0.25));
    for (const s of [-1, 1]) {
      part(cap(0.042, 0.42), hairM, head, 0.135 * s, -0.1, 0.03, 0.06).rotation.z = 0.06 * s;
      part(cap(0.045, 0.4), hairM, head, 0.12 * s, -0.12, -0.06, 0.06).rotation.z = -0.05 * s;
    }
    part(cap(0.16, 0.34), hairM, head, 0, -0.1, -0.08, 0.03).scale.set(1.2, 1, 0.6);
  } else {
    const sd = look.seed || 1;
    [-0.6, -0.32, -0.05, 0.22, 0.5].forEach((a, i) => strand(a, 0.27, 0.11, 0.1 + rnd(sd + i) * 0.04, 0.05,
      Math.PI - 0.5 - rnd(sd + i + 7) * 0.2, (rnd(sd + i + 3) - 0.5) * 0.5));
    for (let i = 0; i < 11; i++) strand(-Math.PI + i * 0.58 + rnd(sd + i * 2) * 0.25, 0.29, 0.02, 0.13 + rnd(sd + i + 5) * 0.06, 0.055,
      -0.35 - rnd(sd + i + 9) * 0.6, (rnd(sd + i + 13) - 0.5) * 0.7);
    for (const s of [-1, 1]) strand(1.25 * s, 0.2, 0.11, 0.1, 0.04, Math.PI - 0.35);
  }

  // Headphones (Aira)
  if (look.headphones) {
    const hpM = toon('#1d2430');
    const glow = new THREE.MeshBasicMaterial({ color: '#7fd8ff', toneMapped: false });
    const band = part(new THREE.TorusGeometry(0.2, 0.016, 8, 32, Math.PI), hpM, head, 0, 0.15, -0.01, 0.08);
    band.scale.x = 0.92;
    for (const s of [-1, 1]) {
      const cup = part(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 24), hpM, head, 0.185 * s, 0.12, -0.01, 0.06);
      cup.rotation.z = Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 24), glow);
      ring.position.set(0.217 * s, 0.12, -0.01);
      ring.rotation.y = Math.PI / 2;
      head.add(ring);
    }
  }

  // Arms (rolled sleeves for the guys, short sleeves for Aira)
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(0.25 * s, 1.47, 0); body.add(sh);
    part(new THREE.SphereGeometry(0.066, 16, 12), female ? dressM : shirtM, sh, 0, 0, 0, 0.05);
    part(cap(0.05, 0.2), female ? skinM : shirtM, sh, 0, -0.15, 0, 0.08);
    if (female) part(new THREE.CylinderGeometry(0.064, 0.07, 0.12, 16), dressM, sh, 0, -0.05, 0, 0.05);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    if (!female) part(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 14), shirtM, el, 0, -0.01, 0, 0.06);
    part(cap(0.043, 0.18), skinM, el, 0, -0.13, 0, 0.09);
    part(new THREE.SphereGeometry(0.048, 14, 10), skinM, el, 0, -0.29, 0, 0.08).scale.set(0.8, 1.15, 0.6);
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
  const guitar = new THREE.Group(); guitar.position.set(-0.02, 1.0, 0.26); guitar.rotation.z = 1.15; body.add(guitar);
  part(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 24), toon('#b45309'), guitar, 0, -0.08, 0, 0.05).rotation.x = Math.PI / 2;
  part(new THREE.CylinderGeometry(0.035, 0.035, 0.075, 16), toon('#2a1a10'), guitar, 0, -0.08, 0, 0).rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.045, 0.42, 0.025), toon('#3a2416'), guitar, 0, 0.25, 0, 0.05);
  part(new THREE.BoxGeometry(0.07, 0.1, 0.03), toon('#3a2416'), guitar, 0, 0.5, 0, 0.05);
  const bells = arms.map(({ el }) => {
    const d = new THREE.Group(); d.position.set(0, -0.31, 0.02); el.add(d);
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), toon('#9aa1a9'), d, 0, 0, 0, 0).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), toon('#15171a'), d, 0.09 * s, 0, 0, 0.06).rotation.z = Math.PI / 2;
    return d;
  });
  const can = new THREE.Group(); can.position.set(0, -0.36, 0.06); hand.add(can);
  part(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 18), toon('#2f6f86'), can, 0, -0.04, 0, 0.05);
  part(new THREE.CylinderGeometry(0.012, 0.018, 0.2, 8), toon('#2f6f86'), can, 0, 0, 0.12, 0.08).rotation.x = 1.0;

  // Hologram panel (shows while working)
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.33), new THREE.MeshBasicMaterial({
    map: holoTex(holoKind), transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  holo.position.set(0.5, 1.5, 0.42);
  holo.rotation.y = Math.PI - 0.55;
  holo.visible = false;
  root.add(holo);

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

  return { root, body, head, legs, arms, skirt, controller, cup, marker, book, paddle, paddleFace, guitar, bells, can, holo,
    plumbob, label, face: { mat: faceMat, tex: faceTex, current: 'open' },
    bubble: div.querySelector('.bubble'), name: div.querySelector('.name') };
}

/* Chibi portrait for the team panel (SVG) */
function avatarSVG(id, look) {
  const f = look.type === 'female';
  const hair = look.hair, skin = look.skin, [e1, e2] = look.eyes, brow = look.brow || '#2a1a14';
  const eye = (cx) => `
    <ellipse cx="${cx}" cy="51.5" rx="5.2" ry="6.2" fill="url(#${id}ir)"/>
    <ellipse cx="${cx}" cy="52.3" rx="2.6" ry="3.3" fill="#140c0a"/>
    <circle cx="${cx - 1.9}" cy="49" r="1.9" fill="#fff"/>
    <circle cx="${cx + 2}" cy="54.4" r=".9" fill="#fff"/>
    <path d="M${cx - 6.2} 49.6 Q${cx} 43 ${cx + 6.2} 49.2" fill="none" stroke="#1b100c" stroke-width="1.9" stroke-linecap="round"/>`;
  const glasses = `<g fill="none" stroke="#1a1416" stroke-width="1.3">
    <circle cx="41" cy="51.5" r="7.6"/><circle cx="59" cy="51.5" r="7.6"/>
    <path d="M48.6 50.8 Q50 49.8 51.4 50.8 M33.4 50.5 L30.5 49 M66.6 50.5 L69.5 49"/></g>`;
  const back = f ? `<path d="M26 46 Q22 18 50 17 Q78 18 74 46 Q78 70 72 92 Q76 98 80 100 L20 100 Q24 98 28 92 Q22 70 26 46Z" fill="${hair}"/>` : '';
  const front = f
    ? `<path d="M30 46 Q28 21 50 20 Q72 21 70 46 L67 38 Q62 30 52 30 Q44 34 36 40 Q34 44 32 47 Z" fill="${hair}"/>
       <path d="M30 44 Q27 60 31 76 L34 74 Q31 58 33 46Z M70 44 Q73 60 69 76 L66 74 Q69 58 67 46Z" fill="${hair}"/>`
    : `<path d="M28 48 Q25 24 40 18 L38 11 L46 16 L50 8 L55 15 L63 10 L62 18 Q75 24 72 48 L69 40 L66 34 L62 39 L58 31 L53 37 L48 30 L44 37 L39 32 L35 39 L31 42 Z" fill="${hair}"/>`;
  const phones = look.headphones
    ? `<path d="M26 52 Q23 13 50 13 Q77 13 74 52" fill="none" stroke="#1d2430" stroke-width="4"/>
       <rect x="21" y="44" width="9" height="16" rx="4" fill="#1d2430" stroke="#7fd8ff" stroke-width="1.2"/>
       <rect x="70" y="44" width="9" height="16" rx="4" fill="#1d2430" stroke="#7fd8ff" stroke-width="1.2"/>` : '';
  const outfit = f
    ? `<path d="M14 100 Q16 80 34 76 L66 76 Q84 80 86 100 Z" fill="${look.dress || C.navy}"/>
       <path d="M42 76 L50 84 L43 87 Z M58 76 L50 84 L57 87 Z" fill="#0e1a52"/>`
    : `<path d="M14 100 Q16 80 34 76 L66 76 Q84 80 86 100 Z" fill="${look.shirt || '#f6f7f9'}"/>
       <path d="M42 76 L50 85 L58 76" fill="none" stroke="#c9ced5" stroke-width="1.2"/>
       <path d="M48.2 80 L51.8 80 L53.5 100 L46.5 100 Z" fill="${look.tie || C.navy}"/>
       <rect x="47.6" y="77.5" width="4.8" height="3.4" rx="1" fill="${look.tie || C.navy}"/>`;
  const mouth = look.smile === 'open'
    ? `<path d="M45.5 61.5 Q50 67.5 54.5 61.5 Z" fill="#7a2a30"/><path d="M46 61.6 L54 61.6 L53.6 62.6 L46.4 62.6Z" fill="#fff"/>`
    : `<path d="M47 62 Q50 64 53 62" fill="none" stroke="#9a4a48" stroke-width="1.2" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a2a44"/><stop offset="1" stop-color="#0d1420"/></linearGradient>
      <linearGradient id="${id}ir" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e1}"/><stop offset="1" stop-color="${e2}"/></linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#${id}bg)"/>
    ${back}
    ${outfit}
    <rect x="45" y="64" width="10" height="13" fill="${skin}"/>
    <ellipse cx="30" cy="51" rx="2.6" ry="4.2" fill="${skin}"/>
    <ellipse cx="70" cy="51" rx="2.6" ry="4.2" fill="${skin}"/>
    <path d="M30 46 Q30 25 50 25 Q70 25 70 46 Q70 64 50 69 Q30 64 30 46Z" fill="${skin}"/>
    <ellipse cx="37" cy="59" rx="3.6" ry="1.6" fill="#ff8a95" opacity=".38"/>
    <ellipse cx="63" cy="59" rx="3.6" ry="1.6" fill="#ff8a95" opacity=".38"/>
    ${eye(41)}${eye(59)}
    <path d="M35 41.5 Q40.5 38.2 46 40.4 M54 40.4 Q59.5 38.2 65 41.5" fill="none" stroke="${brow}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M50.6 57 L49.6 58.6" stroke="rgba(150,90,80,.7)" stroke-width=".9" stroke-linecap="round"/>
    ${mouth}
    ${glasses}
    ${front}
    ${phones}
  </svg>`;
}

/* ---------- 8. Agent brain ---------- */
const WALK = 1.35, ACCEL = 1.8, DECEL = 1.6;
const game = { active: false, ready: false, players: [], end: 0 };

class Agent {
  constructor(cfg) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.c = makeCharacter(cfg.look, cfg.holo);
    this.c.name.textContent = cfg.name.toUpperCase();
    scene.add(this.c.root);
    this.screen = workDesk(cfg.desk, -8.6);
    this.deskSpot = { id: 'desk-' + cfg.id, where: 'their desk', label: 'At their desk', x: cfg.desk, z: -7.72, rot: Math.PI,
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
    if (!game.active && Math.random() < 0.25) {
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
    if (pose === 'bed') { hipY = (this.spot?.seat ?? 0.6) + 0.12; rx = -1.48; sh = [0.1, 0.1]; el = [-0.2, -0.2]; }

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
      case 'arcade':
        sh = [-0.9, -0.9]; el = [-0.5 + Math.sin(t * 14) * 0.08, -0.5 + Math.cos(t * 11) * 0.12]; headX = 0.1; rz = Math.sin(t * 2) * 0.04;
        break;
      case 'lift': {
        const p = (Math.sin(t * 2.2) + 1) / 2;
        el = [-0.15 - p * 2.0, -0.15 - (1 - p) * 2.0]; headX = -0.05;
        break;
      }
      case 'stretch':
        sh = [-2.9 + Math.sin(t) * 0.1, -2.9 + Math.sin(t) * 0.1]; shZ = [-0.25, 0.25]; el = [-0.1, -0.1];
        rz = Math.sin(t * 0.8) * 0.18; headX = -0.1;
        break;
      case 'piano':
        sh = [-0.6, -0.6]; el = [-0.9 + Math.sin(t * 16) * 0.06, -0.9 + Math.cos(t * 13) * 0.06]; rx = 0.08; headX = 0.1; headY = Math.sin(t * 0.9) * 0.15;
        break;
      case 'guitar':
        sh = [-0.9, -0.4]; shZ = [-0.35, 0.1]; el = [-1.3, -1.0 + Math.sin(t * 9) * 0.15]; headX = 0.2; headY = Math.sin(t * 1.3) * 0.12;
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
      case 'cook':
        sh = [-0.7, -0.9 + Math.cos(t * 3) * 0.1]; shZ = [-0.06, 0.1 + Math.sin(t * 3) * 0.12]; el = [-0.6, -0.7]; headX = 0.3; rx = 0.05;
        break;
      case 'wash':
        sh = [-0.8, -0.8]; el = [-0.6 + Math.sin(t * 5) * 0.15, -0.6 + Math.cos(t * 5) * 0.15]; headX = 0.3; rx = 0.06;
        break;
      case 'water':
        sh = [0.05, -1.0 + Math.sin(t * 1.2) * 0.1]; el = [-0.12, -0.3]; headX = 0.3;
        break;
      case 'read':
        sh = [-0.5, -0.5]; el = [-1.4, -1.4]; headX = 0.35; rx = 0.05;
        break;
      case 'write':
        sh = [0.05, -1.75 + Math.sin(t * 2.2) * 0.1]; el = [-0.12, -0.35 + Math.cos(t * 2.2) * 0.1];
        shZ = [-0.06, 0.15 + Math.sin(t * 1.1) * 0.12]; headX = -0.1;
        break;
      case 'paint':
        sh = [0.05, -1.3 + Math.sin(t * 3) * 0.12]; el = [-0.12, -0.4 + Math.cos(t * 4) * 0.12];
        shZ = [-0.06, 0.1 + Math.sin(t * 1.5) * 0.1]; headX = -0.05; headY = Math.sin(t * 0.5) * 0.12;
        break;
      case 'sleep':
        hipY += Math.sin(t * 1.1) * 0.008; if (pose !== 'bed') headX = 0.35 + Math.sin(t * 0.3) * 0.03;
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
    if (pose === 'bed') { hip = [0, 0]; knee = [0.05, 0.05]; }

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
      c.skirt.position.y = 0.95 - 0.25 * c.skirt.scale.y;
    }

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
    c.marker.visible = still === 'write' || still === 'paint';
    c.guitar.visible = still === 'guitar';
    c.can.visible = still === 'water';
    c.bells.forEach((b) => (b.visible = still === 'lift'));
    c.paddle.visible = still === 'pickleball' || (this.moving && this.spot?.kind === 'pickleball');
    c.holo.visible = this.state === 'working' && !this.moving && this.spot === this.deskSpot;
    if (c.holo.visible) {
      c.holo.position.y = 1.5 + Math.sin(t * 2) * 0.02;
      c.holo.material.opacity = 0.75 + Math.sin(t * 4) * 0.12;
    }
    const top = pose === 'bed' ? 1.6 : pose === 'lie' ? 1.9 : pose === 'sit' ? 2.55 : 2.85;
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

/* ---------- 9b. The office cat ---------- */
const cat = (() => {
  const root = new THREE.Group(); scene.add(root);
  const fur = toon('#e08a3c');
  const p = (geo, m, x, y, z, parent = root) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true;
    const ol = new THREE.Mesh(geo, INK); ol.scale.setScalar(1.06); o.add(ol);
    parent.add(o); return o;
  };
  p(new THREE.CapsuleGeometry(0.09, 0.22, 4, 10), fur, 0, 0.2, 0).rotation.x = Math.PI / 2;
  const head = p(new THREE.SphereGeometry(0.1, 16, 12), fur, 0, 0.3, 0.2);
  for (const s of [-1, 1]) {
    p(new THREE.ConeGeometry(0.035, 0.07, 6), fur, s * 0.05, 0.09, 0, head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: '#111' }));
    eye.position.set(s * 0.035, 0.015, 0.085); head.add(eye);
  }
  const tail = p(new THREE.CylinderGeometry(0.018, 0.012, 0.28, 8), fur, 0, 0.36, -0.24);
  tail.rotation.x = -0.6;
  const legs = [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]].map(([x, z]) => p(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), fur, x, 0.06, z));
  root.position.set(3, 0, 0);
  return { root, legs, tail };
})();
const CAT_SPOTS = [[-6, 0], [3, 0], [0.5, -6.6], [8.8, -3.9], [-2, 3.2], [1.5, 7.6], [-12, 0.4], [7, 4.5], [-10, -6.2], [-5, 4.4]];
const catS = { path: [], wait: 3, phase: 0 };
function updateCat(dt) {
  const r = cat.root;
  cat.tail.rotation.z = Math.sin(NOW * 2) * 0.4;
  if (catS.wait > 0) {
    catS.wait -= dt;
    if (catS.wait <= 0) {
      const [x, z] = pick(CAT_SPOTS);
      catS.path = [[r.position.x, AISLE], [x, AISLE], [x, z]];
    }
    return;
  }
  const tgt = catS.path[0];
  if (!tgt) { catS.wait = rand(5, 12); return; }
  const dx = tgt[0] - r.position.x, dz = tgt[1] - r.position.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { catS.path.shift(); return; }
  const s = Math.min(d, 0.7 * dt);
  r.position.x += (dx / d) * s;
  r.position.z += (dz / d) * s;
  turn(r, Math.atan2(dx, dz), Math.min(1, dt * 6));
  catS.phase += dt * 10;
  cat.legs.forEach((l, i) => (l.rotation.x = Math.sin(catS.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5));
}

/* ---------- 10. The team ---------- */
const AGENT_CFG = [
  { id: 'transcriber', name: 'Aira', role: 'Transcriber', task: 'TRANSCRIBING', desk: -13, holo: 'wave',
    look: { type: 'female', skin: '#f8dccb', hair: '#4a2c20', brow: '#3a2218', eyes: ['#1c1210', '#5a3a2c'],
      dress: '#16267a', headphones: true } },
  { id: 'summarizer', name: 'Joshua', role: 'Summarizer', task: 'SUMMARIZING', desk: -10, holo: 'check',
    look: { type: 'male', skin: '#f6d8c4', hair: '#121016', brow: '#15110f', eyes: ['#1a1210', '#4a3428'],
      shirt: '#f6f7f9', pants: '#121418', tie: '#1b2f7a', seed: 3 } },
  { id: 'slides', name: 'Jojo', role: 'Slide designer', task: 'BUILDING SLIDES', desk: -7, holo: 'bars',
    look: { type: 'male', skin: '#f6d8c4', hair: '#6b4128', brow: '#3e2416', eyes: ['#1a1210', '#4a3428'],
      shirt: '#f6f7f9', pants: '#121418', tie: '#1b2f7a', smile: 'open', seed: 11 } },
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
  zoomGoal = 5;
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
function drawArcade() {
  const { ctx: g, tex, W: w, H: h } = arcadeScreen;
  const t = NOW;
  g.fillStyle = '#05040a'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.6)';
  for (let i = 0; i < 40; i++) g.fillRect(rnd(i) * w, (rnd(i + 50) * h + t * 40 * (0.5 + rnd(i + 9))) % h, 2, 2);
  if (!playing(['arcade'])) {
    g.fillStyle = Math.floor(t * 2) % 2 ? '#fbbf24' : '#f472b6'; g.font = `800 28px ${MONO}`; g.textAlign = 'center';
    g.fillText('INSERT COIN', w / 2, h / 2 + 10); g.textAlign = 'left';
  } else {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
      g.fillStyle = ['#f472b6', '#a3d4e0', '#fbbf24'][r];
      g.fillRect(40 + c * 36 + Math.sin(t * 1.5) * 20, 26 + r * 22, 20, 12);
    }
    const sx = w / 2 + Math.sin(t * 2.1) * 100;
    g.fillStyle = '#34d399'; g.beginPath(); g.moveTo(sx, h - 36); g.lineTo(sx - 14, h - 16); g.lineTo(sx + 14, h - 16); g.fill();
    g.fillStyle = '#fff'; g.fillRect(sx - 1, h - 46 - ((t * 300) % 110), 2, 10);
    g.font = `700 12px ${MONO}`; g.fillText('SCORE ' + String(Math.floor(t * 37) % 100000).padStart(5, '0'), 10, 16);
  }
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
  updateCat(dt);

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
    drawArcade();
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
