import { state, winBattle, recordLoss, clearPendingPromoHero, currentProfile, DIFFICULTY_REWARDS } from './state.js';
import { showMenu, showPostBattleChest } from './main.js';
import { initHeroStats, baseCharacters, createCompanion } from './characters.js';
import {
    log, clearLog, renderBattlefield, renderSkills, checkActionState,
    playHitFx, playMissFx, playDodgeFx, playBlockFx,
    playHealFx, playRegenFx, playDoubleCastFx, playDeathFx, playUltimateFx, playBuffFx
} from './ui.js';
import {
    buildTurnQueue, tickCooldowns, resolveAction, applyArenaTurnStart,
    applyStatusEffects, applySkillDot, computeAttackDamage,
    tickBuffs, hasBuff, addBuff, dispelBuffs, shuffle,
    findCompanion, livingHeroes, insertIntoQueue
} from './engine.js';
import { getArenaById } from './arenas.js';
import { chooseBotAction } from './bot.js';
import { getRandomWeapon } from './items.js';

/** Сколько секунд даётся игроку на ход (боты ходят сами через 1.5 сек). */
const TURN_SECONDS = 60;

/**
 * Включает картинку арены на фоновом слое (arenaId) или гасит её (null),
 * когда игрок уходит с экрана боя.
 */
export function setArenaBackdrop(arenaId) {
    const backdrop = document.getElementById('arena-backdrop');
    if (backdrop) backdrop.className = arenaId ? `arena-backdrop arena-bg-${arenaId}` : 'arena-backdrop';
}

export function startCombat(arenaId, difficulty) {
    state.currentArena = getArenaById(arenaId);
    state.difficulty = difficulty || 'normal';
    state.playerSkipStreak = 0;
    state.battleOver = false;

    const remaining = baseCharacters.filter(c => !state.playerTeam.some(p => p.id === c.id));
    const shuffledBots = shuffle(remaining).slice(0, 3);

    state.enemyTeam = shuffledBots.map(c => initHeroStats(c, true, Math.random() < 0.8 ? getRandomWeapon().id : null));
    state.playerTeam = state.playerTeam.map(c => initHeroStats(c, false, (currentProfile.equippedWeapons || {})[c.id] || null));

    // Единая очередь ходов по инициативе среди всех 6 бойцов сразу
    state.turnQueue = buildTurnQueue(state.playerTeam, state.enemyTeam);
    state.currentTurnIndex = 0;

    // "Внезапный натиск" (v1.02): у кого инициатива ниже - тот входит в бой
    // вторым и оказывается в невыгодном положении, поэтому первый же боец
    // более медленной команды получает разовый бонус +15% к первому действию.
    const firstMoverIsPlayer = state.playerTeam.includes(state.turnQueue[0]);
    const underdogTeam = firstMoverIsPlayer ? state.enemyTeam : state.playerTeam;
    const underdogFirstActor = state.turnQueue.find(c => underdogTeam.includes(c));
    if (underdogFirstActor) underdogFirstActor.underdogBuff = true;

    const battleScreen = document.getElementById('screen-battle');
    battleScreen.dataset.arenaIcon = state.currentArena.icon;
    // Картинку арены включает отдельный фоновый слой (см. index.html / style.css),
    // сам экран боя её больше не несёт — иначе фон ездил при смене высоты.
    setArenaBackdrop(state.currentArena.id);

    const arenaLabel = document.getElementById('arena-label');
    if (arenaLabel) arenaLabel.textContent = `${state.currentArena.icon} ${state.currentArena.name}`;

    renderBattlefield(onTargetSelect);
    // Лог накапливался от боя к бою: новая партия дописывалась под старой,
    // и через несколько боёв подряд игрок открывал бой уже с чужой историей.
    clearLog();
    log(`<b>${state.currentArena.icon} Арена: ${state.currentArena.name}.</b> ${state.currentArena.desc}`);
    if (underdogFirstActor) {
        log(`🌀 <b>${underdogFirstActor.name}</b> входит в бой вторым и получает "Внезапный натиск": +15% к следующему действию.`);
    }
    startTurn();
}

/**
 * Лечение "только себе" (healTarget: 'self'). Такие умения не требуют выбора
 * цели: отдых на печи Емели, тесто по сусекам Колобка, волчья регенерация
 * Волколака — по смыслу их нельзя направить на союзника.
 */
function isSelfHeal(skill) {
    return skill.type === 'heal' && skill.healTarget === 'self';
}

export function onTargetSelect(char) {
    let activeChar = state.turnQueue[state.currentTurnIndex];
    if (activeChar.isBot || char.hp <= 0) return;

    const skill = state.selectedSkill;
    if (!skill) {
        // Пока навык не выбран - просто позволяем "посмотреть" на бойца
        state.selectedTarget = char;
        renderBattlefield(onTargetSelect);
        checkActionState();
        return;
    }

    // Эти виды умений не требуют клика по цели вообще (см. onSkillSelect)
    if (skill.aoe || skill.type === 'summon' || (skill.type === 'buff' && skill.buffTarget === 'self') || isSelfHeal(skill)) return;

    const wantsAlly = skill.type === 'heal' ||
        (skill.type === 'buff' && skill.buffTarget === 'ally') ||
        (skill.type === 'dispel' && skill.dispelTarget === 'ally');
    const clickedIsAlly = state.playerTeam.includes(char);
    if (wantsAlly !== clickedIsAlly) return; // клик не по той команде для этого умения

    state.selectedTarget = char;
    renderBattlefield(onTargetSelect);
    checkActionState();
}

export function onSkillSelect(skill) {
    state.selectedSkill = skill;

    if (skill.type === 'summon' || (skill.type === 'buff' && skill.buffTarget === 'self') || isSelfHeal(skill)) {
        // Себя касается умение - целиться не нужно
        state.selectedTarget = { self: true };
        renderBattlefield(onTargetSelect);
        renderSkills(state.turnQueue[state.currentTurnIndex], onSkillSelect);
        checkActionState();
        return;
    }

    if (skill.aoe) {
        // Массовое умение - цель выбирать не нужно, бьёт/лечит/бафает всех разом
        state.selectedTarget = { aoe: true };
        renderBattlefield(onTargetSelect);
        renderSkills(state.turnQueue[state.currentTurnIndex], onSkillSelect);
        checkActionState();
        return;
    }

    const wantsAlly = skill.type === 'heal' ||
        (skill.type === 'buff' && skill.buffTarget === 'ally') ||
        (skill.type === 'dispel' && skill.dispelTarget === 'ally');
    const validTargets = wantsAlly ? state.playerTeam.filter(p => p.hp > 0) : state.enemyTeam.filter(e => e.hp > 0);

    const currentTargetInvalid = !state.selectedTarget || state.selectedTarget.aoe || state.selectedTarget.self ||
        state.selectedTarget.hp <= 0 || !validTargets.includes(state.selectedTarget);
    if (currentTargetInvalid) {
        state.selectedTarget = validTargets[0];
    }
    renderBattlefield(onTargetSelect);
    renderSkills(state.turnQueue[state.currentTurnIndex], onSkillSelect);
    checkActionState();
}

export function startTurn() {
    if (state.battleOver) return; // бой уже закончен - новых ходов не начинаем
    clearInterval(state.timerInterval);
    state.selectedSkill = null;
    state.selectedTarget = null;

    let activeChar = state.turnQueue[state.currentTurnIndex];

    if (activeChar.hp <= 0) {
        nextTurn();
        return;
    }

    activeChar.turnsTaken++;
    tickCooldowns(activeChar);

    // Оглушение (stun): пропускаем ход целиком.
    // ВАЖНО: проверяем ДО tickBuffs. Раньше сначала шёл тик, и оглушение с
    // turns: 1 успевало истечь и быть удалённым ровно к тому моменту, когда
    // его собирались проверить — механика не срабатывала вообще ни разу.
    // Теперь тикаем уже внутри ветки, чтобы оглушение съело ровно один ход.
    if (hasBuff(activeChar, 'stun')) {
        tickBuffs(activeChar);
        log(`💫 <b>${activeChar.name}</b> оглушён и пропускает ход!`);
        renderBattlefield(onTargetSelect);
        nextTurn();
        return;
    }
    tickBuffs(activeChar);

    // Эффект начала хода: сперва арена (лечение нежити в болоте и т.п.),
    // затем яд/ожог от навыков (см. characters.js -> skill.dot)
    const arenaEffect = applyArenaTurnStart(activeChar, state.currentArena);
    if (arenaEffect) {
        if (arenaEffect.type === 'heal') {
            activeChar.hp = Math.min(activeChar.maxHp, activeChar.hp + arenaEffect.amount);
            log(`${state.currentArena.icon} <b>${activeChar.name}</b> черпает силы у арены и восстанавливает ${arenaEffect.amount} ХП.`);
        } else if (arenaEffect.type === 'burn') {
            activeChar.hp = Math.max(0, activeChar.hp - arenaEffect.amount);
            log(`${state.currentArena.icon} <b>${activeChar.name}</b> страдает от арены и теряет ${arenaEffect.amount} ХП.`);
        }
    }

    const statusResults = applyStatusEffects(activeChar);
    statusResults.forEach(eff => {
        const label = eff.type === 'burn' ? '🔥 горит от ожога' : '☠️ страдает от яда';
        log(`<b>${activeChar.name}</b> ${label} и теряет ${eff.amount} ХП.`);
    });

    if (activeChar.hp <= 0) {
        activeChar.hp = 0;
        log(`<span class="death-log">💀 ${activeChar.name} погибает от последствий боя!</span>`);
        renderBattlefield(onTargetSelect);
        setTimeout(checkWinCondition, 400);
        return;
    }

    document.getElementById('turn-indicator').innerText = `Ходит: ${activeChar.name}`;

    const actionBtn = document.getElementById('execute-btn');
    checkActionState();
    // ВАЖНО: кнопку больше не прячем через display:none - раньше это
    // заставляло весь низ экрана (лог боя и т.д.) прыгать вверх-вниз при
    // каждой смене хода игрок/бот. Вместо скрытия - просто блокируем её
    // (и делаем это ПОСЛЕ checkActionState, иначе он перезатрёт текст).
    if (activeChar.isBot) {
        actionBtn.disabled = true;
        // Помощник игрока тоже ходит сам (isBot: true), но называть его ход
        // "ходом противника" неправильно — скелет-то свой.
        const isOwnCompanion = activeChar.isCompanion && state.playerTeam.includes(activeChar);
        actionBtn.innerText = isOwnCompanion
            ? `Ходит ваш помощник: ${activeChar.name}...`
            : `Ход противника: ${activeChar.name}...`;
        actionBtn.style.background = '#7f8c8d';
    }

    renderBattlefield(onTargetSelect);
    renderSkills(activeChar, onSkillSelect);

    state.timeLeft = TURN_SECONDS;
    document.getElementById('timer-display').innerText = state.timeLeft;

    // Таймер тикает ТОЛЬКО на ходу живого игрока. Раньше он запускался и на
    // ходу бота: бот обычно успевал за 1.5 сек, но если бы его ход по любой
    // причине затянулся (исключение в логике, зависшая анимация), через 60
    // секунд срабатывал handleTurnTimeout и поражение за "пропуск хода"
    // засчитывалось игроку — за ход, которого он не делал.
    if (activeChar.isBot) {
        setTimeout(botLogic, 1500);
        return;
    }

    state.timerInterval = setInterval(() => {
        state.timeLeft--;
        document.getElementById('timer-display').innerText = state.timeLeft;
        if (state.timeLeft <= 0) {
            clearInterval(state.timerInterval);
            handleTurnTimeout(activeChar);
        }
    }, 1000);
}

// Пропуск хода по таймеру (только у игрока - боты действуют раньше 60 сек):
// 1-й подряд пропуск - штраф -25% урона/лечения на следующее действие;
// 2-й подряд пропуск - немедленное поражение.
function handleTurnTimeout(activeChar) {
    state.playerSkipStreak++;
    if (state.playerSkipStreak >= 2) {
        log(`⏳💀 <b>${activeChar.name}</b> второй раз подряд не успевает сходить — дружина теряет боевой дух и сдаётся!`);
        state.battleOver = true;
        setTimeout(() => {
            recordLoss();
            alert('Поражение! Два пропущенных хода подряд — бой проигран автоматически.');
            showMenu(); // сундук выдаётся только за победу
        }, 600);
        return;
    }
    activeChar.timeoutDebuff = true;
    log(`⏳ <b>${activeChar.name}</b> задумался и пропустил ход! Следующее действие ослаблено на 25%.`);
    nextTurn();
}

export function executeAction(attacker, target, skill, isDoubleCast = false) {
    // У самолечения цели нет — из интерфейса сюда приходит заглушка {self:true},
    // поэтому подставляем самого применяющего до всех остальных веток.
    if (isSelfHeal(skill)) target = attacker;

    if (skill.type === 'buff' || skill.type === 'dispel') {
        executeBuffOrDispelAction(attacker, skill, target);
        return;
    }
    if (skill.type === 'summon') {
        executeSummonAction(attacker, skill);
        return;
    }
    if (skill.type === 'drain') {
        executeDrainAction(attacker, skill, target);
        return;
    }
    if (skill.aoe) {
        executeAoeAction(attacker, skill);
        return;
    }

    if (!isDoubleCast) {
        clearInterval(state.timerInterval);
        document.getElementById('execute-btn').disabled = true;
        attacker.currentCooldowns[skill.name] = skill.cooldown;
        if (!attacker.isBot) state.playerSkipStreak = 0;
    }

    const { restore } = applyTemporaryBoosts(attacker);

    const result = resolveAction({ attacker, target, skill, arena: state.currentArena });
    restore();

    if (result.missed) {
        log(`🌫️ <b>${attacker.name}</b> промахивается мимо <b>${target.name}</b> из-за тумана!`);
        playMissFx(target);
    } else if (result.dodged) {
        log(`💨 <b>${target.name}</b> ловко уворачивается от атаки <b>${attacker.name}</b>!`);
        playDodgeFx(target);
    } else if (result.blocked) {
        log(`🛡️ <b>${target.name}</b> ставит непробиваемый блок! Атака <b>${attacker.name}</b> поглощена.`);
        playBlockFx(target);
    } else if (skill.type === 'attack') {
        target.hp = Math.max(0, target.hp - result.amount);

        if (result.crit) {
            log(`💥 КРИТИЧЕСКИЙ УДАР! <b>${attacker.name}</b> применяет <i>${skill.icon} ${skill.name}</i> и сносит <b>${target.name}</b> ${result.amount} ХП!`);
        } else {
            log(`⚔️ <b>${attacker.name}</b> применяет <i>${skill.icon} ${skill.name}</i> на <b>${target.name}</b> и наносит ${result.amount} урона!`);
        }
        playHitFx(target, { crit: result.crit, amount: result.amount });
        if (skill.isUltimate) playUltimateFx(attacker, target);

        if (result.regen && target.hp > 0) {
            target.hp = Math.min(target.maxHp, target.hp + result.regen);
            log(`❤️ Живучесть спасает! <b>${target.name}</b> регенерирует ${result.regen} ХП в ответ на удар!`);
            playRegenFx(target, result.regen);
        }

        if (skill.dot && target.hp > 0) {
            applySkillDot(skill, target);
            log(`${skill.dot.type === 'burn' ? '🔥' : '☠️'} <b>${target.name}</b> ${skill.dot.type === 'burn' ? 'подожжён' : 'отравлен'} на ${skill.dot.turns} х.`);
        }

        if (target.hp <= 0) {
            target.hp = 0;
            log(`<span class="death-log">💀 ${target.name} погибает!</span>`);
            playDeathFx(target);
        }
    } else {
        target.hp = Math.min(target.maxHp, target.hp + result.amount);
        if (result.critHeal) {
            log(`🌟 ЧУДО! <b>${attacker.name}</b> критически исцеляет <b>${target.name}</b> на ${result.amount} ХП!`);
        } else {
            log(`💚 <b>${attacker.name}</b> применяет <i>${skill.icon} ${skill.name}</i> на <b>${target.name}</b> и восстанавливает ${result.amount} ХП!`);
        }
        playHealFx(target, result.amount, { crit: result.critHeal });
        if (skill.isUltimate) playUltimateFx(attacker, target);
    }

    if (!isDoubleCast && result.doubleCast && attacker.hp > 0 && target.hp > 0) {
        log(`🍀 НЕВЕРОЯТНАЯ УДАЧА! <b>${attacker.name}</b> атакует второй раз подряд!`);
        playDoubleCastFx(attacker);
        setTimeout(() => {
            executeAction(attacker, target, skill, true);
        }, 1000);
        return;
    }

    renderBattlefield(onTargetSelect);
    setTimeout(checkWinCondition, 800);
}

// Баф/дебаф/dispel (v1.03). Одна функция обрабатывает и одиночную цель,
// и массовые варианты (skill.aoe) - какая команда получает эффект, зависит
// от buffTarget/dispelTarget и от того, на чьей стороне сам применяющий.
function executeBuffOrDispelAction(attacker, skill, target) {
    clearInterval(state.timerInterval);
    document.getElementById('execute-btn').disabled = true;
    attacker.currentCooldowns[skill.name] = skill.cooldown;
    if (!attacker.isBot) state.playerSkipStreak = 0;

    const { restore } = applyTemporaryBoosts(attacker);
    const isPlayerSide = state.playerTeam.includes(attacker);

    const resolveTeam = (who) => {
        if (who === 'self') return [attacker];
        const isAllyTeam = who === 'ally';
        const team = isAllyTeam ? (isPlayerSide ? state.playerTeam : state.enemyTeam)
                                : (isPlayerSide ? state.enemyTeam : state.playerTeam);
        return team.filter(c => c.hp > 0);
    };

    let targets;
    if (skill.type === 'buff') {
        const pool = resolveTeam(skill.buffTarget);
        targets = skill.aoe ? pool : (target && target.hp > 0 ? [target] : pool.slice(0, 1));
    } else {
        const pool = resolveTeam(skill.dispelTarget);
        targets = skill.aoe ? pool : (target && target.hp > 0 ? [target] : pool.slice(0, 1));
    }

    log(`${skill.icon} <b>${attacker.name}</b> применяет <i>${skill.name}</i>!`);
    // Ульта Святогора - единственная ульта типа "баф", и её фирменная анимация
    // раньше не проигрывалась вообще: playUltimateFx вызывался только в ветках
    // атаки/лечения и в aoe.
    if (skill.isUltimate) playUltimateFx(attacker, targets[0] || attacker);

    if (skill.type === 'buff') {
        targets.forEach(t => {
            skill.effects.forEach(effect => addBuff(t, effect));
            playBuffFx(t, { positive: skill.buffTarget !== 'enemy' });
        });
    } else {
        targets.forEach(t => {
            const removed = dispelBuffs(t);
            if (removed > 0) log(`✨ С <b>${t.name}</b> снято эффектов: ${removed}.`);
            playBuffFx(t, { positive: true });
        });
    }

    restore();
    renderBattlefield(onTargetSelect);
    setTimeout(checkWinCondition, 700);
}

// Призыв помощника (Кощей — скелет, Леший — медведь).
//
// Помощник теперь настоящий боец в той же команде: со своими ХП, своей
// карточкой и своим местом в очереди ходов (см. characters.js ->
// createCompanion). Пока он жив, та же кнопка становится "Лечить <помощника>"
// и лечит именно ЕГО, а не хозяина, причём без отката — так и просили.
function executeSummonAction(attacker, skill) {
    clearInterval(state.timerInterval);
    document.getElementById('execute-btn').disabled = true;
    if (!attacker.isBot) state.playerSkipStreak = 0;

    const team = state.playerTeam.includes(attacker) ? state.playerTeam : state.enemyTeam;
    const existing = findCompanion(team, attacker);

    if (existing) {
        const healAmount = skill.companion.heal;
        const before = existing.hp;
        existing.hp = Math.min(existing.maxHp, existing.hp + healAmount);
        const healed = existing.hp - before;
        log(`${skill.companion.icon} <b>${attacker.name}</b> латает своего помощника — <b>${existing.name}</b> восстанавливает ${healed} ХП.`);
        playHealFx(existing, healed, {});
        attacker.currentCooldowns[skill.name] = 0; // лечение помощника без отката
    } else {
        const companion = createCompanion(attacker, skill.companion);
        team.push(companion);
        state.currentTurnIndex = insertIntoQueue(state.turnQueue, companion, state.currentTurnIndex);
        log(`${skill.companion.icon} <b>${attacker.name}</b> призывает помощника: <b>${companion.name}</b> (${companion.maxHp} ХП) вступает в бой!`);
        playBuffFx(attacker, { positive: true });
        attacker.currentCooldowns[skill.name] = skill.cooldown;
    }

    renderBattlefield(onTargetSelect);
    setTimeout(checkWinCondition, 700);
}

// Вампиризм ("Вытягивание душ" Кощея): отнимает у врага здоровье и ровно
// столько же отдаёт САМОМУ применяющему — не дружине и не выбранному
// союзнику. Раньше это было обычное лечение, которым Кощей мог подлатать
// кого угодно, что не соответствовало ни названию, ни задумке умения.
function executeDrainAction(attacker, skill, target) {
    clearInterval(state.timerInterval);
    document.getElementById('execute-btn').disabled = true;
    attacker.currentCooldowns[skill.name] = skill.cooldown;
    if (!attacker.isBot) state.playerSkipStreak = 0;

    const { restore } = applyTemporaryBoosts(attacker);
    const raw = computeAttackDamage(skill, attacker, target, state.currentArena);
    restore();

    const drained = Math.min(target.hp, raw);
    target.hp = Math.max(0, target.hp - drained);
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + drained);
    const restored = attacker.hp - before;

    log(`👻 <b>${attacker.name}</b> вытягивает душу из <b>${target.name}</b>: ${drained} урона, себе восстановлено ${restored} ХП.`);
    playHitFx(target, { crit: false, amount: drained });
    playHealFx(attacker, restored, {});
    if (skill.isUltimate) playUltimateFx(attacker, target);

    if (target.hp <= 0) {
        log(`<span class="death-log">💀 ${target.name} погибает!</span>`);
        playDeathFx(target);
    }

    renderBattlefield(onTargetSelect);
    setTimeout(checkWinCondition, 800);
}

// Массовое умение (aoe: true) - бьёт/лечит всю живую вражескую или свою
// команду разом. Используется как ультимативным умением (Жар-птица,
// Берегиня), так и потенциально любым будущим навыком с этим флагом.
function executeAoeAction(attacker, skill) {
    clearInterval(state.timerInterval);
    document.getElementById('execute-btn').disabled = true;
    attacker.currentCooldowns[skill.name] = skill.cooldown;
    if (!attacker.isBot) state.playerSkipStreak = 0;

    const { restore } = applyTemporaryBoosts(attacker);

    const isPlayerSide = state.playerTeam.includes(attacker);
    const targets = (skill.type === 'attack')
        ? (isPlayerSide ? state.enemyTeam : state.playerTeam).filter(c => c.hp > 0)
        : (isPlayerSide ? state.playerTeam : state.enemyTeam).filter(c => c.hp > 0);

    log(`${skill.icon} <b>${attacker.name}</b> применяет <i>${skill.name}</i> по всей ${skill.type === 'attack' ? 'вражеской команде' : 'своей дружине'}!`);
    if (skill.isUltimate) playUltimateFx(attacker, attacker);

    targets.forEach(target => {
        const result = resolveAction({ attacker, target, skill, arena: state.currentArena });

        if (result.missed) { playMissFx(target); return; }
        if (result.dodged) { log(`💨 <b>${target.name}</b> уворачивается!`); playDodgeFx(target); return; }
        if (result.blocked) { log(`🛡️ <b>${target.name}</b> блокирует удар!`); playBlockFx(target); return; }

        if (skill.type === 'attack') {
            target.hp = Math.max(0, target.hp - result.amount);
            log(`⚔️ <b>${target.name}</b> получает ${result.amount} урона.`);
            playHitFx(target, { crit: result.crit, amount: result.amount });
            if (target.hp <= 0) {
                target.hp = 0;
                log(`<span class="death-log">💀 ${target.name} погибает!</span>`);
                playDeathFx(target);
            }
        } else {
            target.hp = Math.min(target.maxHp, target.hp + result.amount);
            log(`💚 <b>${target.name}</b> восстанавливает ${result.amount} ХП.`);
            playHealFx(target, result.amount, { crit: result.critHeal });
        }
    });

    restore();
    renderBattlefield(onTargetSelect);
    setTimeout(checkWinCondition, 800);
}

// Разовые временные модификаторы атакующего: штраф за пропуск хода (-25%)
// и бонус "Внезапный натиск" второй команде (+15%) - оба потребляются
// за одно действие и снимаются сразу после (restore()).
function applyTemporaryBoosts(attacker) {
    const originalDmg = attacker.dmgMult;
    const originalHeal = attacker.healMult;

    if (attacker.timeoutDebuff) {
        attacker.dmgMult *= 0.75;
        attacker.healMult *= 0.75;
        attacker.timeoutDebuff = false;
    }
    if (attacker.underdogBuff) {
        attacker.dmgMult *= 1.15;
        attacker.healMult *= 1.15;
        attacker.underdogBuff = false;
    }

    return {
        restore: () => {
            attacker.dmgMult = originalDmg;
            attacker.healMult = originalHeal;
        }
    };
}

function botLogic() {
    // Ход бота запланирован через setTimeout: за это время игрок мог сдаться.
    if (state.battleOver) return;
    let activeChar = state.turnQueue[state.currentTurnIndex];
    if (activeChar.hp <= 0) return;

    const isPlayerSideBot = state.playerTeam.includes(activeChar);
    const allies = isPlayerSideBot ? state.playerTeam : state.enemyTeam;
    const enemies = isPlayerSideBot ? state.enemyTeam : state.playerTeam;

    const action = chooseBotAction(activeChar, allies, enemies, state.currentArena, state.difficulty);
    if (!action) {
        log(`⏳ <b>${activeChar.name}</b> восстанавливает силы (нет доступных навыков).`);
        nextTurn();
        return;
    }
    executeAction(activeChar, action.target, action.skill);
}

function nextTurn() {
    state.currentTurnIndex++;
    if (state.currentTurnIndex >= state.turnQueue.length) state.currentTurnIndex = 0;
    startTurn();
}

function finishBattle() {
    // Промо-герой (см. promocodes.js) одноразовый: если он участвовал в этом
    // бою - убираем его из профиля независимо от исхода боя.
    if (currentProfile && currentProfile.pendingPromoHero) {
        const usedPromo = state.playerTeam.some(c => c.id === currentProfile.pendingPromoHero.heroId);
        if (usedPromo) clearPendingPromoHero();
    }
}

/**
 * Помощник живёт ровно столько, сколько его хозяин: если хозяин пал, помощник
 * уходит с ним. Собрано в одном месте (вызывается перед проверкой победы),
 * чтобы не дублировать это в каждой ветке, где кто-то может умереть.
 */
function cleanupCompanions() {
    [state.playerTeam, state.enemyTeam].forEach(team => {
        team.forEach(unit => {
            if (!unit.isCompanion || unit.hp <= 0) return;
            const owner = team.find(c => c.id === unit.ownerId);
            if (!owner || owner.hp <= 0) {
                unit.hp = 0;
                log(`${unit.icon || '👥'} <b>${unit.name}</b> рассыпается — его хозяин пал.`);
            }
        });
    });
}

/**
 * Сдача боя. Засчитывается как обычное поражение: статистика поражений
 * растёт, сундук не выдаётся (он только за победу).
 *
 * Доступна в любой момент боя, в том числе пока думает бот — поэтому первым
 * делом гасим таймер хода и поднимаем battleOver, иначе уже запланированный
 * ход противника доиграл бы бой, из которого игрок только что вышел.
 */
export function surrenderBattle() {
    if (state.battleOver) return;
    if (!confirm('Сдаться? Бой засчитается как поражение, награды и сундука не будет.')) return;

    state.battleOver = true;
    clearInterval(state.timerInterval);
    log('🏳️ <b>Вы сдались.</b> Дружина отступает с поля боя.');

    recordLoss();
    finishBattle();
    alert('Вы сдались. Бой засчитан как поражение.');
    showMenu();
}

function checkWinCondition() {
    if (state.battleOver) return;
    cleanupCompanions();
    // Считаем только настоящих героев: бой не выигран тем, что у противника
    // остался один призванный скелет, и не проигран потерей помощника.
    let alivePlayers = livingHeroes(state.playerTeam).length;
    let aliveBots = livingHeroes(state.enemyTeam).length;

    if (alivePlayers === 0) {
        state.battleOver = true;
        setTimeout(() => {
            recordLoss();
            finishBattle();
            alert('Поражение! Вражеские богатыри оказались сильнее.');
            showMenu(); // сундук выдаётся только за победу
        }, 600);
    } else if (aliveBots === 0) {
        state.battleOver = true;
        setTimeout(() => {
            winBattle(state.difficulty);
            finishBattle();
            const reward = DIFFICULTY_REWARDS[state.difficulty] || DIFFICULTY_REWARDS.normal;
            alert(`Победа! Слава вашей дружине! Вы получили ${reward} монет 💰`);
            showPostBattleChest(showMenu);
        }, 600);
    } else {
        nextTurn();
    }
}
