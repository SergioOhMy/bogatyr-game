import {
    state, currentProfile, allProfiles, loadProfile, createProfile,
    deleteProfile, buyHero, selectProfile, setDifficulty, redeemPromoCode,
    buySkin, equipSkin, addWeaponToInventory, equipWeapon, sellWeapon,
    INVENTORY_CAPACITY, grantChestReward, isInventoryFull
} from './state.js';
import { baseCharacters, passivesSystem } from './characters.js';
import { arenas } from './arenas.js';
import { specialCharacters, getSpecialCharacterById, resolvePromoCode } from './promocodes.js';
import { getSkinsForHero, getHeroImage } from './skins.js';
import { weaponCatalog, getWeaponById, getRandomWeapon, getDroppableWeapons } from './items.js';
import { startCombat, executeAction, setArenaBackdrop } from './combat.js';
import { renderHeroDetails, renderInventoryHeroStats } from './ui.js';

let screenAuth, screenMenu, screenBattle, screenArena, screenShop, screenInventory;
let selectedForStart = [];
let selectedProfileIndex = null; // Какой профиль выделен в меню загрузки
let selectedArenaId = 'field';
let selectedAvatar = baseCharacters[0].img;
let inventorySelectedHeroId = null;
let inventorySelectedWeaponId = null;

document.addEventListener('DOMContentLoaded', () => {
    screenAuth = document.getElementById('screen-auth');
    screenMenu = document.getElementById('screen-menu');
    screenBattle = document.getElementById('screen-battle');
    screenArena = document.getElementById('screen-arena');
    screenShop = document.getElementById('screen-shop');
    screenInventory = document.getElementById('screen-inventory');

    initApp();

    document.getElementById('execute-btn').addEventListener('click', () => {
        if (state.selectedSkill && state.selectedTarget) {
            executeAction(state.turnQueue[state.currentTurnIndex], state.selectedTarget, state.selectedSkill);
        }
    });

    document.getElementById('btn-create').onclick = () => {
        const name = document.getElementById('input-name').value || 'Богатырь';
        createProfile(name, selectedForStart, selectedAvatar);
        document.getElementById('input-name').value = '';
        showMenu();
    };

    document.getElementById('btn-new-profile').onclick = () => {
        document.getElementById('auth-create').style.display = 'block';
        document.getElementById('auth-load').style.display = 'none';
        document.getElementById('btn-back-to-profiles').style.display = 'inline-block';
        renderAuthHeroes();
    };

    document.getElementById('btn-back-to-profiles').onclick = () => {
        initApp();
    };

    document.getElementById('btn-continue').onclick = () => {
        if (selectedProfileIndex !== null) {
            selectProfile(selectedProfileIndex);
            showMenu();
        }
    };

    document.getElementById('btn-logout').onclick = () => {
        screenMenu.style.display = 'none';
        initApp();
    };

    document.getElementById('btn-delete-profile').onclick = () => {
        if (selectedProfileIndex !== null && confirm('Вы уверены, что хотите удалить профиль?')) {
            deleteProfile(selectedProfileIndex);
            initApp();
        }
    };

    // "В бой" ведёт на экран выбора арены
    document.getElementById('btn-battle').onclick = () => {
        if (state.playerTeam.length !== 3) {
            alert('Сначала выберите ровно 3 героев из вашей дружины!');
            return;
        }
        showArenaScreen();
    };

    document.getElementById('btn-start-battle').onclick = () => {
        screenArena.style.display = 'none';
        screenBattle.style.display = 'block';
        setTitleVisible(false);
        startCombat(selectedArenaId, currentProfile.difficulty);
    };

    document.getElementById('btn-arena-back').onclick = () => {
        screenArena.style.display = 'none';
        showMenu();
    };

    // Магазин - теперь отдельный экран с тремя вкладками
    document.getElementById('btn-goto-shop').onclick = () => showShop();
    document.getElementById('btn-shop-back').onclick = () => showMenu();
    document.getElementById('tab-shop-heroes').onclick = () => switchShopTab('heroes');
    document.getElementById('tab-shop-skins').onclick = () => switchShopTab('skins');
    document.getElementById('tab-shop-chests').onclick = () => switchShopTab('chests');
    document.getElementById('btn-buy-chest').onclick = () => {
        if (currentProfile.coins < CHEST_PRICE) { alert('Не хватает монет!'); return; }
        if (!confirm(`Купить сундук с оружием за ${CHEST_PRICE} монет?`)) return;
        currentProfile.coins -= CHEST_PRICE;
        const weapon = getRandomWeapon();
        const result = grantChestReward(weapon);
        document.getElementById('ui-coins').innerText = currentProfile.coins;
        if (result.type === 'coins') {
            alert(`Инвентарь полон! Вместо оружия начислено ${result.amount} монет 💰`);
        } else {
            alert(`Сундук открыт! Получено оружие: ${weapon.icon} ${weapon.name}`);
        }
    };
    document.getElementById('btn-buy-epic-chest').onclick = () => {
        if (currentProfile.coins < EPIC_CHEST_PRICE) { alert('Не хватает монет!'); return; }
        if (isInventoryFull()) { alert(`Инвентарь полон (${INVENTORY_CAPACITY} ячеек) — сначала освободите место.`); return; }
        if (!confirm(`Купить эпический сундук за ${EPIC_CHEST_PRICE} монет? Оружие выберете сами.`)) return;
        openEpicChest(() => {
            document.getElementById('ui-coins').innerText = currentProfile.coins;
        }, EPIC_CHEST_PRICE);
    };

    // Инвентарь
    document.getElementById('btn-goto-inventory').onclick = () => showInventory();
    document.getElementById('btn-inventory-back').onclick = () => showMenu();
    document.getElementById('btn-weapon-picker-cancel').onclick = () => closeWeaponPicker();
    document.getElementById('weapon-picker-backdrop').onclick = (e) => {
        if (e.target.id === 'weapon-picker-backdrop') closeWeaponPicker();
    };

    // Сундук после боя
    document.getElementById('btn-chest-open').onclick = () => openPostBattleChest();
    document.getElementById('btn-chest-continue').onclick = () => {
        document.getElementById('chest-modal-backdrop').style.display = 'none';
        if (window.__afterChestCallback) { window.__afterChestCallback(); window.__afterChestCallback = null; }
    };

    // Промокод
    document.getElementById('btn-open-promo').onclick = () => openPromoModal();
    document.getElementById('btn-promo-cancel').onclick = () => closePromoModal();
    document.getElementById('btn-promo-submit').onclick = () => submitPromoCode();
    document.getElementById('promo-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitPromoCode();
    });
});

function setTitleVisible(visible) {
    const el = document.getElementById('title-wrap');
    if (el) el.style.display = visible ? 'block' : 'none';
}

function initApp() {
    setTitleVisible(true);
    setArenaBackdrop(null); // гасим фон арены вне боя
    // Сбрасываем состояние боя/дружины при каждом входе на экран профилей -
    // иначе герой, выбранный в предыдущей сессии (другим профилем или до
    // обновления страницы), мог "утекать" в новый профиль как лишний,
    // невидимый в интерфейсе выбора, но появляющийся в бою 4-м бойцом.
    state.playerTeam = [];
    state.enemyTeam = [];
    state.turnQueue = [];
    screenBattle.style.display = 'none';
    screenMenu.style.display = 'none';
    screenArena.style.display = 'none';
    screenShop.style.display = 'none';
    screenInventory.style.display = 'none';
    screenAuth.style.display = 'block';

    if (loadProfile()) {
        document.getElementById('auth-create').style.display = 'none';
        document.getElementById('auth-load').style.display = 'block';
        renderProfilesList();
    } else {
        document.getElementById('auth-create').style.display = 'block';
        document.getElementById('auth-load').style.display = 'none';
        document.getElementById('btn-back-to-profiles').style.display = 'none';
        renderAuthHeroes();
    }
}

function renderProfilesList() {
    const container = document.getElementById('profiles-list');
    container.innerHTML = '';
    selectedProfileIndex = null;
    document.getElementById('btn-continue').disabled = true;
    document.getElementById('btn-delete-profile').disabled = true;

    allProfiles.forEach((prof, index) => {
        const div = document.createElement('div');
        div.className = 'card hero-card';
        const w = prof.stats ? prof.stats.wins : 0;
        const l = prof.stats ? prof.stats.losses : 0;
        div.innerHTML = `
            <div class="avatar" style="background-image: url('${prof.avatar || 'assets/ilya.png'}');"></div>
            <b>${escapeHtml(prof.name)}</b><br>
            <small style="color: #f1c40f;">${prof.coins} 💰</small><br>
            <small style="color: #bdc3c7;">🏆 ${w} / 💀 ${l}</small>
        `;

        div.onclick = () => {
            Array.from(container.children).forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            selectedProfileIndex = index;
            document.getElementById('btn-continue').disabled = false;
            document.getElementById('btn-delete-profile').disabled = false;
        };
        container.appendChild(div);
    });
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function renderAvatarPicker() {
    const container = document.getElementById('avatar-picker');
    container.innerHTML = '';
    baseCharacters.forEach(char => {
        const div = document.createElement('div');
        div.className = 'avatar-option' + (char.img === selectedAvatar ? ' selected' : '');
        div.style.backgroundImage = `url('${char.img}')`;
        div.title = char.name;
        div.onclick = () => {
            selectedAvatar = char.img;
            Array.from(container.children).forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
        };
        container.appendChild(div);
    });
}

function renderAuthHeroes() {
    const container = document.getElementById('auth-heroes-list');
    const detailsContainer = document.getElementById('auth-hero-details');
    container.innerHTML = '';
    selectedForStart = [];
    selectedAvatar = baseCharacters[0].img;
    renderAvatarPicker();
    renderHeroDetails(detailsContainer, null);

    baseCharacters.forEach(char => {
        const p = passivesSystem[char.passive];
        const div = document.createElement('div');
        div.className = 'card hero-card';
        div.innerHTML = `
            <div class="avatar" style="background-image: url('${char.img}');"></div>
            <b>${char.name}</b><br>
            <div class="passive-badge" title="${p.desc}">${p.name}</div>
        `;

        div.onclick = () => {
            renderHeroDetails(detailsContainer, char);
            if (selectedForStart.includes(char.id)) {
                selectedForStart = selectedForStart.filter(id => id !== char.id);
                div.classList.remove('selected');
            } else if (selectedForStart.length < 3) {
                selectedForStart.push(char.id);
                div.classList.add('selected');
            }
            document.getElementById('btn-create').disabled = selectedForStart.length !== 3;
        };
        container.appendChild(div);
    });
}

// Отрисовка дружины (магазин теперь на отдельном экране - см. showShop)
export function showMenu() {
    setTitleVisible(true);
    setArenaBackdrop(null); // гасим фон арены вне боя
    screenAuth.style.display = 'none';
    screenMenu.style.display = 'block';
    screenBattle.style.display = 'none';
    screenArena.style.display = 'none';
    screenShop.style.display = 'none';
    screenInventory.style.display = 'none';

    document.getElementById('ui-coins-inline').innerText = currentProfile.coins;
    const stats = currentProfile.stats || { wins: 0, losses: 0, battles: 0 };
    const statsEl = document.getElementById('ui-stats');
    if (statsEl) statsEl.textContent = `Побед: ${stats.wins} · Поражений: ${stats.losses} · Всего боёв: ${stats.battles}`;

    const difficulty = currentProfile.difficulty || 'normal';
    document.querySelectorAll('input[name="difficulty"]').forEach(input => {
        input.checked = (input.value === difficulty);
        input.onchange = () => setDifficulty(input.value);
    });

    const myHeroesContainer = document.getElementById('ui-my-heroes');
    const detailsContainer = document.getElementById('menu-hero-details');
    myHeroesContainer.innerHTML = '';
    renderHeroDetails(detailsContainer, null);

    // Запоминаем, кто уже был выбран в дружину до перерисовки экрана
    const previouslySelectedIds = state.playerTeam.map(c => c.id);
    state.playerTeam = [];

    const ownedHeroes = baseCharacters.filter(c => currentProfile.unlockedHeroes.includes(c.id));

    // Постоянно открытые спец-герои (например, Волколак через код ВОЛКОЛАК2) -
    // хранятся в unlockedHeroes как обычные герои, но их данные лежат в
    // specialCharacters, а не в baseCharacters, поэтому ищем отдельно.
    const ownedSpecialHeroes = specialCharacters.filter(c => currentProfile.unlockedHeroes.includes(c.id));

    // Промо-герой на ОДИН бой (см. promocodes.js) - показываем только если
    // он ещё не открыт навсегда (иначе он уже есть в ownedSpecialHeroes).
    const tempPromoHero = (currentProfile.pendingPromoHero && !currentProfile.unlockedHeroes.includes(currentProfile.pendingPromoHero.heroId))
        ? getSpecialCharacterById(currentProfile.pendingPromoHero.heroId)
        : null;

    const rosterHeroes = [...ownedHeroes, ...ownedSpecialHeroes, ...(tempPromoHero ? [tempPromoHero] : [])];

    rosterHeroes.forEach(char => {
        const p = passivesSystem[char.passive];
        const card = document.createElement('div');
        const isTempPromo = char === tempPromoHero;
        card.className = 'card hero-card' + (isTempPromo ? ' promo-hero-slot' : '');
        card.innerHTML = `
            <div class="avatar" style="background-image: url('${getHeroImage(char, currentProfile)}');"></div>
            <b>${char.name}</b><br>
            <div class="passive-badge" title="${p.desc}">${p.name}</div>
            ${isTempPromo ? '<div class="promo-hero-tag">🎁 Промо · 1 бой</div>' : '<small style="display:block; margin-top:8px;">Ваш боец</small>'}
        `;
        if (previouslySelectedIds.includes(char.id) && state.playerTeam.length < 3) {
            state.playerTeam.push(char);
            card.classList.add('selected');
        }
        card.onclick = () => {
            renderHeroDetails(detailsContainer, char);
            if (state.playerTeam.some(c => c.id === char.id)) {
                state.playerTeam = state.playerTeam.filter(c => c.id !== char.id);
                card.classList.remove('selected');
            } else if (state.playerTeam.length < 3) {
                state.playerTeam.push(char);
                card.classList.add('selected');
            }
            document.getElementById('btn-battle').disabled = state.playerTeam.length !== 3;
        };
        myHeroesContainer.appendChild(card);
    });

    document.getElementById('btn-battle').disabled = state.playerTeam.length !== 3;
}

// Отдельный экран магазина: покупка героев и покупка/экипировка образов
// (скинов) на двух вкладках. Покупка везде идёт через подтверждение.
function showShop() {
    screenMenu.style.display = 'none';
    screenShop.style.display = 'block';

    document.getElementById('ui-coins').innerText = currentProfile.coins;
    switchShopTab('heroes');
    renderShopHeroes();
    renderShopSkins();
}

function switchShopTab(tab) {
    document.getElementById('tab-shop-heroes').classList.toggle('active', tab === 'heroes');
    document.getElementById('tab-shop-skins').classList.toggle('active', tab === 'skins');
    document.getElementById('tab-shop-chests').classList.toggle('active', tab === 'chests');
    document.getElementById('shop-heroes-panel').style.display = tab === 'heroes' ? 'block' : 'none';
    document.getElementById('shop-skins-panel').style.display = tab === 'skins' ? 'block' : 'none';
    document.getElementById('shop-chests-panel').style.display = tab === 'chests' ? 'block' : 'none';
    renderHeroDetails(document.getElementById('shop-hero-details'), null);
}

function renderShopHeroes() {
    const shopContainer = document.getElementById('ui-shop-heroes');
    const detailsContainer = document.getElementById('shop-hero-details');
    shopContainer.innerHTML = '';

    baseCharacters.filter(char => !currentProfile.unlockedHeroes.includes(char.id)).forEach(char => {
        const p = passivesSystem[char.passive];
        const card = document.createElement('div');
        card.className = 'card hero-card locked';
        card.innerHTML = `
            <div class="avatar" style="background-image: url('${char.img}');"></div>
            <b>${char.name}</b><br>
            <div class="passive-badge" title="${p.desc}">${p.name}</div>
            <div style="margin-top:8px;">Цена: <b>${char.price} 💰</b></div>
            <button style="margin-top:5px; padding: 5px 10px; font-size: 14px;">Купить</button>
        `;
        card.onclick = () => {
            Array.from(shopContainer.children).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            renderHeroDetails(detailsContainer, char);
        };
        card.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            if (currentProfile.coins < char.price) {
                alert('Не хватает монет!');
                return;
            }
            if (confirm(`Купить героя "${char.name}" за ${char.price} монет?`)) {
                if (buyHero(char.price, char.id)) {
                    alert('Герой куплен!');
                    document.getElementById('ui-coins').innerText = currentProfile.coins;
                    renderShopHeroes();
                    renderShopSkins();
                }
            }
        };
        shopContainer.appendChild(card);
    });
}

function renderShopSkins() {
    const container = document.getElementById('ui-shop-skins');
    const detailsContainer = document.getElementById('shop-hero-details');
    container.innerHTML = '';

    const ownedHeroes = baseCharacters.filter(c => currentProfile.unlockedHeroes.includes(c.id));

    ownedHeroes.forEach(char => {
        getSkinsForHero(char.id).forEach(skin => {
            const owned = currentProfile.unlockedSkins.includes(skin.id);
            const equipped = currentProfile.equippedSkins[char.id] === skin.id;

            const card = document.createElement('div');
            card.className = 'card hero-card';
            card.innerHTML = `
                <div class="avatar" style="background-image: url('${skin.img}');"></div>
                <b>${skin.name}</b><br>
                <small style="color:#bdc3c7;">${char.name}</small>
                ${owned
                    ? `<div class="${equipped ? 'skin-equipped-tag' : 'skin-owned-tag'}">${equipped ? '✓ Надето' : 'Куплено'}</div>`
                    : `<div style="margin-top:8px;">Цена: <b>${skin.price} 💰</b></div>`}
                <button style="margin-top:8px; padding: 5px 10px; font-size: 13px;">
                    ${owned ? (equipped ? 'Снять' : 'Надеть') : 'Купить'}
                </button>
            `;
            card.onclick = () => renderHeroDetails(detailsContainer, char);
            card.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                if (!owned) {
                    if (currentProfile.coins < skin.price) {
                        alert('Не хватает монет!');
                        return;
                    }
                    if (confirm(`Купить образ "${skin.name}" за ${skin.price} монет?`)) {
                        if (buySkin(skin.id, skin.price)) {
                            document.getElementById('ui-coins').innerText = currentProfile.coins;
                            renderShopSkins();
                        }
                    }
                } else if (equipped) {
                    equipSkin(char.id, null);
                    renderShopSkins();
                } else {
                    equipSkin(char.id, skin.id);
                    renderShopSkins();
                }
            };
            container.appendChild(card);
        });
    });

    if (container.children.length === 0) {
        container.innerHTML = '<p style="color:#95a5a6;">Пока нет доступных образов — сначала откройте героев на вкладке «Герои».</p>';
    }
}

function showArenaScreen() {
    screenMenu.style.display = 'none';
    screenArena.style.display = 'block';
    const container = document.getElementById('arena-list');
    container.innerHTML = '';

    arenas.forEach(arena => {
        const card = document.createElement('div');
        card.className = 'card hero-card arena-card';
        if (arena.id === selectedArenaId) card.classList.add('selected');
        card.innerHTML = `
            <div class="arena-icon">${arena.icon}</div>
            <b>${arena.name}</b>
            <p class="arena-desc">${arena.desc}</p>
        `;
        card.onclick = () => {
            selectedArenaId = arena.id;
            Array.from(container.children).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        };
        container.appendChild(card);
    });
}

// --------------------------- Инвентарь (v1.04) ---------------------------
function getOwnedRoster() {
    const ownedHeroes = baseCharacters.filter(c => currentProfile.unlockedHeroes.includes(c.id));
    const ownedSpecialHeroes = specialCharacters.filter(c => currentProfile.unlockedHeroes.includes(c.id));
    return [...ownedHeroes, ...ownedSpecialHeroes];
}

function showInventory() {
    screenMenu.style.display = 'none';
    screenInventory.style.display = 'block';

    const roster = getOwnedRoster();
    if (!inventorySelectedHeroId || !roster.some(h => h.id === inventorySelectedHeroId)) {
        inventorySelectedHeroId = roster.length ? roster[0].id : null;
    }

    const pickerContainer = document.getElementById('inventory-hero-picker');
    pickerContainer.innerHTML = '';
    roster.forEach(char => {
        const div = document.createElement('div');
        div.className = 'inventory-hero-thumb' + (char.id === inventorySelectedHeroId ? ' selected' : '');
        div.style.backgroundImage = `url('${getHeroImage(char, currentProfile)}')`;
        div.title = char.name;
        div.onclick = () => { inventorySelectedHeroId = char.id; inventorySelectedWeaponId = null; showInventory(); };
        pickerContainer.appendChild(div);
    });

    renderInventoryActiveHero(roster);
    renderWeaponGrid();
    renderWeaponDetails(roster);
    renderInventoryHeroStats(
        document.getElementById('inventory-hero-stats'),
        roster.find(h => h.id === inventorySelectedHeroId) || null,
        currentProfile.equippedWeapons[inventorySelectedHeroId] || null
    );
}

function renderInventoryActiveHero(roster) {
    const container = document.getElementById('inventory-active-hero');
    const hero = roster.find(h => h.id === inventorySelectedHeroId);
    if (!hero) {
        container.innerHTML = '<p style="color:#95a5a6;">Сначала откройте хотя бы одного героя.</p>';
        return;
    }
    const equippedId = currentProfile.equippedWeapons[hero.id];
    const weapon = equippedId ? getWeaponById(equippedId) : null;
    container.innerHTML = `
        <div class="inventory-active-row">
            <div class="inventory-weapon-slot ${weapon ? 'filled' : ''}" id="inventory-weapon-slot"
                 title="${weapon ? `${weapon.name} — нажмите, чтобы сменить или снять` : 'Нажмите, чтобы выбрать оружие'}">
                ${weapon ? weapon.icon : '+'}
            </div>
            <div class="inventory-hero-portrait" style="background-image:url('${getHeroImage(hero, currentProfile)}')"></div>
        </div>
        <b class="inventory-hero-name">${hero.name}</b>
        <small class="inventory-slot-hint">${weapon ? 'Нажмите на оружие, чтобы сменить или снять' : 'Нажмите на «+», чтобы надеть оружие'}</small>
    `;
    // Слот кликабелен ВСЕГДА. Раньше обработчик срабатывал только при уже
    // надетом оружии, поэтому "+" на пустом слоте выглядел как кнопка, но
    // не делал ничего — именно на это и жаловались.
    document.getElementById('inventory-weapon-slot').onclick = () => openWeaponPicker(hero);
}

// --------------------- Выбор оружия в слот героя ---------------------
/** Свободные копии оружия, свёрнутые в пары id -> количество (для окна выбора). */
function getFreeWeaponCounts() {
    const counts = {};
    getFreeWeaponInstances().forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    return counts;
}

function openWeaponPicker(hero) {
    const backdrop = document.getElementById('weapon-picker-backdrop');
    const grid = document.getElementById('weapon-picker-grid');
    const emptyHint = document.getElementById('weapon-picker-empty');
    const unequipBtn = document.getElementById('btn-weapon-picker-unequip');

    document.getElementById('weapon-picker-title').textContent = `Оружие для: ${hero.name}`;
    grid.innerHTML = '';

    const equippedId = currentProfile.equippedWeapons[hero.id] || null;
    const freeCounts = getFreeWeaponCounts();
    const freeIds = Object.keys(freeCounts).filter(id => freeCounts[id] > 0);

    freeIds.forEach(id => {
        const weapon = getWeaponById(id);
        if (!weapon) return;
        const isNative = weapon.bonusFor === hero.id;
        const card = document.createElement('div');
        card.className = 'weapon-picker-item' + (isNative ? ' native' : '');
        card.innerHTML = `
            <div class="weapon-picker-icon">${weapon.icon}</div>
            <b>${weapon.name}</b>
            ${freeCounts[id] > 1 ? `<small>свободно: ${freeCounts[id]}</small>` : ''}
            ${isNative ? '<div class="weapon-picker-native">✨ родное</div>' : ''}
        `;
        card.onclick = () => {
            equipWeapon(hero.id, id);
            closeWeaponPicker();
            inventorySelectedWeaponId = id;
            showInventory();
        };
        grid.appendChild(card);
    });

    emptyHint.style.display = freeIds.length ? 'none' : 'block';
    unequipBtn.style.display = equippedId ? 'inline-block' : 'none';
    unequipBtn.onclick = () => {
        equipWeapon(hero.id, null);
        closeWeaponPicker();
        showInventory();
    };

    backdrop.style.display = 'flex';
}

function closeWeaponPicker() {
    document.getElementById('weapon-picker-backdrop').style.display = 'none';
}

/**
 * Список СВОБОДНЫХ (не надетых ни на кого) копий оружия — по одному элементу
 * на каждую копию. Одинаковые копии больше не схлопываются в одну ячейку со
 * значком "xN": каждая занимает свою ячейку, как и просили.
 */
function getFreeWeaponInstances() {
    const stillEquipped = {};
    Object.values(currentProfile.equippedWeapons).forEach(id => {
        if (id) stillEquipped[id] = (stillEquipped[id] || 0) + 1;
    });
    const free = [];
    currentProfile.inventory.forEach(id => {
        if (stillEquipped[id] > 0) { stillEquipped[id]--; return; } // эта копия надета на героя
        free.push(id);
    });
    return free;
}

function renderWeaponGrid() {
    const container = document.getElementById('weapon-grid');
    container.innerHTML = '';

    const free = getFreeWeaponInstances();

    for (let i = 0; i < INVENTORY_CAPACITY; i++) {
        const weaponId = free[i];
        const div = document.createElement('div');

        if (!weaponId) {
            div.className = 'weapon-slot-item empty';
            container.appendChild(div);
            continue;
        }

        const weapon = getWeaponById(weaponId);
        if (!weapon) { div.className = 'weapon-slot-item empty'; container.appendChild(div); continue; }
        div.className = 'weapon-slot-item' + (inventorySelectedWeaponId === weaponId ? ' selected' : '');
        div.innerHTML = weapon.icon;
        div.title = weapon.name;
        div.onclick = () => { inventorySelectedWeaponId = weaponId; showInventory(); };
        container.appendChild(div);
    }

    const counter = document.getElementById('inventory-counter');
    if (counter) counter.textContent = `Занято ячеек: ${currentProfile.inventory.length} из ${INVENTORY_CAPACITY}`;
}

function renderWeaponDetails(roster) {
    const container = document.getElementById('weapon-details');
    const hero = roster.find(h => h.id === inventorySelectedHeroId);
    if (!inventorySelectedWeaponId || !hero) { container.style.display = 'none'; return; }
    const weapon = getWeaponById(inventorySelectedWeaponId);
    if (!weapon) { container.style.display = 'none'; return; }

    const isEquippedOnActive = currentProfile.equippedWeapons[hero.id] === weapon.id;
    const effectLabel = { dmg: 'урон', def: 'получаемый урон (меньше = лучше)', heal: 'лечение' };
    let bonusText = '';
    if (weapon.bonusFor === hero.id && weapon.bonusEffect) {
        const sameStat = weapon.bonusEffect.stat === weapon.baseEffect.stat;
        const bonusPct = `${weapon.bonusEffect.value > 0 ? '+' : ''}${Math.round(weapon.bonusEffect.value * 100)}% ${effectLabel[weapon.bonusEffect.stat]}`;
        bonusText = sameStat
            ? `<br>✨ Родное оружие для ${hero.name} — дополнительно ${bonusPct} (итого ${Math.round((weapon.baseEffect.value + weapon.bonusEffect.value) * 100)}% ${effectLabel[weapon.baseEffect.stat]})!`
            : `<br>✨ Родное оружие для ${hero.name} — дополнительный эффект: ${bonusPct}!`;
    } else if (weapon.bonusFor) {
        bonusText = `<br><span style="color:#95a5a6;">Родное оружие другого героя — у ${hero.name} действует только базовый эффект.</span>`;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div style="font-size:40px;">${weapon.icon}</div>
        <b>${weapon.name}</b>
        <div class="weapon-effects">
            Базовый эффект: ${weapon.baseEffect.value > 0 ? '+' : ''}${Math.round(weapon.baseEffect.value * 100)}% ${effectLabel[weapon.baseEffect.stat]}
            ${bonusText}
        </div>
        <div class="weapon-details-actions">
            ${isEquippedOnActive ? `<button id="btn-weapon-unequip">Снять</button>` : `<button id="btn-weapon-equip">Надеть на ${hero.name}</button>`}
            <button id="btn-weapon-sell" class="danger-btn">Продать за ${weapon.sellPrice} 💰</button>
        </div>
    `;

    if (isEquippedOnActive) {
        document.getElementById('btn-weapon-unequip').onclick = () => { equipWeapon(hero.id, null); showInventory(); };
    } else {
        document.getElementById('btn-weapon-equip').onclick = () => { equipWeapon(hero.id, weapon.id); showInventory(); };
    }
    document.getElementById('btn-weapon-sell').onclick = () => {
        if (confirm(`Продать «${weapon.name}» за ${weapon.sellPrice} монет?`)) {
            sellWeapon(weapon.id, weapon.sellPrice);
            inventorySelectedWeaponId = null;
            showInventory();
        }
    };
}

// --------------------------- Сундуки ---------------------------
export const CHEST_PRICE = 100;
export const EPIC_CHEST_PRICE = 1000;
/** Шанс, что сундук за победу окажется эпическим (с выбором оружия вручную). */
const EPIC_CHEST_CHANCE = 0.05;

function openPostBattleChest() {
    // 5% на эпический сундук: вместо случайного оружия игрок выбирает сам.
    if (Math.random() < EPIC_CHEST_CHANCE) {
        document.getElementById('chest-modal-backdrop').style.display = 'none';
        openEpicChest(() => {
            if (window.__afterChestCallback) { window.__afterChestCallback(); window.__afterChestCallback = null; }
        });
        return;
    }

    const weapon = getRandomWeapon();
    const result = grantChestReward(weapon);
    document.getElementById('chest-stage-closed').style.display = 'none';
    document.getElementById('chest-stage-result').style.display = 'block';
    if (result.type === 'coins') {
        document.getElementById('chest-result-icon').textContent = '💰';
        document.getElementById('chest-result-name').textContent = `Инвентарь полон — начислено ${result.amount} монет`;
    } else {
        document.getElementById('chest-result-icon').textContent = weapon.icon;
        document.getElementById('chest-result-name').textContent = weapon.name;
    }
}

/**
 * Эпический сундук: игрок сам выбирает любое выпадающее оружие.
 *
 * costCoins списывается ТОЛЬКО в момент реального выбора оружия — если закрыть
 * окно кнопкой «Отмена», деньги остаются у игрока. Иначе купленный, но не
 * открытый сундук просто съедал бы 1000 монет.
 * onDone вызывается после закрытия окна (и после выбора, и после отмены).
 */
function openEpicChest(onDone, costCoins = 0) {
    const backdrop = document.getElementById('epic-chest-backdrop');
    const grid = document.getElementById('epic-chest-grid');
    grid.innerHTML = '';

    const close = () => { backdrop.style.display = 'none'; if (onDone) onDone(); };

    if (isInventoryFull()) {
        grid.innerHTML = `<p class="skins-hint">Инвентарь полон (${INVENTORY_CAPACITY} ячеек). Продайте что-нибудь и загляните снова.</p>`;
    } else {
        getDroppableWeapons().forEach(weapon => {
            const card = document.createElement('div');
            card.className = 'weapon-picker-item';
            card.innerHTML = `
                <div class="weapon-picker-icon">${weapon.icon}</div>
                <b>${weapon.name}</b>
            `;
            card.onclick = () => {
                if (costCoins > 0) currentProfile.coins -= costCoins;
                addWeaponToInventory(weapon.id); // внутри вызывает saveProfile()
                alert(`Получено: ${weapon.icon} ${weapon.name}`);
                close();
            };
            grid.appendChild(card);
        });
    }

    document.getElementById('btn-epic-chest-cancel').onclick = close;
    backdrop.style.display = 'flex';
}

/** Вызывается из combat.js ТОЛЬКО при победе. onDone - что делать после закрытия (обычно showMenu). */
export function showPostBattleChest(onDone) {
    document.getElementById('chest-stage-closed').style.display = 'block';
    document.getElementById('chest-stage-result').style.display = 'none';
    document.getElementById('chest-modal-backdrop').style.display = 'flex';
    window.__afterChestCallback = onDone;
}

// --------------------------- Промокод ---------------------------
function openPromoModal() {
    document.getElementById('promo-input').value = '';
    document.getElementById('promo-message').textContent = '';
    document.getElementById('promo-message').className = 'promo-message';
    document.getElementById('promo-modal-backdrop').style.display = 'flex';
    document.getElementById('promo-input').focus();
}

function closePromoModal() {
    document.getElementById('promo-modal-backdrop').style.display = 'none';
}

async function submitPromoCode() {
    const value = document.getElementById('promo-input').value;
    const btn = document.getElementById('btn-promo-submit');
    btn.disabled = true;
    const result = await redeemPromoCode(value, resolvePromoCode);
    btn.disabled = false;
    const msgEl = document.getElementById('promo-message');
    msgEl.textContent = result.message;
    msgEl.className = 'promo-message ' + (result.ok ? 'success' : 'error');
    if (result.ok) {
        setTimeout(() => {
            closePromoModal();
            showMenu(); // перерисовать дружину, чтобы показать нового/постоянного героя
        }, 1200);
    }
}
