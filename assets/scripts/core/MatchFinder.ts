/**
 * 同色连通块查找（4 邻域 BFS）。
 * 判定条件（与原型一致，禁止放宽）：
 *   size >= minGroupSize 且 不同 pid 数 >= 2
 *
 * 新增（可选）：skipKinds 中的阻挡块（石块/脆霜）不参与同色连通，
 * 但仍占格、仍受重力影响；不传时行为与基线完全一致。
 */
import type { BoardModel, BlockData, BlockKind } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';

export interface GroupInfo {
    cells: Cell[];
    size: number;
    pidCount: number;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];

export function findGroups(
    board: BoardModel,
    minGroupSize = 3,
    requireTwoPieces = true,
    skipKinds?: readonly BlockKind[],
): GroupInfo[] {
    const { rows, cols } = board;
    const seen = new Uint8Array(rows * cols);
    const groups: GroupInfo[] = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const start = board.get(r, c);
            if (!start || seen[r * cols + c]) continue;
            if (start.type < 0) continue;
            if (skipKinds && start.kind && skipKinds.indexOf(start.kind) >= 0) continue;

            const stack: number[] = [r * cols + c];
            seen[r * cols + c] = 1;
            const cells: Cell[] = [];
            const pids = new Set<number>();

            while (stack.length > 0) {
                const key = stack.pop() as number;
                const cr = (key / cols) | 0;
                const cc = key % cols;
                const block = board.get(cr, cc) as BlockData;
                cells.push({ r: cr, c: cc });
                pids.add(block.pid);

                for (let i = 0; i < DIRS.length; i++) {
                    const nr = cr + DIRS[i][0];
                    const nc = cc + DIRS[i][1];
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                    const nkey = nr * cols + nc;
                    if (seen[nkey]) continue;
                    const nb = board.get(nr, nc);
                    if (!nb || nb.type !== block.type) continue;
                    if (skipKinds && nb.kind && skipKinds.indexOf(nb.kind) >= 0) continue;
                    seen[nkey] = 1;
                    stack.push(nkey);
                }
            }

            const pidOk = requireTwoPieces ? pids.size >= 2 : true;
            if (cells.length >= minGroupSize && pidOk) {
                groups.push({ cells, size: cells.length, pidCount: pids.size });
            }
        }
    }

    return groups;
}

/** 找出所有可消除格（去重后供动画使用） */
export function flattenCells(groups: readonly GroupInfo[]): Cell[] {
    const set = new Set<string>();
    const out: Cell[] = [];
    for (const g of groups) {
        for (const cell of g.cells) {
            const key = `${cell.r},${cell.c}`;
            if (set.has(key)) continue;
            set.add(key);
            out.push({ r: cell.r, c: cell.c });
        }
    }
    return out;
}

/** 最大组的中心格，作为飘分锚点 */
export function biggestAnchor(groups: readonly GroupInfo[]): Cell {
    let biggest = groups[0];
    for (const g of groups) {
        if (g.size > biggest.size) biggest = g;
    }
    return biggest.cells[Math.floor(biggest.cells.length / 2)];
}

/** 组是否横竖共线（用于特殊块判定） */
export function groupLineAxis(cells: readonly Cell[]): 'h' | 'v' | null {
    if (cells.length < 2) return null;
    const r0 = cells[0].r;
    const c0 = cells[0].c;
    let sameRow = true;
    let sameCol = true;
    for (const cell of cells) {
        if (cell.r !== r0) sameRow = false;
        if (cell.c !== c0) sameCol = false;
    }
    if (sameRow) return 'h';
    if (sameCol) return 'v';
    return null;
}
