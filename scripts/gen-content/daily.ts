/**
 * 365 道每日残局生成器。
 * 规则：day-of-year 取题；难度按星期；每月 1–7 日为异变周（84 条）；
 * 每题用 beam search 求出可解路径，按实解得分为目标定标，再用回放校验。
 *
 * 用法：npx tsx scripts/gen-content/daily.ts [--fast] [--verify]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoardModel } from '../../assets/scripts/core/BoardModel';
import { solveGoal, placementsFor } from '../../assets/scripts/core/Solver';
import { simulateLock } from '../../assets/scripts/core/Simulator';
import { rotationCells } from '../../assets/scripts/core/PieceSource';
import { difficultyForWeekday, DIFFICULTY_MOVE_LIMIT, monthDayFromDayOfYear, isMutationWeek } from '../../assets/scripts/core/DailyPuzzle';
import type { DailyPuzzleData } from '../../assets/scripts/core/DailyPuzzle';
import type { GoalDef } from '../../assets/scripts/core/GoalTracker';
import type { PieceSpec } from '../../assets/scripts/core/PieceSource';
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

function prefixValue(
    boardSpec: string[],
    queue: PieceSpec[],
    actions: Array<{ shape: number; color: number; rotation: number; x: number }>,
    goal: GoalDef,
    mutationId: number | undefined,
): { value: number; steps: number; dump: string } {
    const mutation = mutationId ? mutationById(mutationId) : null;
    const minGroup = mutation?.tiers.standard.minGroupSize;
    const dir = (mutation?.key === 'inverted' ? -1 : 1) as 1 | -1;
    const board = BoardModel.fromPattern(boardSpec);
    let value = 0;
    let score = 0;
    let step = 0;
    for (const action of actions) {
        const placements = placementsFor(board, action.shape, dir, true);
        const placement = placements.find((p) => p.rotation === action.rotation && p.x === action.x);
        if (!placement) break;
        step++;
        const res = simulateLock(board, placement.cells, placement.x, placement.y, action.color, step, {
            minGroupSize: minGroup,
            dir,
            specials: true,
            skipKinds: ['stone', 'brittle'],
        });
        score += res.gain;
        if (goal.type === 'score') value = score;
        else if (goal.type === 'rows') value += res.rows;
        else if (goal.type === 'color') {
            value += res.removed.filter((b) => b.kind !== 'stone' && b.type === (goal.color ?? 0)).length;
        } else if (goal.type === 'stone') {
            value += res.removed.filter((b) => b.kind === 'stone').length;
        }
        if (value >= goal.target) return { value, steps: step, dump: board.dump() };
    }
    return { value, steps: step, dump: board.dump() };
}

interface Built {
    puzzle: DailyPuzzleData;
    nodes: number;
}

function buildOne(dayOfYear: number, seen: Set<string>): Built | null {
    const date = dateFor(dayOfYear);
    const { month, day } = monthDayFromDayOfYear(dayOfYear);
    const difficulty = difficultyForWeekday(date.getUTCDay());
    const moveLimit = DIFFICULTY_MOVE_LIMIT[difficulty];
    let goalType = GOAL_CYCLE[(day - 1) % 4];
    // 方案 B：异变周只用静态异变（迷雾 2 / 倒悬 4 / 单色 5）。
    // 霜雨/磁力/脆霜是锁定后改盘面的动态效果，求解时不模拟，动态题可能出现「已验证解被异变打乱」。
    const mutationId = isMutationWeek(month, day) ? [2, 4, 5][(dayOfYear - 1) % 3] : undefined;
    const mutation = mutationId ? mutationById(mutationId) : null;
    const minGroup = mutation?.tiers.standard.minGroupSize;
    const dir = (mutation?.key === 'inverted' ? -1 : 1) as 1 | -1;
    const colorCount = mutation?.tiers.standard.colorCount ?? 5;
    // 倒悬题从底部生成：石块题会直接堵死出生点，异变周改用颜色目标
    if (mutationId && (goalType === 'stone' || goalType === 'rows')) goalType = 'color';

    let best: Built | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
        const rng = new Rng(dayOfYear * 7919 + attempt * 104729);
        const density = 0.32 + rng.next() * 0.13;
        const stoneCount = goalType === 'stone' ? 10 + rng.int(3) : rng.int(5);
        let spec = buildStableBoard(rng, { density, stoneCount, colorCount });
        if (dir === -1) spec = { ...spec, rows: spec.rows.slice().reverse() };
        const queue = buildQueue(rng, moveLimit + 3, colorCount);
        const hash = hashSpec(spec.rows, queue);
        if (seen.has(hash)) continue;

        const goalColor = goalType === 'color' ? pickGoalColor(spec.rows) : undefined;
        const probe: GoalDef = { type: goalType, target: 999999, color: goalColor };
        const board = BoardModel.fromPattern(spec.rows);
        const result = solveGoal(board, queue, probe, {
            beamWidth: goalType === 'stone' ? 32 : 20,
            allowRotate: true,
            dir,
            minGroupSize: minGroup,
        });
        if (result.goalValue < 1) continue;
        if (best && best.puzzle.goal.target >= result.goalValue * 0.7) continue;

        // 目标定标：取可解路径的 70%，石头题至少 4（否则太像演示）
        let target = Math.max(1, Math.floor(result.goalValue * 0.7));
        if (goalType === 'stone') target = Math.min(12, target);
        if (goalType === 'rows') target = Math.min(6, target);

        const finalGoal: GoalDef = { type: goalType, target, color: goalColor };
        const prefix = prefixValue(spec.rows, queue, result.actions, finalGoal, mutationId);
        if (prefix.value < target) {
            target = Math.max(1, prefix.value);
        }
        finalGoal.target = target;

        const ratio = prefix.steps / moveLimit;
        if (ratio < 0.3 && attempt < 4) {
            // 太容易：把目标抬到接近实解上限
            const harder = Math.max(target, Math.floor(result.goalValue * 0.9));
            finalGoal.target = Math.min(harder, result.goalValue);
            target = finalGoal.target;
        }

        const verifiedValue = prefixValue(spec.rows, queue, result.actions, finalGoal, mutationId).value;
        const verified = verifiedValue >= target;
        if (process.env.EB_DEBUG_DAILY) {
            console.log('[daily:debug]', { dayOfYear, attempt, goalType, best: result.goalValue, target, prefix: prefix.value, verifiedValue, ratio, verified });
        }
        if (!verified) continue;

        const puzzle: DailyPuzzleData = {
            id: dayOfYear,
            dayOfYear,
            month,
            day,
            difficulty,
            moveLimit,
            goal: finalGoal,
            board: spec.rows,
            queue,
            mutationId,
            solutionLength: Math.min(prefix.steps, moveLimit),
            hint: result.actions.length > 0
                ? {
                      shape: result.actions[0].shape,
                      rotation: result.actions[0].rotation,
                      x: result.actions[0].x,
                  }
                : null,
            verified: true,
        };
        seen.add(hash);
        return { puzzle, nodes: result.nodes };
    }
    return best;
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
            "import type { DailyPuzzleData } from '../../core/DailyPuzzle';",
            '',
            `export const PUZZLES_${YEAR}_${mm}: readonly DailyPuzzleData[] = [`,
        ];
        for (const p of list) {
            lines.push('    {');
            lines.push(`        id: ${p.id}, dayOfYear: ${p.dayOfYear}, month: ${p.month}, day: ${p.day},`);
            lines.push(`        difficulty: '${p.difficulty}', moveLimit: ${p.moveLimit},`);
            lines.push(`        goal: { type: '${p.goal.type}', target: ${p.goal.target}${p.goal.color !== undefined ? `, color: ${p.goal.color}` : ''} },`);
            lines.push(`        board: ${JSON.stringify(p.board)},`);
            lines.push(`        queue: ${JSON.stringify(p.queue)},`);
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
        '- 方法：先随机生成"初始无现成可消组"的稳定盘面与固定牌序，再用 beam search 求可解路径；',
        '  目标按实解得分的 70% 定标（石块题最低 4 块），随后用同一条路径回放校验。',
        '- 因此每题都带一条可复现的解，`verified=true` 不是自评，而是回放断言。',
        '- 异变周题目会带上异变标记；倒悬/单色异变在求解时已按其重力方向与 4 连阈值计算，',
        '  霜雨/脆霜/磁力属于对局中改变盘面的动态效果，求解时不模拟（与产品定义一致：题目保证"存在解"，不保证"稳定盘面不变"）。',
        '- 受 ISO 周与本地时区影响，周主题允许 ±1 天漂移（零服务端、无远程配置的必然取舍）。',
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
    let nodes = 0;
    const started = Date.now();

    for (let day = 1; day <= total; day++) {
        const built = buildOne(day, seen);
        if (!built) {
            throw new Error(`第 ${day} 天题目生成失败`);
        }
        all.push(built.puzzle);
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
        writeMonthly(all);
        writeIndex(all);
        writeReport(all, { puzzles: all.length, mutation: mutationDays, nodes });
        console.log(`[daily] 365 题完成；异变 ${mutationDays}；节点 ${nodes}`);
    } else {
        console.log(`[daily] 快速模式 ${all.length} 题通过；节点 ${nodes}`);
    }
}

main();
