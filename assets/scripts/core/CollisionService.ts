/**
 * 碰撞检测（纯函数）。
 * 与原型一致：dir=1 时允许 y < 0（骨牌部分位于棋盘上方），但左右越界与底部越界均视为碰撞。
 * dir=-1（倒悬）时相反：允许 y 超过底边，越顶视为碰撞。
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
    dir: 1 | -1 = 1,
): boolean {
    for (const p of cells) {
        const nc = x + p.c;
        // 倒悬时骨牌向上生长：同一 y 下 cell.r 映射到 y-r
        const nr = y + (dir === 1 ? p.r : -p.r);
        if (nc < 0 || nc >= board.cols) return true;
        if (dir === 1) {
            if (nr >= board.rows) return true;
        } else if (nr < 0) {
            return true;
        }
        if (nr >= 0 && nr < board.rows && board.get(nr, nc)) return true;
    }
    return false;
}

/** 计算硬降落点（不修改任何状态） */
export function findDropY(
    board: CollisionBoardLike,
    cells: readonly Cell[],
    x: number,
    y: number,
    dir: 1 | -1 = 1,
): number {
    let gy = y;
    while (!collides(board, cells, x, gy + dir, dir)) gy += dir;
    return gy;
}
