import { state, currentProfile } from './state.js';
import { passivesSystem } from './characters.js';
import { getHeroImage } from './skins.js';

export function log(msg) {
    const logDiv = document.getElementById('combat-log');
    logDiv.innerHTML += `<div>${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

export function renderBattlefield(onTargetSelect) {
    const pDiv = document.getElementById('player-team');
    const eDiv = document.getElementById('enemy-team');

    // Убираем элементы бойцов, которых больше нет в текущем составе команд -
    // актуально при старте нового боя, т.к. теперь (см. ниже) существующие
    // элементы переиспользуются, а не сносятся на каждый рендер.
    const currentIds = new Set([...state.playerTeam, ...state.enemyTeam].map(c => c.id));
    [pDiv, eDiv].forEach(container => {
        Array.from(container.children).forEach(child => {
            if (!currentIds.has(child.dataset.charId)) child.remove();
        });
    });

    const renderChar = (char, div) => {
        let isDead = char.hp <= 0;
        let hpPercent = Math.max(0, (char.hp / char.maxHp) * 100);

        // ВАЖНО: ищем уже существующий элемент и обновляем его на месте,
        // а не пересоздаём. Раньше здесь всегда шло div.innerHTML='' +
        // полная пересборка на каждый renderBattlefield() - а он вызывается
        // сразу же после playHitFx/playDodgeFx/playCritFx и т.п. Элемент,
        // на который анимация только что повесила CSS-класс, немедленно
        // удалялся и создавался заново БЕЗ этого класса - анимация физически
        // не успевала отрисоваться ни разу. Это и было причиной "анимаций не
        // видно" при том, что сам код анимаций был рабочим.
        let el = div.querySelector(`.fighter[data-char-id="${char.id}"]`);
        if (!el) {
            el = document.createElement('div');
            el.classList.add('fighter');
            el.dataset.charId = char.id;
            el.onclick = () => onTargetSelect(char);
            div.appendChild(el);
        }

        // Статусные классы переключаем точечно - анимационные классы
        // (fx-*, hit-shake), которые мог поставить playXFx, не трогаем.
        el.classList.toggle('dead-hero', isDead);
        el.classList.toggle('active-turn', !isDead && state.turnQueue[state.currentTurnIndex] === char);
        const isSelected = state.selectedTarget === char && !isDead;
        const isAlly = state.playerTeam.includes(char);
        el.classList.toggle('selected-target-ally', isSelected && isAlly);
        el.classList.toggle('selected-target-enemy', isSelected && !isAlly);

        let skullHtml = isDead ? `<div class="skull-overlay">💀</div>` : '';
        const buffIcons = { dmgBuff: '⚔️', defBuff: '🛡️', evasive: '💨', blind: '😵', stun: '💫', companion: '👥' };
        const buffsHtml = (char.buffs || []).map(b =>
            `<span class="buff-badge" title="${b.stat}: ${b.turnsLeft} х.">${(b.meta && b.meta.icon) || buffIcons[b.stat] || '✨'}</span>`
        ).join('');

        // Заменяем содержимое ТОЛЬКО через вложенный .fighter-content, а не
        // innerHTML самого .fighter - иначе так же стирались бы всплывающие
        // цифры урона/частицы (см. spawnFloatingText/spawnParticleBurst),
        // которые добавляются как соседние дети прямо в el.
        let content = el.querySelector('.fighter-content');
        if (!content) {
            content = document.createElement('div');
            content.className = 'fighter-content';
            el.appendChild(content);
        }
        content.innerHTML = `
            ${skullHtml}
            <div class="avatar" style="background-image: url('${getHeroImage(char, currentProfile)}');"></div>
            <div class="stats">
                <b>${char.name}</b> <small>(${char.hp}/${char.maxHp})</small>
                <div class="passive-info">${char.passiveName}</div>
                ${buffsHtml ? `<div class="buffs-row">${buffsHtml}</div>` : ''}
                <div class="hp-bar-bg"><div class="hp-bar-fill" style="width: ${hpPercent}%; background: ${hpPercent < 30 ? '#e74c3c' : '#2ecc71'}"></div></div>
            </div>`;
    };

    state.playerTeam.forEach(c => renderChar(c, pDiv));
    state.enemyTeam.forEach(c => renderChar(c, eDiv));
}

export function renderSkills(char, onSkillSelect) {
    const container = document.getElementById('skills-container');
    container.innerHTML = '';

    if (char.isBot) {
        container.innerHTML = '<p style="color:#bdc3c7;">Противник принимает решение...</p>';
        return;
    }

    char.skills.forEach(skill => {
        let btn = document.createElement('button');
        const turnsUntilUnlock = skill.unlockTurn - char.turnsTaken;
        const isLocked = turnsUntilUnlock > 0;
        const isSpecial = skill.type === 'buff' || skill.type === 'dispel' || skill.type === 'summon';
        btn.className = 'skill-btn' + (skill.isUltimate ? ' ultimate-btn' : '') + (isLocked ? ' skill-locked' : '') + (isSpecial ? ' special-btn' : '');
        if (state.selectedSkill === skill) btn.classList.add('selected-skill');

        let cdLeft = char.currentCooldowns[skill.name];

        let displayName = skill.name;
        let displayLine;
        if (skill.type === 'summon') {
            const companionActive = char.buffs && char.buffs.some(b => b.stat === 'companion');
            if (companionActive) {
                displayName = `Лечить: ${skill.companion.label}`;
                displayLine = `<small>Восстановить себе ~${skill.companion.procHeal} ХП</small>`;
            } else {
                displayLine = `<small>${skill.desc}</small>`;
            }
        } else if (isSpecial) {
            displayLine = `<small>${skill.desc}</small>`;
        } else {
            let displayVal = Math.round(Math.abs(skill.dmg) * (skill.type === 'heal' ? char.healMult : char.dmgMult));
            displayLine = `<small>(${skill.dmg > 0 ? 'Урон' : 'Хил'}: ~${displayVal})</small>`;
        }

        let innerHtml = `<div><span>${skill.icon}</span> <b>${displayName}</b>${skill.isUltimate ? ' <span class="ult-tag">ULT</span>' : ''}${skill.aoe ? ' <span class="ult-tag">ВСЕ</span>' : ''}</div> ${displayLine}`;

        if (isLocked) {
            innerHtml += `<br><small style="color: #95a5a6;">Откроется через ${turnsUntilUnlock} ход(а)</small>`;
            btn.disabled = true;
        } else if (cdLeft > 0) {
            innerHtml += `<br><small style="color: #f1c40f;">⏳ Откат: ${cdLeft} ход.</small>`;
            btn.disabled = true;
        }

        btn.innerHTML = innerHtml;
        if (!isLocked && cdLeft === 0) btn.onclick = () => onSkillSelect(skill, btn);
        container.appendChild(btn);
    });
}

export function checkActionState() {
    const btn = document.getElementById('execute-btn');
    if (state.selectedSkill && state.selectedTarget) {
        btn.disabled = false;
        const skill = state.selectedSkill;
        if (state.selectedTarget.aoe) {
            if (skill.type === 'heal') { btn.innerText = 'Исцелить всю дружину!'; btn.style.background = '#27ae60'; }
            else if (skill.type === 'attack') { btn.innerText = 'Ударить по всем врагам!'; btn.style.background = '#c0392b'; }
            else { btn.innerText = `Применить: ${skill.name}!`; btn.style.background = '#8e44ad'; }
        } else if (state.selectedTarget.self) {
            btn.innerText = `Применить: ${skill.name}!`;
            btn.style.background = '#8e44ad';
        } else if (skill.type === 'heal') {
            btn.innerText = `Лечить: ${state.selectedTarget.name}!`;
            btn.style.background = '#27ae60';
        } else if (skill.type === 'buff' || skill.type === 'dispel') {
            btn.innerText = `${skill.name}: ${state.selectedTarget.name}`;
            btn.style.background = '#8e44ad';
        } else {
            btn.innerText = `Ударить: ${state.selectedTarget.name}!`;
            btn.style.background = '#c0392b';
        }
    } else {
        btn.disabled = true;
        btn.innerText = 'Сначала выберите навык...';
        btn.style.background = '#7f8c8d';
    }
}

// ---------------------------------------------------------------------------
// Панель характеристик героя — используется на экране создания профиля,
// в магазине и в базе дружины. Показывает силу/HP/скорость/шанс пассивки,
// чтобы игрок понимал, кого выгодно покупать и брать в бой.
// ---------------------------------------------------------------------------
export function renderHeroDetails(container, char) {
    if (!char) {
        container.innerHTML = '<p class="details-placeholder">Нажмите на героя, чтобы увидеть его характеристики</p>';
        return;
    }
    const p = passivesSystem[char.passive];
    const avgAttackDmg = Math.round(
        char.skills.filter(s => s.type === 'attack' && !s.isUltimate).reduce((sum, s) => sum + s.dmg, 0) /
        Math.max(1, char.skills.filter(s => s.type === 'attack' && !s.isUltimate).length) * p.dmgMult
    );
    const ultimate = char.skills.find(s => s.isUltimate);
    const raceLabel = { human: 'Человек', undead: 'Нежить', spirit: 'Дух', beast: 'Тварь' }[char.race] || char.race;

    container.innerHTML = `
        <div class="hero-details-card">
            <div class="details-avatar" style="background-image: url('${getHeroImage(char, currentProfile)}');"></div>
            <div class="details-info">
                <div class="details-name">${char.name} <span class="details-race">${raceLabel}</span></div>
                <div class="details-grid">
                    <div class="detail-stat">❤️ HP: <b>${Math.round(char.hp * p.hpMult)}</b></div>
                    <div class="detail-stat">⚡ Скорость: <b>${char.speed}</b></div>
                    <div class="detail-stat">🗡️ Средний урон: <b>~${avgAttackDmg}</b></div>
                    <div class="detail-stat">💰 Цена: <b>${char.price}</b></div>
                </div>
                <div class="detail-passive" title="${p.desc}">${p.name} — ${p.desc}</div>
                ${ultimate ? `<div class="detail-ultimate">${ultimate.icon} <b>${ultimate.name}</b> — ~${Math.abs(ultimate.dmg)} ${ultimate.type === 'heal' ? 'лечения' : 'урона'} (откат ${ultimate.cooldown} х.)</div>` : ''}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Анимации боя. Все функции работают с уже отрисованным DOM-элементом бойца
// (ищем через data-char-id), проигрывают CSS-класс и сами убирают его по
// окончании анимации, чтобы её можно было запускать повторно.
// ---------------------------------------------------------------------------

function findFighterEl(char) {
    return document.querySelector(`.fighter[data-char-id="${char.id}"]`);
}

function playCssFx(el, classNames, duration = 500) {
    if (!el) return;
    const classes = classNames.split(' ').filter(Boolean);
    el.classList.remove(...classes);
    // форсируем reflow, чтобы анимация перезапустилась даже если класс уже был
    void el.offsetWidth;
    el.classList.add(...classes);
    setTimeout(() => el.classList.remove(...classes), duration);
}

function spawnFloatingText(el, text, kind) {
    if (!el) return;
    const span = document.createElement('div');
    span.className = `floating-text floating-${kind}`;
    span.textContent = text;
    el.appendChild(span);
    setTimeout(() => span.remove(), 1100);
}

function spawnParticleBurst(el, emoji, color) {
    if (!el) return;
    const burst = document.createElement('div');
    burst.className = 'vfx-burst';
    burst.style.setProperty('--vfx-color', color || '#f1c40f');
    burst.textContent = emoji || '✨';
    el.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
}

export function playHitFx(target, { crit = false, amount = 0 } = {}) {
    const el = findFighterEl(target);
    playCssFx(el, crit ? 'fx-crit' : 'hit-shake', crit ? 650 : 400);
    spawnFloatingText(el, `-${amount}`, crit ? 'crit' : 'dmg');
}

export function playMissFx(target) {
    const el = findFighterEl(target);
    spawnFloatingText(el, 'МИМО!', 'miss');
}

export function playDodgeFx(target) {
    const el = findFighterEl(target);
    playCssFx(el, 'fx-dodge', 450);
    spawnFloatingText(el, 'Уворот!', 'dodge');
}

export function playBlockFx(target) {
    const el = findFighterEl(target);
    playCssFx(el, 'fx-block', 450);
    spawnFloatingText(el, 'Блок!', 'block');
}

export function playHealFx(target, amount, { crit = false } = {}) {
    const el = findFighterEl(target);
    playCssFx(el, crit ? 'fx-critheal' : 'fx-heal', 500);
    spawnFloatingText(el, `+${amount}`, crit ? 'critheal' : 'heal');
}

export function playRegenFx(target, amount) {
    const el = findFighterEl(target);
    playCssFx(el, 'fx-regen', 600);
    spawnFloatingText(el, `+${amount}`, 'regen');
}

export function playDoubleCastFx(attacker) {
    const el = findFighterEl(attacker);
    playCssFx(el, 'fx-doublecast', 500);
}

export function playDeathFx(target) {
    const el = findFighterEl(target);
    playCssFx(el, 'fx-death', 600);
}

/**
 * Уникальный визуальный "росчерк" ультимативного умения конкретного героя:
 * атакующий вспыхивает своим фирменным цветом, а над целью (или над собой,
 * если умение лечащее) взрывается частица его vfx. Тряску/цифры урона или
 * лечения по-прежнему рисуют playHitFx/playHealFx — эта функция добавляет
 * только фирменный "почерк" конкретного героя поверх них.
 */
export function playUltimateFx(attacker, target) {
    const attackerEl = findFighterEl(attacker);
    const targetEl = findFighterEl(target) || attackerEl;
    const vfx = attacker.vfx || { color: '#f1c40f', particle: '✨' };
    if (attackerEl) attackerEl.style.setProperty('--ult-glow', hexToRgba(vfx.color, 0.9));
    playCssFx(attackerEl, 'fx-ultimate-cast', 700);
    spawnParticleBurst(targetEl, vfx.particle, vfx.color);
}

/** Общая анимация для бафов/дебафов/dispel/призыва: положительный - синее свечение, отрицательный - фиолетовое. */
export function playBuffFx(target, { positive = true } = {}) {
    const el = findFighterEl(target);
    playCssFx(el, positive ? 'fx-buff-positive' : 'fx-buff-negative', 550);
}

function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
