// bot.js — ИИ ботов с несколькими уровнями сложности.
//
// easy   — полностью случайный выбор навыка и цели.
// normal — навык случайный (иногда предпочитает бафы/дебафы), целится в
//          самого раненого противника при атаке, лечит союзника при нужде.
// hard   — приоритеты: призвать спутника, если ещё не призван -> развеять
//          опасный щит у врага -> летальная комбинация атаки -> лечение
//          союзника ниже 50% -> самый сильный доступный удар.
//
// activeChar — тот, кто ходит; allies — его команда; enemies — команда
// противника. Подходит и для боя в браузере, и для симуляции в
// scripts/balance-sim.js.

import { computeAttackDamage, hasBuff } from './engine.js';

function pickLowestHpPercent(list) {
    return [...list].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}

/** Цель по умолчанию для бафа/дебафа/дизела/вызова - когда точный расчёт не нужен. */
function pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies) {
    if (skill.type === 'summon') return activeChar;
    if (skill.type === 'buff') {
        if (skill.buffTarget === 'self') return activeChar;
        if (skill.buffTarget === 'ally') return aliveAllies.length ? pickLowestHpPercent(aliveAllies) : activeChar;
        return aliveEnemies.length ? pickLowestHpPercent(aliveEnemies) : null; // enemy
    }
    if (skill.type === 'dispel') {
        if (skill.dispelTarget === 'ally') return aliveAllies.length ? aliveAllies[0] : activeChar;
        return aliveEnemies.length ? aliveEnemies[0] : null;
    }
    return null;
}

export function chooseBotAction(activeChar, allies, enemies, arena, difficulty = 'normal') {
    const availableSkills = activeChar.skills.filter(s =>
        activeChar.currentCooldowns[s.name] === 0 && activeChar.turnsTaken >= s.unlockTurn
    );
    if (availableSkills.length === 0) return null;

    const aliveEnemies = enemies.filter(e => e.hp > 0);
    const aliveAllies = allies.filter(a => a.hp > 0 && a !== activeChar).concat(
        activeChar.hp > 0 ? [activeChar] : []
    );

    if (aliveEnemies.length === 0) return null;

    const attackSkills = availableSkills.filter(s => s.type === 'attack');
    const healSkills = availableSkills.filter(s => s.type === 'heal');
    const specialSkills = availableSkills.filter(s => s.type === 'buff' || s.type === 'dispel' || s.type === 'summon');
    const weakestAlly = aliveAllies.length ? pickLowestHpPercent(aliveAllies) : null;

    if (difficulty === 'easy') {
        const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        if (skill.type === 'heal') return { skill, target: pickLowestHpPercent(aliveAllies) };
        if (skill.type === 'attack') {
            return { skill, target: aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)] };
        }
        const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
        return target ? { skill, target } : null;
    }

    if (difficulty === 'normal') {
        if (specialSkills.length && Math.random() < 0.35) {
            const skill = specialSkills[Math.floor(Math.random() * specialSkills.length)];
            const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
            if (target) return { skill, target };
        }
        if (healSkills.length && weakestAlly && (weakestAlly.hp / weakestAlly.maxHp) < 0.4 && Math.random() < 0.6) {
            const skill = healSkills[Math.floor(Math.random() * healSkills.length)];
            return { skill, target: weakestAlly };
        }
        const pool = attackSkills.length ? attackSkills : availableSkills;
        const skill = pool[Math.floor(Math.random() * pool.length)];
        if (skill.type === 'heal') return { skill, target: weakestAlly || pickLowestHpPercent(aliveEnemies) };
        if (skill.type === 'attack') {
            // Не всегда бьём самого слабого - иначе бот выглядит как
            // "убивает по очереди". С шансом 45% цель случайная.
            const target = Math.random() < 0.55 ? pickLowestHpPercent(aliveEnemies) : aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            return { skill, target };
        }
        const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
        return target ? { skill, target } : { skill: availableSkills[0], target: aliveEnemies[0] };
    }

    // hard
    // 1. Призвать спутника, если ещё не призван
    const summonSkill = availableSkills.find(s => s.type === 'summon');
    if (summonSkill && !hasBuff(activeChar, 'companion')) {
        return { skill: summonSkill, target: activeChar };
    }

    // 2. Развеять опасный щит/бафы у врага, если они есть
    const dispelEnemySkill = availableSkills.find(s => s.type === 'dispel' && s.dispelTarget === 'enemy');
    if (dispelEnemySkill) {
        const shieldedEnemy = aliveEnemies.find(e => e.buffs && e.buffs.some(b => b.dispellable));
        if (shieldedEnemy) return { skill: dispelEnemySkill, target: shieldedEnemy };
    }

    // 3. Снять дебафы с союзника, если у кого-то они есть
    const dispelAllySkill = availableSkills.find(s => s.type === 'dispel' && s.dispelTarget === 'ally');
    if (dispelAllySkill) {
        const debuffedAlly = aliveAllies.find(a => a.buffs && a.buffs.some(b => b.dispellable && (b.stat === 'dmgBuff' && b.value < 0 || b.stat === 'blind' || b.stat === 'stun')));
        if (debuffedAlly) return { skill: dispelAllySkill, target: debuffedAlly };
    }

    // 4. Летальная комбинация — предпочитаем ту, что тратит навык с меньшим кулдауном
    let lethal = null;
    for (const skill of attackSkills) {
        for (const enemy of aliveEnemies) {
            const predicted = computeAttackDamage(skill, activeChar, enemy, arena);
            if (predicted >= enemy.hp && (!lethal || skill.cooldown < lethal.skill.cooldown)) {
                lethal = { skill, target: enemy };
            }
        }
    }
    if (lethal) return lethal;

    // 5. Лечим союзника ниже 50%, если есть чем
    if (healSkills.length && weakestAlly && (weakestAlly.hp / weakestAlly.maxHp) < 0.5) {
        const bestHeal = [...healSkills].sort((a, b) => Math.abs(b.dmg) - Math.abs(a.dmg))[0];
        return { skill: bestHeal, target: weakestAlly };
    }

    // 6. Полезный баф/дебаф, если есть под рукой и ничего срочнее нет
    if (specialSkills.length && Math.random() < 0.5) {
        const skill = specialSkills[Math.floor(Math.random() * specialSkills.length)];
        const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
        if (target) return { skill, target };
    }

    // 7. Бьём самым сильным доступным навыком по самому раненому врагу
    if (attackSkills.length) {
        const bestAttack = [...attackSkills].sort((a, b) => (b.dmg * activeChar.dmgMult) - (a.dmg * activeChar.dmgMult))[0];
        return { skill: bestAttack, target: pickLowestHpPercent(aliveEnemies) };
    }

    // На крайний случай — что осталось из доступного
    const fallbackSkill = availableSkills[0];
    const target = fallbackSkill.type === 'heal'
        ? (weakestAlly || pickLowestHpPercent(aliveEnemies))
        : (pickDefaultTarget(fallbackSkill, activeChar, aliveAllies, aliveEnemies) || pickLowestHpPercent(aliveEnemies));
    return { skill: fallbackSkill, target };
}
