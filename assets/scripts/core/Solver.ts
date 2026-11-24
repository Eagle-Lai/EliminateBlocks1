/**
 * 内容求解器：beam search + 贪心机器人。
 * 用途：生成每日残局的可解证明、校验 120 关目标可达率。
 * 与运行时共享 Simulator，因此"求解通过"等于"游戏内可复现"。
 */
import type { BoardModel } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import type { GoalDef } from './GoalTracker';
import { rotationCells, type PieceSpec } from './PieceSource';
import { applyBurst, dropY, simulateLock, simulateSettle, type SimLockResult } from './Simulator';
import { SHAPES, shapeWidth } from '../config/PieceShapeTable';
import { Rng } from '../utils/Rng';

export interface Placement {
    rotation: number;
    x: number;
    y: number;
    cells: Cell[];
}

export interface SolveAction {
    shape: number;
    color: number;
    rotation: number;
    x: number;
}

export interface SolveResult {
    solved: boolean;
    goalValue: number;
    score: number;
    steps: number;
    actions: SolveAction[];
    board: BoardModel;
    nodes: number;
}

export interface SolveOptions {
    beamWidth?: number;
    allowRotate?: boolean;
    maxSteps?: number;
    dir?: 1 | -1;
    minGroupSize?: number;
}

/** 枚举一块骨牌的所有合法落点（去重） */
export function placementsFor(
    board: BoardModel,
    shapeIndex: number,
    dir: 1 | -1 = 1,
    allowRotate = true,
): Placement[] {
    const seen = new Set<string>();
    const out: Placement[] = [];
    const rotCount = allowRotate ? 4 : 1;
    for (let rotation = 0; rotation < rotCount; rotation++) {
        const cells = rotationCells(shapeIndex, rotation);
        const w = shapeWidth(cells);
        for (let x = 0; x <= board.cols - w; x++) {
            const startY = dir === 1 ? 0 : board.rows - 1;
            let blocked = false;
            for (const p of cells) {
                const nr = startY + (dir === 1 ? p.r : -p.r);
                if (board.get(nr, x + p.c)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;
            const y = dropY(board, cells, x, startY, dir);
            const key = `${rotation}:${x}:${y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ rotation, x, y, cells });
        }
    }
    return out;
}

function goalDelta(
    goal: GoalDef,
    result: SimLockResult,
    extra: { bursts: number } = { bursts: 0 },
): number {
    switch (goal.type) {
        case 'score':
            return result.gain;
        case 'rows':
            return result.rows;
        case 'color':
            return result.removed.filter((b) => b.kind !== 'stone' && b.type === (goal.color ?? 0)).length;
        case 'stone':
            return result.removed.filter((b) => b.kind === 'stone').length;
        case 'special':
            return result.specials;
        case 'burst':
            return extra.bursts;
        default:
            return 0;
    }
}

/** 盘面启发值：越低越平越好（负分越小越好） */
export function boardScore(board: BoardModel): number {
    let heightSum = 0;
    let holes = 0;
    for (let c = 0; c < board.cols; c++) {
        let firstFilled = -1;
        for (let r = 0; r < board.rows; r++) {
            if (board.get(r, c)) {
                firstFilled = r;
                break;
            }
        }
        if (firstFilled < 0) continue;
        heightSum += board.rows - firstFilled;
        for (let r = firstFilled + 1; r < board.rows; r++) {
            if (!board.get(r, c)) holes++;
        }
    }
    // 接近填满的行更有价值（帮助 rows 目标）
    let rowPotential = 0;
    for (let r = 0; r < board.rows; r++) {
        let filled = 0;
        for (let c = 0; c < board.cols; c++) if (board.get(r, c)) filled++;
        if (filled >= board.cols - 3) rowPotential += (filled - (board.cols - 4)) * 4;
    }
    return -heightSum * 2 - holes * 6 + rowPotential;
}

interface Beam {
    board: BoardModel;
    score: number;
    goalValue: number;
    actions: SolveAction[];
}

/** Beam search：对固定队列求解目标 */
export function solveGoal(
    initial: BoardModel,
    queue: readonly PieceSpec[],
    goal: GoalDef,
    opts: SolveOptions = {},
): SolveResult {
    const beamWidth = opts.beamWidth ?? 32;
    const dir = opts.dir ?? 1;
    const allowRotate = opts.allowRotate !== false;
    const maxSteps = Math.min(opts.maxSteps ?? queue.length, queue.length);

    let beams: Beam[] = [{ board: initial.clone(), score: 0, goalValue: 0, actions: [] }];
    let nodes = 0;
    let best: Beam = beams[0];

    if (goal.type === 'score' && goal.target <= 0) {
        return { solved: true, goalValue: 0, score: 0, steps: 0, actions: [], board: initial.clone(), nodes };
    }

    for (let step = 0; step < maxSteps; step++) {
        const spec = queue[step];
        const next: Beam[] = [];
        for (const beam of beams) {
            const placements = placementsFor(beam.board, spec.shape, dir, allowRotate);
            for (const placement of placements) {
                nodes++;
                const board = beam.board.clone();
                const result = simulateLock(
                    board,
                    placement.cells,
                    placement.x,
                    placement.y,
                    spec.color,
                    step + 1,
                    {
                        dir,
                        minGroupSize: opts.minGroupSize,
                        skipKinds: ['stone', 'brittle'],
                        specials: true,
                    },
                );
                const goalValue = beam.goalValue + goalDelta(goal, result);
                const score = beam.score + result.gain;
                const actions = beam.actions.concat({
                    shape: spec.shape,
                    color: spec.color,
                    rotation: placement.rotation,
                    x: placement.x,
                });
                next.push({ board, score, goalValue, actions });
                if (goalValue >= goal.target) {
                    return { solved: true, goalValue, score, steps: step + 1, actions, board, nodes };
                }
            }
        }
        if (next.length === 0) break;
        next.sort((a, b) => {
            if (b.goalValue !== a.goalValue) return b.goalValue - a.goalValue;
            const ha = boardScore(a.board) + a.score * 0.02;
            const hb = boardScore(b.board) + b.score * 0.02;
            return hb - ha;
        });
        beams = next.slice(0, beamWidth);
        best = beams[0];
    }

    return {
        solved: false,
        goalValue: best.goalValue,
        score: best.score,
        steps: best.actions.length,
        actions: best.actions,
        board: best.board,
        nodes,
    };
}

/**
 * 贪心机器人：每锁枚举全部落点，按（盘面健康 + 即时收益 + 目标进度）选最优。
 * 糖能满时自动释放（Lv1 清最多颜色；第 2/3 次带一圈），这样才能评估 burst 目标。
 */
export class GreedyBot {
    constructor(
        private readonly seed: number,
        private readonly opts: { dir?: 1 | -1; minGroupSize?: number } = {},
    ) {}

    play(
        initial: BoardModel,
        locks: number,
        goal: GoalDef,
        colorCount = 5,
    ): { done: boolean; goalValue: number; score: number; steps: number; topOut: boolean; bursts: number } {
        const rng = new Rng(this.seed);
        const board = initial.clone();
        let goalValue = 0;
        let score = 0;
        let steps = 0;
        let bursts = 0;
        let sugar = 0;
        const dir = this.opts.dir ?? 1;

        for (let i = 0; i < locks; i++) {
            const shape = rng.int(SHAPES.length);
            const color = rng.int(colorCount);
            const placements = placementsFor(board, shape, dir, true);
            if (placements.length === 0) return { done: false, goalValue, score, steps, topOut: true, bursts };

            let best = placements[0];
            let bestValue = -Infinity;
            for (const placement of placements) {
                const probe = board.clone();
                const result = simulateLock(probe, placement.cells, placement.x, placement.y, color, i + 1, {
                    dir,
                    minGroupSize: this.opts.minGroupSize,
                    skipKinds: ['stone', 'brittle'],
                    specials: true,
                });
                const delta = goalDelta(goal, result);
                const value = boardScore(probe) + result.gain * 0.05 + delta * 120;
                if (value > bestValue) {
                    bestValue = value;
                    best = placement;
                }
            }

            const result = simulateLock(board, best.cells, best.x, best.y, color, i + 1, {
                dir,
                minGroupSize: this.opts.minGroupSize,
                skipKinds: ['stone', 'brittle'],
                specials: true,
            });
            goalValue += goalDelta(goal, result);
            score += result.gain;
            steps++;

            sugar = Math.min(100, sugar + result.removedCells * 2 + result.chains * 4);
            if (sugar >= 100) {
                const radius = bursts >= 1 ? 1 : 0;
                applyBurst(board, dominantColorOf(board), radius);
                const after = simulateSettle(board, {
                    dir,
                    minGroupSize: this.opts.minGroupSize,
                    skipKinds: ['stone', 'brittle'],
                    specials: true,
                });
                bursts++;
                sugar = 0;
                score += after.gain;
                goalValue += goalDelta(goal, after, { bursts: 1 });
            }

            if (goalValue >= goal.target) return { done: true, goalValue, score, steps, topOut: false, bursts };

            let topFilled = true;
            for (let c = 0; c < board.cols; c++) {
                if (!board.get(0, c)) {
                    topFilled = false;
                    break;
                }
            }
            if (topFilled) return { done: false, goalValue, score, steps, topOut: true, bursts };
        }
        return { done: false, goalValue, score, steps, topOut: false, bursts };
    }
}

function dominantColorOf(board: BoardModel): number {
    const counts = board.countByColor();
    let best = 0;
    let bestCount = -1;
    for (let i = 0; i < counts.length; i++) {
        const n = counts[i] ?? 0;
        if (n > bestCount) {
            bestCount = n;
            best = i;
        }
    }
    return best;
}

