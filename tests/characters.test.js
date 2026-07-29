// Проверки целостности данных героев.
//
// Это не тесты "движка", а страховка от опечаток в характеристиках: почти все
// баги баланса, которые ловились вручную, были не в коде, а в цифрах и флагах
// в characters.js. Особенно ценен тест про turns >= 2 у наступательных
// самобафов — из-за этой тонкости "Меткий глаз" Алёши и "Волчий инстинкт"
// Волколака не срабатывали ни разу за всю историю игры.

import { describe, it, expect } from 'vitest';
import { baseCharacters, passivesSystem, initHeroStats, createCompanion } from '../js/characters.js';
import { specialCharacters } from '../js/promocodes.js';
import { skinsCatalog, SKIN_PRICE } from '../js/skins.js';
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
                expect(['attack', 'heal', 'buff', 'dispel', 'summon', 'drain'], where).toContain(skill.type);
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
                if (skill.type === 'drain') expect(skill.dmg, where).toBeGreaterThan(0);
                if (skill.type === 'summon') {
                    // Помощник теперь полноценный боец: нужны его ХП, урон,
                    // скорость (для места в очереди) и объём лечения.
                    expect(skill.companion, where).toBeDefined();
                    expect(skill.companion.hp, where).toBeGreaterThan(0);
                    expect(skill.companion.dmg, where).toBeGreaterThan(0);
                    expect(skill.companion.heal, where).toBeGreaterThan(0);
                    expect(skill.companion.speed, where).toBeGreaterThan(0);
                    expect(skill.companion.label, where).toBeTruthy();
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

    // Регрессия: максимум здоровья считался от текущего hp, а не от базового.
    // Повторная инициализация раздувала HP (188 -> 235), а инициализация уже
    // погибшего бойца давала maxHp = 0 — после чего полоса здоровья считалась
    // как 0/0 и в лог боя сыпалось "наносит NaN урона".
    it('initHeroStats идемпотентна: повторный вызов не меняет характеристики', () => {
        allCharacters.forEach(char => {
            const once = initHeroStats(char, false);
            const twice = initHeroStats(once, false);
            expect(twice.maxHp, `${char.name}: повторная инициализация раздувает HP`).toBe(once.maxHp);
            expect(twice.hp, char.name).toBe(once.hp);
            expect(twice.dmgMult, char.name).toBeCloseTo(once.dmgMult);
            expect(twice.initiativeScore, char.name).toBe(once.initiativeScore);
        });
    });

    it('погибший боец переинициализируется с полным здоровьем, а не с нулевым', () => {
        allCharacters.forEach(char => {
            const fighter = initHeroStats(char, false);
            const fullHp = fighter.maxHp;
            fighter.hp = 0; // боец пал в предыдущем бою
            const revived = initHeroStats(fighter, false);
            expect(revived.maxHp, `${char.name}: maxHp обнулился`).toBe(fullHp);
            expect(revived.hp, char.name).toBe(fullHp);
            expect(Number.isFinite(revived.maxHp), char.name).toBe(true);
        });
    });

    it('боец с испорченным здоровьем отвергается явной ошибкой, а не молча даёт NaN', () => {
        const broken = { ...baseCharacters[0], hp: NaN, baseHp: NaN };
        expect(() => initHeroStats(broken, false)).toThrow(/базовое здоровье/);
    });

    it('initHeroStats делает глубокую копию — правки бойца не портят каталог', () => {
        const before = baseCharacters[0].skills[0].dmg;
        const hero = initHeroStats(baseCharacters[0], false);
        hero.skills[0].dmg = 9999;
        hero.hp = 1;
        expect(baseCharacters[0].skills[0].dmg).toBe(before);
    });
});

describe('помощники (скелет/медведь)', () => {
    const summonSkills = allCharacters.flatMap(c =>
        c.skills.filter(s => s.type === 'summon').map(s => ({ owner: c, skill: s })));

    it('в игре есть хотя бы один призыв', () => {
        expect(summonSkills.length).toBeGreaterThan(0);
    });

    it('createCompanion даёт готового к бою юнита со своими ХП', () => {
        summonSkills.forEach(({ owner, skill }) => {
            const hero = initHeroStats(owner, false);
            const comp = createCompanion(hero, skill.companion);
            const where = `${owner.name} / ${comp.name}`;
            expect(comp.isCompanion, where).toBe(true);
            expect(comp.ownerId, where).toBe(hero.id);
            expect(comp.hp, where).toBe(comp.maxHp);
            expect(comp.maxHp, where).toBeGreaterThan(0);
            expect(comp.isBot, where).toBe(true); // ходит сам даже в дружине игрока
            expect(comp.skills.length, where).toBe(1);
            expect(comp.skills[0].type, where).toBe('attack');
            expect(comp.currentCooldowns[comp.skills[0].name], where).toBe(0);
            expect(comp.initiativeScore, where).toBeGreaterThan(0);
            expect(comp.buffs, where).toEqual([]);
            expect(comp.statusEffects, where).toEqual([]);
        });
    });

    it('id помощника не конфликтует с id героев', () => {
        const heroIds = new Set(allCharacters.map(c => c.id));
        summonSkills.forEach(({ owner, skill }) => {
            const comp = createCompanion(owner, skill.companion);
            expect(heroIds.has(comp.id)).toBe(false);
        });
    });

    it('два разных хозяина получают разных помощников', () => {
        if (summonSkills.length < 2) return;
        const a = createCompanion(summonSkills[0].owner, summonSkills[0].skill.companion);
        const b = createCompanion(summonSkills[1].owner, summonSkills[1].skill.companion);
        expect(a.id).not.toBe(b.id);
    });
});

describe('адресация лечения', () => {
    it('healTarget указан корректно там, где он есть', () => {
        allCharacters.forEach(char => {
            char.skills.filter(s => s.type === 'heal').forEach(skill => {
                if (skill.healTarget !== undefined) {
                    expect(['self', 'ally'], `${char.name} / ${skill.name}`).toContain(skill.healTarget);
                }
            });
        });
    });

    it('массовое лечение не бывает "только себе" — это противоречивая пара флагов', () => {
        allCharacters.forEach(char => {
            char.skills.filter(s => s.type === 'heal' && s.aoe).forEach(skill => {
                expect(skill.healTarget, `${char.name} / ${skill.name}`).not.toBe('self');
            });
        });
    });
});

describe('скины и оружие', () => {
    it('все образы стоят одинаково — SKIN_PRICE', () => {
        expect(SKIN_PRICE).toBeGreaterThan(0);
        Object.values(skinsCatalog).flat().forEach(skin => {
            expect(skin.price, skin.name).toBe(SKIN_PRICE);
        });
    });

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
