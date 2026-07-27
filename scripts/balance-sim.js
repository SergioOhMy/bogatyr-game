// scripts/balance-sim.js (v1.02)
//
// Офлайн-симулятор баланса. Гоняет тысячи автобоёв "бот против бота" на
// случайных командах и случайных аренах, считает винрейт каждого героя.
// Учитывает всю боевую механику v1.02: прогрессивное открытие умений по
// ходам, яд/ожог (DOT), массовые умения (aoe).
//
// Запуск: node scripts/balance-sim.js  (или npm run balance)

import { baseCharacters, initHeroStats } from '../js/characters.js';
import { arenas } from '../js/arenas.js';
import { chooseBotAction } from '../js/bot.js';
import {
    buildTurnQueue, tickCooldowns, resolveAction, applyArenaTurnStart,
    applyStatusEffects, applySkillDot
} from '../js/engine.js';
import { writeFileSync } from 'fs';

const ITERATIONS = 20000;
const MAX_TURNS = 250;
const DIFFICULTY = 'hard';

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

function runAoe(active, skill, allies, enemies, arena) {
    const targets = (skill.type === 'attack' ? enemies : allies).filter(c => c.hp > 0);
    targets.forEach(target => {
        const result = resolveAction({ attacker: active, target, skill, arena });
        applySingleResult(result);
    });
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

        active.turnsTaken++;
        tickCooldowns(active);

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

        if (skill.aoe) {
            runAoe(active, skill, allies, enemies, arena);
            continue;
        }

        if (!target || target.hp <= 0) continue;
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
    }

    const rows = baseCharacters.map(c => {
        const app = appearances[c.id] || 1;
        const winRate = (wins[c.id] / app * 100).toFixed(1);
        return { name: c.name, price: c.price, appearances: app, winRate: parseFloat(winRate) };
    }).sort((a, b) => b.winRate - a.winRate);

    let md = `# Отчёт по балансу v1.02 (симуляция бот-vs-бот, сложность "${DIFFICULTY}")\n\n`;
    md += `Итераций: ${ITERATIONS}, случайные команды 3v3 из ${baseCharacters.length} героев, случайная арена на каждый бой. `;
    md += `Учитывает прогрессивное открытие умений по ходам, DOT (яд/ожог) и массовые умения.\n\n`;
    md += `| Герой | Цена | Появлений | Винрейт |\n|---|---|---|---|\n`;
    rows.forEach(r => {
        md += `| ${r.name} | ${r.price} 💰 | ${r.appearances} | ${r.winRate}% |\n`;
    });

    const avg = rows.reduce((s, r) => s + r.winRate, 0) / rows.length;
    md += `\nСредний винрейт по всем героям: ${avg.toFixed(1)}% (в идеале ~50%).\n`;

    writeFileSync(new URL('../balance-report.md', import.meta.url), md);
    console.log(md);
}

main();
