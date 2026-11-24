/**
 * 无引擎的落块模拟器：内容生成与校验、回放确定性检查都用它。
 * 逻辑与 ResolvePipeline 同源（同阈值/同公式/同重力/同特殊块），只是没有动画与等待。
 */
import type { BlockData, BlockKind, BoardModel } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';
import { applyGravity } from './GravityResolver';
import { findGroups, flattenCells, type GroupInfo } from './MatchFinder';
import { ScoreService } from './ScoreService';
import { expandSpecial, dominantColor } from './SpecialResolver';
import { planSpecials, writeSpecials, type SpecialSpawn } from './SpecialBlocks';
import { TUNING } from '../config/GameTuning';

export interface SimLockOptions {
    minGroupSize?: number;
    skipKinds?: readonly BlockKind[];
    dir?: 1 | -1;
    maxIterations?: number;
    /** 是否生成特殊块 */
    specials?: boolean;
}

export interface SimLockResult {
    gain: number;
    /** 被消除的方块（含特殊块扩展后的完整集合） */
    removed: BlockData[];
    removedCells: number;
    rows: number;
    chains: number;
    /** 本次新增的特殊块数量 */
    specials: number;
}

function anchorOf(groups: readonly GroupInfo[]): Cell {
    let biggest = groups[0];
    for (const g of groups) if (g.size > biggest.size) biggest = g;
    return biggest.cells[Math.floor(biggest.cells.length / 2)];
}

/** 在已放置好的棋盘上跑完整结算（同步） */
export function simulateSettle(board: BoardModel, opts: SimLockOptions = {}): SimLockResult {
    const score = new ScoreService();
    const minGroup = opts.minGroupSize ?? TUNING.rules.minGroupSize;
    const dir = opts.dir ?? 1;
    const max = opts.maxIterations ?? TUNING.settle.maxIterations;
    const skip = opts.skipKinds ?? ['stone', 'brittle'];
    const removed: BlockData[] = [];
    let removedCells = 0;
    let rowsCleared = 0;
    let chains = 0;
    let specials = 0;

    for (let i = 0; i < max; i++) {
        const groups = findGroups(board, minGroup, TUNING.rules.requireTwoPieces, skip);
        if (groups.length > 0) {
            chains++;
            const scored = score.computeGroupScore(groups, chains);
            score.add(scored.gain);

            const base = flattenCells(groups);
            const anchor = anchorOf(groups);
            const spawns: SpecialSpawn[] = opts.specials
                ? planSpecials(board, groups, anchor, true)
                : [];

            const expanded = expandSpecial(board, base);
            const cells = expanded.cells;

            for (const p of cells) {
                const b = board.get(p.r, p.c);
                if (b) removed.push(b);
            }
            removedCells += board.removeCells(cells);

            // 相邻的阻挡块（石块/脆霜）随消除碎裂：让 stone 目标真正可玩
            const broken = breakAdjacentBlockers(board, cells);
            for (const item of broken) {
                removed.push(item.block);
                removedCells++;
            }

            for (const p of expanded.recolors) {
                const b = board.get(p.cell.r, p.cell.c);
                if (!b) continue;
                board.set(p.cell.r, p.cell.c, { ...b, type: p.type });
            }

            if (spawns.length > 0) {
                writeSpecials(board, spawns);
                specials += spawns.length;
            }

            applyGravity(board, dir);
            continue;
        }
        const rows = board.fullRows();
        if (rows.length > 0) {
            score.add(score.computeRowScore(rows.length, 1));
            rowsCleared += rows.length;
            board.clearRows(rows, dir);
            chains = 0;
            continue;
        }
        break;
    }

    return {
        gain: score.score,
        removed,
        removedCells,
        rows: rowsCleared,
        chains,
        specials,
    };
}

/** 把一块骨牌写入棋盘并跑完整结算 */
export function simulateLock(
    board: BoardModel,
    cells: readonly Cell[],
    x: number,
    y: number,
    color: number,
    pid: number,
    opts: SimLockOptions = {},
): SimLockResult {
    const dir = opts.dir ?? 1;
    for (const cell of cells) {
        const r = y + (dir === 1 ? cell.r : -cell.r);
        const c = x + cell.c;
        if (r < 0 || r >= board.rows) continue;
        board.set(r, c, { type: color, pid });
    }
    return simulateSettle(board, opts);
}

/** 糖爆：清掉指定颜色 + 四邻一圈（Lv2 起） */
export function applyBurst(board: BoardModel, color: number, radius = 0): Cell[] {
    const targets: Cell[] = [];
    for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
            const b = board.get(r, c);
            if (b && b.type === color && b.kind !== 'stone') targets.push({ r, c });
        }
    }
    const all = new Map<string, Cell>();
    for (const p of targets) {
        all.set(`${p.r},${p.c}`, p);
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const nr = p.r + dr;
                const nc = p.c + dc;
                if (!board.inBounds(nr, nc)) continue;
                const b = board.get(nr, nc);
                if (!b || b.kind === 'stone') continue;
                all.set(`${nr},${nc}`, { r: nr, c: nc });
            }
        }
    }
    const cells = Array.from(all.values());
    board.removeCells(cells);
    return cells;
}

/** 与消除格 4 邻接的阻挡块碎裂，返回被碎的格子 */
export function breakAdjacentBlockers(
    board: BoardModel,
    removed: readonly Cell[],
): Array<{ cell: Cell; block: BlockData }> {
    const out: Array<{ cell: Cell; block: BlockData }> = [];
    const seen = new Set<string>();
    for (const cell of removed) {
        const around = [
            { r: cell.r - 1, c: cell.c },
            { r: cell.r + 1, c: cell.c },
            { r: cell.r, c: cell.c - 1 },
            { r: cell.r, c: cell.c + 1 },
        ];
        for (const p of around) {
            const b = board.get(p.r, p.c);
            if (!b || (b.kind !== 'stone' && b.kind !== 'brittle')) continue;
            const key = `${p.r},${p.c}`;
            if (seen.has(key)) continue;
            // 已在本轮消除集合里的不再重复计数
            if (removed.some((q) => q.r === p.r && q.c === p.c)) continue;
            seen.add(key);
            board.set(p.r, p.c, null);
            out.push({ cell: p, block: b });
        }
    }
    return out;
}

/** 当前盘面最多颜色 */
export function boardDominantColor(board: BoardModel): number {
    return dominantColor(board);
}

/** 计算硬降落点（与运行时同规则） */
export function dropY(board: BoardModel, cells: readonly Cell[], x: number, y: number, dir: 1 | -1 = 1): number {
    let gy = y;
    const collide = (yy: number): boolean => {
        for (const p of cells) {
            const nr = yy + (dir === 1 ? p.r : -p.r);
            const nc = x + p.c;
            if (nc < 0 || nc >= board.cols) return true;
            if (dir === 1 ? nr >= board.rows : nr < 0) return true;
            if (nr >= 0 && nr < board.rows && board.get(nr, nc)) return true;
        }
        return false;
    };
    while (!collide(gy + dir)) gy += dir;
    return gy;
}
