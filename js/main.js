import { state, currentProfile, allProfiles, loadProfile, createProfile, deleteProfile, buyHero, selectProfile } from './state.js';
import { baseCharacters, passivesSystem } from './characters.js';
import { startCombat, executeAction } from './combat.js';

let screenAuth, screenMenu, screenBattle;
let selectedForStart = [];
let selectedProfileIndex = null; // Какой профиль выделен в меню загрузки

document.addEventListener('DOMContentLoaded', () => {
    screenAuth = document.getElementById('screen-auth');
    screenMenu = document.getElementById('screen-menu');
    screenBattle = document.getElementById('screen-battle');
    
    initApp();

    // Кнопка атаки в бою
    document.getElementById('execute-btn').addEventListener('click', () => {
        if (state.selectedSkill && state.selectedTarget) {
            executeAction(state.turnQueue[state.currentTurnIndex], state.selectedTarget, state.selectedSkill);
        }
    });

    // Создать профиль
    document.getElementById('btn-create').onclick = () => {
        const name = document.getElementById('input-name').value || 'Богатырь';
        createProfile(name, selectedForStart);
        document.getElementById('input-name').value = '';
        showMenu(); // Сразу идем в базу дружины
    };

    // Нажать "+ Создать новый профиль" (переход к экрану создания)
    document.getElementById('btn-new-profile').onclick = () => {
        document.getElementById('auth-create').style.display = 'block';
        document.getElementById('auth-load').style.display = 'none';
        document.getElementById('btn-back-to-profiles').style.display = 'inline-block';
        renderAuthHeroes();
    };

    // Нажать "Назад к выбору" (возврат к списку профилей)
    document.getElementById('btn-back-to-profiles').onclick = () => {
        initApp();
    };

    // Продолжить игру за выделенный профиль
    document.getElementById('btn-continue').onclick = () => {
        if (selectedProfileIndex !== null) {
            selectProfile(selectedProfileIndex);
            showMenu();
        }
    };

    // Выйти в меню профилей из базы
    document.getElementById('btn-logout').onclick = () => {
        screenMenu.style.display = 'none';
        initApp();
    };

    // Удалить выделенный профиль
    document.getElementById('btn-delete-profile').onclick = () => {
        if (selectedProfileIndex !== null && confirm('Вы уверены, что хотите удалить профиль?')) {
            deleteProfile(selectedProfileIndex);
            initApp(); 
        }
    };

    // В БОЙ
    document.getElementById('btn-battle').onclick = () => {
        if (state.playerTeam.length !== 3) {
            alert('Сначала выберите ровно 3 героев из вашей дружины!');
            return;
        }
        screenMenu.style.display = 'none';
        screenBattle.style.display = 'block';
        startCombat();
    };
});

function initApp() {
    screenBattle.style.display = 'none';
    screenMenu.style.display = 'none';
    screenAuth.style.display = 'block';

    if (loadProfile()) {
        // Профили найдены
        document.getElementById('auth-create').style.display = 'none';
        document.getElementById('auth-load').style.display = 'block';
        renderProfilesList();
    } else {
        // Профилей нет - принудительно создаем
        document.getElementById('auth-create').style.display = 'block';
        document.getElementById('auth-load').style.display = 'none';
        document.getElementById('btn-back-to-profiles').style.display = 'none';
        renderAuthHeroes();
    }
}

// Отрисовка списка существующих профилей
function renderProfilesList() {
    const container = document.getElementById('profiles-list');
    container.innerHTML = '';
    selectedProfileIndex = null;
    document.getElementById('btn-continue').disabled = true;
    document.getElementById('btn-delete-profile').disabled = true;

    allProfiles.forEach((prof, index) => {
        const div = document.createElement('div');
        div.className = 'card hero-card';
        div.innerHTML = `
            <div class="avatar" style="background-image: url('assets/ilya.png'); opacity: 0.5;"></div>
            <b>${prof.name}</b><br>
            <small style="color: #f1c40f;">${prof.coins} 💰</small>
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

// Отрисовка стартовых героев
function renderAuthHeroes() {
    const container = document.getElementById('auth-heroes-list');
    container.innerHTML = '';
    selectedForStart = [];
    
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
    
    document.getElementById('ui-coins').innerText = currentProfile.coins;
    
    const myHeroesContainer = document.getElementById('ui-my-heroes');
    const shopContainer = document.getElementById('ui-shop-heroes');
    myHeroesContainer.innerHTML = '';
    shopContainer.innerHTML = '';
    
    state.playerTeam = [];

    baseCharacters.forEach(char => {
        const p = passivesSystem[char.passive]; 
        const card = document.createElement('div');
        card.className = 'card hero-card';
        
        if (currentProfile.unlockedHeroes.includes(char.id)) {
            // Свой герой
            card.innerHTML = `
                <div class="avatar" style="background-image: url('${char.img}');"></div>
                <b>${char.name}</b><br>
                <div class="passive-badge" title="${p.desc}">${p.name}</div>
                <small style="display:block; margin-top:8px;">Ваш боец</small>
            `;
            card.onclick = () => {
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
            // Герой в магазине
            card.classList.add('locked');
            card.innerHTML = `
                <div class="avatar" style="background-image: url('${char.img}');"></div>
                <b>${char.name}</b><br>
                <div class="passive-badge" title="${p.desc}">${p.name}</div>
                <div style="margin-top:8px;">Цена: <b>${char.price} 💰</b></div>
                <button style="margin-top:5px; padding: 5px 10px; font-size: 14px;">Купить</button>
            `;
            card.onclick = () => {
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
}