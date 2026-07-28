// arenas.js — арены с тактическими модификаторами.
// Модификаторы завязаны на поле race персонажа (см. characters.js):
// 'human' | 'undead' | 'spirit' | 'beast'.

function neutralMods() {
    return {
        missChance: 0,
        turnStartEffect: null,
        dmgMultForRace: () => 1,
        incDmgMultForRace: () => 1,
        healMultForRace: () => 1
    };
}

export const arenas = [
    {
        id: 'field', name: 'Чистое поле', icon: '🌾', bgAsset: 'assets/arena_field.jpg',
        desc: 'Нейтральная арена без модификаторов — честный бой без сюрпризов.',
        ...neutralMods()
    },
    {
        id: 'fog', name: 'Туманная низина', icon: '🌫️', bgAsset: 'assets/arena_fog.jpg',
        desc: 'Густой туман скрывает противника: все атаки получают +15% к шансу промаха.',
        ...neutralMods(),
        missChance: 0.15
    },
    {
        id: 'swamp', name: 'Болото Бабы Яги', icon: '🐸', bgAsset: 'assets/arena_swamp.jpg',
        desc: 'Нежить исцеляется в трясине (+8% HP за ход), а живые понемногу вязнут и травятся испарениями (-2% HP за ход).',
        ...neutralMods(),
        turnStartEffect: (character) => {
            if (character.race === 'undead') {
                return { type: 'heal', amount: Math.round(character.maxHp * 0.08) };
            }
            if (character.race === 'human') {
                return { type: 'burn', amount: Math.round(character.maxHp * 0.02) };
            }
            return null;
        }
    },
    {
        id: 'ice', name: 'Ледяное капище', icon: '❄️', bgAsset: 'assets/arena_ice.jpg',
        desc: 'Духи и нежить чувствуют себя как дома под защитой льда: получаемый ими урон снижен на 10%.',
        ...neutralMods(),
        incDmgMultForRace: (race) => (race === 'spirit' || race === 'undead') ? 0.9 : 1
    },
    {
        id: 'lair', name: 'Логово Змея', icon: '🌋', bgAsset: 'assets/arena_lair.jpg',
        desc: 'Родная стихия чудовищ: звери наносят +20% урона, а всех остальных понемногу опаляет жаром (-3% HP за ход).',
        ...neutralMods(),
        dmgMultForRace: (race) => race === 'beast' ? 1.2 : 1,
        turnStartEffect: (character) => {
            if (character.race !== 'beast') {
                return { type: 'burn', amount: Math.round(character.maxHp * 0.03) };
            }
            return null;
        }
    },
    {
        id: 'storm', name: 'Грозовые небеса', icon: '⚡', bgAsset: 'assets/arena_storm.jpg',
        desc: 'Молнии бьют по самым крупным целям: звери наносят +15% урона, но и получают +10% урона, а духи используют ветер и восстанавливают 4% HP за ход.',
        ...neutralMods(),
        dmgMultForRace: (race) => race === 'beast' ? 1.15 : 1,
        incDmgMultForRace: (race) => race === 'beast' ? 1.1 : 1,
        turnStartEffect: (character) => {
            if (character.race === 'spirit') {
                return { type: 'heal', amount: Math.round(character.maxHp * 0.04) };
            }
            return null;
        }
    }
];

export function getArenaById(id) {
    return arenas.find(a => a.id === id) || arenas[0];
}
