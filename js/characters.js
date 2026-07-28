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

// Пассивки. Числа выправлены по симуляции (см. balance-report.md и
// scripts/balance-sim.js), потому что перекос сидел именно здесь и тянул
// сразу по 2-3 героя каждый:
//
//  * 'luck' раньше давал -10% урона за 10% шанс ударить дважды. Математически
//    это чистый убыток (0.9 × 1.10 ≈ 0.99), а бонус к инициативе почти ничего
//    не решает — оба героя с этой пассивкой (Емеля, Баба Яга) сидели на дне
//    таблицы. Штраф к урону убран, шанс поднят до 12%.
//  * 'berserk' давал +30% урона за +20% получаемого, плюс 15% крита ×1.5 —
//    итого около +40% урона. Оба берсерка (Святогор, Змей Горыныч) были в
//    топ-3. Сведено к +22%/+22%.
//  * 'healer' стоил -20% урона, а лечение в бою 3на3 систематически дешевле
//    урона (лечение "в полное HP" или "в уже мёртвого" пропадает впустую) —
//    все три лекаря были в нижней половине. Штраф смягчён до -10%.
//  * 'vitality' с ×1.3 HP давал Лешему и Кощею запас, который не пробивался
//    за отведённые ходы; снижено до ×1.25.
export const passivesSystem = {
    'luck':     { name: 'Удача 🍀',     desc: 'Ходит раньше. 12% шанс ударить дважды!',              initBonus: 50,  dmgMult: 1,    hpMult: 1,    healMult: 1,    incDmgMult: 1,    trigger: 'double_cast', chance: 0.12, fx: 'fx-doublecast' },
    'heavy':    { name: 'Тяжеловес 🛡️', desc: 'Урон +20%. 10% шанс заблокировать атаку!',            initBonus: -30, dmgMult: 1.2,  hpMult: 1,    healMult: 1,    incDmgMult: 1,    trigger: 'block',       chance: 0.10, fx: 'fx-block' },
    'vitality': { name: 'Живучесть ❤️', desc: 'Здоровье +25%. 10% шанс регенерации при ударе!',      initBonus: -10, dmgMult: 1,    hpMult: 1.25, healMult: 1,    incDmgMult: 1,    trigger: 'regen',       chance: 0.10, fx: 'fx-regen' },
    'swift':    { name: 'Ловкость 💨',  desc: 'Инициатива +30. 16% шанс увернуться от атаки!',       initBonus: 30,  dmgMult: 1,    hpMult: 0.92, healMult: 1,    incDmgMult: 1,    trigger: 'dodge',       chance: 0.16, fx: 'fx-dodge' },
    'berserk':  { name: 'Берсерк 💢',   desc: 'Урон +22%, получает урон +22%. 15% шанс крит. удара!', initBonus: 0,   dmgMult: 1.22, hpMult: 1,    healMult: 1,    incDmgMult: 1.22, trigger: 'crit',        chance: 0.15, fx: 'fx-crit' },
    'healer':   { name: 'Знахарь 🧪',   desc: 'Лечение +45%. 15% шанс критического исцеления!',      initBonus: 0,   dmgMult: 0.9,  hpMult: 1,    healMult: 1.45, incDmgMult: 1,    trigger: 'crit_heal',   chance: 0.15, fx: 'fx-critheal' }
};

export const baseCharacters = [
    { id: 'c1', name: 'Илья Муромец', img: 'assets/ilya.png', passive: 'vitality', race: 'human', hp: 150, speed: 4, price: 100, skills: [
        { name: 'Удар мечом', icon: '🗡️', dmg: 28, type: 'attack', cooldown: 0 },
        { name: 'Несокрушимость', icon: '🛡️', type: 'buff', cooldown: 3, desc: 'Себе: -20% получаемого урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'defBuff', value: -0.20, turns: 2, dispellable: true }] },
        { name: 'Клич', icon: '🗣️', dmg: -46, type: 'heal', cooldown: 3 },
        { name: 'Богатырский гнев', icon: '💪', dmg: 80, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#c0392b', particle: '💥' } },

    { id: 'c2', name: 'Добрыня', img: 'assets/dobrynya.png', passive: 'heavy', race: 'human', hp: 130, speed: 6, price: 100, skills: [
        { name: 'Укол копьем', icon: '🔱', dmg: 22, type: 'attack', cooldown: 0 },
        { name: 'Стена щитов', icon: '🛡️', type: 'buff', cooldown: 3, desc: 'Дружине: -7% получаемого урона на 2 хода', buffTarget: 'ally', aoe: true, effects: [{ stat: 'defBuff', value: -0.07, turns: 2, dispellable: true }] },
        { name: 'Град ударов', icon: '🌪️', dmg: 47, type: 'attack', cooldown: 3 },
        { name: 'Сокрушающий вихрь', icon: '🌀', dmg: 85, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#7f8c8d', particle: '🌪️' } },

    { id: 'c3', name: 'Алёша Попович', img: 'assets/alyosha.png', passive: 'swift', race: 'human', hp: 122, speed: 8, price: 120, skills: [
        { name: 'Выстрел из лука', icon: '🏹', dmg: 33, type: 'attack', cooldown: 0 },
        // turns: 2, а не 1 — иначе баф не действует НИКОГДА. Бафы тикают в
        // начале хода своего носителя: наложенный на ходу N баф с turns: 1
        // списывается ровно в начале хода N+1, до того как герой успеет
        // ударить. Для защитных самобафов (уворот у Емели и Колобка) это
        // нормально — они работают в промежутке, пока бьют враги. А вот
        // "+50% урона" в старом виде не применился ни к одной атаке за всю
        // историю игры. То же было у Волколака (см. promocodes.js).
        { name: 'Меткий глаз', icon: '🎯', type: 'buff', cooldown: 3, desc: 'Себе: +50% урона на следующую атаку', buffTarget: 'self', effects: [{ stat: 'dmgBuff', value: 0.50, turns: 2, dispellable: true }] },
        { name: 'Отравленная стрела', icon: '🐍', dmg: 36, type: 'attack', cooldown: 3, dot: { type: 'poison', amountPercent: 0.06, turns: 3 } },
        { name: 'Залп из трёх стрел', icon: '🎯', dmg: 94, type: 'attack', cooldown: 4, isUltimate: true }
    ], vfx: { color: '#f39c12', particle: '🎯' } },

    { id: 'c4', name: 'Снегурочка', img: 'assets/snegurochka.png', passive: 'healer', race: 'spirit', hp: 156, speed: 9, price: 250, skills: [
        { name: 'Магия холода', icon: '🧊', dmg: 27, type: 'attack', cooldown: 0 },
        // Оглушение — единственный навык в игре, отнимающий у врага ход целиком.
        // Механика 'stun' была реализована в движке ещё в v1.03, но ей не
        // пользовался ни один герой, а из-за порядка тиков она и не сработала бы
        // (см. combat.js -> startTurn). Теперь порядок исправлен, и "оковы"
        // делают то, что написано у них в названии, вместо вялого -25% урона.
        { name: 'Ледяные оковы', icon: '❄️', type: 'buff', cooldown: 5, desc: 'Врагу: пропуск следующего хода (оглушение)', buffTarget: 'enemy', effects: [{ stat: 'stun', value: 1, turns: 1, dispellable: true }] },
        { name: 'Исцеление', icon: '❄️', dmg: -62, type: 'heal', cooldown: 3 },
        { name: 'Вечная зима', icon: '❄️', dmg: -116, type: 'heal', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#5dade2', particle: '❄️' } },

    { id: 'c5', name: 'Баба Яга', img: 'assets/yaga.png', passive: 'luck', race: 'spirit', hp: 132, speed: 7, price: 180, skills: [
        { name: 'Сглаз', icon: '👁️', dmg: 39, type: 'attack', cooldown: 0 },
        { name: 'Снять чары', icon: '🔮', type: 'dispel', cooldown: 3, desc: 'Снимает бафы со всех врагов', dispelTarget: 'enemy', aoe: true },
        { name: 'Лечебный отвар', icon: '🍲', dmg: -68, type: 'heal', cooldown: 3 },
        { name: 'Проклятие судьбы', icon: '🔮', dmg: 118, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#8e44ad', particle: '🔮' } },

    { id: 'c6', name: 'Змей Горыныч', img: 'assets/gorynych.png', passive: 'berserk', race: 'beast', hp: 140, speed: 3, price: 300, skills: [
        { name: 'Укус', icon: '🦖', dmg: 27, type: 'attack', cooldown: 0 },
        { name: 'Огненный щит', icon: '🔥', type: 'buff', cooldown: 3, desc: 'Дружине: -18% получаемого урона на 1 ход', buffTarget: 'ally', aoe: true, effects: [{ stat: 'defBuff', value: -0.18, turns: 1, dispellable: true }] },
        { name: 'Дыхание огня', icon: '🔥', dmg: 48, type: 'attack', cooldown: 4, dot: { type: 'burn', amountPercent: 0.05, turns: 2 } },
        { name: 'Тройное пламя', icon: '🐉', dmg: 78, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#e74c3c', particle: '🔥' } },

    { id: 'c7', name: 'Колобок', img: 'assets/kolobok.png', passive: 'swift', race: 'spirit', hp: 115, speed: 10, price: 50, skills: [
        { name: 'С разбегу', icon: '🏃', dmg: 33, type: 'attack', cooldown: 0 },
        { name: 'Неуловимость', icon: '💨', type: 'buff', cooldown: 3, desc: 'Себе: +90% к шансу уворота на 1 ход', buffTarget: 'self', effects: [{ stat: 'evasive', value: 0.90, turns: 1, dispellable: true }] },
        { name: 'По сусекам', icon: '🌾', dmg: -52, type: 'heal', cooldown: 3 },
        { name: 'Укатился и вернулся', icon: '🌀', dmg: 90, type: 'attack', cooldown: 4, isUltimate: true }
    ], vfx: { color: '#d4a017', particle: '🍞' } },

    { id: 'c8', name: 'Кощей Бессмертный', img: 'assets/koschei.png', passive: 'vitality', race: 'undead', hp: 145, speed: 5, price: 450, skills: [
        { name: 'Удар цепью', icon: '⛓️', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Поднять скелета', icon: '💀', type: 'summon', cooldown: 5, desc: 'Скелет бьёт слабейшего врага каждый ваш ход', companion: { label: 'Скелет', procDmg: 7, procHeal: 21, icon: '💀', color: '#7f8c8d' } },
        { name: 'Вытягивание душ', icon: '👻', dmg: -63, type: 'heal', cooldown: 4 },
        { name: 'Смерть в игле', icon: '🪡', dmg: 74, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#34495e', particle: '💀' } },

    { id: 'c9', name: 'Соловей-разбойник', img: 'assets/solovey.png', passive: 'swift', race: 'beast', hp: 110, speed: 9, price: 250, skills: [
        { name: 'Внезапный удар', icon: '🗡️', dmg: 32, type: 'attack', cooldown: 0 },
        { name: 'Очищающий свист', icon: '🌬️', type: 'dispel', cooldown: 3, desc: 'Снимает дебафы со всей дружины', dispelTarget: 'ally', aoe: true },
        { name: 'Вихрь', icon: '💨', dmg: 66, type: 'attack', cooldown: 3 },
        { name: 'Смертоносный свист', icon: '📯', dmg: 110, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#95a5a6', particle: '💨' } },

    { id: 'c10', name: 'Леший', img: 'assets/leshy.png', passive: 'vitality', race: 'spirit', hp: 150, speed: 4, price: 350, skills: [
        { name: 'Удар корнями', icon: '🌿', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Позвать медведя', icon: '🐻', type: 'summon', cooldown: 5, desc: 'Медведь бьёт слабейшего врага каждый ваш ход', companion: { label: 'Медведь', procDmg: 4, procHeal: 16, icon: '🐻', color: '#6b4226' } },
        { name: 'Лесной дух', icon: '🍄', dmg: -46, type: 'heal', cooldown: 3 },
        { name: 'Зов чащи', icon: '🌲', dmg: 90, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#27ae60', particle: '🍃' } },

    { id: 'c11', name: 'Емеля', img: 'assets/emelya.png', passive: 'luck', race: 'human', hp: 115, speed: 7, price: 150, skills: [
        { name: 'Удар ведром', icon: '🪣', dmg: 22, type: 'attack', cooldown: 0 },
        { name: 'Шапка-невидимка', icon: '🎩', type: 'buff', cooldown: 3, desc: 'Себе: +60% к шансу уворота на 1 ход (невидимка)', buffTarget: 'self', effects: [{ stat: 'evasive', value: 0.60, turns: 1, dispellable: true }] },
        { name: 'Отдых на печи', icon: '🔥', dmg: -64, type: 'heal', cooldown: 3 },
        { name: 'Щучье чудо', icon: '⭐', dmg: 102, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#f1c40f', particle: '⭐' } },

    { id: 'c12', name: 'Святогор', img: 'assets/svyatogor.png', passive: 'berserk', race: 'human', hp: 170, speed: 2, price: 320, skills: [
        { name: 'Тяжелый кулак', icon: '✊', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Каменная кожа', icon: '🗿', type: 'buff', cooldown: 3, desc: 'Себе: -14% получаемого урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'defBuff', value: -0.14, turns: 2, dispellable: true }] },
        { name: 'Сокрушительный гнев', icon: '💥', dmg: 62, type: 'attack', cooldown: 4 },
        { name: 'Несокрушимость исполина', icon: '⚡', type: 'buff', cooldown: 5, isUltimate: true, desc: 'Себе: -28% получаемого урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'defBuff', value: -0.28, turns: 2, dispellable: true }] }
    ], vfx: { color: '#e67e22', particle: '⚡' } },

    { id: 'c13', name: 'Василиса Премудрая', img: 'assets/vasilisa.png', passive: 'healer', race: 'spirit', hp: 176, speed: 8, price: 280, skills: [
        { name: 'Магический свет', icon: '✨', dmg: 42, type: 'attack', cooldown: 0 },
        { name: 'Ослепление красотой', icon: '😍', type: 'buff', cooldown: 3, desc: 'Врагу: +42% к шансу промаха на 2 хода', buffTarget: 'enemy', effects: [{ stat: 'blind', value: 0.42, turns: 2, dispellable: true }] },
        { name: 'Лунная пыльца', icon: '🌙', dmg: -115, type: 'heal', cooldown: 4 },
        { name: 'Дар бессмертия', icon: '🕊️', dmg: -145, type: 'heal', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#1abc9c', particle: '🕊️' } },

    { id: 'c14', name: 'Жар-птица', img: 'assets/zharptica.png', passive: 'swift', race: 'spirit', hp: 132, speed: 9, price: 350, skills: [
        { name: 'Огненное перо', icon: '🪶', dmg: 38, type: 'attack', cooldown: 0 },
        { name: 'Огненный оберег', icon: '🪶', type: 'buff', cooldown: 3, desc: 'Себе: +30% урона на 2 хода', buffTarget: 'self', effects: [{ stat: 'dmgBuff', value: 0.30, turns: 2, dispellable: true }] },
        { name: 'Огненный смерч', icon: '🔥', dmg: -50, type: 'heal', cooldown: 3 },
        { name: 'Испепеляющий полёт', icon: '🐦‍🔥', dmg: 58, type: 'attack', cooldown: 5, isUltimate: true, aoe: true }
    ], vfx: { color: '#e67e22', particle: '🔥' } },

    { id: 'c15', name: 'Берегиня', img: 'assets/beregina.png', passive: 'healer', race: 'spirit', hp: 158, speed: 7, price: 380, skills: [
        { name: 'Прикосновение рощи', icon: '🌸', dmg: 27, type: 'attack', cooldown: 0 },
        { name: 'Природная защита', icon: '🌳', type: 'buff', cooldown: 3, desc: 'Дружине: -20% получаемого урона на 2 хода', buffTarget: 'ally', aoe: true, effects: [{ stat: 'defBuff', value: -0.20, turns: 2, dispellable: true }] },
        { name: 'Зов природы', icon: '🌿', dmg: -66, type: 'heal', cooldown: 3 },
        { name: 'Благословение рощи', icon: '🌳', dmg: -85, type: 'heal', cooldown: 5, isUltimate: true, aoe: true }
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
