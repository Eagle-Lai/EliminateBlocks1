/**
 * 120 关生成器：6 章 × 20 关。
 * 公式见 new-gameplay-implementation-prompt.md §7；本脚本只负责按公式产出、
 * 用贪心机器人测可达率、必要时下调 target（不改公式），最后写表 + CSV + 报告。
 *
 * 用法：npx tsx scripts/gen-content/levels.ts [--fast]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoardModel } from '../../assets/scripts/core/BoardModel';
import { buildStoneBoard } from '../../assets/scripts/core/BoardPatterns';
import { GreedyBot } from '../../assets/scripts/core/Solver';
import type { GoalDef } from '../../assets/scripts/core/GoalTracker';
import type { MutationTier } from '../../assets/scripts/config/MutationTable';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

type GoalType = 'score' | 'rows' | 'color' | 'special' | 'burst' | 'stone';

interface LevelRow {
    id: number;
    chapter: number;
    slot: number;
    name: string;
    mutationId: number;
    tier: MutationTier;
    goalType: GoalType;
    target: number;
    goalColor?: number;
    star2: number;
    star3: number;
    seed: number;
    stoneSeed?: number;
    stoneCount?: number;
}

const CHAPTERS = [
    { id: 1, name: '糖霜庭院', noun: '庭院', base: 1200, tiers: { light: 8, standard: 8, strong: 4 } },
    { id: 2, name: '镜厅回廊', noun: '回廊', base: 1800, tiers: { light: 6, standard: 10, strong: 4 } },
    { id: 3, name: '倒悬工坊', noun: '工坊', base: 2400, tiers: { light: 4, standard: 10, strong: 6 } },
    { id: 4, name: '迷雾糖林', noun: '糖林', base: 3000, tiers: { light: 4, standard: 8, strong: 8 } },
    { id: 5, name: '棱镜实验室', noun: '实验室', base: 3800, tiers: { light: 0, standard: 10, strong: 10 } },
    { id: 6, name: '终局剧场', noun: '剧场', base: 4600, tiers: { light: 0, standard: 6, strong: 14 } },
];

const PREFIXES = [
    '初雪', '糖霜', '薄荷', '蜜橘', '青柠', '汽水', '葡萄', '星屑', '月牙', '云朵',
    '风铃', '暖阳', '微光', '涟漪', '琥珀', '珊瑚', '银河', '棉花', '极光', '终章',
];

const GOAL_BY_SLOT: GoalType[] = [
    'score', 'rows', 'color', 'special', 'burst', 'stone',
    'score', 'rows', 'color', 'special', 'burst', 'stone',
    'score', 'rows', 'color', 'special', 'burst', 'stone',
    'score', 'score',
];

const MULTIPLIERS = [
    1.0, 1.06, 1.12, 1.18, 1.24, 1.3, 1.38, 1.46, 1.54, 1.62,
    1.7, 1.78, 1.86, 1.94, 2.04, 2.14, 2.24, 2.34, 2.46, 2.6,
];

function round50(x: number): number {
    return Math.round(x / 50) * 50;
}

function tierFor(chapter: number, slot: number): MutationTier {
    const cfg = CHAPTERS[chapter - 1].tiers;
    if (slot <= cfg.light) return 'light';
    if (slot <= cfg.light + cfg.standard) return 'standard';
    return 'strong';
}

function mutationFor(chapter: number, slot: number): number {
    const odd = slot % 2 === 1;
    switch (chapter) {
        case 1:
            return odd ? 1 : 7;
        case 2:
            return odd ? 3 : 8;
        case 3:
            return odd ? 4 : 6;
        case 4:
            return odd ? 2 : 5;
        case 5: {
            const pool = [1, 3, 6, 8];
            return pool[(slot - 1) % 4];
        }
        default: {
            const pool = [4, 5, 7, 2];
            return pool[(slot - 1) % 4];
        }
    }
}

function targetFor(chapter: number, slot: number, goal: GoalType, base: number, mult: number): number {
    switch (goal) {
        case 'score':
            return round50(base * mult);
        case 'rows':
            return Math.min(10, 5 + Math.ceil(slot / 3) + (chapter - 1));
        case 'color':
            return Math.min(20, 8 + (chapter - 1) * 2 + Math.floor(slot / 5));
        case 'special':
            return Math.min(6, 2 + Math.floor(slot / 6) + Math.floor((chapter - 1) / 2));
        case 'burst':
            return Math.min(3, 1 + Math.floor(slot / 13) + Math.floor((chapter - 1) / 3));
        case 'stone':
            // Two rows, each with two gaps, hold 16 stones including the two spare stones.
            return Math.min(14, 8 + (chapter - 1) * 2);
        default:
            return 1;
    }
}

function buildNominal(): LevelRow[] {
    const rows: LevelRow[] = [];
    for (let c = 1; c <= 6; c++) {
        const chapter = CHAPTERS[c - 1];
        for (let s = 1; s <= 20; s++) {
            const id = (c - 1) * 20 + s;
            const goal = GOAL_BY_SLOT[s - 1];
            const mult = MULTIPLIERS[s - 1];
            const target = targetFor(c, s, goal, chapter.base, mult);
            const star2 =
                goal === 'score' ? round50(target * 1.4) : round50(chapter.base * mult * 1.2);
            const star3 =
                goal === 'score' ? round50(target * 2.0) : round50(chapter.base * mult * 1.8);
            const row: LevelRow = {
                id,
                chapter: c,
                slot: s,
                name: `${PREFIXES[s - 1]}${chapter.noun}`,
                mutationId: mutationFor(c, s),
                tier: tierFor(c, s),
                goalType: goal,
                target,
                star2,
                star3,
                seed: id * 7919,
            };
            if (goal === 'color') row.goalColor = (c * 3 + s) % 5;
            if (goal === 'stone') {
                row.stoneSeed = id * 104729;
                row.stoneCount = target + 2;
            }
            rows.push(row);
        }
    }
    return rows;
}

function boardFor(level: LevelRow): BoardModel {
    if (level.goalType === 'stone') {
        return BoardModel.fromPattern(
            buildStoneBoard(level.stoneSeed ?? level.seed, level.stoneCount ?? level.target + 2),
        );
    }
    return new BoardModel(10, 16);
}

function goalOf(level: LevelRow): GoalDef {
    return { type: level.goalType, target: level.target, color: level.goalColor };
}


interface LevelMeasure { scores: number[]; goals: number[]; won: boolean[]; }

function measure(levels: LevelRow[], seeds: number, locks: number): Map<number, LevelMeasure> {
    const out = new Map<number, LevelMeasure>();
    for (const level of levels) {
        const board = boardFor(level);
        const m: LevelMeasure = { scores: [], goals: [], won: [] };
        for (let i = 0; i < seeds; i++) {
            const bot = new GreedyBot(level.seed + i * 131, { mutationId: level.mutationId, tier: level.tier });
            const res = bot.play(board, locks, goalOf(level));
            m.scores.push(res.score);
            m.goals.push(res.goalValue);
            m.won.push(res.done);
        }
        out.set(level.id, m);
    }
    return out;
}

function quantile(values: number[], fraction: number): number {
    const arr = values.slice().sort((a, b) => a - b);
    return arr[Math.floor((arr.length - 1) * fraction)] ?? 0;
}

function calibrateGoals(levels: LevelRow[], measurements: Map<number, LevelMeasure>): boolean {
    let changed = false;
    for (const level of levels) {
        const m = measurements.get(level.id)!;
        const cap = Math.min(m.goals[0], quantile(m.goals, 0.25));
        if (cap >= level.target) continue;
        const target = level.goalType === 'score' ? Math.max(50, Math.floor(cap / 50) * 50) : Math.max(1, cap);
        if (target === level.target) continue;
        level.target = target;
        if (level.goalType === 'stone') level.stoneCount = target + 2;
        changed = true;
    }
    return changed;
}

function evaluate(levels: LevelRow[], measurements: Map<number, LevelMeasure>) {
    const perLevel = new Map<number, { one: number; two: number; three: number }>();
    let one = 0, two = 0, three = 0, total = 0;
    for (const l of levels) {
        const m = measurements.get(l.id)!;
        const wins = m.scores.filter((_, i) => m.won[i]);
        if (wins.length) {
            // End scores can tie: keep distinct thresholds and report observed rates as measured.
            l.star2 = Math.max(l.goalType === 'score' ? l.target + 1 : 1, quantile(wins, 0.5));
            l.star3 = Math.max(l.star2 + 1, Math.max(...wins));
        }
        const hit2 = wins.filter(s => s >= l.star2).length, hit3 = wins.filter(s => s >= l.star3).length;
        const n = m.scores.length;
        perLevel.set(l.id, { one: wins.length / n, two: hit2 / n, three: hit3 / n });
        one += wins.length; two += hit2; three += hit3; total += n;
    }
    return { one: one / total, two: two / total, three: three / total, perLevel };
}

function writeTable(levels: LevelRow[]): void {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(' * 关卡表（自动生成，勿手改）：6 章 × 20 关 = 120 关。');
    lines.push(' * 生成器：scripts/gen-content/levels.ts；校验：npm run verify:content');
    lines.push(' */');
    lines.push('export interface LevelEntry {');
    lines.push('    id: number;');
    lines.push('    chapter: number;');
    lines.push('    slot: number;');
    lines.push('    name: string;');
    lines.push('    mutationId: number;');
    lines.push('    tier: \'light\' | \'standard\' | \'strong\';');
    lines.push('    goalType: \'score\' | \'rows\' | \'color\' | \'special\' | \'burst\' | \'stone\';');
    lines.push('    target: number;');
    lines.push('    goalColor?: number;');
    lines.push('    star2: number;');
    lines.push('    star3: number;');
    lines.push('    seed: number;');
    lines.push('    stoneSeed?: number;');
    lines.push('    stoneCount?: number;');
    lines.push('}');
    lines.push('');
    lines.push('export const LEVELS: readonly LevelEntry[] = [');
    for (const l of levels) {
        const parts = [
            `id: ${l.id}`,
            `chapter: ${l.chapter}`,
            `slot: ${l.slot}`,
            `name: '${l.name}'`,
            `mutationId: ${l.mutationId}`,
            `tier: '${l.tier}'`,
            `goalType: '${l.goalType}'`,
            `target: ${l.target}`,
        ];
        if (l.goalColor !== undefined) parts.push(`goalColor: ${l.goalColor}`);
        parts.push(`star2: ${l.star2}`, `star3: ${l.star3}`, `seed: ${l.seed}`);
        if (l.stoneSeed !== undefined) parts.push(`stoneSeed: ${l.stoneSeed}`);
        if (l.stoneCount !== undefined) parts.push(`stoneCount: ${l.stoneCount}`);
        lines.push(`    { ${parts.join(', ')} },`);
    }
    lines.push('];');
    lines.push('');
    lines.push('export const CHAPTERS = [');
    for (const c of CHAPTERS) {
        lines.push(`    { id: ${c.id}, name: '${c.name}', base: ${c.base} },`);
    }
    lines.push('] as const;');
    lines.push('');
    lines.push('export function levelById(id: number): LevelEntry | null {');
    lines.push('    return LEVELS.find((l) => l.id === id) ?? null;');
    lines.push('}');
    lines.push('');
    lines.push('/** 本章拿到 ≥1★ 的关卡数（解锁下一章用：≥12） */');
    lines.push('export function chapterCleared(stars: Record<number, number>, chapter: number): number {');
    lines.push('    let n = 0;');
    lines.push('    for (let s = 1; s <= 20; s++) {');
    lines.push('        const id = (chapter - 1) * 20 + s;');
    lines.push('        if ((stars[id] ?? 0) > 0) n++;');
    lines.push('    }');
    lines.push('    return n;');
    lines.push('}');
    lines.push('');
    lines.push('export function chapterUnlocked(stars: Record<number, number>, chapter: number): boolean {');
    lines.push('    if (chapter <= 1) return true;');
    lines.push('    return chapterCleared(stars, chapter - 1) >= 12;');
    lines.push('}');
    lines.push('');
    writeFileSync(join(ROOT, 'assets/scripts/config/LevelTable.ts'), lines.join('\n'), 'utf8');
}

function writeCsv(levels: LevelRow[]): void {
    const head = 'id,chapter,slot,name,mutationId,tier,goalType,target,goalColor,star2,star3,seed';
    const rows = levels.map((l) =>
        [l.id, l.chapter, l.slot, l.name, l.mutationId, l.tier, l.goalType, l.target, l.goalColor ?? '', l.star2, l.star3, l.seed].join(','),
    );
    writeFileSync(join(ROOT, 'docs/level-plan.csv'), [head, ...rows].join('\n'), 'utf8');
}

function writeReport(
    levels: LevelRow[],
    stats: { one: number; two: number; three: number; perLevel: Map<number, { one: number; two: number; three: number }> },
    adjustments: number,
    nominal: LevelRow[],
): void {
    const byChapter: string[] = [];
    for (let c = 1; c <= 6; c++) {
        const list = levels.filter((l) => l.chapter === c);
        const avg1 = list.reduce((s, l) => s + (stats.perLevel.get(l.id)?.one ?? 0), 0) / list.length;
        byChapter.push(`| ${c} | ${CHAPTERS[c - 1].name} | ${list.length} | ${(avg1 * 100).toFixed(0)}% |`);
    }
    const hardest = levels
        .map((l) => ({ l, rate: stats.perLevel.get(l.id)?.one ?? 0 }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 5)
        .map((x) => `| ${x.l.id} | ${x.l.name} | ${x.l.goalType} ${x.l.target} | ${(x.rate * 100).toFixed(0)}% |`);

    const md = [
        '# 120 关生成报告',
        '',
        `- 关卡数：${levels.length}（6 章 × 20 关）`,
        `- 名字唯一：${new Set(levels.map((l) => l.name)).size}`,
        `- 异变覆盖：${new Set(levels.map((l) => l.mutationId)).size} 条`,
        `- 1★ 可达率（机器人 5 种子 × 120 锁）：${(stats.one * 100).toFixed(1)}%`,
        `- 2★ 达成率：${(stats.two * 100).toFixed(1)}%`,
        `- 3★ 达成率（期望 ≤30%）：${(stats.three * 100).toFixed(1)}%`,
        `- 因可达率不足下调 target 的关数：${adjustments}`,
        '',
        '## 章节可达率',
        '',
        '| 章 | 名称 | 关数 | 1★ 平均可达 |',
        '|---|---|---|---|',
        ...byChapter,
        '',
        '## 最难关（1★ 可达率最低）',
        '',
        '| id | 名字 | 目标 | 可达率 |',
        '|---|---|---|---|',
        ...hardest,
        '',
        '## 与标称公式的差异',
        '',
        '以下列出主目标下调的关卡。星级按成功通关那一刻的得分分布计算。',
        '',
        ...levels
            .filter((l) => {
                const n = nominal.find((x) => x.id === l.id);
                return n && n.target !== l.target;
            })
            .map((l) => {
                const n = nominal.find((x) => x.id === l.id) as LevelRow;
                return `- #${l.id} ${l.name}：${n.target} → ${l.target}`;
            }),
        '',
        '> 仿真使用出生位可执行的旋转、平移、直落，按档位应用棋盘异变，天赋均跳过。固定种子加四个替代种子，单次最多尝试 120 次锁定。',
        '> 达标即停，只在主目标已完成时计算二、三星。统计描述这组机器人操作，其他走法与真实玩家的达成率可能不同。',
    ];
    writeFileSync(join(ROOT, 'docs/level-report.md'), md.join('\n'), 'utf8');
}

function main(): void {
    const fast = process.argv.indexOf('--fast') >= 0;
    const seeds = fast ? 1 : 5;
    const locks = fast ? 30 : 120;
    mkdirSync(join(ROOT, 'docs'), { recursive: true });
    const nominal = buildNominal();
    const levels = buildNominal();

    let measured = measure(levels, seeds, locks);
    for (let round = 0; round < 3 && calibrateGoals(levels, measured); round++) {
        measured = measure(levels, seeds, locks);
    }
    const stats = evaluate(levels, measured);
    const adjustments = levels.filter((l, i) => l.target !== nominal[i].target).length;
    if (fast) {
        console.log(`[levels] 短程试算 ${levels.length} 关，1 种子 × 30 锁，通关率 ${(stats.one * 100).toFixed(1)}%`);
        return;
    }
    const missing = levels.filter(level => !measured.get(level.id)?.won[0]);
    if (missing.length) {
        throw new Error(`正式种子缺少可复现通关操作：${missing.map(level => level.id).join(', ')}`);
    }

    const ids = new Set(levels.map((l) => l.id));
    const names = new Set(levels.map((l) => l.name));
    if (levels.length !== 120 || ids.size !== 120 || names.size !== 120) {
        throw new Error(`关卡数量/唯一性校验失败：${levels.length}/${ids.size}/${names.size}`);
    }

    writeTable(levels);
    writeCsv(levels);
    writeReport(levels, stats, adjustments, nominal);

    const byGoal = new Map<string, { hit: number; total: number }>();
    for (const l of levels) {
        const slot = byGoal.get(l.goalType) ?? { hit: 0, total: 0 };
        slot.total++;
        if ((stats.perLevel.get(l.id)?.one ?? 0) >= 0.6) slot.hit++;
        byGoal.set(l.goalType, slot);
    }
    const goalText = Array.from(byGoal.entries())
        .map(([k, v]) => `${k} ${((v.hit / v.total) * 100).toFixed(0)}%`)
        .join(' / ');
    console.log(`[levels] 120 关已生成；1★ ${(stats.one * 100).toFixed(1)}% / 2★ ${(stats.two * 100).toFixed(1)}% / 3★ ${(stats.three * 100).toFixed(1)}%`);
    console.log(`[levels] 分目标通过：${goalText}；标定改动 ${adjustments} 关`);
    if (stats.one < 0.9) console.warn('[levels] 警告：1★ 可达率低于 90%，报告已记录');
}

main();
