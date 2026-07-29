export const state = {
    playerTeam: [],
    enemyTeam: [],
    turnQueue: [],
    currentTurnIndex: 0,
    selectedSkill: null,
    selectedTarget: null,
    timerInterval: null,
    timeLeft: 60,
    currentArena: null,   // выбранная арена на текущий бой (см. js/arenas.js)
    difficulty: 'normal', // сложность бота на текущий бой: easy | normal | hard
    playerSkipStreak: 0,  // сколько ходов подряд игрок пропустил по таймеру (см. combat.js)
    // Бой уже завершён (победа, поражение или сдача). Нужен, потому что ход
    // бота запускается отложенно (setTimeout ~1.5 сек): без этого флага
    // сдавшийся игрок успевал уйти в меню, а запланированный ход бота всё
    // равно срабатывал и продолжал доигрывать несуществующий бой.
    battleOver: false
};

export let currentProfile = null;
export let allProfiles = []; // Массив всех созданных профилей

function generateId() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function ensureProfileShape(p) {
    if (!p.id) p.id = generateId();
    if (!p.stats) p.stats = { wins: 0, losses: 0, battles: 0 };
    if (!p.difficulty) p.difficulty = 'normal';
    if (!Array.isArray(p.unlockedHeroes)) p.unlockedHeroes = [];
    if (typeof p.coins !== 'number') p.coins = 0;
    if (!Array.isArray(p.redeemedCodes)) p.redeemedCodes = [];
    if (p.pendingPromoHero === undefined) p.pendingPromoHero = null;
    if (!p.avatar) p.avatar = 'assets/ilya.png';
    if (!Array.isArray(p.unlockedSkins)) p.unlockedSkins = [];
    if (!p.equippedSkins || typeof p.equippedSkins !== 'object') p.equippedSkins = {};
    if (!Array.isArray(p.inventory)) p.inventory = [];
    if (!p.equippedWeapons || typeof p.equippedWeapons !== 'object') p.equippedWeapons = {};
    return p;
}

export function loadProfile() {
    const saved = localStorage.getItem('bogatyr_profiles_v2');
    if (!saved) return false;

    try {
        allProfiles = JSON.parse(saved);
        if (!Array.isArray(allProfiles)) allProfiles = [];
    } catch (e) {
        console.error('Не удалось прочитать сохранённые профили, данные повреждены:', e);
        allProfiles = [];
        return false;
    }

    // На случай старых сохранений без id/stats/difficulty - добираем их,
    // чтобы остальной код мог полагаться на то, что поля всегда есть.
    let needsResave = false;
    allProfiles.forEach(p => {
        const before = JSON.stringify(p);
        ensureProfileShape(p);
        if (JSON.stringify(p) !== before) needsResave = true;
    });
    if (needsResave) saveAllProfiles();

    return allProfiles.length > 0;
}

export function selectProfile(index) {
    currentProfile = allProfiles[index];
}

export function createProfile(name, selectedHeroes, avatarImg) {
    const newProfile = ensureProfileShape({
        id: generateId(),
        name: name,
        coins: 0,
        avatar: avatarImg || 'assets/ilya.png',
        unlockedHeroes: selectedHeroes
    });
    allProfiles.push(newProfile);
    currentProfile = newProfile;
    saveAllProfiles();
}

function saveAllProfiles() {
    localStorage.setItem('bogatyr_profiles_v2', JSON.stringify(allProfiles));
}

// Обновление текущего профиля внутри массива - матчим по стабильному id,
// а не по имени, т.к. два профиля вполне могут называться одинаково.
export function saveProfile() {
    const index = allProfiles.findIndex(p => p.id === currentProfile.id);
    if (index !== -1) {
        allProfiles[index] = currentProfile;
        saveAllProfiles();
    }
}

export function deleteProfile(index) {
    allProfiles.splice(index, 1);
    saveAllProfiles();
    currentProfile = null;
}

export function setDifficulty(difficulty) {
    if (currentProfile) {
        currentProfile.difficulty = difficulty;
        saveProfile();
    }
}

export const DIFFICULTY_REWARDS = { easy: 25, normal: 50, hard: 90 };

export function winBattle(difficulty) {
    if (currentProfile) {
        currentProfile.coins += DIFFICULTY_REWARDS[difficulty] || DIFFICULTY_REWARDS.normal;
        currentProfile.stats.wins++;
        currentProfile.stats.battles++;
        saveProfile();
    }
}

export function recordLoss() {
    if (currentProfile) {
        currentProfile.stats.losses++;
        currentProfile.stats.battles++;
        saveProfile();
    }
}

export function buyHero(heroPrice, heroId) {
    if (currentProfile.coins >= heroPrice && !currentProfile.unlockedHeroes.includes(heroId)) {
        currentProfile.coins -= heroPrice;
        currentProfile.unlockedHeroes.push(heroId);
        saveProfile();
        return true;
    }
    return false;
}

/** Покупка альтернативного образа (см. js/skins.js). Требует уже открытого героя. */
export function buySkin(skinId, price) {
    if (currentProfile.coins >= price && !currentProfile.unlockedSkins.includes(skinId)) {
        currentProfile.coins -= price;
        currentProfile.unlockedSkins.push(skinId);
        saveProfile();
        return true;
    }
    return false;
}

/** Надеть купленный скин героя (или снять его, если skinId === null). */
export function equipSkin(heroId, skinId) {
    if (skinId && !currentProfile.unlockedSkins.includes(skinId)) return false;
    currentProfile.equippedSkins[heroId] = skinId || null;
    saveProfile();
    return true;
}

// --------------------------- Инвентарь и оружие (v1.04) ---------------------------

export const INVENTORY_CAPACITY = 15;

/** Добавляет оружие в инвентарь (дубликаты разрешены - можно продать лишние). */
export function addWeaponToInventory(weaponId) {
    currentProfile.inventory.push(weaponId);
    saveProfile();
}

/** Инвентарь полон, когда занято 15 ЯЧЕЕК — независимо от того, повторы это или нет. */
export function isInventoryFull() {
    return currentProfile.inventory.length >= INVENTORY_CAPACITY;
}

/**
 * Выдаёт награду за сундук: оружие, а если места нет — монеты по цене продажи.
 *
 * Раньше "полным" считался инвентарь из 15 РАЗНЫХ типов, а одинаковые копии
 * складывались в одну ячейку значком "x6" и лезли сверх лимита. Из-за этого
 * сундуки вели себя непредсказуемо: то выдавали оружие в переполненную сетку,
 * то вдруг сообщали "нет места" и давали золото. Теперь правило простое и
 * одинаковое во всех случаях: одна ячейка — одна единица оружия, всего 15
 * ячеек, дубликаты занимают отдельные ячейки и не складываются.
 */
export function grantChestReward(weapon) {
    if (isInventoryFull()) {
        currentProfile.coins += weapon.sellPrice;
        saveProfile();
        return { type: 'coins', amount: weapon.sellPrice };
    }
    currentProfile.inventory.push(weapon.id);
    saveProfile();
    return { type: 'weapon', weapon };
}

/** Надеть оружие на героя (или снять, если weaponId === null). */
export function equipWeapon(heroId, weaponId) {
    if (weaponId && !currentProfile.inventory.includes(weaponId)) return false;
    currentProfile.equippedWeapons[heroId] = weaponId || null;
    saveProfile();
    return true;
}

/** Продать одну единицу оружия из инвентаря за монеты. Снимает его только с "лишних" героев, если копий стало меньше, чем надето. */
export function sellWeapon(weaponId, price) {
    const idx = currentProfile.inventory.indexOf(weaponId);
    if (idx === -1) return false;
    currentProfile.inventory.splice(idx, 1);
    currentProfile.coins += price;

    const remaining = currentProfile.inventory.filter(id => id === weaponId).length;
    const equippedHeroIds = Object.keys(currentProfile.equippedWeapons).filter(h => currentProfile.equippedWeapons[h] === weaponId);
    if (equippedHeroIds.length > remaining) {
        equippedHeroIds.slice(remaining).forEach(h => { currentProfile.equippedWeapons[h] = null; });
    }
    saveProfile();
    return true;
}

/** Личное оружие Волколака выдаётся автоматически и сразу надето, когда герой впервые появляется у профиля. */
function grantPersonalWeaponIfNeeded(heroId, weaponId) {
    if (!currentProfile.inventory.includes(weaponId)) {
        currentProfile.inventory.push(weaponId);
    }
    if (!currentProfile.equippedWeapons[heroId]) {
        currentProfile.equippedWeapons[heroId] = weaponId;
    }
    saveProfile();
}

/**
 * Пытается активировать промокод для текущего профиля (v1.04: коды теперь
 * сверяются по хэшу, см. js/promocodes.js -> resolvePromoCode).
 * Каждый код одноразовый НА ПРОФИЛЬ - на другом профиле сработает снова.
 */
export async function redeemPromoCode(rawCode, resolvePromoCode) {
    if (!rawCode || !rawCode.trim()) return { ok: false, message: 'Введите код.' };

    const { hash, promo } = await resolvePromoCode(rawCode);
    if (!promo) return { ok: false, message: 'Такой код не найден.' };

    if (currentProfile.redeemedCodes.includes(hash)) {
        return { ok: false, message: 'Этот код уже был использован.' };
    }
    if (promo.exclusiveWith && promo.exclusiveWith.some(h => currentProfile.redeemedCodes.includes(h))) {
        return { ok: false, message: 'Этот код недоступен — у вас уже активирован связанный с ним промокод.' };
    }
    if (promo.type === 'hero_temp' && currentProfile.unlockedHeroes.includes(promo.heroId)) {
        return { ok: false, message: 'У вас уже есть этот герой навсегда — временный код не нужен.' };
    }

    currentProfile.redeemedCodes.push(hash);

    if (promo.type === 'hero_temp') {
        currentProfile.pendingPromoHero = { heroId: promo.heroId, hash };
        if (promo.heroId === 'volkolak') grantPersonalWeaponIfNeeded('volkolak', 'moonfang_volkolak');
        saveProfile();
        return { ok: true, message: `Промокод принят! Герой «${promo.heroName}» доступен на один бой — выберите его в дружину.` };
    }
    if (promo.type === 'hero_permanent') {
        if (!currentProfile.unlockedHeroes.includes(promo.heroId)) {
            currentProfile.unlockedHeroes.push(promo.heroId);
        }
        currentProfile.pendingPromoHero = null; // постоянный доступ важнее временного слота
        if (promo.heroId === 'volkolak') grantPersonalWeaponIfNeeded('volkolak', 'moonfang_volkolak');
        saveProfile();
        return { ok: true, message: `Промокод принят! Герой «${promo.heroName}» теперь у вас навсегда.` };
    }
    if (promo.type === 'coins') {
        currentProfile.coins += promo.amount;
        saveProfile();
        return { ok: true, message: `Промокод принят! Начислено ${promo.amount} монет 💰` };
    }
    return { ok: false, message: 'Неизвестный тип промокода.' };
}

/** Промо-герой одноразовый: снимаем его после того, как бой (любой исход) завершён. */
export function clearPendingPromoHero() {
    if (currentProfile) {
        currentProfile.pendingPromoHero = null;
        saveProfile();
    }
}
