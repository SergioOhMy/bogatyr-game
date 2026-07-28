import { describe, it, expect } from 'vitest';
import {
    computeAttackDamage, computeHealAmount, tickCooldowns,
    buildTurnQueue, resolveAction, rollChance,
    applyStatusEffects, applySkillDot,
    addBuff, tickBuffs, getBuffValue, hasBuff, dispelBuffs
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
