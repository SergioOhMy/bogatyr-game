import {
    state, currentProfile, allProfiles, loadProfile, createProfile,
    deleteProfile, buyHero, selectProfile, setDifficulty, redeemPromoCode,
    buySkin, equipSkin
} from './state.js';
import { baseCharacters, passivesSystem } from './characters.js';
import { arenas } from './arenas.js';
import { promoCodes, getSpecialCharacterById } from './promocodes.js';
import { getSkinsForHero, getHeroImage } from './skins.js';
import { startCombat, executeAction } from './combat.js';
import { renderHeroDetails } from './ui.js';

let screenAuth, screenMenu, screenBattle, screenArena, screenShop;
let selectedForStart = [];
let selectedProfileIndex = null; // Какой профиль выделен в меню загрузки
let selectedArenaId = 'field';
let selectedAvatar = baseCharacters[0].img;

document.addEventListener('DOMContentLoaded', () => {
    screenAuth = document.getElementById('screen-auth');
    screenMenu = document.getElementById('screen-menu');
    screenBattle = document.getElementById('screen-battle');
    screenArena = document.getElementById('screen-arena');
    screenShop = document.getElementById('screen-shop');

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
        startCombat(selectedArenaId, currentProfile.difficulty);
    };

    document.getElementById('btn-arena-back').onclick = () => {
        screenArena.style.display = 'none';
        showMenu();
    };

    // Магазин - теперь отдельный экран с двумя вкладками
    document.getElementById('btn-goto-shop').onclick = () => showShop();
    document.getElementById('btn-shop-back').onclick = () => showMenu();
    document.getElementById('tab-shop-heroes').onclick = () => switchShopTab('heroes');
    document.getElementById('tab-shop-skins').onclick = () => switchShopTab('skins');

    // Промокод
    document.getElementById('btn-open-promo').onclick = () => openPromoModal();
    document.getElementById('btn-promo-cancel').onclick = () => closePromoModal();
    document.getElementById('btn-promo-submit').onclick = () => submitPromoCode();
    document.getElementById('promo-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitPromoCode();
    });
});

function initApp() {
    screenBattle.style.display = 'none';
    screenMenu.style.display = 'none';
    screenArena.style.display = 'none';
    screenShop.style.display = 'none';
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
    screenAuth.style.display = 'none';
    screenMenu.style.display = 'block';
    screenBattle.style.display = 'none';
    screenArena.style.display = 'none';
    screenShop.style.display = 'none';

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

    // Промо-герой (см. promocodes.js) - доступен как дополнительный слот на
    // один ближайший бой, если промокод был активирован и ещё не потрачен.
    const promoHero = currentProfile.pendingPromoHero
        ? getSpecialCharacterById(currentProfile.pendingPromoHero.heroId)
        : null;
    const rosterHeroes = promoHero ? [...ownedHeroes, promoHero] : ownedHeroes;

    rosterHeroes.forEach(char => {
        const p = passivesSystem[char.passive];
        const card = document.createElement('div');
        card.className = 'card hero-card' + (char.promoOnly ? ' promo-hero-slot' : '');
        card.innerHTML = `
            <div class="avatar" style="background-image: url('${getHeroImage(char, currentProfile)}');"></div>
            <b>${char.name}</b><br>
            <div class="passive-badge" title="${p.desc}">${p.name}</div>
            ${char.promoOnly ? '<div class="promo-hero-tag">🎁 Промо · 1 бой</div>' : '<small style="display:block; margin-top:8px;">Ваш боец</small>'}
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
    document.getElementById('shop-heroes-panel').style.display = tab === 'heroes' ? 'block' : 'none';
    document.getElementById('shop-skins-panel').style.display = tab === 'skins' ? 'block' : 'none';
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

function submitPromoCode() {
    const value = document.getElementById('promo-input').value;
    const result = redeemPromoCode(value, promoCodes);
    const msgEl = document.getElementById('promo-message');
    msgEl.textContent = result.message;
    msgEl.className = 'promo-message ' + (result.ok ? 'success' : 'error');
    if (result.ok) {
        setTimeout(() => {
            closePromoModal();
            showMenu(); // перерисовать дружину, чтобы показать новый промо-слот
        }, 1200);
    }
}
