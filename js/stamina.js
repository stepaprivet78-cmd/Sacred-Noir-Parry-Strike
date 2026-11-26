// =========================================================================
// SACRED NOIR 3D — STAMINA (выносливость в стиле Souls)
// =========================================================================
'use strict';

const STAM = { max: 100, regen: 48, delay: 0.5, exhaustTime: 1.2,
  cost: { attack: 14, finisher: 20, dash: 22, parry: 8 } };

function staminaInit(p) {
  p.stamina = STAM.max; p.stamDelay = 0; p.exhausted = 0; p.stamShow = 0;
}

function updateStamina(p, dt) {
  if (p.stamina === undefined) staminaInit(p);
  if (p.exhausted > 0) { p.exhausted -= dt; p.slowMul = (p.slowMul || 1) * 0.6; }
  const hasFeather = typeof hasTalisman === 'function' && hasTalisman('stamina_feather');
  const regenRate = STAM.regen * (hasFeather ? 1.35 : 1);
  if (p.stamDelay > 0) p.stamDelay -= dt * (hasFeather ? 1.3 : 1);
  else if (p.stamina < STAM.max) p.stamina = Math.min(STAM.max, p.stamina + regenRate * (p.exhausted > 0 ? 0.6 : 1) * dt);
  if (p.stamina < STAM.max) p.stamShow = 1.2; else if (p.stamShow > 0) p.stamShow -= dt;
}

// true — действие разрешено и оплачено
function spendStamina(p, kind) {
  if (p.stamina === undefined) staminaInit(p);
  if (p.exhausted > 0) {
    if (!p._stamWarn || totalTime - p._stamWarn > 0.6) {
      p._stamWarn = totalTime;
      spawnFloatingText(p.x, p.y - 26, '💨 НЕТ СИЛ', '#a3e635', 13);
      audio.playTone(160, 90, 0.1, 'triangle', 0.08);
    }
    return false;
  }
  const c = STAM.cost[kind] || 10;
  p.stamina -= c;
  p.stamDelay = STAM.delay;
  p.stamShow = 1.2;
  if (p.stamina <= 0) {
    p.stamina = 0;
    p.exhausted = STAM.exhaustTime;
    p.stamDelay = 0.35;
    if (typeof achOnExhausted === 'function') achOnExhausted();
    spawnFloatingText(p.x, p.y - 30, '😮‍💨 ИЗНЕМОЖЕНИЕ', '#a3e635', 15);
  }
  return true;
}

function restoreStamina(p, amount) {
  if (p.stamina === undefined) staminaInit(p);
  p.stamina = Math.min(STAM.max, p.stamina + amount);
  if (p.stamina > 25) p.exhausted = 0;
}

function drawStaminaOverlay(c, k) {
  if (!player || player.dead || !(player.stamShow > 0)) return;
  const s = toScreen(wx(player.x), 0, wz(player.y));
  if (!s.ok) return;
  const w = 56 * k, h = 6 * k, x = s.x - w / 2, y = s.y + 14 * k;
  const a = Math.min(1, player.stamShow * 2);
  c.globalAlpha = a;
  c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  const pct = player.stamina / STAM.max;
  const ex = player.exhausted > 0;
  c.fillStyle = ex ? (Math.floor(totalTime * 10) % 2 ? '#ef4444' : '#7f1d1d') : (pct < 0.3 ? '#facc15' : '#84cc16');
  c.fillRect(x, y, w * pct, h);
  c.globalAlpha = 1;
}
