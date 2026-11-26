// =========================================================================
// SACRED NOIR 3D — BOSS KIT: сигнатурные способности боссов (модульно)
// Читает конфигурацию способности напрямую из BOSS_REGISTRY.
// =========================================================================
'use strict';

const SIG_META = {
  armor:     { name: '🛡️ КАМЕННАЯ КОЖА',     hint: 'Урон ×0.25 — ломай ПАРИРОВАНИЕМ!', col: '#a1a1aa', cast: 0.6 },
  pendulum:  { name: '⚖️ МАЯТНИК СМЕРТИ',    hint: 'Лезвие качается через арену — рывок сквозь него', col: '#f97316', cast: 0.9 },
  prism:     { name: '💎 КРИСТАЛЬНЫЕ ПИЛОНЫ', hint: 'Разбей кристаллы катаной!', col: '#06b6d4', cast: 0.8 },
  swarm:     { name: '🐝 РОЙ',               hint: 'Самонаводка — парируй или уклоняйся', col: '#eab308', cast: 0.7 },
  mirror:    { name: '🔮 ОТРАЖЕНИЕ',         hint: 'Он повторяет твои удары и рывки!', col: '#a855f7', cast: 0.6 },
  rewind:    { name: '⏪ ОТМОТКА ВРЕМЕНИ',    hint: 'Вбей урон, чтобы прервать!', col: '#10b981', cast: 1.15 },
  quake:     { name: '🌋 ЗЕМЛЕТРЯСЕНИЕ',      hint: 'Перепрыгни волну рывком!', col: '#ef4444', cast: 1.0 },
  webs:      { name: '🕸️ ПАУТИНА',           hint: 'Сети замедляют — нить рвётся рывком', col: '#ec4899', cast: 0.7 },
  eclipse:   { name: '🌗 ЗАТМЕНИЕ',          hint: 'Не стой между Солнцем и Луной!', col: '#f59e0b', cast: 0.8 },
  vortex:    { name: '🌀 ВОДОВОРОТ ДУШ',     hint: 'Вихрь затягивает внутрь — рви дистанцию рывком!', col: '#38bdf8', cast: 0.85 },
  judgement: { name: '⚔️ ПРИГОВОР НЕБЕС',    hint: 'Карающие мечи бьют с небес волнами — не стой на месте!', col: '#fb7185', cast: 0.9 }
};

const CUSTOM_SIGS = {};
const ABSOLUTE_POOL = ['quake', 'mirror', 'rewind', 'swarm', 'pendulum', 'prism', 'vortex', 'judgement'];

function registerSignatureMeta(type, meta) {
  if (!type || type === 'absolute') return;
  SIG_META[type] = Object.assign({}, SIG_META[type] || {}, meta);
}

// Для регистрации полностью кастомных сигнатур будущих боссов
function registerSignature(type, handler) {
  if (handler.meta) registerSignatureMeta(type, handler.meta);
  CUSTOM_SIGS[type] = handler;
}

const SIG = {
  banner: null, rewindFx: 0, histT: 0, histB: [], histP: [], tether: null,
  rings: [], sweeps: [], pylons: [], webs: [], beams: [], vortices: [], swords: []
};

function resetSig() {
  SIG.banner = null; SIG.rewindFx = 0; SIG.histT = 0; SIG.tether = null;
  SIG.histB.length = 0; SIG.histP.length = 0;
  SIG.rings.length = 0; SIG.sweeps.length = 0; SIG.pylons.length = 0;
  SIG.webs.length = 0; SIG.beams.length = 0; SIG.vortices.length = 0; SIG.swords.length = 0;
}

function sigArenaCenter() { return { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 }; }

function getBossSigSpec(b) {
  const cfg = typeof getBossConfig === 'function' ? getBossConfig(b.id) : null;
  if (cfg && cfg.signature) {
    registerSignatureMeta(cfg.signature.type, cfg.signature);
    return cfg.signature;
  }
  return { type: 'armor', name: SIG_META.armor.name, hint: SIG_META.armor.hint, col: SIG_META.armor.col, cast: 0.6 };
}

function initBossSig(b) {
  resetSig();
  b.sigTimer = 5.5;
  b.sigArmor = 0;
  b.sigMirror = 0;
  b.sigCast = null;
  b.sigRevived = false;
  const spec = getBossSigSpec(b);
  const label = spec.type === 'absolute' ? '👑 ВСЕ ДАРЫ ПАНТЕОНА' : (spec.name || SIG_META[spec.type]?.name || '');
  const ep = document.getElementById('intro-epithet');
  if (ep) ep.textContent = `«${b.epithet}» · ${label}`;
}

function sigBanner(type) {
  const m = SIG_META[type] || { name: type, hint: '', col: '#f43f5e' };
  SIG.banner = { text: m.name, hint: m.hint, col: m.col, life: 1.9, max: 1.9 };
}

function sigPick(b) {
  const spec = getBossSigSpec(b);
  if (spec.type !== 'absolute') return spec.type;
  return ABSOLUTE_POOL[Math.floor(Math.random() * ABSOLUTE_POOL.length)];
}

function updateBossSig(b, dt) {
  if (b.sigCast) {
    const c = b.sigCast;
    c.timer -= dt;
    if (c.type === 'rewind' && b.hp < c.hpStart - b.maxHp * 0.06) {
      b.sigCast = null;
      spawnFloatingText(b.x, b.y - 50, '⏪ ОТМОТКА ПРЕРВАНА!', '#10b981', 20);
      b.addPosture(35);
      hitStop = Math.max(hitStop, 0.06);
      return true;
    }
    if (c.timer <= 0) { b.sigCast = null; sigExecute(b, c.type); }
    return true;
  }
  if (b.sigMirror > 0) {
    b.sigMirror -= dt;
    const cc = sigArenaCenter();
    const tx = cc.x * 2 - player.x, ty = cc.y * 2 - player.y;
    const k = Math.min(1, dt * 9);
    b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
    clampToArena(b, b.radius + 8);
    if (Math.random() < 0.4) spawnParticles(b.x, b.y, '#a855f7', 1, 60, 3, 0.25);
    if (b.sigMirror <= 0) spawnFloatingText(b.x, b.y - 45, 'ОТРАЖЕНИЕ РАЗБИТО', '#d8b4fe', 14);
    return true;
  }
  b.sigTimer -= dt;
  if (b.sigTimer <= 0) {
    b.sigTimer = (b.phase2 ? 6.5 : 9.5) + Math.random() * 1.5;
    const type = sigPick(b);
    if (type === 'eclipse' && !b.twin2) return false;
    const meta = SIG_META[type] || { cast: 0.8 };
    const cast = (meta.cast || 0.8) * (b.phase2 ? 0.85 : 1);
    b.sigCast = { type, timer: cast, max: cast, hpStart: b.hp };
    sigBanner(type);
    audio.windup(true);
    return true;
  }
  return false;
}

function sigExecute(b, type) {
  if (CUSTOM_SIGS[type] && typeof CUSTOM_SIGS[type].execute === 'function') {
    CUSTOM_SIGS[type].execute(b, SIG);
    return;
  }
  const p2 = b.phase2;
  const dd = activeContract === 'double_down' ? 1.4 : 1;
  screenShake = Math.max(screenShake, 8);
  if (type === 'armor') {
    b.sigArmor = p2 ? 4.5 : 3.5;
    audio.gong();
    spawnParticles(b.x, b.y, '#a1a1aa', 20, 200, 5, 0.5);
  } else if (type === 'pendulum') {
    const cx = ARENA.x + ARENA.w / 2;
    SIG.sweeps.push({ px: cx, py: ARENA.y - 20, base: Math.PI / 2, len: ARENA.h + 40, t: 0, dur: p2 ? 6.5 : 5.2, warn: 0.9, spd: p2 ? 1.9 : 1.5, amp: 1.12, dodged: false, ph: 0 });
    if (p2) SIG.sweeps.push({ px: cx, py: ARENA.y + ARENA.h + 20, base: -Math.PI / 2, len: ARENA.h + 40, t: 0, dur: 6.5, warn: 0.9, spd: 1.9, amp: 1.12, dodged: false, ph: Math.PI });
    audio.gong();
  } else if (type === 'prism') {
    const n = Math.min(p2 ? 4 : 3, 5 - SIG.pylons.length);
    for (let i = 0; i < n; i++) {
      const pos = { x: ARENA.x + 70 + Math.random() * (ARENA.w - 140), y: ARENA.y + 70 + Math.random() * (ARENA.h - 140) };
      SIG.pylons.push({ x: pos.x, y: pos.y, hp: 70, maxHp: 70, fireT: 1.2 + i * 0.45, beam: null, flash: 0 });
      spawnParticles(pos.x, pos.y, '#06b6d4', 12, 160, 4, 0.4);
    }
  } else if (type === 'swarm') {
    const n = p2 ? 14 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const pr = new Projectile(b.x, b.y, Math.cos(a) * 190 * dd, Math.sin(a) * 190 * dd, 6, '#eab308', 1, 'orb');
      pr.homing = p2 ? 2.6 : 2.0; pr.life = 5.5;
      projectiles.push(pr);
    }
  } else if (type === 'mirror') {
    b.sigMirror = p2 ? 7 : 5;
    spawnParticles(b.x, b.y, '#a855f7', 20, 220, 4, 0.4);
  } else if (type === 'rewind') {
    const hb = SIG.histB[0], hp = SIG.histP[0];
    if (hb) {
      const healed = Math.min(b.maxHp, Math.min(Math.max(b.hp, hb.hp), b.hp + b.maxHp * 0.12));
      const gain = Math.round(healed - b.hp);
      spawnParticles(b.x, b.y, '#10b981', 18, 200, 4, 0.5);
      b.hp = healed; b.x = hb.x; b.y = hb.y;
      if (p2) b.posture = 0;
      spawnFloatingText(b.x, b.y - 50, gain > 0 ? `⏪ +${gain} HP` : '⏪ ВРЕМЯ ВСПЯТЬ', '#10b981', 20);
    }
    if (hp && !player.dead) {
      spawnParticles(player.x, player.y, '#10b981', 12, 160, 3.5, 0.4);
      player.x = hp.x; player.y = hp.y;
      player.blood = Math.min(player.blood, hp.blood);
    }
    SIG.rewindFx = 0.9; invertFlash = 0.1; hitStop = Math.max(hitStop, 0.1);
    audio.playTone(1200, 200, 0.5, 'sawtooth', 0.16);
  } else if (type === 'quake') {
    SIG.rings.push({ x: b.x, y: b.y, r: 10, spd: 430, w: 22, dodged: false, hit: false });
    const n = p2 ? 12 : 8;
    for (let i = 0; i < n; i++) {
      hazards.push({ x: ARENA.x + 40 + Math.random() * (ARENA.w - 80), y: ARENA.y + 40 + Math.random() * (ARENA.h - 80), radius: 50, warn: 0.95 + Math.random() * 0.5, life: 0.4, hit: false });
    }
    for (let i = 0; i < 2; i++) hazards.push({ x: player.x + (Math.random() - 0.5) * 60, y: player.y + (Math.random() - 0.5) * 60, radius: 54, warn: 1.1 + i * 0.5, life: 0.4, hit: false });
    audio.execute(); screenShake = 22;
  } else if (type === 'webs') {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 110 + Math.random() * 60;
      const w = { x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r, r: 78, life: 9 };
      clampToArena(w, 40); SIG.webs.push(w);
    }
    if (SIG.webs.length > 7) SIG.webs.splice(0, SIG.webs.length - 7);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const pr = new Projectile(b.x, b.y, Math.cos(a) * 160, Math.sin(a) * 160, 7, '#ec4899', 1, 'blade');
      pr.homing = 1.8; pr.life = 5; projectiles.push(pr);
    }
    if (p2) SIG.tether = { life: 2.6 };
  } else if (type === 'eclipse') {
    const t2 = b.twin2;
    if (t2 && t2.dead && !b.sigRevived && b.hp > b.maxHp * 0.25) {
      b.sigRevived = true;
      t2.dead = false; t2.hp = Math.round(t2.maxHp * 0.4); t2.windup = null;
      spawnParticles(t2.x, t2.y, '#38bdf8', 26, 240, 5, 0.5);
      spawnFloatingText(t2.x, t2.y - 40, '🌙 ЛУНА ВОСКРЕСЛА!', '#38bdf8', 20);
    } else if (t2 && !t2.dead) {
      const ox = b.x, oy = b.y;
      b.x = t2.x; b.y = t2.y; t2.x = ox; t2.y = oy;
      spawnParticles(b.x, b.y, '#f59e0b', 16, 200, 4, 0.4);
      spawnParticles(t2.x, t2.y, '#38bdf8', 16, 200, 4, 0.4);
      SIG.beams.push({ warn: 0.7, life: p2 ? 6 : 4.5, dodged: false });
    } else {
      const n = 16, spd = 300 * dd;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        projectiles.push(new Projectile(b.x, b.y, Math.cos(a) * spd, Math.sin(a) * spd, 8, '#f59e0b', 1, 'orb'));
      }
    }
  } else if (type === 'vortex') {
    const cc = sigArenaCenter();
    SIG.vortices.push({
      x: cc.x, y: cc.y, r: 68, pull: p2 ? 155 : 125,
      life: p2 ? 6.0 : 4.8, pulseT: 0.35, rot: 0, dodged: false
    });
    audio.gong();
    spawnParticles(cc.x, cc.y, '#38bdf8', 26, 240, 5, 0.55);
  } else if (type === 'judgement') {
    const waves = p2 ? 6 : 4;
    for (let i = 0; i < waves; i++) {
      SIG.swords.push({
        delay: i * 0.42,
        warn: 0.65,
        maxWarn: 0.65,
        life: 0.55,
        x: player.x, y: player.y,
        locked: false, struck: false, dodged: false
      });
    }
    audio.gong();
  }
}

function sigHit(o, dmg = 1) {
  if (!player || player.dead) return;
  if (player.dashTimer > 0) {
    if (!o.dodged) { o.dodged = true; player.triggerPerfectDodge(); }
    return;
  }
  player.takeDamage(dmg);
}

function sigOnPlayerAttack(step, reach, dmg) {
  const skin = typeof getActiveSkin === 'function' ? getActiveSkin() : { hitColor: '#67e8f9' };
  for (let i = SIG.pylons.length - 1; i >= 0; i--) {
    const p = SIG.pylons[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) <= reach + 24) {
      p.hp -= dmg; p.flash = 0.1;
      spawnParticles(p.x, p.y, skin.hitColor || '#67e8f9', 8, 180, 3.5, 0.3);
      if (p.hp <= 0) {
        SIG.pylons.splice(i, 1);
        player.addBlood(15);
        audio.parry();
        spawnParticles(p.x, p.y, '#cffafe', 22, 260, 4.5, 0.5);
        spawnFloatingText(p.x, p.y - 30, '💎 КРИСТАЛЛ РАЗБИТ +15🩸', '#67e8f9', 15);
      }
    }
  }
  if (boss && !boss.dead && boss.sigMirror > 0) {
    const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
    const n = step === 2 ? 3 : 1;
    const spd = 430 * (activeContract === 'double_down' ? 1.4 : 1);
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * 0.22;
      projectiles.push(new Projectile(boss.x, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, 8, '#c084fc', 1, 'blade'));
    }
    slashArcs.push({ x: boss.x, y: boss.y, angle: ang, radius: 84, step, isRage: false, isDual: true, bossCol: '#c084fc', life: 0.16, maxLife: 0.16 });
  }
}

function sigOnPlayerDash() {
  if (SIG.tether) {
    SIG.tether = null;
    spawnFloatingText(player.x, player.y - 30, '✂️ НИТЬ РАЗОРВАНА', '#f9a8d4', 14);
  }
  if (boss && !boss.dead && boss.sigMirror > 0 && !boss.isDashing) {
    boss.startDash(Math.atan2(-player.dashVy, -player.dashVx));
    boss.dashTimer = 0.2;
  }
}

function updateSigWorld(dt) {
  if (!boss || !player) return;
  player.slowMul = 1;
  if (SIG.banner) { SIG.banner.life -= dt; if (SIG.banner.life <= 0) SIG.banner = null; }
  if (SIG.rewindFx > 0) SIG.rewindFx -= dt;

  SIG.histT -= dt;
  if (SIG.histT <= 0 && !boss.dead) {
    SIG.histT = 0.1;
    SIG.histB.push({ x: boss.x, y: boss.y, hp: boss.hp });
    SIG.histP.push({ x: player.x, y: player.y, blood: player.blood });
    if (SIG.histB.length > 30) { SIG.histB.shift(); SIG.histP.shift(); }
  }

  if (boss.staggerTimer > 0 && (boss.sigCast || boss.sigMirror > 0)) {
    boss.sigCast = null; boss.sigMirror = 0;
    spawnFloatingText(boss.x, boss.y - 62, 'СПОСОБНОСТЬ СОРВАНА!', '#fde047', 16);
  }

  if (boss.sigArmor > 0) {
    boss.sigArmor -= dt;
    if (boss.staggerTimer > 0) boss.sigArmor = 0;
    if (boss.sigArmor <= 0) {
      spawnFloatingText(boss.x, boss.y - 50, '🛡️ КОЖА ТРЕСНУЛА!', '#d4d4d8', 16);
      spawnParticles(boss.x, boss.y, '#a1a1aa', 22, 260, 5, 0.5);
      SIG.rings.push({ x: boss.x, y: boss.y, r: 10, spd: 380, w: 20, dodged: false, hit: false });
      screenShake = Math.max(screenShake, 12);
    }
  }

  const alive = !boss.dead && !player.dead;

  for (let i = SIG.sweeps.length - 1; i >= 0; i--) {
    const s = SIG.sweeps[i];
    s.t += dt;
    s.angle = s.base + Math.sin((s.t - s.warn) * s.spd + s.ph) * s.amp;
    if (s.t > s.warn && alive) {
      const ex = s.px + Math.cos(s.angle) * s.len, ey = s.py + Math.sin(s.angle) * s.len;
      if (distToSegment(player.x, player.y, s.px, s.py, ex, ey) <= player.radius + 14) sigHit(s);
      else if (s.dodged && player.dashTimer <= 0) s.dodged = false;
    }
    if (s.t >= s.warn + s.dur) SIG.sweeps.splice(i, 1);
  }

  for (let i = SIG.pylons.length - 1; i >= 0; i--) {
    const p = SIG.pylons[i];
    if (p.flash > 0) p.flash -= dt;
    if (!p.beam) {
      p.fireT -= dt;
      if (p.fireT <= 0 && alive) {
        p.beam = { ang: Math.atan2(player.y - p.y, player.x - p.x), warn: 0.65, act: 0.22, dodged: false };
        p.fireT = boss.phase2 ? 1.7 : 2.4;
      }
    } else {
      const bm = p.beam;
      if (bm.warn > 0) {
        bm.warn -= dt;
        if (bm.warn > 0.2) bm.ang = lerpAngle(bm.ang, Math.atan2(player.y - p.y, player.x - p.x), Math.min(1, dt * 4));
        if (bm.warn <= 0) audio.playTone(1400, 600, 0.12, 'square', 0.08);
      } else {
        bm.act -= dt;
        const ex = p.x + Math.cos(bm.ang) * 1400, ey = p.y + Math.sin(bm.ang) * 1400;
        if (alive && distToSegment(player.x, player.y, p.x, p.y, ex, ey) <= player.radius + 7) sigHit(bm);
        if (bm.act <= 0) p.beam = null;
      }
    }
  }

  for (let i = SIG.webs.length - 1; i >= 0; i--) {
    const w = SIG.webs[i];
    w.life -= dt;
    if (alive && Math.hypot(player.x - w.x, player.y - w.y) <= w.r) {
      player.slowMul = 0.45;
      if (player.dashCharges < 2) player.dashRecharge -= dt * 0.5;
    }
    if (w.life <= 0) SIG.webs.splice(i, 1);
  }

  if (SIG.tether) {
    SIG.tether.life -= dt;
    if (!alive || SIG.tether.life <= 0) SIG.tether = null;
    else {
      const dx = boss.x - player.x, dy = boss.y - player.y, d = Math.hypot(dx, dy) || 1;
      if (d > boss.radius + 30) { player.x += dx / d * 150 * dt; player.y += dy / d * 150 * dt; clampToArena(player, player.radius + 2); }
    }
  }

  for (let i = SIG.rings.length - 1; i >= 0; i--) {
    const r = SIG.rings[i];
    r.r += r.spd * dt;
    if (alive && !r.hit) {
      const d = Math.hypot(player.x - r.x, player.y - r.y);
      if (Math.abs(d - r.r) <= r.w + player.radius * 0.5) {
        if (player.dashTimer > 0) { if (!r.dodged) { r.dodged = true; player.triggerPerfectDodge(); } }
        else { r.hit = true; player.takeDamage(1); }
      }
    }
    if (r.r > 1400) SIG.rings.splice(i, 1);
  }

  for (let i = SIG.beams.length - 1; i >= 0; i--) {
    const bm = SIG.beams[i];
    const t2 = boss.twin2;
    if (!t2 || t2.dead || boss.dead) { SIG.beams.splice(i, 1); continue; }
    if (bm.warn > 0) bm.warn -= dt;
    else {
      bm.life -= dt;
      if (alive && distToSegment(player.x, player.y, boss.x, boss.y, t2.x, t2.y) <= player.radius + 9) sigHit(bm);
      else if (bm.dodged && player.dashTimer <= 0) bm.dodged = false;
      if (bm.life <= 0) SIG.beams.splice(i, 1);
    }
  }

  for (let i = SIG.vortices.length - 1; i >= 0; i--) {
    const v = SIG.vortices[i];
    v.life -= dt;
    v.rot += dt * 4.5;
    if (alive) {
      const dx = v.x - player.x, dy = v.y - player.y, d = Math.hypot(dx, dy) || 1;
      if (player.dashTimer <= 0 && d > 22) {
        player.x += (dx / d) * v.pull * dt;
        player.y += (dy / d) * v.pull * dt;
        clampToArena(player, player.radius + 2);
      }
      if (d <= v.r) sigHit(v);
      else if (v.dodged && player.dashTimer <= 0) v.dodged = false;

      v.pulseT -= dt;
      if (v.pulseT <= 0) {
        v.pulseT = 0.65;
        const dd = activeContract === 'double_down' ? 1.4 : 1;
        for (let k = 0; k < 4; k++) {
          const a = v.rot + (k / 4) * Math.PI * 2;
          projectiles.push(new Projectile(v.x, v.y, Math.cos(a) * 250 * dd, Math.sin(a) * 250 * dd, 7, '#38bdf8', 1, 'blade'));
        }
      }
    }
    if (v.life <= 0) SIG.vortices.splice(i, 1);
  }

  for (let i = SIG.swords.length - 1; i >= 0; i--) {
    const sw = SIG.swords[i];
    if (sw.delay > 0) {
      sw.delay -= dt;
      sw.x = player.x; sw.y = player.y;
      continue;
    }
    if (!sw.locked) {
      sw.locked = true;
      sw.x = player.x + (Math.random() - 0.5) * 34;
      sw.y = player.y + (Math.random() - 0.5) * 34;
      clampToArena(sw, 42);
    }
    if (sw.warn > 0) {
      sw.warn -= dt;
      if (sw.warn <= 0 && !sw.struck) {
        sw.struck = true;
        audio.execute();
        screenShake = Math.max(screenShake, 11);
        addCraterScar(sw.x, sw.y, 52);
        spawnParticles(sw.x, sw.y, '#fb7185', 18, 230, 4.5, 0.4);
        if (alive && Math.hypot(player.x - sw.x, player.y - sw.y) <= 56) sigHit(sw);
        SIG.rings.push({ x: sw.x, y: sw.y, r: 12, spd: 360, w: 18, dodged: false, hit: false });
      }
    } else {
      sw.life -= dt;
      if (sw.life <= 0) SIG.swords.splice(i, 1);
    }
  }

  Object.values(CUSTOM_SIGS).forEach(h => { if (typeof h.update === 'function') h.update(dt, SIG); });

  for (const p of projectiles) {
    if (!p.homing || p.reflected || !alive) continue;
    const spd = Math.hypot(p.vx, p.vy);
    const cur = Math.atan2(p.vy, p.vx);
    const want = Math.atan2(player.y - p.y, player.x - p.x);
    const na = lerpAngle(cur, want, Math.min(1, p.homing * dt));
    p.vx = Math.cos(na) * spd; p.vy = Math.sin(na) * spd;
  }
}

function updateSig3D(show) {
  if (!R3.ready) return;
  const E = [];
  const B = show && boss && !boss.dead;

  syncPool('sigcast', B && boss.sigCast ? [boss.sigCast] : E, () => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(R3.geo.ring, addMat('#fff', 0.8));
    const ring2 = new THREE.Mesh(R3.geo.thinRing, addMat('#fff', 0.9));
    const pillar = new THREE.Mesh(R3.geo.tube, addMat('#fff', 0.35, R3.vGradTex));
    g.add(ring, ring2, pillar); g.userData = { ring, ring2, pillar }; return g;
  }, (o, c) => {
    const u = o.userData, col = C((SIG_META[c.type] && SIG_META[c.type].col) || '#f43f5e'), r = 1 - c.timer / c.max;
    o.position.set(wx(boss.x), 0.08, wz(boss.y));
    u.ring.material.color.copy(col); u.ring2.material.color.copy(col); u.pillar.material.color.copy(col);
    u.ring.scale.setScalar(4.5 * (1 - r) + 1.5); u.ring.rotation.y = totalTime * 3;
    u.ring2.scale.setScalar(2 + r * 1.5);
    u.pillar.scale.set(1.6, 10 * r + 1, 1.6); u.pillar.position.y = (10 * r + 1) / 2;
  });

  syncPool('sigarmor', B && boss.sigArmor > 0 ? [boss] : E, () => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#71717a', flatShading: true, transparent: true, opacity: 0.55, roughness: 1, metalness: 0.1 }));
    return m;
  }, o => {
    const s = boss.radius * S3 * 2.3;
    o.position.set(wx(boss.x), 2.0 * boss.radius / 30 + boss.jumpZ * S3 * 1.3, wz(boss.y));
    o.scale.set(s, s * 1.3, s); o.rotation.y = totalTime * 0.5;
    o.material.opacity = boss.sigArmor < 0.8 && Math.floor(totalTime * 12) % 2 ? 0.25 : 0.55;
  });

  syncPool('sigmirror', B && boss.sigMirror > 0 ? [boss] : E, () => {
    const g = new THREE.Group();
    const line = new THREE.Mesh(R3.geo.plane, addMat('#a855f7', 0.35, R3.dashTex));
    const ring = new THREE.Mesh(R3.geo.thinRing, addMat('#c084fc', 0.9));
    g.add(line, ring); g.userData = { line, ring }; return g;
  }, o => {
    const u = o.userData, x1 = wx(boss.x), z1 = wz(boss.y), x2 = wx(player.x), z2 = wz(player.y);
    const len = Math.hypot(x2 - x1, z2 - z1);
    o.position.set(0, 0.07, 0);
    u.line.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); u.line.rotation.y = -Math.atan2(z2 - z1, x2 - x1); u.line.scale.set(len, 1, 0.12);
    u.ring.position.set(x1, 0, z1); u.ring.scale.setScalar(2.2 + Math.sin(totalTime * 8) * 0.2);
  });

  syncPool('sigsweep', show ? SIG.sweeps : E, () => {
    const g = new THREE.Group();
    const arm = new THREE.Mesh(R3.geo.box, glowMat('#f97316', 0.6));
    const blade = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 4, 24, Math.PI * 0.9), glowMat('#fdba74', 1.8));
    blade.rotation.x = Math.PI / 2;
    const warn = new THREE.Mesh(R3.geo.plane, addMat('#f97316', 0.6, R3.dashTex));
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), glowMat('#f97316', 1.2));
    arm.castShadow = blade.castShadow = true;
    g.add(arm, blade, warn, pivot); g.userData = { arm, blade, warn }; return g;
  }, (o, s) => {
    const u = o.userData, len = s.len * S3, active = s.t > s.warn;
    o.position.set(wx(s.px), 1.0, wz(s.py));
    o.rotation.y = -(s.angle === undefined ? s.base : s.angle);
    u.arm.visible = u.blade.visible = active; u.warn.visible = !active;
    u.arm.scale.set(len, 0.18, 0.18); u.arm.position.x = len / 2;
    u.blade.position.set(len, 0, 0);
    u.blade.rotation.set(Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.05);
    u.warn.scale.set(len, 1, 0.4 + Math.sin(totalTime * 20) * 0.1); u.warn.position.set(len / 2, -0.9, 0);
  });

  syncPool('sigpylon', show ? SIG.pylons : E, () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#0e3a4a', emissive: '#06b6d4', emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.15 });
    const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), mat); cry.scale.set(0.8, 1.6, 0.8); cry.castShadow = true;
    const gl = glowSprite('#22d3ee', 3, 0.6);
    const beam = new THREE.Mesh(R3.geo.box, addMat('#22d3ee', 0.4));
    const core = new THREE.Mesh(R3.geo.box, addMat('#ffffff', 1));
    const base = new THREE.Mesh(R3.geo.thinRing, addMat('#06b6d4', 0.7));
    g.add(cry, gl, beam, core, base); g.userData = { cry, gl, beam, core, base, mat }; return g;
  }, (o, p) => {
    const u = o.userData;
    o.position.set(wx(p.x), 0, wz(p.y));
    u.cry.position.y = 2 + Math.sin(totalTime * 3 + p.x) * 0.2; u.cry.rotation.y = totalTime * 1.5;
    u.gl.position.y = u.cry.position.y;
    u.mat.emissive.set(p.flash > 0 ? '#ffffff' : '#06b6d4');
    u.base.scale.setScalar(1.2 * (0.4 + 0.6 * p.hp / p.maxHp)); u.base.position.y = 0.06;
    const bm = p.beam;
    u.beam.visible = u.core.visible = !!bm;
    if (bm) {
      const L = 70, warn = bm.warn > 0;
      u.beam.scale.set(L, warn ? 0.06 : 0.6, warn ? 0.06 : 0.6);
      u.core.scale.set(L, warn ? 0.001 : 0.18, warn ? 0.001 : 0.18);
      [u.beam, u.core].forEach(m => { m.position.set(Math.cos(bm.ang) * L / 2, 1.2, Math.sin(bm.ang) * L / 2); m.rotation.y = -bm.ang; });
      u.beam.material.opacity = warn ? 0.9 : 0.6;
    }
  });

  syncPool('sigweb', show ? SIG.webs : E, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.05, 1, 12, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f9a8d4', wireframe: true, transparent: true, opacity: 0.55 }));
    return m;
  }, (o, w) => {
    o.position.set(wx(w.x), 0.05, wz(w.y)); o.scale.setScalar(w.r * S3);
    o.material.opacity = Math.min(0.55, w.life * 0.4);
  });

  syncPool('sigtether', B && SIG.tether ? [SIG.tether] : E, () => new THREE.Mesh(R3.geo.box, addMat('#f9a8d4', 0.85)), o => {
    const x1 = wx(boss.x), z1 = wz(boss.y), x2 = wx(player.x), z2 = wz(player.y);
    const len = Math.hypot(x2 - x1, z2 - z1);
    o.position.set((x1 + x2) / 2, 1.4, (z1 + z2) / 2); o.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    o.scale.set(len, 0.06, 0.06);
  });

  syncPool('sigring', show ? SIG.rings : E, () => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(R3.geo.thinRing, addMat('#ef4444', 0.95));
    const wall = new THREE.Mesh(R3.geo.tube, addMat('#ff6a3c', 0.5, R3.vGradTex));
    g.add(ring, wall); g.userData = { ring, wall }; return g;
  }, (o, r) => {
    const u = o.userData, rr = r.r * S3;
    o.position.set(wx(r.x), 0.07, wz(r.y));
    u.ring.scale.setScalar(rr); u.wall.scale.set(rr, 1.2, rr); u.wall.position.y = 0.6;
  });

  syncPool('sigbeam', B && boss.twin2 ? SIG.beams : E, () => {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(R3.geo.box, addMat('#f59e0b', 0.6));
    const inner = new THREE.Mesh(R3.geo.box, addMat('#ffffff', 1));
    g.add(outer, inner); g.userData = { outer, inner }; return g;
  }, (o, bm) => {
    const u = o.userData, t2 = boss.twin2;
    const x1 = wx(boss.x), z1 = wz(boss.y), x2 = wx(t2.x), z2 = wz(t2.y);
    const len = Math.hypot(x2 - x1, z2 - z1), warn = bm.warn > 0;
    o.position.set((x1 + x2) / 2, 1.6, (z1 + z2) / 2); o.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    u.outer.scale.set(len, warn ? 0.08 : 0.7, warn ? 0.08 : 0.7);
    u.inner.scale.set(len, warn ? 0.001 : 0.2, warn ? 0.001 : 0.2);
  });

  syncPool('sigvortex', show ? SIG.vortices : E, () => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(R3.geo.disc, addMat('#0284c7', 0.35));
    const r1 = new THREE.Mesh(R3.geo.ring, addMat('#38bdf8', 0.85));
    const r2 = new THREE.Mesh(R3.geo.thinRing, addMat('#bae6fd', 0.9));
    const funnel = new THREE.Mesh(R3.geo.tube, addMat('#38bdf8', 0.45, R3.vGradTex));
    g.add(disc, r1, r2, funnel); g.userData = { disc, r1, r2, funnel }; return g;
  }, (o, v) => {
    const u = o.userData, r = v.r * S3;
    o.position.set(wx(v.x), 0.06, wz(v.y));
    u.disc.scale.setScalar(r * 1.1);
    u.r1.scale.setScalar(r); u.r1.rotation.y = v.rot;
    u.r2.scale.setScalar(r * 1.85); u.r2.rotation.y = -v.rot * 0.7;
    u.funnel.scale.set(r * 0.85, 5.5, r * 0.85); u.funnel.position.y = 2.75; u.funnel.rotation.y = v.rot * 1.3;
  });

  const activeSwords = show ? SIG.swords.filter(sw => sw.locked) : E;
  syncPool('sigsword', activeSwords, () => {
    const g = new THREE.Group();
    const warn = new THREE.Mesh(R3.geo.thinRing, addMat('#fb7185', 0.9));
    const fill = new THREE.Mesh(R3.geo.disc, addMat('#fb7185', 0.2));
    const sword = new THREE.Group();
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.2, 0.7), glowMat('#fda4af', 2.0)); bl.position.y = 3.1;
    const gd = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 2.2), glowMat('#fbbf24', 1.8)); gd.position.y = 5.4;
    sword.add(bl, gd);
    g.add(warn, fill, sword); g.userData = { warn, fill, sword }; return g;
  }, (o, sw) => {
    const u = o.userData, rr = 56 * S3;
    o.position.set(wx(sw.x), 0.05, wz(sw.y));
    u.warn.scale.setScalar(rr); u.fill.scale.setScalar(rr);
    if (sw.warn > 0) {
      const p = 1 - sw.warn / sw.maxWarn;
      u.sword.visible = true;
      u.sword.position.y = (1 - p * p) * 16;
      u.warn.visible = u.fill.visible = true;
      u.fill.material.opacity = 0.12 + p * 0.3;
    } else {
      u.sword.visible = true;
      u.sword.position.y = 0;
      u.warn.visible = u.fill.visible = false;
    }
  });

  Object.values(CUSTOM_SIGS).forEach(h => { if (typeof h.render3D === 'function') h.render3D(show, SIG); });
}

function drawSigOverlay(c, W, H, k) {
  if (SIG.rewindFx > 0) {
    c.fillStyle = `rgba(16,185,129,${Math.min(0.3, SIG.rewindFx * 0.35)})`;
    c.fillRect(0, 0, W, H);
    c.font = `900 ${Math.round(60 * k)}px Inter`; c.fillStyle = `rgba(167,243,208,${Math.min(1, SIG.rewindFx)})`;
    c.fillText('⏪', W / 2, H * 0.5);
  }
  if (boss && boss.sigCast && boss.sigCast.type === 'rewind') {
    const p = toScreen(wx(boss.x), 6, wz(boss.y));
    const r = 1 - boss.sigCast.timer / boss.sigCast.max;
    c.strokeStyle = '#10b981'; c.lineWidth = 5;
    c.beginPath(); c.arc(p.x, p.y, 22 * k, -Math.PI / 2, -Math.PI / 2 - r * Math.PI * 2, true); c.stroke();
  }
  if (SIG.banner) {
    const b = SIG.banner, a = Math.min(1, b.life * 2, (b.max - b.life) * 6);
    c.globalAlpha = a;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, H * 0.2 - 34 * k, W, 62 * k);
    c.font = `900 ${Math.round(26 * k)}px Cinzel, Inter`; c.fillStyle = b.col; c.shadowColor = b.col; c.shadowBlur = 16;
    c.fillText(b.text, W / 2, H * 0.2);
    c.shadowBlur = 0; c.font = `700 ${Math.round(12 * k)}px Inter`; c.fillStyle = '#e4e4e7';
    c.fillText(b.hint, W / 2, H * 0.2 + 20 * k);
    c.globalAlpha = 1;
  }
}
