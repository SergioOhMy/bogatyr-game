import { state, winBattle, recordLoss } from './state.js';
import { showMenu } from './main.js';
import { initHeroStats, baseCharacters } from './characters.js';
import {
    log, renderBattlefield, renderSkills, checkActionState,
    playHitFx, playMissFx, playDodgeFx, playBlockFx,
    playHealFx, playRegenFx, playDoubleCastFx, playDeathFx, playUltimateFx
} from './ui.js';
import {
    buildTurnQueue, tickCooldowns, resolveAction, applyArenaTurnStart
} from './engine.js';
import { getArenaById } from './arenas.js';
import { chooseBotAction } from './bot.js';

export function startCombat(arenaId, difficulty) {
    state.currentArena = getArenaById(arenaId);
    state.difficulty = difficulty || 'normal';

    let remaining = baseCharacters.filter(c => !state.playerTeam.some(p => p.id === c.id));
    let shuffledBots = remaining.sort(() => 0.5 - Math.random()).slice(0, 3);

    state.enemyTeam = shuffledBots.map(c => initHeroStats(c, true));
    state.playerTeam = state.playerTeam.map(c => initHeroStats(c, false));

    // Единая очередь ходов по инициативе среди всех 6 бойцов сразу
    // (см. js/engine.js -> buildTurnQueue)
    state.turnQueue = buildTurnQueue(state.playerTeam, state.enemyTeam);
    state.currentTurnIndex = 0;

    const arenaLabel = document.getElementById('arena-label');
    if (arenaLabel) arenaLabel.textContent = `${state.currentArena.icon} ${state.currentArena.name}`;

    renderBattlefield(onTargetSelect);
    log(`<b>${state.currentArena.icon} Арена: ${state.currentArena.name}.</b> ${state.currentArena.desc}`);
    startTurn();
}

export function onTargetSelect(char) {
    let activeChar = state.turnQueue[state.currentTurnIndex];
    if (activeChar.isBot || char.hp <= 0) return;

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
    let validTargets = skill.type === 'heal' ? state.playerTeam.filter(p => p.hp > 0) : state.enemyTeam.filter(e => e.hp > 0);

    if (!state.selectedTarget || state.selectedTarget.hp <= 0 || (skill.type === 'heal' && state.selectedTarget.isBot) || (skill.type === 'attack' && !state.selectedTarget.isBot)) {
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

    tickCooldowns(activeChar);

    // Эффект начала хода от арены (лечение нежити в болоте, урон от лавы и т.п.)
    const startEffect = applyArenaTurnStart(activeChar, state.currentArena);
    if (startEffect) {
        if (startEffect.type === 'heal') {
            activeChar.hp = Math.min(activeChar.maxHp, activeChar.hp + startEffect.amount);
            log(`${state.currentArena.icon} <b>${activeChar.name}</b> черпает силы у арены и восстанавливает ${startEffect.amount} ХП.`);
        } else if (startEffect.type === 'burn') {
            activeChar.hp = Math.max(0, activeChar.hp - startEffect.amount);
            log(`${state.currentArena.icon} <b>${activeChar.name}</b> страдает от арены и теряет ${startEffect.amount} ХП.`);
        }
        if (activeChar.hp <= 0) {
            log(`<span class="death-log">💀 ${activeChar.name} погибает от условий арены!</span>`);
            renderBattlefield(onTargetSelect);
            setTimeout(checkWinCondition, 400);
            return;
        }
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
            log(`⏳ <b>${activeChar.name}</b> задумался и пропустил ход!`);
            nextTurn();
        }
    }, 1000);

    if (activeChar.isBot) setTimeout(botLogic, 1500);
}

export function executeAction(attacker, target, skill, isDoubleCast = false) {
    if (!isDoubleCast) {
        clearInterval(state.timerInterval);
        document.getElementById('execute-btn').disabled = true;
        attacker.currentCooldowns[skill.name] = skill.cooldown;
    }

    const result = resolveAction({ attacker, target, skill, arena: state.currentArena });

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

function checkWinCondition() {
    let alivePlayers = state.playerTeam.filter(p => p.hp > 0).length;
    let aliveBots = state.enemyTeam.filter(e => e.hp > 0).length;

    if (alivePlayers === 0) {
        setTimeout(() => {
            recordLoss();
            alert('Поражение! Вражеские богатыри оказались сильнее.');
            showMenu();
        }, 600);
    } else if (aliveBots === 0) {
        setTimeout(() => {
            winBattle();
            alert('Победа! Слава вашей дружине! Вы получили 50 монет 💰');
            showMenu();
        }, 600);
    } else {
        nextTurn();
    }
}
