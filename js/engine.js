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

/**
 * Честное перемешивание (Фишер–Йетс).
 *
 * ВАЖНО: раньше и набор вражеской команды (combat.js), и симулятор баланса
 * пользовались приёмом `arr.sort(() => 0.5 - Math.random())`. Это НЕ даёт
 * равномерную перестановку: компаратор непоследователен, и реальный алгоритм
 * сортировки просто "оседает" рядом с исходным порядком. На симуляции это
 * было отлично видно — Илья (индекс 0) попадал в бой 10109 раз, а Василиса
 * (индекс 12) всего 6529 при одинаковом ожидании ~8000. То есть и отчёт по
 * балансу считался на перекошенной выборке, и игрок непропорционально часто
 * встречал в противниках первых героев списка.
 */
export function shuffle(array, rng = Math.random) {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Случайный элемент массива (null для пустого). */
export function pickRandom(array, rng = Math.random) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(rng() * array.length)];
}

/** Урон одной атаки с учётом мультипликаторов атакующего, цели, арены и активных бафов/дебафов. */
export function computeAttackDamage(skill, attacker, target, arena = null) {
    let dmg = skill.dmg * attacker.dmgMult * target.incDmgMult;
    dmg *= (1 + getBuffValue(attacker, 'dmgBuff'));
    dmg *= (1 + getBuffValue(target, 'defBuff'));
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

/** Живой помощник указанного хозяина в его команде (или null). */
export function findCompanion(team, owner) {
    return team.find(c => c.isCompanion && c.ownerId === owner.id && c.hp > 0) || null;
}

/** Только настоящие герои — помощники не считаются за бойцов при подсчёте победы. */
export function livingHeroes(team) {
    return team.filter(c => c.hp > 0 && !c.isCompanion);
}

/**
 * Вставляет нового бойца (помощника) в уже идущую очередь ходов по его
 * инициативе и возвращает поправленный индекс текущего хода: если вставка
 * произошла до текущей позиции, индекс надо сдвинуть, иначе очередь
 * "перескочит" через того, кто ходит прямо сейчас.
 */
export function insertIntoQueue(queue, unit, currentIndex) {
    let pos = queue.findIndex(c => c.initiativeScore < unit.initiativeScore);
    if (pos === -1) pos = queue.length;
    queue.splice(pos, 0, unit);
    return pos <= currentIndex ? currentIndex + 1 : currentIndex;
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

// ---------------------------------------------------------------------------
// Бафы / дебафы (v1.03). Хранятся как character.buffs: массив
// { stat, value, turnsLeft, dispellable }.
// Поддерживаемые stat:
//   'dmgBuff'     - множитель урона атакующего (+0.3 = +30% урона)
//   'defBuff'     - множитель получаемого урона (-0.3 = -30% входящего урона)
//   'evasive'     - дополнительный шанс уворота (0.9 = +90% к шансу)
//   'blind'       - дополнительный шанс промаха СВОИХ атак (0.3 = +30%)
//   'stun'        - пропускает следующий собственный ход целиком
//   'companion'   - разовый "вызов" (скелет/медведь), см. combat.js
// ---------------------------------------------------------------------------

export function addBuff(character, buff) {
    character.buffs = character.buffs || [];
    character.buffs.push({
        stat: buff.stat,
        value: buff.value,
        turnsLeft: buff.turnsLeft ?? buff.turns ?? 1,
        dispellable: buff.dispellable !== false,
        meta: buff.meta
    });
}

export function tickBuffs(character) {
    if (!character.buffs) return;
    character.buffs.forEach(b => b.turnsLeft--);
    character.buffs = character.buffs.filter(b => b.turnsLeft > 0);
}

/**
 * Потолки суммарного эффекта одного вида бафов.
 *
 * Без них эффекты складывались без ограничений: например, Стена щитов
 * Добрыни (-7%) + Огненный щит Горыныча (-18%) + Природная защита Берегини
 * (-20%) + Каменная кожа (-14%) и ульта Святогора (-35%) давали -94%
 * получаемого урона, то есть команду становилось физически невозможно
 * убить чем-либо, кроме "минимум 1 урона" из computeAttackDamage.
 */
export const BUFF_LIMITS = {
    dmgBuff: { min: -0.80, max: 1.50 },
    defBuff: { min: -0.70, max: 1.50 },
    evasive: { min: 0, max: 0.85 },
    blind:   { min: 0, max: 0.75 }
};

/** Максимальный итоговый шанс промахнуться/быть увёрнутым — чтобы «непробиваемых» бойцов не было. */
export const MAX_AVOID_CHANCE = 0.85;

function clampToLimits(stat, value) {
    const limit = BUFF_LIMITS[stat];
    if (!limit) return value;
    return Math.min(limit.max, Math.max(limit.min, value));
}

export function getBuffValue(character, stat) {
    if (!character.buffs) return 0;
    const sum = character.buffs.filter(b => b.stat === stat).reduce((acc, b) => acc + b.value, 0);
    return clampToLimits(stat, sum);
}

export function hasBuff(character, stat) {
    return !!(character.buffs && character.buffs.some(b => b.stat === stat));
}

export function removeBuffsByStat(character, stat) {
    if (!character.buffs) return;
    character.buffs = character.buffs.filter(b => b.stat !== stat);
}

/** Снимает все РАЗВЕИВАЕМЫЕ бафы/дебафы с цели (дебаф-скиллы "снять чары" и т.п.). Возвращает сколько сняли. */
export function dispelBuffs(character) {
    if (!character.buffs) return 0;
    const before = character.buffs.length;
    character.buffs = character.buffs.filter(b => !b.dispellable);
    return before - character.buffs.length;
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
        const blindMiss = getBuffValue(attacker, 'blind');
        const missChance = Math.min(MAX_AVOID_CHANCE, computeMissChance(arena) + blindMiss);
        if (rollChance(missChance, rng)) {
            result.missed = true;
            return result;
        }
        const dodgeChance = Math.min(MAX_AVOID_CHANCE,
            (target.passiveTrigger === 'dodge' ? target.passiveChance : 0) + getBuffValue(target, 'evasive'));
        if (dodgeChance > 0 && rollChance(dodgeChance, rng)) {
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
