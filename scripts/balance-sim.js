// scripts/balance-sim.js
//
// Офлайн-симулятор баланса. Гоняет тысячи автобоёв "бот против бота" на
// случайных командах из 13 героев и случайных аренах, считает винрейт
// каждого героя и записывает markdown-таблицу в balance-report.md.
//
// Запуск:  node scripts/balance-sim.js  (или npm run balance)
//
// Важно: это НЕ дублирование логики боя из combat.js. Вся математика урона,
// лечения, промахов и порядка ходов берётся из js/engine.js — того же
// модуля, которым пользуется браузерная игра. Здесь только цикл ходов,
// без DOM, таймеров и анимаций.

import { baseCharacters, initHeroStats } from '../js/characters.js';
import { arenas } from '../js/arenas.js';
import { chooseBotAction } from '../js/bot.js';
import {
    buildTurnQueue, tickCooldowns, resolveAction, applyArenaTurnStart
} from '../js/engine.js';
import { writeFileSync } from 'fs';

const ITERATIONS = 20000;
const MAX_TURNS = 200; // предохранитель от зависаний при двух лекарях подряд
const DIFFICULTY = 'hard'; // фиксируем сторону сложности, чтобы сравнение было честным

function pickRandomTeam(pool, size) {
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
}

function applyResult(result) {
    if (result.missed || result.dodged || result.blocked) return;
    const { target } = result;

    if (result.skill.type === 'attack') {
        target.hp = Math.max(0, target.hp - result.amount);
        if (result.regen && target.hp > 0) {
            target.hp = Math.min(target.maxHp, target.hp + result.regen);
        }
    } else {
        target.hp = Math.min(target.maxHp, target.hp + result.amount);
    }
}

function runOneBattle(teamAIds, teamBIds, arena) {
    const teamA = teamAIds.map(id => initHeroStats(baseCharacters.find(c => c.id === id), true));
    const teamB = teamBIds.map(id => initHeroStats(baseCharacters.find(c => c.id === id), true));

    let queue = buildTurnQueue(teamA, teamB);
    let turns = 0;
    let idx = 0;

    while (turns < MAX_TURNS) {
        const aliveA = teamA.filter(c => c.hp > 0).length;
        const aliveB = teamB.filter(c => c.hp > 0).length;
        if (aliveA === 0) return { winner: 'B' };
        if (aliveB === 0) return { winner: 'A' };

        if (idx >= queue.length) idx = 0;
        const active = queue[idx];
        idx++;
        turns++;

        if (active.hp <= 0) continue;

        tickCooldowns(active);

        const isTeamA = teamA.includes(active);
        const allies = isTeamA ? teamA : teamB;
        const enemies = isTeamA ? teamB : teamA;

        const startEffect = applyArenaTurnStart(active, arena);
        if (startEffect) {
            if (startEffect.type === 'heal') active.hp = Math.min(active.maxHp, active.hp + startEffect.amount);
            else if (startEffect.type === 'burn') active.hp = Math.max(0, active.hp - startEffect.amount);
            if (active.hp <= 0) continue;
        }

        const action = chooseBotAction(active, allies, enemies, arena, DIFFICULTY);
        if (!action) continue;
        const { skill, target } = action;
        if (!target || target.hp <= 0) continue;

        active.currentCooldowns[skill.name] = skill.cooldown;
        const result = resolveAction({ attacker: active, target, skill, arena });
        applyResult(result);

        if (result.doubleCast && active.hp > 0 && target.hp > 0) {
            const second = resolveAction({ attacker: active, target, skill, arena });
            applyResult(second);
        }
    }
    return { winner: 'draw' };
}

function main() {
    const wins = {};
    const appearances = {};
    baseCharacters.forEach(c => { wins[c.id] = 0; appearances[c.id] = 0; });

    for (let i = 0; i < ITERATIONS; i++) {
        const shuffled = [...baseCharacters].sort(() => 0.5 - Math.random());
        const teamAIds = shuffled.slice(0, 3).map(c => c.id);
        const teamBIds = shuffled.slice(3, 6).map(c => c.id);
        const arena = arenas[Math.floor(Math.random() * arenas.length)];

        teamAIds.forEach(id => appearances[id]++);
        teamBIds.forEach(id => appearances[id]++);

        const { winner } = runOneBattle(teamAIds, teamBIds, arena);
        if (winner === 'A') teamAIds.forEach(id => wins[id]++);
        if (winner === 'B') teamBIds.forEach(id => wins[id]++);
        // draw - никому не засчитываем
    }

    const rows = baseCharacters.map(c => {
        const app = appearances[c.id] || 1;
        const winRate = (wins[c.id] / app * 100).toFixed(1);
        return { name: c.name, price: c.price, appearances: app, winRate: parseFloat(winRate) };
    }).sort((a, b) => b.winRate - a.winRate);

    let md = `# Отчёт по балансу (симуляция бот-vs-бот, сложность "${DIFFICULTY}")\n\n`;
    md += `Итераций: ${ITERATIONS}, случайные команды 3v3, случайная арена на каждый бой.\n\n`;
    md += `| Герой | Цена | Появлений | Винрейт |\n|---|---|---|---|\n`;
    rows.forEach(r => {
        md += `| ${r.name} | ${r.price} 💰 | ${r.appearances} | ${r.winRate}% |\n`;
    });

    const avg = rows.reduce((s, r) => s + r.winRate, 0) / rows.length;
    md += `\nСредний винрейт по всем героям: ${avg.toFixed(1)}% (в идеале ~50%, т.к. это же среднее по случайным 3v3-командам).\n`;
    md += `\nГерои с винрейтом заметно выше среднего считаются сильными относительно цены, заметно ниже — кандидаты на баф.\n`;

    writeFileSync(new URL('../balance-report.md', import.meta.url), md);
    console.log(md);
}

main();
