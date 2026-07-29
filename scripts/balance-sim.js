// scripts/balance-sim.js (v1.03)
//
// Офлайн-симулятор баланса. Гоняет тысячи автобоёв "бот против бота" на
// случайных командах и случайных аренах, считает винрейт каждого героя.
// Учитывает всю боевую механику v1.03: прогрессивное открытие умений по
// ходам, DOT (яд/ожог), массовые умения (aoe), бафы/дебафы, dispel, призыв
// спутника (Кощей/Леший) и оглушение (заложено в движке на будущее).
//
// Запуск: node scripts/balance-sim.js  (или npm run balance)

import { baseCharacters, initHeroStats, createCompanion } from '../js/characters.js';
import { arenas } from '../js/arenas.js';
import { chooseBotAction } from '../js/bot.js';
import { getRandomWeapon } from '../js/items.js';
import {
    buildTurnQueue, tickCooldowns, resolveAction, applyArenaTurnStart,
    applyStatusEffects, applySkillDot, computeAttackDamage,
    tickBuffs, hasBuff, addBuff, dispelBuffs, shuffle, pickRandom,
    findCompanion, livingHeroes, insertIntoQueue
} from '../js/engine.js';
import { writeFileSync } from 'fs';

// Число итераций можно переопределить аргументом: node scripts/balance-sim.js 5000
const ITERATIONS = Number(process.argv[2]) || 20000;
const MAX_TURNS = 250;
const DIFFICULTY = 'hard';
// Отчёт пишем только при полном прогоне - чтобы быстрые прикидки на 2-3 тысячах
// боёв не перезатирали balance-report.md шумными числами.
const WRITE_REPORT = process.argv[3] !== '--no-write' && ITERATIONS >= 20000;

function applySingleResult(result) {
    if (result.missed || result.dodged || result.blocked) return;
    const { target, skill } = result;
    if (skill.type === 'attack') {
        target.hp = Math.max(0, target.hp - result.amount);
        if (result.regen && target.hp > 0) target.hp = Math.min(target.maxHp, target.hp + result.regen);
        if (skill.dot && target.hp > 0) applySkillDot(skill, target);
    } else {
        target.hp = Math.min(target.maxHp, target.hp + result.amount);
    }
}

function runAoeAttackOrHeal(active, skill, allies, enemies, arena) {
    const targets = (skill.type === 'attack' ? enemies : allies).filter(c => c.hp > 0);
    targets.forEach(target => {
        const result = resolveAction({ attacker: active, target, skill, arena });
        applySingleResult(result);
    });
}

function runBuffOrDispel(active, skill, target, allies, enemies) {
    const resolveTeam = (who) => {
        if (who === 'self') return [active];
        return (who === 'ally' ? allies : enemies).filter(c => c.hp > 0);
    };
    if (skill.type === 'buff') {
        const pool = resolveTeam(skill.buffTarget);
        const targets = skill.aoe ? pool : (target && target.hp > 0 ? [target] : pool.slice(0, 1));
        targets.forEach(t => skill.effects.forEach(effect => addBuff(t, effect)));
    } else {
        const pool = resolveTeam(skill.dispelTarget);
        const targets = skill.aoe ? pool : (target && target.hp > 0 ? [target] : pool.slice(0, 1));
        targets.forEach(t => dispelBuffs(t));
    }
}

/** Призыв/лечение помощника — зеркалит combat.js -> executeSummonAction. */
function runSummon(active, skill, team, queue, state) {
    const existing = findCompanion(team, active);
    if (existing) {
        existing.hp = Math.min(existing.maxHp, existing.hp + skill.companion.heal);
        active.currentCooldowns[skill.name] = 0; // лечение помощника без отката
    } else {
        const companion = createCompanion(active, skill.companion);
        team.push(companion);
        state.idx = insertIntoQueue(queue, companion, state.idx);
    }
}

/** Вампиризм — зеркалит combat.js -> executeDrainAction. */
function runDrain(active, skill, target, arena) {
    const raw = computeAttackDamage(skill, active, target, arena);
    const drained = Math.min(target.hp, raw);
    target.hp = Math.max(0, target.hp - drained);
    active.hp = Math.min(active.maxHp, active.hp + drained);
}

/** Помощник гибнет вместе с хозяином — зеркалит combat.js -> cleanupCompanions. */
function cleanupCompanions(teams) {
    teams.forEach(team => {
        team.forEach(unit => {
            if (!unit.isCompanion || unit.hp <= 0) return;
            const owner = team.find(c => c.id === unit.ownerId);
            if (!owner || owner.hp <= 0) unit.hp = 0;
        });
    });
}

function runOneBattle(teamAIds, teamBIds, arena) {
    const teamA = teamAIds.map(id => initHeroStats(baseCharacters.find(c => c.id === id), true, Math.random() < 0.8 ? getRandomWeapon().id : null));
    const teamB = teamBIds.map(id => initHeroStats(baseCharacters.find(c => c.id === id), true, Math.random() < 0.8 ? getRandomWeapon().id : null));

    const queue = buildTurnQueue(teamA, teamB);
    let turns = 0;
    // idx держим в объекте: insertIntoQueue при призыве помощника может его
    // сдвинуть, если новый боец встал в очередь перед текущим.
    const cursor = { idx: 0 };

    while (turns < MAX_TURNS) {
        cleanupCompanions([teamA, teamB]);
        // Победа считается только по настоящим героям: оставшийся в живых
        // скелет — не повод продолжать бой.
        if (livingHeroes(teamA).length === 0) return { winner: 'B' };
        if (livingHeroes(teamB).length === 0) return { winner: 'A' };

        if (cursor.idx >= queue.length) cursor.idx = 0;
        const active = queue[cursor.idx];
        cursor.idx++;
        turns++;

        if (active.hp <= 0) continue;

        active.turnsTaken++;
        tickCooldowns(active);

        // Оглушение проверяем ДО tickBuffs - как и в combat.js (см. там подробный
        // комментарий: иначе stun с turns: 1 истекает раньше, чем проверяется).
        if (hasBuff(active, 'stun')) {
            tickBuffs(active);
            continue;
        }
        tickBuffs(active);

        const isTeamA = teamA.includes(active);
        const allies = isTeamA ? teamA : teamB;
        const enemies = isTeamA ? teamB : teamA;

        const arenaEffect = applyArenaTurnStart(active, arena);
        if (arenaEffect) {
            if (arenaEffect.type === 'heal') active.hp = Math.min(active.maxHp, active.hp + arenaEffect.amount);
            else if (arenaEffect.type === 'burn') active.hp = Math.max(0, active.hp - arenaEffect.amount);
        }
        applyStatusEffects(active);
        if (active.hp <= 0) continue;

        const action = chooseBotAction(active, allies, enemies, arena, DIFFICULTY);
        if (!action) continue;
        const { skill, target } = action;

        if (skill.type === 'buff' || skill.type === 'dispel') {
            runBuffOrDispel(active, skill, target, allies, enemies);
            continue;
        }
        if (skill.type === 'summon') {
            runSummon(active, skill, allies, queue, cursor);
            continue;
        }
        if (skill.type === 'drain') {
            if (target && target.hp > 0) runDrain(active, skill, target, arena);
            continue;
        }
        if (skill.aoe) {
            runAoeAttackOrHeal(active, skill, allies, enemies, arena);
            continue;
        }

        if (!target || target.hp <= 0) continue;
        // Самолечение всегда уходит в самого применяющего (healTarget: 'self')
        if (skill.type === 'heal' && skill.healTarget === 'self') {
            const heal = resolveAction({ attacker: active, target: active, skill, arena });
            active.hp = Math.min(active.maxHp, active.hp + heal.amount);
            continue;
        }
        const result = resolveAction({ attacker: active, target, skill, arena });
        applySingleResult(result);

        if (result.doubleCast && active.hp > 0 && target.hp > 0) {
            const second = resolveAction({ attacker: active, target, skill, arena });
            applySingleResult(second);
        }
    }
    return { winner: 'draw' };
}

function main() {
    const wins = {};
    const decided = {};   // бои героя, закончившиеся победой или поражением (без ничьих)
    const appearances = {};
    baseCharacters.forEach(c => { wins[c.id] = 0; decided[c.id] = 0; appearances[c.id] = 0; });
    let draws = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        const shuffled = shuffle(baseCharacters);
        const teamAIds = shuffled.slice(0, 3).map(c => c.id);
        const teamBIds = shuffled.slice(3, 6).map(c => c.id);
        const arena = pickRandom(arenas);

        teamAIds.forEach(id => appearances[id]++);
        teamBIds.forEach(id => appearances[id]++);

        const { winner } = runOneBattle(teamAIds, teamBIds, arena);
        if (winner === 'draw') { draws++; continue; }

        // Ничьи (упёрлись в MAX_TURNS) в винрейт не засчитываем ни одной
        // стороне - иначе средний винрейт по всем героям систематически
        // оказывался ниже 50% просто из-за них, и было непонятно, это
        // перекос баланса или артефакт подсчёта.
        [...teamAIds, ...teamBIds].forEach(id => decided[id]++);
        const winners = winner === 'A' ? teamAIds : teamBIds;
        winners.forEach(id => wins[id]++);
    }

    const rows = baseCharacters.map(c => {
        const played = decided[c.id] || 1;
        return {
            name: c.name, price: c.price,
            appearances: appearances[c.id],
            winRate: parseFloat((wins[c.id] / played * 100).toFixed(1))
        };
    }).sort((a, b) => b.winRate - a.winRate);

    const avg = rows.reduce((s, r) => s + r.winRate, 0) / rows.length;
    const spread = rows[0].winRate - rows[rows.length - 1].winRate;

    let md = `# Отчёт по балансу (симуляция бот-vs-бот, сложность "${DIFFICULTY}")\n\n`;
    md += `Итераций: ${ITERATIONS}, случайные команды 3v3 из ${baseCharacters.length} героев, случайная арена на каждый бой. `;
    md += `Учитывает прогрессивное открытие умений, DOT, массовые умения, бафы/дебафы, dispel и призыв спутника.\n\n`;
    md += `Команды набираются честным перемешиванием (Фишер–Йетс), ничьи (${draws}, ${(draws / ITERATIONS * 100).toFixed(1)}%) `;
    md += `в винрейт не засчитываются — поэтому средний винрейт сходится ровно к 50%.\n\n`;
    md += `| Герой | Цена | Появлений | Винрейт |\n|---|---|---|---|\n`;
    rows.forEach(r => {
        md += `| ${r.name} | ${r.price} 💰 | ${r.appearances} | ${r.winRate}% |\n`;
    });
    md += `\nСредний винрейт: ${avg.toFixed(1)}%. Разброс между лучшим и худшим героем: ${spread.toFixed(1)} п.п.\n`;

    // Погрешность: без неё легко начать «чинить» разницу, которой на самом деле нет.
    const avgBattles = rows.reduce((s, r) => s + r.appearances, 0) / rows.length;
    const stdErr = Math.sqrt(0.25 / avgBattles) * 100;
    md += `\n_Каждый герой сыграл около ${Math.round(avgBattles)} боёв, стандартная ошибка ≈ ${stdErr.toFixed(2)} п.п., `;
    md += `то есть доверительный интервал каждой строки примерно ±${(stdErr * 2).toFixed(1)} п.п. `;
    md += `Разницу меньше этой величины значимой считать не стоит._\n`;

    if (WRITE_REPORT) writeFileSync(new URL('../balance-report.md', import.meta.url), md);
    console.log(md);
}

main();
