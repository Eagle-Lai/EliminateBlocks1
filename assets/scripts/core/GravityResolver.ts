/**
 * 重力：逐列压缩（无横向移动），与原型 gravity() 等价。
 * dir=1 向下压实（默认）；dir=-1 向上压实（倒悬玩法）。
 * 直接改写棋盘，返回位移表供表现层参考（表现层也可用对象身份自行 diff）。
 */
import type { BoardModel, DropMove } from './BoardModel';

export function applyGravity(board: BoardModel, dir: 1 | -1 = 1): DropMove[] {
    const moves: DropMove[] = [];

    if (dir === 1) {
        for (let c = 0; c < board.cols; c++) {
            let write = board.rows - 1;
            for (let r = board.rows - 1; r >= 0; r--) {
                const block = board.get(r, c);
                if (!block) continue;
                if (write !== r) {
                    board.set(write, c, block);
                    board.set(r, c, null);
                    moves.push({ fromR: r, fromC: c, toR: write, toC: c, block });
                }
                write--;
            }
        }
        return moves;
    }

    for (let c = 0; c < board.cols; c++) {
        let write = 0;
        for (let r = 0; r < board.rows; r++) {
            const block = board.get(r, c);
            if (!block) continue;
            if (write !== r) {
                board.set(write, c, block);
                board.set(r, c, null);
                moves.push({ fromR: r, fromC: c, toR: write, toC: c, block });
            }
            write++;
        }
    }
    return moves;
}
