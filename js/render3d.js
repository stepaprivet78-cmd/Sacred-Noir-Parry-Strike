// =========================================================================
// SACRED NOIR 3D — Three.js renderer
// Игровая логика остаётся в 2D-координатах (x, y = пол, jumpZ = высота),
// этот модуль только визуализирует её в 3D.
// =========================================================================
'use strict';

const S3 = 1 / 20;                                   // 20 логических px = 1 юнит
const wx = x => (x - 600) * S3;                      // логика X -> мир X
const wz = y => (y - 350) * S3;                      // логика Y -> мир Z
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

const R3 = {
  ready: false, pools: {}, ndc: { x: 0, y: 0, has: false },
  arenaDirty: true, lastUpload: 0, arenaKey: '', bossRef: null,
  camT: V3(0, 0, 0), camDist: 34, face: 0, ghostTimer: 0, ghosts: [], vw: 1, vh: 1
};

function markArenaDirty() { R3.arenaDirty = true; }

const _colorCache = new Map();
function C(str) {
  let c = _colorCache.get(str);
  if (!c) { c = new THREE.Color(str); _colorCache.set(str, c); }
  return c;
}

function lerpAngle(a, b, t) {
  const TAU = Math.PI * 2;
  const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

// ---------- materials & helpers ----------
const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.2 }, o));
const glowMat = (color, intensity = 1.4) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
const addMat = (color, opacity = 1, map = null) => new THREE.MeshBasicMaterial({
  color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});

function makeGlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function makeDashTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 36, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function makeVGradTex() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 64, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}
function glowSprite(color, size, opacity = 0.8) {
  const m = new THREE.SpriteMaterial({ map: R3.glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}
function seg(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.75, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  return m;
}
function disposeTree(o) {
  o.traverse(n => {
    if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
    if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose());
  });
}

// =========================================================================
// INIT
// =========================================================================
function init3D() {
  const gl = document.getElementById('gl-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: !isTouchDevice, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = !lowGfx;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  R3.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050204');
  scene.fog = new THREE.Fog('#070205', 42, 105);
  R3.scene = scene;
  R3.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
  R3.glowTex = makeGlowTex();
  R3.dashTex = makeDashTex();
  R3.vGradTex = makeVGradTex();
  R3.tmpV = V3(0, 0, 0);
  R3.raycaster = new THREE.Raycaster();
  R3.groundPlane = new THREE.Plane(V3(0, 1, 0), 0);

  R3.hemi = new THREE.HemisphereLight('#7a3346', '#0a0206', 0.8);
  scene.add(R3.hemi);
  scene.add(new THREE.AmbientLight('#2a1018', 0.55));
  const moon = new THREE.DirectionalLight('#ffd6dc', 0.85);
  moon.position.set(-14, 40, 18);
  moon.castShadow = !lowGfx;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 24; sc.bottom = -24; sc.near = 5; sc.far = 95;
  moon.shadow.bias = -0.0008;
  scene.add(moon);
  R3.moon = moon;

  // Огромная Кровавая Луна / Затмение на горизонте за ареной
  const moonGrp = new THREE.Group();
  moonGrp.position.set(0, 18, -72);
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(13, 48),
    new THREE.MeshBasicMaterial({ color: '#e11d48', fog: false })
  );
  const moonCore = new THREE.Mesh(
    new THREE.CircleGeometry(11.6, 48),
    new THREE.MeshBasicMaterial({ color: '#090206', fog: false })
  );
  moonCore.position.z = 0.08;
  const moonHalo = glowSprite('#e11d48', 46, 0.55);
  moonHalo.material.fog = false;
  moonHalo.position.z = -0.2;
  moonGrp.add(moonHalo, moonDisc, moonCore);
  scene.add(moonGrp);
  R3.skyMoon = { grp: moonGrp, disc: moonDisc, core: moonCore, halo: moonHalo };

  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#08020a', roughness: 1 }));
  abyss.rotation.x = -Math.PI / 2; abyss.position.y = -0.06;
  scene.add(abyss);

  R3.arenaTex = new THREE.CanvasTexture(arenaCanvas);
  R3.arenaTex.anisotropy = 4;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LOGICAL_WIDTH * S3, LOGICAL_HEIGHT * S3),
    new THREE.MeshStandardMaterial({ map: R3.arenaTex, roughness: 0.8, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  R3.arenaGroup = new THREE.Group(); scene.add(R3.arenaGroup);
  R3.dyn = new THREE.Group(); scene.add(R3.dyn);

  const shared = g => { g.userData.shared = true; return g; };
  R3.geo = {
    orb: shared(new THREE.SphereGeometry(0.42, 12, 10)),
    bladeP: shared(new THREE.ConeGeometry(0.32, 1.1, 4).rotateZ(-Math.PI / 2)),
    arc: shared(new THREE.RingGeometry(0.78, 1, 28, 1, -1.05, 2.1).rotateX(-Math.PI / 2)),
    ring: shared(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2)),
    thinRing: shared(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2)),
    waveArc: shared(new THREE.RingGeometry(0.72, 1, 24, 1, -0.95, 1.9).rotateX(-Math.PI / 2)),
    disc: shared(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)),
    box: shared(new THREE.BoxGeometry(1, 1, 1)),
    spike: shared(new THREE.ConeGeometry(0.55, 1.7, 4)),
    tube: shared(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true)),
    ghost: shared(new THREE.ConeGeometry(0.7, 2.3, 8)),
    plane: shared(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2))
  };

  initFx3D();
  initParticles3D();
  initAsh3D();

  window.addEventListener('resize', resize3D);
  resize3D();
  R3.ready = true;
}

function applyGfx3D() {
  if (!R3.ready) return;
  R3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowGfx ? 1 : 2));
  R3.renderer.shadowMap.enabled = !lowGfx;
  R3.moon.castShadow = !lowGfx;
  R3.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  R3.arenaKey = '';
  resize3D();
}

function resize3D() {
  const w = window.innerWidth, h = window.innerHeight;
  R3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowGfx ? 1 : 2));
  R3.renderer.setSize(w, h, false);
  R3.camera.aspect = w / h;
  R3.camera.updateProjectionMatrix();
  const dpr = lowGfx ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  R3.dpr = dpr; R3.vw = w; R3.vh = h;
}

function setPointer3D(u, v) {
  R3.ndc.x = u * 2 - 1; R3.ndc.y = -(v * 2 - 1); R3.ndc.has = true;
}

// =========================================================================
// ARENA
// =========================================================================
function buildArena3D() {
  const g = R3.arenaGroup;
  for (let i = g.children.length - 1; i >= 0; i--) { const c = g.children[i]; g.remove(c); disposeTree(c); }
  R3.torches = [];

  const ax = wx(ARENA.x), az = wz(ARENA.y), aw = ARENA.w * S3, ah = ARENA.h * S3;
  const cx = ax + aw / 2, cz = az + ah / 2;
  const stone = stdMat('#1d1319', { roughness: 0.92, metalness: 0.05 });
  const bt = 0.7, bh = 0.5;

  [[cx, az - bt / 2, aw + bt * 2, bt], [cx, az + ah + bt / 2, aw + bt * 2, bt], [ax - bt / 2, cz, bt, ah], [ax + aw + bt / 2, cz, bt, ah]]
    .forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), stone);
      m.position.set(x, bh / 2, z); m.castShadow = m.receiveShadow = true; g.add(m);
    });

  // Пульсирующая рунная стена
  const wallH = 1.9;
  R3.wallMat = addMat('#e11d48', 0.3, R3.vGradTex);
  [[cx, az, aw, 0], [cx, az + ah, aw, 0], [ax, cz, ah, Math.PI / 2], [ax + aw, cz, ah, Math.PI / 2]].forEach(([x, z, len, rot]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, wallH), R3.wallMat);
    m.position.set(x, bh + wallH / 2, z); m.rotation.y = rot; g.add(m);
  });

  // Шипы
  const spikeGeo = new THREE.ConeGeometry(0.2, 0.85, 5);
  const spikeMat = stdMat('#2a1922');
  const n = Math.max(4, Math.floor(aw / 1.8));
  for (let i = 0; i <= n; i++) {
    const x = ax + i * (aw / n);
    [az - bt / 2, az + ah + bt / 2].forEach(z => {
      const m = new THREE.Mesh(spikeGeo, spikeMat); m.position.set(x, bh + 0.42, z); m.castShadow = true; g.add(m);
    });
  }

  // Угловые пилоны с факелами
  [[ax - 0.6, az - 0.6], [ax + aw + 0.6, az - 0.6], [ax - 0.6, az + ah + 0.6], [ax + aw + 0.6, az + ah + 0.6]].forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 3.0, 8), stone);
    p.position.set(x, 1.5, z); p.castShadow = true; g.add(p);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.38, 0.4, 10), stdMat('#3a2530', { metalness: 0.6 }));
    bowl.position.set(x, 3.2, z); g.add(bowl);
    const fl = glowSprite('#ff4155', 2.8, 0.95); fl.position.set(x, 3.8, z); g.add(fl);
    const fl2 = glowSprite('#ffd0a0', 1.0, 0.9); fl2.position.set(x, 3.6, z); g.add(fl2);
    let light = null;
    if (!lowGfx) { light = new THREE.PointLight('#ff3355', 1.6, 22, 1.6); light.position.set(x, 4, z); g.add(light); }
    R3.torches.push({ fl, fl2, light, i });
  });

  // Ритуальная печать в центре
  const seal = new THREE.Group(); seal.position.set(cx, 0.03, cz);
  const sMat = addMat('#e11d48', 0.24);
  R3.sealMat = sMat;
  const sr = Math.min(aw, ah) * 0.28;
  [[sr * 0.97, sr], [sr * 0.71, sr * 0.74]].forEach(([a, b]) => {
    seal.add(new THREE.Mesh(new THREE.RingGeometry(a, b, 64).rotateX(-Math.PI / 2), sMat));
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sr * 0.26, 0.08).rotateX(-Math.PI / 2), sMat);
    m.position.set(Math.cos(a) * sr * 0.87, 0, Math.sin(a) * sr * 0.87); m.rotation.y = -a; seal.add(m);
  }
  g.add(seal); R3.seal = seal;

  // Руины в бездне
  let seed = 1337;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ruinMat = stdMat('#140c11', { roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 34 + rnd() * 22;
    const h = 3 + rnd() * 11;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7 + rnd() * 0.6, 1 + rnd() * 0.8, h, 7), ruinMat);
    m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r * 0.75 - 6);
    m.rotation.z = (rnd() - 0.5) * 0.3;
    g.add(m);
  }
}

function updateArenaFx(time) {
  const accent = (typeof boss !== 'undefined' && boss && gameState !== 'MENU') ? boss.color : '#e11d48';
  const p2 = !!(typeof boss !== 'undefined' && boss && boss.phase2 && gameState !== 'MENU');
  const col = C(accent);

  if (R3.seal) R3.seal.rotation.y = time * (p2 ? 0.28 : 0.14);
  if (R3.sealMat) R3.sealMat.color.lerp(col, 0.06);
  if (R3.wallMat) {
    R3.wallMat.color.lerp(col, 0.06);
    R3.wallMat.opacity = (0.55 + Math.sin(time * (p2 ? 7.5 : 4.5)) * 0.25) * (p2 ? 0.65 : 0.5);
  }
  if (R3.hemi) R3.hemi.color.lerp(col, 0.04);
  if (R3.scene && R3.scene.fog) {
    const fogTarget = col.clone().multiplyScalar(p2 ? 0.16 : 0.09);
    R3.scene.fog.color.lerp(fogTarget, 0.04);
  }
  if (R3.skyMoon) {
    R3.skyMoon.disc.material.color.lerp(col, 0.06);
    R3.skyMoon.halo.material.color.lerp(col, 0.06);
    const pulse = 1 + Math.sin(time * (p2 ? 4 : 1.5)) * (p2 ? 0.08 : 0.03);
    R3.skyMoon.halo.scale.setScalar((p2 ? 56 : 44) * pulse);
    R3.skyMoon.halo.material.opacity = p2 ? 0.78 : 0.48;
    R3.skyMoon.core.scale.setScalar(p2 ? 0.82 : 0.92);
  }
  (R3.torches || []).forEach(t => {
    const f = 0.8 + Math.sin(time * 14 + t.i * 2.1) * 0.15 + Math.sin(time * 23 + t.i) * 0.06;
    t.fl.material.color.lerp(col, 0.06);
    t.fl.scale.set(2.8 * f, 3.2 * f, 1);
    t.fl2.scale.setScalar(1.0 * f);
    if (t.light) { t.light.color.lerp(col, 0.06); t.light.intensity = (p2 ? 1.9 : 1.4) * f; }
  });
}

// =========================================================================
// PLAYER
// =========================================================================
function buildPlayer3D(skin) {
  if (R3.player) {
    R3.dyn.remove(R3.player.group); disposeTree(R3.player.group);
    R3.player.scarf.forEach(s => { R3.dyn.remove(s); disposeTree(s); });
    if (R3.player.trailMesh) { R3.dyn.remove(R3.player.trailMesh); disposeTree(R3.player.trailMesh); }
  }
  const styleId = typeof activeStyleId !== 'undefined' ? activeStyleId : 'ronin';
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const dark = stdMat('#17161b', { roughness: 0.85 });
  const trimMat = glowMat(skin.hatTrim, 1.35);
  const eyeMat = glowMat(skin.glow, 2.2);

  if (styleId === 'executioner') {
    // 🔥 ПАЛАЧ: крупный массивный воин в броне и железной маске с рогами
    const armor = stdMat('#1c1519', { roughness: 0.45, metalness: 0.65 });
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.92, 1.75, 10), dark); cloak.position.y = 0.88; body.add(cloak);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 1.15), armor); chest.position.y = 1.95; body.add(chest);
    [-0.72, 0.72].forEach(z => {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), armor);
      pauldron.scale.set(1, 0.85, 1.1); pauldron.position.set(0, 2.25, z); body.add(pauldron);
    });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.56, 8), stdMat('#27272a', { metalness: 0.8, roughness: 0.3 }));
    head.position.y = 2.6; body.add(head);
    const maskPlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.44), trimMat);
    maskPlate.position.set(0.28, 2.58, 0); body.add(maskPlate);
    [-0.22, 0.22].forEach(z => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 6), trimMat);
      horn.position.set(0.05, 2.98, z); horn.rotation.x = z > 0 ? 0.45 : -0.45; body.add(horn);
    });
    [-0.1, 0.1].forEach(z => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.1), eyeMat); e.position.set(0.35, 2.62, z); body.add(e); });
  } else if (styleId === 'phantom') {
    // 💨 ПРИЗРАК: стройный, манёвренный ассасин в капюшоне-тени
    const shadowMat = stdMat('#0f0c18', { roughness: 0.7, transparent: true, opacity: 0.88 });
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.58, 1.4, 10), shadowMat); cloak.position.y = 0.7; body.add(cloak);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.58, 10), stdMat('#1b1626')); torso.position.y = 1.55; body.add(torso);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 10), shadowMat); hood.position.set(-0.04, 2.08, 0); hood.rotation.z = 0.18; body.add(hood);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.28), eyeMat); visor.position.set(0.22, 1.96, 0); body.add(visor);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 6, 20), trimMat); band.rotation.x = Math.PI / 2; band.position.y = 1.85; body.add(band);
  } else {
    // ⚔️ РОНИН: классический самурай в широкополой шляпе-касе с двумя катанами
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.72, 1.5, 10), dark); cloak.position.y = 0.75; body.add(cloak);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.6, 10), stdMat('#232028')); torso.position.y = 1.65; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), stdMat('#2b2226')); head.position.y = 2.05; body.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.45, 18), stdMat('#0b0a0d', { roughness: 0.6 })); hat.position.y = 2.32; body.add(hat);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.035, 6, 28), trimMat); trim.rotation.x = Math.PI / 2; trim.position.y = 2.1; body.add(trim);
    [-0.09, 0.09].forEach(z => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), eyeMat); e.position.set(0.24, 2.04, z); body.add(e); });
  }

  const mkBlade = mat => {
    const p = new THREE.Group();
    if (styleId === 'executioner') {
      // Огромный двуручный тесак Палача
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.09), stdMat('#3f1d24')); handle.position.x = 0.25; p.add(handle);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.34), stdMat('#c9a227', { metalness: 0.85 })); guard.position.x = 0.52; p.add(guard);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.32), mat); bl.position.x = 1.7; p.add(bl);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4).rotateZ(-Math.PI / 2), mat); tip.position.x = 3.05; p.add(tip);
    } else if (styleId === 'phantom') {
      // Короткий клинок-кинжал Призрака
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.06), stdMat('#1f1a24')); handle.position.x = 0.12; p.add(handle);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.12), stdMat('#94a3b8', { metalness: 0.8 })); guard.position.x = 0.25; p.add(guard);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.028, 0.085), mat); bl.position.x = 0.72; p.add(bl);
    } else {
      // Классическая катана Ронина
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.07, 0.07), stdMat('#3f1d24')); handle.position.x = 0.18; p.add(handle);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.16), stdMat('#c9a227', { metalness: 0.8 })); guard.position.x = 0.36; p.add(guard);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.035, 0.11), mat); bl.position.x = 1.15; p.add(bl);
    }
    return p;
  };
  const bladeMat = glowMat(skin.blade, 1.9);
  const dualMat = glowMat(styleId === 'phantom' ? skin.blade : skin.dualBlade, 2.1);
  const blade1 = mkBlade(bladeMat); blade1.position.set(0.15, 1.35, 0.42); body.add(blade1);
  const blade2 = mkBlade(dualMat); blade2.position.set(0.15, 1.35, -0.42); body.add(blade2);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const pCol = skin.parryColor || skin.glow;
  const parry = new THREE.Mesh(R3.geo.thinRing, addMat(pCol, 0.92)); parry.position.y = 0.35; g.add(parry);
  const parryDome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), addMat(pCol, 0.22)); g.add(parryDome);
  const shield = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 16), addMat(skin.dualBlade || '#ff1744', 0.85)); shield.rotation.x = Math.PI / 2; shield.position.y = 1.2; g.add(shield);
  const light = new THREE.PointLight(skin.glow, 1.25, 9); light.position.y = 1.6; g.add(light);
  const aura = glowSprite(skin.glow, 2.8, 0.16); aura.position.y = 1.3; g.add(aura);
  // Тонкое кольцо-подсветка под ногами героя для идеальной читаемости в замесе
  const footRing = new THREE.Mesh(R3.geo.thinRing, addMat(skin.glow, 0.55));
  footRing.position.y = 0.05; footRing.scale.setScalar(0.95); g.add(footRing);
  R3.dyn.add(g);

  const scarfMat = glowMat(skin.scarf, 1.05);
  const scarf = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.26 - i * 0.02, 0.06, 0.38), scarfMat);
    m.castShadow = true; R3.dyn.add(m); scarf.push(m);
  }

  // Динамический 3D-шлейф (Ribbon Trail) кончика катаны в цвете скина
  const TN = 16;
  const tPos = new Float32Array(TN * 2 * 3);
  const tCol = new Float32Array(TN * 2 * 3);
  const idx = [];
  for (let i = 0; i < TN - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  tGeo.setIndex(idx);
  const tMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const trailMesh = new THREE.Mesh(tGeo, tMat);
  trailMesh.frustumCulled = false;
  R3.dyn.add(trailMesh);
  const trailPts = [];
  for (let i = 0; i < TN; i++) trailPts.push({ bx: 0, by: 0, bz: 0, tx: 0, ty: 0, tz: 0 });

  R3.player = {
    skinId: skin.id, styleId, group: g, body, blade1, blade2,
    bladeMat, dualMat, trimMat, scarfMat, eyeMat,
    parry, parryDome, shield, light, aura, scarf,
    trailMesh, trailGeo: tGeo, trailPts, trailInit: false,
    lastX: null, lastY: null, bob: 0, lean: 0
  };
}

function refreshPlayerSkin3D() {
  if (!R3.ready || typeof getActiveSkin !== 'function') return;
  buildPlayer3D(getActiveSkin());
}

function resetBladeTrail() {
  if (R3.player) R3.player.trailInit = false;
}

function setMatCol(m, col, intensity) {
  m.color.copy(C(col));
  if (m.emissive) {
    m.emissive.copy(C(col));
    if (intensity !== undefined) m.emissiveIntensity = intensity;
  }
}

const _trailBase = new THREE.Vector3();
const _trailTip = new THREE.Vector3();

function updateBladeTrail3D(P, skin, activeBoost, jumpReset) {
  const pts = P.trailPts, TN = pts.length;
  P.group.updateMatrixWorld(true);
  const tipX = P.styleId === 'executioner' ? 3.1 : (P.styleId === 'phantom' ? 1.18 : 1.92);
  _trailBase.set(0.45, 0, 0); P.blade1.localToWorld(_trailBase);
  _trailTip.set(tipX, 0, 0); P.blade1.localToWorld(_trailTip);

  if (!P.trailInit || jumpReset) {
    for (let i = 0; i < TN; i++) {
      pts[i].bx = _trailBase.x; pts[i].by = _trailBase.y; pts[i].bz = _trailBase.z;
      pts[i].tx = _trailTip.x; pts[i].ty = _trailTip.y; pts[i].tz = _trailTip.z;
    }
    P.trailInit = true;
  } else {
    for (let i = TN - 1; i > 0; i--) {
      pts[i].bx = pts[i - 1].bx; pts[i].by = pts[i - 1].by; pts[i].bz = pts[i - 1].bz;
      pts[i].tx = pts[i - 1].tx; pts[i].ty = pts[i - 1].ty; pts[i].tz = pts[i - 1].tz;
    }
    pts[0].bx = _trailBase.x; pts[0].by = _trailBase.y; pts[0].bz = _trailBase.z;
    pts[0].tx = _trailTip.x; pts[0].ty = _trailTip.y; pts[0].tz = _trailTip.z;
  }

  const pos = P.trailGeo.attributes.position.array;
  const col = P.trailGeo.attributes.color.array;
  const cTip = C(skin.slashMain || skin.blade);
  const cGlow = C(skin.glow);

  for (let i = 0; i < TN; i++) {
    const f = Math.pow(1 - i / (TN - 1), 1.65) * activeBoost;
    const k = i * 6;
    pos[k] = pts[i].bx; pos[k + 1] = pts[i].by; pos[k + 2] = pts[i].bz;
    pos[k + 3] = pts[i].tx; pos[k + 4] = pts[i].ty; pos[k + 5] = pts[i].tz;
    col[k] = cGlow.r * f * 0.45; col[k + 1] = cGlow.g * f * 0.45; col[k + 2] = cGlow.b * f * 0.45;
    col[k + 3] = cTip.r * f; col[k + 4] = cTip.g * f; col[k + 5] = cTip.b * f;
  }
  P.trailGeo.attributes.position.needsUpdate = true;
  P.trailGeo.attributes.color.needsUpdate = true;
}

function updatePlayer3D(dt, show) {
  const P = R3.player;
  const skin = getActiveSkin();

  // В главном меню показываем 3D-ронина в центре печати, чтобы сразу видеть выбранный скин катаны!
  if (!show) {
    const inMenu = typeof gameState !== 'undefined' && gameState === 'MENU';
    P.group.visible = inMenu;
    P.trailMesh.visible = inMenu;
    P.scarf.forEach(s => s.visible = inMenu);
    if (inMenu) {
      const mt = performance.now() / 1000;
      P.group.position.set(0, 0, 0);
      P.group.rotation.y = mt * 0.45;
      P.body.rotation.set(0, 0, 0);
      P.body.position.y = Math.sin(mt * 2.2) * 0.06;
      P.body.visible = true;
      P.blade1.rotation.y = -0.35 + Math.sin(mt * 2.6) * 0.55;
      P.blade2.rotation.y = -P.blade1.rotation.y;
      P.blade2.visible = P.styleId === 'phantom' || P.styleId === 'ronin';
      P.parry.visible = P.parryDome.visible = P.shield.visible = false;
      setMatCol(P.bladeMat, skin.blade, 2.2);
      setMatCol(P.trimMat, skin.hatTrim, 1.4);
      setMatCol(P.scarfMat, skin.scarf, 1.1);
      setMatCol(P.eyeMat, skin.glow, 2.3);
      P.light.color.copy(C(skin.glow)); P.light.intensity = 1.6;
      P.aura.material.color.copy(C(skin.glow)); P.aura.material.opacity = 0.25;
      for (let i = 0; i < P.scarf.length; i++) {
        const m = P.scarf[i];
        const a = -P.group.rotation.y + Math.PI;
        m.position.set(Math.cos(a) * (0.3 + i * 0.32), 1.85 - i * 0.09 + Math.sin(mt * 5 + i) * 0.04, Math.sin(a) * (0.3 + i * 0.32));
        m.rotation.set(0, P.group.rotation.y + Math.PI / 2, 0);
      }
      updateBladeTrail3D(P, skin, 0.75, false);
    } else {
      P.trailInit = false;
    }
    P.lastX = null; P.lastY = null;
    return;
  }

  if (!player || player.dead) {
    P.group.visible = false; P.trailMesh.visible = false; P.scarf.forEach(s => s.visible = false);
    P.trailInit = false; P.lastX = null; P.lastY = null;
    return;
  }

  P.group.visible = true;
  P.trailMesh.visible = true;
  const rage = player.rageTimer > 0, dual = player.dualBladeTimer > 0;

  const X = wx(player.x), Z = wz(player.y);
  let speed = 0, jumped = false;
  if (P.lastX !== null && dt > 0) {
    const distPx = Math.hypot(player.x - P.lastX, player.y - P.lastY);
    speed = distPx / dt;
    if (distPx > 140) jumped = true; // телепорт Иайдо / Казни
  }
  P.lastX = player.x; P.lastY = player.y;
  P.group.position.set(X, 0, Z);
  P.group.rotation.y = -player.angle;

  const moving = speed > 30 && speed < 2000;
  P.bob += dt * (moving ? 14 : 2);
  const dashing = player.dashTimer > 0;
  const targetLean = dashing ? -0.45 : (moving ? -0.14 : 0);
  P.lean += (targetLean - P.lean) * Math.min(1, dt * 14);
  P.body.rotation.z = P.lean;
  P.body.position.y = moving ? Math.abs(Math.sin(P.bob)) * 0.12 : 0;
  P.body.visible = !(player.invuln > 0 && !dashing && Math.floor(player.invuln * 20) % 2 === 0);

  // Анимация взмаха: 1-2 удар — дуга, 3-й удар — разворот вокруг себя
  if (player.swingAnim > 0) {
    const t = 1 - player.swingAnim / 0.16;
    if (player.comboStep === 0) {
      P.body.rotation.y = -t * Math.PI * 2;
      P.blade1.rotation.y = -1.25;
    } else {
      const dir = player.comboStep === 1 ? 1 : -1;
      P.body.rotation.y = 0;
      P.blade1.rotation.y = (-1.3 + 2.6 * t) * dir;
    }
  } else {
    P.body.rotation.y = 0;
    P.blade1.rotation.y += (-0.45 - P.blade1.rotation.y) * Math.min(1, dt * 12);
  }
  P.blade2.rotation.y = -P.blade1.rotation.y;
  P.blade2.visible = dual || P.styleId === 'phantom' || P.styleId === 'ronin';

  // Сохраняем цвет выбранной катаны даже в Ярости, усиливая свечение!
  const rageInt = rage ? 2.85 : 1.9;
  setMatCol(P.bladeMat, dual ? skin.dualBlade : skin.blade, rageInt);
  setMatCol(P.dualMat, skin.dualBlade, rage ? 2.9 : 2.1);
  setMatCol(P.trimMat, skin.hatTrim, rage ? 2.1 : 1.35);
  setMatCol(P.scarfMat, skin.scarf, rage ? 1.8 : 1.05);
  setMatCol(P.eyeMat, skin.glow, rage ? 3.0 : 2.2);

  const parrying = player.parryTimer > 0;
  const pCol = C(skin.parryColor || skin.glow);
  P.parry.visible = P.parryDome.visible = parrying;
  if (parrying) {
    const k = 1 + (0.24 - player.parryTimer) * 1.5;
    P.parry.scale.setScalar(1.6 * k); P.parryDome.scale.setScalar(k);
    P.parry.material.color.copy(pCol);
    P.parryDome.material.color.copy(pCol);
  }
  P.shield.visible = player.dualBladeShield;
  P.shield.material.color.copy(C(skin.dualBlade || '#ff1744'));
  P.shield.rotation.z += dt * 3;

  P.light.color.copy(C(skin.glow));
  P.light.intensity = 1.15 + (rage ? 1.35 : 0) + (dashing ? 1.5 : 0) + (parrying ? 1.5 : 0);
  P.aura.material.color.copy(C(skin.glow));
  P.aura.material.opacity = dashing ? 0.78 : (rage ? 0.48 : 0.16);

  // Шарф
  for (let i = 0; i < P.scarf.length; i++) {
    const pt = player.scarfPoints[i];
    const m = P.scarf[i];
    m.visible = true;
    m.position.set(wx(pt.x), 1.85 - i * 0.1, wz(pt.y));
    const prev = i === 0 ? null : player.scarfPoints[i - 1];
    if (prev) m.lookAt(wx(prev.x), 1.85 - (i - 1) * 0.1, wz(prev.y));
    else m.rotation.set(0, -player.angle + Math.PI / 2, 0);
  }

  // Шлейф клинка (ярче при ударе, рывке и Ярости)
  const trailBoost = player.swingAnim > 0 ? 1.0 : (dashing ? 0.95 : (moving ? 0.55 : 0.25)) * (rage ? 1.25 : 1);
  updateBladeTrail3D(P, skin, Math.min(1.2, trailBoost), jumped);

  // Послеобразы рывка в цвете скина
  R3.ghostTimer -= dt;
  if (dashing && R3.ghostTimer <= 0) {
    R3.ghostTimer = 0.025;
    spawnGhost(X, Z, skin.glow);
  }
}

function spawnGhost(x, z, col) {
  let gObj = R3.ghosts.find(g => g.life <= 0);
  if (!gObj) {
    if (R3.ghosts.length >= 10) return;
    const m = new THREE.Mesh(R3.geo.ghost, addMat('#fff', 0.5));
    R3.dyn.add(m); gObj = { m, life: 0 }; R3.ghosts.push(gObj);
  }
  gObj.life = 0.25; gObj.m.position.set(x, 1.15, z); gObj.m.material.color.copy(C(col)); gObj.m.visible = true;
}
function updateGhosts(dt) {
  R3.ghosts.forEach(g => {
    if (g.life > 0) { g.life -= dt; g.m.material.opacity = Math.max(0, g.life / 0.25) * 0.45; g.m.visible = g.life > 0; }
  });
}

// =========================================================================
// BOSSES (Модульная сборка 3D-модели из BOSS_REGISTRY)
// =========================================================================
function buildBoss3D() {
  if (R3.boss) {
    if (R3.boss.twin) { R3.dyn.remove(R3.boss.twin.group); disposeTree(R3.boss.twin.group); }
    R3.dyn.remove(R3.boss.group); disposeTree(R3.boss.group); R3.boss = null;
  }
  const col = boss.color;
  const root = new THREE.Group(), lift = new THREE.Group(); root.add(lift);
  const shell = stdMat('#1a1016', { roughness: 0.45, metalness: 0.5 });
  const glow = glowMat(col, 1.4);
  const white = glowMat('#ffffff', 1.3);
  const A = (m, x = 0, y = 0, z = 0, p = lift) => { m.position.set(x, y, z); p.add(m); return m; };
  const M = (geo, mat) => new THREE.Mesh(geo, mat);

  const cfg = typeof getBossConfig === 'function' ? getBossConfig(boss.id) : null;
  let anim = () => {};
  if (cfg && typeof cfg.build3D === 'function') {
    anim = cfg.build3D({ A, M, shell, glow, white, col, stdMat, glowMat, addMat, glowSprite, seg, V3, lift, root }) || (() => {});
  } else {
    // Универсальный фоллбэк для новых боссов без кастомной 3D-функции
    const body = A(M(new THREE.OctahedronGeometry(1.4), shell), 0, 2.2, 0);
    const ring = A(M(new THREE.TorusGeometry(2.0, 0.06, 8, 36), glow), 0, 2.2, 0);
    anim = t => { body.rotation.y = t; ring.rotation.x = t * 1.4; };
  }

  lift.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const light = new THREE.PointLight(col, 1.8, 13); light.position.y = 2.6; root.add(light);
  const blob = new THREE.Mesh(R3.geo.disc, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.45, depthWrite: false }));
  blob.position.y = 0.03; blob.scale.setScalar(1.6); root.add(blob);

  const flashMats = [];
  const seen = new Set();
  lift.traverse(o => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !seen.has(o.material)) {
      seen.add(o.material);
      flashMats.push({ m: o.material, e: o.material.emissive.clone(), i: o.material.emissiveIntensity });
    }
  });

  // Луна (второй близнец)
  let twin = null;
  if (boss.twin2) {
    const tg = new THREE.Group();
    const tm = stdMat('#0c1926', { emissive: '#38bdf8', emissiveIntensity: 0.25 });
    const sph = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), tm); sph.position.y = 2.2; sph.castShadow = true; tg.add(sph);
    const cres = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 8, 24, Math.PI * 1.3), glowMat('#bae6fd', 1.6));
    cres.position.set(0.5, 2.2, 0); cres.rotation.y = Math.PI / 2; tg.add(cres);
    const tr = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.04, 6, 40), glowMat('#38bdf8', 1.5)); tr.position.y = 2.2; tr.rotation.x = Math.PI / 2.4; tg.add(tr);
    const tl = new THREE.PointLight('#38bdf8', 1.3, 9); tl.position.y = 2.2; tg.add(tl);
    const tw = new THREE.Mesh(R3.geo.thinRing, addMat('#38bdf8', 0.8)); tw.position.y = 0.06; tg.add(tw);
    const tb = new THREE.Mesh(R3.geo.disc, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false })); tb.position.y = 0.03; tb.scale.setScalar(1.1); tg.add(tb);
    R3.dyn.add(tg);
    twin = { group: tg, mat: tm, sph, ring: tr, wind: tw };
    root.userData.twin = tg;
  }

  R3.dyn.add(root);
  R3.boss = { group: root, lift, anim, light, blob, flashMats, twin, face: 0 };
}

function hideBossFx() {
  const F = R3.fx;
  F.windRing.visible = F.aim.visible = F.glint.visible = F.jump.visible = F.stagger.visible = false;
  syncPool('laser', [], null, null);
}

function updateBoss3D(dt, show) {
  const B = R3.boss;
  if (!B) { hideBossFx(); return; }
  const vis = show && boss && !(boss.dead && (boss._shattered || pendingOutcome !== 'WIN')) && !(boss.sigInvis > 0);
  B.group.visible = !!vis;
  if (B.twin) B.twin.group.visible = !!(show && boss && boss.twin2 && !boss.twin2.dead);
  if (!vis) { hideBossFx(); return; }

  const t = boss.animTime;
  B.group.position.set(wx(boss.x), 0, wz(boss.y));
  let face = player ? Math.atan2(player.y - boss.y, player.x - boss.x) : 0;
  if (boss.windup) face = boss.windup.aimAngle;
  if (boss.isDashing) face = Math.atan2(boss.dashVy, boss.dashVx);
  B.face = lerpAngle(B.face, face, 1 - Math.exp(-dt * 10));
  B.group.rotation.y = -B.face;

  const jumpY = boss.jumpZ * S3 * 1.3;
  B.lift.position.set(0, jumpY + Math.sin(t * 2) * 0.08, 0);
  const stag = boss.staggerTimer > 0;
  B.lift.position.z = stag ? Math.sin(totalTime * 40) * 0.12 : 0;
  B.lift.rotation.z += ((stag ? -0.3 : 0) - B.lift.rotation.z) * Math.min(1, dt * 8);

  const sc = (boss.radius / 30) * (boss.phase2 ? 1.08 : 1);
  let sx = sc, sy = sc, sz = sc;
  if (boss.isDashing) { sx *= 1.25; sz *= 0.85; }
  if (boss.windup) {
    const r = 1 - boss.windup.timer / boss.windup.maxTimer;
    sy *= 1 - 0.14 * Math.sin(r * Math.PI); sx *= 1 + 0.06 * Math.sin(r * Math.PI); sz = sx;
  }
  B.lift.scale.set(sx, sy, sz);
  B.anim(t);

  const flash = boss.hitFlash > 0 || (boss.dead && Math.floor(totalTime * 20) % 2 === 0);
  B.flashMats.forEach(f => {
    if (flash) { f.m.emissive.set('#ffffff'); f.m.emissiveIntensity = 1.6; }
    else { f.m.emissive.copy(f.e); f.m.emissiveIntensity = f.i * (boss.phase2 ? 1.4 : 1); }
  });
  B.light.intensity = (boss.phase2 ? 2.6 : 1.8) + (boss.windup ? 1.5 : 0);
  B.blob.scale.setScalar(1.6 * (boss.radius / 30) * Math.max(0.35, 1 - boss.jumpZ / 300));

  const F = R3.fx;
  // Замах
  if (boss.windup && !boss.dead) {
    const w = boss.windup;
    const ratio = Math.max(0, w.timer / w.maxTimer);
    const col = w.heavy ? '#ff1744' : '#fde047';
    F.windRing.visible = true;
    F.windRing.position.set(wx(boss.x), 0.06, wz(boss.y));
    F.windRing.scale.setScalar((boss.radius + 8 + ratio * 42) * S3);
    F.windRing.material.color.copy(C(col));
    F.aim.visible = true;
    F.aim.position.set(wx(boss.x), 0.05, wz(boss.y));
    F.aim.rotation.y = -w.aimAngle;
    F.aimMesh.material.color.copy(C(col));
    F.aimMesh.material.opacity = w.heavy ? 0.75 : 0.55;
    R3.dashTex.offset.x -= dt * 3;
    F.glint.visible = true;
    F.glint.position.set(wx(boss.x), jumpY + 4.2 * sc, wz(boss.y));
    F.glint.scale.setScalar((14 + (1 - ratio) * 16) * S3 * 3);
    F.glint.material.color.copy(C(col));
  } else { F.windRing.visible = F.aim.visible = F.glint.visible = false; }

  // Прыжок — зона приземления
  if (boss.jumpState) {
    F.jump.visible = true;
    F.jump.position.set(wx(boss.jumpState.tx), 0.07, wz(boss.jumpState.ty));
    F.jump.scale.setScalar(92 * S3 * (0.9 + Math.sin(totalTime * 18) * 0.05));
  } else F.jump.visible = false;

  // Оглушение
  F.stagger.visible = stag;
  if (stag) {
    F.stagger.position.set(wx(boss.x), 0.08, wz(boss.y));
    F.stagger.scale.setScalar((boss.radius * S3 + 0.6) * (1 + Math.sin(totalTime * 16) * 0.12));
  }

  // Лазеры
  syncPool('laser', boss.lasers, () => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(R3.geo.box, addMat('#fff', 0.55));
    const inner = new THREE.Mesh(R3.geo.box, addMat('#ffffff', 1));
    g.add(outer, inner); g.userData = { outer, inner }; return g;
  }, (o, l) => {
    const u = o.userData, len = l.len * S3;
    o.position.set(wx(boss.x), 1.3, wz(boss.y));
    o.rotation.y = -l.angle;
    const flick = 1 + Math.sin(totalTime * 50) * 0.08;
    u.outer.scale.set(len, 0.55 * flick, 0.55 * flick); u.outer.position.x = len / 2;
    u.inner.scale.set(len, 0.15, 0.15); u.inner.position.x = len / 2;
    u.outer.material.color.copy(C(l.color));
  });

  // Луна
  if (B.twin && boss.twin2 && !boss.twin2.dead) {
    const t2 = boss.twin2, T = B.twin;
    T.group.position.set(wx(t2.x), Math.sin(totalTime * 2.5) * 0.15, wz(t2.y));
    T.ring.rotation.z = totalTime;
    T.group.rotation.y = player ? -Math.atan2(player.y - t2.y, player.x - t2.x) : 0;
    if (t2.hitFlash > 0) { T.mat.emissive.set('#ffffff'); T.mat.emissiveIntensity = 1.5; }
    else { T.mat.emissive.set('#38bdf8'); T.mat.emissiveIntensity = 0.25; }
    T.wind.visible = !!t2.windup;
    if (t2.windup) T.wind.scale.setScalar((t2.radius + 8 + (t2.windup.timer / t2.windup.maxTimer) * 28) * S3);
  }
}

// =========================================================================
// FX: pools for dynamic entities
// =========================================================================
function initFx3D() {
  const F = {};
  F.windRing = new THREE.Mesh(R3.geo.thinRing, addMat('#fde047', 0.9));
  F.aim = new THREE.Group();
  F.aimMesh = new THREE.Mesh(R3.geo.plane, addMat('#fde047', 0.6, R3.dashTex));
  F.aimMesh.scale.set(16, 1, 0.18); F.aimMesh.position.x = 8;
  R3.dashTex.repeat.set(12, 1);
  F.aim.add(F.aimMesh);
  F.glint = glowSprite('#ffffff', 1.5, 1);
  F.jump = new THREE.Group();
  F.jump.add(new THREE.Mesh(R3.geo.disc, addMat('#e11d48', 0.22)));
  F.jump.add(new THREE.Mesh(R3.geo.thinRing, addMat('#ff1744', 0.9)));
  F.stagger = new THREE.Mesh(R3.geo.ring, addMat('#ff1744', 0.6));
  F.reticle = new THREE.Mesh(R3.geo.thinRing, addMat('#ffffff', 0.5));
  F.reticle.scale.setScalar(0.45);
  F.clashGlow = glowSprite('#fde047', 6, 0.9);
  Object.values(F).forEach(o => { if (o.isObject3D && o !== F.aimMesh) { o.visible = false; R3.scene.add(o); } });
  R3.fx = F;
}

function syncPool(key, list, create, update) {
  let P = R3.pools[key];
  if (!P) { if (!create) return; P = R3.pools[key] = { items: [] }; }
  while (P.items.length < list.length) { const o = create(); R3.dyn.add(o); P.items.push(o); }
  for (let i = 0; i < P.items.length; i++) {
    const o = P.items[i];
    if (i < list.length) { o.visible = true; update(o, list[i], i); } else o.visible = false;
  }
}

function updatePools3D(show) {
  const E = [];
  const skin = getActiveSkin();

  syncPool('proj', show ? projectiles : E, () => {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#fff' });
    const orb = new THREE.Mesh(R3.geo.orb, m);
    const blade = new THREE.Mesh(R3.geo.bladeP, m);
    const glow = glowSprite('#fff', 1.8, 0.9);
    g.add(orb, blade, glow); g.userData = { m, orb, blade, glow }; return g;
  }, (o, p) => {
    const u = o.userData, col = p.reflected ? (p.reflectedColor || skin.parryColor || skin.glow) : p.color;
    u.m.color.copy(C(col)); u.glow.material.color.copy(C(col));
    u.orb.visible = p.shape !== 'blade'; u.blade.visible = p.shape === 'blade';
    o.position.set(wx(p.x), 1.1, wz(p.y));
    o.rotation.y = -Math.atan2(p.vy, p.vx);
    if (p.shape === 'blade') u.blade.rotation.x = totalTime * 20;
  });

  syncPool('wave', show ? playerWaves : E, () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(R3.geo.waveArc, addMat('#fff', 1));
    const b = new THREE.Mesh(R3.geo.waveArc, addMat('#fff', 0.65)); b.scale.setScalar(1.28); b.position.x = -0.3;
    const gl = glowSprite('#fff', 2.8, 0.55);
    g.add(a, b, gl); g.userData = { a, b, gl }; return g;
  }, (o, w) => {
    const u = o.userData;
    const wMain = w.waveMain || skin.waveMain;
    const wOuter = w.waveOuter || skin.waveOuter;
    o.position.set(wx(w.x), 1.0, wz(w.y));
    o.rotation.y = -w.angle;
    o.scale.setScalar(1.5 * (w.isRage ? 1.18 : 1) * (1 + (0.72 - w.life) * 0.6));
    u.a.material.color.copy(C(wMain));
    u.b.material.color.copy(C(wOuter));
    u.gl.material.color.copy(C(wOuter));
    const op = Math.min(1, w.life * 3);
    u.a.material.opacity = op; u.b.material.opacity = op * (w.isRage ? 0.85 : 0.6);
    u.gl.material.opacity = op * (w.isRage ? 0.7 : 0.45);
  });

  syncPool('slash', show ? slashArcs : E, () => {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(R3.geo.arc, addMat('#fff', 1));
    const full = new THREE.Mesh(R3.geo.ring, addMat('#fff', 1));
    const gl = glowSprite('#fff', 3.2, 0.45);
    g.add(arc, full, gl); g.userData = { arc, full, gl }; return g;
  }, (o, s) => {
    const u = o.userData, a = s.life / s.maxLife;
    const col = s.bossCol || s.col || (s.isDual ? skin.dualBlade : (s.step === 2 ? skin.slashFinisher : skin.slashMain));
    u.arc.visible = s.step !== 2; u.full.visible = s.step === 2;
    const m = s.step === 2 ? u.full : u.arc;
    m.material.color.copy(C(col)); m.material.opacity = a;
    u.gl.material.color.copy(C(s.bossCol || skin.glow));
    u.gl.material.opacity = a * (s.isRage ? 0.65 : 0.35);
    o.position.set(wx(s.x), 1.1, wz(s.y));
    const dir = s.step === 0 ? 1 : -1;
    o.rotation.y = -(s.angle + dir * (a - 0.5) * 0.8);
    o.scale.setScalar(s.radius * 0.88 * S3 * (s.isRage ? 1.14 : 1) * (1 + (1 - a) * 0.15));
  });

  syncPool('rift', iaidoRifts, () => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(R3.geo.box, addMat('#e879f9', 1));
    const inner = new THREE.Mesh(R3.geo.box, addMat('#ffffff', 1));
    g.add(outer, inner); g.userData = { outer, inner }; return g;
  }, (o, r) => {
    const u = o.userData, a = r.life / r.maxLife;
    const x1 = wx(r.x1), z1 = wz(r.y1), x2 = wx(r.x2), z2 = wz(r.y2);
    const len = Math.hypot(x2 - x1, z2 - z1);
    o.position.set((x1 + x2) / 2, 1.0, (z1 + z2) / 2);
    o.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    u.outer.scale.set(len, 0.55 * a, 0.55 * a);
    u.inner.scale.set(len, 0.16 * a, 0.16 * a);
    u.outer.material.color.copy(C(r.col || skin.iaidoMain || skin.glow));
    u.inner.material.color.copy(C(r.core || skin.iaidoCore || '#ffffff'));
    u.outer.material.opacity = a;
    u.inner.material.opacity = a;
  });

  syncPool('hazard', show ? hazards : E, () => {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(R3.geo.disc, addMat('#ef4444', 0.15));
    const ring = new THREE.Mesh(R3.geo.thinRing, addMat('#ef4444', 0.8));
    const pillar = new THREE.Mesh(R3.geo.tube, addMat('#ff5a3c', 0.5, R3.vGradTex));
    g.add(fill, ring, pillar); g.userData = { fill, ring, pillar }; return g;
  }, (o, h) => {
    const u = o.userData, r = h.radius * S3;
    o.position.set(wx(h.x), 0.05, wz(h.y));
    u.fill.scale.setScalar(r); u.ring.scale.setScalar(r);
    if (h.warn > 0) {
      u.fill.material.opacity = 0.12 + (1 - h.warn / 0.75) * 0.25;
      u.ring.material.opacity = 0.8; u.pillar.visible = false;
    } else {
      u.fill.material.opacity = 0.65; u.pillar.visible = true;
      const k = Math.max(0, h.life / 0.45);
      u.pillar.scale.set(r * 0.95, 5 * k, r * 0.95); u.pillar.position.y = 2.5 * k;
    }
  });

  syncPool('fblade', show ? floorBlades : E, () => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(R3.geo.thinRing, addMat('#fff', 0.85)); ring.scale.setScalar(1.2);
    const x1 = new THREE.Mesh(R3.geo.plane, addMat('#fff', 0.85)); x1.scale.set(1.8, 1, 0.08); x1.rotation.y = Math.PI / 4;
    const x2 = new THREE.Mesh(R3.geo.plane, x1.material); x2.scale.set(1.8, 1, 0.08); x2.rotation.y = -Math.PI / 4;
    const spikeMat = glowMat('#fff', 0.7);
    const spike = new THREE.Mesh(R3.geo.spike, spikeMat); spike.castShadow = true;
    g.add(ring, x1, x2, spike); g.userData = { ring, x1, x2, spike, spikeMat }; return g;
  }, (o, fb) => {
    const u = o.userData;
    o.position.set(wx(fb.x), 0.05, wz(fb.y));
    o.rotation.y = -fb.angle;
    const warn = fb.warn > 0;
    u.ring.visible = u.x1.visible = u.x2.visible = warn; u.spike.visible = !warn;
    u.ring.material.color.copy(C(fb.color)); u.x1.material.color.copy(C(fb.color));
    if (!warn) {
      const pop = Math.min(1, fb.activeTime / 0.12);
      u.spike.scale.set(1, Math.max(0.05, pop), 1); u.spike.position.y = 0.85 * pop;
      setMatCol(u.spikeMat, fb.color);
    }
  });

  const corpses = (show && corpsesByBoss[currentBossIdx]) || E;
  syncPool('corpse', corpses, () => {
    const g = new THREE.Group();
    const blood = new THREE.Mesh(R3.geo.disc, new THREE.MeshBasicMaterial({ color: '#881337', transparent: true, opacity: 0.6, depthWrite: false }));
    blood.scale.set(1.2, 1, 0.75); blood.position.y = 0.02; g.add(blood);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), stdMat('#18181b')); body.rotation.z = Math.PI / 2; body.position.set(-0.2, 0.3, 0); g.add(body);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.4, 14), stdMat('#09090b')); hat.position.set(-1.1, 0.3, 0.2); hat.rotation.z = 1.2; g.add(hat);
    const katMat = glowMat(skin.blade || '#fda4af', 1.6);
    const kat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.12), katMat); kat.position.set(0.35, 0.8, 0); kat.rotation.z = -0.2; g.add(kat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), stdMat('#fbbf24', { metalness: 0.8 })); guard.position.set(0.5, 1.45, 0); g.add(guard);
    const gl = glowSprite(skin.glow || '#ff1744', 2.2, 0.5); gl.position.set(0.4, 1.0, 0); g.add(gl);
    g.traverse(n => { if (n.isMesh && n !== blood) n.castShadow = true; });
    g.userData = { gl, katMat }; return g;
  }, (o, c) => {
    o.position.set(wx(c.x), 0, wz(c.y));
    o.rotation.y = -c.angle;
    setMatCol(o.userData.katMat, skin.blade || '#fda4af', 1.7);
    o.userData.gl.material.color.copy(C(skin.glow || '#ff1744'));
    o.userData.gl.material.opacity = 0.35 + Math.sin(totalTime * 4) * 0.15;
  });

  // 3D-вспышки попаданий, парирования и казни в цвете скина катаны
  const hList = (show && R3.hitFlashes) ? R3.hitFlashes : E;
  syncPool('hitflash', hList, () => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(R3.geo.thinRing, addMat('#fff', 0.95));
    const spr = glowSprite('#fff', 3.5, 0.9);
    g.add(ring, spr); g.userData = { ring, spr }; return g;
  }, (o, hf) => {
    const u = o.userData, a = Math.max(0, hf.life / hf.maxLife);
    o.position.set(wx(hf.x), 1.35, wz(hf.y));
    const sc = hf.scale * (1 + (1 - a) * 1.45);
    u.ring.scale.setScalar(sc);
    u.ring.material.color.copy(C(hf.col));
    u.ring.material.opacity = a * 0.95;
    u.spr.scale.setScalar(sc * 2.4 * a);
    u.spr.material.color.copy(C(hf.col));
    u.spr.material.opacity = a * 0.85;
  });
}

function spawnHitFlash3D(x, y, col, scale = 1.2, life = 0.22) {
  if (!R3.hitFlashes) R3.hitFlashes = [];
  if (R3.hitFlashes.length > 20) R3.hitFlashes.shift();
  R3.hitFlashes.push({ x, y, col, scale, life, maxLife: life });
}

// =========================================================================
// PARTICLES & ASH
// =========================================================================
function initParticles3D() {
  const N = 260;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const mat = new THREE.PointsMaterial({ size: 0.6, map: R3.glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  R3.scene.add(pts);
  R3.parts = { geo, N };
}
function updateParticles3D(show) {
  const { geo, N } = R3.parts;
  const pos = geo.attributes.position.array, col = geo.attributes.color.array;
  const n = show ? Math.min(N, particles.length) : 0;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const a = Math.max(0, p.life / p.maxLife);
    const c = C(p.color);
    pos[i * 3] = wx(p.x); pos[i * 3 + 1] = 0.5 + (1 - a) * 1.4 + p.size * 0.06; pos[i * 3 + 2] = wz(p.y);
    col[i * 3] = c.r * a; col[i * 3 + 1] = c.g * a; col[i * 3 + 2] = c.b * a;
  }
  geo.setDrawRange(0, n);
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
}

function initAsh3D() {
  const N = 240;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    const spark = Math.random() < 0.35;
    const c = spark ? C('#ff4155') : C('#8a7f84');
    const k = 0.3 + Math.random() * 0.5;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    vel.push(-0.7 - Math.random(), 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.28, map: R3.glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  R3.scene.add(pts);
  R3.ash = { geo, vel, N };
}
function updateAsh3D(dt) {
  const { geo, vel, N } = R3.ash;
  const pos = geo.attributes.position.array;
  const n = lowGfx ? Math.floor(N * 0.35) : N;
  for (let i = 0; i < n; i++) {
    pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    if (pos[i * 3] < -40) pos[i * 3] = 40;
    if (pos[i * 3 + 1] > 14) pos[i * 3 + 1] = 0;
  }
  geo.setDrawRange(0, n);
  geo.attributes.position.needsUpdate = true;
}

// =========================================================================
// CAMERA
// =========================================================================
function updateCamera3D(dt, inFight) {
  const cam = R3.camera;
  const aspect = R3.vw / R3.vh;
  const k = 1 - Math.exp(-dt * 5);
  if (inFight) {
    let tx = 0, tz = 0;
    if (player) { tx = wx(player.x) * 0.35; tz = wz(player.y) * 0.3; }
    const fit = Math.max(1, 1.78 / aspect);
    let dist = 34 * fit * (0.6 + 0.4 * ARENA.scale);
    if (introTimer > 0 && boss) {
      const q = introTimer / 1.55;
      tx += (wx(boss.x) - tx) * q; tz += (wz(boss.y) - tz) * q; dist *= 1 - 0.5 * q;
    }
    if (clashState) { dist *= 0.8; tx = wx(clashState.x) * 0.6; tz = wz(clashState.y) * 0.6; }
    if (introTimer > 0) { R3.camT.set(tx, 0, tz); R3.camDist = dist; }
    else {
      R3.camT.x += (tx - R3.camT.x) * k; R3.camT.z += (tz - R3.camT.z) * k;
      R3.camDist += (dist - R3.camDist) * k;
    }
    const isAction = typeof cameraMode !== 'undefined' && cameraMode === 'action';
    if (isAction && player) {
      // Камера за спиной героя: при захвате мыши (Pointer Lock) — свободное вращение мышкой, иначе Lock-On на босса
      const px = wx(player.x), pz = wz(player.y);
      const mouseLook = typeof document !== 'undefined' && document.pointerLockElement === canvas;
      if (R3.actionYaw === undefined) R3.actionYaw = -Math.PI / 2;
      if (R3.actionPitch === undefined) R3.actionPitch = 0.42;
      if (!mouseLook && boss && !boss.dead) {
        const targetYaw = Math.atan2(wz(boss.y) - pz, wx(boss.x) - px);
        R3.actionYaw = lerpAngle(R3.actionYaw, targetYaw, 1 - Math.exp(-dt * 6));
      }
      const dist3d = 14.5;
      const horiz = Math.cos(R3.actionPitch) * dist3d;
      const camH = Math.max(2.2, Math.sin(R3.actionPitch) * dist3d + 1.5);
      const desiredX = px - Math.cos(R3.actionYaw) * horiz;
      const desiredZ = pz - Math.sin(R3.actionYaw) * horiz;
      const kCam = 1 - Math.exp(-dt * (mouseLook ? 18 : 8));
      cam.position.x += (desiredX - cam.position.x) * kCam;
      cam.position.y += (camH - cam.position.y) * kCam;
      cam.position.z += (desiredZ - cam.position.z) * kCam;
      if (screenShake > 0) {
        const s = screenShake * 0.02;
        cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
      }
      const lookX = (!mouseLook && boss && !boss.dead) ? px + (wx(boss.x) - px) * 0.42 : px + Math.cos(R3.actionYaw) * 8;
      const lookZ = (!mouseLook && boss && !boss.dead) ? pz + (wz(boss.y) - pz) * 0.42 : pz + Math.sin(R3.actionYaw) * 8;
      cam.lookAt(lookX, 1.6, lookZ);
    } else {
      cam.position.set(R3.camT.x, R3.camDist * 0.86, R3.camT.z + R3.camDist * 0.56);
      if (screenShake > 0) {
        const s = screenShake * 0.02;
        cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
      }
      cam.lookAt(R3.camT.x, 0, R3.camT.z);
    }
    updateCinematic(dt);
    resetCineFov();
  } else {
    FX.cine = null; resetCineFov();
    const a = performance.now() / 1000 * 0.07;
    cam.position.set(Math.sin(a) * 34, 15, Math.cos(a) * 26);
    cam.lookAt(0, 0, 0);
  }
}

// =========================================================================
// 2D OVERLAY (тексты, клэш, вспышки)
// =========================================================================
function toScreen(x, y, z) {
  const v = R3.tmpV.set(x, y, z).project(R3.camera);
  return { x: (v.x * 0.5 + 0.5) * R3.vw, y: (-v.y * 0.5 + 0.5) * R3.vh, ok: v.z < 1 };
}

function drawOverlay3D(inFight) {
  const c = ctx, W = R3.vw, H = R3.vh;
  c.setTransform(R3.dpr, 0, 0, R3.dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  if (!inFight) return;
  const k = Math.max(0.8, Math.min(1.5, H / 700));

  if (pendingOutcome === 'WIN') { c.fillStyle = 'rgba(6,2,4,0.42)'; c.fillRect(0, 0, W, H); }

  // Низкое HP — пульсирующая кровавая виньетка
  if (player && !player.dead && player.hp === 1 && player.maxHp > 1) {
    const p = 0.35 + Math.sin(totalTime * 6) * 0.15;
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(120,0,20,0)'); g.addColorStop(1, `rgba(160,0,30,${p})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  c.textAlign = 'center';
  // Метки над боссом
  if (boss && !boss.dead) {
    const head = toScreen(wx(boss.x), boss.jumpZ * S3 * 1.3 + 5.2 * boss.radius / 30, wz(boss.y));
    if (boss.windup && boss.windup.heavy && head.ok) {
      c.font = `900 ${Math.round(30 * k)}px Inter`; c.fillStyle = '#ff1744';
      c.shadowColor = '#000'; c.shadowBlur = 8;
      c.fillText('!', head.x, head.y);
    }
    if (boss.staggerTimer > 0) {
      const p = toScreen(wx(boss.x), 0.2, wz(boss.y));
      c.font = `900 ${Math.round(14 * k)}px Inter`; c.fillStyle = '#ffffff';
      c.shadowColor = '#ff1744'; c.shadowBlur = 12;
      c.fillText('💀 КАЗНЬ — БЕЙ В УПОР!', p.x, head.y - 10);
    }
    c.shadowBlur = 0;
  }

  // Всплывающие тексты (с раздвижкой, чтобы не налезали друг на друга)
  const placed = [];
  floatingTexts.forEach(ft => {
    const p = toScreen(wx(ft.x), 2.8, wz(ft.y));
    if (!p.ok) return;
    c.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    c.font = `900 ${Math.round(ft.size * k)}px Inter`;
    c.fillStyle = ft.color; c.shadowColor = '#000'; c.shadowBlur = 6;
    const half = c.measureText(ft.text).width / 2 + 8;
    const x = Math.max(half, Math.min(W - half, p.x));
    const lh = ft.size * k + 4;
    let y = p.y;
    for (let guard = 0; guard < 8; guard++) {
      const hit = placed.find(r => Math.abs(r.y - y) < (r.h + lh) / 2 && Math.abs(r.x - x) < r.half + half);
      if (!hit) break;
      y = hit.y - (hit.h + lh) / 2;
    }
    placed.push({ x, y, half, h: lh });
    c.fillText(ft.text, x, y);
  });
  c.globalAlpha = 1; c.shadowBlur = 0;
  if (typeof drawSigOverlay === 'function') drawSigOverlay(c, W, H, k);
  drawStaminaOverlay(c, k);

  if (invertFlash > 0) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(0, 0, W, H); }

  if (clashState) {
    const cs = clashState, ratio = Math.max(0, cs.timer / cs.duration);
    const p = toScreen(wx(cs.x), 1.2, wz(cs.y));
    const vg = c.createRadialGradient(p.x, p.y, 40, p.x, p.y, Math.max(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    c.save(); c.translate(p.x, p.y);
    c.strokeStyle = '#fde047'; c.shadowColor = '#f59e0b'; c.shadowBlur = 24; c.lineWidth = 5;
    c.beginPath(); c.arc(0, 0, (26 + ratio * 68) * k, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 4;
    const s = 44 * k;
    c.beginPath(); c.moveTo(-s, -s); c.lineTo(s, s); c.moveTo(s, -s); c.lineTo(-s, s); c.stroke();
    c.font = `900 ${Math.round(22 * k)}px Inter`; c.fillStyle = '#fde047'; c.shadowColor = '#000'; c.shadowBlur = 10;
    c.fillText('⚡ КЛЭШ! ЖМИ УДАР / ПАРИР!', 0, -90 * k);
    c.restore();
  }
}

// =========================================================================
// MAIN DRAW
// =========================================================================
function drawGame3D() {
  if (!R3.ready) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - (R3.lastT || now)) / 1000);
  R3.lastT = now;
  if (window.innerWidth !== R3.vw || window.innerHeight !== R3.vh) resize3D();

  const key = `${ARENA.x},${ARENA.y},${ARENA.w},${ARENA.h},${lowGfx}`;
  if (key !== R3.arenaKey) { R3.arenaKey = key; buildArena3D(); }
  if (R3.arenaDirty && now - R3.lastUpload > (lowGfx ? 250 : 90)) { R3.arenaTex.needsUpdate = true; R3.arenaDirty = false; R3.lastUpload = now; }
  updateArenaFx(now / 1000);

  const inFight = !!(player && boss && gameState !== 'MENU');

  const curStyle = typeof activeStyleId !== 'undefined' ? activeStyleId : 'ronin';
  if (!R3.player || R3.player.skinId !== activeSkinId || R3.player.styleId !== curStyle) buildPlayer3D(getActiveSkin());
  updatePlayer3D(dt, inFight);
  updateGhosts(dt);
  if (R3.hitFlashes) {
    for (let i = R3.hitFlashes.length - 1; i >= 0; i--) {
      R3.hitFlashes[i].life -= dt;
      if (R3.hitFlashes[i].life <= 0) R3.hitFlashes.splice(i, 1);
    }
  }

  if (boss !== R3.bossRef) { R3.bossRef = boss; if (boss) buildBoss3D(); }
  updateBoss3D(dt, inFight);

  updatePools3D(inFight);
  if (typeof updateSig3D === 'function') updateSig3D(inFight);
  updateParticles3D(inFight);
  updateAsh3D(dt);

  const F = R3.fx;
  F.clashGlow.visible = !!clashState;
  if (clashState) {
    F.clashGlow.position.set(wx(clashState.x), 1.3, wz(clashState.y));
    F.clashGlow.scale.setScalar(4 + Math.sin(totalTime * 30) * 0.8);
  }

  updateCamera3D(dt, inFight);
  R3.camera.updateMatrixWorld();

  // Прицел мышью: луч из камеры в пол
  F.reticle.visible = false;
  if (R3.ndc.has && inFight && !isTouchDevice) {
    R3.raycaster.setFromCamera(R3.ndc, R3.camera);
    const hit = R3.raycaster.ray.intersectPlane(R3.groundPlane, R3.tmpV);
    if (hit) {
      input.mouseX = hit.x / S3 + 600;
      input.mouseY = hit.z / S3 + 350;
      if (gameState === 'PLAYING') {
        F.reticle.visible = true;
        F.reticle.position.set(hit.x, 0.06, hit.z);
        F.reticle.material.color.copy(C(getActiveSkin().glow));
      }
    }
  }

  renderWithBloom();
  drawOverlay3D(inFight);
}
