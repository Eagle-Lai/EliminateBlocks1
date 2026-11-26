/**
 * 内容生成公共库：稳定盘面构造、去重哈希、目标标定。
 * 只依赖 assets/scripts/core 的纯逻辑模块（Node 可直接跑）。
 */
import { BoardModel } from '../../assets/scripts/core/BoardModel';
import { findGroups } from '../../assets/scripts/core/MatchFinder';
import { Rng } from '../../assets/scripts/utils/Rng';
import type { GoalDef } from '../../assets/scripts/core/GoalTracker';
import type { PieceSpec } from '../../assets/scripts/core/PieceSource';
import { solveGoal, type SolveResult } from '../../assets/scripts/core/Solver';
import { SHAPES } from '../../assets/scripts/config/PieceShapeTable';
import { TUNING } from '../../assets/scripts/config/GameTuning';

export interface BoardSpec {
    rows: string[];
    density: number;
    stones: number;
}

/** 在 16×10 内构造一个"初始稳定"（无现成可消组）的盘面 */
export function buildStableBoard(
    rng: Rng,
    opts: { density: number; stoneCount: number; colorCount?: number } ,
): BoardSpec {

    const cols = TUNING.board.cols;
    const rows = TUNING.board.rows;
    const colorCount = opts.colorCount ?? TUNING.board.colorCount;
    const board = new BoardModel(cols, rows);
    const well = rng.int(cols);
    const depth = Math.round(rows * opts.density);
    const heights = Array.from({ length: cols }, (_, c) => c === well ? 0 : Math.max(2, depth - 2 + rng.int(5)));
    const occupied: Array<{ r: number; c: number }> = [];
    for (let c = 0; c < cols; c++) {
        for (let h = 0; h < heights[c]; h++) {
            const r = rows - h - 1;
            const first = rng.int(colorCount);
            let placed = false;
            for (let offset = 0; offset < colorCount; offset++) {
                board.set(r, c, { type: (first + offset) % colorCount, pid: 1000 + r * cols + c });
                if (findGroups(board, TUNING.rules.minGroupSize, true).length === 0) {
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                board.set(r, c, null);
                break;
            }
            occupied.push({ r, c });
        }
    }
    const stones = Math.min(opts.stoneCount, occupied.length);
    for (let i = 0; i < stones; i++) {
        const j = i + rng.int(occupied.length - i);
        [occupied[i], occupied[j]] = [occupied[j], occupied[i]];
        const { r, c } = occupied[i];
        board.set(r, c, { kind: 'stone', type: -1, pid: -1 });
    }
    return { rows: board.dump().split('\n'), density: occupied.length / (rows * cols), stones };
}

export function buildQueue(rng: Rng, count: number, colorCount = TUNING.board.colorCount): PieceSpec[] {
    const out: PieceSpec[] = [];
    for (let i = 0; i < count; i++) {
        out.push({ shape: rng.int(SHAPES.length), color: rng.int(colorCount) });
    }
    return out;
}

export function hashSpec(board: string[], queue: PieceSpec[]): string {
    return `${board.join('|')}#${queue.map((p) => `${p.shape}${p.color}`).join(',')}`;
}

/** 求解到"最大可达"，用于标定目标 */
export function calibrate(
    boardSpec: string[],
    queue: PieceSpec[],
    goalType: GoalDef['type'],
    color: number | undefined,
    beamWidth: number,
): { solved: boolean; best: number; result: SolveResult } {
    const board = BoardModel.fromPattern(boardSpec);
    const probe: GoalDef = {
        type: goalType,
        target: goalType === 'score' ? 1000000 : 999,
        color,
    };
    const result = solveGoal(board, queue, probe, { beamWidth, allowRotate: true });
    return { solved: result.solved, best: result.goalValue, result };
}

export function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

export function roundTo(v: number, step: number): number {
    return Math.round(v / step) * step;
}

export function quantile(values: readonly number[], q: number): number {
    const arr = values.slice().sort((a, b) => a - b);
    if (arr.length === 0) return 0;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(q * (arr.length - 1))));
    return arr[idx];
}
