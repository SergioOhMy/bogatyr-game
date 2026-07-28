import { describe, it, expect } from 'vitest';
import {
    computeAttackDamage, computeHealAmount, tickCooldowns,
    buildTurnQueue, resolveAction, rollChance,
    applyStatusEffects, applySkillDot,
    addBuff, tickBuffs, getBuffValue, hasBuff, dispelBuffs,
    shuffle, pickRandom, BUFF_LIMITS, MAX_AVOID_CHANCE
} from '../js/engine.js';
import { applyWeaponEffect } from '../js/items.js';

function makeFighter(overrides = {}) {
    return {
        name: 'Тест',
        hp: 100, maxHp: 100,
        dmgMult: 1, healMult: 1, incDmgMult: 1,
        passiveTrigger: null, passiveChance: 0,
        initiativeScore: 50,
        currentCooldowns: { 'Удар': 0 },
        race: 'human',
        statusEffects: [],
        ...overrides
    };
}

describe('rollChance', () => {
    it('всегда true при rng вернувшем 0 и chance > 0', () => {
        expect(rollChance(0.5, () => 0)).toBe(true);
    });
    it('всегда false при chance = 0', () => {
        expect(rollChance(0, () => 0)).toBe(false);
    });
});

describe('computeAttackDamage', () => {
    it('считает базовый урон с учётом dmgMult атакующего и incDmgMult цели', () => {
        const skill = { dmg: 50, type: 'attack' };
        const attacker = makeFighter({ dmgMult: 1.2 });
        const target = makeFighter({ incDmgMult: 1.1 });
        // 50 * 1.2 * 1.1 = 66
        expect(computeAttackDamage(skill, attacker, target)).toBe(66);
    });

    it('никогда не даёт урон меньше 1', () => {
        const skill = { dmg: 1, type: 'attack' };
        const attacker = makeFighter({ dmgMult: 0.1 });
        const target = makeFighter();
        expect(computeAttackDamage(skill, attacker, target)).toBeGreaterThanOrEqual(1);
    });

    it('учитывает модификатор арены по расе', () => {
        const skill = { dmg: 100, type: 'attack' };
        const attacker = makeFighter({ race: 'beast' });
        const target = makeFighter();
        const arena = {
            dmgMultForRace: (race) => race === 'beast' ? 1.2 : 1,
            incDmgMultForRace: () => 1
        };
        expect(computeAttackDamage(skill, attacker, target, arena)).toBe(120);
    });
});

describe('computeHealAmount', () => {
    it('считает лечение по модулю dmg и healMult', () => {
        const skill = { dmg: -50, type: 'heal' };
        const attacker = makeFighter({ healMult: 1.5 });
        expect(computeHealAmount(skill, attacker)).toBe(75);
    });
});

describe('tickCooldowns', () => {
    it('уменьшает только положительные кулдауны на 1', () => {
        const char = makeFighter({ currentCooldowns: { a: 3, b: 0 } });
        tickCooldowns(char);
        expect(char.currentCooldowns.a).toBe(2);
        expect(char.currentCooldowns.b).toBe(0);
    });
});

describe('buildTurnQueue', () => {
    it('строит единую очередь по инициативе среди обеих команд', () => {
        const playerTeam = [makeFighter({ name: 'P1', initiativeScore: 130 }), makeFighter({ name: 'P2', initiativeScore: 20 })];
        const enemyTeam = [makeFighter({ name: 'E1', initiativeScore: 100 }), makeFighter({ name: 'E2', initiativeScore: 90 })];
        const queue = buildTurnQueue(playerTeam, enemyTeam);
        expect(queue.map(c => c.name)).toEqual(['P1', 'E1', 'E2', 'P2']);
    });
});

describe('resolveAction', () => {
    it('промахивается, если rng попадает в missChance арены', () => {
        const attacker = makeFighter();
        const target = makeFighter();
        const skill = { dmg: 30, type: 'attack' };
        const arena = { missChance: 0.5, dmgMultForRace: () => 1, incDmgMultForRace: () => 1 };
        const result = resolveAction({ attacker, target, skill, arena, rng: () => 0 });
        expect(result.missed).toBe(true);
        expect(result.amount).toBe(0);
    });

    it('уворот срабатывает по passiveChance цели и отменяет урон', () => {
        const attacker = makeFighter();
        const target = makeFighter({ passiveTrigger: 'dodge', passiveChance: 0.5 });
        const skill = { dmg: 30, type: 'attack' };
        const result = resolveAction({ attacker, target, skill, rng: () => 0 });
        expect(result.dodged).toBe(true);
        expect(result.amount).toBe(0);
    });

    it('крит увеличивает урон в 1.5 раза и помечается флагом', () => {
        const attacker = makeFighter({ passiveTrigger: 'crit', passiveChance: 1 });
        const target = makeFighter();
        const skill = { dmg: 40, type: 'attack' };
        const result = resolveAction({ attacker, target, skill, rng: () => 0 });
        expect(result.crit).toBe(true);
        expect(result.amount).toBe(60);
    });

    it('без срабатывания пассивок — обычный урон без пометок', () => {
        const attacker = makeFighter({ passiveTrigger: 'crit', passiveChance: 0.1 });
        const target = makeFighter();
        const skill = { dmg: 40, type: 'attack' };
        const result = resolveAction({ attacker, target, skill, rng: () => 0.99 });
        expect(result.crit).toBe(false);
        expect(result.amount).toBe(40);
    });

    it('лечение с критом даёт х1.5 и флаг critHeal', () => {
        const attacker = makeFighter({ passiveTrigger: 'crit_heal', passiveChance: 1, healMult: 1 });
        const target = makeFighter();
        const skill = { dmg: -50, type: 'heal' };
        const result = resolveAction({ attacker, target, skill, rng: () => 0 });
        expect(result.critHeal).toBe(true);
        expect(result.amount).toBe(75);
    });
});

describe('applySkillDot + applyStatusEffects (яд/ожог)', () => {
    it('накладывает DOT-эффект на цель после атаки с полем skill.dot', () => {
        const target = makeFighter({ maxHp: 200 });
        const skill = { dmg: 20, type: 'attack', dot: { type: 'poison', amountPercent: 0.05, turns: 3 } };
        applySkillDot(skill, target);
        expect(target.statusEffects.length).toBe(1);
        expect(target.statusEffects[0].amountPerTurn).toBe(10); // 5% от 200
        expect(target.statusEffects[0].turnsLeft).toBe(3);
    });

    it('не накладывает эффект, если у цели уже 0 HP', () => {
        const target = makeFighter({ hp: 0, maxHp: 200 });
        const skill = { dmg: 20, type: 'attack', dot: { type: 'poison', amountPercent: 0.05, turns: 3 } };
        applySkillDot(skill, target);
        expect(target.statusEffects.length).toBe(0);
    });

    it('тикает урон каждый ход и снимает эффект по истечении turnsLeft', () => {
        const target = makeFighter({ hp: 100, maxHp: 100 });
        target.statusEffects.push({ type: 'burn', amountPerTurn: 10, turnsLeft: 2 });

        let applied = applyStatusEffects(target);
        expect(target.hp).toBe(90);
        expect(applied).toEqual([{ type: 'burn', amount: 10 }]);
        expect(target.statusEffects[0].turnsLeft).toBe(1);

        applied = applyStatusEffects(target);
        expect(target.hp).toBe(80);
        expect(target.statusEffects.length).toBe(0); // эффект закончился
    });

    it('не опускает HP ниже нуля', () => {
        const target = makeFighter({ hp: 5, maxHp: 100 });
        target.statusEffects.push({ type: 'poison', amountPerTurn: 20, turnsLeft: 1 });
        applyStatusEffects(target);
        expect(target.hp).toBe(0);
    });
});

describe('addBuff + tickBuffs (бафы/дебафы v1.03)', () => {
    it('нормализует поле turns -> turnsLeft (регрессия: бафы исчезали сразу же)', () => {
        const target = makeFighter();
        addBuff(target, { stat: 'defBuff', value: -0.2, turns: 2, dispellable: true });
        expect(target.buffs.length).toBe(1);
        expect(target.buffs[0].turnsLeft).toBe(2);
    });

    it('баф переживает 1 тик из 2 и снимается после второго', () => {
        const target = makeFighter();
        addBuff(target, { stat: 'defBuff', value: -0.2, turns: 2 });
        tickBuffs(target);
        expect(target.buffs.length).toBe(1);
        expect(getBuffValue(target, 'defBuff')).toBe(-0.2);
        tickBuffs(target);
        expect(target.buffs.length).toBe(0);
    });

    it('defBuff корректно снижает входящий урон в computeAttackDamage', () => {
        const attacker = makeFighter();
        const target = makeFighter();
        addBuff(target, { stat: 'defBuff', value: -0.5, turns: 2 });
        const dmg = computeAttackDamage({ dmg: 100, type: 'attack' }, attacker, target);
        expect(dmg).toBe(50);
    });

    it('dispelBuffs снимает только dispellable-эффекты', () => {
        const target = makeFighter();
        addBuff(target, { stat: 'defBuff', value: -0.2, turns: 2, dispellable: true });
        addBuff(target, { stat: 'companion', value: 10, turns: 99, dispellable: false });
        const removed = dispelBuffs(target);
        expect(removed).toBe(1);
        expect(target.buffs.length).toBe(1);
        expect(target.buffs[0].stat).toBe('companion');
    });

    it('companion-баф переживает несколько тиков (регрессия: спутник исчезал после одного хода)', () => {
        const owner = makeFighter();
        addBuff(owner, { stat: 'companion', value: 18, turns: 99, meta: { icon: '💀', label: 'Скелет' } });
        tickBuffs(owner);
        tickBuffs(owner);
        tickBuffs(owner);
        expect(hasBuff(owner, 'companion')).toBe(true);
    });
});

describe('shuffle (честное перемешивание)', () => {
    it('не теряет и не дублирует элементы, не мутирует исходный массив', () => {
        const source = [1, 2, 3, 4, 5, 6, 7, 8];
        const result = shuffle(source);
        expect([...result].sort((a, b) => a - b)).toEqual(source);
        expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('распределяет элементы по позициям равномерно (регрессия: sort(() => 0.5 - random) был смещён)', () => {
        // Считаем, сколько раз каждый из 6 элементов попал в первую тройку -
        // именно так симулятор набирает команду A. У смещённой сортировки
        // элемент с индексом 0 оказывался там заметно чаще остальных
        // (в отчёте это выглядело как 10109 появлений против 6529).
        const items = [0, 1, 2, 3, 4, 5];
        const firstHalfCounts = new Array(6).fill(0);
        const RUNS = 60000;
        for (let i = 0; i < RUNS; i++) {
            shuffle(items).slice(0, 3).forEach(v => firstHalfCounts[v]++);
        }
        const expected = RUNS / 2; // каждый элемент ожидаемо в половине случаев
        firstHalfCounts.forEach(count => {
            expect(Math.abs(count - expected) / expected).toBeLessThan(0.03);
        });
    });

    it('детерминирован при подставленном rng', () => {
        const rng = () => 0; // всегда меняем местами с элементом 0
        expect(shuffle(['a', 'b', 'c'], rng)).toEqual(['b', 'c', 'a']);
    });
});

describe('pickRandom', () => {
    it('возвращает элемент массива', () => {
        expect(['a', 'b', 'c']).toContain(pickRandom(['a', 'b', 'c']));
    });
    it('возвращает null для пустого массива и для undefined', () => {
        expect(pickRandom([])).toBe(null);
        expect(pickRandom(undefined)).toBe(null);
    });
});

describe('потолки бафов (BUFF_LIMITS)', () => {
    it('суммарный defBuff не опускается ниже потолка, даже если сложить пять щитов', () => {
        const target = makeFighter();
        [-0.07, -0.18, -0.20, -0.14, -0.35].forEach(v => addBuff(target, { stat: 'defBuff', value: v, turns: 5 }));
        // Без клампа сумма была бы -0.94 (то есть -94% получаемого урона)
        expect(getBuffValue(target, 'defBuff')).toBe(BUFF_LIMITS.defBuff.min);
    });

    it('кламп реально влияет на итоговый урон', () => {
        const attacker = makeFighter();
        const target = makeFighter();
        [-0.5, -0.5, -0.5].forEach(v => addBuff(target, { stat: 'defBuff', value: v, turns: 5 }));
        // -1.5 без клампа дало бы отрицательный урон, срезанный до 1
        expect(computeAttackDamage({ dmg: 100, type: 'attack' }, attacker, target)).toBe(30);
    });

    it('суммарный dmgBuff ограничен сверху', () => {
        const attacker = makeFighter();
        [0.5, 0.5, 0.5, 0.5].forEach(v => addBuff(attacker, { stat: 'dmgBuff', value: v, turns: 5 }));
        expect(getBuffValue(attacker, 'dmgBuff')).toBe(BUFF_LIMITS.dmgBuff.max);
    });

    it('шанс уворота не достигает 100% даже при огромном evasive (регрессия: Колобок был неуязвим ход)', () => {
        const attacker = makeFighter();
        const target = makeFighter({ passiveTrigger: 'dodge', passiveChance: 0.16 });
        addBuff(target, { stat: 'evasive', value: 0.90, turns: 1 });
        // rng чуть выше потолка - атака обязана пройти
        const result = resolveAction({ attacker, target, skill: { dmg: 30, type: 'attack' }, rng: () => MAX_AVOID_CHANCE + 0.01 });
        expect(result.dodged).toBe(false);
        expect(result.amount).toBeGreaterThan(0);
    });
});

describe('время жизни самобафов', () => {
    // Регрессия: бафы тикают в начале хода своего носителя, поэтому
    // наступательный самобаф с turns: 1 списывался ДО того, как герой успевал
    // ударить - "Меткий глаз" Алёши и "Волчий инстинкт" Волколака не работали
    // вообще ни разу. Наступательные самобафы обязаны иметь turns >= 2.
    it('turns: 1 не доживает до собственной атаки носителя', () => {
        const hero = makeFighter();
        addBuff(hero, { stat: 'dmgBuff', value: 0.5, turns: 1 });
        tickBuffs(hero); // начало следующего хода носителя
        expect(getBuffValue(hero, 'dmgBuff')).toBe(0);
    });

    it('turns: 2 доживает ровно до одной атаки носителя и снимается после неё', () => {
        const hero = makeFighter();
        addBuff(hero, { stat: 'dmgBuff', value: 0.5, turns: 2 });
        tickBuffs(hero);
        expect(getBuffValue(hero, 'dmgBuff')).toBe(0.5);
        tickBuffs(hero);
        expect(getBuffValue(hero, 'dmgBuff')).toBe(0);
    });
});

describe('applyWeaponEffect (оружие v1.04)', () => {
    it('применяет базовый эффект оружия к любому герою', () => {
        const hero = makeFighter({ id: 'c99', dmgMult: 1 });
        const weapon = { id: 'test_sword', baseEffect: { stat: 'dmg', value: 0.1 }, bonusFor: 'c1' };
        applyWeaponEffect(hero, weapon);
        expect(hero.dmgMult).toBeCloseTo(1.1);
    });

    it('добавляет дополнительный бонус, только если оружие "родное" для этого героя', () => {
        const owner = makeFighter({ id: 'c1', dmgMult: 1 });
        const stranger = makeFighter({ id: 'c2', dmgMult: 1 });
        const weapon = { id: 'test_sword', baseEffect: { stat: 'dmg', value: 0.1 }, bonusFor: 'c1', bonusEffect: { stat: 'dmg', value: 0.2 } };
        applyWeaponEffect(owner, weapon);
        applyWeaponEffect(stranger, weapon);
        expect(owner.dmgMult).toBeCloseTo(1.32); // 1 * 1.1 * 1.2
        expect(stranger.dmgMult).toBeCloseTo(1.1); // только базовый эффект
    });

    it('ничего не делает, если оружие не передано', () => {
        const hero = makeFighter({ dmgMult: 1 });
        applyWeaponEffect(hero, null);
        expect(hero.dmgMult).toBe(1);
    });
});
