export const passivesSystem = {
    'luck': { name: 'Удача 🍀', desc: 'Ходит раньше. 10% шанс ударить дважды!', initBonus: 50, dmgMult: 0.9, hpMult: 1, healMult: 1, incDmgMult: 1, trigger: 'double_cast', chance: 0.1 },
    'heavy': { name: 'Тяжеловес 🛡️', desc: 'Урон +20%. 10% шанс заблокировать атаку!', initBonus: -30, dmgMult: 1.2, hpMult: 1, healMult: 1, incDmgMult: 1, trigger: 'block', chance: 0.1 },
    'vitality': { name: 'Живучесть ❤️', desc: 'Здоровье +30%. 10% шанс регенерации при ударе!', initBonus: -10, dmgMult: 1, hpMult: 1.3, healMult: 1, incDmgMult: 1, trigger: 'regen', chance: 0.1 },
    'swift': { name: 'Ловкость 💨', desc: 'Инициатива +30. 15% шанс увернуться от атаки!', initBonus: 30, dmgMult: 1, hpMult: 0.9, healMult: 1, incDmgMult: 1, trigger: 'dodge', chance: 0.15 },
    'berserk': { name: 'Берсерк 💢', desc: 'Урон +30%, Получает урон +20%. 15% шанс критического удара!', initBonus: 0, dmgMult: 1.3, hpMult: 1, healMult: 1, incDmgMult: 1.2, trigger: 'crit', chance: 0.15 },
    'healer': { name: 'Знахарь 🧪', desc: 'Лечение +50%. 15% шанс критического исцеления!', initBonus: 0, dmgMult: 0.8, hpMult: 1, healMult: 1.5, incDmgMult: 1, trigger: 'crit_heal', chance: 0.15 }
};

export const baseCharacters = [
    { id: 'c1', name: 'Илья Муромец', img: 'assets/ilya.png', passive: 'vitality', hp: 150, speed: 4, price: 100, skills: [
        { name: 'Удар мечом', icon: '🗡️', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Удар щитом', icon: '🛡️', dmg: 40, type: 'attack', cooldown: 2 },
        { name: 'Клич', icon: '🗣️', dmg: -35, type: 'heal', cooldown: 3 }
    ]},
    { id: 'c2', name: 'Добрыня', img: 'assets/dobrynya.png', passive: 'heavy', hp: 130, speed: 6, price: 100, skills: [
        { name: 'Укол копьем', icon: '🔱', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Рубящий удар', icon: '⚔️', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Град ударов', icon: '🌪️', dmg: 60, type: 'attack', cooldown: 3 }
    ]},
    { id: 'c3', name: 'Алёша Попович', img: 'assets/alyosha.png', passive: 'swift', hp: 100, speed: 8, price: 100, skills: [
        { name: 'Выстрел из лука', icon: '🏹', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Двойная стрела', icon: '💘', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Отравленная стрела', icon: '🐍', dmg: 40, type: 'attack', cooldown: 3 }
    ]},
    { id: 'c4', name: 'Снегурочка', img: 'assets/snegurochka.png', passive: 'healer', hp: 110, speed: 9, price: 150, skills: [
        { name: 'Магия холода', icon: '🧊', dmg: 15, type: 'attack', cooldown: 0 },
        { name: 'Свет', icon: '✨', dmg: 35, type: 'attack', cooldown: 2 },
        { name: 'Исцеление', icon: '❄️', dmg: -55, type: 'heal', cooldown: 3 }
    ]},
    { id: 'c5', name: 'Баба Яга', img: 'assets/yaga.png', passive: 'luck', hp: 90, speed: 7, price: 150, skills: [
        { name: 'Сглаз', icon: '👁️', dmg: 20, type: 'attack', cooldown: 0 },
        { name: 'Огненный шар', icon: '☄️', dmg: 40, type: 'attack', cooldown: 2 },
        { name: 'Лечебный отвар', icon: '🍲', dmg: -45, type: 'heal', cooldown: 3 }
    ]},
    { id: 'c6', name: 'Змей Горыныч', img: 'assets/gorynych.png', passive: 'berserk', hp: 180, speed: 3, price: 300, skills: [
        { name: 'Укус', icon: '🦖', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Удар хвостом', icon: '🦎', dmg: 55, type: 'attack', cooldown: 3 },
        { name: 'Дыхание огня', icon: '🔥', dmg: 80, type: 'attack', cooldown: 4 }
    ]},
    { id: 'c7', name: 'Колобок', img: 'assets/kolobok.png', passive: 'swift', hp: 80, speed: 10, price: 50, skills: [
        { name: 'С разбегу', icon: '🏃', dmg: 20, type: 'attack', cooldown: 0 },
        { name: 'Горячий бок', icon: '🔥', dmg: 35, type: 'attack', cooldown: 2 },
        { name: 'По сусекам', icon: '🌾', dmg: -40, type: 'heal', cooldown: 3 }
    ]},
    { id: 'c8', name: 'Кощей Бессмертный', img: 'assets/koschei.png', passive: 'vitality', hp: 200, speed: 5, price: 500, skills: [
        { name: 'Удар цепью', icon: '⛓️', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Проклятие', icon: '💀', dmg: 50, type: 'attack', cooldown: 2 },
        { name: 'Вытягивание душ', icon: '👻', dmg: -65, type: 'heal', cooldown: 4 }
    ]},
    { id: 'c9', name: 'Соловей-разбойник', img: 'assets/solovey.png', passive: 'swift', hp: 110, speed: 9, price: 250, skills: [
        { name: 'Внезапный удар', icon: '🗡️', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Мертвый свист', icon: '🌪️', dmg: 50, type: 'attack', cooldown: 2 },
        { name: 'Вихрь', icon: '💨', dmg: 65, type: 'attack', cooldown: 3 }
    ]},
    { id: 'c10', name: 'Леший', img: 'assets/leshy.png', passive: 'vitality', hp: 160, speed: 4, price: 200, skills: [
        { name: 'Удар корнями', icon: '🌿', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Гнев чащи', icon: '🌲', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Лесной дух', icon: '🍄', dmg: -55, type: 'heal', cooldown: 3 }
    ]},
    { id: 'c11', name: 'Емеля', img: 'assets/emelya.png', passive: 'luck', hp: 95, speed: 7, price: 150, skills: [
        { name: 'Удар ведром', icon: '🪣', dmg: 20, type: 'attack', cooldown: 0 },
        { name: 'По щучьему веленью', icon: '🐟', dmg: 45, type: 'attack', cooldown: 2 },
        { name: 'Отдых на печи', icon: '🔥', dmg: -50, type: 'heal', cooldown: 3 }
    ]},
    { id: 'c12', name: 'Святогор', img: 'assets/svyatogor.png', passive: 'berserk', hp: 220, speed: 2, price: 400, skills: [
        { name: 'Тяжелый кулак', icon: '✊', dmg: 35, type: 'attack', cooldown: 0 },
        { name: 'Землетрясение', icon: '🌍', dmg: 60, type: 'attack', cooldown: 3 },
        { name: 'Сокрушительный гнев', icon: '💥', dmg: 85, type: 'attack', cooldown: 4 }
    ]},
    { id: 'c13', name: 'Василиса Премудрая', img: 'assets/vasilisa.png', passive: 'healer', hp: 110, speed: 8, price: 250, skills: [
        { name: 'Магический свет', icon: '✨', dmg: 20, type: 'attack', cooldown: 0 },
        { name: 'Живая вода', icon: '💧', dmg: -60, type: 'heal', cooldown: 2 },
        { name: 'Лунная пыльца', icon: '🌙', dmg: -75, type: 'heal', cooldown: 4 }
    ]}
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
    
    // Подтягиваем триггеры для боевки
    hero.passiveTrigger = p.trigger;
    hero.passiveChance = p.chance;

    hero.currentCooldowns = {};
    hero.skills.forEach(s => hero.currentCooldowns[s.name] = 0);
    
    return hero;
}