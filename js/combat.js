import { state } from './state.js';
import { initHeroStats, baseCharacters } from './characters.js';
import { log, renderBattlefield, renderSkills, checkActionState } from './ui.js';

export function startCombat() {
    document.getElementById('selection-screen').classList.remove('active-screen');
    document.getElementById('combat-screen').classList.add('active-screen');

    let remaining = baseCharacters.filter(c => !state.playerTeam.some(p => p.id === c.id));
    let shuffledBots = remaining.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    state.enemyTeam = shuffledBots.map(c => initHeroStats(c, true));
    state.playerTeam = state.playerTeam.map(c => initHeroStats(c, false));

    state.playerTeam.sort((a, b) => b.initiativeScore - a.initiativeScore);
    state.enemyTeam.sort((a, b) => b.initiativeScore - a.initiativeScore);
    
    state.turnQueue = [];
    let playerStartsFirst = state.playerTeam[0].initiativeScore >= state.enemyTeam[0].initiativeScore;
    
    for(let i = 0; i < 3; i++) {
        if (playerStartsFirst) {
            state.turnQueue.push(state.playerTeam[i], state.enemyTeam[i]);
        } else {
            state.turnQueue.push(state.enemyTeam[i], state.playerTeam[i]);
        }
    }
    
    renderBattlefield(onTargetSelect);
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

    for (let skillName in activeChar.currentCooldowns) {
        if (activeChar.currentCooldowns[skillName] > 0) activeChar.currentCooldowns[skillName]--;
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

export function executeAction(attacker, target, skill) {
    clearInterval(state.timerInterval); 
    document.getElementById('execute-btn').disabled = true; 
    
    attacker.currentCooldowns[skill.name] = skill.cooldown;

    if (skill.type === 'attack') {
        let actualDmg = Math.round(skill.dmg * attacker.dmgMult * target.incDmgMult);
        target.hp -= actualDmg;
        log(`⚔️ <b>${attacker.name}</b> применяет <i>${skill.icon} ${skill.name}</i> на <b>${target.name}</b> и наносит ${actualDmg} урона!`);
        
        if (target.hp <= 0) {
            target.hp = 0;
            log(`<span class="death-log">💀 ${target.name} погибает!</span>`);
        }
    } else if (skill.type === 'heal') {
        let actualHeal = Math.round(Math.abs(skill.dmg) * attacker.healMult);
        target.hp = Math.min(target.maxHp, target.hp + actualHeal);
        log(`💚 <b>${attacker.name}</b> применяет <i>${skill.icon} ${skill.name}</i> на <b>${target.name}</b> и восстанавливает ${actualHeal} HP!`);
    }

    renderBattlefield(onTargetSelect);
    setTimeout(checkWinCondition, 800); 
}

function botLogic() {
    let activeChar = state.turnQueue[state.currentTurnIndex];
    if(activeChar.hp <= 0) return;

    let availableSkills = activeChar.skills.filter(s => activeChar.currentCooldowns[s.name] === 0);
    
    if (availableSkills.length === 0) {
        log(`⏳ <b>${activeChar.name}</b> восстанавливает силы (нет доступных навыков).`);
        nextTurn();
        return;
    }

    let randomSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
    let alivePlayers = state.playerTeam.filter(p => p.hp > 0);
    
    if (alivePlayers.length > 0) {
        let randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        
        if (randomSkill.type === 'heal') {
            let aliveBots = state.enemyTeam.filter(e => e.hp > 0);
            aliveBots.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
            randomTarget = aliveBots[0]; 
        }
        executeAction(activeChar, randomTarget, randomSkill);
    }
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
        setTimeout(() => { alert('Поражение! Вражеские богатыри оказались сильнее.'); location.reload(); }, 600);
    } else if (aliveBots === 0) {
        setTimeout(() => { alert('Победа! Слава вашей дружине!'); location.reload(); }, 600);
    } else {
        nextTurn(); 
    }
}