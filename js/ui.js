import { state } from './state.js';

export function log(msg) {
    const logDiv = document.getElementById('combat-log');
    logDiv.innerHTML += `<div>${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

export function renderBattlefield(onTargetSelect) {
    const pDiv = document.getElementById('player-team');
    const eDiv = document.getElementById('enemy-team');
    pDiv.innerHTML = ''; eDiv.innerHTML = '';

    const renderChar = (char, div) => {
        let isDead = char.hp <= 0;
        let hpPercent = Math.max(0, (char.hp / char.maxHp) * 100);
        
        let el = document.createElement('div');
        let classes = ['fighter'];
        
        if (isDead) classes.push('dead-hero');
        else if (state.turnQueue[state.currentTurnIndex] === char) classes.push('active-turn');
        
        if (state.selectedTarget === char && !isDead) {
            classes.push(state.selectedSkill && state.selectedSkill.type === 'heal' ? 'selected-target-heal' : 'selected-target');
        }
        el.className = classes.join(' ');
        
        let skullHtml = isDead ? `<div class="skull-overlay">💀</div>` : '';
        
        el.innerHTML = `
            ${skullHtml}
            <div class="avatar" style="background-image: url('${char.img}');"></div>
            <div class="stats">
                <b>${char.name}</b> <small>(${char.hp}/${char.maxHp})</small>
                <div class="passive-info">${char.passiveName}</div>
                <div class="hp-bar-bg"><div class="hp-bar-fill" style="width: ${hpPercent}%; background: ${hpPercent < 30 ? '#e74c3c' : '#2ecc71'}"></div></div>
            </div>`;
        
        el.onclick = () => onTargetSelect(char);
        div.appendChild(el);
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
        btn.className = 'skill-btn';
        if (state.selectedSkill === skill) btn.classList.add('selected-skill');
        
        let cdLeft = char.currentCooldowns[skill.name];
        let displayVal = Math.round(Math.abs(skill.dmg) * (skill.type === 'heal' ? char.healMult : char.dmgMult));
        
        let innerHtml = `<div><span>${skill.icon}</span> <b>${skill.name}</b></div> <small>(${skill.dmg > 0 ? 'Урон' : 'Хил'}: ~${displayVal})</small>`;
        if (cdLeft > 0) {
            innerHtml += `<br><small style="color: #f1c40f;">⏳ Откат: ${cdLeft} ход.</small>`;
            btn.disabled = true; 
        }
        
        btn.innerHTML = innerHtml;
        if (cdLeft === 0) btn.onclick = () => onSkillSelect(skill, btn);
        container.appendChild(btn);
    });
}

export function checkActionState() {
    const btn = document.getElementById('execute-btn');
    if (state.selectedSkill && state.selectedTarget) {
        btn.disabled = false;
        if (state.selectedSkill.type === 'heal') {
            btn.innerText = `Лечить: ${state.selectedTarget.name}!`;
            btn.style.background = '#27ae60';
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