/**
 * 迷雾视野：顶部 N 行被迷雾覆盖。
 * 显形规则：迷雾行以下的方块永远显形；迷雾内与"已显形同色块"4 邻接的方块显形；
 * 与当前骨牌同色的方块始终显形（给玩家一点参考）。
 */
import type { BoardModel } from './BoardModel';

export class FogVision {
    /** 返回 rows×cols 的可见矩阵 */
    static compute(board: BoardModel, fogRows: number, activeColor = -1): boolean[][] {
        const visible: boolean[][] = [];
        for (let r = 0; r < board.rows; r++) {
            visible.push(new Array<boolean>(board.cols).fill(false));
        }
        if (fogRows <= 0) {
            for (let r = 0; r < board.rows; r++) visible[r].fill(true);
            return visible;
        }

        const fogEnd = Math.min(fogRows, board.rows);
        for (let r = fogEnd; r < board.rows; r++) visible[r].fill(true);

        // 从迷雾下边界向上做同色 4 邻接扩散
        const queue: Array<[number, number]> = [];
        for (let r = fogEnd - 1; r >= 0; r--) {
            for (let c = 0; c < board.cols; c++) {
                const below = r + 1 < board.rows ? board.get(r + 1, c) : null;
                const self = board.get(r, c);
                // 与"已显形的下方同色块"相邻才显形
                if (self && below && self.type === below.type && visible[r + 1][c]) {
                    visible[r][c] = true;
                    queue.push([r, c]);
                }
            }
        }
        // 与当前骨牌同色：迷雾内也显形
        if (activeColor >= 0) {
            for (let r = 0; r < fogEnd; r++) {
                for (let c = 0; c < board.cols; c++) {
                    const self = board.get(r, c);
                    if (self && self.type === activeColor) {
                        visible[r][c] = true;
                        queue.push([r, c]);
                    }
                }
            }
        }

        const DIRS = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];
        while (queue.length > 0) {
            const [r, c] = queue.pop() as [number, number];
            const self = board.get(r, c);
            if (!self) continue;
            for (const [dr, dc] of DIRS) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= fogEnd || nc < 0 || nc >= board.cols) continue;
                if (visible[nr][nc]) continue;
                const nb = board.get(nr, nc);
                if (nb && nb.type === self.type) {
                    visible[nr][nc] = true;
                    queue.push([nr, nc]);
                }
            }
        }

        return visible;
    }
}
