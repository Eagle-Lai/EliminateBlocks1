/**
 * 内容求解器：beam search + 贪心机器人。
 * 用途：生成每日残局的可解证明、校验 120 关目标可达率。
 * 与运行时共享 Simulator，因此"求解通过"等于"游戏内可复现"。
 */
import type { BoardModel } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import type { GoalDef } from './GoalTracker';
import { QueuePieceSource, type PieceSpec } from './PieceSource';
import { collides, legalPose, dropYForPose } from './CollisionService';
import { tryRotate } from './Rotator';
import { TUNING } from '../config/GameTuning';
import { applyBurst, dropY, lastLockCell, simulateLock, simulateSettle, type SimLockResult } from './Simulator';
import { MutationRuntime } from './MutationRuntime';
import { PieceFactory } from './PieceFactory';
import { SugarEnergy } from './SugarEnergy';
import { TalentService } from './TalentService';
import { applyGravity } from './GravityResolver';
import type { MutationTier } from '../config/MutationTable';
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

/** 枚举在出生位置旋转、水平移动、硬降可达的落点。 */
export function placementsFor(
    board: BoardModel,
    shapeIndex: number,
    dir: 1 | -1 = 1,
    allowRotate = true,
    mutation: MutationRuntime | null = null,
    initialX?: number,
): Placement[] {
    // Each offered placement can be played by rotating at spawn, then walking
    // horizontally and hard-dropping. Never teleport past blocked columns.
    const piece = QueuePieceSource.build({ shape: shapeIndex, color: 0, x: initialX }, board.cols, 1);
    piece.y = dir === 1 ? 0 : board.rows - 1;
    const valid = (cells: readonly Cell[], x: number, y: number) => mutation
        ? legalPose(board, cells, x, y, mutation) : !collides(board, cells, x, y, dir);
    if (!valid(piece.cells, piece.x, piece.y)) return [];
    const seen = new Set<string>();
    const out: Placement[] = [];
    const rotCount = allowRotate ? 4 : 1;
    for (let rotation = 0; rotation < rotCount; rotation++) {
        if (rotation > 0 && !tryRotate(piece, board, dir, valid)) break;
        const cells = piece.cells;
        let left = piece.x;
        let right = piece.x;
        while (valid(cells, left - 1, piece.y)) left--;
        while (valid(cells, right + 1, piece.y)) right++;
        for (let x = left; x <= right; x++) {
            const y = mutation ? dropYForPose(board, cells, x, piece.y, mutation) : dropY(board, cells, x, piece.y, dir);
            if (cells.some(p => !board.inBounds(y + dir * p.r, x + p.c))) continue;
            const indices = cells.map(p => (y + dir * p.r) * board.cols + x + p.c);
            const anchorIndex = indices[indices.length - 1];
            const key = anchorIndex + ':' + indices.sort((a, b) => a - b).join(',');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ rotation, x, y, cells });
        }
    }
    return out;
}

export function goalDelta(
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
export function boardScore(board: BoardModel, dir: 1 | -1 = 1): number {
    let heightSum = 0;
    let holes = 0;
    for (let c = 0; c < board.cols; c++) {
        let firstFilled = -1;
        for (let r = 0; r < board.rows; r++) {
            if (board.get(dir === 1 ? r : board.rows - 1 - r, c)) {
                firstFilled = r;
                break;
            }
        }
        if (firstFilled < 0) continue;
        heightSum += board.rows - firstFilled;
        for (let r = firstFilled + 1; r < board.rows; r++) {
            if (!board.get(dir === 1 ? r : board.rows - 1 - r, c)) holes++;
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
    rank: number;
    sugar: number;
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

    let beams: Beam[] = [{ board: initial.clone(), score: 0, goalValue: 0, actions: [], rank: 0, sugar: 0 }];
    let nodes = 0;
    let best: Beam = beams[0];

    if (goal.type === 'score' && goal.target <= 0) {
        return { solved: true, goalValue: 0, score: 0, steps: 0, actions: [], board: initial.clone(), nodes };
    }

    for (let step = 0; step < maxSteps; step++) {
        const spec = queue[step];
        const next: Beam[] = [];
        for (const beam of beams) {
            const placements = placementsFor(beam.board, spec.shape, dir, allowRotate, null, spec.x);
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
                        level: 1 + Math.floor(beam.score / TUNING.level.threshold),
                    },
                );
                const energy = new SugarEnergy();
                energy.restore(beam.sugar, 0);
                const bonus = energy.full ? TUNING.sugar.lockBonus : 0;
                energy.add(result.removedCells, result.chainSum);
                const score = beam.score + result.gain + bonus;
                const goalValue = goal.type === 'score' ? score : beam.goalValue + goalDelta(goal, result);
                const actions = beam.actions.concat({
                    shape: spec.shape,
                    color: spec.color,
                    rotation: placement.rotation,
                    x: placement.x,
                });
                next.push({ board, score, goalValue, actions, rank: boardScore(board, dir) + score * 0.02, sugar: energy.value });
                if (goalValue >= goal.target) {
                    return { solved: true, goalValue, score, steps: step + 1, actions, board, nodes };
                }
            }
        }
        if (next.length === 0) break;
        next.sort((a, b) => {
            if (b.goalValue !== a.goalValue) return b.goalValue - a.goalValue;
            return b.rank - a.rank;
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

export type BotAction = { type: 'lock'; rotation: number; x: number } | { type: 'burst'; color: number };

export class GreedyBot {
    constructor(
        private readonly seed: number,
        private readonly opts: { dir?: 1 | -1; minGroupSize?: number; mutationId?: number; tier?: MutationTier } = {},
    ) {}

    play(initial: BoardModel, locks: number, goal: GoalDef, colorCount = 5) {
        const rng = new Rng(this.seed);
        const mutation = this.opts.mutationId ? new MutationRuntime(this.opts.mutationId, this.opts.tier ?? 'standard', rng) : null;
        const board = initial.clone();
        const dir = mutation?.dir ?? this.opts.dir ?? 1;
        const source = new PieceFactory(rng, board.cols, mutation?.colorCount || colorCount);
        const sugar = new SugarEnergy();
        const talents = new TalentService();
        const actions: BotAction[] = [];
        let groups = 0;
        let goalValue = 0;
        let score = 0;
        let steps = 0;
        let nextPiece = source.next();
        const finish = (topOut = false) => ({ done: goalValue >= goal.target, goalValue, score, steps, topOut, bursts: sugar.bursts, actions });
        const options = () => ({
            dir, minGroupSize: mutation?.minGroupSize || this.opts.minGroupSize,
            specials: true, level: 1 + Math.floor(score / TUNING.level.threshold),
            deferredGravity: !!mutation?.deferredEvery,
        });
        const count = (res: SimLockResult) => {
            groups += res.groups;
            goalValue += goalDelta(goal, res);
            score += res.gain;
        };
        for (let i = 0; i < locks; i++) {
            const piece = nextPiece;
            // The preview is drawn before the mutation and talent RNG for this lock.
            nextPiece = source.next();
            const mirrorColor = mutation?.params.independentColor ? rng.int(colorCount) : piece.color;
            const placements = placementsFor(board, piece.shapeIndex, dir, true, mutation);
            if (!placements.length) return finish(true);

            // Release between locks while the current piece is still in play.
            const burst = sugar.full && goal.type !== 'rows';
            if (burst) {
                const level = sugar.consume();
                const color = SugarEnergy.targetColor(board);
                actions.push({ type: 'burst', color });
                const cells = applyBurst(board, color, level >= 2 ? TUNING.sugar.burstRadius : 0, blocks => {
                    if (goal.type === 'color') goalValue += blocks.filter(b => b.type === goal.color).length;
                    if (goal.type === 'stone') goalValue += blocks.filter(b => b.kind === 'stone').length;
                });
                const bonus = cells.length * 5 * level;
                score += bonus;
                if (goal.type === 'score') goalValue += bonus;
                if (goal.type === 'burst') goalValue++;
                applyGravity(board, dir);
                count(simulateSettle(board, options()));
                if (goalValue >= goal.target) return finish();
            }
            const candidates = burst ? placementsFor(board, piece.shapeIndex, dir, true, mutation) : placements;
            let best: { board: BoardModel; result: SimLockResult; rank: number; placement: Placement } | undefined;
            for (const p of candidates) {
                const probe = board.clone();
                if (mutation?.mirrors) {
                    const mirror = mutation.mirrorOf(p.cells, p.x, board.cols);
                    for (const c of mirror.cells) probe.set(p.y + dir * c.r, mirror.x + c.c, { type: mirrorColor, pid: -2 * piece.pid - 1 });
                }
                const res = simulateLock(probe, p.cells, p.x, p.y, piece.color, piece.pid, options());
                let rank = boardScore(probe, dir) + res.gain * 0.05 + goalDelta(goal, res) * 120;
                if (goal.type === 'rows') {
                    // Preserve near-complete rows even when a tempting color clear would dismantle them.
                    let potential = 0;
                    for (const row of probe.grid) {
                        const filled = row.reduce((n, block) => n + Number(!!block), 0);
                        potential += filled * filled;
                    }
                    rank = res.rows * 10000 + potential + boardScore(probe, dir) * 3;
                }
                if (!best || rank > best.rank) best = { board: probe, result: res, rank, placement: p };
            }
            if (!best) return finish(true);
            actions.push({ type: 'lock', rotation: best.placement.rotation, x: best.placement.x });
            board.copyFrom(best.board);
            steps++;
            count(best.result);
            if (sugar.full) {
                score += TUNING.sugar.lockBonus;
                if (goal.type === 'score') goalValue += TUNING.sugar.lockBonus;
            }
            sugar.add(best.result.removedCells, best.result.chainSum);
            if (goalValue >= goal.target) return finish();
            for (const event of mutation?.onLock(board, steps, piece.color) ?? []) {
                if (event.type === 'frostRain' && event.pushedOut > 0) return { ...finish(true), done: false };
                if (event.type === 'backflowFlush' || event.type === 'frostRain' || (event.type === 'magnet' && event.shifted)) {
                    if (event.type === 'backflowFlush') applyGravity(board, dir);
                    const p = best.placement;
                    const res = simulateSettle(board, { ...options(), specials: event.type !== 'frostRain', anchor: lastLockCell(p.cells, p.x, p.y, dir) });
                    count(res);
                    sugar.add(res.removedCells, res.chainSum);
                }
            }
            if (goalValue >= goal.target) return finish();
            if (mutation && talents.shouldOffer(groups)) {
                talents.offer(rng, false, { allowHints: false, allowStoneBonus: goal.type === 'stone' });
                talents.skip();
            }
        }
        return finish();
    }
}
