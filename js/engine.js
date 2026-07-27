// engine.js — чистая боевая математика, без обращений к DOM.
//
// Вынесена в отдельный модуль по трём причинам:
//  1) её можно покрыть unit-тестами (Vitest) без браузера и без мока DOM;
//  2) на ней же работает офлайн-симулятор баланса (scripts/balance-sim.js);
//  3) combat.js становится тонким слоем "посчитали здесь -> отрисовали там",
//     что резко снижает риск снова перепутать логику ходов при рефакторинге.
//
// Всё, что тут есть, принимает rng как параметр (по умолчанию Math.random),
// чтобы в тестах можно было подставлять детерминированную функцию.

export function rollChance(chance, rng = Math.random) {
    return rng() < chance;
}

/** Урон одной атаки с учётом мультипликаторов атакующего, цели и арены. */
export function computeAttackDamage(skill, attacker, target, arena = null) {
    let dmg = skill.dmg * attacker.dmgMult * target.incDmgMult;
    if (arena) {
        dmg *= arena.dmgMultForRace(attacker.race);
        dmg *= arena.incDmgMultForRace(target.race);
    }
    return Math.max(1, Math.round(dmg));
}

/** Объём лечения одного умения с учётом мультипликатора лекаря и арены. */
export function computeHealAmount(skill, attacker, arena = null) {
    let heal = Math.abs(skill.dmg) * attacker.healMult;
    if (arena) heal *= arena.healMultForRace(attacker.race);
    return Math.max(1, Math.round(heal));
}

export function computeMissChance(arena) {
    return arena ? arena.missChance : 0;
}

/** Уменьшает кулдауны конкретного персонажа на 1 (не мутирует ничего кроме него). */
export function tickCooldowns(character) {
    for (const name in character.currentCooldowns) {
        if (character.currentCooldowns[name] > 0) character.currentCooldowns[name]--;
    }
}

/** Единая очередь ходов по инициативе среди обеих команд сразу. */
export function buildTurnQueue(playerTeam, enemyTeam) {
    return [...playerTeam, ...enemyTeam].sort((a, b) => b.initiativeScore - a.initiativeScore);
}

/** Эффект начала хода от арены (лечение нежити в болоте, урон от лавы и т.п.). */
export function applyArenaTurnStart(character, arena) {
    if (!arena || !arena.turnStartEffect) return null;
    return arena.turnStartEffect(character);
}

/**
 * Тикает статус-эффекты персонажа (яд/ожог, накладываемые skill.dot —
 * см. characters.js). Мутирует character.hp и список эффектов напрямую
 * (как и tickCooldowns), возвращает список того, что сработало - для лога
 * и анимаций на стороне вызывающего кода.
 */
export function applyStatusEffects(character) {
    if (!character.statusEffects || character.statusEffects.length === 0) return [];
    const applied = [];
    character.statusEffects.forEach(effect => {
        const amount = Math.min(character.hp, effect.amountPerTurn);
        character.hp = Math.max(0, character.hp - effect.amountPerTurn);
        applied.push({ type: effect.type, amount });
        effect.turnsLeft--;
    });
    character.statusEffects = character.statusEffects.filter(e => e.turnsLeft > 0);
    return applied;
}

/** Накладывает DOT-эффект умения (skill.dot) на цель, если он есть и цель жива. */
export function applySkillDot(skill, target) {
    if (!skill.dot || target.hp <= 0) return;
    target.statusEffects.push({
        type: skill.dot.type,
        amountPerTurn: Math.round(target.maxHp * skill.dot.amountPercent),
        turnsLeft: skill.dot.turns
    });
}

/**
 * Разрешает одно применение навыка и возвращает структурированный результат,
 * не трогая HP и не работая с DOM — этим занимается вызывающий код (combat.js
 * в браузере или scripts/balance-sim.js в симуляции).
 */
export function resolveAction({ attacker, target, skill, arena = null, rng = Math.random }) {
    const result = {
        attacker, target, skill,
        missed: false, dodged: false, blocked: false,
        crit: false, critHeal: false,
        amount: 0, regen: 0,
        doubleCast: false
    };

    if (skill.type === 'attack') {
        if (rollChance(computeMissChance(arena), rng)) {
            result.missed = true;
            return result;
        }
        if (target.passiveTrigger === 'dodge' && rollChance(target.passiveChance, rng)) {
            result.dodged = true;
            return result;
        }
        if (target.passiveTrigger === 'block' && rollChance(target.passiveChance, rng)) {
            result.blocked = true;
            return result;
        }

        let dmg = computeAttackDamage(skill, attacker, target, arena);
        if (attacker.passiveTrigger === 'crit' && rollChance(attacker.passiveChance, rng)) {
            dmg = Math.round(dmg * 1.5);
            result.crit = true;
        }
        result.amount = dmg;

        // Регенерация проверяется как "успела бы сработать", а применит ли её
        // вызывающий код - зависит от того, выжила ли цель после урона (target.hp > 0).
        if (target.passiveTrigger === 'regen' && rollChance(target.passiveChance, rng)) {
            result.regen = Math.round(target.maxHp * 0.15);
        }
        if (attacker.passiveTrigger === 'double_cast' && rollChance(attacker.passiveChance, rng)) {
            result.doubleCast = true;
        }
    } else {
        let heal = computeHealAmount(skill, attacker, arena);
        if (attacker.passiveTrigger === 'crit_heal' && rollChance(attacker.passiveChance, rng)) {
            heal = Math.round(heal * 1.5);
            result.critHeal = true;
        }
        result.amount = heal;
    }

    return result;
}
