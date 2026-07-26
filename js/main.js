import { state } from './state.js';
import { baseCharacters, passivesSystem } from './characters.js';
import { startCombat, executeAction } from './combat.js';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    
    // Рендер экрана выбора
    const rosterDiv = document.getElementById('roster');
    baseCharacters.forEach(char => {
        const p = passivesSystem[char.passive];
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="avatar" style="background-image: url('${char.img}');"></div>
            <b>${char.name}</b><br>
            <div class="passive-badge" title="${p.desc}">${p.name}</div>
        `;
        
        card.onclick = () => {
            if (state.playerTeam.some(c => c.id === char.id)) {
                state.playerTeam = state.playerTeam.filter(c => c.id !== char.id);
                card.classList.remove('selected');
            } else if (state.playerTeam.length < 3) {
                state.playerTeam.push(char);
                card.classList.add('selected');
            }
            document.getElementById('start-btn').disabled = state.playerTeam.length !== 3;
        };
        rosterDiv.appendChild(card);
    });

    // Навешиваем события на основные кнопки
    document.getElementById('start-btn').addEventListener('click', startCombat);
    
    document.getElementById('execute-btn').addEventListener('click', () => {
        if (state.selectedSkill && state.selectedTarget) {
            executeAction(state.turnQueue[state.currentTurnIndex], state.selectedTarget, state.selectedSkill);
        }
    });
});