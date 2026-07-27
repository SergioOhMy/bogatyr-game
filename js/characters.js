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
        { name: 'Удар мечом', icon: '🗡️', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Удар щитом', icon: '🛡️', dmg: 40, type: 'attack', cooldown: 2 },
        { name: 'Клич', icon: '🗣️', dmg: -35, type: 'heal', cooldown: 3 },
        { name: 'Богатырский гнев', icon: '💪', dmg: 90, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#c0392b', particle: '💥' } },

    { id: 'c2', name: 'Добрыня', img: 'assets/dobrynya.png', passive: 'heavy', race: 'human', hp: 130, speed: 6, price: 100, skills: [
        { name: 'Укол копьем', icon: '🔱', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Рубящий удар', icon: '⚔️', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Град ударов', icon: '🌪️', dmg: 60, type: 'attack', cooldown: 3 },
        { name: 'Сокрушающий вихрь', icon: '🌀', dmg: 95, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#7f8c8d', particle: '🌪️' } },

    { id: 'c3', name: 'Алёша Попович', img: 'assets/alyosha.png', passive: 'swift', race: 'human', hp: 120, speed: 8, price: 100, skills: [
        { name: 'Выстрел из лука', icon: '🏹', dmg: 29, type: 'attack', cooldown: 0 },
        { name: 'Двойная стрела', icon: '💘', dmg: 50, type: 'attack', cooldown: 2 },
        { name: 'Отравленная стрела', icon: '🐍', dmg: 32, type: 'attack', cooldown: 3, dot: { type: 'poison', amountPercent: 0.06, turns: 3 } },
        { name: 'Залп из трёх стрел', icon: '🎯', dmg: 90, type: 'attack', cooldown: 4, isUltimate: true }
    ], vfx: { color: '#f39c12', particle: '🎯' } },

    { id: 'c4', name: 'Снегурочка', img: 'assets/snegurochka.png', passive: 'healer', race: 'spirit', hp: 172, speed: 9, price: 150, skills: [
        { name: 'Магия холода', icon: '🧊', dmg: 20, type: 'attack', cooldown: 0 },
        { name: 'Свет', icon: '✨', dmg: 40, type: 'attack', cooldown: 2 },
        { name: 'Исцеление', icon: '❄️', dmg: -65, type: 'heal', cooldown: 3 },
        { name: 'Вечная зима', icon: '❄️', dmg: -110, type: 'heal', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#5dade2', particle: '❄️' } },

    { id: 'c5', name: 'Баба Яга', img: 'assets/yaga.png', passive: 'luck', race: 'spirit', hp: 110, speed: 7, price: 150, skills: [
        { name: 'Сглаз', icon: '👁️', dmg: 23, type: 'attack', cooldown: 0 },
        { name: 'Огненный шар', icon: '☄️', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Лечебный отвар', icon: '🍲', dmg: -52, type: 'heal', cooldown: 3 },
        { name: 'Проклятие судьбы', icon: '🔮', dmg: 94, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#8e44ad', particle: '🔮' } },

    { id: 'c6', name: 'Змей Горыныч', img: 'assets/gorynych.png', passive: 'berserk', race: 'beast', hp: 140, speed: 3, price: 300, skills: [
        { name: 'Укус', icon: '🦖', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Удар хвостом', icon: '🦎', dmg: 55, type: 'attack', cooldown: 3 },
        { name: 'Дыхание огня', icon: '🔥', dmg: 52, type: 'attack', cooldown: 4, dot: { type: 'burn', amountPercent: 0.05, turns: 2 } },
        { name: 'Тройное пламя', icon: '🐉', dmg: 80, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#e74c3c', particle: '🔥' } },

    { id: 'c7', name: 'Колобок', img: 'assets/kolobok.png', passive: 'swift', race: 'spirit', hp: 105, speed: 10, price: 50, skills: [
        { name: 'С разбегу', icon: '🏃', dmg: 26, type: 'attack', cooldown: 0 },
        { name: 'Горячий бок', icon: '🔥', dmg: 42, type: 'attack', cooldown: 2 },
        { name: 'По сусекам', icon: '🌾', dmg: -46, type: 'heal', cooldown: 3 },
        { name: 'Укатился и вернулся', icon: '🌀', dmg: 76, type: 'attack', cooldown: 4, isUltimate: true }
    ], vfx: { color: '#d4a017', particle: '🍞' } },

    { id: 'c8', name: 'Кощей Бессмертный', img: 'assets/koschei.png', passive: 'vitality', race: 'undead', hp: 145, speed: 5, price: 500, skills: [
        { name: 'Удар цепью', icon: '⛓️', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Проклятие', icon: '💀', dmg: 50, type: 'attack', cooldown: 2 },
        { name: 'Вытягивание душ', icon: '👻', dmg: -65, type: 'heal', cooldown: 4 },
        { name: 'Смерть в игле', icon: '🪡', dmg: 74, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#34495e', particle: '💀' } },

    { id: 'c9', name: 'Соловей-разбойник', img: 'assets/solovey.png', passive: 'swift', race: 'beast', hp: 110, speed: 9, price: 250, skills: [
        { name: 'Внезапный удар', icon: '🗡️', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Мертвый свист', icon: '🌪️', dmg: 50, type: 'attack', cooldown: 2 },
        { name: 'Вихрь', icon: '💨', dmg: 65, type: 'attack', cooldown: 3 },
        { name: 'Смертоносный свист', icon: '📯', dmg: 95, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#95a5a6', particle: '💨' } },

    { id: 'c10', name: 'Леший', img: 'assets/leshy.png', passive: 'vitality', race: 'spirit', hp: 160, speed: 4, price: 200, skills: [
        { name: 'Удар корнями', icon: '🌿', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Гнев чащи', icon: '🌲', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Лесной дух', icon: '🍄', dmg: -55, type: 'heal', cooldown: 3 },
        { name: 'Зов чащи', icon: '🌲', dmg: 90, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#27ae60', particle: '🍃' } },

    { id: 'c11', name: 'Емеля', img: 'assets/emelya.png', passive: 'luck', race: 'human', hp: 115, speed: 7, price: 150, skills: [
        { name: 'Удар ведром', icon: '🪣', dmg: 22, type: 'attack', cooldown: 0 },
        { name: 'По щучьему веленью', icon: '🐟', dmg: 48, type: 'attack', cooldown: 2 },
        { name: 'Отдых на печи', icon: '🔥', dmg: -56, type: 'heal', cooldown: 3 },
        { name: 'Щучье чудо', icon: '⭐', dmg: 94, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#f1c40f', particle: '⭐' } },

    { id: 'c12', name: 'Святогор', img: 'assets/svyatogor.png', passive: 'berserk', race: 'human', hp: 170, speed: 2, price: 400, skills: [
        { name: 'Тяжелый кулак', icon: '✊', dmg: 35, type: 'attack', cooldown: 0 },
        { name: 'Землетрясение', icon: '🌍', dmg: 60, type: 'attack', cooldown: 3 },
        { name: 'Сокрушительный гнев', icon: '💥', dmg: 68, type: 'attack', cooldown: 4 },
        { name: 'Гнев исполина', icon: '⚡', dmg: 88, type: 'attack', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#e67e22', particle: '⚡' } },

    { id: 'c13', name: 'Василиса Премудрая', img: 'assets/vasilisa.png', passive: 'healer', race: 'spirit', hp: 145, speed: 8, price: 250, skills: [
        { name: 'Магический свет', icon: '✨', dmg: 26, type: 'attack', cooldown: 0 },
        { name: 'Живая вода', icon: '💧', dmg: -72, type: 'heal', cooldown: 2 },
        { name: 'Лунная пыльца', icon: '🌙', dmg: -88, type: 'heal', cooldown: 4 },
        { name: 'Дар бессмертия', icon: '🕊️', dmg: -122, type: 'heal', cooldown: 5, isUltimate: true }
    ], vfx: { color: '#1abc9c', particle: '🕊️' } },

    { id: 'c14', name: 'Жар-птица', img: 'assets/zharptica.png', passive: 'swift', race: 'spirit', hp: 132, speed: 9, price: 300, skills: [
        { name: 'Огненное перо', icon: '🪶', dmg: 33, type: 'attack', cooldown: 0 },
        { name: 'Вспышка света', icon: '✨', dmg: 55, type: 'attack', cooldown: 2 },
        { name: 'Огненный смерч', icon: '🔥', dmg: -50, type: 'heal', cooldown: 3 },
        { name: 'Испепеляющий полёт', icon: '🐦‍🔥', dmg: 55, type: 'attack', cooldown: 5, isUltimate: true, aoe: true }
    ], vfx: { color: '#e67e22', particle: '🔥' } },

    { id: 'c15', name: 'Берегиня', img: 'assets/beregina.png', passive: 'healer', race: 'spirit', hp: 150, speed: 7, price: 300, skills: [
        { name: 'Прикосновение рощи', icon: '🌸', dmg: 24, type: 'attack', cooldown: 0 },
        { name: 'Целебный родник', icon: '💧', dmg: -72, type: 'heal', cooldown: 2 },
        { name: 'Зов природы', icon: '🌿', dmg: -60, type: 'heal', cooldown: 3 },
        { name: 'Благословение рощи', icon: '🌳', dmg: -70, type: 'heal', cooldown: 5, isUltimate: true, aoe: true }
    ], vfx: { color: '#2ecc71', particle: '🌸' } }
];

export function initHeroStats(char, isBot) {
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

    hero.currentCooldowns = {};
    hero.skills.forEach((s, idx) => {
        hero.currentCooldowns[s.name] = 0;
        // Прогрессия открытия умений (v1.02): 1-й навык открыт сразу,
        // каждый следующий требует на 1 собственный ход бойца больше,
        // ультимативное умение (всегда последним в списке) открывается
        // только на 4-й ход владельца ("через три хода").
        s.unlockTurn = idx + 1;
    });
    hero.turnsTaken = 0;
    hero.statusEffects = []; // яд/ожог и т.п. - см. engine.js -> applyStatusEffects

    return hero;
}
