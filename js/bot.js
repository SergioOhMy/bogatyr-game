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

import { computeAttackDamage, findCompanion, pickRandom } from './engine.js';

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

    // 'drain' (вампиризм Кощея) для бота — такая же атака, как обычная: он
    // наносит урон и считается через computeAttackDamage. Без этого умение
    // просто выпадало бы из выбора и никогда не применялось ни ботом, ни в
    // симуляторе баланса.
    const attackSkills = availableSkills.filter(s => s.type === 'attack' || s.type === 'drain');
    // Лечение "только себе" боту нужно отделять от лечения дружины: направить
    // отдых на печи в раненого союзника нельзя (см. characters.js -> healTarget).
    const allHealSkills = availableSkills.filter(s => s.type === 'heal');
    const selfHealSkills = allHealSkills.filter(s => s.healTarget === 'self');
    const healSkills = allHealSkills.filter(s => s.healTarget !== 'self');
    const specialSkills = availableSkills.filter(s => s.type === 'buff' || s.type === 'dispel' || s.type === 'summon');
    const weakestAlly = aliveAllies.length ? pickLowestHpPercent(aliveAllies) : null;

    if (difficulty === 'easy') {
        const skill = pickRandom(availableSkills);
        if (skill.type === 'heal') {
            return { skill, target: skill.healTarget === 'self' ? activeChar : pickLowestHpPercent(aliveAllies) };
        }
        if (skill.type === 'attack' || skill.type === 'drain') return { skill, target: pickRandom(aliveEnemies) };
        const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
        return target ? { skill, target } : null;
    }

    if (difficulty === 'normal') {
        if (specialSkills.length && Math.random() < 0.35) {
            const skill = pickRandom(specialSkills);
            const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
            if (target) return { skill, target };
        }
        if (selfHealSkills.length && (activeChar.hp / activeChar.maxHp) < 0.45 && Math.random() < 0.6) {
            return { skill: pickRandom(selfHealSkills), target: activeChar };
        }
        if (healSkills.length && weakestAlly && (weakestAlly.hp / weakestAlly.maxHp) < 0.4 && Math.random() < 0.6) {
            return { skill: pickRandom(healSkills), target: weakestAlly };
        }
        const skill = pickRandom(attackSkills.length ? attackSkills : availableSkills);
        if (skill.type === 'heal') {
            return { skill, target: skill.healTarget === 'self' ? activeChar : (weakestAlly || activeChar) };
        }
        if (skill.type === 'attack' || skill.type === 'drain') {
            // Не всегда бьём самого слабого - иначе бот выглядит как
            // "убивает по очереди". С шансом 45% цель случайная.
            const target = Math.random() < 0.55 ? pickLowestHpPercent(aliveEnemies) : pickRandom(aliveEnemies);
            return { skill, target };
        }
        const target = pickDefaultTarget(skill, activeChar, aliveAllies, aliveEnemies);
        return target ? { skill, target } : { skill: availableSkills[0], target: aliveEnemies[0] };
    }

    // hard
    // 1. Призвать помощника, если его нет, или подлечить, если он серьёзно ранен.
    //
    // ВАЖНО: раньше здесь стояла проверка hasBuff(activeChar, 'companion') —
    // от той версии, когда помощник был бафом на хозяине. После переделки
    // помощника в отдельного бойца этот баф исчез, проверка всегда давала
    // false, и приоритет №1 срабатывал КАЖДЫЙ ход. А так как лечение помощника
    // идёт без отката, Кощей и Леший переставали воевать вообще и до конца боя
    // только латали помощника — их винрейт падал до 37-41%.
    const summonSkill = availableSkills.find(s => s.type === 'summon');
    if (summonSkill) {
        const companion = findCompanion(allies, activeChar);
        if (!companion) return { skill: summonSkill, target: activeChar };
        if (companion.hp / companion.maxHp < 0.5) return { skill: summonSkill, target: activeChar };
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

    // 5а. Лечимся сами, если самолечение есть и мы просели ниже половины
    if (selfHealSkills.length && (activeChar.hp / activeChar.maxHp) < 0.5) {
        const bestSelfHeal = [...selfHealSkills].sort((a, b) => Math.abs(b.dmg) - Math.abs(a.dmg))[0];
        return { skill: bestSelfHeal, target: activeChar };
    }

    // 5б. Лечим союзника ниже 50%, если есть чем
    if (healSkills.length && weakestAlly && (weakestAlly.hp / weakestAlly.maxHp) < 0.5) {
        const bestHeal = [...healSkills].sort((a, b) => Math.abs(b.dmg) - Math.abs(a.dmg))[0];
        return { skill: bestHeal, target: weakestAlly };
    }

    // 6. Полезный баф/дебаф, если есть под рукой и ничего срочнее нет
    if (specialSkills.length && Math.random() < 0.5) {
        const skill = pickRandom(specialSkills);
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
        ? (fallbackSkill.healTarget === 'self' ? activeChar : (weakestAlly || activeChar))
        : (pickDefaultTarget(fallbackSkill, activeChar, aliveAllies, aliveEnemies) || pickLowestHpPercent(aliveEnemies));
    return { skill: fallbackSkill, target };
}
