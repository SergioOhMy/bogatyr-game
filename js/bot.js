// bot.js — ИИ ботов с несколькими уровнями сложности.
//
// easy   — полностью случайный выбор навыка и цели (поведение как было раньше).
// normal — навык случайный, но целится в самого раненого противника ("добивание"),
//          иногда лечит союзника, если тот совсем плох.
// hard   — сперва ищет летальную комбинацию навык+цель среди доступных умений;
//          если лекарь нужен союзнику ниже 50% HP — лечит его лучшим лечением;
//          иначе бьёт самым сильным доступным навыком по самому раненому врагу.
//
// activeChar — тот, кто ходит; allies — его команда (для лечения);
// enemies — команда противника (для атаки). Такая сигнатура одинаково подходит
// и для боя в браузере, и для симуляции "бот против бота" в scripts/balance-sim.js.

import { computeAttackDamage } from './engine.js';

function pickLowestHpPercent(list) {
    return [...list].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
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

    if (difficulty === 'easy') {
        const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        if (skill.type === 'heal') {
            return { skill, target: pickLowestHpPercent(aliveAllies) };
        }
        const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        return { skill, target };
    }

    if (difficulty === 'normal') {
        const attackSkills = availableSkills.filter(s => s.type === 'attack');
        const healSkills = availableSkills.filter(s => s.type === 'heal');
        const weakestAlly = aliveAllies.length ? pickLowestHpPercent(aliveAllies) : null;

        if (healSkills.length && weakestAlly && (weakestAlly.hp / weakestAlly.maxHp) < 0.4 && Math.random() < 0.6) {
            const skill = healSkills[Math.floor(Math.random() * healSkills.length)];
            return { skill, target: weakestAlly };
        }
        const pool = attackSkills.length ? attackSkills : availableSkills;
        const skill = pool[Math.floor(Math.random() * pool.length)];
        if (skill.type === 'heal') {
            return { skill, target: weakestAlly || pickLowestHpPercent(aliveEnemies) };
        }
        return { skill, target: pickLowestHpPercent(aliveEnemies) };
    }

    // hard
    const attackSkills = availableSkills.filter(s => s.type === 'attack');
    const healSkills = availableSkills.filter(s => s.type === 'heal');
    const weakestAlly = aliveAllies.length ? pickLowestHpPercent(aliveAllies) : null;

    // 1. Летальная комбинация — предпочитаем ту, что тратит навык с меньшим кулдауном
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

    // 2. Лечим союзника ниже 50%, если есть чем
    if (healSkills.length && weakestAlly && (weakestAlly.hp / weakestAlly.maxHp) < 0.5) {
        const bestHeal = [...healSkills].sort((a, b) => Math.abs(b.dmg) - Math.abs(a.dmg))[0];
        return { skill: bestHeal, target: weakestAlly };
    }

    // 3. Бьём самым сильным доступным навыком по самому раненому врагу
    if (attackSkills.length) {
        const bestAttack = [...attackSkills].sort((a, b) => (b.dmg * activeChar.dmgMult) - (a.dmg * activeChar.dmgMult))[0];
        return { skill: bestAttack, target: pickLowestHpPercent(aliveEnemies) };
    }

    // На крайний случай — что осталось из доступного
    const fallbackSkill = availableSkills[0];
    const target = fallbackSkill.type === 'heal'
        ? (weakestAlly || pickLowestHpPercent(aliveEnemies))
        : pickLowestHpPercent(aliveEnemies);
    return { skill: fallbackSkill, target };
}
