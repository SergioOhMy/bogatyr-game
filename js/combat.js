import { state, winBattle, recordLoss, clearPendingPromoHero, currentProfile } from './state.js';
import { showMenu } from './main.js';
import { initHeroStats, baseCharacters } from './characters.js';
import {
    log, renderBattlefield, renderSkills, checkActionState,
    playHitFx, playMissFx, playDodgeFx, playBlockFx,
    playHealFx, playRegenFx, playDoubleCastFx, playDeathFx, playUltimateFx
} from './ui.js';
import {
    buildTurnQueue, tickCooldowns, resolveAction, applyArenaTurnStart,
    applyStatusEffects, applySkillDot
} from './engine.js';
import { getArenaById } from './arenas.js';
import { chooseBotAction } from './bot.js';

export function startCombat(arenaId, difficulty) {
    state.currentArena = getArenaById(arenaId);
    state.difficulty = difficulty || 'normal';
    state.playerSkipStreak = 0;

    let remaining = baseCharacters.filter(c => !state.playerTeam.some(p => p.id === c.id));
    let shuffledBots = remaining.sort(() => 0.5 - Math.random()).slice(0, 3);

    state.enemyTeam = shuffledBots.map(c => initHeroStats(c, true));
    state.playerTeam = state.playerTeam.map(c => initHeroStats(c, false));

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
    battleScreen.className = `screen arena-bg-${state.currentArena.id}`;
    battleScreen.dataset.arenaIcon = state.currentArena.icon;

    const arenaLabel = document.getElementById('arena-label');
    if (arenaLabel) arenaLabel.textContent = `${state.currentArena.icon} ${state.currentArena.name}`;

    renderBattlefield(onTargetSelect);
    log(`<b>${state.currentArena.icon} Арена: ${state.currentArena.name}.</b> ${state.currentArena.desc}`);
    if (underdogFirstActor) {
        log(`🌀 <b>${underdogFirstActor.name}</b> входит в бой вторым и получает "Внезапный натиск": +15% к следующему действию.`);
    }
    startTurn();
}

export function onTargetSelect(char) {
    let activeChar = state.turnQueue[state.currentTurnIndex];
    if (activeChar.isBot || char.hp <= 0) return;
    if (state.selectedSkill && state.selectedSkill.aoe) return; // цель не нужна - умение массовое

    if (state.selectedSkill) {
        if (state.selectedSkill.type === 'attack' && !char.isBot) return;
        if (state.selectedSkill.type === 'heal' && char.isBot) return;
    }
    state.selectedTarget = char;
    renderBattlefield(onTargetSelect);
    checkActionState();
}

export function onSkillSelect(skill) {
    state.selectedSkill = skill;

    if (skill.aoe) {
        // Массовое умение - цель выбирать не нужно, бьёт/лечит всех разом
        state.selectedTarget = { aoe: true };
        renderBattlefield(onTargetSelect);
        renderSkills(state.turnQueue[state.currentTurnIndex], onSkillSelect);
        checkActionState();
        return;
    }

    let validTargets = skill.type === 'heal' ? state.playerTeam.filter(p => p.hp > 0) : state.enemyTeam.filter(e => e.hp > 0);

    if (!state.selectedTarget || state.selectedTarget.aoe || state.selectedTarget.hp <= 0 ||
        (skill.type === 'heal' && state.selectedTarget.isBot) || (skill.type === 'attack' && !state.selectedTarget.isBot)) {
        state.selectedTarget = validTargets[0];
    }
    renderBattlefield(onTargetSelect);
    renderSkills(state.turnQueue[state.currentTurnIndex], onSkillSelect);
    checkActionState();
}

export function startTurn() {
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
    if (activeChar.isBot) {
        actionBtn.style.display = 'none';
    } else {
        actionBtn.style.display = 'block';
    }
    checkActionState();

    renderBattlefield(onTargetSelect);
    renderSkills(activeChar, onSkillSelect);

    state.timeLeft = 60;
    document.getElementById('timer-display').innerText = state.timeLeft;

    state.timerInterval = setInterval(() => {
        state.timeLeft--;
        document.getElementById('timer-display').innerText = state.timeLeft;
        if (state.timeLeft <= 0) {
            clearInterval(state.timerInterval);
            handleTurnTimeout(activeChar);
        }
    }, 1000);

    if (activeChar.isBot) setTimeout(botLogic, 1500);
}

// Пропуск хода по таймеру (только у игрока - боты действуют раньше 60 сек):
// 1-й подряд пропуск - штраф -25% урона/лечения на следующее действие;
// 2-й подряд пропуск - немедленное поражение.
function handleTurnTimeout(activeChar) {
    state.playerSkipStreak++;
    if (state.playerSkipStreak >= 2) {
        log(`⏳💀 <b>${activeChar.name}</b> второй раз подряд не успевает сходить — дружина теряет боевой дух и сдаётся!`);
        setTimeout(() => {
            recordLoss();
            alert('Поражение! Два пропущенных хода подряд — бой проигран автоматически.');
            showMenu();
        }, 600);
        return;
    }
    activeChar.timeoutDebuff = true;
    log(`⏳ <b>${activeChar.name}</b> задумался и пропустил ход! Следующее действие ослаблено на 25%.`);
    nextTurn();
}

export function executeAction(attacker, target, skill, isDoubleCast = false) {
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

function checkWinCondition() {
    let alivePlayers = state.playerTeam.filter(p => p.hp > 0).length;
    let aliveBots = state.enemyTeam.filter(e => e.hp > 0).length;

    if (alivePlayers === 0) {
        setTimeout(() => {
            recordLoss();
            finishBattle();
            alert('Поражение! Вражеские богатыри оказались сильнее.');
            showMenu();
        }, 600);
    } else if (aliveBots === 0) {
        setTimeout(() => {
            winBattle();
            finishBattle();
            alert('Победа! Слава вашей дружине! Вы получили 50 монет 💰');
            showMenu();
        }, 600);
    } else {
        nextTurn();
    }
}
