import { state, currentProfile } from './state.js';
import { passivesSystem, initHeroStats } from './characters.js';
import { getHeroImage } from './skins.js';
import { getWeaponById } from './items.js';
import { findCompanion } from './engine.js';

// Сколько строк лога держим в DOM. Длинный бой на "сложной" сложности легко
// набирает несколько сотен строк, а лог никогда не чистился в пределах боя -
// на слабом телефоне это заметно подтормаживало прокрутку к концу боя.
const LOG_MAX_LINES = 200;

export function log(msg) {
    const logDiv = document.getElementById('combat-log');
    const line = document.createElement('div');
    line.innerHTML = msg;
    logDiv.appendChild(line);
    while (logDiv.childElementCount > LOG_MAX_LINES) logDiv.removeChild(logDiv.firstElementChild);
    logDiv.scrollTop = logDiv.scrollHeight;
}

/** Очищает лог боя. Вызывается при старте боя (см. combat.js -> startCombat). */
export function clearLog() {
    document.getElementById('combat-log').innerHTML = '';
}

export function renderBattlefield(onTargetSelect) {
    const pDiv = document.getElementById('player-team');
    const eDiv = document.getElementById('enemy-team');

    // Убираем элементы бойцов, которых больше нет в текущем составе команд -
    // актуально при старте нового боя, т.к. теперь (см. ниже) существующие
    // элементы переиспользуются, а не сносятся на каждый рендер.
    const currentIds = new Set([...state.playerTeam, ...state.enemyTeam].map(c => c.id));
    [pDiv, eDiv].forEach(container => {
        Array.from(container.querySelectorAll('.fighter')).forEach(child => {
            if (!currentIds.has(child.dataset.charId)) child.remove();
        });
    });

    const renderChar = (char, div) => {
        let isDead = char.hp <= 0;
        // Павшего помощника убираем с поля совсем: в отличие от героя он не
        // часть состава, и его "труп" только занимал бы место на мобильном.
        if (isDead && char.isCompanion) {
            const stale = div.querySelector(`.fighter[data-char-id="${char.id}"]`);
            if (stale) stale.remove();
            return;
        }
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
            div.appendChild(el);
        }
        // Обработчик переустанавливаем на КАЖДЫЙ рендер, а не только при
        // создании карточки.
        //
        // Карточки переиспользуются между боями (ищутся по data-char-id, а id
        // героя от боя к бою не меняется), а startCombat каждый раз создаёт
        // НОВЫЕ объекты бойцов через initHeroStats. Замыкание, поставленное
        // один раз, продолжало держать объект из прошлого боя — и проверка
        // `state.playerTeam.includes(char)` в onTargetSelect давала false для
        // собственных же героев. Клик по союзнику молча отбрасывался, цель
        // оставалась на validTargets[0], и любое лечение уходило всегда в
        // одного и того же бойца (жалоба: "Леший лечит только Кощея").
        el.onclick = () => onTargetSelect(char);

        // Статусные классы переключаем точечно - анимационные классы
        // (fx-*, hit-shake), которые мог поставить playXFx, не трогаем.
        el.classList.toggle('dead-hero', isDead);
        el.classList.toggle('active-turn', !isDead && state.turnQueue[state.currentTurnIndex] === char);
        const isSelected = state.selectedTarget === char && !isDead;
        const isAlly = state.playerTeam.includes(char);
        el.classList.toggle('selected-target-ally', isSelected && isAlly);
        el.classList.toggle('selected-target-enemy', isSelected && !isAlly);

        let skullHtml = isDead ? `<div class="skull-overlay">💀</div>` : '';

        // Бейджи активных эффектов. Раньше здесь показывались только бафы, а яд
        // и ожог (skill.dot у Алёши и Горыныча) не отображались нигде вообще -
        // игрок видел, что теряет HP в начале хода, но не понимал причину и не
        // мог посчитать, доживёт ли боец. Теперь DOT показан рядом с бафами,
        // с подписью "сколько ХП за ход и сколько ходов осталось".
        const buffLabels = {
            dmgBuff:  b => `${b.value > 0 ? 'Урон +' : 'Урон '}${Math.round(b.value * 100)}%`,
            defBuff:  b => `Получаемый урон ${Math.round(b.value * 100)}%`,
            evasive:  b => `Уворот +${Math.round(b.value * 100)}%`,
            blind:    b => `Промах +${Math.round(b.value * 100)}%`,
            stun:     () => 'Оглушение'
        };
        const buffIcons = { dmgBuff: '⚔️', defBuff: '🛡️', evasive: '💨', blind: '😵', stun: '💫' };
        const buffsHtml = (char.buffs || []).map(b => {
            const label = buffLabels[b.stat] ? buffLabels[b.stat](b) : b.stat;
            return `<span class="buff-badge" title="${label} — осталось ходов: ${b.turnsLeft}">${buffIcons[b.stat] || '✨'}</span>`;
        }).join('');

        // Невидимость/уворот видно по самому бойцу, а не только по значку:
        // шапка-невидимка Емели и неуловимость Колобка теперь делают портрет
        // полупрозрачным и обесцвеченным, чтобы состояние читалось с одного
        // взгляда, как и просили.
        el.classList.toggle('is-invisible', !isDead && (char.buffs || []).some(b => b.stat === 'evasive'));
        el.classList.toggle('is-stunned', !isDead && (char.buffs || []).some(b => b.stat === 'stun'));
        el.classList.toggle('companion-fighter', !!char.isCompanion);

        const dotIcons = { poison: '☠️', burn: '🔥' };
        const dotsHtml = (char.statusEffects || []).map(e =>
            `<span class="buff-badge dot-badge" title="${e.type === 'burn' ? 'Ожог' : 'Яд'}: −${e.amountPerTurn} ХП за ход, осталось ходов: ${e.turnsLeft}">${dotIcons[e.type] || '☠️'}</span>`
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
        const subtitle = char.isCompanion
            ? `${char.icon} помощник · ${char.ownerName}`
            : `${char.passiveName}${char.equippedWeapon ? ` · ${char.equippedWeapon.icon} ${char.equippedWeapon.name}` : ''}`;

        content.innerHTML = `
            ${skullHtml}
            <div class="avatar" style="background-image: url('${getHeroImage(char, currentProfile)}');">${char.isCompanion ? `<span class="companion-mark">${char.icon}</span>` : ''}</div>
            <div class="stats">
                <b class="fighter-name">${char.name}</b>
                <div class="fighter-hp-text">${char.hp}/${char.maxHp}</div>
                <div class="passive-info">${subtitle}</div>
                <div class="buffs-row">${buffsHtml}${dotsHtml}</div>
                <div class="hp-bar-bg"><div class="hp-bar-fill" style="width: ${hpPercent}%; background: ${hpPercent < 30 ? '#e74c3c' : '#2ecc71'}"></div></div>
            </div>`;
    };

    // Помощники больше не рисуются отдельной мини-карточкой: теперь это
    // обычные бойцы в тех же командах, поэтому renderChar справляется с ними
    // сам (см. characters.js -> createCompanion).
    state.playerTeam.forEach(c => renderChar(c, pDiv));
    state.enemyTeam.forEach(c => renderChar(c, eDiv));
}

export function renderSkills(char, onSkillSelect) {
    const container = document.getElementById('skills-container');
    container.innerHTML = '';

    // ВАЖНО: раньше на ходу бота сюда вставлялась одна строка текста вместо
    // сетки из 4 кнопок - высота блока резко менялась туда-сюда при каждой
    // смене игрок/бот, из-за чего лог боя ниже "прыгал". Теперь сетка всегда
    // одной и той же высоты: на ходу бота его умения просто показываются
    // затемнёнными и неактивными.

    char.skills.forEach(skill => {
        let btn = document.createElement('button');
        const turnsUntilUnlock = skill.unlockTurn - char.turnsTaken;
        const isLocked = turnsUntilUnlock > 0;
        const isSpecial = skill.type === 'buff' || skill.type === 'dispel' || skill.type === 'summon';
        btn.className = 'skill-btn' + (skill.isUltimate ? ' ultimate-btn' : '') + (isLocked ? ' skill-locked' : '') + (isSpecial ? ' special-btn' : '') + (char.isBot ? ' skill-btn-bot' : '');
        if (state.selectedSkill === skill) btn.classList.add('selected-skill');

        let cdLeft = char.currentCooldowns[skill.name];

        let displayName = skill.name;
        let displayLine;
        let uselessHeal = false;
        if (skill.type === 'summon') {
            const team = state.playerTeam.includes(char) ? state.playerTeam : state.enemyTeam;
            const companion = findCompanion(team, char);
            if (companion) {
                displayName = `Лечить: ${companion.name}`;
                // Лечить целого помощника бессмысленно — это просто потерянный
                // ход (лечение идёт без отката, поэтому соблазн нажать велик).
                uselessHeal = companion.hp >= companion.maxHp;
                displayLine = uselessHeal
                    ? `<small>Помощник цел (${companion.hp}/${companion.maxHp})</small>`
                    : `<small>+${skill.companion.heal} ХП помощнику (${companion.hp}/${companion.maxHp}) · без отката</small>`;
            } else {
                displayLine = `<small>${skill.desc}</small>`;
            }
        } else if (isSpecial) {
            displayLine = `<small>${skill.desc}</small>`;
        } else if (skill.type === 'drain') {
            const val = Math.round(skill.dmg * char.dmgMult);
            displayLine = `<small>Урон ~${val}, столько же ХП себе</small>`;
        } else {
            let displayVal = Math.round(Math.abs(skill.dmg) * (skill.type === 'heal' ? char.healMult : char.dmgMult));
            displayLine = `<small>(${skill.dmg > 0 ? 'Урон' : 'Хил'}: ~${displayVal})</small>`;
        }

        let innerHtml = `<div><span>${skill.icon}</span> <b>${displayName}</b>${skill.isUltimate ? ' <span class="ult-tag">ULT</span>' : ''}${skill.aoe ? ' <span class="ult-tag">ВСЕ</span>' : ''}</div> ${displayLine}`;

        if (char.isBot) {
            btn.disabled = true;
        } else if (uselessHeal) {
            btn.disabled = true;
        } else if (isLocked) {
            innerHtml += `<br><small style="color: #95a5a6;">Откроется через ${turnsUntilUnlock} ход(а)</small>`;
            btn.disabled = true;
        } else if (cdLeft > 0) {
            innerHtml += `<br><small style="color: #f1c40f;">⏳ Откат: ${cdLeft} ход.</small>`;
            btn.disabled = true;
        }

        btn.innerHTML = innerHtml;
        if (!char.isBot && !isLocked && cdLeft === 0) btn.onclick = () => onSkillSelect(skill, btn);
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

    const equippedWeaponId = currentProfile && currentProfile.equippedWeapons ? currentProfile.equippedWeapons[char.id] : null;
    const weapon = equippedWeaponId ? getWeaponById(equippedWeaponId) : null;
    const weaponEffectLabel = { dmg: 'урон', def: 'получаемый урон', heal: 'лечение' };
    let weaponBonusPart = '';
    if (weapon && weapon.bonusFor === char.id && weapon.bonusEffect) {
        const sameStat = weapon.bonusEffect.stat === weapon.baseEffect.stat;
        weaponBonusPart = sameStat
            ? ` <span class="weapon-bonus-tag">✨ родное: +${Math.round(weapon.bonusEffect.value * 100)}%, итого ${Math.round((weapon.baseEffect.value + weapon.bonusEffect.value) * 100)}%</span>`
            : ` <span class="weapon-bonus-tag">✨ родное: ещё ${weapon.bonusEffect.value > 0 ? '+' : ''}${Math.round(weapon.bonusEffect.value * 100)}% ${weaponEffectLabel[weapon.bonusEffect.stat]}</span>`;
    }
    const weaponLine = weapon
        ? `<div class="detail-weapon">${weapon.icon} <b>${weapon.name}</b> — ${weapon.baseEffect.value > 0 ? '+' : ''}${Math.round(weapon.baseEffect.value * 100)}% ${weaponEffectLabel[weapon.baseEffect.stat]}${weaponBonusPart}</div>`
        : `<div class="detail-weapon detail-weapon-empty">Оружие не надето</div>`;

    let ultimateLine = '';
    if (ultimate) {
        if (ultimate.type === 'attack' || ultimate.type === 'heal') {
            ultimateLine = `${ultimate.icon} <b>${ultimate.name}</b> — ~${Math.abs(ultimate.dmg)} ${ultimate.type === 'heal' ? 'лечения' : 'урона'} (откат ${ultimate.cooldown} х.)`;
        } else {
            ultimateLine = `${ultimate.icon} <b>${ultimate.name}</b> — ${ultimate.desc || ''} (откат ${ultimate.cooldown} х.)`;
        }
    }

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
                ${weaponLine}
                <div class="detail-passive" title="${p.desc}">${p.name} — ${p.desc}</div>
                ${ultimateLine ? `<div class="detail-ultimate">${ultimateLine}</div>` : ''}
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Полная сводка характеристик героя для экрана инвентаря: показывает всё, что
// вообще есть у бойца, и рядом — что из этого меняет надетое оружие.
//
// Цифры НЕ пересчитываются здесь вручную: оба варианта героя (без оружия и с
// ним) прогоняются через тот же initHeroStats, что и перед настоящим боем.
// Так значения в инвентаре гарантированно совпадают с боевыми, а не расходятся
// при следующей правке формул.
// ---------------------------------------------------------------------------
export function renderInventoryHeroStats(container, char, weaponId) {
    if (!char) { container.innerHTML = ''; return; }

    const bare = initHeroStats(char, false, null);
    const armed = initHeroStats(char, false, weaponId || null);
    const weapon = weaponId ? getWeaponById(weaponId) : null;
    const p = passivesSystem[char.passive];
    const raceLabel = { human: 'Человек', undead: 'Нежить', spirit: 'Дух', beast: 'Тварь' }[char.race] || char.race;

    const pct = v => `${Math.round(v * 100)}%`;
    const signedPct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

    // Строка сравнения: если оружие ничего не меняет — показываем одно значение.
    const row = (label, bareVal, armedVal, betterWhenLower = false) => {
        const changed = bareVal !== armedVal;
        if (!changed) return `<tr><td>${label}</td><td colspan="2" class="stat-same">${bareVal}</td></tr>`;
        const bareNum = parseFloat(String(bareVal));
        const armedNum = parseFloat(String(armedVal));
        const improved = betterWhenLower ? armedNum < bareNum : armedNum > bareNum;
        return `<tr>
            <td>${label}</td>
            <td class="stat-bare">${bareVal}</td>
            <td class="stat-armed ${improved ? 'stat-up' : 'stat-down'}">${armedVal} ${improved ? '▲' : '▼'}</td>
        </tr>`;
    };

    const skillRows = armed.skills.map((s, i) => {
        const bareSkill = bare.skills[i];
        const isDamage = s.type === 'attack';
        const isHeal = s.type === 'heal';
        if (!isDamage && !isHeal) {
            return `<tr><td>${s.icon} ${s.name}</td><td colspan="2" class="stat-same">${s.desc || '—'}</td></tr>`;
        }
        const calc = (hero, skill) => Math.round(Math.abs(skill.dmg) * (isHeal ? hero.healMult : hero.dmgMult));
        const label = `${s.icon} ${s.name}${s.isUltimate ? ' <span class="ult-tag">ULT</span>' : ''}${s.aoe ? ' <span class="ult-tag">ВСЕ</span>' : ''}`;
        return row(`${label}<br><small>${isHeal ? 'лечение' : 'урон'}, откат ${s.cooldown} х., открыв. с ${s.unlockTurn} хода</small>`,
            calc(bare, bareSkill), calc(armed, s), false);
    }).join('');

    const effectLabel = { dmg: 'урон', def: 'получаемый урон', heal: 'лечение' };
    let weaponBlock;
    if (!weapon) {
        weaponBlock = `<div class="stats-weapon-line stats-weapon-empty">Оружие не надето — в таблице ниже базовые характеристики героя.</div>`;
    } else {
        const isNative = weapon.bonusFor === char.id;
        let parts = `Базовый эффект: <b>${signedPct(weapon.baseEffect.value)} ${effectLabel[weapon.baseEffect.stat]}</b>`;
        if (isNative && weapon.bonusEffect) {
            parts += `<br>✨ <b>Родное оружие для ${char.name}</b> — дополнительно ${signedPct(weapon.bonusEffect.value)} ${effectLabel[weapon.bonusEffect.stat]}`;
        } else if (weapon.bonusFor) {
            parts += `<br><span class="stats-weapon-foreign">Родное оружие другого героя — здесь работает только базовый эффект.</span>`;
        }
        weaponBlock = `<div class="stats-weapon-line">${weapon.icon} <b>${weapon.name}</b><br>${parts}</div>`;
    }

    container.innerHTML = `
        <h3 class="stats-title">Характеристики: ${char.name}</h3>
        ${weaponBlock}
        <table class="hero-stats-table">
            <thead><tr><th>Характеристика</th><th>Без оружия</th><th>С оружием</th></tr></thead>
            <tbody>
                ${row('❤️ Здоровье', bare.maxHp, armed.maxHp)}
                ${row('⚡ Скорость', bare.speed, armed.speed)}
                ${row('🎲 Инициатива', bare.initiativeScore, armed.initiativeScore)}
                ${row('🗡️ Множитель урона', pct(bare.dmgMult), pct(armed.dmgMult))}
                ${row('💚 Множитель лечения', pct(bare.healMult), pct(armed.healMult))}
                ${row('🛡️ Получаемый урон', pct(bare.incDmgMult), pct(armed.incDmgMult), true)}
                <tr><td>🧬 Раса</td><td colspan="2" class="stat-same">${raceLabel}</td></tr>
                <tr><td>✨ Пассивка</td><td colspan="2" class="stat-same">${p.name} — ${p.desc}</td></tr>
                <tr class="stats-section"><td colspan="3">Умения</td></tr>
                ${skillRows}
            </tbody>
        </table>
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
    if (crit) {
        // Трясём именно экран боя, а не <body>. Трансформация на body сделала бы
        // его containing block для position: fixed, и неподвижный фоновый слой
        // арены (см. index.html -> #arena-backdrop) на время тряски прыгал бы
        // вместе с ней и перемасштабировался.
        const screen = document.getElementById('screen-battle');
        if (!screen) return;
        screen.classList.remove('screen-shake');
        void screen.offsetWidth;
        screen.classList.add('screen-shake');
        setTimeout(() => screen.classList.remove('screen-shake'), 400);
    }
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
    spawnFloatingText(el, '🍀 Удача!', 'doublecast');
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

// ---------------------------------------------------------------------------
// Всплывающие подсказки по центру поля боя.
//
// Лог боя внизу экрана легко пропустить — по отзыву игроков, события вроде
// "призвал помощника" или "оглушил" проходили незамеченными, а понимание
// "откуда это вообще взялось" важно для тактики следующего хода. Обычный
// урон/лечение/крит/уворот такой подсказки НЕ получают - для них уже есть
// цифры и тряска прямо на карточке бойца (см. playHitFx и т.п. выше), а
// дублирование их же текстом по центру экрана было бы просто спамом.
// Сюда вынесены только события, у которых нет своего явного визуала:
// призыв/гибель помощника, оглушение, ультимативное умение, снятие бафов.
// ---------------------------------------------------------------------------
const TOAST_LIFETIME_MS = 2600;
const TOAST_MAX_ON_SCREEN = 3;

export function showBattleToast(text, kind = 'info') {
    const layer = document.getElementById('battle-toast-layer');
    if (!layer) return;

    const el = document.createElement('div');
    el.className = `battle-toast battle-toast-${kind}`;
    el.textContent = text;
    layer.appendChild(el);

    // Не даём подсказкам накапливаться, если события идут одна за другой
    // быстрее, чем успевают истаять.
    while (layer.children.length > TOAST_MAX_ON_SCREEN) layer.removeChild(layer.firstElementChild);

    // Появление — через CSS @keyframes (см. style.css -> battle-toast-in-kf),
    // а НЕ через requestAnimationFrame(() => classList.add(...)), как было
    // раньше. rAF физически не вызывается, пока вкладка не в фокусе
    // (document.hidden === true) - страница попросту не рисует кадры. В
    // таком состоянии класс появления никогда не добавлялся, подсказка так
    // и оставалась с opacity:0 весь свой срок жизни и исчезала невидимой.
    // CSS-анимация запускается сама, как только элемент появился в DOM,
    // без ожидания кадра отрисовки.
    setTimeout(() => {
        el.classList.add('battle-toast-hide'); // "растворяется как туман" - см. CSS
        setTimeout(() => el.remove(), 600);
    }, TOAST_LIFETIME_MS);
}

/** Очищает все ещё видимые подсказки — вызывается при старте нового боя. */
export function clearBattleToasts() {
    const layer = document.getElementById('battle-toast-layer');
    if (layer) layer.innerHTML = '';
}

function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
