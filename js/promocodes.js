// promocodes.js — промокоды и герои, которые выдаются только по ним.
//
// v1.04: коды больше не хранятся в открытом виде. Вместо строки "ВОЛКОЛАК"
// в коде лежит её SHA-256-хэш — при вводе кода игроком мы точно так же
// хэшируем то, что он ввёл, и сравниваем хэши. Так открыв исходники (или
// вкладку "просмотр кода страницы") нельзя просто прочитать промокоды.
//
// ВАЖНО (честно, без прикрас): это НЕ настоящая защита, а препятствие для
// случайного любопытства. Игра работает полностью в браузере без сервера
// (см. README), а значит рано или поздно ЛЮБОЙ, кто откроет консоль
// разработчика и введёт код в поле, увидит, сработал он или нет - через
// достаточное количество попыток подбора (или просто попросив у друга)
// код всё равно можно узнать. Настоящая защита потребовала бы сервера,
// который проверяет код сам и не отдаёт клиенту ничего похожего на его
// хэш - то есть отдельного бэкенда, которого сейчас в проекте нет. Это
// абсолютно реализуемо технически (не требует особых мощностей - обычный
// хостинг с несколькими serverless-функциями), но это отдельная задача на
// следующее обновление, если понадобится настоящая защита.

async function sha256(text) {
    const data = new TextEncoder().encode(text.trim().toUpperCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const specialCharacters = [
    {
        id: 'volkolak', name: 'Волколак', img: 'assets/volkolak.png',
        passive: 'berserk', race: 'beast', hp: 150, speed: 6, price: 0,
        promoOnly: true,
        skills: [
            { name: 'Коготь', icon: '🐾', dmg: 30, type: 'attack', cooldown: 0 },
            // turns: 2 обязательно — с turns: 1 баф истекал раньше, чем
            // Волколак успевал ударить (подробности в characters.js у
            // "Меткого глаза" Алёши).
            { name: 'Волчий инстинкт', icon: '🐺', type: 'buff', cooldown: 3, desc: 'Себе: +40% урона на следующую атаку', buffTarget: 'self', effects: [{ stat: 'dmgBuff', value: 0.40, turns: 2, dispellable: true }] },
            { name: 'Волчья регенерация', icon: '🌙', dmg: -45, type: 'heal', cooldown: 3 },
            { name: 'Полнолуние', icon: '🌕', dmg: 100, type: 'attack', cooldown: 5, isUltimate: true }
        ],
        vfx: { color: '#7f5aa8', particle: '🌕' }
    }
];

// Хэши промокодов (см. sha256() выше). Что значит каждый:
//   'ВОЛКОЛАК'  - Волколак на 1 ближайший бой (как и раньше)
//   'ВОЛКОЛАК2' - Волколак НАВСЕГДА; после активации код 'ВОЛКОЛАК' для
//                 этого профиля больше не сработает (и наоборот, если
//                 сперва ввести 'ВОЛКОЛАК2', то временный код смысла не
//                 имеет и тоже блокируется)
//   'КЛАД5000'  - разово +5000 монет
export const promoHashes = {
    '20a6d9e0da9789af1cfc52f1d3f2065d72166c2bdd5940c2ea071b5d11497786': { type: 'hero_temp', heroId: 'volkolak', heroName: 'Волколак', exclusiveWith: ['900c7caa77ed0a37dc98fffffd1496533d8d3d64e253ab04db9708ccf1b217cb'] },
    '900c7caa77ed0a37dc98fffffd1496533d8d3d64e253ab04db9708ccf1b217cb': { type: 'hero_permanent', heroId: 'volkolak', heroName: 'Волколак' },
    'cc679ba8adc9e5c6836829c80d5dd096905db66402574ac530787d453943c6e6': { type: 'coins', amount: 5000 }
};

/** Хэширует введённый игроком код и ищет совпадение среди promoHashes. */
export async function resolvePromoCode(rawCode) {
    const hash = await sha256(rawCode);
    return { hash, promo: promoHashes[hash] || null };
}

export function getSpecialCharacterById(id) {
    return specialCharacters.find(c => c.id === id) || null;
}
