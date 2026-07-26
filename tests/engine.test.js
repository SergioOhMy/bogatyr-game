import { describe, it, expect } from 'vitest';
import {
    computeAttackDamage, computeHealAmount, tickCooldowns,
    buildTurnQueue, resolveAction, rollChance
} from '../js/engine.js';

function makeFighter(overrides = {}) {
    return {
        name: 'Тест',
        hp: 100, maxHp: 100,
        dmgMult: 1, healMult: 1, incDmgMult: 1,
        passiveTrigger: null, passiveChance: 0,
        initiativeScore: 50,
        currentCooldowns: { 'Удар': 0 },
        race: 'human',
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
