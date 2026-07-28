// characters.js — данные персонажей.
//
// Что добавлено к исходной версии:
//  - passivesSystem: у каждой пассивки теперь есть `fx` — имя CSS-класса
//    анимации, которая проигрывается при её срабатывании (см. css/style.css
//    и js/ui.js -> playPassiveFx).
//  - race: раса персонажа (human / undead / spirit / beast) — используется
//    модификаторами арен (js/arenas.js).
//  - У каждого героя в конце списка навыков — персональное "ультимативное"
//    умение (isUltimate: true) с большим кулдауном и полем vfx (цвет + эмодзи
//    частицы), которое отрисовывается уникальным всплеском именно для этого
//    героя (js/ui.js -> playUltimateFx). Так каждый герой получает свою
//    "фирменную" анимацию, не потребовав 13 отдельных наборов @keyframes.

import { getWeaponById, applyWeaponEffect } from './items.js';

export const passivesSystem = {
    'luck':     { name: 'Удача 🍀',     desc: 'Ходит раньше. 10% шанс ударить дважды!',              initBonus: 50,  dmgMult: 0.9, hpMult: 1,   healMult: 1,   incDmgMult: 1,   trigger: 'double_cast', chance: 0.10, fx: 'fx-doublecast' },
    'heavy':    { name: 'Тяжеловес 🛡️', desc: 'Урон +20%. 10% шанс заблокировать атаку!',            initBonus: -30, dmgMult: 1.2, hpMult: 1,   healMult: 1,   incDmgMult: 1,   trigger: 'block',       chance: 0.10, fx: 'fx-block' },
    'vitality': { name: 'Живучесть ❤️', desc: 'Здоровье +30%. 10% шанс регенерации при ударе!',      initBonus: -10, dmgMult: 1,   hpMult: 1.3, healMult: 1,   incDmgMult: 1,   trigger: 'regen',       chance: 0.10, fx: 'fx-regen' },
    'swift':    { name: 'Ловкость 💨',  desc: 'Инициатива +30. 15% шанс увернуться от атаки!',       initBonus: 30,  dmgMult: 1,   hpMult: 0.9, healMult: 1,   incDmgMult: 1,   trigger: 'dodge',       chance: 0.15, fx: 'fx-dodge' },
    'berserk':  { name: 'Берсерк 💢',   desc: 'Урон +30%, получает урон +20%. 15% шанс крит. удара!', initBonus: 0,   dmgMult: 1.3, hpMult: 1,   healMult: 1,   incDmgMult: 1.2, trigger: 'crit',        chance: 0.15, fx: 'fx-crit' },
    'healer':   { name: 'Знахарь 🧪',   desc: 'Лечение +50%. 15% шанс критического исцеления!',      initBonus: 0,   dmgMult: 0.8, hpMult: 1,   healMult: 1.5, incDmgMult: 1,   trigger: 'crit_heal',   chance: 0.15, fx: 'fx-critheal' }
};

export const baseCharacters = [
    { id: 'c1', name: 'Илья Муромец', img: 'assets/ilya.png', passive: 'vitality', race: 'human', hp: 150, speed: 4, price: 100, skills: [
        { name: 'Удар мечом', icon: '🗡️', dmg: 22, type: 'attack', cooldown: 0 },
        { name: 'Несокрушимость', icon: '🛡️', type: 'buff', cooldown: 3, desc: 'Себе: -20% получаемого урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'defBuff', value: -0.20, turns: 2, dispellable: true }] },
        { name: 'Клич', icon: '🗣️', dmg: -35, type: 'heal', cooldown: 3 },
        { name: 'Богатырский гнев', icon: '💪', dmg: 80, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#c0392b', particle: '💥' } },

    { id: 'c2', name: 'Добрыня', img: 'assets/dobrynya.png', passive: 'heavy', race: 'human', hp: 130, speed: 6, price: 100, skills: [
        { name: 'Укол копьем', icon: '🔱', dmg: 22, type: 'attack', cooldown: 0 },
        { name: 'Стена щитов', icon: '🛡️', type: 'buff', cooldown: 3, desc: 'Дружине: -7% получаемого урона на 2 хода', buffTarget: 'ally', aoe: true, effects: [{ stat: 'defBuff', value: -0.07, turns: 2, dispellable: true }] },
        { name: 'Град ударов', icon: '🌪️', dmg: 52, type: 'attack', cooldown: 3 },
        { name: 'Сокрушающий вихрь', icon: '🌀', dmg: 85, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#7f8c8d', particle: '🌪️' } },

    { id: 'c3', name: 'Алёша Попович', img: 'assets/alyosha.png', passive: 'swift', race: 'human', hp: 120, speed: 8, price: 100, skills: [
        { name: 'Выстрел из лука', icon: '🏹', dmg: 34, type: 'attack', cooldown: 0 },
        { name: 'Меткий глаз', icon: '🎯', type: 'buff', cooldown: 2, desc: 'Себе: +50% урона на 1 ход', buffTarget: 'self', effects: [{ stat: 'dmgBuff', value: 0.50, turns: 1, dispellable: true }] },
        { name: 'Отравленная стрела', icon: '🐍', dmg: 38, type: 'attack', cooldown: 3, dot: { type: 'poison', amountPercent: 0.06, turns: 3 } },
        { name: 'Залп из трёх стрел', icon: '🎯', dmg: 100, type: 'attack', cooldown: 4, isUltimate: true }
    ], vfx: { color: '#f39c12', particle: '🎯' } },

    { id: 'c4', name: 'Снегурочка', img: 'assets/snegurochka.png', passive: 'healer', race: 'spirit', hp: 172, speed: 9, price: 150, skills: [
        { name: 'Магия холода', icon: '🧊', dmg: 28, type: 'attack', cooldown: 0 },
        { name: 'Ледяные оковы', icon: '❄️', type: 'buff', cooldown: 3, desc: 'Врагу: -25% урона на 2 хода', buffTarget: 'enemy', effects: [{ stat: 'dmgBuff', value: -0.25, turns: 2, dispellable: true }] },
        { name: 'Исцеление', icon: '❄️', dmg: -75, type: 'heal', cooldown: 3 },
        { name: 'Вечная зима', icon: '❄️', dmg: -125, type: 'heal', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#5dade2', particle: '❄️' } },

    { id: 'c5', name: 'Баба Яга', img: 'assets/yaga.png', passive: 'luck', race: 'spirit', hp: 120, speed: 7, price: 150, skills: [
        { name: 'Сглаз', icon: '👁️', dmg: 36, type: 'attack', cooldown: 0 },
        { name: 'Снять чары', icon: '🔮', type: 'dispel', cooldown: 3, desc: 'Снимает бафы со всех врагов', dispelTarget: 'enemy', aoe: true },
        { name: 'Лечебный отвар', icon: '🍲', dmg: -60, type: 'heal', cooldown: 3 },
        { name: 'Проклятие судьбы', icon: '🔮', dmg: 105, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#8e44ad', particle: '🔮' } },

    { id: 'c6', name: 'Змей Горыныч', img: 'assets/gorynych.png', passive: 'berserk', race: 'beast', hp: 140, speed: 3, price: 300, skills: [
        { name: 'Укус', icon: '🦖', dmg: 27, type: 'attack', cooldown: 0 },
        { name: 'Огненный щит', icon: '🔥', type: 'buff', cooldown: 3, desc: 'Дружине: -18% получаемого урона на 1 ход', buffTarget: 'ally', aoe: true, effects: [{ stat: 'defBuff', value: -0.18, turns: 1, dispellable: true }] },
        { name: 'Дыхание огня', icon: '🔥', dmg: 52, type: 'attack', cooldown: 4, dot: { type: 'burn', amountPercent: 0.05, turns: 2 } },
        { name: 'Тройное пламя', icon: '🐉', dmg: 72, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#e74c3c', particle: '🔥' } },

    { id: 'c7', name: 'Колобок', img: 'assets/kolobok.png', passive: 'swift', race: 'spirit', hp: 115, speed: 10, price: 50, skills: [
        { name: 'С разбегу', icon: '🏃', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Неуловимость', icon: '💨', type: 'buff', cooldown: 3, desc: 'Себе: +90% к шансу уворота на 1 ход', buffTarget: 'self', effects: [{ stat: 'evasive', value: 0.90, turns: 1, dispellable: true }] },
        { name: 'По сусекам', icon: '🌾', dmg: -46, type: 'heal', cooldown: 3 },
        { name: 'Укатился и вернулся', icon: '🌀', dmg: 85, type: 'attack', cooldown: 4, isUltimate: true }
    ], vfx: { color: '#d4a017', particle: '🍞' } },

    { id: 'c8', name: 'Кощей Бессмертный', img: 'assets/koschei.png', passive: 'vitality', race: 'undead', hp: 145, speed: 5, price: 500, skills: [
        { name: 'Удар цепью', icon: '⛓️', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Поднять скелета', icon: '💀', type: 'summon', cooldown: 5, desc: 'Призывает скелета: пока он с вами, каждый ваш ход он бьёт слабейшего врага', companion: { label: 'Скелет', procDmg: 9, procHeal: 26, icon: '💀', color: '#7f8c8d' } },
        { name: 'Вытягивание душ', icon: '👻', dmg: -65, type: 'heal', cooldown: 4 },
        { name: 'Смерть в игле', icon: '🪡', dmg: 74, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#34495e', particle: '💀' } },

    { id: 'c9', name: 'Соловей-разбойник', img: 'assets/solovey.png', passive: 'swift', race: 'beast', hp: 110, speed: 9, price: 250, skills: [
        { name: 'Внезапный удар', icon: '🗡️', dmg: 32, type: 'attack', cooldown: 0 },
        { name: 'Очищающий свист', icon: '🌬️', type: 'dispel', cooldown: 3, desc: 'Снимает дебафы со всей дружины', dispelTarget: 'ally', aoe: true },
        { name: 'Вихрь', icon: '💨', dmg: 75, type: 'attack', cooldown: 3 },
        { name: 'Смертоносный свист', icon: '📯', dmg: 110, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#95a5a6', particle: '💨' } },

    { id: 'c10', name: 'Леший', img: 'assets/leshy.png', passive: 'vitality', race: 'spirit', hp: 160, speed: 4, price: 200, skills: [
        { name: 'Удар корнями', icon: '🌿', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Позвать медведя', icon: '🐻', type: 'summon', cooldown: 5, desc: 'Призывает медведя: пока он с вами, каждый ваш ход он бьёт слабейшего врага', companion: { label: 'Медведь', procDmg: 7, procHeal: 26, icon: '🐻', color: '#6b4226' } },
        { name: 'Лесной дух', icon: '🍄', dmg: -55, type: 'heal', cooldown: 3 },
        { name: 'Зов чащи', icon: '🌲', dmg: 90, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#27ae60', particle: '🍃' } },

    { id: 'c11', name: 'Емеля', img: 'assets/emelya.png', passive: 'luck', race: 'human', hp: 115, speed: 7, price: 150, skills: [
        { name: 'Удар ведром', icon: '🪣', dmg: 22, type: 'attack', cooldown: 0 },
        { name: 'Шапка-невидимка', icon: '🎩', type: 'buff', cooldown: 3, desc: 'Себе: +60% к шансу уворота на 1 ход (невидимка)', buffTarget: 'self', effects: [{ stat: 'evasive', value: 0.60, turns: 1, dispellable: true }] },
        { name: 'Отдых на печи', icon: '🔥', dmg: -64, type: 'heal', cooldown: 3 },
        { name: 'Щучье чудо', icon: '⭐', dmg: 102, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#f1c40f', particle: '⭐' } },

    { id: 'c12', name: 'Святогор', img: 'assets/svyatogor.png', passive: 'berserk', race: 'human', hp: 170, speed: 2, price: 400, skills: [
        { name: 'Тяжелый кулак', icon: '✊', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Каменная кожа', icon: '🗿', type: 'buff', cooldown: 3, desc: 'Себе: -14% получаемого урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'defBuff', value: -0.14, turns: 2, dispellable: true }] },
        { name: 'Сокрушительный гнев', icon: '💥', dmg: 68, type: 'attack', cooldown: 4 },
        { name: 'Несокрушимость исполина', icon: '⚡', type: 'buff', cooldown: 5, isUltimate: true, desc: 'Себе: -35% получаемого урона на 2 хода (снять могут только дебаферы-«разрушители бафов»)', buffTarget: 'self', effects: [{ stat: 'defBuff', value: -0.35, turns: 2, dispellable: true }] }
    ], vfx: { color: '#e67e22', particle: '⚡' } },

    { id: 'c13', name: 'Василиса Премудрая', img: 'assets/vasilisa.png', passive: 'healer', race: 'spirit', hp: 160, speed: 8, price: 250, skills: [
        { name: 'Магический свет', icon: '✨', dmg: 32, type: 'attack', cooldown: 0 },
        { name: 'Ослепление красотой', icon: '😍', type: 'buff', cooldown: 3, desc: 'Врагу: +35% к шансу промаха на 2 хода', buffTarget: 'enemy', effects: [{ stat: 'blind', value: 0.35, turns: 2, dispellable: true }] },
        { name: 'Лунная пыльца', icon: '🌙', dmg: -100, type: 'heal', cooldown: 4 },
        { name: 'Дар бессмертия', icon: '🕊️', dmg: -135, type: 'heal', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#1abc9c', particle: '🕊️' } },

    { id: 'c14', name: 'Жар-птица', img: 'assets/zharptica.png', passive: 'swift', race: 'spirit', hp: 132, speed: 9, price: 300, skills: [
        { name: 'Огненное перо', icon: '🪶', dmg: 38, type: 'attack', cooldown: 0 },
        { name: 'Огненный оберег', icon: '🪶', type: 'buff', cooldown: 3, desc: 'Себе: +30% урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'dmgBuff', value: 0.30, turns: 2, dispellable: true }] },
        { name: 'Огненный смерч', icon: '🔥', dmg: -50, type: 'heal', cooldown: 3 },
        { name: 'Испепеляющий полёт', icon: '🐦‍🔥', dmg: 62, type: 'attack', cooldown: 5, isUltimate: true, aoe: true }
    ], vfx: { color: '#e67e22', particle: '🔥' } },

    { id: 'c15', name: 'Берегиня', img: 'assets/beregina.png', passive: 'healer', race: 'spirit', hp: 150, speed: 7, price: 300, skills: [
        { name: 'Прикосновение рощи', icon: '🌸', dmg: 24, type: 'attack', cooldown: 0 },
        { name: 'Природная защита', icon: '🌳', type: 'buff', cooldown: 3, desc: 'Дружине: -20% получаемого урона на 2 хода', buffTarget: 'ally', aoe: true, effects: [{ stat: 'defBuff', value: -0.20, turns: 2, dispellable: true }] },
        { name: 'Зов природы', icon: '🌿', dmg: -60, type: 'heal', cooldown: 3 },
        { name: 'Благословение рощи', icon: '🌳', dmg: -80, type: 'heal', cooldown: 5, isUltimate: true, aoe: true }
    ], vfx: { color: '#2ecc71', particle: '🌸' } }
];

export function initHeroStats(char, isBot, weaponId = null) {
    const hero = JSON.parse(JSON.stringify(char));
    const p = passivesSystem[hero.passive];
    hero.isBot = isBot;

    hero.maxHp = Math.round(hero.hp * p.hpMult);
    hero.hp = hero.maxHp;
    hero.initiativeScore = (hero.speed * 10) + p.initBonus;

    hero.dmgMult = p.dmgMult;
    hero.healMult = p.healMult;
    hero.incDmgMult = p.incDmgMult;
    hero.passiveName = p.name;
    hero.passiveDesc = p.desc;

    hero.passiveTrigger = p.trigger;
    hero.passiveChance = p.chance;
    hero.passiveFx = p.fx;

    if (weaponId) {
        const weapon = getWeaponById(weaponId);
        applyWeaponEffect(hero, weapon);
    }

    hero.currentCooldowns = {};
    const unlockSchedule = [1, 1, 2, 4]; // v1.03: 1-е и 2-е умения открыты сразу, 3-е - со 2-го хода, ульта - с 4-го
    hero.skills.forEach((s, idx) => {
        hero.currentCooldowns[s.name] = 0;
        s.unlockTurn = unlockSchedule[idx] ?? (idx + 1);
    });
    hero.turnsTaken = 0;
    hero.statusEffects = []; // яд/ожог и т.п. - см. engine.js -> applyStatusEffects
    hero.buffs = []; // бафы/дебафы (щиты, уворот, ослепление и т.п.) - см. engine.js

    return hero;
}
