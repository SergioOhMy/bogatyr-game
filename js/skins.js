// skins.js — альтернативные образы (скины) героев.
//
// Каждый скин покупается отдельно за монеты (только для уже открытого
// героя) и затем может быть надет/снят бесплатно в любой момент. Файлы
// картинок называются по образцу <исходное_имя>2.png - положите их в assets/
// рядом с обычными портретами (пути ниже уже на них ссылаются).
//
// Как добавить новый скин: допишите объект { id, name, img, price } в
// массив нужного heroId. id должен быть уникальным в пределах героя.
//
// Цена у всех образов одинаковая — 100 монет. Раньше разброс был от 30 до 300,
// но образ ни на что не влияет в бою, поэтому дороже/дешевле означало ровно
// ничего и только путало: было непонятно, почему Кощей в другой шапке стоит
// вдесятеро дороже Колобка.
export const SKIN_PRICE = 100;

export const skinsCatalog = {
    c1: [{ id: 'c1_s1', name: 'Илья Муромец: Зимний поход', img: 'assets/ilya2.png', price: 100 }],
    c2: [{ id: 'c2_s1', name: 'Добрыня: Праздничные доспехи', img: 'assets/dobrynya2.png', price: 100 }],
    c3: [{ id: 'c3_s1', name: 'Алёша Попович: Лесной охотник', img: 'assets/alyosha2.png', price: 100 }],
    c4: [{ id: 'c4_s1', name: 'Снегурочка: Ледяная королева', img: 'assets/snegurochka2.png', price: 100 }],
    c5: [{ id: 'c5_s1', name: 'Баба Яга: Ночная ведьма', img: 'assets/yaga2.png', price: 100 }],
    c6: [{ id: 'c6_s1', name: 'Змей Горыныч: Пепельный дракон', img: 'assets/gorynych2.png', price: 100 }],
    c7: [{ id: 'c7_s1', name: 'Колобок: Золотая корочка', img: 'assets/kolobok2.png', price: 100 }],
    c8: [{ id: 'c8_s1', name: 'Кощей: Костяной владыка', img: 'assets/koschei2.png', price: 100 }],
    c9: [{ id: 'c9_s1', name: 'Соловей-разбойник: Ночной силуэт', img: 'assets/solovey2.png', price: 100 }],
    c10: [{ id: 'c10_s1', name: 'Леший: Древний страж', img: 'assets/leshy2.png', price: 100 }],
    c11: [{ id: 'c11_s1', name: 'Емеля: Царский наряд', img: 'assets/emelya2.png', price: 100 }],
    c12: [{ id: 'c12_s1', name: 'Святогор: Каменный великан', img: 'assets/svyatogor2.png', price: 100 }],
    c13: [{ id: 'c13_s1', name: 'Василиса: Лунная мудрость', img: 'assets/vasilisa2.png', price: 100 }],
    c14: [{ id: 'c14_s1', name: 'Жар-птица: Закатное пламя', img: 'assets/zharptica2.png', price: 100 }],
    c15: [{ id: 'c15_s1', name: 'Берегиня: Осенний убор', img: 'assets/beregina2.png', price: 100 }]
};

/** Возвращает список скинов героя (пустой массив, если их нет). */
export function getSkinsForHero(heroId) {
    return skinsCatalog[heroId] || [];
}

/** Картинка героя с учётом надетого скина (если он есть и куплен). */
export function getHeroImage(char, profile) {
    const equippedSkinId = profile && profile.equippedSkins ? profile.equippedSkins[char.id] : null;
    if (!equippedSkinId) return char.img;
    const skin = getSkinsForHero(char.id).find(s => s.id === equippedSkinId);
    return skin ? skin.img : char.img;
}
