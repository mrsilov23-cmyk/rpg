// ============ FIREBASE ============
const firebaseConfig = {
  apiKey: "AIzaSyDIkOkge0LtsNqMIVGQLi-YV43awOyS_iA",
  authDomain: "dnd-gay.firebaseapp.com",
  databaseURL: "https://dnd-gay-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dnd-gay",
  storageBucket: "dnd-gay.firebasestorage.app",
  messagingSenderId: "610307220921",
  appId: "1:610307220921:web:acad740979400b20a60268"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============ КЛАССЫ ПЕРСОНАЖЕЙ ============
const CLASSES = {
  warrior: {
    name: "Воин",
    hp: 120, atk: 14, def: 8, gold: 30,
    desc: "Сильный боец. Много HP и урона.",
    startItems: ["iron_sword", "leather_armor", "bread"]
  },
  mage: {
    name: "Маг",
    hp: 80, atk: 18, def: 4, gold: 40,
    desc: "Хрупкий, но наносит большой урон.",
    startItems: ["wooden_staff", "cloth_robe", "mana_potion"]
  },
  rogue: {
    name: "Вор",
    hp: 95, atk: 16, def: 6, gold: 60,
    desc: "Быстрый, много золота, критические удары.",
    startItems: ["dagger", "leather_armor", "lockpick"]
  },
  cleric: {
    name: "Жрец",
    hp: 100, atk: 10, def: 9, gold: 35,
    desc: "Сбалансирован, может лечиться.",
    startItems: ["mace", "chainmail", "healing_potion", "healing_potion"]
  }
};

// ============ ПРЕДМЕТЫ ============
const ITEMS = {
  iron_sword:    { name: "Железный меч", type: "weapon", atk: 6,  desc: "Простой, но надёжный." },
  wooden_staff:  { name: "Деревянный посох", type: "weapon", atk: 5, desc: "Проводит ману." },
  dagger:        { name: "Кинжал", type: "weapon", atk: 4, crit: 15, desc: "Быстрый удар." },
  mace:          { name: "Булава", type: "weapon", atk: 5, desc: "Дробит кости." },
  steel_sword:   { name: "Стальной меч", type: "weapon", atk: 10, desc: "Острее железа." },
  magic_wand:    { name: "Магический жезл", type: "weapon", atk: 12, desc: "Светится изнутри." },
  shadow_blade:  { name: "Теневой клинок", type: "weapon", atk: 15, crit: 20, desc: "Режет саму тьму." },

  cloth_robe:    { name: "Мантия", type: "armor", def: 3, desc: "Лёгкая ткань." },
  leather_armor: { name: "Кожаная броня", type: "armor", def: 5, desc: "Гибкая защита." },
  chainmail:     { name: "Кольчуга", type: "armor", def: 8, desc: "Металлические кольца." },
  plate_armor:   { name: "Латная броня", type: "armor", def: 12, desc: "Тяжёлая, но крепкая." },
  dragon_scale:  { name: "Драконья чешуя", type: "armor", def: 18, desc: "Легендарная защита." },

  bread:            { name: "Хлеб", type: "potion", heal: 15, desc: "Восстанавливает 15 HP." },
  healing_potion:   { name: "Лечебное зелье", type: "potion", heal: 40, desc: "Восстанавливает 40 HP." },
  mana_potion:      { name: "Зелье маны", type: "potion", heal: 25, desc: "Восстанавливает 25 HP." },
  elixir:           { name: "Эликсир жизни", type: "potion", heal: 100, desc: "Полное восстановление." },

  lockpick:    { name: "Отмычка", type: "tool", desc: "Помогает взламывать замки." },
  torch:       { name: "Факел", type: "tool", desc: "Освещает путь." },
  gold_ring:   { name: "Золотое кольцо", type: "tool", desc: "Можно продать." }
};

// ============ ВРАГИ ============
const ENEMY_TEMPLATES = [
  { name: "Крыса-мутант",    hp: 20,  atk: 5,  def: 1, gold: [3, 8],    loot: ["bread"], chance: 0.4 },
  { name: "Гоблин",          hp: 35,  atk: 8,  def: 2, gold: [8, 18],   loot: ["dagger", "bread"], chance: 0.5 },
  { name: "Скелет-воин",     hp: 50,  atk: 12, def: 5, gold: [15, 30],  loot: ["iron_sword", "healing_potion"], chance: 0.5 },
  { name: "Орк-налётчик",    hp: 70,  atk: 16, def: 6, gold: [25, 50],  loot: ["chainmail", "mace"], chance: 0.6 },
  { name: "Тёмный маг",      hp: 60,  atk: 22, def: 4, gold: [40, 70],  loot: ["magic_wand", "mana_potion"], chance: 0.7 },
  { name: "Тролль",          hp: 120, atk: 20, def: 10, gold: [60, 100], loot: ["plate_armor", "elixir"], chance: 0.8 },
  { name: "Дракон",          hp: 250, atk: 35, def: 15, gold: [200, 400], loot: ["dragon_scale", "shadow_blade"], chance: 1.0 }
];

// ============ КВЕСТЫ ============
const QUEST_POOL = [
  { id: "q1", title: "Первая кровь", desc: "Убей 3 врагов", goal: { type: "kill", count: 3 }, reward: { gold: 50, xp: 30 } },
  { id: "q2", title: "Богач", desc: "Собери 100 золота", goal: { type: "gold", count: 100 }, reward: { gold: 20, xp: 40, item: "healing_potion" } },
  { id: "q3", title: "Охотник", desc: "Убей 5 врагов", goal: { type: "kill", count: 5 }, reward: { gold: 100, xp: 80, item: "steel_sword" } },
  { id: "q4", title: "Исследователь", desc: "Соверши 15 действий", goal: { type: "action", count: 15 }, reward: { gold: 80, xp: 60 } },
  { id: "q5", title: "Легенда", desc: "Убей 10 врагов", goal: { type: "kill", count: 10 }, reward: { gold: 300, xp: 200, item: "shadow_blade" } }
];

// ============ СОСТОЯНИЕ ============
let state = {
  playerId: null,
  name: "",
  classKey: "",
  hp: 0, maxHp: 0,
  atk: 0, def: 0,
  gold: 0, xp: 0, level: 1,
  inventory: [],
  equippedWeapon: null,
  equippedArmor: null,
  kills: 0, actions: 0,
  goldEarned: 0,
  activeQuests: [],
  completedQuests: [],
  currentEnemy: null
};

let currentClass = null;
let itemUID = 0;
let playerRef = null;

const $ = id => document.getElementById(id);
const logEl = $("log");

// ============ ЛОГИН ============
function renderCharSelect() {
  const box = $("charSelect");
  box.innerHTML = "";
  Object.entries(CLASSES).forEach(([key, cls]) => {
    const div = document.createElement("div");
    div.className = "char-card";
    div.dataset.key = key;
    div.innerHTML = `<h4>${cls.name}</h4><small>❤️${cls.hp} ⚔️${cls.atk} 🛡️${cls.def} 💰${cls.gold}<br>${cls.desc}</small>`;
    div.onclick = () => {
      document.querySelectorAll(".char-card").forEach(c => c.classList.remove("selected"));
      div.classList.add("selected");
      currentClass = key;
    };
    box.appendChild(div);
  });
}

$("enterBtn").onclick = async () => {
  const name = $("playerName").value.trim();
  if (!name) return alert("Введи имя!");
  if (!currentClass) return alert("Выбери класс!");

  const cls = CLASSES[currentClass];
  state.playerId = "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  state.name = name;
  state.classKey = currentClass;
  state.hp = cls.hp;
  state.maxHp = cls.hp;
  state.atk = cls.atk;
  state.def = cls.def;
  state.gold = cls.gold;

  cls.startItems.forEach(key => addItem(key));

  playerRef = db.ref("players/" + state.playerId);
  await playerRef.set({
    name: state.name,
    class: cls.name,
    hp: state.hp,
    maxHp: state.maxHp,
    level: state.level,
    gold: state.gold,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
  playerRef.onDisconnect().remove();

  state.activeQuests.push(JSON.parse(JSON.stringify(QUEST_POOL[0])));
  state.activeQuests.push(JSON.parse(JSON.stringify(QUEST_POOL[1])));

  $("loginScreen").classList.remove("active");
  $("gameScreen").classList.add("active");

  addLog(`Добро пожаловать, ${state.name} (${cls.name})!`, "system");
  addLog("Ты стоишь у ворот подземелья. Что будешь делать?", "result");

  updateHUD();
  renderInventory();
  renderQuests();
  listenPlayers();
  listenGlobalEvents();
};

// ============ ИНВЕНТАРЬ ============
function addItem(key) {
  const item = ITEMS[key];
  if (!item) return;
  const entry = { key, uid: ++itemUID, equipped: false };
  state.inventory.push(entry);
  if (item.type === "weapon" && !state.equippedWeapon) equipItem(entry.uid);
  if (item.type === "armor" && !state.equippedArmor) equipItem(entry.uid);
}

function removeItem(uid) {
  const idx = state.inventory.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  const entry = state.inventory[idx];
  if (state.equippedWeapon === entry) state.equippedWeapon = null;
  if (state.equippedArmor === entry) state.equippedArmor = null;
  state.inventory.splice(idx, 1);
  recalcStats();
  renderInventory();
  updateHUD();
}

function equipItem(uid) {
  const entry = state.inventory.find(i => i.uid === uid);
  if (!entry) return;
  const item = ITEMS[entry.key];
  if (item.type === "weapon") {
    if (state.equippedWeapon) state.equippedWeapon.equipped = false;
    state.equippedWeapon = entry;
  } else if (item.type === "armor") {
    if (state.equippedArmor) state.equippedArmor.equipped = false;
    state.equippedArmor = entry;
  } else return;
  entry.equipped = true;
  recalcStats();
  renderInventory();
  updateHUD();
}

function recalcStats() {
  const cls = CLASSES[state.classKey];
  let atk = cls.atk + (state.level - 1);
  let def = cls.def;
  if (state.equippedWeapon) {
    const w = ITEMS[state.equippedWeapon.key];
    if (w.atk) atk += w.atk;
  }
  if (state.equippedArmor) {
    const a = ITEMS[state.equippedArmor.key];
    if (a.def) def += a.def;
  }
  state.atk = atk;
  state.def = def;
}

function renderInventory() {
  const box = $("invTab");
  box.innerHTML = "";
  const groups = { weapon: [], armor: [], potion: [], tool: [] };
  state.inventory.forEach(e => groups[ITEMS[e.key].type].push(e));

  const titles = { weapon: "⚔️ Оружие", armor: "🛡️ Броня", potion: "🧪 Расходники", tool: "🔧 Прочее" };

  Object.entries(groups).forEach(([type, arr]) => {
    if (!arr.length) return;
    const h = document.createElement("h4");
    h.style.cssText = "color:#8888a0;font-size:12px;margin:12px 0 6px";
    h.textContent = titles[type];
    box.appendChild(h);

    arr.forEach(entry => {
      const item = ITEMS[entry.key];
      const div = document.createElement("div");
      div.className = "item" + (entry.equipped ? " equipped" : "");
      let stats = "";
      if (item.atk) stats += `⚔️+${item.atk} `;
      if (item.def) stats += `🛡️+${item.def} `;
      if (item.heal) stats += `❤️+${item.heal} `;
      if (item.crit) stats += `💥${item.crit}% `;
      div.innerHTML = `
        <div class="item-name">${item.name} ${entry.equipped ? "✅" : ""}</div>
        <div class="item-desc">${item.desc || ""}</div>
        ${stats ? `<div class="item-stats">${stats}</div>` : ""}
      `;

      if (item.type === "weapon" || item.type === "armor") {
        const btn = document.createElement("button");
        btn.textContent = entry.equipped ? "Снять" : "Экипировать";
        btn.onclick = () => {
          if (entry.equipped) {
            entry.equipped = false;
            if (item.type === "weapon") state.equippedWeapon = null;
            else state.equippedArmor = null;
            recalcStats(); renderInventory(); updateHUD();
          } else equipItem(entry.uid);
        };
        div.appendChild(btn);
      }

      if (item.type === "potion") {
        const btn = document.createElement("button");
        btn.textContent = "Использовать";
        btn.onclick = () => usePotion(entry.uid);
        div.appendChild(btn);
      }

      box.appendChild(div);
    });
  });

  if (!state.inventory.length) box.innerHTML = "<p style='color:#666'>Пусто...</p>";
}

function usePotion(uid) {
  const entry = state.inventory.find(i => i.uid === uid);
  if (!entry) return;
  const item = ITEMS[entry.key];
  const before = state.hp;
  state.hp = Math.min(state.maxHp, state.hp + item.heal);
  addLog(`Использовано: ${item.name} (+${state.hp - before} HP)`, "loot");
  removeItem(uid);
  updateHUD();
  savePlayerState();
}

// ============ КВЕСТЫ ============
function renderQuests() {
  const box = $("questsTab");
  box.innerHTML = "";
  if (!state.activeQuests.length && !state.completedQuests.length) {
    box.innerHTML = "<p style='color:#666'>Нет квестов</p>";
    return;
  }

  state.activeQuests.forEach(q => {
    const div = document.createElement("div");
    div.className = "quest";
    div.innerHTML = `<div class="q-title">${q.title}</div><div class="q-desc">${q.desc}</div>`;
    box.appendChild(div);
  });

  state.completedQuests.forEach(q => {
    const div = document.createElement("div");
    div.className = "quest done";
    div.innerHTML = `<div class="q-title">✅ ${q.title}</div>`;
    box.appendChild(div);
  });
}

function checkQuests() {
  const done = [];
  state.activeQuests.forEach(q => {
    let progress = 0;
    if (q.goal.type === "kill") progress = state.kills;
    if (q.goal.type === "gold") progress = state.goldEarned;
    if (q.goal.type === "action") progress = state.actions;
    if (progress >= q.goal.count) done.push(q);
  });

  done.forEach(q => {
    state.activeQuests = state.activeQuests.filter(x => x.id !== q.id);
    state.completedQuests.push(q);
    if (q.reward.gold) { state.gold += q.reward.gold; state.goldEarned += q.reward.gold; }
    if (q.reward.xp) state.xp += q.reward.xp;
    if (q.reward.item) addItem(q.reward.item);
    addLog(`🎉 Квест выполнен: "${q.title}"! Награда: ${q.reward.gold || 0}💰 ${q.reward.xp || 0}⭐`, "loot");

    const nextQ = QUEST_POOL.find(p => !state.completedQuests.some(c => c.id === p.id)
      && !state.activeQuests.some(a => a.id === p.id));
    if (nextQ) {
      state.activeQuests.push(JSON.parse(JSON.stringify(nextQ)));
      addLog(`📜 Новый квест: "${nextQ.title}" — ${nextQ.desc}`, "online");
    }
  });

  renderQuests();
}

// ============ HUD ============
function updateHUD() {
  $("hudName").textContent = state.name;
  $("hudClass").textContent = CLASSES[state.classKey].name + " ур." + state.level;
  $("hudHp").textContent = state.hp;
  $("hudMaxHp").textContent = state.maxHp;
  $("hudAtk").textContent = state.atk;
  $("hudDef").textContent = state.def;
  $("hudGold").textContent = state.gold;
  $("hudXp").textContent = state.xp;
}

// ============ ЛОГ ============
function addLog(text, cls = "result") {
  const p = document.createElement("p");
  p.className = cls;
  p.innerHTML = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// ============ ДЕЙСТВИЯ ============
$("actionBtn").onclick = performAction;
$("actionInput").addEventListener("keydown", e => {
  if (e.key === "Enter") performAction();
});

function performAction() {
  const text = $("actionInput").value.trim();
  if (!text) return;
  $("actionInput").value = "";
  state.actions++;
  addLog(`▶ ${state.name}: ${text}`, "player-action");

  resolveAction(text);

  savePlayerState();
  checkQuests();
  updateHUD();
  renderInventory();
}

// ============ ДВИЖОК ДЕЙСТВИЙ ============
function resolveAction(input) {
  const t = input.toLowerCase();

  if (matchesAny(t, ["атак", "удар", "бью", "бей", "руб", "кол", "стрел", "кидаю", "сража", "fight", "attack", "hit"])) {
    return doAttack();
  }
  if (matchesAny(t, ["леч", "лечусь", "исцел", "heal", "восстанов"])) {
    return doHeal();
  }
  if (matchesAny(t, ["защищ", "блок", "прикры", "defend", "block", "уворач", "dodge"])) {
    return doDefend();
  }
  if (matchesAny(t, ["осмотр", "смотр", "исслед", "искать", "обыск", "look", "search", "examine"])) {
    return doSearch();
  }
  if (matchesAny(t, ["инвентар", "рюкзак", "сумк", "inventory", "проверяю вещи"])) {
    addLog("🎒 Ты осматриваешь инвентарь:", "result");
    state.inventory.forEach(e => {
      const it = ITEMS[e.key];
      addLog(`• ${it.name}${e.equipped ? " ✅" : ""} — ${it.desc || ""}`, "online");
    });
    return;
  }
  if (matchesAny(t, ["квест", "задани", "quest", "миссия"])) {
    addLog("📜 Активные квесты:", "result");
    state.activeQuests.forEach(q => addLog(`• ${q.title}: ${q.desc}`, "online"));
    return;
  }
  if (matchesAny(t, ["прода", "торг", "купить", "магазин", "sell", "trade", "buy"])) {
    return doTrade();
  }
  if (matchesAny(t, ["отдых", "спать", "отдохн", "rest", "sleep"])) {
    return doRest();
  }
  if (matchesAny(t, ["напада", "выхожу", "иду", "войти", "входи", "enter", "go"])) {
    return spawnEnemy();
  }
  if (matchesAny(t, ["бегу", "убега", "отступ", "flee", "run away"])) {
    return doFlee();
  }

  const randoms = [
    "Ты пытаешься сделать это, но ничего не происходит...",
    "Мир не отвечает на такое действие. Попробуй что-то другое.",
    "Ты мнёшься на месте. Может, лучше атаковать, искать или отдохнуть?",
    "Это действие не имеет смысла в этих землях."
  ];
  addLog("❓ " + pick(randoms), "system");
  if (Math.random() < 0.2) doRandomEvent();
}

function matchesAny(text, list) { return list.some(k => text.includes(k)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ============ БОЙ ============
function spawnEnemy() {
  if (state.currentEnemy) {
    addLog(`⚔️ Ты уже сражаешься с ${state.currentEnemy.name}!`, "system");
    return;
  }
  let maxIdx = Math.min(ENEMY_TEMPLATES.length - 1, Math.floor(state.level * 0.8));
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  const tpl = ENEMY_TEMPLATES[idx];
  state.currentEnemy = {
    name: tpl.name,
    hp: tpl.hp + Math.floor(state.level * 5),
    maxHp: tpl.hp + Math.floor(state.level * 5),
    atk: tpl.atk + Math.floor(state.level * 2),
    def: tpl.def,
    gold: randInt(tpl.gold[0], tpl.gold[1]),
    loot: tpl.loot,
    lootChance: tpl.chance
  };
  addLog(`👹 Из тени появляется <b>${state.currentEnemy.name}</b>! HP: ${state.currentEnemy.hp}, ATK: ${state.currentEnemy.atk}`, "system");
}

function doAttack() {
  if (!state.currentEnemy) {
    addLog("Ты бьёшь воздух. Никого нет рядом. Может, пойти искать приключений?", "system");
    if (Math.random() < 0.5) spawnEnemy();
    return;
  }
  const enemy = state.currentEnemy;
  let dmg = Math.max(1, state.atk - enemy.def + randInt(-2, 4));
  let crit = false;
  if (state.equippedWeapon) {
    const w = ITEMS[state.equippedWeapon.key];
    if (w.crit && Math.random() * 100 < w.crit) {
      dmg = Math.floor(dmg * 1.8);
      crit = true;
    }
  }
  enemy.hp -= dmg;
  addLog(`🗡️ Ты наносишь ${dmg} урона${crit ? " <b>(КРИТ!)</b>" : ""} ${enemy.name}.`, "result");
  if (enemy.hp <= 0) return killEnemy();
  enemyTurn();
}

function enemyTurn() {
  const enemy = state.currentEnemy;
  if (!enemy) return;
  let dmg = Math.max(1, enemy.atk - state.def + randInt(-2, 3));
  if (Math.random() < 0.08) {
    addLog(`💨 Ты уклоняешься от атаки ${enemy.name}!`, "result");
  } else {
    state.hp -= dmg;
    addLog(`💥 ${enemy.name} атакует тебя и наносит ${dmg} урона!`, "system");
  }
  if (state.hp <= 0) { state.hp = 0; return playerDeath(); }
  updateHUD();
}

function killEnemy() {
  const enemy = state.currentEnemy;
  state.kills++;
  state.gold += enemy.gold;
  state.goldEarned += enemy.gold;
  const xpGain = Math.floor(enemy.maxHp / 2);
  state.xp += xpGain;
  addLog(`🏆 ${enemy.name} побеждён! Получено ${enemy.gold}💰 и ${xpGain}⭐`, "loot");

  if (Math.random() < enemy.lootChance && enemy.loot.length) {
    const lootKey = pick(enemy.loot);
    addItem(lootKey);
    addLog(`🎁 Выпало: ${ITEMS[lootKey].name}`, "loot");
  }
  checkLevelUp();
  state.currentEnemy = null;
  updateHUD();
  renderInventory();
  checkQuests();
  savePlayerState();
}

function checkLevelUp() {
  const xpForLevel = state.level * 100;
  if (state.xp >= xpForLevel) {
    state.xp -= xpForLevel;
    state.level++;
    state.maxHp += 15;
    state.hp = state.maxHp;
    recalcStats();
    addLog(`🌟 УРОВЕНЬ ПОВЫШЕН! Теперь ты ${state.level} уровня! HP восстановлено.`, "loot");
  }
}

function doHeal() {
  const potions = state.inventory.filter(e => ITEMS[e.key].type === "potion");
  if (!potions.length) {
    addLog("🧪 У тебя нет зелий или еды для лечения!", "system");
    if (state.currentEnemy) enemyTurn();
    return;
  }
  potions.sort((a, b) => ITEMS[b.key].heal - ITEMS[a.key].heal);
  usePotion(potions[0].uid);
  if (state.currentEnemy) enemyTurn();
}

function doDefend() {
  addLog("🛡️ Ты встаёшь в защитную стойку.", "result");
  if (state.currentEnemy) {
    const enemy = state.currentEnemy;
    let dmg = Math.max(0, Math.floor((enemy.atk - state.def * 2) + randInt(-2, 2)));
    state.hp -= dmg;
    addLog(`💥 ${enemy.name} атакует, но ты блокируешь большую часть. Урон: ${dmg}`, "system");
    if (state.hp <= 0) { state.hp = 0; return playerDeath(); }
  } else {
    addLog("Но вокруг никого нет.", "online");
  }
  updateHUD();
}

function doSearch() {
  addLog("🔍 Ты внимательно осматриваешься...", "result");
  const roll = Math.random();
  if (roll < 0.3) {
    const gold = randInt(5, 25) * state.level;
    state.gold += gold;
    state.goldEarned += gold;
    addLog(`💰 Ты находишь мешочек с ${gold} золота!`, "loot");
  } else if (roll < 0.5) {
    const keys = Object.keys(ITEMS).filter(k => ITEMS[k].type !== "tool");
    const found = pick(keys);
    addItem(found);
    addLog(`🎁 Ты находишь: ${ITEMS[found].name}`, "loot");
  } else if (roll < 0.7) {
    addLog("Ничего полезного не найдено.", "online");
  } else {
    addLog("🌫️ Ты наткнулся на скрытого врага!", "system");
    spawnEnemy();
  }
}

function doTrade() {
  let sold = 0;
  const toRemove = [];
  state.inventory.forEach(e => {
    const item = ITEMS[e.key];
    if (e.equipped) return;
    if (item.type === "tool" || (item.type === "weapon" && !e.equipped) || (item.type === "armor" && !e.equipped)) {
      const price = Math.floor(10 + (item.atk || 0) * 5 + (item.def || 0) * 5);
      state.gold += price;
      state.goldEarned += price;
      sold++;
      toRemove.push(e.uid);
      addLog(`💱 Продано: ${item.name} за ${price}💰`, "loot");
    }
  });
  if (!sold) addLog("💱 Тебе нечего продавать.", "online");
  toRemove.forEach(removeItem);
}

function doRest() {
  if (state.currentEnemy) {
    addLog("⚠️ Нельзя отдыхать во время боя!", "system");
    enemyTurn();
    return;
  }
  const heal = Math.floor(state.maxHp * 0.3);
  state.hp = Math.min(state.maxHp, state.hp + heal);
  addLog(`😴 Ты отдыхаешь у костра и восстанавливаешь ${heal} HP.`, "loot");
  if (Math.random() < 0.25) {
    addLog("👹 Но отдых прерван — враг атакует!", "system");
    spawnEnemy();
  }
  updateHUD();
}

function doFlee() {
  if (!state.currentEnemy) {
    addLog("Ты не в бою. Бежать не от кого.", "online");
    return;
  }
  if (Math.random() < 0.6) {
    addLog(`💨 Ты успешно убегаешь от ${state.currentEnemy.name}!`, "result");
    state.currentEnemy = null;
  } else {
    addLog("❌ Побег не удался!", "system");
    enemyTurn();
  }
}

function doRandomEvent() {
  const events = [
    () => { const g = randInt(1, 10); state.gold += g; state.goldEarned += g; addLog(`✨ Мимо пролетела фея и оставила ${g} золота.`, "loot"); },
    () => { addLog("🌧️ Начинается дождь. Ты промокаешь, но продолжаешь путь.", "online"); },
    () => { const dmg = randInt(2, 8); state.hp -= dmg; addLog(`🪨 С потолка падает камень! -${dmg} HP.`, "system"); },
    () => { addLog("👻 Ты слышишь шёпот в темноте...", "online"); }
  ];
  pick(events)();
  if (state.hp <= 0) { state.hp = 0; playerDeath(); }
  updateHUD();
}

function playerDeath() {
  addLog("💀 Ты погиб! Мир на мгновение замирает...", "system");
  const lost = Math.floor(state.gold / 2);
  state.gold -= lost;
  state.hp = Math.floor(state.maxHp * 0.5);
  state.currentEnemy = null;
  addLog(`Ты возрождаешься в лагере. Потеряно ${lost}💰, но осталось ${state.hp} HP.`, "online");
  broadcastEvent(`${state.name} пал в бою...`);
  updateHUD();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============ СОХРАНЕНИЕ И ОНЛАЙН ============
async function savePlayerState() {
  if (!playerRef) return;
  await playerRef.update({
    hp: state.hp,
    maxHp: state.maxHp,
    gold: state.gold,
    level: state.level,
    kills: state.kills,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
}

function listenPlayers() {
  db.ref("players").on("value", snap => {
    const data = snap.val() || {};
    const box = $("playersTab");
    box.innerHTML = "";
    const arr = Object.entries(data);
    arr.forEach(([id, p]) => {
      const div = document.createElement("div");
      div.className = "player-row";
      const isMe = id === state.playerId;
      div.innerHTML = `<span>${isMe ? "👤 " : ""}${p.name} <small style="color:#888">${p.class || ""} ур.${p.level || 1}</small></span>
                       <span class="online-dot">● ${p.hp}/${p.maxHp}❤️ ${p.gold}💰</span>`;
      box.appendChild(div);
    });

    const loginList = $("onlinePlayers");
    if (loginList) {
      loginList.innerHTML = arr.length ? `<b>Онлайн (${arr.length}):</b><br>` +
        arr.map(([_, p]) => `• ${p.name} (${p.class || "?"})`).join("<br>") : "Сейчас никто не играет";
    }
  });
}

function listenGlobalEvents() {
  db.ref("events").limitToLast(20).on("child_added", snap => {
    const ev = snap.val();
    if (!ev || ev.from === state.playerId) return;
    if (Date.now() - ev.time < 10000) {
      addLog(`🌐 ${ev.text}`, "online");
    }
  });
}

function broadcastEvent(text) {
  db.ref("events").push({
    text,
    from: state.playerId,
    time: firebase.database.ServerValue.TIMESTAMP
  });
  db.ref("events").limitToLast(50).once("value", snap => {
    const count = snap.numChildren();
    if (count > 100) {
      const toDelete = count - 100;
      let i = 0;
      snap.forEach(c => {
        if (i++ < toDelete) c.ref.remove();
      });
    }
  });
}

// ============ ТАБЫ ============
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $(tab.dataset.tab + "Tab").classList.add("active");
  };
});

// ============ ИНИЦИАЛИЗАЦИЯ ============
renderCharSelect();
