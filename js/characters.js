export const passivesSystem = {
    'luck': { name: 'Удача 🍀', desc: 'Ходит раньше, Урон -10%', initBonus: 50, dmgMult: 0.9, hpMult: 1, healMult: 1, incDmgMult: 1 },
    'heavy': { name: 'Тяжеловес 🛡️', desc: 'Урон +20%, Ходит позже', initBonus: -30, dmgMult: 1.2, hpMult: 1, healMult: 1, incDmgMult: 1 },
    'vitality': { name: 'Живучесть ❤️', desc: 'Здоровье +30%, Инициатива -10', initBonus: -10, dmgMult: 1, hpMult: 1.3, healMult: 1, incDmgMult: 1 },
    'swift': { name: 'Ловкость 💨', desc: 'Инициатива +30, Здоровье -10%', initBonus: 30, dmgMult: 1, hpMult: 0.9, healMult: 1, incDmgMult: 1 },
    'berserk': { name: 'Берсерк 💢', desc: 'Урон +30%, Получает урон +20%', initBonus: 0, dmgMult: 1.3, hpMult: 1, healMult: 1, incDmgMult: 1.2 },
    'healer': { name: 'Знахарь 🧪', desc: 'Эффект лечения +50%, Урон -20%', initBonus: 0, dmgMult: 0.8, hpMult: 1, healMult: 1.5, incDmgMult: 1 }
};

export const baseCharacters = [
    { id: 'c1', name: 'Илья Муромец', img: 'assets/ilya.png', passive: 'vitality', hp: 150, speed: 4, skills: [
        { name: 'Удар мечом', icon: '🗡️', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Удар щитом', icon: '🛡️', dmg: 45, type: 'attack', cooldown: 1 },
        { name: 'Клич', icon: '🗣️', dmg: -40, type: 'heal', cooldown: 2 }
    ]},
    { id: 'c2', name: 'Добрыня', img: 'assets/dobrynya.png', passive: 'heavy', hp: 130, speed: 6, skills: [
        { name: 'Укол копьем', icon: '🔱', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Рубящий удар', icon: '⚔️', dmg: 45, type: 'attack', cooldown: 1 },
        { name: 'Град ударов', icon: '🌪️', dmg: 65, type: 'attack', cooldown: 2 }
    ]},
    { id: 'c3', name: 'Алёша Попович', img: 'assets/alyosha.png', passive: 'swift', hp: 100, speed: 8, skills: [
        { name: 'Выстрел из лука', icon: '🏹', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Двойная стрела', icon: '💘', dmg: 50, type: 'attack', cooldown: 1 },
        { name: 'Отравленная стрела', icon: '🐍', dmg: 40, type: 'attack', cooldown: 1 }
    ]},
    { id: 'c4', name: 'Снегурочка', img: 'assets/snegurochka.png', passive: 'healer', hp: 110, speed: 9, skills: [
        { name: 'Магия холода', icon: '🧊', dmg: 20, type: 'attack', cooldown: 0 },
        { name: 'Свет', icon: '✨', dmg: 40, type: 'attack', cooldown: 1 },
        { name: 'Исцеление', icon: '❄️', dmg: -60, type: 'heal', cooldown: 2 }
    ]},
    { id: 'c5', name: 'Баба Яга', img: 'assets/yaga.png', passive: 'luck', hp: 90, speed: 7, skills: [
        { name: 'Сглаз', icon: '👁️', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Огненный шар', icon: '☄️', dmg: 45, type: 'attack', cooldown: 1 },
        { name: 'Лечебный отвар', icon: '🍲', dmg: -50, type: 'heal', cooldown: 2 }
    ]},
    { id: 'c6', name: 'Змей Горыныч', img: 'assets/gorynych.png', passive: 'berserk', hp: 180, speed: 3, skills: [
        { name: 'Укус', icon: '🦖', dmg: 30, type: 'attack', cooldown: 0 },
        { name: 'Удар хвостом', icon: '🦎', dmg: 50, type: 'attack', cooldown: 1 },
        { name: 'Дыхание огня', icon: '🔥', dmg: 75, type: 'attack', cooldown: 3 }
    ]},
    { id: 'c7', name: 'Колобок', img: 'assets/kolobok.png', passive: 'swift', hp: 80, speed: 10, skills: [
        { name: 'С разбегу', icon: '🏃', dmg: 25, type: 'attack', cooldown: 0 },
        { name: 'Горячий бок', icon: '🔥', dmg: 40, type: 'attack', cooldown: 1 },
        { name: 'По сусекам', icon: '🌾', dmg: -45, type: 'heal', cooldown: 2 }
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

    hero.currentCooldowns = {};
    hero.skills.forEach(s => hero.currentCooldowns[s.name] = 0);
    
    return hero;
}