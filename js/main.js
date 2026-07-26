import {
    state, currentProfile, allProfiles, loadProfile, createProfile,
    deleteProfile, buyHero, selectProfile, setDifficulty
} from './state.js';
import { baseCharacters, passivesSystem } from './characters.js';
import { arenas } from './arenas.js';
import { startCombat, executeAction } from './combat.js';
import { renderHeroDetails } from './ui.js';

let screenAuth, screenMenu, screenBattle, screenArena;
let selectedForStart = [];
let selectedProfileIndex = null; // Какой профиль выделен в меню загрузки
let selectedArenaId = 'field';

document.addEventListener('DOMContentLoaded', () => {
    screenAuth = document.getElementById('screen-auth');
    screenMenu = document.getElementById('screen-menu');
    screenBattle = document.getElementById('screen-battle');
    screenArena = document.getElementById('screen-arena');

    initApp();

    document.getElementById('execute-btn').addEventListener('click', () => {
        if (state.selectedSkill && state.selectedTarget) {
            executeAction(state.turnQueue[state.currentTurnIndex], state.selectedTarget, state.selectedSkill);
        }
    });

    document.getElementById('btn-create').onclick = () => {
        const name = document.getElementById('input-name').value || 'Богатырь';
        createProfile(name, selectedForStart);
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

    // "В бой" теперь ведёт на экран выбора арены, а не сразу в бой
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
});

function initApp() {
    screenBattle.style.display = 'none';
    screenMenu.style.display = 'none';
    screenArena.style.display = 'none';
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
            <div class="avatar" style="background-image: url('assets/ilya.png'); opacity: 0.5;"></div>
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

function renderAuthHeroes() {
    const container = document.getElementById('auth-heroes-list');
    const detailsContainer = document.getElementById('auth-hero-details');
    container.innerHTML = '';
    selectedForStart = [];
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

// Отрисовка Магазина и Дружины
export function showMenu() {
    screenAuth.style.display = 'none';
    screenMenu.style.display = 'block';
    screenBattle.style.display = 'none';
    screenArena.style.display = 'none';

    document.getElementById('ui-coins').innerText = currentProfile.coins;
    const stats = currentProfile.stats || { wins: 0, losses: 0, battles: 0 };
    const statsEl = document.getElementById('ui-stats');
    if (statsEl) statsEl.textContent = `Побед: ${stats.wins} · Поражений: ${stats.losses} · Всего боёв: ${stats.battles}`;

    // Синхронизируем радио-кнопки сложности с сохранённым выбором профиля
    const difficulty = currentProfile.difficulty || 'normal';
    document.querySelectorAll('input[name="difficulty"]').forEach(input => {
        input.checked = (input.value === difficulty);
    });

    const myHeroesContainer = document.getElementById('ui-my-heroes');
    const shopContainer = document.getElementById('ui-shop-heroes');
    const detailsContainer = document.getElementById('menu-hero-details');
    myHeroesContainer.innerHTML = '';
    shopContainer.innerHTML = '';
    renderHeroDetails(detailsContainer, null);

    // Запоминаем, кто уже был выбран в дружину до перерисовки экрана
    // (showMenu() вызывается повторно после покупки героя в магазине,
    // и раньше это молча сбрасывало уже готовый выбор игрока)
    const previouslySelectedIds = state.playerTeam.map(c => c.id);
    state.playerTeam = [];

    baseCharacters.forEach(char => {
        const p = passivesSystem[char.passive];
        const card = document.createElement('div');
        card.className = 'card hero-card';

        if (currentProfile.unlockedHeroes.includes(char.id)) {
            card.innerHTML = `
                <div class="avatar" style="background-image: url('${char.img}');"></div>
                <b>${char.name}</b><br>
                <div class="passive-badge" title="${p.desc}">${p.name}</div>
                <small style="display:block; margin-top:8px;">Ваш боец</small>
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
        } else {
            card.classList.add('locked');
            card.innerHTML = `
                <div class="avatar" style="background-image: url('${char.img}');"></div>
                <b>${char.name}</b><br>
                <div class="passive-badge" title="${p.desc}">${p.name}</div>
                <div style="margin-top:8px;">Цена: <b>${char.price} 💰</b></div>
                <button style="margin-top:5px; padding: 5px 10px; font-size: 14px;">Купить</button>
            `;
            card.onclick = () => {
                renderHeroDetails(detailsContainer, char);
            };
            card.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                if (buyHero(char.price, char.id)) {
                    alert('Герой куплен!');
                    showMenu();
                } else {
                    alert('Не хватает монет!');
                }
            };
            shopContainer.appendChild(card);
        }
    });

    document.getElementById('btn-battle').disabled = state.playerTeam.length !== 3;

    document.querySelectorAll('input[name="difficulty"]').forEach(input => {
        input.onchange = () => setDifficulty(input.value);
    });
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
