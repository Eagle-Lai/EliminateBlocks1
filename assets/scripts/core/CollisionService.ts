/**
 * 碰撞检测（纯函数）。
 * 与原型一致：允许 y < 0（骨牌部分位于棋盘上方），但左右越界与底部越界均视为碰撞。
 */
import type { BlockData } from './BoardModel';
import type { Cell } from '../config/PieceShapeTable';

export interface CollisionBoardLike {
    readonly cols: number;
    readonly rows: number;
    get(r: number, c: number): BlockData | null;
}

export function collides(
    board: CollisionBoardLike,
    cells: readonly Cell[],
    x: number,
    y: number,
): boolean {
    for (const p of cells) {
        const nc = x + p.c;
        const nr = y + p.r;
        if (nc < 0 || nc >= board.cols) return true;
        if (nr >= board.rows) return true;
        if (nr >= 0 && board.get(nr, nc)) return true;
    }
    return false;
}

/** 计算硬降落点（不修改任何状态） */
export function findDropY(
    board: CollisionBoardLike,
    cells: readonly Cell[],
    x: number,
    y: number,
): number {
    let gy = y;
    while (!collides(board, cells, x, gy + 1)) gy++;
    return gy;
}
