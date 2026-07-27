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
    playerSkipStreak: 0   // сколько ходов подряд игрок пропустил по таймеру (см. combat.js)
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

export function createProfile(name, selectedHeroes) {
    const newProfile = ensureProfileShape({
        id: generateId(),
        name: name,
        coins: 0,
        unlockedHeroes: selectedHeroes
    });
    allProfiles.push(newProfile);
    currentProfile = newProfile;
    saveAllProfiles();
}

export function saveAllProfiles() {
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

export function winBattle() {
    if (currentProfile) {
        currentProfile.coins += 50;
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

/**
 * Пытается активировать промокод для текущего профиля. Код одноразовый
 * НА ПРОФИЛЬ (хранится в currentProfile.redeemedCodes), а не глобально —
 * то есть на другом профиле тот же код снова сработает.
 */
export function redeemPromoCode(rawCode, promoCodes) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return { ok: false, message: 'Введите код.' };
    if (currentProfile.redeemedCodes.includes(code)) {
        return { ok: false, message: 'Этот код уже был использован.' };
    }
    const promo = promoCodes[code];
    if (!promo) {
        return { ok: false, message: 'Такой код не найден.' };
    }
    currentProfile.redeemedCodes.push(code);
    currentProfile.pendingPromoHero = { heroId: promo.heroId, code };
    saveProfile();
    return { ok: true, message: `Промокод принят! Герой "${promo.heroName}" доступен на один бой — выберите его в дружину.` };
}

/** Промо-герой одноразовый: снимаем его после того, как бой (любой исход) завершён. */
export function clearPendingPromoHero() {
    if (currentProfile) {
        currentProfile.pendingPromoHero = null;
        saveProfile();
    }
}
