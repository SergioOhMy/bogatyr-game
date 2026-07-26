export const state = {
    playerTeam: [],
    enemyTeam: [],
    turnQueue: [],
    currentTurnIndex: 0,
    selectedSkill: null,
    selectedTarget: null,
    timerInterval: null,
    timeLeft: 60
};
export let currentProfile = null;
export let allProfiles = []; // Массив всех созданных профилей

export function loadProfile() {
    const saved = localStorage.getItem('bogatyr_profiles_v2');
    if (saved) {
        allProfiles = JSON.parse(saved);
        return allProfiles.length > 0;
    }
    return false;
}

export function selectProfile(index) {
    currentProfile = allProfiles[index];
}

export function createProfile(name, selectedHeroes) {
    const newProfile = {
        name: name,
        coins: 0,
        unlockedHeroes: selectedHeroes
    };
    allProfiles.push(newProfile);
    currentProfile = newProfile;
    saveAllProfiles();
}

export function saveAllProfiles() {
    localStorage.setItem('bogatyr_profiles_v2', JSON.stringify(allProfiles));
}

// Обновление текущего профиля внутри массива
export function saveProfile() {
    const index = allProfiles.findIndex(p => p.name === currentProfile.name);
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

export function winBattle() {
    if (currentProfile) {
        currentProfile.coins += 50; 
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