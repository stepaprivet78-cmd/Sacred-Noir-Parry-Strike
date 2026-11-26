// =========================================================================
// SACRED NOIR 3D — ЕДИНЫЙ МОДУЛЬНЫЙ РЕЕСТР БОССОВ (BOSS REGISTRY)
// Добавление нового босса сводится к вызову registerBoss({ ... }) внизу файла:
// меню, Пантеон, сохранения, 3D-модель, ИИ и достижения подхватят его сами.
// =========================================================================
'use strict';

const HARDCORE_HP_MULT = 1.8;
const HARDCORE_ATK_MULT = 0.85;
const HARDCORE_SP_MULT = 0.88;

const BOSS_REGISTRY = [];
const BOSS_BY_KEY = {};

function toRoman(num) {
  const map = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let n = Math.max(1, Math.floor(num)), out = '';
  for (const [v, s] of map) { while (n >= v) { out += s; n -= v; } }
  return out;
}

/**
 * Регистрирует босса в едином реестре.
 * @param {Object} cfg — конфигурация босса (см. шаблон в конце файла)
 */
function registerBoss(cfg) {
  const id = BOSS_REGISTRY.length;
  const roman = cfg.roman || toRoman(id + 1);
  const st = cfg.stats || {};
  const baseHp = st.baseHp || cfg.hp || 500;
  const entry = {
    id,
    key: cfg.key || `boss_${id}`,
    roman,
    name: cfg.name,
    epithet: cfg.epithet,
    color: cfg.color || '#e11d48',
    baseHp,
    hp: Math.round(baseHp * (cfg.skipHardcoreScale ? 1 : HARDCORE_HP_MULT)),
    speed: st.speed || cfg.speed || 150,
    atkRate: (st.atkRate || cfg.atkRate || 1.2) * (cfg.skipHardcoreScale ? 1 : HARDCORE_ATK_MULT),
    spRate: (st.spRate || cfg.spRate || 4.0) * (cfg.skipHardcoreScale ? 1 : HARDCORE_SP_MULT),
    radius: st.radius || 30,
    desiredDist: st.desiredDist || 185,
    projShape: st.projShape || (id % 2 === 1 ? 'blade' : 'orb'),
    projSpread: st.projSpread || 0.20,
    hasTwin: !!st.hasTwin,
    signature: cfg.signature || { type: 'armor', name: '🛡️ КАМЕННАЯ КОЖА', hint: 'Ломай парированием!', col: '#a1a1aa', cast: 0.6 },
    achievement: cfg.achievement || {
      id: `slay_${cfg.key || id}`,
      title: `Падение: ${cfg.name}`,
      desc: `Победить босса ${roman}. ${cfg.name}`,
      icon: '💀'
    },
    firePrimary: cfg.firePrimary || null,
    fireSpecial: cfg.fireSpecial || null,
    build3D: cfg.build3D || null
  };
  BOSS_REGISTRY.push(entry);
  BOSS_BY_KEY[entry.key] = entry;
  // Автоматическая регистрация метаданных сигнатуры в bosskit.js (если уже загружен или через буфер)
  if (entry.signature && entry.signature.type && entry.signature.type !== 'absolute') {
    if (typeof registerSignatureMeta === 'function') registerSignatureMeta(entry.signature.type, entry.signature);
  }
  return entry;
}

function getBossConfig(idOrKey) {
  if (typeof idOrKey === 'string') return BOSS_BY_KEY[idOrKey] || BOSS_REGISTRY[0];
  return BOSS_REGISTRY[idOrKey] || BOSS_REGISTRY[0];
}

// =========================================================================
// I — X: КЛАССИЧЕСКИЙ ПАНТЕОН
// =========================================================================

// I. МОНОЛИТ
registerBoss({
  key: 'monolith',
  name: 'МОНОЛИТ',
  epithet: 'Древний Идол',
  color: '#e11d48',
  stats: { baseHp: 420, speed: 120, atkRate: 1.45, spRate: 4.5, radius: 30, desiredDist: 185, projShape: 'orb' },
  signature: { type: 'altars', name: '🕯️ АЛТАРИ КРОВИ', hint: 'Босс НЕУЯЗВИМ и лечится — разруби алтари катаной!', col: '#f43f5e', cast: 0.75 },
  altSignature: 'armor',
  achievement: { id: 'boss_monolith', title: 'Крушитель Идолов', desc: 'Низвергнуть I. Монолита («Древний Идол»)', icon: '🗿' },
  fireSpecial(b, aim) {
    if (b.phase2 && Math.random() < 0.55) b.startDash(aim);
    else b.spawnFloorBlades('line');
  },
  build3D({ A, M, shell, glow, col }) {
    const ob = A(M(new THREE.CylinderGeometry(0.9, 1.45, 3.8, 4), shell), 0, 1.9, 0); ob.rotation.y = Math.PI / 4;
    const veins = A(M(new THREE.CylinderGeometry(0.93, 1.48, 3.82, 4, 3, true), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.35 })), 0, 1.9, 0);
    veins.rotation.y = Math.PI / 4;
    const core = A(M(new THREE.SphereGeometry(0.38, 16, 12), glow), 0.8, 2.5, 0);
    const ring = A(M(new THREE.TorusGeometry(2.0, 0.05, 6, 48), glow), 0, 2.2, 0);
    const ring2 = A(M(new THREE.TorusGeometry(2.4, 0.03, 6, 48), glow), 0, 1.3, 0);
    return t => {
      core.scale.setScalar(1 + Math.sin(t * 5) * 0.2);
      ring.rotation.set(Math.PI / 2 + Math.sin(t) * 0.3, t * 0.8, 0);
      ring2.rotation.set(Math.PI / 2 + Math.cos(t * 0.7) * 0.25, 0, t);
    };
  }
});

// II. МАЯТНИК
registerBoss({
  key: 'pendulum',
  name: 'МАЯТНИК',
  epithet: 'Палач Тишины',
  color: '#f97316',
  stats: { baseHp: 520, speed: 155, atkRate: 1.30, spRate: 4.2, radius: 30, desiredDist: 185, projShape: 'blade' },
  signature: { type: 'pendulum', name: '⚖️ МАЯТНИК СМЕРТИ', hint: 'Лезвие качается через арену — рывок сквозь него', col: '#f97316', cast: 0.9 },
  achievement: { id: 'boss_pendulum', title: 'Остановивший Маятник', desc: 'Низвергнуть II. Маятника («Палач Тишины»)', icon: '⚖️' },
  fireSpecial(b, aim) {
    if (Math.random() < 0.6) b.startDash(aim);
    else b.spawnFloorBlades('cross');
  },
  build3D({ A, M, shell, glow, white }) {
    A(M(new THREE.SphereGeometry(0.95, 18, 14), shell), 0, 2.1, 0);
    A(M(new THREE.TorusGeometry(0.97, 0.06, 6, 32), glow), 0, 2.1, 0).rotation.x = Math.PI / 2;
    [-0.3, 0.3].forEach(z => A(M(new THREE.BoxGeometry(0.1, 0.12, 0.25), white), 0.9, 2.3, z));
    const piv = A(new THREE.Group(), 0, 2.1, 0);
    const hold = new THREE.Group(); hold.rotation.x = Math.PI / 2; piv.add(hold);
    [0, 1].forEach(k => { const c = M(new THREE.TorusGeometry(1.9, 0.14, 6, 32, 1.5), glow); c.rotation.z = k ? Math.PI - 0.75 : -0.75; hold.add(c); });
    return t => { piv.rotation.y = Math.sin(t * 3) * 0.9; };
  }
});

// III. ПРИЗМА
registerBoss({
  key: 'prism',
  name: 'ПРИЗМА',
  epithet: 'Кристальный Серафим',
  color: '#06b6d4',
  stats: { baseHp: 600, speed: 135, atkRate: 1.25, spRate: 4.4, radius: 30, desiredDist: 260, projShape: 'orb' },
  signature: { type: 'prism', name: '💎 КРИСТАЛЬНЫЕ ПИЛОНЫ', hint: 'Разбей кристаллы катаной!', col: '#06b6d4', cast: 0.8 },
  altSignature: 'safezone',
  achievement: { id: 'boss_prism', title: 'Осколки Серафима', desc: 'Низвергнуть III. Призму («Кристальный Серафим»)', icon: '💎' },
  fireSpecial(b, aim) {
    const count = b.phase2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      b.lasers.push({ angle: aim + (i / count) * Math.PI * 2, rotSpeed: 0.85, len: 520, life: 2.1, color: '#06b6d4', dodged: false });
    }
    b.spawnFloorBlades('line');
  },
  build3D({ A, M, glow, white, col, stdMat }) {
    const g2 = A(new THREE.Group(), 0, 2.6, 0);
    g2.add(M(new THREE.OctahedronGeometry(1.5), stdMat('#08202b', { metalness: 0.8, roughness: 0.2, emissive: col, emissiveIntensity: 0.15 })));
    g2.add(M(new THREE.OctahedronGeometry(1.56), new THREE.MeshBasicMaterial({ color: col, wireframe: true })));
    g2.add(M(new THREE.SphereGeometry(0.45, 12, 10), white));
    const shards = [];
    for (let i = 0; i < 4; i++) { const s = A(M(new THREE.TetrahedronGeometry(0.35), glow)); shards.push(s); }
    return t => {
      g2.rotation.y = t * 0.8; g2.position.y = 2.6 + Math.sin(t * 2) * 0.25;
      shards.forEach((s, i) => { const a = t * 1.6 + i * Math.PI / 2; s.position.set(Math.cos(a) * 2.4, 2.6 + Math.sin(t * 3 + i) * 0.5, Math.sin(a) * 2.4); s.rotation.set(t * 2, t * 3, 0); });
    };
  }
});

// IV. РОЙ
registerBoss({
  key: 'swarm',
  name: 'РОЙ',
  epithet: 'Пожирательница Тишины',
  color: '#eab308',
  stats: { baseHp: 680, speed: 150, atkRate: 1.20, spRate: 4.3, radius: 30, desiredDist: 185, projShape: 'blade' },
  signature: { type: 'swarm', name: '🐝 РОЙ', hint: 'Самонаводка — парируй или уклоняйся', col: '#eab308', cast: 0.7 },
  achievement: { id: 'boss_swarm', title: 'Пепел Улья', desc: 'Низвергнуть IV. Рой («Пожирательница Тишины»)', icon: '🐝' },
  fireSpecial(b) {
    b.startCrushingJump();
  },
  build3D({ A, M, glow, col, stdMat, addMat }) {
    const b = A(M(new THREE.SphereGeometry(1, 18, 14), stdMat('#1c1907', { roughness: 0.5 })), 0, 1.9, 0); b.scale.set(1.15, 1.35, 1.1);
    [1.55, 2.15].forEach(y => { const r = A(M(new THREE.TorusGeometry(1.08, 0.06, 6, 32), glow), 0, y, 0); r.rotation.x = Math.PI / 2; });
    [-0.35, 0.35].forEach(z => A(M(new THREE.SphereGeometry(0.18, 10, 8), glow), 0.95, 2.5, z));
    const wings = [];
    [-1, 1].forEach(s => {
      const piv = A(new THREE.Group(), -0.1, 2.6, s * 0.6);
      const w = M(new THREE.PlaneGeometry(2.2, 0.9), addMat(col, 0.4)); w.rotation.x = -Math.PI / 2; w.position.set(-0.3, 0, s * 1.1); piv.add(w);
      wings.push({ piv, s });
    });
    const swarm = [];
    for (let i = 0; i < 12; i++) swarm.push({ m: A(M(new THREE.SphereGeometry(0.1, 6, 5), glow)), r: 2 + Math.random() * 1.2, sp: 1 + Math.random() * 2, ph: Math.random() * 6 });
    return t => {
      wings.forEach(w => { w.piv.rotation.x = w.s * Math.sin(t * 22) * 0.6; });
      swarm.forEach(s => { const a = t * s.sp + s.ph; s.m.position.set(Math.cos(a) * s.r, 1.8 + Math.sin(a * 2) * 0.8, Math.sin(a) * s.r); });
    };
  }
});

// V. ЗЕРКАЛО
registerBoss({
  key: 'mirror',
  name: 'ЗЕРКАЛО',
  epithet: 'Призрачный Ассасин',
  color: '#a855f7',
  stats: { baseHp: 740, speed: 185, atkRate: 1.12, spRate: 3.9, radius: 30, desiredDist: 185, projShape: 'orb' },
  signature: { type: 'mirror', name: '🔮 ОТРАЖЕНИЕ', hint: 'Он повторяет твои удары и рывки!', col: '#a855f7', cast: 0.6 },
  achievement: { id: 'boss_mirror', title: 'Разбитое Отражение', desc: 'Низвергнуть V. Зеркало («Призрачный Ассасин»)', icon: '🔮' },
  fireSpecial(b) {
    spawnParticles(b.x, b.y, '#a855f7', 16, 180, 4, 0.3);
    b.x = player.x - Math.cos(player.angle) * 145;
    b.y = player.y - Math.sin(player.angle) * 145;
    clampToArena(b, b.radius + 10);
    spawnParticles(b.x, b.y, '#a855f7', 16, 180, 4, 0.3);
    const newAim = Math.atan2(player.y - b.y, player.x - b.x);
    if (Math.random() < 0.6) b.startDash(newAim);
    else b.spawnFloorBlades('cross');
  },
  build3D({ A, M, glow, col, stdMat, glowMat }) {
    const mm = stdMat('#160924', { transparent: true, opacity: 0.85, emissive: col, emissiveIntensity: 0.2 });
    A(M(new THREE.ConeGeometry(0.95, 3, 6), mm), 0, 1.5, 0);
    A(M(new THREE.SphereGeometry(0.35, 12, 10), mm), 0, 3.15, 0);
    A(M(new THREE.ConeGeometry(0.45, 0.75, 8), mm), 0, 3.45, 0);
    const bm = glowMat('#f5d0fe', 1.5);
    [0.6, -0.6].forEach(r => { const b = A(M(new THREE.BoxGeometry(0.12, 2.4, 0.06), bm), 0.75, 2.0, 0); b.rotation.x = r; });
    const dagger = A(M(new THREE.ConeGeometry(0.12, 0.8, 4), glow));
    return t => {
      mm.opacity = 0.55 + Math.sin(t * 6) * 0.25;
      dagger.position.set(Math.cos(t * 3) * 1.8, 2.2, Math.sin(t * 3) * 1.8); dagger.rotation.set(0, 0, -Math.PI / 2 + t * 5);
    };
  }
});

// VI. ЧАСОВЩИК
registerBoss({
  key: 'clockmaker',
  name: 'ЧАСОВЩИК',
  epithet: 'Чумной Хронометр',
  color: '#10b981',
  stats: { baseHp: 820, speed: 145, atkRate: 1.08, spRate: 4.0, radius: 30, desiredDist: 260, projShape: 'blade', projSpread: 0.26 },
  signature: { type: 'rewind', name: '⏪ ОТМОТКА ВРЕМЕНИ', hint: 'Вбей урон, чтобы прервать!', col: '#10b981', cast: 1.15 },
  achievement: { id: 'boss_clockmaker', title: 'Конец Времён', desc: 'Низвергнуть VI. Часовщика («Чумной Хронометр»)', icon: '⏳' },
  fireSpecial(b) {
    const spd = 290 * (activeContract === 'double_down' ? 1.4 : 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + b.animTime;
      projectiles.push(new Projectile(b.x, b.y, Math.cos(a) * spd, Math.sin(a) * spd, 8, '#10b981', 1, 'blade'));
    }
    b.spawnFloorBlades('cross');
  },
  build3D({ A, M, shell, glow, stdMat, glowMat }) {
    A(M(new THREE.CylinderGeometry(1.2, 1.6, 0.6, 8), shell), 0, 0.3, 0);
    A(M(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8), shell), 0, 1.1, 0);
    const disc = A(M(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 40), stdMat('#062019')), 0, 2.6, 0); disc.rotation.z = Math.PI / 2;
    const rim = A(M(new THREE.TorusGeometry(1.6, 0.08, 8, 48), glow), 0, 2.6, 0); rim.rotation.y = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; A(M(new THREE.BoxGeometry(0.05, 0.18, 0.08), glow), 0.17, 2.6 + Math.cos(a) * 1.35, Math.sin(a) * 1.35).rotation.x = -a; }
    const hm = glowMat('#a7f3d0', 1.5);
    const h1 = A(new THREE.Group(), 0.2, 2.6, 0); const m1 = M(new THREE.BoxGeometry(0.05, 1.15, 0.08), hm); m1.position.y = 0.55; h1.add(m1);
    const h2 = A(new THREE.Group(), 0.24, 2.6, 0); const m2 = M(new THREE.BoxGeometry(0.05, 0.75, 0.12), hm); m2.position.y = 0.35; h2.add(m2);
    return t => { h1.rotation.x = -t * 2; h2.rotation.x = -t * 7; };
  }
});

// VII. ТИТАН
registerBoss({
  key: 'titan',
  name: 'ТИТАН',
  epithet: 'Рогатый Демон',
  color: '#ef4444',
  stats: { baseHp: 960, speed: 140, atkRate: 1.15, spRate: 3.8, radius: 38, desiredDist: 185, projShape: 'orb' },
  signature: { type: 'quake', name: '🌋 ЗЕМЛЕТРЯСЕНИЕ', hint: 'Перепрыгни волну рывком!', col: '#ef4444', cast: 1.0 },
  achievement: { id: 'boss_titan', title: 'Убийца Великанов', desc: 'Низвергнуть VII. Титана («Рогатый Демон»)', icon: '🌋' },
  fireSpecial(b, aim) {
    for (let i = 0; i < 3; i++) {
      hazards.push({
        x: player.x + (Math.random() - 0.5) * 200,
        y: player.y + (Math.random() - 0.5) * 160,
        radius: 56, warn: 0.75, life: 0.45, hit: false
      });
    }
    if (Math.random() < 0.55) b.startCrushingJump();
    else b.startDash(aim);
  },
  build3D({ A, M, shell, glow, stdMat, glowMat }) {
    const b = A(M(new THREE.SphereGeometry(1.8, 20, 16), stdMat('#240707', { roughness: 0.6 })), 0, 2.0, 0); b.scale.set(1, 1.05, 1.1);
    [-1, 1].forEach(s => { const h = A(M(new THREE.ConeGeometry(0.32, 1.8, 8), glow), 0.3, 3.7, s * 1.0); h.rotation.x = s * 0.5; });
    const ym = glowMat('#fde047', 2);
    [-0.5, 0.5].forEach(z => A(M(new THREE.BoxGeometry(0.1, 0.18, 0.35), ym), 1.75, 2.4, z));
    const arms = [];
    [-1, 1].forEach(s => {
      const piv = A(new THREE.Group(), 0, 2.7, s * 1.9);
      const arm = M(new THREE.BoxGeometry(0.75, 2.2, 0.75), shell); arm.position.y = -1.0; piv.add(arm);
      const fist = M(new THREE.SphereGeometry(0.55, 10, 8), glow); fist.position.y = -2.2; piv.add(fist);
      arms.push({ piv, s });
    });
    return t => arms.forEach(a => { a.piv.rotation.z = Math.sin(t * 2 + a.s) * 0.4; });
  }
});

// VIII. ПАУК
registerBoss({
  key: 'spider',
  name: 'ПАУК',
  epithet: 'Чёрная Вдова',
  color: '#ec4899',
  stats: { baseHp: 1020, speed: 175, atkRate: 1.02, spRate: 3.7, radius: 30, desiredDist: 185, projShape: 'blade' },
  signature: { type: 'webs', name: '🕸️ ПАУТИНА', hint: 'Сети замедляют — нить рвётся рывком', col: '#ec4899', cast: 0.7 },
  achievement: { id: 'boss_spider', title: 'Разорванная Сеть', desc: 'Низвергнуть VIII. Паука («Чёрная Вдова»)', icon: '🕷️' },
  fireSpecial(b, aim) {
    if (Math.random() < 0.5) b.startCrushingJump();
    else b.startDash(aim);
  },
  build3D({ A, M, shell, glow, col, stdMat, glowMat, seg, V3 }) {
    const b = A(M(new THREE.SphereGeometry(1.0, 16, 12), shell), 0.3, 1.3, 0); b.scale.set(1.3, 0.8, 1);
    A(M(new THREE.SphereGeometry(1.2, 16, 12), stdMat('#1f0815')), -1.4, 1.6, 0);
    const hg = A(M(new THREE.OctahedronGeometry(0.35), glowMat('#ff1744', 2)), -1.4, 2.75, 0); hg.scale.set(1, 0.4, 0.7);
    [-0.2, 0.2].forEach(z => A(M(new THREE.SphereGeometry(0.1, 8, 6), glow), 1.5, 1.5, z));
    const legMat = glowMat(col, 0.6);
    const legs = [];
    [-1, 1].forEach(s => {
      for (let l = 0; l < 4; l++) {
        const piv = A(new THREE.Group(), 0.9 - l * 0.45, 1.3, s * 0.5);
        const knee = V3((1.5 - l) * 0.3, 0.9, s * 1.4), foot = V3((1.5 - l) * 0.7, -1.3, s * 2.3);
        piv.add(seg(V3(0, 0, 0), knee, 0.08, legMat));
        piv.add(seg(knee, foot, 0.06, legMat));
        legs.push({ piv, ph: l + (s > 0 ? 0 : 1.5) });
      }
    });
    return t => legs.forEach(L => { L.piv.rotation.y = Math.sin(t * 10 + L.ph) * 0.25; L.piv.rotation.x = Math.cos(t * 10 + L.ph) * 0.08; });
  }
});

// IX. БЛИЗНЕЦЫ
registerBoss({
  key: 'twins',
  name: 'БЛИЗНЕЦЫ',
  epithet: 'Солнце и Луна',
  color: '#f59e0b',
  stats: { baseHp: 1120, speed: 165, atkRate: 1.05, spRate: 3.8, radius: 30, desiredDist: 185, projShape: 'orb', hasTwin: true },
  signature: { type: 'eclipse', name: '🌗 ЗАТМЕНИЕ', hint: 'Не стой между Солнцем и Луной!', col: '#f59e0b', cast: 0.8 },
  achievement: { id: 'boss_twins', title: 'Гаситель Светил', desc: 'Низвергнуть IX. Близнецов («Солнце и Луна»)', icon: '🌗' },
  fireSpecial(b, aim) {
    b.startDash(aim);
    b.spawnFloorBlades('line');
  },
  build3D({ A, M, col, stdMat, glowMat, glowSprite }) {
    A(M(new THREE.SphereGeometry(1.25, 20, 16), glowMat(col, 2)), 0, 2.3, 0);
    A(glowSprite(col, 6, 0.6), 0, 2.3, 0);
    const rays = A(new THREE.Group(), 0, 2.3, 0);
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Group(); p.rotation.y = (i / 8) * Math.PI * 2;
      const c = M(new THREE.ConeGeometry(0.25, 1.1, 6), glowMat('#fde68a', 1.6)); c.rotation.z = -Math.PI / 2; c.position.x = 1.85; p.add(c);
      rays.add(p);
    }
    [-0.35, 0.35].forEach(z => A(M(new THREE.BoxGeometry(0.1, 0.18, 0.2), stdMat('#261404')), 1.2, 2.5, z));
    return t => { rays.rotation.y = t * 0.9; };
  }
});

// X. АБСОЛЮТ
registerBoss({
  key: 'absolute',
  name: 'АБСОЛЮТ',
  epithet: 'Падший Серафим',
  color: '#f43f5e',
  stats: { baseHp: 1450, speed: 185, atkRate: 0.92, spRate: 3.3, radius: 36, desiredDist: 195, projShape: 'blade', projSpread: 0.26 },
  signature: { type: 'absolute', name: '👑 ВСЕ ДАРЫ ПАНТЕОНА', hint: 'Владеет способностями всех боссов!', col: '#f43f5e', cast: 0.8 },
  achievement: { id: 'boss_absolute', title: 'Падение Абсолюта', desc: 'Низвергнуть X. Абсолюта («Падший Серафим»)', icon: '👑' },
  fireSpecial(b, aim) {
    const r = Math.random();
    if (r < 0.33) b.startCrushingJump();
    else if (r < 0.66) {
      b.startDash(aim);
      b.spawnFloorBlades('cross');
    } else {
      for (let i = 0; i < 3; i++) {
        b.lasers.push({ angle: aim + (i / 3) * Math.PI * 2, rotSpeed: 0.95, len: 560, life: 2.0, color: '#f43f5e', dodged: false });
      }
    }
  },
  build3D({ A, M, shell, glow, white, stdMat, glowMat }) {
    A(M(new THREE.ConeGeometry(1.1, 2.4, 10), shell), 0, 1.2, 0);
    A(M(new THREE.SphereGeometry(1.3, 20, 16), stdMat('#140309', { metalness: 0.6, roughness: 0.3 })), 0, 2.9, 0);
    A(M(new THREE.SphereGeometry(0.5, 14, 10), white), 1.0, 2.9, 0);
    const halo = A(M(new THREE.TorusGeometry(0.9, 0.07, 8, 40), glowMat('#fde047', 2)), 0, 4.6, 0); halo.rotation.x = Math.PI / 2;
    const wings = [];
    [-1, 1].forEach(s => {
      for (let w = 0; w < 3; w++) {
        const piv = A(new THREE.Group(), -0.3, 3.0, s * 0.9);
        const f = M(new THREE.BoxGeometry(0.5, 0.08, 3.4), glow); f.position.z = s * 1.7; piv.add(f);
        wings.push({ piv, s, w });
      }
    });
    return t => {
      halo.position.y = 4.6 + Math.sin(t * 2) * 0.15; halo.rotation.z = t;
      wings.forEach(W => {
        W.piv.rotation.x = -W.s * (0.1 + W.w * 0.38 + Math.sin(t * 4 + W.w) * 0.12);
        W.piv.rotation.y = W.s * (W.w - 1) * 0.35;
      });
    };
  }
});

// =========================================================================
// XI — XII: НОВЫЕ БОССЫ (ДЕМОНСТРАЦИЯ МАСШТАБИРУЕМОЙ АРХИТЕКТУРЫ)
// =========================================================================

// XI. ЖНЕЦ — Паромщик Душ
registerBoss({
  key: 'reaper',
  name: 'ЖНЕЦ',
  epithet: 'Паромщик Душ',
  color: '#38bdf8',
  stats: { baseHp: 1580, speed: 190, atkRate: 0.90, spRate: 3.4, radius: 32, desiredDist: 190, projShape: 'blade', projSpread: 0.24 },
  signature: { type: 'vortex', name: '🌀 ВОДОВОРОТ ДУШ', hint: 'Вихрь затягивает внутрь — рви дистанцию рывком!', col: '#38bdf8', cast: 0.85 },
  achievement: { id: 'boss_reaper', title: 'Дань Паромщику', desc: 'Низвергнуть XI. Жнеца («Паромщик Душ»)', icon: '💀' },
  fireSpecial(b, aim) {
    // Веер призрачных серпов + стремительный рывок с косой
    const dd = activeContract === 'double_down' ? 1.4 : 1;
    const count = b.phase2 ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const a = aim + (i - (count - 1) / 2) * 0.24;
      projectiles.push(new Projectile(b.x, b.y, Math.cos(a) * 350 * dd, Math.sin(a) * 350 * dd, 8, '#38bdf8', 1, 'blade'));
    }
    if (Math.random() < 0.65) b.startDash(aim);
    else b.spawnFloorBlades('cross');
  },
  build3D({ A, M, glow, white, col, stdMat, glowMat, glowSprite }) {
    const cloakMat = stdMat('#09131c', { roughness: 0.6, metalness: 0.3, emissive: '#0c4a6e', emissiveIntensity: 0.25 });
    A(M(new THREE.ConeGeometry(1.15, 3.1, 8), cloakMat), 0, 1.55, 0);
    A(M(new THREE.SphereGeometry(0.46, 14, 12), stdMat('#e2e8f0', { roughness: 0.4 })), 0.15, 3.2, 0);
    const hood = A(M(new THREE.ConeGeometry(0.65, 0.95, 8), cloakMat), 0.05, 3.55, 0); hood.rotation.z = -0.2;
    [-0.16, 0.16].forEach(z => A(M(new THREE.SphereGeometry(0.09, 8, 6), glow), 0.52, 3.22, z));

    // Огромная энергетическая коса
    const scythe = A(new THREE.Group(), 0.2, 2.3, 0.85);
    const shaft = M(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 8), stdMat('#1e293b', { metalness: 0.7 }));
    shaft.rotation.z = 0.35; scythe.add(shaft);
    const blade = M(new THREE.TorusGeometry(1.35, 0.11, 5, 24, Math.PI * 0.72), glowMat('#7dd3fc', 2.0));
    blade.position.set(0.7, 1.65, 0); blade.rotation.z = -0.55; scythe.add(blade);

    // Парящий фонарь душ
    const lantern = A(new THREE.Group(), 0.9, 2.2, -0.95);
    lantern.add(M(new THREE.OctahedronGeometry(0.32), white));
    lantern.add(glowSprite(col, 2.8, 0.75));

    return t => {
      scythe.rotation.x = Math.sin(t * 2.8) * 0.35;
      scythe.rotation.y = Math.cos(t * 2.1) * 0.25;
      lantern.position.y = 2.2 + Math.sin(t * 3.5) * 0.28;
    };
  }
});

// XII. АРХОНТ — Судья Кровавой Клятвы
registerBoss({
  key: 'archon',
  name: 'АРХОНТ',
  epithet: 'Судья Кровавой Клятвы',
  color: '#fb7185',
  stats: { baseHp: 1750, speed: 180, atkRate: 0.88, spRate: 3.2, radius: 35, desiredDist: 205, projShape: 'orb', projSpread: 0.22 },
  signature: { type: 'judgement', name: '⚔️ ПРИГОВОР НЕБЕС', hint: 'Карающие мечи бьют с небес волнами — не стой на месте!', col: '#fb7185', cast: 0.9 },
  altSignature: 'altars',
  achievement: { id: 'boss_archon', title: 'Свержение Судьи', desc: 'Низвергнуть XII. Архонта («Судья Кровавой Клятвы»)', icon: '⚔️' },
  fireSpecial(b, aim) {
    if (Math.random() < 0.5) {
      b.startCrushingJump();
      b.spawnFloorBlades('line');
    } else {
      const count = b.phase2 ? 4 : 2;
      for (let i = 0; i < count; i++) {
        b.lasers.push({ angle: aim + (i / count) * Math.PI * 2, rotSpeed: b.phase2 ? 1.05 : 0.8, len: 560, life: 1.9, color: '#fb7185', dodged: false });
      }
      b.startDash(aim);
    }
  },
  build3D({ A, M, shell, glow, white, stdMat, glowMat }) {
    const armor = stdMat('#230b14', { metalness: 0.75, roughness: 0.28 });
    const gold = glowMat('#fbbf24', 1.5);
    A(M(new THREE.CylinderGeometry(0.75, 1.25, 2.8, 6), armor), 0, 1.4, 0);
    A(M(new THREE.BoxGeometry(1.1, 1.1, 1.9), armor), 0, 2.5, 0);
    A(M(new THREE.OctahedronGeometry(0.52), armor), 0, 3.55, 0);
    A(M(new THREE.BoxGeometry(0.14, 0.42, 0.14), white), 0.48, 3.55, 0);
    // Корона правосудия
    const crown = A(M(new THREE.TorusGeometry(0.85, 0.06, 6, 6), gold), 0, 4.25, 0); crown.rotation.x = Math.PI / 2;
    // 4 парящих священных меча вокруг Архонта
    const swords = [];
    for (let i = 0; i < 4; i++) {
      const sg = A(new THREE.Group(), 0, 2.8, 0);
      const bl = M(new THREE.BoxGeometry(0.08, 2.1, 0.22), i % 2 === 0 ? glow : gold);
      const gd = M(new THREE.BoxGeometry(0.14, 0.08, 0.55), gold); gd.position.y = 0.65;
      sg.add(bl, gd);
      swords.push(sg);
    }
    return t => {
      crown.rotation.z = -t * 1.2;
      swords.forEach((s, i) => {
        const a = t * 1.8 + (i / 4) * Math.PI * 2;
        s.position.set(Math.cos(a) * 2.25, 2.7 + Math.sin(t * 3 + i) * 0.3, Math.sin(a) * 2.25);
        s.rotation.set(Math.sin(t * 2 + i) * 0.2, -a, 0.18);
      });
    };
  }
});

// =========================================================================
// XIII — XX: ВЫСШИЙ ПАНТЕОН БЕЗДНЫ (УМНЫЙ ИИ + НОВЫЕ МЕХАНИКИ)
// =========================================================================

// XIII. МОРОЗ — Ледяной Палач
registerBoss({
  key: 'frost', name: 'МОРОЗ', epithet: 'Ледяной Палач', color: '#67e8f9',
  stats: { baseHp: 1850, speed: 175, atkRate: 0.90, spRate: 3.3, radius: 33, desiredDist: 205, projShape: 'blade', projSpread: 0.22 },
  signature: { type: 'frostfield', name: '❄️ ЛЕДЯНОЕ ПОЛЕ', hint: 'Лёд сковывает движения — уходи с замёрзших зон!', col: '#67e8f9', cast: 0.75 },
  altSignature: 'safezone',
  achievement: { id: 'boss_frost', title: 'Оттепель', desc: 'Низвергнуть XIII. Мороза («Ледяной Палач»)', icon: '❄️' },
  fireSpecial(b, aim) { b.spawnFloorBlades('cross'); b.startDash(aim); },
  build3D({ A, M, glow, white, stdMat }) {
    const ice = stdMat('#083344', { metalness: 0.4, roughness: 0.15, emissive: '#06b6d4', emissiveIntensity: 0.25 });
    A(M(new THREE.OctahedronGeometry(1.5), ice), 0, 2.2, 0);
    const spikes = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = A(M(new THREE.ConeGeometry(0.22, 1.5, 5), glow), Math.cos(a) * 1.6, 2.6, Math.sin(a) * 1.6);
      s.rotation.z = -Math.cos(a) * 0.4; s.rotation.x = Math.sin(a) * 0.4;
      spikes.push(s);
    }
    A(M(new THREE.SphereGeometry(0.42, 12, 10), white), 0.9, 2.4, 0);
    return t => { spikes.forEach((s, i) => { s.position.y = 2.5 + Math.sin(t * 3 + i) * 0.25; }); };
  }
});

// XIV. ПЕПЕЛ — Инквизитор Костра
registerBoss({
  key: 'cinder', name: 'ПЕПЕЛ', epithet: 'Инквизитор Костра', color: '#fb923c',
  stats: { baseHp: 1960, speed: 185, atkRate: 0.88, spRate: 3.2, radius: 34, desiredDist: 185, projShape: 'orb', projSpread: 0.24 },
  signature: { type: 'firestorm', name: '🔥 ОГНЕННЫЙ ШТОРМ', hint: 'Пылающие костры и волна огня — прыгай рывком!', col: '#fb923c', cast: 0.8 },
  altSignature: 'quake',
  achievement: { id: 'boss_cinder', title: 'Погашенный Костёр', desc: 'Низвергнуть XIV. Пепла («Инквизитор Костра»)', icon: '🔥' },
  fireSpecial(b, aim) { b.startCrushingJump(); b.spawnFloorBlades('line'); },
  build3D({ A, M, shell, glow, glowSprite }) {
    A(M(new THREE.CylinderGeometry(0.85, 1.35, 3.0, 8), shell), 0, 1.5, 0);
    const halo = A(M(new THREE.TorusGeometry(1.5, 0.1, 6, 32), glow), 0, 3.2, 0);
    A(glowSprite('#fb923c', 4.5, 0.65), 0, 3.1, 0);
    return t => { halo.rotation.set(Math.sin(t * 2) * 0.5, t * 2, 0); };
  }
});

// XV. МРАК — Пожиратель Света
registerBoss({
  key: 'umbra', name: 'МРАК', epithet: 'Пожиратель Света', color: '#818cf8',
  stats: { baseHp: 2050, speed: 195, atkRate: 0.86, spRate: 3.1, radius: 32, desiredDist: 190, projShape: 'blade', projSpread: 0.24 },
  signature: { type: 'blackout', name: '🌑 ЗАТМЕНИЕ ЗРЕНИЯ', hint: 'Тьма окутала арену — следи за вспышками!', col: '#818cf8', cast: 0.7 },
  altSignature: 'mirror',
  achievement: { id: 'boss_umbra', title: 'Прозрение во Тьме', desc: 'Низвергнуть XV. Мрака («Пожиратель Света»)', icon: '🌑' },
  fireSpecial(b, aim) {
    b.x = player.x - Math.cos(player.angle) * 140; b.y = player.y - Math.sin(player.angle) * 140;
    clampToArena(b, b.radius + 10);
    b.startDash(Math.atan2(player.y - b.y, player.x - b.x));
  },
  build3D({ A, M, glow, white, stdMat }) {
    A(M(new THREE.SphereGeometry(1.35, 20, 16), stdMat('#090514', { roughness: 0.2, metalness: 0.8 })), 0, 2.3, 0);
    const eyes = A(new THREE.Group(), 0, 2.3, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const e = M(new THREE.SphereGeometry(0.28, 12, 10), i === 0 ? white : glow);
      e.position.set(Math.cos(a) * 1.9, Math.sin(a) * 0.4, Math.sin(a) * 1.9);
      eyes.add(e);
    }
    return t => { eyes.rotation.y = t * 2.2; };
  }
});

// XVI. ШТОРМ — Громовержец
registerBoss({
  key: 'storm', name: 'ШТОРМ', epithet: 'Громовержец', color: '#facc15',
  stats: { baseHp: 2150, speed: 190, atkRate: 0.84, spRate: 3.1, radius: 33, desiredDist: 220, projShape: 'blade', projSpread: 0.26 },
  signature: { type: 'lightning', name: '🌩️ РАЗРЯД МОЛНИЙ', hint: 'Молнии бьют с небес по отмеченным точкам!', col: '#facc15', cast: 0.7 },
  altSignature: 'judgement',
  achievement: { id: 'boss_storm', title: 'Укротитель Бури', desc: 'Низвергнуть XVI. Шторма («Громовержец»)', icon: '🌩️' },
  fireSpecial(b, aim) {
    for (let i = 0; i < 3; i++) b.lasers.push({ angle: aim + (i / 3) * Math.PI * 2, rotSpeed: 1.05, len: 560, life: 1.8, color: '#facc15', dodged: false });
  },
  build3D({ A, M, shell, glow, white }) {
    A(M(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12), shell), 0, 2.1, 0);
    const coils = [];
    for (let i = 0; i < 3; i++) {
      const r = A(M(new THREE.TorusGeometry(1.5 + i * 0.25, 0.06, 6, 36), glow), 0, 1.3 + i * 0.8, 0);
      r.rotation.x = Math.PI / 2; coils.push(r);
    }
    A(M(new THREE.SphereGeometry(0.5, 14, 10), white), 0, 3.6, 0);
    return t => { coils.forEach((r, i) => { r.rotation.z = t * (i % 2 ? 2.5 : -2.5); }); };
  }
});

// XVII. ФАНТОМ — Тысячеликий
registerBoss({
  key: 'phantom_boss', name: 'ФАНТОМ', epithet: 'Тысячеликий', color: '#c084fc',
  stats: { baseHp: 2250, speed: 200, atkRate: 0.84, spRate: 3.0, radius: 31, desiredDist: 200, projShape: 'orb', projSpread: 0.22 },
  signature: { type: 'invis', name: '👻 НЕВИДИМОСТЬ', hint: 'Фантом исчез! Следи за следами и сбей его ударом!', col: '#c084fc', cast: 0.6 },
  altSignature: 'mirrorsplit',
  achievement: { id: 'boss_phantom', title: 'Без Масок', desc: 'Низвергнуть XVII. Фантома («Тысячеликий»)', icon: '🎭' },
  fireSpecial(b, aim) { b.startDash(aim); b.spawnFloorBlades('cross'); },
  build3D({ A, M, glow, white, stdMat }) {
    A(M(new THREE.ConeGeometry(1.1, 3.2, 8), stdMat('#1e0836', { transparent: true, opacity: 0.8 })), 0, 1.6, 0);
    const masks = A(new THREE.Group(), 0, 2.9, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const m = M(new THREE.BoxGeometry(0.18, 0.85, 0.65), i === 0 ? white : glow);
      m.position.set(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15); m.rotation.y = -a;
      masks.add(m);
    }
    return t => { masks.rotation.y = t * 1.6; };
  }
});

// XVIII. ЖЕРТВА — Кровавый Алтарь
registerBoss({
  key: 'sacrifice', name: 'ЖЕРТВА', epithet: 'Кровавый Алтарь', color: '#e11d48',
  stats: { baseHp: 2400, speed: 170, atkRate: 0.84, spRate: 3.0, radius: 36, desiredDist: 195, projShape: 'orb', projSpread: 0.25 },
  signature: { type: 'altars', name: '🕯️ АЛТАРИ КРОВИ', hint: 'Босс НЕУЯЗВИМ и лечится — разруби алтари катаной!', col: '#f43f5e', cast: 0.75 },
  altSignature: 'mines',
  achievement: { id: 'boss_sacrifice', title: 'Осквернитель', desc: 'Низвергнуть XVIII. Жертву («Кровавый Алтарь»)', icon: '🩸' },
  fireSpecial(b, aim) { b.startCrushingJump(); b.spawnFloorBlades('cross'); },
  build3D({ A, M, shell, glow }) {
    A(M(new THREE.BoxGeometry(1.4, 3.4, 1.8), shell), 0, 1.8, 0);
    const r1 = A(M(new THREE.TorusGeometry(2.1, 0.08, 6, 40), glow), 0, 2.0, 0);
    const r2 = A(M(new THREE.TorusGeometry(2.1, 0.08, 6, 40), glow), 0, 2.0, 0);
    return t => { r1.rotation.set(t, t * 0.7, 0); r2.rotation.set(-t * 0.8, 0, t); };
  }
});

// XIX. ХРОНОС — Владыка Эпох
registerBoss({
  key: 'chronos', name: 'ХРОНОС', epithet: 'Владыка Эпох', color: '#34d399',
  stats: { baseHp: 2550, speed: 190, atkRate: 0.80, spRate: 2.9, radius: 35, desiredDist: 230, projShape: 'blade', projSpread: 0.26 },
  signature: { type: 'timestop', name: '⏳ ЗАМЕДЛЕНИЕ ВРЕМЕНИ', hint: 'Время замедлено — прорывайся рывком!', col: '#34d399', cast: 0.75 },
  altSignature: 'rewind',
  achievement: { id: 'boss_chronos', title: 'Вне Времени', desc: 'Низвергнуть XIX. Хроноса («Владыка Эпох»)', icon: '⌛' },
  fireSpecial(b) {
    const spd = 330 * (activeContract === 'double_down' ? 1.4 : 1);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + b.animTime;
      projectiles.push(new Projectile(b.x, b.y, Math.cos(a) * spd, Math.sin(a) * spd, 8, '#34d399', 1, 'blade'));
    }
    b.spawnFloorBlades('cross');
  },
  build3D({ A, M, shell, glow, white }) {
    const top = A(M(new THREE.ConeGeometry(1.3, 1.9, 8), shell), 0, 3.1, 0); top.rotation.x = Math.PI;
    A(M(new THREE.ConeGeometry(1.3, 1.9, 8), shell), 0, 1.2, 0);
    A(M(new THREE.SphereGeometry(0.45, 14, 12), white), 0, 2.15, 0);
    const ring = A(M(new THREE.TorusGeometry(2.2, 0.07, 8, 48), glow), 0, 2.15, 0);
    return t => { ring.rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t * 1.4, 0); };
  }
});

// XX. ОМЕГА — Конец Всякой Плоти
registerBoss({
  key: 'omega', name: 'ОМЕГА', epithet: 'Конец Всякой Плоти', color: '#f43f5e',
  stats: { baseHp: 3100, speed: 205, atkRate: 0.76, spRate: 2.7, radius: 38, desiredDist: 205, projShape: 'blade', projSpread: 0.28 },
  signature: { type: 'absolute', name: '👑 АБСОЛЮТНЫЙ КОНЕЦ', hint: 'Владеет всеми механиками 20 боссов!', col: '#f43f5e', cast: 0.75 },
  achievement: { id: 'boss_omega', title: 'Повелитель Нуара', desc: 'Низвергнуть XX. Омегу («Конец Всякой Плоти»)', icon: '👑' },
  fireSpecial(b, aim) {
    const r = Math.random();
    if (r < 0.34) { b.startCrushingJump(); b.spawnFloorBlades('cross'); }
    else if (r < 0.67) { b.startDash(aim); b.spawnFloorBlades('line'); }
    else { for (let i = 0; i < 4; i++) b.lasers.push({ angle: aim + (i / 4) * Math.PI * 2, rotSpeed: 1.1, len: 580, life: 2.0, color: '#f43f5e', dodged: false }); }
  },
  build3D({ A, M, shell, glow, white, glowMat }) {
    A(M(new THREE.OctahedronGeometry(1.65), shell), 0, 2.6, 0);
    A(M(new THREE.SphereGeometry(0.65, 16, 12), white), 1.1, 2.6, 0);
    const gold = glowMat('#fde047', 2.2);
    const h1 = A(M(new THREE.TorusGeometry(1.2, 0.07, 8, 40), gold), 0, 4.7, 0); h1.rotation.x = Math.PI / 2;
    const h2 = A(M(new THREE.TorusGeometry(2.3, 0.05, 8, 48), glow), 0, 2.6, 0);
    const wings = [];
    [-1, 1].forEach(s => {
      for (let w = 0; w < 4; w++) {
        const piv = A(new THREE.Group(), -0.3, 2.8, s * 1.0);
        const f = M(new THREE.BoxGeometry(0.55, 0.08, 3.8), w % 2 ? gold : glow); f.position.z = s * 1.9; piv.add(f);
        wings.push({ piv, s, w });
      }
    });
    return t => {
      h1.rotation.z = t * 1.5; h2.rotation.set(t, t * 0.8, 0);
      wings.forEach(W => { W.piv.rotation.x = -W.s * (0.1 + W.w * 0.3 + Math.sin(t * 5 + W.w) * 0.14); });
    };
  }
});

// =========================================================================
// XXI — XXX: ЛЕГЕНДАРНЫЙ ПАНТЕОН (30 БОССОВ)
// =========================================================================

// XXI. ВУЛКАН — Сердце Магмы
registerBoss({
  key: 'volcano', name: 'ВУЛКАН', epithet: 'Сердце Магмы', color: '#ea580c',
  stats: { baseHp: 3250, speed: 170, atkRate: 0.80, spRate: 2.9, radius: 38, desiredDist: 185, projShape: 'orb', projSpread: 0.24 },
  signature: { type: 'firestorm', name: '🔥 ОГНЕННЫЙ ШТОРМ', hint: 'Пылающие костры и волна огня — прыгай рывком!', col: '#ea580c', cast: 0.75 },
  altSignature: 'quake',
  achievement: { id: 'boss_volcano', title: 'Угасшая Лава', desc: 'Низвергнуть XXI. Вулкана («Сердце Магмы»)', icon: '🌋' },
  fireSpecial(b, aim) { b.startCrushingJump(); b.spawnFloorBlades('cross'); },
  build3D({ A, M, shell, glow }) {
    A(M(new THREE.ConeGeometry(1.75, 3.2, 7), shell), 0, 1.6, 0);
    const core = A(M(new THREE.SphereGeometry(0.9, 14, 12), glow), 0, 3.1, 0);
    return t => { core.scale.setScalar(1 + Math.sin(t * 6) * 0.18); };
  }
});

// XXII. БЕЗДНА — Глаз Пустоты
registerBoss({
  key: 'abyss_eye', name: 'БЕЗДНА', epithet: 'Глаз Пустоты', color: '#6366f1',
  stats: { baseHp: 3400, speed: 185, atkRate: 0.78, spRate: 2.9, radius: 35, desiredDist: 225, projShape: 'blade', projSpread: 0.25 },
  signature: { type: 'vortex', name: '🌀 ВОДОВОРОТ ДУШ', hint: 'Вихрь затягивает внутрь — рви дистанцию рывком!', col: '#6366f1', cast: 0.75 },
  altSignature: 'blackout',
  achievement: { id: 'boss_abyss', title: 'Взгляд в Пустоту', desc: 'Низвергнуть XXII. Бездну («Глаз Пустоты»)', icon: '👁️' },
  fireSpecial(b, aim) {
    for (let i = 0; i < 3; i++) b.lasers.push({ angle: aim + (i / 3) * Math.PI * 2, rotSpeed: 1.0, len: 560, life: 1.9, color: '#6366f1', dodged: false });
  },
  build3D({ A, M, glow, white, stdMat }) {
    A(M(new THREE.SphereGeometry(1.4, 20, 16), stdMat('#0b0720', { roughness: 0.2 })), 0, 2.5, 0);
    A(M(new THREE.SphereGeometry(0.55, 14, 12), white), 1.15, 2.5, 0);
    const r = A(M(new THREE.TorusGeometry(2.2, 0.08, 8, 40), glow), 0, 2.5, 0);
    return t => { r.rotation.set(t * 1.4, t, 0); };
  }
});

// XXIII. ВАЛЬКИРИЯ — Крылья Стали
registerBoss({
  key: 'valkyrie', name: 'ВАЛЬКИРИЯ', epithet: 'Крылья Стали', color: '#f472b6',
  stats: { baseHp: 3550, speed: 210, atkRate: 0.76, spRate: 2.8, radius: 32, desiredDist: 190, projShape: 'blade', projSpread: 0.22 },
  signature: { type: 'judgement', name: '⚔️ ПРИГОВОР НЕБЕС', hint: 'Карающие мечи бьют с небес волнами!', col: '#f472b6', cast: 0.8 },
  altSignature: 'pendulum',
  achievement: { id: 'boss_valkyrie', title: 'Сломанные Крылья', desc: 'Низвергнуть XXIII. Валькирию («Крылья Стали»)', icon: '🪽' },
  fireSpecial(b, aim) { b.startDash(aim); b.spawnFloorBlades('line'); },
  build3D({ A, M, shell, glow, white }) {
    A(M(new THREE.ConeGeometry(0.95, 2.9, 8), shell), 0, 1.45, 0);
    A(M(new THREE.SphereGeometry(0.45, 12, 10), white), 0, 3.1, 0);
    const wings = [];
    [-1, 1].forEach(s => {
      const piv = A(new THREE.Group(), -0.2, 2.6, s * 0.7);
      const w = M(new THREE.BoxGeometry(0.45, 0.08, 3.5), glow); w.position.z = s * 1.75; piv.add(w);
      wings.push({ piv, s });
    });
    return t => { wings.forEach(W => { W.piv.rotation.x = W.s * Math.sin(t * 6) * 0.45; }); };
  }
});

// XXIV. ЧУМА — Чёрный Лекарь
registerBoss({
  key: 'plague', name: 'ЧУМА', epithet: 'Чёрный Лекарь', color: '#84cc16',
  stats: { baseHp: 3700, speed: 185, atkRate: 0.78, spRate: 2.9, radius: 33, desiredDist: 210, projShape: 'orb', projSpread: 0.26 },
  signature: { type: 'swarm', name: '🐝 РОЙ', hint: 'Самонаводка — парируй или уклоняйся!', col: '#84cc16', cast: 0.65 },
  altSignature: 'webs',
  achievement: { id: 'boss_plague', title: 'Исцеление Огнём', desc: 'Низвергнуть XXIV. Чуму («Чёрный Лекарь»)', icon: '☣️' },
  fireSpecial(b) {
    const spd = 320 * (activeContract === 'double_down' ? 1.4 : 1);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + b.animTime; projectiles.push(new Projectile(b.x, b.y, Math.cos(a) * spd, Math.sin(a) * spd, 8, '#84cc16', 1, 'orb')); }
  },
  build3D({ A, M, shell, glow }) {
    A(M(new THREE.CylinderGeometry(0.6, 1.3, 3.0, 8), shell), 0, 1.5, 0);
    const beak = A(M(new THREE.ConeGeometry(0.24, 0.95, 6), glow), 0.7, 3.1, 0); beak.rotation.z = -Math.PI / 2;
    const orbs = [];
    for (let i = 0; i < 4; i++) orbs.push(A(M(new THREE.SphereGeometry(0.22, 8, 8), glow)));
    return t => { orbs.forEach((o, i) => { const a = t * 2.5 + i * Math.PI / 2; o.position.set(Math.cos(a) * 1.9, 2.2 + Math.sin(t * 4 + i) * 0.4, Math.sin(a) * 1.9); }); };
  }
});

// XXV. МИРАЖ — Песчаный Дух
registerBoss({
  key: 'mirage', name: 'МИРАЖ', epithet: 'Песчаный Дух', color: '#fbbf24',
  stats: { baseHp: 3850, speed: 205, atkRate: 0.76, spRate: 2.8, radius: 31, desiredDist: 200, projShape: 'blade', projSpread: 0.24 },
  signature: { type: 'invis', name: '👻 НЕВИДИМОСТЬ', hint: 'Мираж исчез! Следи за следами и сбей его ударом!', col: '#fbbf24', cast: 0.6 },
  altSignature: 'mirrorsplit',
  achievement: { id: 'boss_mirage', title: 'Развеянный Песок', desc: 'Низвергнуть XXV. Миража («Песчаный Дух»)', icon: '⏳' },
  fireSpecial(b, aim) { b.startDash(aim); b.spawnFloorBlades('cross'); },
  build3D({ A, M, glow, stdMat }) {
    const m = stdMat('#291c07', { transparent: true, opacity: 0.78 });
    A(M(new THREE.ConeGeometry(1.15, 3.2, 6), m), 0, 1.6, 0);
    const r = A(M(new THREE.TorusGeometry(1.7, 0.08, 6, 32), glow), 0, 2.4, 0);
    return t => { r.rotation.set(Math.PI / 2, 0, t * 3); };
  }
});

// XXVI. ЛЕВИАФАН — Глубинный Ужас
registerBoss({
  key: 'leviathan', name: 'ЛЕВИАФАН', epithet: 'Глубинный Ужас', color: '#0ea5e9',
  stats: { baseHp: 4050, speed: 185, atkRate: 0.76, spRate: 2.8, radius: 37, desiredDist: 205, projShape: 'orb', projSpread: 0.25 },
  signature: { type: 'frostfield', name: '❄️ ЛЕДЯНОЕ ПОЛЕ', hint: 'Лёд сковывает движения — уходи с замёрзших зон!', col: '#0ea5e9', cast: 0.7 },
  altSignature: 'safezone',
  achievement: { id: 'boss_leviathan', title: 'Покоритель Глубин', desc: 'Низвергнуть XXVI. Левиафана («Глубинный Ужас»)', icon: '🌊' },
  fireSpecial(b, aim) { b.startCrushingJump(); b.spawnFloorBlades('line'); },
  build3D({ A, M, shell, glow }) {
    const body = A(M(new THREE.TorusKnotGeometry(1.1, 0.32, 48, 8), shell), 0, 2.3, 0);
    const ring = A(M(new THREE.TorusGeometry(2.1, 0.06, 6, 36), glow), 0, 2.3, 0);
    return t => { body.rotation.y = t * 1.2; ring.rotation.x = t * 1.6; };
  }
});

// XXVII. КОЛОСС — Железный Страж
registerBoss({
  key: 'colossus', name: 'КОЛОСС', epithet: 'Железный Страж', color: '#94a3b8',
  stats: { baseHp: 4300, speed: 165, atkRate: 0.80, spRate: 2.9, radius: 40, desiredDist: 180, projShape: 'orb', projSpread: 0.22 },
  signature: { type: 'altars', name: '🕯️ АЛТАРИ КРОВИ', hint: 'Босс НЕУЯЗВИМ и лечится — разруби алтари катаной!', col: '#94a3b8', cast: 0.75 },
  altSignature: 'armor',
  achievement: { id: 'boss_colossus', title: 'Падение Колосса', desc: 'Низвергнуть XXVII. Колосса («Железный Страж»)', icon: '🛡️' },
  fireSpecial(b, aim) { b.startCrushingJump(); b.startDash(aim); },
  build3D({ A, M, shell, glow }) {
    A(M(new THREE.BoxGeometry(2.2, 3.6, 2.2), shell), 0, 1.8, 0);
    A(M(new THREE.BoxGeometry(2.3, 0.25, 2.3), glow), 0, 2.8, 0);
    return t => {};
  }
});

// XXVIII. СЕРАФИМ — Ослепляющий Свет
registerBoss({
  key: 'seraphim', name: 'СЕРАФИМ', epithet: 'Ослепляющий Свет', color: '#fde047',
  stats: { baseHp: 4500, speed: 195, atkRate: 0.74, spRate: 2.7, radius: 34, desiredDist: 225, projShape: 'blade', projSpread: 0.26 },
  signature: { type: 'lightning', name: '🌩️ РАЗРЯД МОЛНИЙ', hint: 'Молнии бьют с небес по отмеченным точкам!', col: '#fde047', cast: 0.65 },
  altSignature: 'prism',
  achievement: { id: 'boss_seraphim', title: 'Гаситель Света', desc: 'Низвергнуть XXVIII. Серафима («Ослепляющий Свет»)', icon: '✨' },
  fireSpecial(b, aim) {
    for (let i = 0; i < 4; i++) b.lasers.push({ angle: aim + (i / 4) * Math.PI * 2, rotSpeed: 1.05, len: 580, life: 1.9, color: '#fde047', dodged: false });
  },
  build3D({ A, M, glow, white }) {
    A(M(new THREE.OctahedronGeometry(1.5), glow), 0, 2.7, 0);
    const r1 = A(M(new THREE.TorusGeometry(2.3, 0.07, 6, 40), white), 0, 2.7, 0);
    const r2 = A(M(new THREE.TorusGeometry(2.6, 0.07, 6, 40), glow), 0, 2.7, 0);
    return t => { r1.rotation.set(t * 1.6, t, 0); r2.rotation.set(-t, t * 1.4, 0); };
  }
});

// XXIX. ЭКЛИПС — Тень Затмения (с Луной-близнецом!)
registerBoss({
  key: 'eclipse_lord', name: 'ЭКЛИПС', epithet: 'Тень Затмения', color: '#a855f7',
  stats: { baseHp: 4700, speed: 200, atkRate: 0.74, spRate: 2.7, radius: 35, desiredDist: 195, projShape: 'blade', projSpread: 0.25, hasTwin: true },
  signature: { type: 'eclipse', name: '🌗 ЗАТМЕНИЕ', hint: 'Не стой между Эклипсом и его Луной!', col: '#a855f7', cast: 0.75 },
  altSignature: 'mirror',
  achievement: { id: 'boss_eclipse', title: 'Владыка Затмения', desc: 'Низвергнуть XXIX. Эклипса («Тень Затмения»)', icon: '🌑' },
  fireSpecial(b, aim) { b.startDash(aim); b.spawnFloorBlades('cross'); },
  build3D({ A, M, shell, glow }) {
    A(M(new THREE.SphereGeometry(1.45, 20, 16), shell), 0, 2.5, 0);
    const ring = A(M(new THREE.TorusGeometry(2.1, 0.12, 8, 40), glow), 0, 2.5, 0);
    return t => { ring.rotation.set(Math.PI / 3, t * 2, 0); };
  }
});

// XXX. ВЕЧНОСТЬ — Создатель Бездны (Финальный 30-й босс)
registerBoss({
  key: 'eternity', name: 'ВЕЧНОСТЬ', epithet: 'Создатель Бездны', color: '#ff1744',
  stats: { baseHp: 5600, speed: 215, atkRate: 0.70, spRate: 2.5, radius: 40, desiredDist: 205, projShape: 'blade', projSpread: 0.28 },
  signature: { type: 'absolute', name: '👑 ВОЛЯ СОЗДАТЕЛЯ', hint: 'Владеет ВСЕМИ силами 30 боссов Бездны!', col: '#ff1744', cast: 0.7 },
  achievement: { id: 'boss_eternity', title: 'Абсолютный Ронин', desc: 'Низвергнуть XXX. Вечность («Создатель Бездны»)', icon: '🏆' },
  fireSpecial(b, aim) {
    const r = Math.random();
    if (r < 0.33) { b.startCrushingJump(); b.spawnFloorBlades('cross'); }
    else if (r < 0.66) { b.startDash(aim); b.spawnFloorBlades('line'); }
    else { for (let i = 0; i < 4; i++) b.lasers.push({ angle: aim + (i / 4) * Math.PI * 2, rotSpeed: 1.2, len: 600, life: 2.0, color: '#ff1744', dodged: false }); }
  },
  build3D({ A, M, shell, glow, white, glowMat }) {
    A(M(new THREE.IcosahedronGeometry(1.7, 1), shell), 0, 2.8, 0);
    A(M(new THREE.SphereGeometry(0.7, 16, 12), white), 1.2, 2.8, 0);
    const gold = glowMat('#fde047', 2.4);
    const r1 = A(M(new THREE.TorusGeometry(2.5, 0.08, 8, 48), gold), 0, 2.8, 0);
    const r2 = A(M(new THREE.TorusGeometry(3.1, 0.06, 8, 48), glow), 0, 2.8, 0);
    const halo = A(M(new THREE.TorusGeometry(1.3, 0.09, 8, 40), gold), 0, 5.1, 0); halo.rotation.x = Math.PI / 2;
    return t => { r1.rotation.set(t * 1.4, t, 0); r2.rotation.set(-t, t * 1.2, t * 0.5); halo.rotation.z = t * 2; };
  }
});

/* =========================================================================
   ШАБЛОН ДЛЯ ДОБАВЛЕНИЯ НОВОГО БОССА В БУДУЩЕМ:
   Достаточно раскомментировать блок ниже — меню, Пантеон, сохранения,
   ИИ и система достижений подхватят нового босса автоматически!

registerBoss({
  key: 'my_new_boss',
  name: 'ИМЯ БОССА',
  epithet: 'Титул Босса',
  color: '#22d3ee',
  stats: {
    baseHp: 1850,       // базовое HP (автоматически умножается на HARDCORE_HP_MULT)
    speed: 175,         // скорость перемещения
    atkRate: 0.90,      // интервал базовых атак (сек)
    spRate: 3.4,        // интервал спец-приёмов (сек)
    radius: 32,         // радиус хитбокса
    desiredDist: 190,   // предпочитаемая дистанция боя
    projShape: 'blade'  // 'orb' или 'blade'
  },
  // Можно выбрать любую готовую сигнатуру ('armor','pendulum','prism','swarm','mirror','rewind','quake','webs','vortex','judgement')
  // либо зарегистрировать свою через registerSignature(...) в js/bosskit.js
  signature: { type: 'vortex', name: '🌀 НАЗВАНИЕ СПОСОБНОСТИ', hint: 'Подсказка игроку!', col: '#22d3ee', cast: 0.8 },
  achievement: { id: 'boss_my_new_boss', title: 'Название ачивки', desc: 'Описание условия', icon: '🏆' },
  fireSpecial(b, aim) {
    b.startDash(aim);
    b.spawnFloorBlades('cross');
  },
  build3D({ A, M, shell, glow }) {
    const body = A(M(new THREE.OctahedronGeometry(1.4), shell), 0, 2.2, 0);
    const ring = A(M(new THREE.TorusGeometry(2.0, 0.06, 8, 36), glow), 0, 2.2, 0);
    return t => { body.rotation.y = t; ring.rotation.x = t * 1.5; };
  }
});
========================================================================= */
