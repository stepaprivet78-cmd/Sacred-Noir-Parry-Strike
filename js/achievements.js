// =========================================================================
// SACRED NOIR 3D — РАСШИРЕННАЯ СИСТЕМА ДОСТИЖЕНИЙ (ACHIEVEMENTS)
// Автоматически генерирует ачивки за каждого босса из BOSS_REGISTRY +
// достижения за стиль убийства, контракты и накопительное мастерство.
// =========================================================================
'use strict';

const ACH = {
  unlocked: {},     // { [achId]: timestamp }
  stats: {
    totalParries: 0,
    totalExecutions: 0,
    totalPerfectDodges: 0,
    totalClashesWon: 0,
    totalKills: 0
  },
  run: {
    lastDamageSource: 'melee', // 'melee' | 'wave' | 'iaido' | 'execution' | 'parry_reflect' | 'blood_debt' | 'clash'
    executions: 0,
    clashesWon: 0,
    perfectDodges: 0
  },
  filter: 'all'
};

function getAchievementsCatalog() {
  const list = [];

  // 1. Автоматические достижения за каждого босса из единого реестра BOSS_REGISTRY
  if (typeof BOSS_REGISTRY !== 'undefined') {
    BOSS_REGISTRY.forEach(b => {
      const meta = b.achievement || {};
      list.push({
        id: meta.id || `slay_${b.key}`,
        cat: 'boss',
        icon: meta.icon || '💀',
        title: meta.title || `Падение: ${b.name}`,
        desc: meta.desc || `Победить босса ${b.roman}. ${b.name}`,
        bossId: b.id
      });
    });
  }

  // 2. Достижения за способ добивания и боевой стиль
  const styleList = [
    {
      id: 'kill_execution',
      cat: 'style',
      icon: '🩸',
      title: 'Приговор приведён',
      desc: 'Добить любого босса смертельной «Казнью» после слома концентрации.'
    },
    {
      id: 'kill_iaido',
      cat: 'style',
      icon: '⚡',
      title: 'Один взмах — одна смерть',
      desc: 'Нанести решающий смертельный удар разрезом «Иайдо».'
    },
    {
      id: 'kill_wave',
      cat: 'style',
      icon: '🌊',
      title: 'Багровый прилив',
      desc: 'Добить босса снарядом «Кровавой Волны» (финишер комбо).'
    },
    {
      id: 'kill_parry',
      cat: 'style',
      icon: '🪞',
      title: 'Зеркало возмездия',
      desc: 'Убить босса отражённым снарядом или разрядом «Кровавого долга».'
    },
    {
      id: 'style_clash_win',
      cat: 'style',
      icon: '⚔️',
      title: 'Скрещённые клинки',
      desc: 'Победить босса, разрубив его рывок в «Клинковом клэше».'
    },
    {
      id: 'style_parry_5',
      cat: 'style',
      icon: '🛡️',
      title: 'Стальная стена',
      desc: 'Совершить не менее 5 идеальных парирований за один победный бой.'
    },
    {
      id: 'style_no_hit',
      cat: 'style',
      icon: '👻',
      title: 'Безупречная тень',
      desc: 'Победить любого босса без единого полученного удара (ранг S+ / S++).'
    },
    {
      id: 'contract_blood_debt',
      cat: 'style',
      icon: '📜',
      title: 'Кровавый заимодавец',
      desc: 'Одержать победу с хардкорным контрактом «Кровавый долг».'
    },
    {
      id: 'contract_blind_blade',
      cat: 'style',
      icon: '👁️',
      title: 'Слепой мечник',
      desc: 'Победить любого босса с 1 HP по контракту «Слепой клинок».'
    },
    {
      id: 'contract_double_down',
      cat: 'style',
      icon: '👑',
      title: 'Кровавый Святой',
      desc: 'Победить босса с контрактом «Двойная ставка» на высший ранг S++.'
    },
    {
      id: 'style_speedrun',
      cat: 'style',
      icon: '⏱️',
      title: 'Молниеносная казнь',
      desc: 'Расправиться с любым боссом быстрее чем за 35 секунд.'
    },
    {
      id: 'pantheon_full',
      cat: 'style',
      icon: '🏛️',
      title: 'Божество Бездны',
      desc: 'Пройти весь режим «Пантеон» до самого конца.'
    },
    // 3. Накопительное мастерство с прогресс-баром
    {
      id: 'prog_parries_25',
      cat: 'mastery',
      icon: '💠',
      title: 'Мастер отбива',
      desc: 'Выполнить 25 идеальных парирований суммарно во всех боях.',
      statKey: 'totalParries',
      target: 25
    },
    {
      id: 'prog_executions_10',
      cat: 'mastery',
      icon: '💀',
      title: 'Вершитель казней',
      desc: 'Провести 10 смертоносных «Казней» по оглушённым боссам.',
      statKey: 'totalExecutions',
      target: 10
    },
    {
      id: 'prog_dodges_30',
      cat: 'mastery',
      icon: '💨',
      title: 'Тень на острие',
      desc: 'Совершить 30 идеальных уворотов сквозь атаки врагов.',
      statKey: 'totalPerfectDodges',
      target: 30
    }
  ];

  return list.concat(styleList);
}

function achResetRun() {
  ACH.run.lastDamageSource = 'melee';
  ACH.run.executions = 0;
  ACH.run.clashesWon = 0;
  ACH.run.perfectDodges = 0;
}

function achSetDamageSource(src) {
  ACH.run.lastDamageSource = src;
}

function achUnlock(id, silent = false) {
  if (ACH.unlocked[id]) return false;
  ACH.unlocked[id] = Date.now();
  const catalog = getAchievementsCatalog();
  const meta = catalog.find(a => a.id === id);
  if (!silent && meta) showAchievementToast(meta);
  achCheckBonusSkin(silent);
  if (typeof updateAchievementsButton === 'function') updateAchievementsButton();
  if (!silent && typeof saveProgress === 'function') saveProgress();
  return true;
}

function achCheckBonusSkin(silent = false) {
  const count = Object.keys(ACH.unlocked).length;
  if (typeof unlockedSkins !== 'undefined' && count >= 10 && !unlockedSkins.emerald) {
    unlockedSkins.emerald = true;
    if (typeof updateArmoryButton === 'function') updateArmoryButton();
    if (!silent) {
      showAchievementToast({
        icon: '🗡️',
        title: 'Нефритовый Жнец (Скин открыт!)',
        desc: 'За 10 достижений новая катана добавлена в Оружейную.'
      });
    }
  }
}

function achCheckProgress(silent = false) {
  const catalog = getAchievementsCatalog();
  catalog.forEach(a => {
    if (a.target && a.statKey) {
      if ((ACH.stats[a.statKey] || 0) >= a.target) achUnlock(a.id, silent);
    }
  });
}

// Синхронизация со старыми рекордами сейва (ретроактивное открытие за уже убитых боссов)
function achSyncWithRecords(silent = true) {
  if (typeof BOSS_REGISTRY === 'undefined' || typeof getBossRecord !== 'function') return;
  let anyNoHit = false;
  let anyDoubleDown = false;
  BOSS_REGISTRY.forEach(b => {
    const r = getBossRecord(b.id);
    if (r.wins > 0 && b.achievement) achUnlock(b.achievement.id, silent);
    if (r.bestRank === 'S+' || r.bestRank === 'S++') anyNoHit = true;
    if (r.bestRank === 'S++') anyDoubleDown = true;
    if (r.bestTime !== null && r.bestTime <= 35) achUnlock('style_speedrun', silent);
  });
  if (anyNoHit) achUnlock('style_no_hit', silent);
  if (anyDoubleDown) achUnlock('contract_double_down', silent);
  if (typeof pantheonBestTime !== 'undefined' && pantheonBestTime !== null) achUnlock('pantheon_full', silent);
  achCheckProgress(silent);
  achCheckBonusSkin(silent);
}

// Боевые хуки (срабатывают прямо во время боя!)
function achOnParry() {
  ACH.stats.totalParries = (ACH.stats.totalParries || 0) + 1;
  achCheckProgress(false);
}

function achOnExecution() {
  ACH.run.executions++;
  ACH.stats.totalExecutions = (ACH.stats.totalExecutions || 0) + 1;
  achCheckProgress(false);
}

function achOnPerfectDodge() {
  ACH.run.perfectDodges++;
  ACH.stats.totalPerfectDodges = (ACH.stats.totalPerfectDodges || 0) + 1;
  achCheckProgress(false);
}

function achOnClashWin() {
  ACH.run.clashesWon++;
  ACH.stats.totalClashesWon = (ACH.stats.totalClashesWon || 0) + 1;
}

// Вызывается в секунду убийства босса (прямо в triggerBossSlain, чтобы тост вылетел в бою!)
function achOnBossKilled(bossIdx) {
  ACH.stats.totalKills = (ACH.stats.totalKills || 0) + 1;
  const cfg = typeof getBossConfig === 'function' ? getBossConfig(bossIdx) : null;
  if (cfg && cfg.achievement) achUnlock(cfg.achievement.id, false);

  const src = ACH.run.lastDamageSource;
  if (src === 'execution') achUnlock('kill_execution', false);
  if (src === 'iaido') achUnlock('kill_iaido', false);
  if (src === 'wave') achUnlock('kill_wave', false);
  if (src === 'parry_reflect' || src === 'blood_debt') achUnlock('kill_parry', false);

  if (ACH.run.clashesWon > 0) achUnlock('style_clash_win', false);
  if (typeof runParries !== 'undefined' && runParries >= 5) achUnlock('style_parry_5', false);
  if (typeof runHitsTaken !== 'undefined' && runHitsTaken === 0) achUnlock('style_no_hit', false);
  if (typeof runTimer !== 'undefined' && runTimer <= 35) achUnlock('style_speedrun', false);

  if (typeof activeContract !== 'undefined') {
    if (activeContract === 'blood_debt') achUnlock('contract_blood_debt', false);
    if (activeContract === 'blind_blade') achUnlock('contract_blind_blade', false);
    if (activeContract === 'double_down') achUnlock('contract_double_down', false);
  }

  if (typeof pantheonMode !== 'undefined' && pantheonMode && typeof BOSSES_DATA !== 'undefined' && bossIdx >= BOSSES_DATA.length - 1) {
    achUnlock('pantheon_full', false);
  }
}

// Сериализация для сейва
function achExportSave() {
  return { unlocked: ACH.unlocked, stats: ACH.stats };
}

function achImportSave(data) {
  if (!data || typeof data !== 'object') return;
  if (data.unlocked && typeof data.unlocked === 'object') {
    Object.keys(data.unlocked).forEach(k => {
      if (data.unlocked[k]) ACH.unlocked[k] = Number(data.unlocked[k]) || 1;
    });
  }
  if (data.stats && typeof data.stats === 'object') {
    Object.keys(ACH.stats).forEach(k => {
      if (typeof data.stats[k] === 'number') ACH.stats[k] = data.stats[k];
    });
  }
}

// =========================================================================
// UI: ВСПЛЫВАЮЩИЕ ТОСТЫ И МОДАЛЬНОЕ ОКНО ДОСТИЖЕНИЙ
// =========================================================================
function showAchievementToast(meta) {
  const wrap = document.getElementById('ach-toast-container');
  if (!wrap) return;
  if (typeof audio !== 'undefined' && audio && typeof audio.playTone === 'function') {
    audio.playTone(523, 784, 0.14, 'triangle', 0.14);
    setTimeout(() => { try { audio.playTone(784, 1046, 0.22, 'sine', 0.14); } catch (e) {} }, 90);
  }
  const el = document.createElement('div');
  el.className = 'pointer-events-none flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-950/95 border-2 border-amber-400/90 shadow-[0_0_28px_rgba(251,191,36,0.45)] transform translate-x-8 opacity-0 transition-all duration-300 max-w-xs sm:max-w-sm';
  el.innerHTML = `
    <div class="w-10 h-10 shrink-0 rounded-lg bg-amber-950/80 border border-amber-500/70 flex items-center justify-center text-xl">${meta.icon || '🏆'}</div>
    <div class="min-w-0">
      <div class="text-[9px] font-black tracking-[0.25em] text-amber-400 uppercase">🏆 ДОСТИЖЕНИЕ ОТКРЫТО</div>
      <div class="font-serif-noir text-xs sm:text-sm font-black text-zinc-100 truncate">${meta.title}</div>
      <div class="text-[10px] text-zinc-400 leading-snug line-clamp-2">${meta.desc}</div>
    </div>
  `;
  wrap.appendChild(el);
  requestAnimationFrame(() => {
    el.classList.remove('translate-x-8', 'opacity-0');
  });
  setTimeout(() => {
    el.classList.add('translate-x-8', 'opacity-0');
    setTimeout(() => el.remove(), 350);
  }, 3800);
}

function updateAchievementsButton() {
  const btn = document.getElementById('btn-achievements');
  if (!btn) return;
  const catalog = getAchievementsCatalog();
  const unlockedCount = catalog.filter(a => !!ACH.unlocked[a.id]).length;
  btn.textContent = `🏆 АЧИВКИ (${unlockedCount}/${catalog.length})`;
}

function openAchievementsModal(filter) {
  if (filter) ACH.filter = filter;
  achSyncWithRecords(true);
  const modal = document.getElementById('achievements-modal');
  const grid = document.getElementById('ach-grid');
  const bar = document.getElementById('ach-progress-bar');
  const countEl = document.getElementById('ach-progress-text');
  if (!modal || !grid) return;

  const catalog = getAchievementsCatalog();
  const unlockedCount = catalog.filter(a => !!ACH.unlocked[a.id]).length;
  const pct = catalog.length > 0 ? Math.round((unlockedCount / catalog.length) * 100) : 0;
  if (bar) bar.style.width = `${pct}%`;
  if (countEl) countEl.textContent = `Открыто: ${unlockedCount} из ${catalog.length} (${pct}%) · 10 ачивок открывают скин «Нефритовый Жнец»`;

  document.querySelectorAll('.ach-filter-btn').forEach(b => {
    const active = b.dataset.filter === ACH.filter;
    b.className = `ach-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
      active ? 'bg-amber-500 text-black' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700'
    }`;
  });

  const filtered = catalog.filter(a => {
    if (ACH.filter === 'unlocked') return !!ACH.unlocked[a.id];
    if (ACH.filter === 'boss') return a.cat === 'boss';
    if (ACH.filter === 'style') return a.cat === 'style' || a.cat === 'mastery';
    return true;
  });

  grid.innerHTML = '';
  filtered.forEach(a => {
    const isUnl = !!ACH.unlocked[a.id];
    const curVal = a.statKey ? Math.min(a.target, ACH.stats[a.statKey] || 0) : (isUnl ? 1 : 0);
    const maxVal = a.target || 1;
    const pPct = Math.min(100, Math.round((curVal / maxVal) * 100));

    const card = document.createElement('div');
    card.className = `p-3 rounded-xl border transition flex items-start gap-3 ${
      isUnl
        ? 'bg-gradient-to-br from-amber-950/35 via-zinc-950 to-zinc-950 border-amber-500/75 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
        : 'bg-zinc-950/80 border-zinc-800/90 opacity-75'
    }`;
    card.innerHTML = `
      <div class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-lg border ${
        isUnl ? 'bg-amber-950/80 border-amber-400/80' : 'bg-zinc-900 border-zinc-700 grayscale opacity-60'
      }">${a.icon}</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-2">
          <div class="font-serif-noir text-xs sm:text-sm font-black ${isUnl ? 'text-amber-200' : 'text-zinc-300'} truncate">${a.title}</div>
          <span class="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded ${
            isUnl ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
          }">${isUnl ? '✓ ОТКРЫТО' : '🔒 ЗАКРЫТО'}</span>
        </div>
        <p class="text-[11px] text-zinc-400 mt-0.5 leading-snug">${a.desc}</p>
        ${a.target ? `
          <div class="mt-2">
            <div class="flex justify-between text-[10px] text-zinc-400 mb-0.5">
              <span>Прогресс</span>
              <span class="font-mono font-bold ${isUnl ? 'text-amber-300' : 'text-zinc-300'}">${curVal} / ${maxVal}</span>
            </div>
            <div class="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div class="h-full ${isUnl ? 'bg-amber-400' : 'bg-rose-600'}" style="width:${pPct}%"></div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    grid.appendChild(card);
  });

  modal.classList.remove('hidden');
}
