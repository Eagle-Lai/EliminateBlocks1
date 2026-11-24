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
    const grid: (number | 'S' | null)[][] = [];
    for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(null));

    const filledRows = Math.max(3, Math.round(rows * opts.density));
    const startRow = rows - filledRows;
    let pid = 1;

    const sameColorComponent = (r: number, c: number, color: number): number => {
        const seen = new Set<string>();
        const stack: Array<[number, number]> = [[r, c]];
        let size = 0;
        while (stack.length > 0) {
            const [cr, cc] = stack.pop() as [number, number];
            const key = `${cr},${cc}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const v = grid[cr]?.[cc];
            if (v !== color) continue;
            size++;
            for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                const nr = cr + dr;
                const nc = cc + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                if (!seen.has(`${nr},${nc}`)) stack.push([nr, nc]);
            }
        }
        return size;
    };

    for (let r = startRow; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // 越靠下越容易被填满：底部留少量空洞避免瞬间满行
            const keepHole = r >= rows - 2 && rng.next() < 0.18;
            if (keepHole) continue;
            let chosen = -1;
            for (let attempt = 0; attempt < 12; attempt++) {
                const color = rng.int(colorCount);
                grid[r][c] = color;
                if (sameColorComponent(r, c, color) < TUNING.rules.minGroupSize) {
                    chosen = color;
                    break;
                }
                grid[r][c] = null;
            }
            if (chosen < 0) {
                // 无可放置色：留空（极少发生）
                grid[r][c] = null;
            } else {
                pid++;
            }
        }
    }

    // 石块：优先放在中部，避免直接填满顶行
    let stones = 0;
    let guard = 0;
    while (stones < opts.stoneCount && guard < 400) {
        guard++;
        const r = rows - 1 - rng.int(Math.max(3, Math.floor(filledRows * 0.7)));
        const c = rng.int(cols);
        if (grid[r][c] === null || grid[r][c] === 'S') continue;
        grid[r][c] = 'S';
        stones++;
    }

    const out: string[] = [];
    for (let r = 0; r < rows; r++) {
        let line = '';
        for (let c = 0; c < cols; c++) {
            const v = grid[r][c];
            line += v === null ? '.' : v === 'S' ? 'S' : String(v);
        }
        out.push(line);
    }

    // 稳定性兜底：若仍有可消组，随机换色直到稳定
    const board = BoardModel.fromPattern(out);
    let tries = 0;
    while (findGroups(board, TUNING.rules.minGroupSize, TUNING.rules.requireTwoPieces).length > 0 && tries < 60) {
        tries++;
        const r = rng.int(rows);
        const c = rng.int(cols);
        const b = board.get(r, c);
        if (b && b.kind !== 'stone') board.set(r, c, { type: rng.int(colorCount), pid: 900000 + tries });
    }

    const finalRows = board.dump().split('\n');
    const filled = board.blockCount();
    return { rows: finalRows, density: filled / (rows * cols), stones };
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
