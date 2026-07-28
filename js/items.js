// items.js — оружие и инвентарь (v1.04).
//
// Любое оружие может носить любой герой (универсальность), но у каждого
// оружия есть "родной" герой (bonusFor) - если оружие надето именно на
// него, оно даёт дополнительный бонус сверх базового. Эффект оружия
// постоянный (не тикает по ходам, в отличие от бафов) и применяется один
// раз при инициализации бойца перед боем (см. characters.js -> initHeroStats).
//
// stat в effect может быть:
//   'dmg'  - множитель урона (dmgMult), value = +0.08 значит +8% урона
//   'def'  - множитель ВХОДЯЩЕГО урона (incDmgMult), value = -0.05 значит -5% получаемого урона
//   'heal' - множитель лечения (healMult), value = +0.10 значит +10% лечения
//
// Как добавить своё оружие: допишите объект в weaponCatalog. img - путь к
// картинке (положите файл в assets/, см. полный список в README-dev.md).

export const weaponCatalog = [
    { id: 'bow_alyosha', name: 'Лук Алёши', icon: '🏹', img: 'assets/weapon_bow.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c3', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'staff_beregina', name: 'Посох Берегини', icon: '🌿', img: 'assets/weapon_staff_nature.png',
        baseEffect: { stat: 'heal', value: 0.06 }, bonusFor: 'c15', bonusEffect: { stat: 'heal', value: 0.12 }, sellPrice: 50 },

    { id: 'spear_dobrynya', name: 'Пика Добрыни', icon: '🔱', img: 'assets/weapon_spear.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c2', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'mace_ilya', name: 'Палица Ильи', icon: '💥', img: 'assets/weapon_mace.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c1', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'pike_club_emelya', name: 'Дубинка-щука Емели', icon: '🐟', img: 'assets/weapon_pikeclub.png',
        baseEffect: { stat: 'dmg', value: 0.05 }, bonusFor: 'c11', bonusEffect: { stat: 'heal', value: 0.10 }, sellPrice: 50 },

    { id: 'sword_gorynych', name: 'Меч Горыныча', icon: '⚔️', img: 'assets/weapon_sword.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c6', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'dagger_kolobok', name: 'Кинжал Колобка', icon: '🗡️', img: 'assets/weapon_dagger.png',
        baseEffect: { stat: 'dmg', value: 0.05 }, bonusFor: 'c7', bonusEffect: { stat: 'def', value: -0.08 }, sellPrice: 50 },

    { id: 'scepter_koschei', name: 'Жезл Кощея', icon: '🔮', img: 'assets/weapon_scepter.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c8', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'staff_leshy', name: 'Сучковатый посох Лешего', icon: '🌲', img: 'assets/weapon_staff_wood.png',
        baseEffect: { stat: 'def', value: -0.04 }, bonusFor: 'c10', bonusEffect: { stat: 'def', value: -0.08 }, sellPrice: 50 },

    { id: 'staff_snegurochka', name: 'Ледяной посох Снегурочки', icon: '❄️', img: 'assets/weapon_staff_ice.png',
        baseEffect: { stat: 'heal', value: 0.06 }, bonusFor: 'c4', bonusEffect: { stat: 'heal', value: 0.12 }, sellPrice: 50 },

    { id: 'katana_solovey', name: 'Катана Соловья', icon: '🗡️', img: 'assets/weapon_katana.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c9', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'hammer_svyatogor', name: 'Молот Святогора', icon: '🔨', img: 'assets/weapon_hammer.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c12', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'arrowhead_vasilisa', name: 'Кристальный наконечник Василисы', icon: '💎', img: 'assets/weapon_arrowhead.png',
        baseEffect: { stat: 'heal', value: 0.06 }, bonusFor: 'c13', bonusEffect: { stat: 'heal', value: 0.12 }, sellPrice: 50 },

    { id: 'wand_yaga', name: 'Волшебная палочка Бабы Яги', icon: '🪄', img: 'assets/weapon_wand.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c5', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    { id: 'blade_zharptica', name: 'Небесный клинок Жар-птицы', icon: '🌟', img: 'assets/weapon_skyblade.png',
        baseEffect: { stat: 'dmg', value: 0.06 }, bonusFor: 'c14', bonusEffect: { stat: 'dmg', value: 0.10 }, sellPrice: 50 },

    // Универсальное оружие без "родного" героя - слабее, зато подходит всем одинаково
    { id: 'plain_sword', name: 'Простой меч', icon: '⚔️', img: 'assets/weapon_plain_sword.png',
        baseEffect: { stat: 'dmg', value: 0.04 }, bonusFor: null, sellPrice: 40 },
    { id: 'oak_staff', name: 'Дубовый посох', icon: '🪵', img: 'assets/weapon_oak_staff.png',
        baseEffect: { stat: 'heal', value: 0.04 }, bonusFor: null, sellPrice: 40 },
    { id: 'hunting_bow', name: 'Охотничий лук', icon: '🏹', img: 'assets/weapon_hunting_bow.png',
        baseEffect: { stat: 'dmg', value: 0.04 }, bonusFor: null, sellPrice: 40 },

    // Личное оружие Волколака - выдаётся автоматически при активации промокода,
    // никогда не выпадает из сундуков (см. dropExcluded), но если его снять -
    // ведёт себя как обычное оружие (можно продать/передать другому герою).
    { id: 'moonfang_volkolak', name: 'Клык Луны', icon: '🌕', img: 'assets/weapon_moonfang.png',
        baseEffect: { stat: 'dmg', value: 0.08 }, bonusFor: 'volkolak', bonusEffect: { stat: 'dmg', value: 0.15 },
        sellPrice: 60, dropExcluded: true }
];

export function getWeaponById(id) {
    return weaponCatalog.find(w => w.id === id) || null;
}

/** Список оружия, которое реально может выпасть из сундука (исключает личные предметы). */
export function getDroppableWeapons() {
    return weaponCatalog.filter(w => !w.dropExcluded);
}

export function getRandomWeapon() {
    const pool = getDroppableWeapons();
    return pool[Math.floor(Math.random() * pool.length)];
}

/** Применяет постоянный эффект оружия к уже инициализированному бойцу. */
export function applyWeaponEffect(hero, weapon) {
    if (!weapon) return;
    const apply = (effect) => {
        if (!effect) return;
        if (effect.stat === 'dmg') hero.dmgMult *= (1 + effect.value);
        else if (effect.stat === 'def') hero.incDmgMult *= (1 + effect.value);
        else if (effect.stat === 'heal') hero.healMult *= (1 + effect.value);
    };
    apply(weapon.baseEffect);
    if (weapon.bonusFor === hero.id) apply(weapon.bonusEffect);
    hero.equippedWeapon = weapon;
}
