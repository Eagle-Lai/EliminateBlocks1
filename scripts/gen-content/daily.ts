/**
 * 365 道每日残局生成器。
 * 规则：day-of-year 取题；难度按星期；每月 1–7 日为异变周（84 条）；
 * 每题用 beam search 求出可解路径，按实解得分为目标定标，再用回放校验。
 *
 * 用法：npx tsx scripts/gen-content/daily.ts [--fast]；复核已发布内容用 npm run verify:content。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoardModel } from '../../assets/scripts/core/BoardModel';
import { solveGoal, placementsFor } from '../../assets/scripts/core/Solver';
import { replayDaily, type Move } from './daily-proof';
import { QueuePieceSource } from '../../assets/scripts/core/PieceSource';
import { difficultyForWeekday, DIFFICULTY_MOVE_LIMIT, solutionRatioRange, monthDayFromDayOfYear, isMutationWeek } from '../../assets/scripts/core/DailyPuzzle';
import type { DailyPuzzleData } from '../../assets/scripts/core/DailyPuzzle';
import type { GoalDef } from '../../assets/scripts/core/GoalTracker';
import { mutationById } from '../../assets/scripts/config/MutationTable';
import { Rng } from '../../assets/scripts/utils/Rng';
import { buildQueue, buildStableBoard, hashSpec, quantile } from './lib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const YEAR = 2027;

const GOAL_CYCLE: GoalDef['type'][] = ['color', 'rows', 'score', 'stone'];

function dateFor(dayOfYear: number): Date {
    return new Date(Date.UTC(YEAR, 0, 1) + (dayOfYear - 1) * 86400000);
}

/** 目标色：盘面里第二多的颜色（保证有足够供给） */
function pickGoalColor(board: string[]): number {
    const counts = [0, 0, 0, 0, 0];
    for (const row of board) {
        for (const ch of row) {
            if (ch >= '0' && ch <= '4') counts[Number(ch)]++;
        }
    }
    const order = [0, 1, 2, 3, 4].sort((a, b) => counts[b] - counts[a]);
    return order[1] ?? 0;
}


interface Built {
    puzzle: DailyPuzzleData;
    witness: Move[];
    nodes: number;
}

function buildOne(dayOfYear: number, seen: Set<string>): Built {
    const { month, day } = monthDayFromDayOfYear(dayOfYear);
    const difficulty = difficultyForWeekday(dateFor(dayOfYear).getUTCDay());
    const moveLimit = DIFFICULTY_MOVE_LIMIT[difficulty];
    const range = solutionRatioRange(difficulty);
    const minSteps = Math.ceil(moveLimit * range.min);
    const maxSteps = Math.floor(moveLimit * range.max);
    const mutationId = isMutationWeek(month, day) ? [2, 4, 5][(dayOfYear - 1) % 3] : undefined;
    const mutation = mutationId ? mutationById(mutationId) : null;
    const dir = mutation?.key === 'inverted' ? -1 : 1;
    const colorCount = mutation?.tiers.standard.colorCount ?? 5;
    let goalType = GOAL_CYCLE[(day - 1) % 4];
    if (mutation && (goalType === 'rows' || goalType === 'stone')) goalType = 'color';
    let nodes = 0;
    for (let attempt = 0; attempt < 256; attempt++) {
        const rng = new Rng(dayOfYear * 7919 + attempt * 104729);
        const spec = buildStableBoard(rng, {
            density: 0.32 + rng.next() * 0.13,
            stoneCount: goalType === 'stone' ? 10 + rng.int(3) : rng.int(5),
            colorCount,
        });
        const board = dir === 1 ? spec.rows : spec.rows.reverse();
        const queue = buildQueue(rng, moveLimit, colorCount);
        const key = hashSpec(board, queue);
        if (seen.has(key)) continue;
        const goal: GoalDef = { type: goalType, target: 999999 };
        if (goalType === 'color') goal.color = pickGoalColor(board);
        const puzzle = { id: dayOfYear, dayOfYear, month, day, difficulty, moveLimit, goal, board, queue, mutationId };
        const center = QueuePieceSource.build(queue[0], board[0].length, 1).x;
        if (replayDaily(puzzle, [[0, center]]).cleared[0]) continue;
        const initial = BoardModel.fromPattern(board);
        // Prevent a single placement, including a deliberate rotation, from completing the puzzle.
        const bestFirst = Math.max(...placementsFor(initial, queue[0].shape, dir).map(p =>
            replayDaily(puzzle, [[p.rotation, p.x]]).values[0]));
        const result = solveGoal(initial, queue, goal, {
            beamWidth: goalType === 'rows' ? 12 : 5,
            maxSteps, dir, minGroupSize: mutation?.tiers.standard.minGroupSize,
        });
        nodes += result.nodes;
        const moves: Move[] = result.actions.map(a => [a.rotation, a.x]);
        const { values } = replayDaily(puzzle, moves);
        const final = values[values.length - 1] ?? 0;
        const beforeMin = values[minSteps - 2] ?? 0;
        const target = Math.max(goalType === 'stone' ? 4 : 1, bestFirst + 1, beforeMin + 1, Math.floor(final * 0.75));
        const length = values.findIndex(v => v >= target) + 1;
        if (length < minSteps || length > maxSteps) continue;
        goal.target = target;
        const witness = moves.slice(0, length);
        const [rotation, x] = witness[0];
        seen.add(key);
        return {
            puzzle: { ...puzzle, solutionLength: length, hint: { shape: queue[0].shape, rotation, x }, verified: true },
            witness, nodes,
        };
    }
    throw Error(`第 ${dayOfYear} 题未找到符合开局与限步条件的解答`);
}

function writeMonthly(all: DailyPuzzleData[]): void {
    mkdirSync(join(ROOT, 'assets/scripts/config/daily'), { recursive: true });
    const months = new Map<number, DailyPuzzleData[]>();
    for (const p of all) {
        const list = months.get(p.month) ?? [];
        list.push(p);
        months.set(p.month, list);
    }
    for (let m = 1; m <= 12; m++) {
        const list = months.get(m) ?? [];
        const mm = m < 10 ? `0${m}` : `${m}`;
        const lines = [
            '/**',
            ` * ${YEAR} 年 ${m} 月每日残局（自动生成，勿手改）。`,
            ' * 生成器：scripts/gen-content/daily.ts',
            ' */',
            "import { unpackDailyBoard, unpackDailyQueue, type DailyPuzzleData } from '../../core/DailyPuzzle';",
            '',
            `export const PUZZLES_${YEAR}_${mm}: readonly DailyPuzzleData[] = [`,
        ];
        for (const p of list) {
            lines.push('    {');
            lines.push(`        id: ${p.id}, dayOfYear: ${p.dayOfYear}, month: ${p.month}, day: ${p.day},`);
            lines.push(`        difficulty: '${p.difficulty}', moveLimit: ${p.moveLimit},`);
            lines.push(`        goal: { type: '${p.goal.type}', target: ${p.goal.target}${p.goal.color !== undefined ? `, color: ${p.goal.color}` : ''} },`);
            const packedBoard = p.board.join('').replace(/\.{10}/g, '~');
            const packedQueue = p.queue.map(piece => `${piece.shape}${piece.color}`).join('');
            lines.push(`        board: unpackDailyBoard('${packedBoard}'),`);
            const compact = p.queue.every(piece => piece.x === undefined && /^[0-9]$/.test(String(piece.shape)) && /^[0-9]$/.test(String(piece.color)));
            const queue = compact ? `unpackDailyQueue('${packedQueue}')` : JSON.stringify(p.queue);
            lines.push(`        queue: ${queue},`);
            if (p.mutationId) lines.push(`        mutationId: ${p.mutationId},`);
            lines.push(`        solutionLength: ${p.solutionLength},`);
            lines.push(`        hint: ${JSON.stringify(p.hint)},`);
            lines.push('        verified: true,');
            lines.push('    },');
        }
        lines.push('];');
        lines.push('');
        writeFileSync(join(ROOT, `assets/scripts/config/daily/${YEAR}-${mm}.ts`), lines.join('\n'), 'utf8');
    }
}

function writeIndex(all: DailyPuzzleData[]): void {
    const lines = [
        '/**',
        ' * 365 题索引（自动生成，勿手改）：只放轻量字段，题目正文在 daily/YYYY-MM.ts。',
        ' */',
        'export interface DailyIndexEntry {',
        '    dayOfYear: number;',
        '    month: number;',
        '    day: number;',
        '    difficulty: \'easy\' | \'medium\' | \'mediumPlus\' | \'hard\';',
        '    goalType: \'score\' | \'rows\' | \'color\' | \'special\' | \'burst\' | \'stone\';',
        '    target: number;',
        '    monthFile: string;',
        '    puzzleId: number;',
        '    mutationId?: number;',
        '}',
        '',
        'export const DAILY_INDEX: readonly DailyIndexEntry[] = [',
    ];
    for (const p of all) {
        const mm = p.month < 10 ? `0${p.month}` : `${p.month}`;
        lines.push(
            `    { dayOfYear: ${p.dayOfYear}, month: ${p.month}, day: ${p.day}, difficulty: '${p.difficulty}', ` +
                `goalType: '${p.goal.type}', target: ${p.goal.target}, monthFile: '${YEAR}-${mm}', puzzleId: ${p.id}` +
                (p.mutationId ? `, mutationId: ${p.mutationId}` : '') +
                ' },',
        );
    }
    lines.push('];');
    lines.push('');
    lines.push('export function indexForDay(dayOfYear: number): DailyIndexEntry | null {');
    lines.push('    const day = dayOfYear === 366 ? 59 : dayOfYear;');
    lines.push('    return DAILY_INDEX.find((e) => e.dayOfYear === day) ?? null;');
    lines.push('}');
    lines.push('');
    writeFileSync(join(ROOT, 'assets/scripts/config/DailyIndex.ts'), lines.join('\n'), 'utf8');
}

function writeReport(all: DailyPuzzleData[], stats: { puzzles: number; mutation: number; nodes: number }): void {
    const byGoal = new Map<string, number>();
    const byDiff = new Map<string, number>();
    const byMonth = new Map<number, Set<string>>();
    for (const p of all) {
        byGoal.set(p.goal.type, (byGoal.get(p.goal.type) ?? 0) + 1);
        byDiff.set(p.difficulty, (byDiff.get(p.difficulty) ?? 0) + 1);
        const set = byMonth.get(p.month) ?? new Set<string>();
        set.add(p.goal.type);
        byMonth.set(p.month, set);
    }
    const ratios = all.map((p) => p.solutionLength / p.moveLimit);
    const md = [
        '# 365 道每日残局生成报告',
        '',
        `- 题目数：${stats.puzzles}`,
        `- 异变题：${stats.mutation}（每月 1–7 日）`,
        `- 目标分布：${Array.from(byGoal.entries()).map(([k, v]) => `${k} ${v}`).join(' / ')}`,
        `- 难度分布：${Array.from(byDiff.entries()).map(([k, v]) => `${k} ${v}`).join(' / ')}`,
        `- 每月目标齐全（4 类）：${Array.from(byMonth.entries()).every(([, s]) => s.size >= 4) ? '是' : '否'}`,
        `- 解长比例：中位 ${quantile(ratios, 0.5).toFixed(2)}，P10 ${quantile(ratios, 0.1).toFixed(2)}，P90 ${quantile(ratios, 0.9).toFixed(2)}`,
        `- 求解节点数：${stats.nodes}`,
        `- 全部 verified：${all.every((p) => p.verified) ? '是' : '否'}`,
        '',
        '## 说明',
        '',
        '- 每题初盘按重力堆稳，并留空列。默认首落不触发消除，单次合法候选落点的目标进度均低于目标。',
        '- 参考解从居中出生逐次旋转、逐格平移和硬降，在该题的步数限制及异变规则下首次达标。解长表示这条见证的长度。',
        '- 完整操作存于 scripts/gen-content/daily-solutions.json，可用 npm run verify:content 重新回放。题包及周难度按 2027 日历复用。',
        '',
        '## 每月题数',
        '',
        '| 月 | 题数 | 目标类型数 |',
        '|---|---|---|',
        ...Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const list = all.filter((p) => p.month === m);
            return `| ${m} | ${list.length} | ${byMonth.get(m)?.size ?? 0} |`;
        }),
    ];
    writeFileSync(join(ROOT, 'docs/daily-report.md'), md.join('\n'), 'utf8');
}

function main(): void {
    const fast = process.argv.indexOf('--fast') >= 0;
    const total = fast ? 30 : 365;
    mkdirSync(join(ROOT, 'docs'), { recursive: true });
    const seen = new Set<string>();
    const all: DailyPuzzleData[] = [];
    const witnesses: Record<number, Move[]> = {};
    let nodes = 0;
    const started = Date.now();

    for (let day = 1; day <= total; day++) {
        const built = buildOne(day, seen);
        if (!built) {
            throw new Error(`第 ${day} 天题目生成失败`);
        }
        all.push(built.puzzle);
        witnesses[day] = built.witness;
        nodes += built.nodes;
        if (day % 10 === 0 || day === total) {
            const elapsed = ((Date.now() - started) / 1000).toFixed(1);
            console.log(`[daily] ${day}/${total}（${elapsed}s）`);
        }
    }

    if (!fast) {
        if (all.length !== 365) throw new Error(`题目数不足：${all.length}`);
        const mutationDays = all.filter((p) => p.mutationId).length;
        if (mutationDays !== 84) throw new Error(`异变题数不正确：${mutationDays}`);
        writeFileSync(join(ROOT, 'scripts/gen-content/daily-solutions.json'), JSON.stringify(witnesses) + '\n');
        writeMonthly(all);
        writeIndex(all);
        writeReport(all, { puzzles: all.length, mutation: mutationDays, nodes });
        console.log(`[daily] 365 题完成；异变 ${mutationDays}；节点 ${nodes}`);
    } else {
        console.log(`[daily] 快速模式 ${all.length} 题通过；节点 ${nodes}`);
    }
}

main();
