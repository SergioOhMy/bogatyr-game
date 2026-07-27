// promocodes.js — промокоды и герои, которые выдаются только по ним.
//
// specialCharacters НЕ входит в baseCharacters (characters.js), поэтому такие
// герои никогда не появляются в магазине, при создании профиля или у ботов —
// получить их можно только вводом правильного промокода, и то одноразово.
//
// Как добавить новый промокод:
//   1) Добавь героя в specialCharacters (форма ровно как в characters.js:
//      id/name/img/passive/race/hp/speed/price/skills/vfx). price можно
//      оставить 0 - в магазине он всё равно не показывается.
//   2) Добавь запись в promoCodes: { 'СЛОВО': { heroId: 'id_героя', heroName: 'Имя' } }.
//   3) Код регистронезависим (сравнение идёт по .toUpperCase()).

export const specialCharacters = [
    {
        id: 'volkolak', name: 'Волколак', img: 'assets/volkolak.png',
        passive: 'berserk', race: 'beast', hp: 150, speed: 6, price: 0,
        promoOnly: true,
        skills: [
            { name: 'Коготь', icon: '🐾', dmg: 30, type: 'attack', cooldown: 0 },
            { name: 'Волчий укус', icon: '🩸', dmg: 55, type: 'attack', cooldown: 2 },
            { name: 'Волчья регенерация', icon: '🌙', dmg: -45, type: 'heal', cooldown: 3 },
            { name: 'Полнолуние', icon: '🌕', dmg: 100, type: 'attack', cooldown: 5, isUltimate: true }
        ],
        vfx: { color: '#7f5aa8', particle: '🌕' }
    }
];

export const promoCodes = {
    'ВОЛКОЛАК': { heroId: 'volkolak', heroName: 'Волколак' }
};

export function getSpecialCharacterById(id) {
    return specialCharacters.find(c => c.id === id) || null;
}
