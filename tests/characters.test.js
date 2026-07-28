// Проверки целостности данных героев.
//
// Это не тесты "движка", а страховка от опечаток в характеристиках: почти все
// баги баланса, которые ловились вручную, были не в коде, а в цифрах и флагах
// в characters.js. Особенно ценен тест про turns >= 2 у наступательных
// самобафов — из-за этой тонкости "Меткий глаз" Алёши и "Волчий инстинкт"
// Волколака не срабатывали ни разу за всю историю игры.

import { describe, it, expect } from 'vitest';
import { baseCharacters, passivesSystem, initHeroStats } from '../js/characters.js';
import { specialCharacters } from '../js/promocodes.js';
import { skinsCatalog } from '../js/skins.js';
import { weaponCatalog } from '../js/items.js';

const allCharacters = [...baseCharacters, ...specialCharacters];

describe('характеристики героев', () => {
    it('id уникальны', () => {
        const ids = allCharacters.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('у каждого героя есть валидная пассивка, раса и положительные HP/скорость', () => {
        allCharacters.forEach(char => {
            expect(passivesSystem[char.passive], `пассивка героя ${char.name}`).toBeDefined();
            expect(['human', 'undead', 'spirit', 'beast']).toContain(char.race);
            expect(char.hp).toBeGreaterThan(0);
            expect(char.speed).toBeGreaterThan(0);
            expect(char.price).toBeGreaterThanOrEqual(0);
        });
    });

    it('у каждого героя ровно 4 навыка и ровно одна ульта — последняя в списке', () => {
        allCharacters.forEach(char => {
            expect(char.skills.length, char.name).toBe(4);
            const ultimates = char.skills.filter(s => s.isUltimate);
            expect(ultimates.length, `ульт у ${char.name}`).toBe(1);
            expect(char.skills[char.skills.length - 1].isUltimate, `ульта ${char.name} должна быть последней`).toBe(true);
        });
    });

    it('у каждого навыка корректный тип и заполнены обязательные для типа поля', () => {
        allCharacters.forEach(char => {
            char.skills.forEach(skill => {
                const where = `${char.name} / ${skill.name}`;
                expect(['attack', 'heal', 'buff', 'dispel', 'summon'], where).toContain(skill.type);
                expect(skill.cooldown, where).toBeGreaterThanOrEqual(0);
                expect(skill.icon, where).toBeTruthy();

                if (skill.type === 'attack') expect(skill.dmg, where).toBeGreaterThan(0);
                if (skill.type === 'heal') expect(skill.dmg, where).toBeLessThan(0);
                if (skill.type === 'buff') {
                    expect(['self', 'ally', 'enemy'], where).toContain(skill.buffTarget);
                    expect(Array.isArray(skill.effects), where).toBe(true);
                    expect(skill.effects.length, where).toBeGreaterThan(0);
                    expect(skill.desc, where).toBeTruthy();
                }
                if (skill.type === 'dispel') expect(['ally', 'enemy'], where).toContain(skill.dispelTarget);
                if (skill.type === 'summon') {
                    expect(skill.companion, where).toBeDefined();
                    expect(skill.companion.procDmg, where).toBeGreaterThan(0);
                    expect(skill.companion.procHeal, where).toBeGreaterThan(0);
                }
            });
        });
    });

    it('наступательные самобафы живут >= 2 ходов, иначе не сработают никогда', () => {
        // Бафы тикают в начале хода носителя, поэтому turns: 1 у самобафа на
        // урон списывается раньше, чем герой успевает атаковать. Защитных
        // бафов (evasive) правило не касается — они работают в промежутке,
        // пока по герою бьют враги.
        allCharacters.forEach(char => {
            char.skills.filter(s => s.type === 'buff' && s.buffTarget === 'self').forEach(skill => {
                skill.effects.filter(e => e.stat === 'dmgBuff').forEach(effect => {
                    expect(effect.turns, `${char.name} / ${skill.name}`).toBeGreaterThanOrEqual(2);
                });
            });
        });
    });

    it('у каждого героя есть хотя бы одна атака, доступная с первого хода', () => {
        allCharacters.forEach(char => {
            const hero = initHeroStats(char, false);
            const openers = hero.skills.filter(s => s.type === 'attack' && s.unlockTurn <= 1 && s.cooldown === 0);
            expect(openers.length, `${char.name} не может атаковать на первом ходу`).toBeGreaterThan(0);
        });
    });

    it('DOT-эффекты навыков заданы разумно', () => {
        allCharacters.forEach(char => {
            char.skills.filter(s => s.dot).forEach(skill => {
                const where = `${char.name} / ${skill.name}`;
                expect(['poison', 'burn'], where).toContain(skill.dot.type);
                expect(skill.dot.amountPercent, where).toBeGreaterThan(0);
                expect(skill.dot.amountPercent, where).toBeLessThanOrEqual(0.15);
                expect(skill.dot.turns, where).toBeGreaterThan(0);
            });
        });
    });

    it('initHeroStats выдаёт готового к бою бойца', () => {
        const hero = initHeroStats(baseCharacters[0], false);
        expect(hero.hp).toBe(hero.maxHp);
        expect(hero.buffs).toEqual([]);
        expect(hero.statusEffects).toEqual([]);
        expect(hero.turnsTaken).toBe(0);
        expect(Object.keys(hero.currentCooldowns).length).toBe(hero.skills.length);
        hero.skills.forEach(s => expect(hero.currentCooldowns[s.name]).toBe(0));
    });

    it('initHeroStats делает глубокую копию — правки бойца не портят каталог', () => {
        const before = baseCharacters[0].skills[0].dmg;
        const hero = initHeroStats(baseCharacters[0], false);
        hero.skills[0].dmg = 9999;
        hero.hp = 1;
        expect(baseCharacters[0].skills[0].dmg).toBe(before);
    });
});

describe('скины и оружие', () => {
    it('скины ссылаются на существующих героев, id скинов уникальны', () => {
        const heroIds = new Set(baseCharacters.map(c => c.id));
        const skinIds = [];
        Object.entries(skinsCatalog).forEach(([heroId, skins]) => {
            expect(heroIds.has(heroId), `скин для несуществующего героя ${heroId}`).toBe(true);
            skins.forEach(s => {
                skinIds.push(s.id);
                expect(s.price).toBeGreaterThan(0);
                expect(s.img).toBeTruthy();
            });
        });
        expect(new Set(skinIds).size).toBe(skinIds.length);
    });

    it('оружие: id уникальны, эффекты корректны, "родной" герой существует', () => {
        const heroIds = new Set(allCharacters.map(c => c.id));
        const ids = weaponCatalog.map(w => w.id);
        expect(new Set(ids).size).toBe(ids.length);

        weaponCatalog.forEach(w => {
            expect(['dmg', 'def', 'heal'], w.name).toContain(w.baseEffect.stat);
            expect(w.sellPrice, w.name).toBeGreaterThan(0);
            if (w.bonusFor) {
                expect(heroIds.has(w.bonusFor), `оружие ${w.name} привязано к неизвестному герою`).toBe(true);
                expect(w.bonusEffect, w.name).toBeDefined();
            }
            // 'def' — множитель ВХОДЯЩЕГО урона, поэтому полезное значение отрицательное
            if (w.baseEffect.stat === 'def') expect(w.baseEffect.value, w.name).toBeLessThan(0);
            else expect(w.baseEffect.value, w.name).toBeGreaterThan(0);
        });
    });
});
