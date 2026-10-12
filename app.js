// ===== Монетный Кликер v2.0 =====

// ---------- UPGRADES ----------
const UPGRADES = [
  { id: 'power', name: 'Сила клика', desc: 'Больше монет за клик', icon: '💪', baseCost: 15, costMult: 1.55, maxLevel: 60 },
  { id: 'auto', name: 'Автокликер', desc: 'Пассивный доход / сек', icon: '⚙️', baseCost: 50, costMult: 1.7, maxLevel: 40 },
  { id: 'crit', name: 'Крит. удар', desc: 'Шанс ×5 монет', icon: '⚡', baseCost: 120, costMult: 1.9, maxLevel: 25 },
  { id: 'multiplier', name: 'Множитель', desc: 'Усиливает весь доход', icon: '✨', baseCost: 500, costMult: 2.15, maxLevel: 20 },
  { id: 'lucky', name: 'Удача', desc: 'Шанс ×10 монет', icon: '🍀', baseCost: 280, costMult: 1.85, maxLevel: 20 },
  { id: 'combo', name: 'Комбо', desc: 'Множитель за серию кликов', icon: '🔥', baseCost: 200, costMult: 1.75, maxLevel: 15 },
  { id: 'golden', name: 'Золотое касание', desc: 'Шанс ×25 монет', icon: '👑', baseCost: 1500, costMult: 2.4, maxLevel: 10 },
  { id: 'boost', name: 'Ускоритель', desc: 'Автодоход растёт быстрее', icon: '🚀', baseCost: 800, costMult: 2.0, maxLevel: 12 }
];

// ---------- SKINS ----------
const SKINS = [
  { id: 'classic', name: 'Классика', emoji: '🪙', gradient: 'from-indigo-500 via-purple-500 to-pink-500', inner: 'from-indigo-600 to-purple-700', unlockLevel: 1, cost: 0 },
  { id: 'gold', name: 'Золото', emoji: '🥇', gradient: 'from-amber-400 via-yellow-500 to-orange-500', inner: 'from-amber-500 to-yellow-600', unlockLevel: 3, cost: 500 },
  { id: 'fire', name: 'Огонь', emoji: '🔥', gradient: 'from-red-500 via-orange-500 to-yellow-400', inner: 'from-red-600 to-orange-600', unlockLevel: 5, cost: 2000 },
  { id: 'ice', name: 'Лёд', emoji: '❄️', gradient: 'from-cyan-400 via-blue-500 to-indigo-600', inner: 'from-cyan-500 to-blue-600', unlockLevel: 8, cost: 8000 },
  { id: 'nature', name: 'Природа', emoji: '🌿', gradient: 'from-emerald-400 via-green-500 to-teal-600', inner: 'from-emerald-500 to-green-600', unlockLevel: 10, cost: 15000 },
  { id: 'galaxy', name: 'Галактика', emoji: '🌌', gradient: 'from-violet-600 via-fuchsia-500 to-pink-500', inner: 'from-violet-700 to-fuchsia-600', unlockLevel: 15, cost: 50000 },
  { id: 'diamond', name: 'Алмаз', emoji: '💎', gradient: 'from-sky-300 via-cyan-400 to-blue-500', inner: 'from-sky-400 to-cyan-500', unlockLevel: 20, cost: 150000 },
  { id: 'rainbow', name: 'Радуга', emoji: '🌈', gradient: 'from-red-400 via-yellow-400 to-green-400', inner: 'from-pink-500 to-purple-600', unlockLevel: 25, cost: 500000 }
];

// ---------- STATE ----------
const defaultState = () => ({
  coins: 0,
  totalEarned: 0,
  totalClicks: 0,
  level: 1,
  xp: 0,
  upgrades: Object.fromEntries(UPGRADES.map(u => [u.id, 0])),
  ownedSkins: ['classic'],
  activeSkin: 'classic',
  user: null,           // { uid, name, email, photoURL, isDemo }
  combo: 0,
  lastClickTime: 0
});

let state = defaultState();
let autoInterval = null;
let lastSave = 0;
let firebaseReady = false;
let db = null;
let auth = null;

// ---------- FIREBASE ----------
function initFirebase() {
  if (typeof firebase === 'undefined' || !USE_FIREBASE) return false;
  const cfg = firebaseConfig;
  if (!cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') return false;
  try {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseReady = true;
    return true;
  } catch (e) {
    console.warn('Firebase init error', e);
    return false;
  }
}

// ---------- PERSISTENCE ----------
function load() {
  try {
    const raw = localStorage.getItem('coinClickerSave_v2');
    if (raw) {
      const data = JSON.parse(raw);
      state = { ...defaultState(), ...data };
      if (!state.upgrades) state.upgrades = defaultState().upgrades;
      if (!state.ownedSkins) state.ownedSkins = ['classic'];
    }
  } catch (e) {}
}

function save() {
  const now = Date.now();
  if (now - lastSave < 350) return;
  lastSave = now;
  try {
    localStorage.setItem('coinClickerSave_v2', JSON.stringify(state));
  } catch (e) {}
  // Sync score to leaderboard periodically
  if (firebaseReady && state.user && !state.user.isDemo) {
    pushScore();
  }
}

// ---------- CALCULATIONS ----------
function getClickPower() {
  const base = 1 + (state.upgrades.power || 0);
  return Math.floor(base * getMultiplier() * getComboMult());
}

function getCPS() {
  const autoLvl = state.upgrades.auto || 0;
  const boostLvl = state.upgrades.boost || 0;
  const base = autoLvl * 0.5 * (1 + boostLvl * 0.12);
  return base * getMultiplier();
}

function getMultiplier() {
  return 1 + (state.upgrades.multiplier || 0) * 0.15;
}

function getCritChance() {
  return Math.min((state.upgrades.crit || 0) * 2, 45);
}

function getLuckyChance() {
  return Math.min((state.upgrades.lucky || 0) * 1.5, 28);
}

function getGoldenChance() {
  return Math.min((state.upgrades.golden || 0) * 1.2, 12);
}

function getComboMult() {
  const maxCombo = 1 + (state.upgrades.combo || 0) * 0.25;
  const comboBonus = Math.min(1 + state.combo * 0.05, maxCombo);
  return comboBonus;
}

function getUpgradeCost(id) {
  const u = UPGRADES.find(x => x.id === id);
  const lvl = state.upgrades[id] || 0;
  return Math.floor(u.baseCost * Math.pow(u.costMult, lvl));
}

function xpToNextLevel(level) {
  return Math.floor(100 * Math.pow(1.38, level - 1));
}

// ---------- GAME ACTIONS ----------
function doClick(e) {
  if (!state.user) return;

  const now = Date.now();
  // Combo: if clicked within 1.2s of previous → increase, else reset
  if (now - state.lastClickTime < 1200) {
    state.combo = Math.min(state.combo + 1, 30);
  } else {
    state.combo = 0;
  }
  state.lastClickTime = now;

  let gain = getClickPower();
  let isCrit = false, isLucky = false, isGolden = false;

  if (Math.random() * 100 < getCritChance()) { gain *= 5; isCrit = true; }
  if (Math.random() * 100 < getLuckyChance()) { gain *= 10; isLucky = true; }
  if (Math.random() * 100 < getGoldenChance()) { gain *= 25; isGolden = true; }

  state.coins += gain;
  state.totalEarned += gain;
  state.totalClicks += 1;
  state.xp += Math.max(1, Math.floor(gain / 6));
  checkLevelUp();

  spawnCoin(e, gain, isCrit, isLucky, isGolden);
  updateComboUI();
  updateUI();
  save();
}

function buyUpgrade(id) {
  const cost = getUpgradeCost(id);
  const u = UPGRADES.find(x => x.id === id);
  const lvl = state.upgrades[id] || 0;
  if (lvl >= u.maxLevel || state.coins < cost) return;
  state.coins -= cost;
  state.upgrades[id] = lvl + 1;
  updateUI();
  save();
  startAuto();
}

function buySkin(id) {
  const skin = SKINS.find(s => s.id === id);
  if (!skin || state.ownedSkins.includes(id)) return;
  if (state.level < skin.unlockLevel || state.coins < skin.cost) return;
  state.coins -= skin.cost;
  state.ownedSkins.push(id);
  applySkin(id);
  updateUI();
  save();
}

function applySkin(id) {
  if (!state.ownedSkins.includes(id)) return;
  state.activeSkin = id;
  const skin = SKINS.find(s => s.id === id);
  const btn = document.getElementById('click-btn');
  const inner = document.getElementById('click-btn-inner');
  const emoji = document.getElementById('click-emoji');
  btn.className = `click-btn relative w-44 h-44 sm:w-52 sm:h-52 rounded-full flex items-center justify-center bg-gradient-to-br ${skin.gradient} shadow-[0_0_50px_rgba(99,102,241,0.35)]`;
  inner.className = `absolute inset-2 rounded-full flex items-center justify-center bg-gradient-to-br ${skin.inner}`;
  emoji.textContent = skin.emoji;
  save();
}

function checkLevelUp() {
  let needed = xpToNextLevel(state.level);
  while (state.xp >= needed) {
    state.xp -= needed;
    state.level += 1;
    needed = xpToNextLevel(state.level);
    state.coins += state.level * 15;
    state.totalEarned += state.level * 15;
  }
}

function startAuto() {
  if (autoInterval) clearInterval(autoInterval);
  const cps = getCPS();
  if (cps <= 0) return;
  autoInterval = setInterval(() => {
    const amount = cps / 10;
    state.coins += amount;
    state.totalEarned += amount;
    updateUI(true);
    save();
  }, 100);
}

// ---------- LEADERBOARD ----------
async function pushScore() {
  if (!firebaseReady || !state.user || state.user.isDemo) return;
  try {
    await db.collection('leaderboard').doc(state.user.uid).set({
      name: state.user.name,
      photoURL: state.user.photoURL || null,
      totalEarned: Math.floor(state.totalEarned),
      level: state.level,
      totalClicks: state.totalClicks,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Leaderboard push failed', e);
  }
}

async function fetchLeaderboard() {
  const container = document.getElementById('panel-leaderboard');
  container.innerHTML = '<div class="text-center text-slate-400 text-sm py-6">Загрузка...</div>';

  if (firebaseReady) {
    try {
      const snap = await db.collection('leaderboard')
        .orderBy('totalEarned', 'desc')
        .limit(20)
        .get();
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      renderLeaderboard(list);
      return;
    } catch (e) {
      console.warn('Firestore leaderboard error', e);
    }
  }

  // Demo / fallback leaderboard
  const demoPlayers = [
    { name: 'CryptoKing', totalEarned: 12500000, level: 42, totalClicks: 89000 },
    { name: 'ClickMaster', totalEarned: 8200000, level: 38, totalClicks: 71000 },
    { name: 'МонетныйБарон', totalEarned: 5100000, level: 33, totalClicks: 55000 },
    { name: 'ПроКликер', totalEarned: 2800000, level: 28, totalClicks: 41000 },
    { name: 'GoldenHand', totalEarned: 1500000, level: 24, totalClicks: 32000 },
    { name: 'SpeedTap', totalEarned: 920000, level: 21, totalClicks: 28000 },
    { name: 'LuckyOne', totalEarned: 610000, level: 18, totalClicks: 22000 },
    { name: 'Новичок777', totalEarned: 340000, level: 15, totalClicks: 15000 }
  ];
  // Insert current user
  if (state.user) {
    demoPlayers.push({
      name: state.user.name,
      totalEarned: Math.floor(state.totalEarned),
      level: state.level,
      totalClicks: state.totalClicks,
      isMe: true
    });
  }
  demoPlayers.sort((a, b) => b.totalEarned - a.totalEarned);
  renderLeaderboard(demoPlayers.slice(0, 15));
}

function renderLeaderboard(list) {
  const container = document.getElementById('panel-leaderboard');
  if (!list.length) {
    container.innerHTML = '<div class="text-center text-slate-400 text-sm py-6">Пока пусто. Будь первым!</div>';
    return;
  }
  container.innerHTML = list.map((p, i) => {
    const isMe = p.isMe || (state.user && p.id === state.user.uid);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span class="text-slate-500 w-5 text-center">${i + 1}</span>`;
    return `
      <div class="glass rounded-xl px-3 py-2.5 flex items-center gap-3 ${isMe ? 'leader-me' : ''}">
        <div class="w-6 text-center text-sm">${medal}</div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate ${isMe ? 'text-indigo-300' : ''}">${p.name}${isMe ? ' (ты)' : ''}</div>
          <div class="text-xs text-slate-400">Ур. ${p.level} · ${formatNum(p.totalClicks || 0)} кликов</div>
        </div>
        <div class="text-amber-400 font-semibold text-sm tabular-nums">${formatNum(p.totalEarned)} 🪙</div>
      </div>
    `;
  }).join('');
}

// ---------- UI HELPERS ----------
function formatNum(n) {
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Qa';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString('ru-RU');
}

function spawnCoin(e, amount, isCrit, isLucky, isGolden) {
  const el = document.createElement('div');
  el.className = 'coin-fly';
  let text = `+${formatNum(amount)}`;
  if (isGolden) text = `👑 ${text}`;
  else if (isLucky) text = `🍀 ${text}`;
  else if (isCrit) text = `⚡ ${text}`;
  el.textContent = text;
  el.style.left = ((e && e.clientX) || window.innerWidth / 2) + 'px';
  el.style.top = ((e && e.clientY) || window.innerHeight / 2) + 'px';
  el.style.color = isGolden ? '#fbbf24' : isLucky ? '#34d399' : isCrit ? '#fcd34d' : '#f59e0b';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

function updateComboUI() {
  const el = document.getElementById('combo-display');
  if (state.combo >= 3) {
    el.classList.remove('opacity-0');
    document.getElementById('combo-value').textContent = getComboMult().toFixed(2);
  } else {
    el.classList.add('opacity-0');
  }
}

function updateUI(light = false) {
  document.getElementById('coin-balance').textContent = formatNum(state.coins);
  document.getElementById('click-power').textContent = formatNum(getClickPower());
  document.getElementById('total-clicks').textContent = formatNum(state.totalClicks);
  document.getElementById('user-level').textContent = state.level;

  const cps = getCPS();
  const cpsEl = document.getElementById('cps-display');
  if (cps > 0) {
    cpsEl.classList.remove('opacity-0');
    document.getElementById('cps-value').textContent = formatNum(cps);
  } else {
    cpsEl.classList.add('opacity-0');
  }

  if (!light) {
    renderUpgrades();
    renderSkins();
    updateStats();
  }
}

function updateStats() {
  document.getElementById('stat-total-earned').textContent = formatNum(state.totalEarned) + ' 🪙';
  document.getElementById('stat-total-clicks').textContent = formatNum(state.totalClicks);
  document.getElementById('stat-cps').textContent = formatNum(getCPS()) + ' 🪙/сек';
  document.getElementById('stat-power').textContent = formatNum(getClickPower());
  document.getElementById('stat-level').textContent = state.level;
  const needed = xpToNextLevel(state.level);
  document.getElementById('xp-text').textContent = `${formatNum(state.xp)} / ${formatNum(needed)}`;
  document.getElementById('xp-bar').style.width = Math.min(100, (state.xp / needed) * 100) + '%';
}

function renderUpgrades() {
  const container = document.getElementById('panel-upgrades');
  container.innerHTML = UPGRADES.map(u => {
    const lvl = state.upgrades[u.id] || 0;
    const cost = getUpgradeCost(u.id);
    const maxed = lvl >= u.maxLevel;
    const canBuy = state.coins >= cost && !maxed;

    let effect = '';
    if (u.id === 'power') effect = `+${lvl} к силе`;
    else if (u.id === 'auto') effect = `+${(lvl * 0.5).toFixed(1)}/сек`;
    else if (u.id === 'crit') effect = `${getCritChance()}% ×5`;
    else if (u.id === 'multiplier') effect = `×${getMultiplier().toFixed(2)}`;
    else if (u.id === 'lucky') effect = `${getLuckyChance().toFixed(1)}% ×10`;
    else if (u.id === 'combo') effect = `макс ×${(1 + lvl * 0.25).toFixed(2)}`;
    else if (u.id === 'golden') effect = `${getGoldenChance().toFixed(1)}% ×25`;
    else if (u.id === 'boost') effect = `+${(lvl * 12)}% к авто`;

    return `
      <div class="upgrade-card glass rounded-xl p-3 flex items-center gap-2.5 ${canBuy ? 'border border-indigo-500/30' : ''}">
        <div class="w-11 h-11 rounded-xl bg-slate-700/70 flex items-center justify-center text-xl shrink-0">${u.icon}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-sm">${u.name}</span>
            <span class="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">ур.${lvl}</span>
          </div>
          <div class="text-[11px] text-slate-400 truncate">${u.desc}</div>
          <div class="text-[11px] text-indigo-300">${effect}</div>
        </div>
        <button onclick="buyUpgrade('${u.id}')"
          class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition
            ${maxed ? 'bg-slate-700 text-slate-500' : canBuy ? 'bg-indigo-600 text-white shadow shadow-indigo-500/30' : 'bg-slate-700/70 text-slate-400'}"
          ${maxed ? 'disabled' : ''}>
          ${maxed ? 'МАКС' : formatNum(cost) + '🪙'}
        </button>
      </div>`;
  }).join('');
}

function renderSkins() {
  const container = document.getElementById('panel-skins');
  container.innerHTML = SKINS.map(s => {
    const owned = state.ownedSkins.includes(s.id);
    const active = state.activeSkin === s.id;
    const canUnlock = state.level >= s.unlockLevel && state.coins >= s.cost;
    const lockedByLevel = state.level < s.unlockLevel;

    let btnText = '';
    if (active) btnText = '✓ Выбран';
    else if (owned) btnText = 'Выбрать';
    else if (lockedByLevel) btnText = `Ур. ${s.unlockLevel}`;
    else btnText = formatNum(s.cost) + '🪙';

    return `
      <div class="skin-card glass rounded-xl p-3 flex flex-col items-center gap-2 ${active ? 'ring-2 ring-indigo-400' : ''}">
        <div class="w-14 h-14 rounded-full bg-gradient-to-br ${s.gradient} flex items-center justify-center text-2xl shadow-lg">
          ${s.emoji}
        </div>
        <div class="text-xs font-medium text-center">${s.name}</div>
        <button onclick="${owned ? `applySkin('${s.id}')` : `buySkin('${s.id}')`}"
          class="w-full py-1.5 rounded-lg text-[11px] font-bold transition
            ${active ? 'bg-indigo-600/40 text-indigo-200' :
              owned ? 'bg-indigo-600 text-white' :
              canUnlock ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'}"
          ${(!owned && !canUnlock) || active ? 'disabled' : ''}>
          ${btnText}
        </button>
      </div>`;
  }).join('');
}

// ---------- AUTH ----------
function showUser(user) {
  state.user = user;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('auth-badge').textContent = user.isDemo ? 'Гость' : 'Google';

  const avatar = document.getElementById('user-avatar');
  const avatarImg = document.getElementById('user-avatar-img');
  if (user.photoURL) {
    avatarImg.src = user.photoURL;
    avatarImg.classList.remove('hidden');
    avatar.classList.add('hidden');
  } else {
    avatar.textContent = (user.name || 'U')[0].toUpperCase();
    avatar.classList.remove('hidden');
    avatarImg.classList.add('hidden');
  }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  applySkin(state.activeSkin || 'classic');
  updateUI();
  startAuto();
  save();
}

function loginDemo() {
  const names = ['Алексей', 'Мария', 'Иван', 'Анна', 'Дмитрий', 'Елена', 'Сергей', 'Ольга', 'Никита', 'Катя'];
  const name = names[Math.floor(Math.random() * names.length)];
  showUser({
    uid: 'demo_' + Date.now(),
    name,
    email: null,
    photoURL: null,
    isDemo: true
  });
}

async function loginGoogle() {
  const status = document.getElementById('login-status');
  status.classList.remove('hidden');

  if (!firebaseReady) {
    status.textContent = 'Firebase не настроен → вход как гость';
    setTimeout(loginDemo, 600);
    return;
  }

  status.textContent = 'Открываем Google...';
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const u = result.user;
    showUser({
      uid: u.uid,
      name: u.displayName || 'Игрок',
      email: u.email,
      photoURL: u.photoURL,
      isDemo: false
    });
    pushScore();
  } catch (e) {
    console.error(e);
    status.textContent = 'Ошибка входа. Попробуй демо.';
    status.classList.add('text-red-400');
  }
}

async function logout() {
  if (autoInterval) clearInterval(autoInterval);
  if (firebaseReady && auth.currentUser) {
    try { await auth.signOut(); } catch (e) {}
  }
  state.user = null;
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('login-status').classList.add('hidden');
  save();
}

function resetProgress() {
  if (!confirm('Сбросить весь прогресс? Это нельзя отменить.')) return;
  const user = state.user;
  const owned = state.ownedSkins;
  const active = state.activeSkin;
  state = defaultState();
  state.user = user;
  state.ownedSkins = owned.length ? owned : ['classic'];
  state.activeSkin = active || 'classic';
  if (autoInterval) clearInterval(autoInterval);
  applySkin(state.activeSkin);
  updateUI();
  save();
}

// ---------- TABS ----------
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('bg-indigo-600', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-slate-400', !active);
  });
  ['upgrades', 'skins', 'leaderboard', 'stats'].forEach(id => {
    document.getElementById('panel-' + id).classList.toggle('hidden', id !== tab);
  });
  if (tab === 'stats') updateStats();
  if (tab === 'leaderboard') fetchLeaderboard();
  if (tab === 'skins') renderSkins();
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  load();
  initFirebase();

  document.getElementById('google-login-btn').addEventListener('click', loginGoogle);
  document.getElementById('demo-login-btn').addEventListener('click', loginDemo);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('click-btn').addEventListener('click', doClick);
  document.getElementById('reset-btn').addEventListener('click', resetProgress);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Restore session
  if (state.user) {
    showUser(state.user);
  } else if (firebaseReady) {
    auth.onAuthStateChanged(user => {
      if (user) {
        showUser({
          uid: user.uid,
          name: user.displayName || 'Игрок',
          email: user.email,
          photoURL: user.photoURL,
          isDemo: false
        });
      }
    });
  }

  // Prevent double-tap zoom
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
});

// Expose for onclick
window.buyUpgrade = buyUpgrade;
window.buySkin = buySkin;
window.applySkin = applySkin;
