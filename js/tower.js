// =========================================================================
// SACRED NOIR 3D — БЕСКОНЕЧНАЯ БАШНЯ (ENDLESS ROGUELIKE TOWER)
// Бесконечные этажи с ростом сложности + выбор 1 из 3 даров после победы.
// =========================================================================
'use strict';

const TOWER_BOONS = [
  { id: 'dmg_up',      icon: '⚔️', name: 'Заточка Бездны',     desc: '+22% ко всему урону катаны, волн и Иайдо.',        apply: s => { s.dmgMult *= 1.22; } },
  { id: 'max_hp',      icon: '❤️', name: 'Сосуд Жизни',        desc: '+1 к макс. HP и полное восстановление здоровья.',  apply: s => { s.bonusHp += 1; s.carryHp = 99; } },
  { id: 'posture_up',  icon: '⚡', name: 'Молот Концентрации', desc: '+35% к слому концентрации боссов.',                apply: s => { s.postureMult *= 1.35; } },
  { id: 'parry_bolt',  icon: '🌩️', name: 'Громовой Отбив',     desc: 'Каждое парирование бьёт босса молнией (-4% HP).',  apply: s => { s.parryBolt += 0.04; } },
  { id: 'extra_dash',  icon: '💨', name: 'Шаги Призрака',      desc: '+1 дополнительный заряд рывка.',                   apply: s => { s.bonusDashes += 1; } },
  { id: 'extra_flask', icon: '🧪', name: 'Кровавый Источник',  desc: '+1 Фляга Крови на каждом этаже и +1 HP сейчас.',   apply: s => { s.bonusFlasks += 1; s.carryHp += 1; } },
  { id: 'cheap_iaido', icon: '🌀', name: 'Быстрый Клинок',     desc: 'Иайдо стоит на 12🩸 меньше и быстрее откатывается.', apply: s => { s.iaidoDiscount += 12; } },
  { id: 'vampirism',   icon: '🩸', name: 'Жажда Крови',        desc: 'Каждая Казнь восстанавливает +1 HP.',              apply: s => { s.execHeal = true; } }
];

const TOWER = {
  active: false,
  floor: 0,
  bestFloor: 0,
  boons: [],
  mods: null
};

function towerResetMods() {
  TOWER.mods = {
    dmgMult: 1,
    postureMult: 1,
    bonusHp: 0,
    bonusDashes: 0,
    bonusFlasks: 0,
    iaidoDiscount: 0,
    parryBolt: 0,
    execHeal: false,
    carryHp: 3
  };
  TOWER.boons = [];
}

function startEndlessTower() {
  TOWER.active = true;
  TOWER.floor = 1;
  towerResetMods();
  towerLaunchFloor();
}

function towerPickBossIdx() {
  const n = BOSSES_DATA.length;
  // Первые этажи чуть мягче, дальше — вся линейка вплоть до Омеги
  const poolMax = Math.min(n, 4 + TOWER.floor * 2);
  let idx = Math.floor(Math.random() * poolMax);
  if (idx === currentBossIdx && poolMax > 1) idx = (idx + 1) % poolMax;
  return idx;
}

function towerLaunchFloor() {
  const bIdx = towerPickBossIdx();
  startFight(bIdx, null, false);
  // Применяем модификаторы Башни к игроку и скейл HP босса
  if (player && TOWER.mods) {
    const m = TOWER.mods;
    player.maxHp = 3 + m.bonusHp;
    player.hp = Math.min(player.maxHp, m.carryHp);
    player.maxDashes = (player.maxDashes || 2) + m.bonusDashes;
    player.dashCharges = player.maxDashes;
    player.maxFlasks = (player.maxFlasks || 2) + m.bonusFlasks;
    player.flasks = player.maxFlasks;
  }
  if (boss) {
    const scale = 1 + (TOWER.floor - 1) * 0.14;
    boss.maxHp = Math.round(boss.maxHp * scale);
    boss.hp = boss.maxHp;
  }
  const pBadge = document.getElementById('hud-pantheon-badge');
  if (pBadge) {
    pBadge.textContent = `🗼 БАШНЯ · ЭТАЖ ${TOWER.floor}`;
    pBadge.classList.remove('hidden');
  }
  updateHUD();
}

function towerOnFloorCleared() {
  if (TOWER.floor > TOWER.bestFloor) {
    TOWER.bestFloor = TOWER.floor;
    saveProgress();
  }
  if (player && TOWER.mods) {
    TOWER.mods.carryHp = Math.min(player.maxHp, player.hp + 1);
  }
  // Показываем выбор 1 из 3 случайных даров
  const modal = document.getElementById('tower-boon-modal');
  const grid = document.getElementById('tower-boon-grid');
  const title = document.getElementById('tower-boon-title');
  if (!modal || !grid) { TOWER.floor++; towerLaunchFloor(); return; }

  gameState = 'PAUSED';
  audio.stopMusic();
  document.getElementById('slain-banner').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('touch-controls').classList.add('hidden');

  if (title) title.textContent = `ЭТАЖ ${TOWER.floor} ПРОЙДЕН · ВЫБЕРИ ДАР`;
  const shuffled = TOWER_BOONS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  grid.innerHTML = '';
  shuffled.forEach(b => {
    const card = document.createElement('button');
    card.className = 'text-left p-4 rounded-xl bg-zinc-950/95 hover:bg-amber-950/50 border-2 border-amber-700/70 hover:border-amber-400 transition flex flex-col justify-between gap-2 shadow-lg';
    card.innerHTML = `
      <div>
        <div class="text-2xl mb-1.5">${b.icon}</div>
        <div class="font-serif-noir text-sm font-black text-amber-200">${b.name}</div>
        <p class="text-[11px] text-zinc-300 mt-1 leading-relaxed">${b.desc}</p>
      </div>
      <div class="text-[10px] font-black text-amber-400 tracking-widest pt-2 border-t border-zinc-800 text-center">[ ПРИНЯТЬ ДАР ]</div>
    `;
    card.addEventListener('click', () => {
      b.apply(TOWER.mods);
      TOWER.boons.push(b.id);
      modal.classList.add('hidden');
      TOWER.floor++;
      towerLaunchFloor();
    });
    grid.appendChild(card);
  });
  modal.classList.remove('hidden');
}

function updateTowerButton() {
  const btn = document.getElementById('btn-tower');
  if (btn) btn.textContent = `🗼 БАШНЯ · РЕКОРД ${TOWER.bestFloor}`;
}
